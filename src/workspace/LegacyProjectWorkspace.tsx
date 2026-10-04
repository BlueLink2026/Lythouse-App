// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, edgeFunctionUrl, type Project } from '../lib/supabase';
import { Spinner, toast } from '../lib/ui';
import { Link } from '../lib/router';
import {
  ArrowLeft,
  Network,
  Sparkles,
  Code2,
  Server,
  DollarSign,
  Boxes,
  Search,
  Play,
  BrainCircuit,
  GitBranch,
  Package,
  FlaskConical,
  PlugZap,
  ExternalLink,
  Bug,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Wrench,
  TerminalSquare,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Filter,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  Zap,
  Info,
  Layers,
  FileCode,
  SlidersHorizontal,
  FolderGit2,
  Loader2,
  X
} from 'lucide-react';
import { ReleaseWorkspace } from './ReleaseWorkspace';
import { TopologyView } from './TopologyView';
import { TestLab } from './TestLab';

const DOMAINS = ['Code', 'Infrastructure', 'DevOps', 'QA', 'Cost', 'Dependencies', 'Vendor Intelligence'];
const NAV = ['Overview', ...DOMAINS];

const DOMAIN_META: Record<string, { icon: any; color: string; bg: string; desc: string }> = {
  Code: {
    icon: Code2,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 border-indigo-100',
    desc: 'Static code analysis, dangerous patterns, credentials, syntax, and logic reliability.'
  },
  Infrastructure: {
    icon: Server,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-100',
    desc: 'Terraform, Kubernetes, CloudFormation, IAM permissions, database configurations and cloud security.'
  },
  DevOps: {
    icon: Boxes,
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-100',
    desc: 'GitHub Actions, CI/CD pipeline security, Docker builds, and deployment controls.'
  },
  QA: {
    icon: FlaskConical,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-100',
    desc: 'API coverage, sandbox test executions, regression tracking, and missing test scenarios.'
  },
  Cost: {
    icon: DollarSign,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-100',
    desc: 'Cloud resource efficiency, orphaned configurations, and infrastructure cost optimization.'
  },
  Dependencies: {
    icon: Package,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50 border-cyan-100',
    desc: 'Package manifests, vulnerable library versions, supply chain security, and transitive risks.'
  },
  'Vendor Intelligence': {
    icon: ExternalLink,
    color: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-100',
    desc: 'Vendor lifecycles, upstream advisories, deprecation roadmaps, and CVE intelligence.'
  }
};

const MATCH: Record<string, string[]> = {
  Code: ['code', 'static_analysis', 'secret_scan', 'syntax'],
  Infrastructure: ['infrastructure', 'infrastructure_as_code', 'data', 'database', 'network', 'networking', 'reliability', 'scalability', 'security'],
  DevOps: ['devops', 'ci', 'cd', 'pipeline', 'deployment', 'configuration'],
  QA: ['qa', 'test', 'api'],
  Cost: ['cost', 'efficiency'],
  Dependencies: ['dependency', 'dependencies', 'supply', 'package'],
  'Vendor Intelligence': ['vendor', 'lifecycle', 'advisory']
};

function runFailure(r: any) {
  const raw = String(r?.result?.failure || r?.result?.error || r?.stderr || '').trim();
  if (raw) return raw.split('\n').find(Boolean)?.slice(0, 700) || raw.slice(0, 700);
  const code = r?.result?.exit_code;
  if (code != null) return `The sandbox process exited with code ${code}. A non-zero exit code means the validation script reported a failure.`;
  return 'This execution is marked failed, but no process error text was captured for this older run.';
}

function runFix(r: any) {
  const t = `${r?.stderr || ''}\n${r?.stdout || ''}\n${r?.result?.failure || ''}`.toLowerCase();
  if (t.includes('could not connect') || t.includes('connection refused')) {
    return 'Confirm the target service is running and reachable. If it is external, add its exact hostname to Allowed network domains and rerun.';
  }
  if (t.includes('expected http')) {
    return 'Compare the expected and actual HTTP status in the evidence below, correct the route/authentication/application response, then rerun.';
  }
  if (t.includes('not installed')) {
    return 'The script depends on a tool that is not available in the sandbox. Remove that dependency or use the selected runtime’s native capabilities, then rerun.';
  }
  if (t.includes('timeout') || t.includes('timed out')) {
    return 'Check target availability, latency and sandbox network policy. Resolve the slow or unreachable dependency, then rerun.';
  }
  if (t.includes('denied') || t.includes('network')) {
    return 'Outbound access is deny-by-default. Add only the exact required hostname to Allowed network domains and rerun.';
  }
  return 'Review stderr/stdout below, correct the first failing check or dependency, and rerun the test to verify the fix.';
}

