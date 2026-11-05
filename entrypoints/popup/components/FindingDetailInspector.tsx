/**
 * @file entrypoints/popup/components/FindingDetailInspector.tsx
 * @description Inline finding detail inspector displaying expected behavior,
 * technical explanation, detection confidence indicator, remediation guidance,
 * sanitized evidence table, and reference links (Feature 46).
 * Renders directly inline within finding cards with zero separate modals.
 */

import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import type { AuditFinding } from '@/types/inspection';
import { sanitizeHref } from '../../../src/export/html.exporter';

export interface FindingDetailInspectorProps {
  finding: AuditFinding;
  onCollapse?: () => void;
}

export const FindingDetailInspector: React.FC<FindingDetailInspectorProps> = ({
  finding,
  onCollapse,
}) => {
  const formatEvidenceValue = (val: unknown): string => {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  };

  return (
    <div className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
      {/* Expected Behavior */}
      {finding.expectedBehavior && (
        <div className="rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-1 shadow-2xs">
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 block">
            Expected Behavior
          </span>
          <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">
            {finding.expectedBehavior}
          </p>
        </div>
      )}

      {/* Detailed Technical Explanation */}
      {finding.explanation && (
        <div className="rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-1 shadow-2xs">
          <span className="text-xs font-bold text-orange-600 dark:text-orange-400 block">
            Technical Explanation
          </span>
          <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">
            {finding.explanation}
          </p>
        </div>
      )}

      {/* Heuristic Confidence */}
      {finding.confidence !== undefined && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs shadow-2xs">
          <span className="text-zinc-500 dark:text-zinc-400">Detection Confidence:</span>
          <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {Math.round(finding.confidence * 100)}%
          </span>
        </div>
      )}

      {/* Remediation Guidance */}
      {finding.recommendation && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-1 shadow-2xs">
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 shrink-0 text-orange-500" />
            <span>Recommended Remediation</span>
          </span>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            {finding.recommendation}
          </p>
        </div>
      )}

      {/* Redacted Evidence Table */}
      {finding.evidence && finding.evidence.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
            Observed Evidence (Sanitized)
          </span>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400">
                  <th className="p-2 font-semibold">Label</th>
                  <th className="p-2 font-semibold">Value</th>
                  <th className="p-2 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {finding.evidence.map((ev, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/80 last:border-b-0 bg-white dark:bg-zinc-900">
                    <td className="p-2 font-medium text-zinc-800 dark:text-zinc-300 align-top whitespace-nowrap">
                      {ev.label}
                    </td>
                    {/* deslop-ignore-next-line 34 */}
                    <td className="p-2 font-mono text-xs text-orange-600 dark:text-orange-400 break-all whitespace-pre-wrap">
                      {formatEvidenceValue(ev.value)}
                    </td>
                    <td className="p-2 text-zinc-500 dark:text-zinc-400 text-xs align-top whitespace-nowrap">
                      {ev.source || 'DOM'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* References */}
      {finding.references && finding.references.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
            Documentation References
          </span>
          <ul className="space-y-1 text-xs">
            {finding.references.map((ref, idx) => (
              <li key={idx} className="truncate">
                <a
                  href={sanitizeHref(ref)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{ref}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onCollapse && (
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={onCollapse}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline cursor-pointer"
          >
            Collapse Details ↑
          </button>
        </div>
      )}
    </div>
  );
};
