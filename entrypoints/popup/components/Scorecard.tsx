
import React, { useMemo } from 'react';
import type { CategoryScore, AuditFinding, Severity } from '@/types/inspection';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';

const EMPTY_SCORES: Record<string, CategoryScore> = {};

interface ScorecardProps {
  scores?: Record<string, CategoryScore>;
  findings: AuditFinding[];
  activeSeverityFilter?: Severity | 'all';
  onFilterSeverity: (severity: Severity | 'all') => void;
}

export const Scorecard: React.FC<ScorecardProps> = ({
  scores = EMPTY_SCORES,
  findings,
  activeSeverityFilter = 'all',
  onFilterSeverity,
}) => {
  const counts = useMemo(() => {
    let critical = 0;
    let warnings = 0;
    let passed = 0;

    for (const f of findings) {
      if (f.status === 'passed') {
        passed++;
      } else if (f.status === 'failed' || f.status === 'error' || f.severity === 'critical') {
        critical++;
      } else if (f.status === 'warning' || f.status === 'info') {
        warnings++;
      }
    }

    return { critical, warnings, passed };
  }, [findings]);

  const categories = Object.keys(scores).length > 0
    ? Object.keys(scores)
    : ['security', 'performance', 'seo', 'accessibility', 'best-practices'];

  return (
    <div className="border-b border-zinc-200/80 dark:border-zinc-800 bg-app-bg p-4 space-y-3 text-app-fg">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
          Audit Scorecard
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {findings.length} rule{findings.length === 1 ? '' : 's'} evaluated
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() =>
            onFilterSeverity(
              activeSeverityFilter === 'critical' || activeSeverityFilter === 'high'
                ? 'all'
                : 'critical',
            )
          }
          className={`rounded-lg border p-2.5 text-center transition-colors duration-150 cursor-pointer ${
            activeSeverityFilter === 'critical' || activeSeverityFilter === 'high'
              ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
          }`}
          title="Filter by Critical"
        >
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <div className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
              {counts.critical}
            </div>
          </div>
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-400">Critical</div>
        </button>

        <button
          type="button"
          onClick={() =>
            onFilterSeverity(
              activeSeverityFilter === 'medium' || activeSeverityFilter === 'low'
                ? 'all'
                : 'medium',
            )
          }
          className={`rounded-lg border p-2.5 text-center transition-colors duration-150 cursor-pointer ${
            activeSeverityFilter === 'medium' || activeSeverityFilter === 'low'
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
          }`}
          title="Filter by Warnings"
        >
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <div className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {counts.warnings}
            </div>
          </div>
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-400">Warnings</div>
        </button>

        <button
          type="button"
          onClick={() => onFilterSeverity('all')}
          className="rounded-lg border p-2.5 text-center transition-colors duration-150 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs cursor-pointer"
          title="Total passed checks"
        >
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {counts.passed}
            </div>
          </div>
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-400">Passed</div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        {categories.map((catKey) => {
          const scoreObj = scores[catKey];
          const rawScore = scoreObj ? Math.round(scoreObj.score) : 0;
          const hasScore = scoreObj !== undefined;
          const hasCrit = Boolean(scoreObj?.hasCriticalFailure);

          let barColor = 'bg-zinc-400 dark:bg-zinc-600';
          let textColor = 'text-zinc-600 dark:text-zinc-400';
          if (hasScore) {
            if (rawScore >= 90) {
              barColor = 'bg-zinc-800 dark:bg-zinc-100';
              textColor = 'text-zinc-900 dark:text-zinc-100';
            } else if (rawScore >= 70) {
              barColor = 'bg-amber-500 dark:bg-amber-400';
              textColor = 'text-amber-600 dark:text-amber-400';
            } else if (rawScore >= 50) {
              barColor = 'bg-amber-600 dark:bg-amber-500';
              textColor = 'text-amber-700 dark:text-amber-400';
            } else {
              barColor = 'bg-rose-600 dark:bg-rose-500';
              textColor = 'text-rose-700 dark:text-rose-400';
            }
          }

          return (
            <div
              key={catKey}
              className="rounded-md bg-white dark:bg-zinc-900 p-2.5 space-y-1.5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold capitalize text-zinc-800 dark:text-zinc-200">
                  {catKey}
                </span>
                <span className={`text-xs font-bold tabular-nums ${textColor}`}>
                  {hasScore ? rawScore : 'N/A'}
                </span>
              </div>

              <div className="h-1.5 w-full rounded-sm bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-sm ${barColor}`}
                  style={{ width: `${hasScore ? rawScore : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                <span>
                  {scoreObj
                    ? `${scoreObj.passed ?? 0} passed · ${scoreObj.failed ?? 0} critical`
                    : 'Not evaluated'}
                </span>
                {hasCrit && (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>Capped</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
