
import React, { useState } from 'react';
import { ExternalLink, ShieldAlert, Copy, Check } from 'lucide-react';
import type { AuditFinding } from '@/types/inspection';
import { sanitizeHref } from '../../../src/export/html.exporter';
import { copyFindingJson } from '../../../src/export/download';

export interface FindingDetailInspectorProps {
  finding: AuditFinding;
  onCollapse?: () => void;
  onBack?: () => void;
}

export const FindingDetailInspector: React.FC<FindingDetailInspectorProps> = ({
  finding,
  onCollapse,
  onBack,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyFindingJson(finding);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };
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

      {finding.expectedBehavior && (
        <div className="space-y-0.5">
          <span className="text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
            Expected Behavior
          </span>
          <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
            {finding.expectedBehavior}
          </p>
        </div>
      )}

      {finding.explanation && (
        <div className="space-y-0.5">
          <span className="text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
            Technical Explanation
          </span>
          <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
            {finding.explanation}
          </p>
        </div>
      )}

      {finding.confidence !== undefined && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 pt-0.5">
          <span>Detection Confidence:</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {Math.round(finding.confidence * 100)}%
          </span>
        </div>
      )}

      {finding.evidence && finding.evidence.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
            Observed Evidence (Sanitized)
          </span>
          <div className="overflow-x-auto border-t border-b border-zinc-200/90 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200/70 dark:border-zinc-800 text-2xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <th className="py-1.5 pr-3 font-semibold">Label</th>
                  <th className="py-1.5 pr-3 font-semibold">Value</th>
                  <th className="py-1.5 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/60">
                {finding.evidence.map((ev, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-3 font-medium text-zinc-800 dark:text-zinc-300 align-top whitespace-nowrap">
                      {ev.label}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-xs text-orange-600 dark:text-orange-400 break-all whitespace-pre-wrap">
                      {formatEvidenceValue(ev.value)}
                    </td>
                    <td className="py-1.5 text-zinc-500 dark:text-zinc-400 text-xs align-top whitespace-nowrap">
                      {ev.source || 'DOM'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {finding.references && finding.references.length > 0 && (
        <div className="space-y-1 pt-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
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

      <div className="pt-2 flex items-center justify-between border-t border-zinc-200/70 dark:border-zinc-800/80">
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-all duration-150 cursor-pointer ${
            isCopied
              ? 'border-emerald-500/40 dark:border-[#CEFF52]/50 text-emerald-600 dark:text-[#CEFF52] bg-emerald-500/10 dark:bg-[#CEFF52]/10 ring-1 ring-emerald-500/20 dark:ring-[#CEFF52]/30'
              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
          }`}
          title={isCopied ? 'Copied issue JSON!' : 'Copy issue JSON'}
          aria-label="Copy issue JSON"
        >
          {isCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#CEFF52] stroke-[2.5]" />
              <span>Issue Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Copy Issue JSON</span>
            </>
          )}
        </button>

        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#CEFF52] cursor-pointer transition-colors"
          >
            ← Back to Issues
          </button>
        ) : onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer"
          >
            Collapse details ↑
          </button>
        ) : null}
      </div>
    </div>
  );
};
