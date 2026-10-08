// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '../lib/router'
import {
  LayoutDashboard, ChartBar as BarChart3, FolderGit2, Server, Boxes, BookOpen,
  Sparkles, Scale, Rocket, Activity, ShieldCheck, FileWarning, Users, CreditCard,
  Settings as SettingsIcon, Plug, GitBranch, Sun, Moon, LogOut, CornerDownLeft,
  ArrowUp, ArrowDown, Search as SearchIcon, Zap, ClipboardCheck, Building2, Bug,
  Layers, Workflow, Compass
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────
// Command Palette (⌘K) — the app-wide keyboard launcher. Jumps to any real
// page and fires real actions (toggle theme, sign out, new project). No fake
// data: every command routes to a page or hook that already exists.
// ─────────────────────────────────────────────────────────────────────────

const PALETTE_CSS = `
@keyframes lhcp-in{from{opacity:0;transform:translateY(-6px) scale(.985)}to{opacity:1;transform:none}}
@keyframes lhcp-fade{from{opacity:0}to{opacity:1}}
.lhcp-overlay{position:fixed;inset:0;z-index:120;display:flex;align-items:flex-start;justify-content:center;padding-top:12vh;background:rgba(15,23,42,0.45);backdrop-filter:blur(4px);animation:lhcp-fade .12s ease}
:root .lhcp {
  --lhcp-bg: #ffffff;
  --lhcp-bg-alt: #f8fafc;
  --lhcp-border: #e2e8f0;
  --lhcp-text: #0f172a;
  --lhcp-text2: #475569;
  --lhcp-text3: #94a3b8;
  --lhcp-accent: #2563eb;
  --lhcp-accent-weak: #edf4ff;
  --lhcp-shadow: 0 20px 50px -10px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.06);
}
:root[data-theme="dark"] .lhcp, .dark .lhcp {
  --lhcp-bg: #111827;
  --lhcp-bg-alt: #1f2937;
  --lhcp-border: #374151;
  --lhcp-text: #f9fafb;
  --lhcp-text2: #9ca3af;
  --lhcp-text3: #6b7280;
  --lhcp-accent: #3b82f6;
  --lhcp-accent-weak: rgba(59, 130, 246, 0.16);
  --lhcp-shadow: 0 24px 60px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08);
}
.lhcp{width:min(92vw,620px);max-height:64vh;display:flex;flex-direction:column;background:var(--lhcp-bg);border:1px solid var(--lhcp-border);border-radius:12px;box-shadow:var(--lhcp-shadow);overflow:hidden;animation:lhcp-in .16s cubic-bezier(.2,.8,.2,1)}
.lhcp-top{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--lhcp-border)}
.lhcp-top svg.mag{color:var(--lhcp-text3);flex-shrink:0}
.lhcp-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:var(--lhcp-text);font-family:inherit}
.lhcp-input::placeholder{color:var(--lhcp-text3)}
.lhcp-esc{font-size:10px;font-weight:600;color:var(--lhcp-text3);border:1px solid var(--lhcp-border);border-radius:5px;padding:2px 6px;font-family:inherit;flex-shrink:0}
.lhcp-list{overflow-y:auto;padding:6px}
.lhcp-sec{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--lhcp-text3);padding:8px 10px 4px}
.lhcp-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;cursor:pointer;color:var(--lhcp-text2);scroll-margin:6px;transition:background-color 100ms ease}
.lhcp-row .ci{width:28px;height:28px;border-radius:6px;background:var(--lhcp-bg-alt);display:grid;place-items:center;color:var(--lhcp-text2);flex-shrink:0;transition:.12s}
.lhcp-row .cl{font-size:13px;font-weight:500;color:var(--lhcp-text)}
.lhcp-row .cs{font-size:11.5px;color:var(--lhcp-text3);margin-top:1px}
.lhcp-row .cgo{margin-left:auto;opacity:0;color:var(--lhcp-text3);flex-shrink:0}
.lhcp-row.on{background:var(--lhcp-accent-weak)}
.lhcp-row.on .ci{background:var(--lhcp-accent);color:#ffffff}
.lhcp-row.on .cgo{opacity:1}
.lhcp-empty{padding:30px 16px;text-align:center;color:var(--lhcp-text3);font-size:13px}
.lhcp-foot{display:flex;align-items:center;gap:14px;padding:8px 14px;border-top:1px solid var(--lhcp-border);font-size:11px;color:var(--lhcp-text3);background:var(--lhcp-bg-alt)}
.lhcp-foot .k{display:inline-flex;align-items:center;gap:4px}
.lhcp-foot kbd{border:1px solid var(--lhcp-border);border-radius:4px;padding:1px 4px;font-size:10px;display:inline-grid;place-items:center;min-width:16px;color:var(--lhcp-text2);background:var(--lhcp-bg)}
`

export function CommandPalette({ open, onClose, theme, onToggleTheme, onSignOut }:{
  open: boolean; onClose: () => void; theme: 'light' | 'dark';
  onToggleTheme: () => void; onSignOut: () => void;
}) {
  const { navigate } = useRouter()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const run = (fn: () => void) => { onClose(); setTimeout(fn, 0) }

  const commands = useMemo(() => [
    // Navigate — every real destination in the app
    { sec: 'Navigate', label: 'Overview', sub: 'Release readiness at a glance', icon: LayoutDashboard, kw: 'home dashboard', go: () => navigate('/dashboard') },
    { sec: 'Navigate', label: 'Executive View', sub: 'Portfolio health for leadership', icon: BarChart3, kw: 'leadership kpi', go: () => navigate('/executive') },
    { sec: 'Navigate', label: 'Projects', sub: 'Your connected repositories', icon: FolderGit2, kw: 'repos repositories apps', go: () => navigate('/projects') },
    { sec: 'Navigate', label: 'Stacks', sub: 'Groups of projects validated together', icon: Layers, kw: 'group bundle related projects', go: () => navigate('/stacks') },
    { sec: 'Navigate', label: 'Release Pipeline', sub: 'Stage-by-stage release flow', icon: Workflow, kw: 'pipeline stages ci cd', go: () => navigate('/pipeline') },
    { sec: 'Navigate', label: 'Command Center', sub: 'Per-project readiness & policy status', icon: Compass, kw: 'readiness policy overview command', go: () => navigate('/command-center') },
    { sec: 'Navigate', label: 'Deployments', sub: 'Release history & pipeline', icon: Rocket, kw: 'ship releases', go: () => navigate('/deployments') },
    { sec: 'Navigate', label: 'Deployment Simulator', sub: 'Dry-run a release', icon: Zap, kw: 'simulate dry run', go: () => navigate('/simulator') },
    { sec: 'Navigate', label: 'Analytics', sub: 'Trends across releases', icon: Activity, kw: 'metrics charts trends', go: () => navigate('/analytics') },
    { sec: 'Navigate', label: 'Policy Studio', sub: 'Author release policies', icon: ShieldCheck, kw: 'rules gates opa', go: () => navigate('/policies') },
    { sec: 'Navigate', label: 'Environment Validation', sub: 'Verify target environments', icon: Server, kw: 'env infra kubernetes', go: () => navigate('/environment') },
    { sec: 'Navigate', label: 'Integrations', sub: 'Connect your tooling', icon: Plug, kw: 'connect github slack', go: () => navigate('/integrations') },
    { sec: 'Navigate', label: 'Plugins', sub: 'Extend LytHouse', icon: Boxes, kw: 'extensions marketplace add-ons', go: () => navigate('/plugins') },
    { sec: 'Navigate', label: 'Findings', sub: 'Workspace-wide risk items', icon: Bug, kw: 'issues vulnerabilities risk', go: () => navigate('/findings') },
    { sec: 'Navigate', label: 'Approvals', sub: 'Releases awaiting sign-off', icon: ClipboardCheck, kw: 'sign off governance', go: () => navigate('/approvals') },
    { sec: 'Navigate', label: 'Compliance', sub: 'Controls & evidence', icon: Scale, kw: 'audit soc2 iso', go: () => navigate('/compliance') },
    { sec: 'Navigate', label: 'Incidents', sub: 'Post-release incidents', icon: FileWarning, kw: 'outage postmortem', go: () => navigate('/incidents') },
    { sec: 'Navigate', label: 'Audit Log', sub: 'Every action, timestamped', icon: BookOpen, kw: 'history trail', go: () => navigate('/audit') },
    { sec: 'Navigate', label: 'Organizations', sub: 'Manage organizations', icon: Building2, kw: 'org company account', go: () => navigate('/organizations') },
    { sec: 'Navigate', label: 'Workspaces', sub: 'Switch or manage workspaces', icon: Building2, kw: 'org team switch', go: () => navigate('/workspaces') },
    { sec: 'Navigate', label: 'Team', sub: 'Members & roles', icon: Users, kw: 'people members invite', go: () => navigate('/team') },
    { sec: 'Navigate', label: 'Plans & Billing', sub: 'Subscription & usage', icon: CreditCard, kw: 'billing upgrade payment', go: () => navigate('/plans') },
    { sec: 'Navigate', label: 'Settings', sub: 'Workspace configuration', icon: SettingsIcon, kw: 'preferences config', go: () => navigate('/settings') },
    { sec: 'Navigate', label: 'Documentation', sub: 'How LytHouse works', icon: BookOpen, kw: 'docs help guide', go: () => navigate('/docs') },
    // Actions — real, side-effectful things
    { sec: 'Actions', label: 'New Project', sub: 'Connect a repository', icon: GitBranch, kw: 'create add import repo', go: () => navigate('/projects?new=1') },
    { sec: 'Actions', label: theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme', sub: 'Toggle day / night', icon: theme === 'dark' ? Sun : Moon, kw: 'dark light day night appearance', go: onToggleTheme },
    { sec: 'Actions', label: 'Sign out', sub: 'End this session', icon: LogOut, kw: 'logout leave', go: onSignOut },
  ], [navigate, theme, onToggleTheme, onSignOut])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return commands
    return commands.filter(c => (c.label + ' ' + c.sub + ' ' + c.kw + ' ' + c.sec).toLowerCase().includes(s))
  }, [q, commands])

  // Group filtered results preserving section order
  const groups = useMemo(() => {
    const order: string[] = []
    const map: Record<string, typeof commands> = {}
    filtered.forEach(c => { if (!map[c.sec]) { map[c.sec] = []; order.push(c.sec) } map[c.sec].push(c) })
    return order.map(sec => ({ sec, items: map[sec] }))
  }, [filtered])

  const flat = filtered // selection index maps to filtered order

  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 30) } }, [open])
  useEffect(() => { setSel(0) }, [q])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, flat.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
      else if (e.key === 'Enter') { e.preventDefault(); const c = flat[sel]; if (c) run(c.go) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flat, sel])

  useEffect(() => {
    const el = listRef.current?.querySelector('.lhcp-row.on') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!open) return null
  let idx = -1

  return (
    <div className="lhcp-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <style>{PALETTE_CSS}</style>
      <div className="lhcp" role="dialog" aria-label="Command palette">
        <div className="lhcp-top">
          <SearchIcon size={18} className="mag" />
          <input ref={inputRef} className="lhcp-input" placeholder="Search pages and actions…"
            value={q} onChange={e => setQ(e.target.value)} spellCheck={false} />
          <span className="lhcp-esc">esc</span>
        </div>
        <div className="lhcp-list" ref={listRef}>
          {flat.length === 0 ? (
            <div className="lhcp-empty">No matches for “{q}”.</div>
          ) : groups.map(g => (
            <div key={g.sec}>
              <div className="lhcp-sec">{g.sec}</div>
              {g.items.map(c => {
                idx++
                const on = idx === sel
                const mine = idx
                return (
                  <div key={c.label} className={`lhcp-row ${on ? 'on' : ''}`}
                    onMouseEnter={() => setSel(mine)} onMouseDown={e => { e.preventDefault(); run(c.go) }}>
                    <span className="ci"><c.icon size={16} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="cl">{c.label}</div>
                      <div className="cs">{c.sub}</div>
                    </div>
                    <CornerDownLeft size={14} className="cgo" />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="lhcp-foot">
          <span className="k"><kbd><ArrowUp size={10} /></kbd><kbd><ArrowDown size={10} /></kbd> navigate</span>
          <span className="k"><kbd><CornerDownLeft size={10} /></kbd> open</span>
          <span className="k"><kbd>esc</kbd> close</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Sparkles size={12} /> LytHouse</span>
        </div>
      </div>
    </div>
  )
}
