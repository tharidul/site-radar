/**
 * @file entrypoints/popup/components/Scorecard.tsx
 * @description Findings scorecard summary, severity breakdown, and category score indicators (Feature 43).
 * Adheres strictly to anti-slop guidelines: functional typography, high contrast, zero generic cards.
 */

import React from 'react';
import type { CategoryScore, AuditFinding, Severity } from '@/types/inspection';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

interface ScorecardProps {
  scores?: Record<string, CategoryScore>;
  findings: AuditFinding[];
  activeSeverityFilter?: Severity | 'all';
  onFilterSeverity: (severity: Severity | 'all') => void;
}

export const Scorecard: React.FC<ScorecardProps> = ({
  scores = {},
  findings,
  activeSeverityFilter = 'all',
  onFilterSeverity,
}) => {
  const counts = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };

  const categories = Object.keys(scores).length > 0
    ? Object.keys(scores)
    : ['security', 'performance', 'seo', 'accessibility', 'best-practices'];

  return (
    <div className="border-b border-zinc-800 bg-zinc-950 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-300">
          Audit Scorecard
        </span>
        <span className="text-xs text-zinc-400">
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
              ? 'border-rose-600 bg-rose-950/80 text-rose-300'
              : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
          }`}
          title="Filter by Critical findings"
        >
          <div className="text-lg font-bold tabular-nums text-rose-400">{counts.critical}</div>
          <div className="text-xs font-medium text-zinc-400">Critical</div>
        </button>

        <button
          type="button"
          onClick={() => onFilterSeverity(activeSeverityFilter === 'high' ? 'all' : 'high')}
          className={`rounded-lg border p-2 text-center transition-colors duration-150 cursor-pointer ${
            activeSeverityFilter === 'high'
              ? 'border-orange-600 bg-orange-950/80 text-orange-300'
              : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
          }`}
          title="Filter by High findings"
        >
          <div className="text-lg font-bold tabular-nums text-orange-400">{counts.high}</div>
          <div className="text-xs font-medium text-zinc-400">High</div>
        </button>

        <button
          type="button"
          onClick={() => onFilterSeverity(activeSeverityFilter === 'medium' ? 'all' : 'medium')}
          className={`rounded-lg border p-2 text-center transition-colors duration-150 cursor-pointer ${
            activeSeverityFilter === 'medium'
              ? 'border-orange-500 bg-orange-950/60 text-orange-300'
              : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
          }`}
          title="Filter by Medium findings"
        >
          <div className="text-lg font-bold tabular-nums text-orange-400">{counts.medium}</div>
          <div className="text-xs font-medium text-zinc-400">Medium</div>
        </button>

        <button
          type="button"
          onClick={() => onFilterSeverity(activeSeverityFilter === 'low' ? 'all' : 'low')}
          className={`rounded-lg border p-2 text-center transition-colors duration-150 cursor-pointer ${
            activeSeverityFilter === 'low'
              ? 'border-zinc-600 bg-zinc-800 text-zinc-200'
              : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
          }`}
          title="Filter by Low findings"
        >
          <div className="text-lg font-bold tabular-nums text-zinc-300">{counts.low}</div>
          <div className="text-xs font-medium text-zinc-400">Low</div>
        </button>

        <button
          type="button"
          onClick={() => onFilterSeverity(activeSeverityFilter === 'info' ? 'all' : 'info')}
          className={`rounded-lg border p-2 text-center transition-colors duration-150 cursor-pointer ${
            activeSeverityFilter === 'info'
              ? 'border-zinc-600 bg-zinc-800 text-zinc-200'
              : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
          }`}
          title="Filter by Info findings"
        >
          <div className="text-lg font-bold tabular-nums text-zinc-400">{counts.info}</div>
          <div className="text-xs font-medium text-zinc-400">Info</div>
        </button>
      </div>

      {/* Category Scores Grid */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {categories.map((catKey) => {
          const scoreObj = scores[catKey];
          const rawScore = scoreObj ? Math.round(scoreObj.score) : 0;
          const hasScore = scoreObj !== undefined;
          const hasCrit = Boolean(scoreObj?.hasCriticalFailure);

          let barColor = 'bg-zinc-600';
          let textColor = 'text-zinc-400';
          if (hasScore) {
            if (rawScore >= 90) {
              barColor = 'bg-zinc-100';
              textColor = 'text-zinc-100';
            } else if (rawScore >= 70) {
              barColor = 'bg-orange-400';
              textColor = 'text-orange-400';
            } else if (rawScore >= 50) {
              barColor = 'bg-orange-500';
              textColor = 'text-orange-500';
            } else {
              barColor = 'bg-rose-500';
              textColor = 'text-rose-400';
            }
          }

          return (
            <div
              key={catKey}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium capitalize text-zinc-200">
                  {catKey}
                </span>
                <span className={`text-xs font-semibold tabular-nums ${textColor}`}>
                  {hasScore ? `${rawScore}/100` : 'N/A'}
                </span>
              </div>

              <div className="h-1.5 w-full rounded-sm bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-sm ${barColor}`}
                  style={{ width: `${hasScore ? rawScore : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>
                  {scoreObj
                    ? `${scoreObj.passed ?? 0} pass · ${scoreObj.failed ?? 0} fail`
                    : 'Not evaluated'}
                </span>
                {hasCrit && (
                  <span className="text-rose-400 font-medium flex items-center gap-0.5">
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
