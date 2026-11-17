
import React, { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import type { AuditFinding } from '@/types/inspection';
import { sanitizeHref } from '../../../src/export/html.exporter';
import { copyFindingJson } from '../../../src/export/download';

export interface FindingDetailInspectorProps {
  finding: AuditFinding;
  onCollapse?: () => void;
  onBack?: () => void;
}

function renderFormattedTextWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={sanitizeHref(part)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-accent font-medium hover:underline break-all"
        >
          <span>{part}</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      );
    }
    return part;
  });
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

  const isExplanationDuplicate =
    Boolean(finding.explanation) &&
    finding.explanation?.trim().toLowerCase() === finding.description?.trim().toLowerCase();

  const hasContextEvidence = finding.evidence?.some(
    (e) => Boolean(e.location) || (Boolean(e.source) && e.source !== 'DOM' && e.source !== 'inspection'),
  );

  return (
    <div className="space-y-3.5 text-xs text-zinc-700 dark:text-zinc-300">
      {finding.recommendation && (
        <div className="rounded-md bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 p-3 space-y-1.5">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Recommended Remediation
          </h3>
          <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {renderFormattedTextWithLinks(finding.recommendation)}
          </div>
        </div>
      )}

      {finding.expectedBehavior && (
        <div className="space-y-0.5">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Expected Behavior
          </h3>
          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {finding.expectedBehavior}
          </p>
        </div>
      )}

      {finding.explanation && !isExplanationDuplicate && (
        <div className="space-y-0.5">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Technical Details
          </h3>
          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {finding.explanation}
          </p>
        </div>
      )}

      {finding.confidence !== undefined && finding.confidence < 1.0 && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 pt-0.5">
          <span>Heuristic Confidence:</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {Math.round(finding.confidence * 100)}%
          </span>
        </div>
      )}

      {finding.evidence && finding.evidence.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Observed Evidence
          </h3>
          <div
            tabIndex={0}
            role="region"
            aria-label="Observed Evidence"
            className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-800/30"
          >
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700/80 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/80">
                  <th className="py-2 px-3 font-semibold">Property</th>
                  <th className="py-2 px-3 font-semibold">Value</th>
                  {hasContextEvidence && (
                    <th className="py-2 px-3 font-semibold">Context</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700/60">
                {finding.evidence.map((ev, i) => (
                  <tr key={i} className="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50">
                    <td className="py-2 px-3 font-medium text-zinc-900 dark:text-zinc-100 align-top whitespace-nowrap">
                      {ev.label}
                    </td>
                    <td className="py-2 px-3 text-xs text-zinc-700 dark:text-zinc-300 align-top">
                      <code className="font-mono text-2xs bg-zinc-200/60 dark:bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-800 dark:text-zinc-200 break-all whitespace-pre-wrap select-text">
                        {formatEvidenceValue(ev.value)}
                      </code>
                    </td>
                    {hasContextEvidence && (
                      <td className="py-2 px-3 text-zinc-500 dark:text-zinc-400 text-xs align-top whitespace-nowrap">
                        {ev.location || ev.source || '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {finding.references && finding.references.length > 0 && (
        <div className="space-y-1 pt-1">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Documentation References
          </h3>
          <ul className="space-y-1 text-xs">
            {finding.references.map((ref, idx) => (
              <li key={idx} className="truncate">
                <a
                  href={sanitizeHref(ref)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-accent hover:underline font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
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
              ? 'border-emerald-500/40 dark:border-accent/50 text-emerald-600 dark:text-accent bg-emerald-500/10 dark:bg-accent/10 ring-1 ring-emerald-500/20 dark:ring-accent/30'
              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
          }`}
          title={isCopied ? 'Copied issue JSON!' : 'Copy issue JSON'}
          aria-label="Copy issue JSON"
        >
          {isCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-accent stroke-[2.5]" />
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
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-accent cursor-pointer transition-colors"
          >
            ← Back to Issues
          </button>
        ) : onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer"
          >
            Collapse details ↑
          </button>
        ) : null}
      </div>
    </div>
  );
};
