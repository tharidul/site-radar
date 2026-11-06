/**
 * @file entrypoints/popup/components/Scorecard.tsx
 * @description Findings scorecard summary, severity breakdown, and category score indicators (Feature 43).
 * Adheres strictly to anti-slop guidelines: functional typography, high contrast, zero generic cards.
 */

import React, { useMemo } from 'react';
import type { CategoryScore, AuditFinding, Severity } from '@/types/inspection';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

// Hoisted stable default non-primitive (rerender-memo-with-default-value)
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
  // Single-pass severity aggregation (js-combine-iterations, rerender-memo)
  const counts = useMemo(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;

    for (const f of findings) {
      if (f.severity === 'critical') critical++;
      else if (f.severity === 'high') high++;
      else if (f.severity === 'medium') medium++;
      else if (f.severity === 'low') low++;
      else if (f.severity === 'info') info++;
    }

    return { critical, high, medium, low, info };
  }, [findings]);

  const categories = Object.keys(scores).length > 0
    ? Object.keys(scores)
    : ['security', 'performance', 'seo', 'accessibility', 'best-practices'];

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-[#f8f8fa] dark:bg-zinc-950 p-4 space-y-3 text-zinc-900 dark:text-zinc-100">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
          Audit Scorecard
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {findings.length} rule{findings.length === 1 ? '' : 's'} evaluated
        </span>
      </div>

      {/* Severity Count Filter Buttons */}
      <div className="grid grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => onFilterSeverity(activeSeverityFilter === 'critical' ? 'all' : 'critical')}
          className={`rounded-lg border p-2 text-center transition-colors duration-150 cursor-pointer ${
            activeSeverityFilter === 'critical'
              ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
          }`}
          title="Filter by Critical findings"
        >
          <div className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">{counts.critical}</div>
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-400">Critical</div>
        </button>

        <button
          type="button"
          onClick={() => onFilterSeverity(activeSeverityFilter === 'high' ? 'all' : 'high')}
          className={`rounded-lg border p-2 text-center transition-colors duration-150 cursor-pointer ${
            activeSeverityFilter === 'high'
              ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
          }`}
          title="Filter by High findings"
        >
          <div className="text-lg font-bold tabular-nums text-orange-600 dark:text-orange-400">{counts.high}</div>
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-400">High</div>
        </button>

        <button
          type="button"
          onClick={() => onFilterSeverity(activeSeverityFilter === 'medium' ? 'all' : 'medium')}
          className={`rounded-lg border p-2 text-center transition-colors duration-150 cursor-pointer ${
            activeSeverityFilter === 'medium'
              ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
          }`}
          title="Filter by Medium findings"
        >
          <div className="text-lg font-bold tabular-nums text-orange-600 dark:text-orange-400">{counts.medium}</div>
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-400">Medium</div>
        </button>

        <button
          type="button"
          onClick={() => onFilterSeverity(activeSeverityFilter === 'low' ? 'all' : 'low')}
          className={`rounded-lg border p-2 text-center transition-colors duration-150 cursor-pointer ${
            activeSeverityFilter === 'low'
              ? 'border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
          }`}
          title="Filter by Low findings"
        >
          <div className="text-lg font-bold tabular-nums text-zinc-800 dark:text-zinc-300">{counts.low}</div>
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-400">Low</div>
        </button>

        <button
          type="button"
          onClick={() => onFilterSeverity(activeSeverityFilter === 'info' ? 'all' : 'info')}
          className={`rounded-lg border p-2 text-center transition-colors duration-150 cursor-pointer ${
            activeSeverityFilter === 'info'
              ? 'border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
          }`}
          title="Filter by Info findings"
        >
          <div className="text-lg font-bold tabular-nums text-zinc-600 dark:text-zinc-400">{counts.info}</div>
          <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Info</div>
        </button>
      </div>

      {/* Category Scores Grid */}
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
              barColor = 'bg-orange-500 dark:bg-orange-400';
              textColor = 'text-orange-600 dark:text-orange-400';
            } else if (rawScore >= 50) {
              barColor = 'bg-orange-600 dark:bg-orange-500';
              textColor = 'text-orange-700 dark:text-orange-400';
            } else {
              barColor = 'bg-rose-600 dark:bg-rose-500';
              textColor = 'text-rose-700 dark:text-rose-400';
            }
          }

          return (
            <div
              key={catKey}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 space-y-1.5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold capitalize text-zinc-800 dark:text-zinc-200">
                  {catKey}
                </span>
                <span className={`text-xs font-bold tabular-nums ${textColor}`}>
                  {hasScore ? `${rawScore}/100` : 'N/A'}
                </span>
              </div>

              <div className="h-1.5 w-full rounded-sm bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-sm ${barColor}`}
                  style={{ width: `${hasScore ? rawScore : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                <span>
                  {scoreObj
                    ? `${scoreObj.passed ?? 0} pass · ${scoreObj.failed ?? 0} fail`
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
