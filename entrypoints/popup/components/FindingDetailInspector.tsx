/**
 * @file entrypoints/popup/components/FindingDetailInspector.tsx
 * @description Clean, editorial inline finding detail inspector.
 * Eliminates nested card containers in favor of high-contrast typographic hierarchy.
 */

import React from 'react';
import { ExternalLink, ShieldAlert } from 'lucide-react';
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
    <div className="space-y-3.5 text-xs text-zinc-700 dark:text-zinc-300">
      {/* Recommended Remediation (Clean Highlight with Left Accent Line) */}
      {finding.recommendation && (
        <div className="border-l-2 border-orange-500 pl-3 py-0.5 space-y-0.5">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span>Recommended Remediation</span>
          </span>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {finding.recommendation}
          </p>
        </div>
      )}

      {/* Expected Behavior */}
      {finding.expectedBehavior && (
        <div className="space-y-0.5">
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
            Expected Behavior
          </span>
          <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
            {finding.expectedBehavior}
          </p>
        </div>
      )}

      {/* Technical Explanation */}
      {finding.explanation && (
        <div className="space-y-0.5">
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
            Technical Explanation
          </span>
          <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
            {finding.explanation}
          </p>
        </div>
      )}

      {/* Detection Confidence */}
      {finding.confidence !== undefined && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 pt-0.5">
          <span>Detection Confidence:</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {Math.round(finding.confidence * 100)}%
          </span>
        </div>
      )}

      {/* Redacted Evidence Table - Clean Flat Hairline Table */}
      {finding.evidence && finding.evidence.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
            Observed Evidence (Sanitized)
          </span>
          <div className="overflow-x-auto border-t border-b border-zinc-200/90 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200/70 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <th className="py-1.5 pr-3 font-semibold">Label</th>
                  <th className="py-1.5 pr-3 font-semibold">Value</th>
                  <th className="py-1.5 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {finding.evidence.map((ev, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-3 font-medium text-zinc-800 dark:text-zinc-300 align-top whitespace-nowrap">
                      {ev.label}
                    </td>
                    {/* deslop-ignore-next-line 34 */}
                    <td className="py-1.5 pr-3 font-mono text-[11px] text-orange-600 dark:text-orange-400 break-all whitespace-pre-wrap">
                      {formatEvidenceValue(ev.value)}
                    </td>
                    <td className="py-1.5 text-zinc-500 dark:text-zinc-400 text-[11px] align-top whitespace-nowrap">
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
        <div className="space-y-1 pt-1">
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
            Documentation References
          </span>
          <ul className="space-y-0.5 text-xs">
            {finding.references.map((ref, idx) => (
              <li key={idx} className="truncate">
                <a
                  href={sanitizeHref(ref)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 hover:underline"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{ref}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onCollapse && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onCollapse}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
          >
            Collapse details ↑
          </button>
        </div>
      )}
    </div>
  );
};