export function ProjectWorkspace({
  projectId,
  isAnalyzing: isAnalyzingProp,
  onRunAnalysis: onRunAnalysisProp,
  analysisStatus,
  analysisError: externalAnalysisError,
  analysisDismissed,
  onDismissStatus
}: {
  projectId: string;
  isAnalyzing?: boolean;
  onRunAnalysis?: () => Promise<void> | void;
  analysisStatus?: any;
  analysisError?: string;
  analysisDismissed?: boolean;
  onDismissStatus?: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'workspace' | 'topology'>('workspace');
  const [lens, setLens] = useState('Overview');
  const [showRelease, setShowRelease] = useState(false);
  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [internalAnalyzing, setInternalAnalyzing] = useState(false);
  const analyzing = isAnalyzingProp !== undefined ? isAnalyzingProp : internalAnalyzing;
  const [analysisError, setAnalysisError] = useState('');
  const [dismissLocal, setDismissLocal] = useState(false);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isDismissed = Boolean(analysisDismissed || dismissLocal);
  const bannerError = externalAnalysisError || analysisError;
  const isComplete = analysisStatus?.status === 'completed';
  const showAnalysisBanner = Boolean((analyzing || analysisStatus || bannerError) && (!isDismissed || analyzing));

  const [validations, setValidations] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [intel, setIntel] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [apis, setApis] = useState<any[]>([]);
  const [qa, setQa] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [testRuns, setTestRuns] = useState<any[]>([]);
  const [external, setExternal] = useState<any[]>([]);
  const [jira, setJira] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = [
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('validations').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(10),
        supabase.from('findings').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(250),
        supabase.from('ai_insights').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1),
        supabase.from('analysis_runs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(10),
        supabase.from('application_components').select('*').eq('project_id', projectId).limit(500),
        supabase.from('api_endpoints').select('*').eq('project_id', projectId).limit(500),
        supabase.from('qa_gaps').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(100),
        supabase.from('qa_test_cases').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(100),
        supabase.from('qa_test_runs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(30),
        supabase.from('external_intelligence').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50),
        supabase.from('jira_issue_links').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50)
      ];
      const r = await Promise.all(qs);
      setProject(r[0].data);
      setValidations(r[1].data || []);
      setFindings(r[2].data || []);
      setIntel(r[3].data?.[0]?.content || null);
      setRuns(r[4].data || []);
      setComponents(r[5].data || []);
      setApis(r[6].data || []);
      setQa(r[7].data || []);
      setTests(r[8].data || []);
      setTestRuns(r[9].data || []);
      setExternal(r[10].data || []);
      setJira(r[11].data || []);
    } catch (e: any) {
      console.error('Failed loading workspace data:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const runIntelligence = useCallback(async () => {
    if (analyzing) return;
    if (onRunAnalysisProp) {
      await onRunAnalysisProp();
      await load();
      return;
    }
    setInternalAnalyzing(true);
    setAnalysisError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again to analyze this repository.');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
      };

      // 1. Try rebuild-intelligence
      let ok = false;
      try {
        const res = await fetch(`${edgeFunctionUrl}/rebuild-intelligence`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ projectId })
        });
        if (res.ok) ok = true;
      } catch {}

      // 2. If rebuild-intelligence is unavailable, run direct process-validation
      if (!ok) {
        const { data: p, error: pe } = await supabase.from('projects').select('id, workspace_id').eq('id', projectId).single();
        if (pe || !p) throw new Error(pe?.message || 'Project not found');

        const { data: v, error: ve } = await supabase.from('validations').insert({
          project_id: projectId,
          workspace_id: p.workspace_id,
          status: 'pending',
          trigger: 'intelligence',
          created_by: session.user.id
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
          created_by: session.user.id
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
      }

      toast('Analysis completed successfully!', 'success');
      await load();
    } catch (e: any) {
      setAnalysisError(e?.message || 'Repository intelligence failed.');
      toast(e?.message || 'Analysis failed', 'error');
    } finally {
      setInternalAnalyzing(false);
    }
  }, [analyzing, projectId, load, onRunAnalysisProp]);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast('Copied to clipboard', 'info');
  };

  const latest = useMemo(() => validations.find((v) => v.status === 'completed'), [validations]);
  const openFindings = useMemo(() => findings.filter((f) => f.status !== 'resolved'), [findings]);
  const criticalFindings = useMemo(() => openFindings.filter((f) => f.severity === 'critical'), [openFindings]);
  const highFindings = useMemo(() => openFindings.filter((f) => f.severity === 'high'), [openFindings]);
  const mediumFindings = useMemo(() => openFindings.filter((f) => f.severity === 'medium'), [openFindings]);
  const lowFindings = useMemo(() => openFindings.filter((f) => f.severity === 'low'), [openFindings]);

  const readinessScore = useMemo(() => {
    if (latest?.risk_score == null) return null;
    return Math.max(0, 100 - latest.risk_score);
  }, [latest]);

  const activeRun = runs[0];

  const filteredFindings = useMemo(() => {
    return openFindings.filter((f) => {
      const matchSearch = !query || `${f.title} ${f.category} ${f.file_path} ${f.description || ''}`.toLowerCase().includes(query.toLowerCase());
      const matchSeverity = severityFilter === 'all' || f.severity === severityFilter;
      return matchSearch && matchSeverity;
    });
  }, [openFindings, query, severityFilter]);

  const rowsForDomain = useCallback(
    (domain: string) => {
      const keys = MATCH[domain] || [domain.toLowerCase()];
      return filteredFindings.filter((f) => keys.some((k) => `${f.category || ''} ${f.title || ''}`.toLowerCase().includes(k)));
    },
    [filteredFindings]
  );

  const getDomainCount = useCallback(
    (d: string) => {
      if (d === 'QA') {
        return qa.filter((x) => x.status !== 'resolved').length + apis.length + testRuns.filter((x) => x.status === 'failed' || x.status === 'error').length;
      }
      if (d === 'Vendor Intelligence') return external.length;
      const keys = MATCH[d] || [d.toLowerCase()];
      return openFindings.filter((f) => keys.some((k) => `${f.category || ''} ${f.title || ''}`.toLowerCase().includes(k))).length;
    },
    [qa, apis, testRuns, external, openFindings]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Spinner size={32} className="text-brand-600" />
        <p className="text-sm font-medium text-slate-500 animate-pulse">Loading project intelligence workspace...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
        <AlertTriangle size={36} className="mx-auto text-amber-500 mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Project Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-5">The requested project could not be found or you do not have permission to view it.</p>
        <Link to="/projects" className="btn-primary inline-flex text-xs">
          <ArrowLeft size={14} className="mr-1.5" /> Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-[#f8fafc] text-slate-900 pb-16">
      {/* Sleek Enterprise Header Bar */}
      <header className="w-full border-b border-slate-200/90 bg-white px-4 sm:px-6 lg:px-8 py-3.5 shadow-xs">
        <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          {/* Project Identity */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight truncate">
                {project.name}
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 rounded-md px-2 py-0.5">
                <GitBranch size={11} className="text-slate-500 shrink-0" />
                <span className="truncate max-w-[120px]">{project.git_branch || 'main'}</span>
              </span>
              {project.language && (
                <span className="inline-flex items-center text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/90 rounded-md px-2 py-0.5">
                  {project.language}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200/70 rounded-md px-2 py-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${analyzing ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                {analyzing ? 'Inspecting' : 'Ready'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Engineering & QA Intelligence Workspace
            </p>
          </div>

          {/* Action Button Group */}
          <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
            <button
              onClick={runIntelligence}
              disabled={analyzing}
              data-lythouse-run-analysis="true"
              className="btn-primary text-xs flex items-center justify-center gap-2 px-3.5 py-2 font-semibold shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed flex-1 sm:flex-initial"
            >
              {analyzing ? <Loader2 size={13} className="animate-spin shrink-0" /> : <RefreshCw size={13} className="shrink-0" />}
              <span>{analyzing ? 'Analyzing Repository…' : 'Run Analysis'}</span>
            </button>

            <button
              onClick={() => setView(view === 'topology' ? 'workspace' : 'topology')}
              disabled={analyzing}
              className={`btn-secondary text-xs flex items-center justify-center gap-1.5 px-3 py-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-initial ${
                view === 'topology' ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' : ''
              }`}
            >
              <Network size={13} className="shrink-0" />
              <span>{view === 'topology' ? 'Workspace' : 'Architecture'}</span>
            </button>

            <button
              onClick={() => setShowRelease((v) => !v)}
              disabled={analyzing}
              className={`btn-secondary text-xs flex items-center justify-center gap-1.5 px-3 py-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-initial ${
                showRelease ? 'bg-brand-600 text-white border-brand-600 hover:bg-brand-700' : ''
              }`}
            >
              <Play size={13} className="shrink-0" />
              <span>Release Workflow</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      {view === 'topology' ? (
        <div className="w-full p-4 sm:p-6 lg:p-8">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setView('workspace')} className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1">
              <ArrowLeft size={13} /> Back to Intelligence Workspace
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <TopologyView projectId={projectId} project={project} onOpenFile={() => setView('workspace')} />
          </div>
        </div>
      ) : (
        <main className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Analysis Control Plane Banner (Integrated, sleek, responsive) */}
          {showAnalysisBanner && (
            <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`p-2 rounded-xl shrink-0 ${
                    bannerError ? 'bg-red-50 text-red-600' : analyzing ? 'bg-indigo-50 text-brand-600 animate-spin' : isComplete ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {bannerError ? <AlertTriangle size={17} /> : analyzing ? <Loader2 size={17} /> : <CheckCircle2 size={17} />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Analysis Control Plane</span>
                      {analysisStatus?.analysisRunId && (
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          Run #{String(analysisStatus.analysisRunId).slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {bannerError
                        ? 'Analysis needs attention'
                        : analyzing
                        ? 'Repository Deep Inspection in Progress…'
                        : isComplete
                        ? 'Analysis completed successfully'
                        : 'Analysis Pipeline Ready'}
                    </h4>
                  </div>
                </div>

                {!analyzing && (
                  <button
                    onClick={() => {
                      if (onDismissStatus) onDismissStatus();
                      setDismissLocal(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Dismiss"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Responsive 3-Step Pipeline */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3.5">
                {[
                  { key: 'understand', num: '1', label: 'Understand', desc: 'Scan AST, repo tree & dependencies' },
                  { key: 'investigate', num: '2', label: 'Investigate', desc: 'Execute IaC, static & secret checks' },
                  { key: 'resolve', num: '3', label: 'Resolve', desc: 'AI synthesis & remediation plan' }
                ].map((s, idx) => {
                  const stages = analysisStatus?.stages || analysisStatus?.config?.stages || {};
                  const state = stages[s.key] || (idx === 0 && analyzing ? 'running' : isComplete ? 'completed' : 'blocked');
                  const isRunningStage = state === 'running' || state === 'queueing';
                  const isDoneStage = state === 'completed' || isComplete;
                  return (
                    <div
                      key={s.key}
                      className={`rounded-xl border p-3 transition-all ${
                        isRunningStage
                          ? 'border-brand-300 bg-brand-50/40 shadow-xs'
                          : isDoneStage
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : 'border-slate-100 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Step {s.num}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isRunningStage
                              ? 'bg-brand-100 text-brand-700 animate-pulse'
                              : isDoneStage
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200/70 text-slate-500'
                          }`}
                        >
                          {isRunningStage && <Loader2 size={10} className="animate-spin shrink-0" />}
                          {state}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 mt-1.5">{s.label}</div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{s.desc}</p>
                    </div>
                  );
                })}
              </div>

              {bannerError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} className="text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <b>Analysis failed:</b> {bannerError}
                    </div>
                  </div>
                  <button
                    onClick={runIntelligence}
                    disabled={analyzing}
                    className="btn-secondary text-[11px] py-1 px-2.5 bg-white text-red-700 border-red-200 hover:bg-red-50 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {analyzing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    {analyzing ? 'Retrying…' : 'Retry'}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Release Drawer / Accordion */}
          {showRelease && (
            <section className="rounded-2xl border-2 border-brand-200 bg-white overflow-hidden shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="px-6 py-4 border-b border-brand-100 bg-brand-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-brand-600 text-white">
                    <Play size={14} />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Release Validation & Governance</h3>
                    <p className="text-[11px] text-slate-500">Continuous pre-deployment gate, simulation, and automated validation</p>
                  </div>
                </div>
                <button onClick={() => setShowRelease(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-1 rounded-lg border border-slate-200 bg-white">
                  Close Drawer
                </button>
              </div>
              <div className="min-h-[600px]">
                <ReleaseWorkspace projectId={projectId} project={project} />
              </div>
            </section>
          )}

          {/* Hero Banner */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-xl border border-slate-800">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-[1] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-3xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold text-brand-300 tracking-wide uppercase">
                  <BrainCircuit size={14} />
                  LytHouse Deep Intelligence Engine
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Holistic Engineering, QA & Release Assurance
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                  Unified repository static analysis, architecture topology, API contracts, automated sandbox tests, and vendor lifecycle intelligence in one continuous evidence model.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:min-w-[320px]">
                <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-3.5 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">Components</span>
                  <div className="text-xl font-bold mt-1 text-white flex items-center justify-between">
                    {components.length}
                    <Layers size={16} className="text-indigo-300 opacity-60" />
                  </div>
                </div>

                <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-3.5 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">APIs Surface</span>
                  <div className="text-xl font-bold mt-1 text-white flex items-center justify-between">
                    {apis.length}
                    <PlugZap size={16} className="text-cyan-300 opacity-60" />
                  </div>
                </div>

                <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-3.5 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">Test Lab Runs</span>
                  <div className="text-xl font-bold mt-1 text-white flex items-center justify-between">
                    {testRuns.length}
                    <FlaskConical size={16} className="text-emerald-300 opacity-60" />
                  </div>
                </div>

                <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-3.5 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">Vendor Signals</span>
                  <div className="text-xl font-bold mt-1 text-white flex items-center justify-between">
                    {external.length}
                    <ExternalLink size={16} className="text-rose-300 opacity-60" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* KPI Dashboard Cards */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Release Readiness */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Release Readiness</span>
                <ShieldCheck size={16} className={readinessScore !== null && readinessScore >= 75 ? 'text-emerald-600' : 'text-slate-400'} />
              </div>
              <div className="my-2.5 flex items-baseline gap-2">
                <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                  readinessScore === null ? 'text-slate-400' : readinessScore >= 80 ? 'text-emerald-600' : readinessScore >= 50 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {readinessScore !== null ? `${readinessScore}%` : '—'}
                </span>
                {readinessScore !== null && (
                  <span className="text-[11px] font-medium text-slate-400">
                    {readinessScore >= 80 ? 'Ready' : readinessScore >= 50 ? 'Review' : 'Blocked'}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate">
                {latest ? 'Verified evidence baseline' : analyzing ? 'Analyzing repository…' : 'Awaiting first analysis'}
              </div>
            </div>

            {/* High-Priority Blockers */}
            <div className={`rounded-2xl border p-4 shadow-sm flex flex-col justify-between ${
              criticalFindings.length > 0 ? 'border-red-200 bg-red-50/40' : 'border-slate-200/80 bg-white'
            }`}>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Risk Blockers</span>
                <ShieldAlert size={16} className={criticalFindings.length > 0 ? 'text-red-600' : 'text-slate-400'} />
              </div>
              <div className="my-2.5 flex items-baseline gap-2">
                <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${criticalFindings.length > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                  {criticalFindings.length + highFindings.length}
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  {criticalFindings.length} critical, {highFindings.length} high
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate">
                {openFindings.length} total active findings
              </div>
            </div>

            {/* QA Executions */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">QA Executions</span>
                <FlaskConical size={16} className="text-slate-400" />
              </div>
              <div className="my-2.5 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  {testRuns.length}
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  {testRuns.filter((x) => x.status === 'passed').length} passed
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate">
                {testRuns.filter((x) => x.status === 'failed' || x.status === 'error').length} failed sandbox runs
              </div>
            </div>

            {/* API Surface */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">API Surface</span>
                <PlugZap size={16} className="text-slate-400" />
              </div>
              <div className="my-2.5 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  {apis.length}
                </span>
                <span className="text-[11px] font-medium text-slate-400">endpoints</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate">
                {apis.filter((x) => x.auth_required === false).length} without observed auth
              </div>
            </div>

            {/* Intelligence Run Status */}
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Engine Status</span>
                <Zap size={16} className={analyzing ? 'text-brand-600 animate-bounce' : 'text-slate-400'} />
              </div>
              <div className="my-2.5 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${
                  analyzing ? 'bg-amber-500 animate-ping' : activeRun?.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-400'
                }`} />
                <span className="text-base sm:text-lg font-bold text-slate-900 capitalize truncate">
                  {analyzing ? 'Analyzing…' : activeRun?.status || 'Ready'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate">
                {activeRun?.created_at ? new Date(activeRun.created_at).toLocaleDateString() : 'Auto-scan enabled'}
              </div>
            </div>
          </section>

          {/* Domain Navigation Tabs */}
          <nav className="rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm overflow-x-auto">
            <div className="flex items-center min-w-max gap-1">
              {NAV.map((n) => {
                const isActive = lens === n;
                const count = n === 'Overview' ? openFindings.length : getDomainCount(n);
                const Icon = n === 'Overview' ? BrainCircuit : DOMAIN_META[n]?.icon || Code2;
                return (
                  <button
                    key={n}
                    onClick={() => setLens(n)}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={14} className={isActive ? 'text-brand-300' : 'text-slate-400'} />
                    <span>{n}</span>
                    {count > 0 && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Tab Content: OVERVIEW */}
          {lens === 'Overview' && (
            <div className="space-y-6">
              {/* Split: Domain Highlights + AI Intelligence Brief */}
              <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6">
                {/* Left: Domain Signals Grid */}
                <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Intelligence Domains</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Consolidated findings and telemetry across key software engineering planes.</p>
                    </div>
                  </div>

                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
                    {DOMAINS.map((d) => {
                      const meta = DOMAIN_META[d] || DOMAIN_META.Code;
                      const Icon = meta.icon;
                      const count = getDomainCount(d);
                      return (
                        <button
                          key={d}
                          onClick={() => setLens(d)}
                          className="group rounded-2xl border border-slate-200/80 p-4 text-left transition-all hover:border-slate-300 hover:shadow-md hover:bg-slate-50/60 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className={`h-9 w-9 rounded-xl flex items-center justify-center ${meta.bg} ${meta.color}`}>
                                <Icon size={18} />
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
                                {count} signals <ArrowUpRight size={11} className="opacity-60" />
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-900 mt-3 group-hover:text-brand-600 transition-colors">{d}</h4>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{meta.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Right: AI Intelligence Brief */}
                <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
                        <Sparkles size={14} />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">AI Intelligence Brief</h3>
                        <p className="text-[11px] text-slate-500">Evidence-backed pre-deployment reasoning</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-center">
                    {intel ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 text-xs leading-relaxed text-slate-700">
                          {typeof intel === 'string' ? (
                            <p className="whitespace-pre-wrap">{intel}</p>
                          ) : (
                            <div className="space-y-3">
                              {intel.summary && (
                                <div>
                                  <b className="text-indigo-950 font-bold block mb-1">Summary:</b>
                                  <p>{intel.summary}</p>
                                </div>
                              )}
                              {intel.key_risks && Array.isArray(intel.key_risks) && (
                                <div>
                                  <b className="text-indigo-950 font-bold block mb-1">Key Risk Factors:</b>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {intel.key_risks.map((k: string, idx: number) => (
                                      <li key={idx}>{k}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {intel.next_steps && Array.isArray(intel.next_steps) && (
                                <div>
                                  <b className="text-indigo-950 font-bold block mb-1">Recommended Actions:</b>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {intel.next_steps.map((k: string, idx: number) => (
                                      <li key={idx}>{k}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <BrainCircuit size={32} className="mx-auto text-slate-300 mb-2" />
                        <h4 className="text-sm font-bold text-slate-700">Awaiting Verified Evidence</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                          {analyzing ? 'LytHouse is reading repository evidence and generating an assessment.' : 'Click Run Analysis to inspect the connected codebase.'}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* QA Assurance Highlights */}
              <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">QA & Sandbox Assurance</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Automated test lab execution, coverage gap analysis, and API endpoint contracts.</p>
                  </div>
                  <button onClick={() => setLens('QA')} className="text-xs font-semibold text-brand-600 hover:underline">
                    Open QA Hub →
                  </button>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setLens('QA')}
                    className="rounded-2xl border border-slate-200 p-4 text-left hover:border-brand-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                        <FlaskConical size={18} />
                      </span>
                      <span className="text-xl font-bold text-slate-900">{qa.length}</span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 mt-3">QA Gaps & Missing Tests</h4>
                    <p className="text-xs text-slate-500 mt-1">Identified test coverage holes based on code changes and API contracts.</p>
                  </button>

                  <button
                    onClick={() => setLens('QA')}
                    className="rounded-2xl border border-slate-200 p-4 text-left hover:border-brand-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-xl bg-cyan-50 text-cyan-700">
                        <PlugZap size={18} />
                      </span>
                      <span className="text-xl font-bold text-slate-900">{apis.length}</span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 mt-3">Discovered API Endpoints</h4>
                    <p className="text-xs text-slate-500 mt-1">HTTP routes, auth boundaries, negative cases, and parameter validation.</p>
                  </button>

                  <button
                    onClick={() => setLens('QA')}
                    className="rounded-2xl border border-slate-200 p-4 text-left hover:border-brand-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                        <Play size={18} />
                      </span>
                      <span className="text-xl font-bold text-slate-900">{testRuns.length}</span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 mt-3">Sandbox Executions</h4>
                    <p className="text-xs text-slate-500 mt-1">Isolated test runs with persisted stdout, stderr, and root-cause analysis.</p>
                  </button>
                </div>
              </section>

              {/* Universal Findings Explorer */}
              <FindingsExplorer
                findings={filteredFindings}
                query={query}
                setQuery={setQuery}
                severityFilter={severityFilter}
                setSeverityFilter={setSeverityFilter}
                expandedFinding={expandedFinding}
                setExpandedFinding={setExpandedFinding}
                copiedKey={copiedKey}
                onCopy={copyText}
              />
            </div>
          )}

          {/* Tab Content: QA */}
          {lens === 'QA' && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">QA Intelligence, APIs & Test Lab</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Execute scripts in isolated sandboxes, verify APIs, and fix coverage gaps.</p>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
                  {/* Left Column: Gaps, APIs & Recent Runs */}
                  <div className="space-y-5">
                    {/* QA Gaps */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Coverage Gaps ({qa.length})</h4>
                      {qa.length > 0 ? (
                        <div className="space-y-3">
                          {qa.map((g) => (
                            <div key={g.id} className="rounded-2xl border border-slate-200 p-4 bg-white hover:border-slate-300 transition-colors">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                  <b className="text-sm font-semibold text-slate-900">{g.title}</b>
                                </div>
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  g.severity === 'high' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {g.severity || 'medium'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{g.description || 'Coverage gap identified from project evidence.'}</p>
                              {g.recommended_test && (
                                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-700">
                                  <b className="text-slate-900 block mb-1">Recommended test:</b>
                                  <code className="text-[11px] font-mono block whitespace-pre-wrap">{g.recommended_test}</code>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                          No QA coverage gaps flagged yet.
                        </div>
                      )}
                    </div>

                    {/* API Endpoints */}
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">Discovered API Inventory ({apis.length})</span>
                      </div>
                      {apis.length > 0 ? (
                        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                          {apis.slice(0, 20).map((a) => (
                            <div key={a.id} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                              <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                                a.method === 'GET' ? 'bg-blue-50 text-blue-700' :
                                a.method === 'POST' ? 'bg-emerald-50 text-emerald-700' :
                                a.method === 'PUT' || a.method === 'PATCH' ? 'bg-amber-50 text-amber-700' :
                                'bg-rose-50 text-rose-700'
                              }`}>
                                {a.method || 'ANY'}
                              </span>
                              <code className="text-slate-800 font-mono text-[11px] flex-1 truncate">{a.route}</code>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                a.auth_required === true ? 'bg-emerald-50 text-emerald-700' :
                                a.auth_required === false ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {a.auth_required === true ? 'Auth Required' : a.auth_required === false ? 'Public' : 'Auth Unknown'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-xs text-slate-500">No API endpoints cataloged yet.</div>
                      )}
                    </div>

                    {/* Recent Test Lab Executions */}
                    {testRuns.length > 0 && (
                      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">Recent Test Lab Executions</span>
                          <span className="text-[11px] text-slate-400">Click to expand evidence</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {testRuns.slice(0, 8).map((r) => {
                            const open = expandedRun === r.id;
                            const failed = r.status === 'failed' || r.status === 'error';
                            return (
                              <div key={r.id}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedRun(open ? null : r.id)}
                                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                                >
                                  <span className={`h-2.5 w-2.5 rounded-full ${
                                    r.status === 'passed' ? 'bg-emerald-500' : r.status === 'running' ? 'bg-amber-500' : 'bg-red-500'
                                  }`} />
                                  <div className="flex-1">
                                    <b className="text-xs font-bold capitalize text-slate-900">{r.status}</b>
                                    <p className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleString()}</p>
                                  </div>
                                  <span className="text-xs text-slate-500 font-mono">{r.result?.duration_ms ? `${r.result.duration_ms}ms` : ''}</span>
                                  {open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                                </button>

                                {open && (
                                  <div className={`p-4 border-t ${failed ? 'bg-red-50/30' : 'bg-emerald-50/20'} space-y-3`}>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                      <div className="rounded-lg border bg-white p-2 text-center">
                                        <div className="text-[10px] text-slate-400 uppercase">Status</div>
                                        <div className="font-bold capitalize">{r.status}</div>
                                      </div>
                                      <div className="rounded-lg border bg-white p-2 text-center">
                                        <div className="text-[10px] text-slate-400 uppercase">Exit Code</div>
                                        <div className="font-bold">{String(r.result?.exit_code ?? '—')}</div>
                                      </div>
                                      <div className="rounded-lg border bg-white p-2 text-center">
                                        <div className="text-[10px] text-slate-400 uppercase">Run ID</div>
                                        <div className="font-bold font-mono">{String(r.id).slice(0, 8)}</div>
                                      </div>
                                    </div>

                                    {failed && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                        <div className="rounded-xl border border-red-200 bg-white p-3">
                                          <div className="font-bold text-red-800 flex items-center gap-1.5 mb-1">
                                            <AlertTriangle size={13} /> Why it failed
                                          </div>
                                          <p className="text-slate-700 leading-relaxed">{runFailure(r)}</p>
                                        </div>
                                        <div className="rounded-xl border border-amber-200 bg-white p-3">
                                          <div className="font-bold text-amber-800 flex items-center gap-1.5 mb-1">
                                            <Wrench size={13} /> How to resolve
                                          </div>
                                          <p className="text-slate-700 leading-relaxed">{runFix(r)}</p>
                                        </div>
                                      </div>
                                    )}

                                    {r.stderr && (
                                      <div>
                                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">stderr output</div>
                                        <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] max-h-48 overflow-auto whitespace-pre-wrap">
                                          {r.stderr}
                                        </pre>
                                      </div>
                                    )}
                                    {r.stdout && (
                                      <div>
                                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">stdout output</div>
                                        <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] max-h-48 overflow-auto whitespace-pre-wrap">
                                          {r.stdout}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Embedded Test Lab */}
                  <div>
                    <TestLab projectId={projectId} onComplete={load} />
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Tab Content: VENDOR INTELLIGENCE */}
          {lens === 'Vendor Intelligence' && (
            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-900">Vendor & Advisory Intelligence</h3>
                <p className="text-xs text-slate-500 mt-0.5">Authoritative vendor lifecycle notices, CVE security warnings, and dependency deprecations.</p>
              </div>

              <div className="p-5">
                {external.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {external.map((x) => (
                      <div key={x.id} className="rounded-2xl border border-slate-200 p-4 bg-white hover:border-slate-300 transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <b className="text-sm font-bold text-slate-900">{x.subject}</b>
                            <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full uppercase">
                              {x.intelligence_type || 'Advisory'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-2 leading-relaxed">{x.advisory}</p>
                        </div>
                        {x.source_url && (
                          <a
                            href={x.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-brand-600 hover:text-brand-700 mt-3 inline-flex items-center gap-1"
                          >
                            Read Vendor Advisory <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ExternalLink size={32} className="mx-auto text-slate-300 mb-2" />
                    <h4 className="text-sm font-bold text-slate-700">No Vendor Advisories Recorded</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      LytHouse only lists vendor advisory and lifecycle notices after authoritative upstream evidence is verified.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Tab Content: OTHER DOMAIN TABS (Code, Infra, DevOps, Cost, Dependencies) */}
          {!['Overview', 'QA', 'Vendor Intelligence'].includes(lens) && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
                <div className="flex items-center gap-3">
                  {(() => {
                    const meta = DOMAIN_META[lens] || DOMAIN_META.Code;
                    const Icon = meta.icon;
                    return (
                      <span className={`h-10 w-10 rounded-2xl flex items-center justify-center ${meta.bg} ${meta.color}`}>
                        <Icon size={20} />
                      </span>
                    );
                  })()}
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{lens} Intelligence</h3>
                    <p className="text-xs text-slate-500">{DOMAIN_META[lens]?.desc}</p>
                  </div>
                </div>
              </section>

              <FindingsExplorer
                findings={rowsForDomain(lens)}
                query={query}
                setQuery={setQuery}
                severityFilter={severityFilter}
                setSeverityFilter={setSeverityFilter}
                expandedFinding={expandedFinding}
                setExpandedFinding={setExpandedFinding}
                copiedKey={copiedKey}
                onCopy={copyText}
              />
            </div>
          )}

          {/* Jira Verification Chain */}
          {jira.length > 0 && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                  <CheckCircle2 size={15} />
                </span>
                <h3 className="text-sm font-bold text-slate-900">Jira Verification Chain</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {jira.map((j) => (
                  <div key={j.id} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{j.jira_issue_key}</span>
                    <span className="text-slate-500">{j.status || 'Linked to LytHouse'}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      )}
    </div>
  );
}

// Reusable Rich Findings Explorer with Search, Filters, and Expandable Drawers
function FindingsExplorer({
  findings,
  query,
  setQuery,
  severityFilter,
  setSeverityFilter,
  expandedFinding,
  setExpandedFinding,
  copiedKey,
  onCopy
}: {
  findings: any[];
  query: string;
  setQuery: (q: string) => void;
  severityFilter: string;
  setSeverityFilter: (s: any) => void;
  expandedFinding: string | null;
  setExpandedFinding: (id: string | null) => void;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Bug size={15} className="text-slate-500" />
            Verified Findings Explorer ({findings.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Filter by severity or search code patterns, secrets, and IaC rules.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Severity Filters */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl text-xs overflow-x-auto scrollbar-none max-w-full">
            {['all', 'critical', 'high', 'medium', 'low'].map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`px-2.5 py-1 rounded-lg font-semibold uppercase text-[10px] transition-colors shrink-0 ${
                  severityFilter === s
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search findings or files…"
              className="w-full sm:w-60 rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>
      </div>

      {findings.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {findings.slice(0, 25).map((f) => {
            const isExpanded = expandedFinding === f.id;
            return (
              <div key={f.id} className="transition-colors hover:bg-slate-50/50">
                <div
                  onClick={() => setExpandedFinding(isExpanded ? null : f.id)}
                  className="p-4 sm:p-5 flex items-start gap-3.5 cursor-pointer"
                >
                  <span
                    className={`mt-0.5 inline-flex items-center justify-center p-1.5 rounded-xl shrink-0 ${
                      f.severity === 'critical' ? 'bg-red-50 text-red-600' :
                      f.severity === 'high' ? 'bg-orange-50 text-orange-600' :
                      f.severity === 'medium' ? 'bg-amber-50 text-amber-600' :
                      'bg-blue-50 text-blue-600'
                    }`}
                  >
                    <Bug size={16} />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-sm font-semibold text-slate-900 truncate">{f.title}</b>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          f.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          f.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                          f.severity === 'medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {f.severity}
                      </span>
                      {f.category && (
                        <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          {f.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-mono">
                      {f.file_path && (
                        <span className="truncate flex items-center gap-1">
                          <FileCode size={12} className="opacity-60" />
                          {f.file_path}
                          {f.line ? `:${f.line}` : ''}
                        </span>
                      )}
                      {f.confidence && (
                        <span className="text-[11px] text-slate-400">Confidence {f.confidence}%</span>
                      )}
                    </div>
                  </div>

                  <button className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 bg-slate-50/80 border-t border-slate-100 space-y-3.5 text-xs">
                    {f.description && (
                      <div>
                        <span className="font-semibold text-slate-700 block mb-1">Issue Description:</span>
                        <p className="text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                          {f.description}
                        </p>
                      </div>
                    )}

                    {f.recommendation && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <Wrench size={13} className="text-brand-600" /> Recommended Remediation:
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopy(f.recommendation, `rec-${f.id}`);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-brand-600 font-semibold hover:underline"
                          >
                            {copiedKey === `rec-${f.id}` ? <Check size={12} /> : <Copy size={12} />}
                            {copiedKey === `rec-${f.id}` ? 'Copied' : 'Copy fix'}
                          </button>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-slate-800 leading-relaxed font-sans">
                          {f.recommendation}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-xs text-slate-500">
          <Bug size={28} className="mx-auto text-slate-300 mb-2" />
          No verified findings match the current search or severity filter.
        </div>
      )}
    </section>
  );
}