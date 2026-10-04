// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { ProjectWorkspace as LegacyProjectWorkspace } from './LegacyProjectWorkspace';
import { supabase, edgeFunctionUrl } from '../lib/supabase';
import { Sparkles, CheckCircle2, AlertTriangle, RefreshCw, X, Loader2, Zap } from 'lucide-react';

const terminal = new Set(['completed', 'failed']);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [rootKey, setRootKey] = useState(0);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const host = useRef<HTMLDivElement | null>(null);

  const relabel = useCallback(() => {
    const buttons = host.current?.querySelectorAll('button') || [];
    for (const b of Array.from(buttons) as HTMLButtonElement[]) {
      if (b.textContent?.includes('Rebuild Intelligence')) {
        for (const n of Array.from(b.childNodes)) {
          if (n.nodeType === Node.TEXT_NODE && n.textContent?.includes('Rebuild Intelligence')) {
            n.textContent = n.textContent.replace('Rebuild Intelligence', 'Run Analysis');
          }
        }
        b.setAttribute('data-lythouse-run-analysis', 'true');
      }
    }
  }, []);

  useEffect(() => {
    relabel();
    const o = new MutationObserver(relabel);
    if (host.current) o.observe(host.current, { subtree: true, childList: true, characterData: true });
    return () => o.disconnect();
  }, [relabel, rootKey]);

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Please sign in again to run analysis.');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    };
  };

  const poll = useCallback(
    async () => {
      const headers = await authHeaders();
      for (let i = 0; i < 120; i++) {
        const r = await fetch(`${edgeFunctionUrl}/analysis-status`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ projectId })
        });
        const b = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(b.error || 'Could not read analysis status.');
        setStatus(b);
        if (terminal.has(b.status)) {
          if (b.status === 'failed') throw new Error(b.error?.message || b.error || 'Analysis failed.');
          setRootKey((k) => k + 1);
          return;
        }
        await sleep(2000);
      }
      throw new Error('Analysis is still running. Open Runs & Analysis Control Plane to continue tracking it.');
    },
    [projectId]
  );

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setDismissed(false);
    setError('');
    setStatus({
      status: 'queueing',
      stages: { understand: 'queueing', investigate: 'blocked', resolve: 'blocked' }
    });
    try {
      const headers = await authHeaders();
      // 1. Try analysis-orchestrator if available
      try {
        const r = await fetch(`${edgeFunctionUrl}/analysis-orchestrator`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ projectId })
        });
        if (r.ok) {
          const b = await r.json().catch(() => ({}));
          setStatus({ ...b, stages: { understand: b.stage || 'queued', investigate: 'blocked', resolve: 'blocked' } });
          await poll();
          return;
        }
      } catch {}

      // 2. Try rebuild-intelligence
      try {
        const fallback = await fetch(`${edgeFunctionUrl}/rebuild-intelligence`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ projectId })
        });
        if (fallback.ok) {
          const fb = await fallback.json().catch(() => ({}));
          setStatus({
            status: 'completed',
            ...fb,
            stages: { understand: 'completed', investigate: 'completed', resolve: 'completed' }
          });
          setRootKey((k) => k + 1);
          return;
        }
      } catch {}

      // 3. Direct process-validation
      setStatus({
        status: 'running',
        stages: { understand: 'running', investigate: 'running', resolve: 'queueing' }
      });

      const { data: { session } } = await supabase.auth.getSession();
      const { data: p, error: pe } = await supabase.from('projects').select('id, workspace_id').eq('id', projectId).single();
      if (pe || !p) throw new Error(pe?.message || 'Project not found');

      const { data: v, error: ve } = await supabase.from('validations').insert({
        project_id: projectId,
        workspace_id: p.workspace_id,
        status: 'pending',
        trigger: 'intelligence',
        created_by: session?.user?.id || null
      }).select('id').single();
      if (ve || !v) throw new Error(ve?.message || 'Could not initialize validation');

      const { data: runRow } = await supabase.from('analysis_runs').insert({
        workspace_id: p.workspace_id,
        project_id: projectId,
        validation_id: v.id,
        mode: 'smart',
        depth: 'deep',
        domains: ['Code', 'Infrastructure', 'DevOps', 'QA', 'Cost', 'Dependencies', 'Vendor Intelligence'],
        status: 'running',
        created_by: session?.user?.id || null
      }).select('id').single();

      const procRes = await fetch(`${edgeFunctionUrl}/process-validation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ validationId: v.id, analysisRunId: runRow?.id })
      });
      const procBody = await procRes.json().catch(() => ({}));
      if (!procRes.ok && !procBody.success) {
        throw new Error(procBody.error || `Process validation returned ${procRes.status}`);
      }

      setStatus({
        status: 'completed',
        analysisRunId: runRow?.id || v.id,
        ...procBody,
        stages: { understand: 'completed', investigate: 'completed', resolve: 'completed' }
      });
      setRootKey((k) => k + 1);
    } catch (e: any) {
      setError(e?.message || 'Analysis failed.');
    } finally {
      setRunning(false);
    }
  }, [projectId, poll, running]);

  const capture = (e: any) => {
    const button = e.target?.closest?.('button');
    if (!button) return;
    const isRun = button.getAttribute('data-lythouse-run-analysis') === 'true' || /Run Analysis|Rebuild Intelligence/.test(button.textContent || '');
    if (!isRun) return;
    e.preventDefault();
    e.stopPropagation();
    run();
  };

  return (
    <div ref={host} onClickCapture={capture} className="w-full min-h-full">
      <LegacyProjectWorkspace
        key={rootKey}
        projectId={projectId}
        isAnalyzing={running}
        onRunAnalysis={run}
        analysisStatus={status}
        analysisError={error}
        analysisDismissed={dismissed}
        onDismissStatus={() => setDismissed(true)}
      />
    </div>
  );
}
