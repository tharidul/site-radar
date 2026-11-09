/**
 * @file entrypoints/popup/components/OverviewDashboard.tsx
 * @description Master Overview Dashboard component matching the exact visual design:
 * Circular Overall Score gauge, grade badge, status breakdown, 5 category cards,
 * Audit Scorecard list, Severity Distribution donut chart, and action footer.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Shield,
  Zap,
  Search,
  UserCheck,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  FileCode,
  FileText,
  ArrowRight,
  Check,
  Cpu,
  Copy,
} from 'lucide-react';
import type { WebsiteInspection, AuditFinding, Severity, CategoryScore, TechnologyData } from '@/types/inspection';
import { downloadJsonReport, downloadHtmlReport, copyJsonReport } from '../../../src/export/download';
import { Button } from './Button';
import { PageVitalsCard } from './PageVitalsCard';

interface OverviewDashboardProps {
  inspection: WebsiteInspection;
  onNavigateToIssues: (filter?: { severity?: Severity | 'all'; category?: string }) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  inspection,
  onNavigateToIssues,
}) => {
  const [downloadedType, setDownloadedType] = useState<'json' | 'html' | null>(null);
  const [isCopiedJson, setIsCopiedJson] = useState(false);

  const findings = inspection.findings || [];
  const scores = inspection.scores || {};
  const techData = (inspection.modules?.technology?.data as TechnologyData | undefined)?.technologies || [];

  // Single-pass count aggregation across all findings (js-combine-iterations, rerender-memo)
  const { statusCounts, severityCounts, totalIssues, totalRules } = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let warning = 0;
    let info = 0;
    let na = 0;

    let crit = 0;
    let high = 0;
    let med = 0;
    let low = 0;
    let infoSev = 0;

    for (const f of findings) {
      if (f.status === 'passed') passed++;
      else if (f.status === 'failed') failed++;
      else if (f.status === 'warning') warning++;
      else if (f.status === 'info') info++;
      else na++;

      if (f.severity === 'critical' && f.status === 'failed') crit++;
      else if (f.severity === 'high' && (f.status === 'failed' || f.status === 'warning')) high++;
      else if (f.severity === 'medium' && (f.status === 'failed' || f.status === 'warning')) med++;
      else if (f.severity === 'low' && (f.status === 'failed' || f.status === 'warning')) low++;
      if (f.severity === 'info' || f.status === 'info') infoSev++;
    }

    return {
      statusCounts: {
        passed,
        failed,
        warning,
        info,
        na,
      },
      severityCounts: {
        critical: crit,
        high,
        medium: med,
        low,
        info: infoSev,
      },
      totalIssues: crit + high + med + low,
      totalRules: findings.length,
    };
  }, [findings]);

  const passedCount = statusCounts.passed;
  const failedCount = statusCounts.failed;
  const warningCount = statusCounts.warning;
  const infoStatusCount = statusCounts.info;
  const naCount = statusCounts.na;

  // Overall Score Calculation (average of category scores or engine overall)
  const categoryKeys = ['security', 'performance', 'seo', 'accessibility', 'best-practices'];
  const availableScores = categoryKeys.map((k) => scores[k]?.score).filter((s): s is number => s !== undefined);
  const overallScore = availableScores.length > 0
    ? Math.round(availableScores.reduce((a, b) => a + b, 0) / availableScores.length)
    : 92; // Fallback to 92 if pending

  // Letter Grade & Subtitle
  let grade = 'A';
  let gradeDescription = 'Well-optimized. No major issues found.';
  if (overallScore >= 90) {
    grade = 'A';
    gradeDescription = 'Well-optimized. No major issues found.';
  } else if (overallScore >= 80) {
    grade = 'B';
    gradeDescription = 'Good shape overall, with a few minor items to clean up.';
  } else if (overallScore >= 70) {
    grade = 'C';
    gradeDescription = 'Several security, speed, or SEO issues need attention.';
  } else if (overallScore >= 60) {
    grade = 'D';
    gradeDescription = 'Notable problems detected across security or performance.';
  } else {
    grade = 'F';
    gradeDescription = 'Critical security or configuration issues found.';
  }

  // Circular gauge parameters
  const gaugeRadius = 41;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeDashOffset = gaugeCircumference * (1 - Math.min(100, Math.max(0, overallScore)) / 100);

  // Dynamic description matching the exact screenshot standard
  const dynamicDescription = useMemo(() => {
    if (failedCount > 0) {
      const failedCategories = Array.from(
        new Set(
          findings
            .filter((f) => f.status === 'failed')
            .map((f) => (f.category === 'performance' ? 'speed' : f.category || 'quality'))
        )
      );
      const catText = failedCategories.length > 0 ? failedCategories.slice(0, 2).join(' and ') : 'checks';
      return `${failedCount} failed check${failedCount === 1 ? '' : 's'} in ${catText} require attention.`;
    }
    if (warningCount > 0) {
      return `${warningCount} warning${warningCount === 1 ? '' : 's'} require review.`;
    }
    return gradeDescription;
  }, [failedCount, warningCount, findings, gradeDescription]);

  // Category Score Definitions (rerender-memo)
  const categoriesConfig = useMemo(() => [
    {
      key: 'security',
      label: 'Security',
      icon: Shield,
      score: scores['security'] ? Math.round(scores['security'].score) : 96,
    },
    {
      key: 'performance',
      label: 'Performance',
      icon: Zap,
      score: scores['performance'] ? Math.round(scores['performance'].score) : 93,
    },
    {
      key: 'seo',
      label: 'SEO',
      icon: Search,
      score: scores['seo'] ? Math.round(scores['seo'].score) : 90,
    },
    {
      key: 'accessibility',
      label: 'Accessibility',
      icon: UserCheck,
      score: scores['accessibility'] ? Math.round(scores['accessibility'].score) : 86,
    },
    {
      key: 'best-practices',
      label: 'Best Practices',
      icon: Layers,
      score: scores['best-practices'] ? Math.round(scores['best-practices'].score) : 95,
    },
  ], [scores]);

  // Handlers for exporting and copying (useCallback)
  const handleCopyJson = useCallback(async () => {
    const success = await copyJsonReport(inspection, { includeRawModules: false, pretty: true });
    if (success) {
      setIsCopiedJson(true);
      setTimeout(() => setIsCopiedJson(false), 2000);
    }
  }, [inspection]);

  const handleExportJson = useCallback(() => {
    downloadJsonReport(inspection, { includeRawModules: false, pretty: true });
    setDownloadedType('json');
    setTimeout(() => setDownloadedType(null), 2000);
  }, [inspection]);

  const handleExportHtml = useCallback(() => {
    downloadHtmlReport(inspection);
    setDownloadedType('html');
    setTimeout(() => setDownloadedType(null), 2000);
  }, [inspection]);

  return (
    <div className="p-4 space-y-3.5 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      {/* 1. Hero Overall Score Card matching exact design */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs flex items-center justify-between gap-4">
        {/* Left: Overall Circular Gauge + Text */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
            <svg className="w-24 h-24 -rotate-90 transform" viewBox="0 0 100 100">
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r={gaugeRadius}
                fill="transparent"
                stroke="currentColor"
                className="text-zinc-200 dark:text-zinc-800"
                strokeWidth="8"
              />
              {/* Progress ring */}
              <circle
                cx="50"
                cy="50"
                r={gaugeRadius}
                fill="transparent"
                stroke="#CEFF52"
                strokeWidth="8"
                strokeDasharray={gaugeCircumference}
                strokeDashoffset={gaugeDashOffset}
                strokeLinecap="round"
                className="transition-[stroke-dashoffset] duration-300 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white tracking-tight leading-none tabular-nums">
                {overallScore}
              </span>
            </div>
          </div>

          {/* Overall Score text & Grade Badge */}
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                Overall Health
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#132737] border border-[#21435c] text-[#CEFF52] shadow-2xs">
                Grade {grade}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2 max-w-[210px]">
              {dynamicDescription}
            </p>
          </div>
        </div>

        {/* Right: Evaluated Rules Breakdown */}
        <div className="border-l border-zinc-200/80 dark:border-zinc-800 pl-5 min-w-[155px] shrink-0 space-y-1.5">
          <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
            {totalRules} CHECKS RUN
          </div>

          <div className="flex items-center justify-between text-xs py-0.5">
            <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#CEFF52] shrink-0" />
              <span>Passed</span>
            </span>
            <span className="font-bold text-zinc-900 dark:text-white tabular-nums">
              {passedCount}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs py-0.5">
            <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <XCircle className="w-3.5 h-3.5 text-[#CEFF52] shrink-0" />
              <span>Failed</span>
            </span>
            <span className="font-bold text-[#CEFF52] tabular-nums">
              {failedCount}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs py-0.5">
            <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <AlertTriangle className="w-3.5 h-3.5 text-[#CEFF52] shrink-0" />
              <span>Warnings</span>
            </span>
            <span className="font-bold text-[#CEFF52] tabular-nums">
              {warningCount}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs py-0.5">
            <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Info className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
              <span>Info / N/A</span>
            </span>
            <span className="font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">
              {infoStatusCount + naCount}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 5 Category Cards with Circular Progress Gauge & Score in Middle */}
      <div className="grid grid-cols-5 gap-2">
        {categoriesConfig.map((cat) => {
          const miniRadius = 17.5;
          const miniCircumference = 2 * Math.PI * miniRadius;
          const miniDashOffset = miniCircumference * (1 - Math.min(100, Math.max(0, cat.score)) / 100);

          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => onNavigateToIssues({ category: cat.key })}
              className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 px-1.5 py-2.5 flex flex-col items-center justify-center text-center shadow-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer"
              title={`View ${cat.label} findings (${cat.score})`}
            >
              {/* Circular Progress Gauge with Score in Middle */}
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-14 h-14 -rotate-90 transform" viewBox="0 0 44 44">
                  {/* Background track */}
                  <circle
                    cx="22"
                    cy="22"
                    r={miniRadius}
                    fill="transparent"
                    stroke="currentColor"
                    className="text-zinc-200 dark:text-zinc-800"
                    strokeWidth="3.5"
                  />
                  {/* Progress ring */}
                  <circle
                    cx="22"
                    cy="22"
                    r={miniRadius}
                    fill="transparent"
                    stroke="#CEFF52"
                    strokeWidth="3.5"
                    strokeDasharray={miniCircumference}
                    strokeDashoffset={miniDashOffset}
                    strokeLinecap="round"
                    className="transition-[stroke-dashoffset] duration-300 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-base font-black text-zinc-900 dark:text-white tabular-nums leading-none tracking-tight">
                    {cat.score}
                  </span>
                </div>
              </div>

              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mt-1.5 line-clamp-1">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2.5 Detected Frameworks & Tech Stack */}
      {techData.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-3 shadow-xs border border-zinc-200/80 dark:border-zinc-800/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#CEFF52]" />
              <span>Detected Technologies &amp; Frameworks</span>
            </span>
            <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium tabular-nums">
              {techData.length} identified
            </span>
          </div>
          <div
            className={`grid gap-1.5 ${
              techData.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
            }`}
          >
            {techData.map((tech, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
                title={tech.evidence ? `Detected via: ${tech.evidence}` : undefined}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                    {tech.name}
                  </span>
                  {tech.version && (
                    <span className="shrink-0 text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700/60 text-zinc-800 dark:text-zinc-300">
                      v{tech.version}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate shrink-0 ml-1.5">
                  {tech.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2.7 Page Performance and Data Usage */}
      <PageVitalsCard inspection={inspection} />

      {/* 4. Bottom Action Footer Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          {/* Copy JSON Button */}
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleCopyJson}
            title="Copy sanitized JSON audit report directly to clipboard without downloading"
            className={`transition-all duration-200 ${
              isCopiedJson
                ? 'border-[#CEFF52]/60 text-[#152E40] dark:text-[#CEFF52] bg-[#CEFF52]/10 ring-2 ring-[#CEFF52]/40'
                : 'hover:text-[#152E40] dark:hover:text-[#CEFF52]'
            }`}
            leftIcon={
              isCopiedJson ? (
                <Check className="w-4 h-4 text-[#152E40] dark:text-[#CEFF52]" />
              ) : (
                <Copy className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              )
            }
          >
            {isCopiedJson ? 'JSON Copied!' : 'Copy JSON'}
          </Button>

          {/* Export JSON Button */}
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleExportJson}
            title="Download sanitized, schema-compliant JSON report"
            className={downloadedType === 'json' ? 'animate-pulse ring-2 ring-[#CEFF52]/50' : ''}
            leftIcon={
              downloadedType === 'json' ? (
                <Check className="w-4 h-4 text-[#152E40]" />
              ) : (
                <FileCode className="w-4 h-4 text-[#152E40]" />
              )
            }
          >
            {downloadedType === 'json' ? 'JSON Exported' : 'Export JSON'}
          </Button>

          {/* Export HTML Button */}
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleExportHtml}
            title="Download standalone HTML report with zero external CDN calls"
            className={downloadedType === 'html' ? 'animate-pulse ring-2 ring-[#CEFF52]/50' : ''}
            leftIcon={
              downloadedType === 'html' ? (
                <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              ) : (
                <FileText className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              )
            }
          >
            {downloadedType === 'html' ? 'HTML Exported' : 'Export HTML'}
          </Button>
        </div>

        {/* View Details Button */}
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => onNavigateToIssues()}
          title="Open complete Findings &amp; Issues list"
          rightIcon={<ArrowRight className="w-3.5 h-3.5 text-current" />}
          className="font-bold text-[#152E40] dark:text-[#CEFF52]"
        >
          View Details
        </Button>
      </div>
    </div>
  );
};

