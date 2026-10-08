// @ts-nocheck
import { useEffect, useMemo, useState, type ReactNode, createContext, useContext } from 'react'
import {
  Bug, Building2, Check, ChevronRight, ChevronsUpDown, ChevronDown,
  FolderGit2, Layers, LogOut, Menu, Pin, Plus,
  Server, Sparkles, X, Sun, Moon, Settings as SettingsIcon, Users, CreditCard,
  Gauge, ShieldCheck, FileText, ClipboardCheck, Zap, Activity, FileWarning,
  Workflow, Rocket, Boxes, BookOpen, ScrollText, Plug, BarChart3, Command, SlidersHorizontal,
  Compass, Code2, Bell, LifeBuoy, Star, Bot, Search, ExternalLink, HelpCircle
} from 'lucide-react'
import { supabase, type Workspace, type Organization, type WorkspacePlan, type PlanId, PLANS } from '../lib/supabase'
import { usePins, removePin, pinKey, type PinType } from '../lib/pins'
import {
  NAV_ACCOUNT, NAV_PRIMARY, SPACELIFT_SECTIONS, GLOBAL_FACET_QUICK_FILTERS, PAGE_TITLES,
  type NavItem, type NavFacet, type SpaceliftSection
} from '../lib/nav'
import { useRouter, Link } from '../lib/router'
import { useAuth } from '../lib/auth'
import { CommandPalette } from './CommandPalette'
import { AskAiPanel } from './AskAiPanel'

export const PlanContext = createContext<PlanId>('free')
export function usePlanId(): PlanId { return useContext(PlanContext) }

const PIN_ICONS: Record<PinType, any> = {
  workspace: Building2,
  project: FolderGit2,
  finding: Bug,
  stack: Layers,
  environment: Server,
}

