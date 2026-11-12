
import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { AuditFinding, Severity, CategoryScore } from '@/types/inspection';
import { getScoreColor } from '@/utils/colors';

interface OptimizationMatrixCardProps {
  findings: AuditFinding[];
  scores: Record<string, CategoryScore>;
  onNavigateToIssues: (filter?: { severity?: Severity | 'all'; category?: string; query?: string }) => void;
}

interface OptimizationRow {
  key: 'seo' | 'aeo' | 'ago';
  name: string;
  tagline: string;
  target: string;
  score: number;
  statusText: string;
  issueCount: number;
  barColor: string;
}

export const OptimizationMatrixCard: React.FC<OptimizationMatrixCardProps> = ({
  findings,
  scores,
  onNavigateToIssues,
}) => {
  const rows: OptimizationRow[] = useMemo(() => {
    const seoFindings = findings.filter(
      (f) => f.category === 'seo' && !f.ruleId.startsWith('aeo-') && !f.ruleId.startsWith('ago-')
    );
    const seoIssues = seoFindings.filter((f) => f.status === 'failed' || f.status === 'warning');
    const seoPassed = seoFindings.filter((f) => f.status === 'passed').length;
    const seoTotal = seoFindings.length || 1;
    const baseSeoScore = scores['seo'] ? Math.round(scores['seo'].score) : Math.round((seoPassed / seoTotal) * 100);

    const seoStatusText =
      seoIssues.length === 0
        ? 'Metadata, canonical, and heading hierarchy verified'
        : `${seoIssues.length} check${seoIssues.length === 1 ? '' : 's'} require review`;

    const aeoFindings = findings.filter((f) => f.ruleId.startsWith('aeo-'));
    const aeoIssues = aeoFindings.filter((f) => f.status === 'failed' || f.status === 'warning');
    let aeoScore = 80;
    if (aeoFindings.length > 0) {
      let points = 0;
      aeoFindings.forEach((f) => {
        if (f.status === 'passed') points += 100;
        else if (f.status === 'info') points += 85;
        else if (f.status === 'warning') points += 50;
        else points += 10;
      });
      aeoScore = Math.round(points / aeoFindings.length);
    }

    const aeoStatusText =
      aeoIssues.length === 0
        ? 'AI crawler permissions and structured content verified'
        : aeoIssues.map((i) => i.title.replace(/^AEO\s+/, '')).join(' · ');

    const agoFindings = findings.filter((f) => f.ruleId.startsWith('ago-'));
    const agoIssues = agoFindings.filter((f) => f.status === 'failed' || f.status === 'warning');
    let agoScore = 90;
    if (agoFindings.length > 0) {
      let points = 0;
      agoFindings.forEach((f) => {
        if (f.status === 'passed') points += 100;
        else if (f.status === 'warning') points += 55;
        else points += 15;
      });
      agoScore = Math.round(points / agoFindings.length);
    }

    const agoStatusText =
      agoIssues.length === 0
        ? 'Form labels, semantic buttons, and DOM depth verified'
        : agoIssues.map((i) => i.title.replace(/^Agentic\s+/, '')).join(' · ');

    return [
      {
        key: 'seo',
        name: 'SEO',
        tagline: 'Search Engines',
        target: 'Google · Bing',
        score: baseSeoScore,
        statusText: seoStatusText,
        issueCount: seoIssues.length,
        barColor: getScoreColor(baseSeoScore).stroke,
      },
      {
        key: 'aeo',
        name: 'AEO',
        tagline: 'Answer Engines',
        target: 'ChatGPT · Perplexity',
        score: aeoScore,
        statusText: aeoStatusText,
        issueCount: aeoIssues.length,
        barColor: getScoreColor(aeoScore).stroke,
      },
      {
        key: 'ago',
        name: 'AGO',
        tagline: 'AI Web Agents',
        target: 'Claude · Operator · Devin',
        score: agoScore,
        statusText: agoStatusText,
        issueCount: agoIssues.length,
        barColor: getScoreColor(agoScore).stroke,
      },
    ];
  }, [findings, scores]);

  const averageScore = useMemo(() => {
    return Math.round(rows.reduce((acc, r) => acc + r.score, 0) / rows.length);
  }, [rows]);

  return (
    <div className="rounded-md bg-white dark:bg-zinc-900 p-3 shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
            AI &amp; Search Optimization (The O&apos;s)
          </span>
          <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 tabular-nums">
            {averageScore}% index
          </span>
        </div>

        <button
          type="button"
          onClick={() => onNavigateToIssues({ category: 'seo' })}
          className="text-xs font-semibold text-[#152E40] dark:text-[#CEFF52] hover:underline cursor-pointer"
        >
          View all findings →
        </button>
      </div>

      <div className="space-y-1.5">
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={() => onNavigateToIssues({ category: row.key })}
            className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150 ease-out text-left cursor-pointer group active:scale-[0.99]"
            title={`View ${row.name} findings (${row.score}%)`}
          >
            <div className="flex items-baseline gap-2 min-w-[125px] shrink-0">
              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                {row.name}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {row.tagline}
              </span>
            </div>

            <div className="hidden min-[480px]:block flex-1 min-w-0 pr-2">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                {row.statusText}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="w-14 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${Math.min(100, Math.max(5, row.score))}%`,
                    backgroundColor: row.barColor,
                  }}
                />
              </div>
              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 tabular-nums w-8 text-right">
                {row.score}%
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-[#CEFF52] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
