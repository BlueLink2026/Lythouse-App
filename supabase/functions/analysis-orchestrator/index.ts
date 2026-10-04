import { createClient } from "jsr:@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, apikey",
  "Access-Control-Max-Age": "86400",
};
const DOMAINS = [
  "Code",
  "Infrastructure",
  "DevOps",
  "QA",
  "Cost",
  "Dependencies",
  "Vendor Intelligence",
];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const messageOf = (e: any, fallback: string) =>
  e?.message || e?.details || e?.hint || fallback;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization") || "",
    token = auth.replace(/^Bearer\s+/i, "");
  let db: any = null,
    runId: string | null = null,
    validationId: string | null = null;
  try {
    const url = Deno.env.get("SUPABASE_URL")!,
      serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      workerSecret = Deno.env.get("LYTHOUSE_WORKER_SECRET");
    if (!workerSecret)
      return json(
        {
          error: "Analysis workers are not configured",
          stage: "configuration",
        },
        503,
      );
    db = createClient(url, serviceKey);
    const {
      data: { user },
    } = await db.auth.getUser(token);
    if (!user)
      return json(
        { error: "Invalid or expired session", stage: "authentication" },
        401,
      );
    const { projectId } = await req.json();
    if (!projectId)
      return json({ error: "Project is required", stage: "request" }, 400);
    const { data: p, error: pe } = await db
      .from("projects")
      .select("id,workspace_id,git_url,git_branch")
      .eq("id", projectId)
      .single();
    if (pe)
      return json(
        { error: messageOf(pe, "Could not load project"), stage: "project" },
        400,
      );
    if (!p?.git_url)
      return json(
        { error: "Connected repository required", stage: "project" },
        400,
      );
    const { data: member, error: me } = await db
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", p.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (me)
      return json(
        {
          error: messageOf(me, "Could not verify workspace membership"),
          stage: "authorization",
        },
        500,
      );
    if (!member)
      return json({ error: "Forbidden", stage: "authorization" }, 403);
    const { data: existing, error: ee } = await db
      .from("analysis_runs")
      .select("id,status,created_at,config")
      .eq("project_id", projectId)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ee)
      return json(
        {
          error: messageOf(ee, "Could not inspect active analysis"),
          stage: "queue",
        },
        500,
      );
    if (existing)
      return json(
        {
          success: true,
          reused: true,
          analysisRunId: existing.id,
          status: existing.status,
          snapshot: existing.config?.snapshot || null,
        },
        202,
      );
    const sr = await fetch(`${url}/functions/v1/repository-snapshot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lythouse-worker-secret": workerSecret,
      },
      body: JSON.stringify({ projectId }),
    });
    const snapshotBody = await sr.json().catch(() => ({}));
    if (!sr.ok)
      return json(
        {
          error: snapshotBody.error || "Could not pin repository commit",
          stage: "snapshot",
        },
        502,
      );
    const snapshot = {
      repository: p.git_url,
      branch: p.git_branch || "main",
      requestedAt: new Date().toISOString(),
      ...snapshotBody,
    };
    if (!snapshot.commitSha)
      return json(
        {
          error: "Repository snapshot did not return an exact commit SHA",
          stage: "snapshot",
        },
        502,
      );
    const { data: v, error: ve } = await db
      .from("validations")
      .insert({
        project_id: projectId,
        workspace_id: p.workspace_id,
        status: "pending",
        trigger: "intelligence",
        commit_sha: snapshot.commitSha,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (ve)
      return json(
        {
          error: messageOf(ve, "Could not create validation"),
          stage: "validation",
        },
        500,
      );
    validationId = v.id;
    const { data: run, error: re } = await db
      .from("analysis_runs")
      .insert({
        workspace_id: p.workspace_id,
        project_id: projectId,
        validation_id: v.id,
        mode: "smart",
        depth: "deep",
        domains: DOMAINS,
        status: "running",
        config: {
          source: "analysis_orchestrator",
          architecture: "control-plane-worker",
          snapshot,
          commitPinned: true,
          stages: {
            understand: "running",
            investigate: "blocked",
            resolve: "blocked",
          },
        },
        created_by: user.id,
      })
      .select("id")
      .single();
    if (re) {
      await db
        .from("validations")
        .update({
          status: "failed",
          summary: `Analysis run creation failed: ${messageOf(re, "unknown error")}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", v.id);
      return json(
        {
          error: messageOf(re, "Could not create analysis run"),
          stage: "analysis_run",
        },
        500,
      );
    }
    runId = run.id;
    const core = await fetch(`${url}/functions/v1/process-validation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
      },
      body: JSON.stringify({ validationId: v.id, analysisRunId: run.id }),
    });
    const coreBody = await core.json().catch(() => ({}));
    if (!core.ok) {
      const msg = coreBody.error || "Repository analysis failed";
      await db
        .from("analysis_runs")
        .update({
          status: "failed",
          error: { stage: "understand", message: msg },
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      await db
        .from("validations")
        .update({
          status: "failed",
          summary: msg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", v.id);
      return json(
        { error: msg, analysisRunId: run.id, stage: "understand" },
        core.status >= 400 && core.status < 600 ? core.status : 500,
      );
    }
    const config = {
      source: "analysis_orchestrator",
      architecture: "control-plane-worker",
      snapshot,
      commitPinned: true,
      coreValidation: "completed",
      core: coreBody,
      stages: {
        understand: "queued",
        investigate: "blocked",
        resolve: "blocked",
      },
    };
    const { error: ue } = await db
      .from("analysis_runs")
      .update({ status: "queued", error: null, config })
      .eq("id", run.id);
    if (ue)
      throw new Error(
        `Could not persist queued analysis state: ${messageOf(ue, "database error")}`,
      );
    const job = {
      workspace_id: p.workspace_id,
      project_id: projectId,
      analysis_run_id: run.id,
      validation_id: v.id,
      stage: "understand",
      status: "queued",
      priority: 80,
      input: {
        snapshot,
        domains: DOMAINS,
        commitSha: snapshot.commitSha,
        coreValidation: "completed",
      },
    };
    const { error: je } = await db.from("analysis_jobs").insert(job);
    if (je) {
      const msg = `Analysis queue rejected the job: ${messageOf(je, "database error")}`;
      await db
        .from("analysis_runs")
        .update({
          status: "failed",
          error: { stage: "queue", message: msg },
          completed_at: new Date().toISOString(),
          config: {
            ...config,
            stages: {
              understand: "failed",
              investigate: "blocked",
              resolve: "blocked",
            },
          },
        })
        .eq("id", run.id);
      await db
        .from("validations")
        .update({
          status: "failed",
          summary: msg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", v.id);
      return json(
        {
          error: msg,
          stage: "queue",
          analysisRunId: run.id,
          validationId: v.id,
        },
        500,
      );
    }
    EdgeRuntime.waitUntil(
      fetch(`${url}/functions/v1/analysis-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lythouse-worker-secret": workerSecret,
        },
        body: "{}",
      }).catch(() => new Response(null, { status: 500 })),
    );
    return json(
      {
        success: true,
        analysisRunId: run.id,
        validationId: v.id,
        status: "queued",
        stage: "understand",
        snapshot,
        commitPinned: true,
        coreValidation: "completed",
      },
      202,
    );
  } catch (e) {
    const msg = messageOf(e, "Could not queue analysis");
    if (db && runId)
      await db
        .from("analysis_runs")
        .update({
          status: "failed",
          error: { stage: "orchestrator", message: msg },
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    if (db && validationId)
      await db
        .from("validations")
        .update({
          status: "failed",
          summary: msg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", validationId);
    return json(
      { error: msg, stage: "orchestrator", analysisRunId: runId, validationId },
      500,
    );
  }
});
