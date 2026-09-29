'use client';

import React, { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Code2,
  Sliders,
  Filter,
  Clock,
  Eye,
  X,
  Save,
} from 'lucide-react';

interface PlatformRuleItem {
  id: string;
  platform: string;
  rulesJson: string;
  parsedRules: {
    allowed_suitability?: string[];
    max_caption_length?: number;
    max_hashtags?: number;
    recommended_aspect_ratios?: string[];
    ai_label_mandatory?: boolean;
    ai_label_instructions?: string;
    link_policy?: string;
  };
  lastVerifiedAt: string;
  isStale: boolean;
  daysSinceVerification: number;
}

interface AuditLogItem {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  meta: string | null;
  ts: string;
  user?: {
    email: string;
    role: string;
  } | null;
}

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<'rules' | 'audit'>('rules');
  const [rules, setRules] = useState<PlatformRuleItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditFilter, setAuditFilter] = useState<string>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Edit Rule Modal State
  const [editingRule, setEditingRule] = useState<PlatformRuleItem | null>(null);
  const [editorJson, setEditorJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [savingRule, setSavingRule] = useState(false);

  // View Log Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const [rulesRes, logsRes] = await Promise.all([
          fetch('/api/platform-rules'),
          fetch(`/api/audit-logs${auditFilter !== 'all' ? `?action=${auditFilter}` : ''}`),
        ]);

        const rulesData = await rulesRes.json();
        const logsData = await logsRes.json();

        if (isMounted) {
          if (rulesData.rules) setRules(rulesData.rules);
          if (logsData.logs) setAuditLogs(logsData.logs);
        }
      } catch (err) {
        console.error('Error loading compliance data:', err);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [auditFilter, refreshTrigger]);

  const handleVerifyToday = async (platform: string) => {
    try {
      const res = await fetch(`/api/platform-rules/${platform}/verify`, { method: 'POST' });
      if (res.ok) {
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Error verifying platform:', err);
    }
  };

  const openEditor = (rule: PlatformRuleItem) => {
    setEditingRule(rule);
    setEditorJson(JSON.stringify(rule.parsedRules, null, 2));
    setJsonError(null);
  };

  const handleSaveRule = async () => {
    if (!editingRule) return;
    try {
      JSON.parse(editorJson); // validate
      setSavingRule(true);

      const res = await fetch('/api/platform-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: editingRule.platform,
          rulesJson: editorJson,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update rule');
      }

      setEditingRule(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
    } finally {
      setSavingRule(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Compliance & Governance</h1>
            <span className="text-[11px] bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-500/30">
              Section 2 Guardrails &amp; Audit
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic platform policies, verification cadence, and comprehensive audit trail.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'rules'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Platform Rules ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'audit'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Audit Log Explorer
          </button>
        </div>
      </div>

      {/* TAB 1: PLATFORM RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <p className="text-xs text-slate-300">
                <span className="font-semibold text-white">Guardrail 9:</span> Platform rules are stored as data, not code. Rules older than 90 days trigger automatic compliance warnings.
              </p>
            </div>
            <button
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rules.map((rule) => {
              const p = rule.parsedRules;
              return (
                <div
                  key={rule.id}
                  className={`bg-slate-900/60 border rounded-2xl p-5 space-y-4 transition-all flex flex-col justify-between ${
                    rule.isStale
                      ? 'border-amber-500/50 shadow-md shadow-amber-500/10'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold text-white capitalize">{rule.platform}</h2>
                      {rule.isStale ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold">
                          <AlertTriangle className="w-3 h-3" />
                          Stale ({rule.daysSinceVerification}d ago)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified ({rule.daysSinceVerification}d ago)
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                        <span className="text-slate-400">Allowed Suitability:</span>
                        <div className="flex gap-1">
                          {p.allowed_suitability?.map((s, idx) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                                s === 'adult_only'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                        <span className="text-slate-400">Max Caption:</span>
                        <span className="text-slate-200 font-mono text-[11px]">
                          {p.max_caption_length ? `${p.max_caption_length} chars` : 'Unconstrained'}
                        </span>
                      </div>

                      <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                        <span className="text-slate-400">AI Label Policy:</span>
                        <span className="text-indigo-300 font-medium text-[11px]">
                          {p.ai_label_mandatory ? 'Mandatory' : 'Optional'}
                        </span>
                      </div>

                      <div className="space-y-1 pt-1">
                        <span className="text-slate-400 text-[11px] block">AI Label Guidance:</span>
                        <p className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-850">
                          {p.ai_label_instructions || 'Ensure disclosure is present.'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-400 text-[11px] block">Link Policy:</span>
                        <p className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-850">
                          {p.link_policy || 'Standard platform policy.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openEditor(rule)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                      Edit JSON
                    </button>
                    <button
                      onClick={() => handleVerifyToday(rule.platform)}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Mark Verified
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOG EXPLORER */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-white">Cryptographic & Activity Audit Log</h2>
              <p className="text-xs text-slate-400">
                Guardrail 7: Records every publish, safety decision, manual override, login, and configuration change.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Actions</option>
                <option value="publish">Publish</option>
                <option value="safety_decision">Safety Decision</option>
                <option value="override">Safety Override</option>
                <option value="persona_update">Persona Update</option>
                <option value="settings_change">Settings Change</option>
                <option value="login">Login</option>
                <option value="2fa_verify">2FA Verification</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-3.5 font-semibold">Timestamp</th>
                    <th className="p-3.5 font-semibold">Action</th>
                    <th className="p-3.5 font-semibold">Entity</th>
                    <th className="p-3.5 font-semibold">User</th>
                    <th className="p-3.5 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/60 transition-all">
                        <td className="p-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(log.ts).toLocaleString()}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-semibold ${
                              log.action === 'safety_decision'
                                ? 'bg-amber-500/20 text-amber-300'
                                : log.action === 'override'
                                ? 'bg-rose-500/20 text-rose-300'
                                : log.action === 'persona_update'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-200">
                          {log.entity} <span className="text-slate-500 text-[10px]">({log.entityId.slice(0, 8)})</span>
                        </td>
                        <td className="p-3.5 text-slate-400">
                          {log.user ? log.user.email : 'System / Service'}
                        </td>
                        <td className="p-3.5">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-all flex items-center gap-1 text-[11px]"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            View Meta
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No audit records found matching this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT RULE MODAL */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white capitalize">
                Edit Platform Rule: {editingRule.platform}
              </h2>
              <button
                onClick={() => setEditingRule(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {jsonError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg">
                {jsonError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Rules JSON Configuration</label>
              <textarea
                rows={12}
                value={editorJson}
                onChange={(e) => {
                  setEditorJson(e.target.value);
                  setJsonError(null);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-indigo-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingRule}
                onClick={handleSaveRule}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
              >
                <Save className="w-3.5 h-3.5" />
                {savingRule ? 'Saving...' : 'Save & Verify Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW AUDIT METADATA MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white">Audit Event Details</h2>
                <p className="text-[11px] text-slate-400 font-mono">{selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Action:</span>
                <span className="font-mono text-indigo-300 uppercase">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Entity:</span>
                <span className="font-mono text-slate-200">{selectedLog.entity}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Entity ID:</span>
                <span className="font-mono text-slate-400">{selectedLog.entityId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Recorded At:</span>
                <span className="text-slate-300">{new Date(selectedLog.ts).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-xs font-medium">Metadata Payload:</span>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                {selectedLog.meta ? JSON.stringify(JSON.parse(selectedLog.meta), null, 2) : 'No metadata attached'}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