const CSS = `
:root {
  --lh-bg: #f8fafc;
  --lh-surface: #ffffff;
  --lh-surface2: #f1f5f9;
  --lh-surface-hover: #e2e8f0;
  --lh-sidebar: #ffffff;
  --lh-sidebar-border: #e2e8f0;
  --lh-border: #e2e8f0;
  --lh-border2: #cbd5e1;
  --lh-text: #0f172a;
  --lh-text2: #475569;
  --lh-text3: #94a3b8;
  --lh-accent: #2563eb;
  --lh-accent-hover: #1d4ed8;
  --lh-accent-weak: #eff6ff;
  --lh-accent-contrast: #ffffff;
  --lh-ring: rgba(37, 99, 235, 0.2);
  --lh-purple-bg: #f5f3ff;
  --lh-purple-text: #7c3aed;
  --lh-purple-border: #ede9fe;
  --lh-purple-hover: #ede9fe;
  --lh-dropdown-bg: #ffffff;
  --lh-dropdown-shadow: 0 16px 40px -8px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.05);
}

:root[data-theme="dark"] {
  --lh-bg: #090d16;
  --lh-surface: #0f172a;
  --lh-surface2: #1e293b;
  --lh-surface-hover: #334155;
  --lh-sidebar: #0b0f19;
  --lh-sidebar-border: #1e293b;
  --lh-border: #1e293b;
  --lh-border2: #334155;
  --lh-text: #f8fafc;
  --lh-text2: #94a3b8;
  --lh-text3: #64748b;
  --lh-accent: #3b82f6;
  --lh-accent-hover: #60a5fa;
  --lh-accent-weak: rgba(59, 130, 246, 0.14);
  --lh-accent-contrast: #ffffff;
  --lh-ring: rgba(59, 130, 246, 0.28);
  --lh-purple-bg: rgba(124, 58, 237, 0.15);
  --lh-purple-text: #c084fc;
  --lh-purple-border: rgba(124, 58, 237, 0.3);
  --lh-purple-hover: rgba(124, 58, 237, 0.25);
  --lh-dropdown-bg: #111827;
  --lh-dropdown-shadow: 0 20px 50px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.lh-app {
  min-height: 100vh;
  background: var(--lh-bg);
  color: var(--lh-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* Sidebar Root */
.lh-sb {
  background: var(--lh-sidebar);
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid var(--lh-sidebar-border);
  position: relative;
  user-select: none;
  font-size: 13px;
  overflow: hidden;
}

/* Spacelift Top Header Bar */
.lh-space-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px 14px;
  gap: 8px;
  position: relative;
}

.lh-space-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.lh-space-logo {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #0f172a;
  display: grid;
  place-items: center;
  color: #38bdf8;
  flex-shrink: 0;
  box-shadow: 0 2px 5px rgba(0,0,0,0.15);
}

.lh-space-wsbtn {
  display: flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  color: var(--lh-text);
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  transition: background 0.15s ease;
  min-width: 0;
}

.lh-space-wsbtn:hover, .lh-space-wsbtn.open {
  background: var(--lh-surface2);
}

.lh-space-wsbtn .ws-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lh-space-wsbtn .ws-chev {
  color: var(--lh-text3);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.lh-space-wsbtn.open .ws-chev {
  transform: rotate(180deg);
}

.lh-space-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.lh-space-iconbtn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 0;
  background: transparent;
  color: var(--lh-text2);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.lh-space-iconbtn:hover {
  background: var(--lh-surface2);
  color: var(--lh-text);
}

.lh-space-badgebtn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 7px;
  border-radius: 12px;
  border: 1px solid var(--lh-border);
  background: var(--lh-surface2);
  color: var(--lh-text2);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.lh-space-badgebtn:hover {
  border-color: var(--lh-border2);
  color: var(--lh-text);
}

/* Search + Ask AI Unified Pill Row */
.lh-search-ask-wrap {
  padding: 0 12px 10px;
}

.lh-search-ask-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 5px 6px 5px 10px;
  background: var(--lh-surface2);
  border: 1px solid var(--lh-border);
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.lh-search-ask-box:hover {
  border-color: var(--lh-border2);
  background: var(--lh-surface-hover);
}

.lh-search-ask-left {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--lh-text3);
  font-size: 12.5px;
  font-weight: 400;
}

.lh-search-ask-right {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--lh-purple-bg);
  color: var(--lh-purple-text);
  font-size: 11.5px;
  font-weight: 600;
  border: 1px solid var(--lh-purple-border);
  transition: all 0.15s ease;
}

.lh-search-ask-right:hover {
  background: var(--lh-purple-hover);
}

/* Pinned Section */
.lh-pinned-wrap {
  padding: 0 12px 10px;
}

.lh-pinned-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 5px 6px;
  border: 0;
  background: transparent;
  color: var(--lh-text);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.lh-pinned-header:hover {
  background: var(--lh-surface2);
}

.lh-pinned-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lh-pinned-empty-card {
  margin-top: 4px;
  padding: 12px 10px;
  border-radius: 10px;
  border: 1px dashed var(--lh-border2);
  background: var(--lh-surface2);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
}

.lh-pinned-badge-preview {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 6px;
  background: var(--lh-surface);
  border: 1px solid var(--lh-border);
  font-size: 11px;
  font-weight: 600;
  color: var(--lh-text2);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}

.lh-pinned-empty-text {
  font-size: 11.5px;
  line-height: 1.35;
  color: var(--lh-text3);
}

.lh-pinned-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  color: var(--lh-text2);
  text-decoration: none;
  font-size: 12.5px;
  transition: all 0.15s ease;
  position: relative;
}

.lh-pinned-item:hover {
  background: var(--lh-surface2);
  color: var(--lh-text);
}

.lh-pinned-item .unpin-btn {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: var(--lh-text3);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 2px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.lh-pinned-item:hover .unpin-btn {
  opacity: 1;
}

.lh-pinned-item .unpin-btn:hover {
  color: var(--lh-text);
  background: var(--lh-surface-hover);
}

/* Infra Assistant Pill Button */
.lh-infra-ai-btn-wrap {
  padding: 0 12px 10px;
}

.lh-infra-ai-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--lh-purple-bg);
  border: 1px solid var(--lh-purple-border);
  color: var(--lh-purple-text);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.lh-infra-ai-btn:hover {
  background: var(--lh-purple-hover);
}

/* Main Navigation Scroll Area */
.lh-nav-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 12px 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--lh-border2) transparent;
}

.lh-nav-scroll::-webkit-scrollbar {
  width: 4px;
}
.lh-nav-scroll::-webkit-scrollbar-thumb {
  background: var(--lh-border2);
  border-radius: 4px;
}

/* Capability Accordion Group */
.lh-sl-group {
  margin-bottom: 2px;
}

.lh-sl-hdr-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: var(--lh-text2);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
  text-align: left;
}

.lh-sl-hdr-btn:hover {
  background: var(--lh-surface2);
  color: var(--lh-text);
}

.lh-sl-hdr-btn.is-active-group {
  background: var(--lh-accent-weak);
  color: var(--lh-accent);
  font-weight: 600;
}

.lh-sl-hdr-left {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  flex: 1;
}

.lh-sl-hdr-left .icon {
  flex-shrink: 0;
}

.lh-sl-hdr-left .label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lh-sl-hdr-chev {
  color: var(--lh-text3);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.lh-sl-hdr-btn.open .lh-sl-hdr-chev {
  transform: rotate(90deg);
}

/* Collapsible Section Container */
.lh-sl-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.lh-sl-collapse.open {
  grid-template-rows: 1fr;
}

.lh-sl-collapse-inner {
  overflow: hidden;
  min-height: 0;
  padding: 2px 0 4px 14px;
  margin-left: 14px;
  border-left: 1px solid var(--lh-sidebar-border);
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* Nav Item Link */
.lh-item-row-wrap {
  display: flex;
  align-items: center;
  border-radius: 6px;
  position: relative;
}

.lh-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  color: var(--lh-text2);
  text-decoration: none;
  font-size: 12.5px;
  font-weight: 450;
  flex: 1;
  min-width: 0;
  transition: all 0.12s ease;
}

.lh-item:hover {
  background: var(--lh-surface2);
  color: var(--lh-text);
}

.lh-item.active {
  background: var(--lh-accent-weak);
  color: var(--lh-accent);
  font-weight: 600;
}

.lh-item-badge {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--lh-surface2);
  color: var(--lh-text3);
  font-weight: 600;
}

.lh-facet-toggle {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin-right: 4px;
  border: 0;
  background: transparent;
  color: var(--lh-text3);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.lh-facet-toggle:hover {
  background: var(--lh-surface-hover);
  color: var(--lh-text);
}

.lh-facet-toggle.open {
  transform: rotate(90deg);
  color: var(--lh-accent);
}

/* Faceted Subfilters */
.lh-facet-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.lh-facet-collapse.open {
  grid-template-rows: 1fr;
}

.lh-facet-sublist {
  overflow: hidden;
  min-height: 0;
  margin: 1px 0 3px 12px;
  padding-left: 8px;
  border-left: 1px dashed var(--lh-border2);
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.lh-facet-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 5px;
  color: var(--lh-text2);
  text-decoration: none;
  font-size: 11.5px;
  transition: all 0.12s ease;
}

.lh-facet-link:hover {
  background: var(--lh-surface2);
  color: var(--lh-text);
}

.lh-facet-link.active {
  background: var(--lh-accent-weak);
  color: var(--lh-accent);
  font-weight: 600;
}

.lh-facet-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.lh-facet-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lh-facet-badge {
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--lh-surface2);
  color: var(--lh-text3);
}
.lh-facet-badge.danger { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
.lh-facet-badge.warning { background: rgba(245, 158, 11, 0.12); color: #d97706; }
.lh-facet-badge.success { background: rgba(16, 185, 129, 0.12); color: #10b981; }
.lh-facet-badge.info { background: rgba(56, 189, 248, 0.12); color: #0284c7; }

/* Sidebar Bottom Footer */
.lh-sl-footer {
  border-top: 1px solid var(--lh-sidebar-border);
  padding: 8px 12px 10px;
  background: var(--lh-sidebar);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lh-support-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: 8px;
  border: 0;
  background: transparent;
  color: var(--lh-text2);
  text-decoration: none;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.lh-support-btn:hover {
  background: var(--lh-surface2);
  color: var(--lh-text);
}

.lh-support-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lh-sl-user-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 0;
  background: transparent;
  color: var(--lh-text);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.lh-sl-user-btn:hover, .lh-sl-user-btn.open {
  background: var(--lh-surface2);
}

.lh-sl-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--lh-accent);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 12px;
  overflow: hidden;
  flex-shrink: 0;
}

.lh-sl-user-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.lh-sl-user-name {
  font-size: 12.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lh-sl-user-company {
  font-size: 11px;
  color: var(--lh-text3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Floating Popovers */
.lh-wsm-ov {
  position: fixed;
  inset: 0;
  z-index: 100;
}

.lh-popover {
  position: absolute;
  z-index: 110;
  width: 260px;
  background: var(--lh-dropdown-bg);
  border: 1px solid var(--lh-border);
  border-radius: 12px;
  padding: 6px;
  box-shadow: var(--lh-dropdown-shadow);
}

.lh-popover.top-ws {
  top: 48px;
  left: 12px;
}

.lh-popover.up-user {
  bottom: 56px;
  left: 12px;
}

.lh-pop-sec-title {
  padding: 6px 8px 3px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--lh-text3);
  display: flex;
  justify-content: space-between;
}

.lh-pop-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 0;
  background: transparent;
  color: var(--lh-text2);
  font-size: 12.5px;
  text-decoration: none;
  cursor: pointer;
  text-align: left;
  transition: all 0.12s ease;
}

.lh-pop-item:hover {
  background: var(--lh-surface2);
  color: var(--lh-text);
}

.lh-pop-item.active {
  background: var(--lh-accent-weak);
  color: var(--lh-accent);
  font-weight: 600;
}

.lh-pop-item .nm {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lh-pop-divider {
  height: 1px;
  background: var(--lh-border);
  margin: 5px 0;
}

.lh-theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
}

.lh-theme-row:hover {
  background: var(--lh-surface2);
}

.lh-theme-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--lh-text2);
}

.lh-switch {
  width: 32px;
  height: 18px;
  border-radius: 9px;
  background: var(--lh-border2);
  position: relative;
  transition: background 0.2s ease;
}

.lh-switch.active {
  background: var(--lh-accent);
}

.lh-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffffff;
  transition: transform 0.2s ease;
}

.lh-switch.active .lh-switch-thumb {
  transform: translateX(14px);
}

/* Header & Shell Content Area */
.lh-tb {
  position: sticky;
  top: 0;
  z-index: 30;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 24px;
  border-bottom: 1px solid var(--lh-border);
  background: color-mix(in srgb, var(--lh-bg) 88%, transparent);
  backdrop-filter: blur(12px);
}

.lh-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.lh-plan-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: 20px;
  border: 1px solid var(--lh-border);
  background: var(--lh-surface);
  color: var(--lh-text2);
  text-decoration: none;
}

.lh-plan-badge .up {
  font-size: 10px;
  text-transform: none;
  background: var(--lh-accent);
  color: #fff;
  padding: 1px 6px;
  border-radius: 10px;
}

.lh-iconbtn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--lh-border);
  background: var(--lh-surface);
  color: var(--lh-text2);
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.lh-iconbtn:hover {
  background: var(--lh-surface2);
  color: var(--lh-text);
  border-color: var(--lh-border2);
}

.lh-mobile-menu {
  display: none;
}

@media (max-width: 1023px) {
  .lh-mobile-menu {
    display: grid;
  }
}

.lh-shell-body {
  position: relative;
  z-index: 1;
}

/* Floating Ask AI Button */
.lh-ai {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 60;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 30px;
  background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
  color: #fff;
  border: 0;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  box-shadow: 0 8px 24px -4px rgba(124, 58, 237, 0.4);
  transition: all 0.2s ease;
}

.lh-ai:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px -4px rgba(124, 58, 237, 0.55);
}

/* Modals */
.lh-orgov {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.lh-orgm {
  width: min(94vw, 440px);
  background: var(--lh-surface);
  border: 1px solid var(--lh-border);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
}

.lh-orgm h3 {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.lh-orgm p {
  font-size: 13px;
  color: var(--lh-text3);
  margin: 6px 0 0;
}

.lh-orgm input {
  width: 100%;
  margin-top: 16px;
  background: var(--lh-surface2);
  border: 1px solid var(--lh-border);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 13.5px;
  color: var(--lh-text);
  outline: none;
}

.lh-orgm input:focus {
  border-color: var(--lh-accent);
  box-shadow: 0 0 0 3px var(--lh-ring);
}

.lh-orgm .row {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  justify-content: flex-end;
}

.lh-orgm .b {
  border-radius: 8px;
  padding: 8px 14px;
  border: 1px solid var(--lh-border);
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: var(--lh-text2);
  cursor: pointer;
  transition: all 0.15s ease;
}

.lh-orgm .b:hover {
  background: var(--lh-surface2);
  color: var(--lh-text);
}

.lh-orgm .b.pri {
  background: var(--lh-accent);
  color: #fff;
  border: 0;
}
`

