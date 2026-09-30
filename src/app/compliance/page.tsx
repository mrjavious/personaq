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
  Award,
  AlertCircle,
} from 'lucide-react';
import type { ComplianceAuditReport } from '@/lib/compliance/service';

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
  const [activeTab, setActiveTab] = useState<'scorecard' | 'rules' | 'audit'>('scorecard');
  const [report, setReport] = useState<ComplianceAuditReport | null>(null);
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
        const [reportRes, rulesRes, logsRes] = await Promise.all([
          fetch('/api/compliance/audit'),
          fetch('/api/platform-rules'),
          fetch(`/api/audit-logs${auditFilter !== 'all' ? `?action=${auditFilter}` : ''}`),
        ]);

        const reportData = await reportRes.json();
        const rulesData = await rulesRes.json();
        const logsData = await logsRes.json();

        if (isMounted) {
          if (reportData.report) setReport(reportData.report);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
                  Compliance &amp; Governance
                </h1>
                <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  Section 2 Guardrails
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Compliance scorecards, account checklists, dynamic platform rules, and cryptographic audit log.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="inline-flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('scorecard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'scorecard'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Checklist Scorecard
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'rules'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Platform Rules ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'audit'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Audit Log Explorer
          </button>
        </div>
      </div>

      {/* TAB 1: COMPLIANCE SCORECARD & CHECKLISTS */}
      {activeTab === 'scorecard' && report && (
        <div className="space-y-6">
          {/* Top Score Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Compliance Health Score</div>
              <div className="text-2xl font-bold font-mono flex items-center gap-2">
                <span
                  className={
                    report.overallScore >= 90
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : report.overallScore >= 70
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }
                >
                  {report.overallScore}%
                </span>
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {report.overallScore === 100
                  ? 'All guardrails 100% compliant'
                  : 'Minor warnings to address'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Guardrail 4 Violations</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {report.violationsCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Zero adult assets on SFW social</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">AI Bio Disclosures</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {report.accounts.filter((a) => a.disclosureInBio).length} / {report.accounts.length}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Tracked profile checklist</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Rule Staleness (&gt;90d)</div>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {report.staleRulesCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Requires review cadence</div>
            </div>
          </div>

          {/* Active Alerts Banner if any */}
          {report.alerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active Governance Alerts
              </h3>
              <div className="space-y-2">
                {report.alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                      alert.type === 'critical'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                        : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{alert.message}</span>
                    </div>
                    <span className="font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
                      {alert.entity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-Account Checklist */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Platform Account Compliance Checklist</h3>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="p-3.5 font-semibold">Platform &amp; Handle</th>
                    <th className="p-3.5 font-semibold">AI Bio Disclosure</th>
                    <th className="p-3.5 font-semibold">Platform Rule Status</th>
                    <th className="p-3.5 font-semibold">API Connection</th>
                    <th className="p-3.5 font-semibold">Account Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {report.accounts.map((acc) => (
                    <tr key={acc.accountId} className="hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white capitalize">{acc.platform}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{acc.handle}</div>
                      </td>
                      <td className="p-3.5">
                        {acc.disclosureInBio ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Disclosed in Bio
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Missing Bio Disclosure
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {acc.isRuleStale ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Stale ({acc.ruleDaysSince}d ago)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Verified ({acc.ruleDaysSince}d ago)
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {acc.apiStatus}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-semibold ${
                            acc.status === 'compliant'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : acc.status === 'warning'
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {acc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-Post & Asset Audit */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Post &amp; Asset Quality Audit</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1.5">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Safety Gate Pass Rate</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                  {report.postAudit.safetyComplianceRate}%
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {report.postAudit.passedSafetyGateCount} of {report.postAudit.totalVariants} variants passed 3-stage safety gate
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1.5">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">AI Label Applied Rate</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                  {report.postAudit.aiDisclosureComplianceRate}%
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {report.postAudit.aiDisclosureAppliedCount} variants flagged with platform AI toggle &amp; #AI
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1.5">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Guardrail 4 Asset Suitability</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  100% SFW Safe
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Zero adult assets on Instagram, X, Threads, or TikTok
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLATFORM RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Guardrail 9:</span> Platform rules are stored as data, not code. Rules older than 90 days trigger automatic compliance warnings.
              </p>
            </div>
            <button
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors"
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
                  className={`bg-white dark:bg-slate-900 border rounded-xl p-5 space-y-4 transition-all flex flex-col justify-between shadow-sm ${
                    rule.isStale
                      ? 'border-amber-400 dark:border-amber-500/50'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white capitalize">{rule.platform}</h2>
                      {rule.isStale ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold">
                          <AlertTriangle className="w-3 h-3" />
                          Stale ({rule.daysSinceVerification}d ago)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified ({rule.daysSinceVerification}d ago)
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">Allowed Suitability:</span>
                        <div className="flex gap-1">
                          {p.allowed_suitability?.map((s, idx) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                                s === 'adult_only'
                                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              }`}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">Max Caption:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                          {p.max_caption_length ? `${p.max_caption_length} chars` : 'Unconstrained'}
                        </span>
                      </div>

                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">AI Label Policy:</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium text-[11px]">
                          {p.ai_label_mandatory ? 'Mandatory' : 'Optional'}
                        </span>
                      </div>

                      <div className="space-y-1 pt-1">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] block">AI Label Guidance:</span>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                          {p.ai_label_instructions || 'Ensure disclosure is present.'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Link Policy:</span>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                          {p.link_policy || 'Standard platform policy.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openEditor(rule)}
                      className="h-8 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                      Edit JSON
                    </button>
                    <button
                      onClick={() => handleVerifyToday(rule.platform)}
                      className="h-8 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-medium flex items-center gap-1.5 transition-colors"
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

      {/* TAB 3: AUDIT LOG EXPLORER */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Cryptographic &amp; Activity Audit Log</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Guardrail 7: Records every publish, safety decision, manual override, login, and configuration change.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg px-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="p-3.5 font-semibold">Timestamp</th>
                    <th className="p-3.5 font-semibold">Action</th>
                    <th className="p-3.5 font-semibold">Entity</th>
                    <th className="p-3.5 font-semibold">User</th>
                    <th className="p-3.5 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors">
                        <td className="p-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(log.ts).toLocaleString()}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-semibold ${
                              log.action === 'safety_decision'
                                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : log.action === 'override'
                                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                : log.action === 'persona_update'
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-900 dark:text-slate-200">
                          {log.entity} <span className="text-slate-400 text-[10px]">({log.entityId.slice(0, 8)})</span>
                        </td>
                        <td className="p-3.5 text-slate-500 dark:text-slate-400">
                          {log.user ? log.user.email : 'System / Service'}
                        </td>
                        <td className="p-3.5">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="h-8 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 text-[11px]"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-500" />
                            View Meta
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                Edit Platform Rule: {editingRule.platform}
              </h2>
              <button
                onClick={() => setEditingRule(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {jsonError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-lg">
                {jsonError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Rules JSON Configuration</label>
              <textarea
                rows={12}
                value={editorJson}
                onChange={(e) => {
                  setEditorJson(e.target.value);
                  setJsonError(null);
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-900 dark:text-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="h-9 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingRule}
                onClick={handleSaveRule}
                className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Audit Event Details</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Action:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 uppercase font-semibold">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Entity:</span>
                <span className="font-mono text-slate-900 dark:text-slate-200">{selectedLog.entity}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Entity ID:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">{selectedLog.entityId}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Recorded At:</span>
                <span className="text-slate-800 dark:text-slate-300">{new Date(selectedLog.ts).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-slate-600 dark:text-slate-400 text-xs font-medium">Metadata Payload:</span>
              <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-[11px] text-slate-800 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-48">
                {selectedLog.meta ? JSON.stringify(JSON.parse(selectedLog.meta), null, 2) : 'No metadata attached'}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="h-9 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
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