function isPathActive(path: string, to: string) {
  if (!to) return false
  if (to === '/dashboard') return path === '/dashboard' || path === '/'
  return path === to || path.startsWith(to + '/')
}

export function AppShell({ children }: { children: ReactNode }) {
  const { path, search, fullPath, navigate } = useRouter()
  const { user, profile, signOut } = useAuth()

  const [activeWs, setActiveWs] = useState<Workspace | null>(null)
  const [wsList, setWsList] = useState<Workspace[]>([])
  const [orgList, setOrgList] = useState<Organization[]>([])
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null)
  const [wsMenuOpen, setWsMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [pinnedOpen, setPinnedOpen] = useState(true)
  const [modal, setModal] = useState<null | 'org' | 'ws'>(null)
  const [modalName, setModalName] = useState('')
  const [modalBusy, setModalBusy] = useState(false)
  const [plan, setPlan] = useState<WorkspacePlan | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  // Manage open Spacelift capability accordion sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      insights: true // default open top section like Spacelift Launchpad
    }
    SPACELIFT_SECTIONS.forEach(sec => {
      if (sec.items.some(i => isPathActive(path, i.to))) {
        initial[sec.id] = true
      }
    })
    return initial
  })

  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('lh.theme') as any) || 'light')
  const pins = usePins()

  // Auto-expand section when navigated into
  useEffect(() => {
    SPACELIFT_SECTIONS.forEach(sec => {
      if (sec.items.some(i => isPathActive(path, i.to))) {
        setOpenSections(prev => ({ ...prev, [sec.id]: true }))
      }
    })
  }, [path])

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('lh.theme', theme)
  }, [theme])

  useEffect(() => {
    ;(async () => {
      let orgs: Organization[] = []
      try {
        const { data } = await supabase.from('organizations').select('*').order('created_at')
        orgs = data || []
      } catch {}
      let cur: Organization | null = null
      if (orgs.length) {
        setOrgList(orgs)
        const saved = localStorage.getItem('sandbox.activeOrg')
        cur = orgs.find(o => o.id === saved) ?? orgs[0]
        setActiveOrg(cur)
        localStorage.setItem('sandbox.activeOrg', cur.id)
      }
      const { data: ws } = await supabase.from('workspaces').select('*').order('created_at')
      if (!ws?.length) return
      setWsList(ws)
      const list = cur ? (ws.filter(w => !w.organization_id || w.organization_id === cur.id) || ws) : ws
      const active = list.find(w => w.id === localStorage.getItem('sandbox.activeWs')) ?? list[0]
      setActiveWs(active)
      localStorage.setItem('sandbox.activeWs', active.id)
    })()
  }, [])

  useEffect(() => {
    if (activeWs) {
      supabase.from('workspace_plans').select('*').eq('workspace_id', activeWs.id).order('created_at', { ascending: false }).limit(1)
        .then(({ data }) => data?.[0] && setPlan(data[0]))
    }
  }, [activeWs])

  const planId = (plan?.plan_id as PlanId) ?? 'free'
  const planInfo = PLANS[planId] || { name: 'Free Plan' }
  const pageTitle = PAGE_TITLES[Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length).find(k => isPathActive(path, k)) || ''] || 'LytHouse'

  const go = () => {
    setMobileOpen(false)
  }

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const orgWorkspaces = useMemo(
    () => activeOrg ? wsList.filter(w => !w.organization_id || w.organization_id === activeOrg.id) : wsList,
    [wsList, activeOrg],
  )

  const createEntity = async () => {
    const name = modalName.trim()
    if (!name) return
    setModalBusy(true)
    if (modal === 'org') {
      const { data, error } = await supabase.rpc('create_organization_with_workspace', { p_name: name, p_description: null })
      const created = Array.isArray(data) ? data[0] : data
      if (!error && created) {
        localStorage.setItem('sandbox.activeOrg', String(created.organization_id))
        localStorage.setItem('sandbox.activeWs', String(created.workspace_id))
        window.location.assign('/dashboard')
      }
    } else {
      const orgId = activeOrg?.id || orgList[0]?.id
      if (!orgId) { setModalBusy(false); return }
      const { data, error } = await supabase.rpc('create_workspace', { p_organization_id: orgId, p_name: name, p_description: null })
      if (!error && data) {
        localStorage.setItem('sandbox.activeOrg', orgId)
        localStorage.setItem('sandbox.activeWs', String(data))
        window.location.assign(`/workspaces/${data}`)
      }
    }
    setModalBusy(false)
  }

  const switchWorkspace = (w: Workspace) => {
    if (w.organization_id) localStorage.setItem('sandbox.activeOrg', w.organization_id)
    localStorage.setItem('sandbox.activeWs', w.id)
    window.location.assign(`/workspaces/${w.id}`)
  }

  const switchOrg = (o: Organization) => {
    localStorage.setItem('sandbox.activeOrg', o.id)
    localStorage.removeItem('sandbox.activeWs')
    window.location.assign('/organizations')
  }

  const NavItemRow = ({ item, size = 15 }: { item: NavItem; size?: number }) => {
    const active = isPathActive(path, item.to)
    const hasFacets = Boolean(item.facets && item.facets.length > 0)
    const [facetOpen, setFacetOpen] = useState(() => active)

    useEffect(() => {
      if (active && hasFacets) {
        setFacetOpen(true)
      }
    }, [active, hasFacets])

    const Icon = item.icon
    const isRootActive = active && (!hasFacets || fullPath === item.to || (!search && path === item.to))

    return (
      <div className="lh-item-facet-group">
        <div className={`lh-item-row-wrap ${active ? 'is-active-parent' : ''}`}>
          <Link
            to={item.to}
            onClick={() => {
              if (hasFacets && !facetOpen) {
                setFacetOpen(true)
              }
              go()
            }}
            className={`lh-item ${isRootActive ? 'active' : ''}`}
            title={item.description || item.label}
          >
            <Icon size={size} strokeWidth={active ? 2.1 : 1.8} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
            {item.badge && <span className="lh-item-badge">{item.badge}</span>}
          </Link>
          {hasFacets && (
            <button
              type="button"
              className={`lh-facet-toggle ${facetOpen ? 'open' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setFacetOpen(v => !v)
              }}
              title={facetOpen ? 'Collapse sub-filters' : 'Expand sub-filters'}
              aria-label={`Toggle facets for ${item.label}`}
            >
              <ChevronRight size={13} />
            </button>
          )}
        </div>

        {hasFacets && (
          <div className={`lh-facet-collapse ${facetOpen ? 'open' : ''}`}>
            <div className="lh-facet-sublist">
              {item.facets!.map(facet => {
                const isFacetActive =
                  fullPath === facet.to ||
                  (facet.filterParam &&
                    search.includes(`${facet.filterParam.key}=${facet.filterParam.value}`))
                return (
                  <Link
                    key={facet.id}
                    to={facet.to}
                    onClick={go}
                    className={`lh-facet-link ${isFacetActive ? 'active' : ''}`}
                  >
                    <span
                      className="lh-facet-dot"
                      style={{ backgroundColor: facet.dotColor || 'var(--lh-accent)' }}
                    />
                    <span className="lh-facet-text">{facet.label}</span>
                    {facet.badge && (
                      <span className={`lh-facet-badge ${facet.badgeVariant || 'default'}`}>
                        {facet.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  const isProjectWorkspace = path.startsWith('/projects/') && path.split('/').filter(Boolean).length >= 2

  const Sidebar = (
    <div className="lh-sb">
      {/* Spacelift Top Header */}
      <div className="lh-space-top">
        <div className="lh-space-left">
          <div className="lh-space-logo" title="Lythouse Cloud">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M12 2l5 6M12 2L7 8"/>
              <circle cx="12" cy="16" r="2.5" fill="currentColor"/>
            </svg>
          </div>
          <button
            type="button"
            className={`lh-space-wsbtn ${wsMenuOpen ? 'open' : ''}`}
            onClick={() => { setUserMenuOpen(false); setWsMenuOpen(v => !v) }}
          >
            <span className="ws-name">{activeWs?.name || 'Deploy'}</span>
            <ChevronDown size={14} className="ws-chev" />
          </button>
        </div>

        <div className="lh-space-actions">
          <Link to="/settings" onClick={go} className="lh-space-iconbtn" title="Settings">
            <SettingsIcon size={14} />
          </Link>
          <button
            type="button"
            className="lh-space-badgebtn"
            title="Active runs"
            onClick={() => navigate('/runs')}
          >
            <span>+0</span>
          </button>
        </div>

        {/* Workspace Dropdown Popover */}
        {wsMenuOpen && (
          <>
            <div className="lh-wsm-ov" onClick={() => setWsMenuOpen(false)} />
            <div className="lh-popover top-ws" role="menu">
              <div className="lh-pop-sec-title">
                <span>Workspaces</span>
                <span>{orgWorkspaces.length}</span>
              </div>
              {orgWorkspaces.map(w => {
                const isCurrent = activeWs?.id === w.id
                return (
                  <button
                    key={w.id}
                    className={`lh-pop-item ${isCurrent ? 'active' : ''}`}
                    onClick={() => { setWsMenuOpen(false); switchWorkspace(w) }}
                  >
                    <Building2 size={13} />
                    <span className="nm">{w.name}</span>
                    {isCurrent && <Check size={13} style={{ color: 'var(--lh-accent)' }} />}
                  </button>
                )
              })}

              <button
                className="lh-pop-item"
                onClick={() => { setWsMenuOpen(false); setModalName(''); setModal('ws') }}
              >
                <Plus size={13} />
                <span className="nm">Create new workspace</span>
              </button>

              <div className="lh-pop-divider" />

              <div className="lh-pop-sec-title">
                <span>Organizations</span>
                <span>{orgList.length}</span>
              </div>
              {orgList.map(o => {
                const isCurrentOrg = activeOrg?.id === o.id
                return (
                  <button
                    key={o.id}
                    className={`lh-pop-item ${isCurrentOrg ? 'active' : ''}`}
                    onClick={() => { setWsMenuOpen(false); switchOrg(o) }}
                  >
                    <Building2 size={13} />
                    <span className="nm">{o.name}</span>
                    {isCurrentOrg && <Check size={13} style={{ color: 'var(--lh-accent)' }} />}
                  </button>
                )
              })}

              <button
                className="lh-pop-item"
                onClick={() => { setWsMenuOpen(false); setModalName(''); setModal('org') }}
              >
                <Plus size={13} />
                <span className="nm">Create organization</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Spacelift Search & Ask Unified Input */}
      <div className="lh-search-ask-wrap">
        <div className="lh-search-ask-box" onClick={() => setPaletteOpen(true)}>
          <div className="lh-search-ask-left">
            <Search size={13} />
            <span>Search Ctrl+K</span>
          </div>
          <button
            type="button"
            className="lh-search-ask-right"
            onClick={(e) => {
              e.stopPropagation()
              setAiOpen(true)
            }}
          >
            <Sparkles size={11} />
            <span>Ask</span>
          </button>
        </div>
      </div>

      {/* Pinned Section */}
      <div className="lh-pinned-wrap">
        <button
          type="button"
          className="lh-pinned-header"
          onClick={() => setPinnedOpen(v => !v)}
        >
          <div className="lh-pinned-header-left">
            <Star size={13} style={{ color: 'var(--lh-text2)' }} />
            <span>Pinned</span>
          </div>
          <ChevronDown
            size={13}
            style={{
              color: 'var(--lh-text3)',
              transform: pinnedOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.15s ease'
            }}
          />
        </button>

        {pinnedOpen && (
          pins.length === 0 ? (
            <div className="lh-pinned-empty-card">
              <div className="lh-pinned-badge-preview">
                <span>Stacks</span>
                <Pin size={11} />
              </div>
              <span className="lh-pinned-empty-text">
                Quickly access your most important links by pinning them.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4 }}>
              {pins.map(p => {
                const I = PIN_ICONS[p.type] || FolderGit2
                return (
                  <Link key={pinKey(p.type, p.id)} to={p.to} onClick={go} className="lh-pinned-item">
                    <I size={13} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.label}
                    </span>
                    <button
                      className="unpin-btn"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        removePin(p.type, p.id)
                      }}
                    >
                      <X size={11} />
                    </button>
                  </Link>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Infra Assistant CTA Button */}
      <div className="lh-infra-ai-btn-wrap">
        <button
          type="button"
          className="lh-infra-ai-btn"
          onClick={() => setAiOpen(true)}
        >
          <Sparkles size={13} />
          <span>Infra Assistant</span>
        </button>
      </div>

      {/* 6 Core Spacelift Capability Groups */}
      <nav className="lh-nav-scroll">
        {SPACELIFT_SECTIONS.map(sec => {
          const isOpen = Boolean(openSections[sec.id])
          const hasActive = sec.items.some(i => isPathActive(path, i.to))
          const SecIcon = sec.icon

          return (
            <div key={sec.id} className="lh-sl-group">
              <button
                type="button"
                className={`lh-sl-hdr-btn ${isOpen ? 'open' : ''} ${hasActive ? 'is-active-group' : ''}`}
                onClick={() => toggleSection(sec.id)}
              >
                <div className="lh-sl-hdr-left">
                  <SecIcon size={14} className="icon" />
                  <span className="label">{sec.title}</span>
                </div>
                <ChevronRight size={13} className="lh-sl-hdr-chev" />
              </button>

              <div className={`lh-sl-collapse ${isOpen ? 'open' : ''}`}>
                <div className="lh-sl-collapse-inner">
                  {sec.items.map(i => (
                    <NavItemRow key={i.to} item={i} size={14} />
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* Sidebar Footer: Support & Feedback + User Row */}
      <div className="lh-sl-footer">
        <Link to="/docs" onClick={go} className="lh-support-btn">
          <div className="lh-support-left">
            <LifeBuoy size={14} />
            <span>Support & Feedback</span>
          </div>
          <ChevronRight size={13} style={{ color: 'var(--lh-text3)' }} />
        </Link>

        <button
          type="button"
          className={`lh-sl-user-btn ${userMenuOpen ? 'open' : ''}`}
          onClick={() => { setWsMenuOpen(false); setUserMenuOpen(v => !v) }}
        >
          <div className="lh-sl-user-avatar">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (profile?.full_name || user?.email || 'Q')[0].toUpperCase()}
          </div>
          <div className="lh-sl-user-meta">
            <span className="lh-sl-user-name">{profile?.full_name || 'Qitmeer Raza'}</span>
            <span className="lh-sl-user-company">{activeOrg?.name || 'augerelabs'}</span>
          </div>
          <ChevronRight size={13} style={{ color: 'var(--lh-text3)' }} />
        </button>

        {/* User Menu Popover */}
        {userMenuOpen && (
          <>
            <div className="lh-wsm-ov" onClick={() => setUserMenuOpen(false)} />
            <div className="lh-popover up-user" role="menu">
              <div className="lh-pop-sec-title">
                <span>Account & Organization</span>
              </div>
              {NAV_ACCOUNT.map(i => {
                const Icon = i.icon
                return (
                  <Link
                    key={i.to}
                    to={i.to}
                    className="lh-pop-item"
                    onClick={() => { setUserMenuOpen(false); go() }}
                  >
                    <Icon size={13} />
                    <span className="nm">{i.label}</span>
                  </Link>
                )
              })}

              <div className="lh-pop-divider" />

              <div className="lh-theme-row" onClick={toggleTheme}>
                <div className="lh-theme-info">
                  {theme === 'dark' ? <Moon size={13} style={{ color: 'var(--lh-accent)' }} /> : <Sun size={13} style={{ color: '#f59e0b' }} />}
                  <span>Dark Mode</span>
                </div>
                <div
                  role="switch"
                  aria-checked={theme === 'dark'}
                  className={`lh-switch ${theme === 'dark' ? 'active' : ''}`}
                >
                  <span className="lh-switch-thumb" />
                </div>
              </div>

              <div className="lh-pop-divider" />

              <button
                type="button"
                className="lh-pop-item"
                style={{ color: '#ef4444' }}
                onClick={() => { setUserMenuOpen(false); signOut() }}
              >
                <LogOut size={13} />
                <span className="nm">Sign out</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="lh-app">
      <style>{CSS}</style>

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 lg:block">
        {Sidebar}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-64 transition-transform duration-200 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {Sidebar}
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 lh-shell-body">
        <header className="lh-tb">
          <button
            onClick={() => setMobileOpen(true)}
            className="lh-iconbtn lh-mobile-menu"
            aria-label="Open navigation"
          >
            <Menu size={16} />
          </button>
          <span className="lh-title">{pageTitle}</span>

          <Link to="/plans" className={`lh-plan-badge ${planId}`}>
            {planInfo.name}
            {planId !== 'enterprise' && <span className="up">Upgrade</span>}
          </Link>

          <div style={{ flex: 1 }} />

          <button
            className="lh-iconbtn"
            title="Toggle theme"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </header>

        <main
          className={isProjectWorkspace ? "w-full min-h-[calc(100vh-52px)]" : "mx-auto max-w-7xl px-4 py-8"}
          style={{ color: 'var(--lh-text)' }}
        >
          <PlanContext.Provider value={planId}>{children}</PlanContext.Provider>
        </main>
      </div>

      {/* Floating Ask AI Button & Panel */}
      <button className="lh-ai" onClick={() => setAiOpen(true)}>
        <Sparkles size={15} />
        <span>Ask AI</span>
      </button>
      <AskAiPanel open={aiOpen} onClose={() => setAiOpen(false)} />

      {/* Create Org / Workspace Modal */}
      {modal && (
        <div className="lh-orgov" onClick={() => !modalBusy && setModal(null)}>
          <div className="lh-orgm" onClick={e => e.stopPropagation()}>
            <h3>{modal === 'org' ? 'Create new organization' : 'Create new workspace'}</h3>
            <p>
              {modal === 'org'
                ? 'Set up a dedicated team environment to manage multiple workspaces, members, and billing.'
                : 'Create an isolated workspace under your organization for specific projects and releases.'}
            </p>
            <input
              autoFocus
              value={modalName}
              onChange={e => setModalName(e.target.value)}
              placeholder={modal === 'org' ? 'e.g. Acme Corporation' : 'e.g. Platform Engineering'}
              onKeyDown={e => {
                if (e.key === 'Enter' && modalName.trim() && !modalBusy) createEntity()
              }}
            />
            <div className="row">
              <button className="b" onClick={() => setModal(null)} disabled={modalBusy}>
                Cancel
              </button>
              <button
                className="b pri"
                onClick={createEntity}
                disabled={modalBusy || !modalName.trim()}
              >
                {modalBusy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App-wide Command Palette Launcher */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignOut={() => signOut()}
      />
    </div>
  )
}
