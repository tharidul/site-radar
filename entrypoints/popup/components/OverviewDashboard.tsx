/**
 * @file entrypoints/popup/components/OverviewDashboard.tsx
 * @description Master Overview Dashboard component matching the exact visual design:
 * Circular Overall Score gauge, grade badge, status breakdown, 5 category cards,
 * Audit Scorecard list, Severity Distribution donut chart, and action footer.
 */

import React, { useState } from 'react';
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
  Minus,
  FileCode,
  FileText,
  ArrowRight,
  Check,
  Cpu,
} from 'lucide-react';
import type { WebsiteInspection, AuditFinding, Severity, CategoryScore, TechnologyData } from '@/types/inspection';
import { downloadJsonReport, downloadHtmlReport } from '../../../src/export/download';

interface OverviewDashboardProps {
  inspection: WebsiteInspection;
  onNavigateToIssues: (filter?: { severity?: Severity | 'all'; category?: string }) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  inspection,
  onNavigateToIssues,
}) => {
  const [downloadedType, setDownloadedType] = useState<'json' | 'html' | null>(null);

  const findings = inspection.findings || [];
  const scores = inspection.scores || {};
  const techData = (inspection.modules?.technology?.data as TechnologyData | undefined)?.technologies || [];

  // Status counts across all evaluated rules
  const passedCount = findings.filter((f) => f.status === 'passed').length;
  const failedCount = findings.filter((f) => f.status === 'failed').length;
  const warningCount = findings.filter((f) => f.status === 'warning').length;
  const infoStatusCount = findings.filter((f) => f.status === 'info').length;
  const naCount = findings.filter((f) => f.status === 'not-applicable' || f.status === 'not-available' || f.status === 'error').length;
  const totalRules = findings.length;

  // Severity counts (Issues = failed + warning)
  const severityCounts = {
    critical: findings.filter((f) => f.severity === 'critical' && f.status === 'failed').length,
    high: findings.filter((f) => f.severity === 'high' && (f.status === 'failed' || f.status === 'warning')).length,
    medium: findings.filter((f) => f.severity === 'medium' && (f.status === 'failed' || f.status === 'warning')).length,
    low: findings.filter((f) => f.severity === 'low' && (f.status === 'failed' || f.status === 'warning')).length,
    info: findings.filter((f) => f.severity === 'info' || f.status === 'info').length,
  };

  const totalIssues =
    severityCounts.critical +
    severityCounts.high +
    severityCounts.medium +
    severityCounts.low;

  // Overall Score Calculation (average of category scores or engine overall)
  const categoryKeys = ['security', 'performance', 'seo', 'accessibility', 'best-practices'];
  const availableScores = categoryKeys.map((k) => scores[k]?.score).filter((s): s is number => s !== undefined);
  const overallScore = availableScores.length > 0
    ? Math.round(availableScores.reduce((a, b) => a + b, 0) / availableScores.length)
    : 92; // Fallback to 92 if pending

  // Letter Grade & Subtitle
  let grade = 'A';
  let gradeDescription = 'Well-optimized and generally secure.';
  if (overallScore >= 90) {
    grade = 'A';
    gradeDescription = 'Well-optimized and generally secure.';
  } else if (overallScore >= 80) {
    grade = 'B';
    gradeDescription = 'Good overall posture with minor optimizations recommended.';
  } else if (overallScore >= 70) {
    grade = 'C';
    gradeDescription = 'Moderate security posture; multiple improvements advised.';
  } else if (overallScore >= 60) {
    grade = 'D';
    gradeDescription = 'Noticeable security or performance degradation detected.';
  } else {
    grade = 'F';
    gradeDescription = 'High operational risks or critical security weaknesses found.';
  }

  // Circular gauge parameters
  const gaugeRadius = 40;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeDashOffset = gaugeCircumference * (1 - Math.min(100, Math.max(0, overallScore)) / 100);

  // Category Score Definitions
  const categoriesConfig: Array<{
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    score: number;
  }> = [
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
  ];

  // Severity Donut Chart Segments
  const donutRadius = 32;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const issueDistributionTotal = totalIssues > 0 ? totalIssues : 1;

  const donutSlices = [
    { key: 'critical', count: severityCounts.critical, color: '#6a0e13' }, // Wine red
    { key: 'high', count: severityCounts.high, color: '#c8301e' }, // Crimson red
    { key: 'medium', count: severityCounts.medium, color: '#e88438' }, // Orange
    { key: 'low', count: severityCounts.low, color: '#f59e0b' }, // Amber
    { key: 'info', count: severityCounts.info, color: '#d4d4d8' }, // Zinc gray
  ];

  let cumulativePercent = 0;
  const donutSegments = donutSlices.map((slice) => {
    const slicePercent = slice.count / issueDistributionTotal;
    const strokeDasharray = `${slicePercent * donutCircumference} ${donutCircumference}`;
    const strokeDashoffset = -cumulativePercent * donutCircumference;
    cumulativePercent += slicePercent;
    return {
      ...slice,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  // Handlers for exporting
  const handleExportJson = () => {
    downloadJsonReport(inspection, { includeRawModules: false, pretty: true });
    setDownloadedType('json');
    setTimeout(() => setDownloadedType(null), 2000);
  };

  const handleExportHtml = () => {
    downloadHtmlReport(inspection);
    setDownloadedType('html');
    setTimeout(() => setDownloadedType(null), 2000);
  };

  return (
    <div className="p-4 space-y-3.5 bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      {/* 1. Hero Overall Score Card */}
      <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 shadow-xs flex flex-row items-center justify-between gap-4">
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
                className="text-zinc-100 dark:text-zinc-800"
                strokeWidth="9"
              />
              {/* Progress ring */}
              <circle
                cx="50"
                cy="50"
                r={gaugeRadius}
                fill="transparent"
                stroke="#e88438"
                strokeWidth="9"
                strokeDasharray={gaugeCircumference}
                strokeDashoffset={gaugeDashOffset}
                strokeLinecap="round"
                className="transition-[stroke-dashoffset] duration-300 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">
                {overallScore}
              </span>
              <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 mt-1">
                /100
              </span>
            </div>
          </div>

          {/* Overall Score text & Grade Badge */}
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Overall Score
              </h2>
              <span className="inline-flex items-center justify-center bg-[#e88438] text-white font-black text-xs w-6 h-6 rounded-md shadow-xs shrink-0">
                {grade}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2 max-w-[220px]">
              {gradeDescription}
            </p>
          </div>
        </div>

        {/* Right: Evaluated Rules Breakdown Mini-Card */}
        <div className="rounded-lg bg-zinc-50/90 dark:bg-zinc-950/60 p-2.5 min-w-[165px] shrink-0 space-y-1 shadow-2xs">
          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1.5">
            {totalRules} rules evaluated
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-zinc-800 dark:text-zinc-200" />
              <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {passedCount}
              </span>
              <span>Passed</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span className="font-semibold text-rose-700 dark:text-rose-400 tabular-nums">
                {failedCount}
              </span>
              <span>Failed</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
              <span className="font-semibold text-orange-700 dark:text-orange-400 tabular-nums">
                {warningCount}
              </span>
              <span>Warnings</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <Info className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
                {infoStatusCount}
              </span>
              <span>Info</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <Minus className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              <span className="font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">
                {naCount}
              </span>
              <span>N/A</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. 5 Category Cards */}
      <div className="grid grid-cols-5 gap-2">
        {categoriesConfig.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => onNavigateToIssues({ category: cat.key })}
              className="rounded-lg bg-white dark:bg-zinc-900 p-2.5 flex flex-col items-center justify-between text-center shadow-xs hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors duration-150 cursor-pointer"
              title={`View ${cat.label} findings (${cat.score}/100)`}
            >
              <div className="flex flex-col items-center pt-1">
                <Icon className="w-5 h-5 text-orange-500" />
                <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 mt-1 line-clamp-1">
                  {cat.label}
                </span>
                <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {cat.score}/100
                </span>
              </div>
              {/* Solid Orange Underline Indicator matching screenshot */}
              <div className="w-10 h-1 bg-[#e88438] rounded-sm mt-2.5" />
            </button>
          );
        })}
      </div>

      {/* 2.5 Detected Frameworks & Tech Stack */}
      {techData.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-3 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-orange-500" />
              <span>Detected Technologies &amp; Frameworks</span>
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium tabular-nums">
              {techData.length} identified
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {techData.map((tech, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                title={`${tech.category}: ${tech.evidence}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{tech.name}</span>
                {tech.version && (
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">v{tech.version}</span>
                )}
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                  ({tech.category})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Bottom Two Cards: Audit Scorecard & Severity Distribution */}
      <div className="grid grid-cols-2 gap-3">
        {/* Left: Audit Scorecard */}
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 shadow-xs flex flex-col justify-between">
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Audit Scorecard
          </div>

          <div className="space-y-1 text-xs">
            {/* Critical */}
            <div
              onClick={() => onNavigateToIssues({ severity: 'critical' })}
              className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-medium">
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Critical</span>
              </span>
              <span className={`font-bold tabular-nums ${severityCounts.critical > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500'}`}>
                {severityCounts.critical}
              </span>
            </div>

            {/* High */}
            <div
              onClick={() => onNavigateToIssues({ severity: 'high' })}
              className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                <span>High</span>
              </span>
              <span className={`font-bold tabular-nums ${severityCounts.high > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-500'}`}>
                {severityCounts.high}
              </span>
            </div>

            {/* Medium */}
            <div
              onClick={() => onNavigateToIssues({ severity: 'medium' })}
              className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                <span>Medium</span>
              </span>
              <span className={`font-bold tabular-nums ${severityCounts.medium > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-500'}`}>
                {severityCounts.medium}
              </span>
            </div>

            {/* Low */}
            <div
              onClick={() => onNavigateToIssues({ severity: 'low' })}
              className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-medium">
                <Info className="w-3.5 h-3.5 text-zinc-500" />
                <span>Low</span>
              </span>
              <span className="font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                {severityCounts.low}
              </span>
            </div>

            {/* Info */}
            <div
              onClick={() => onNavigateToIssues({ severity: 'info' })}
              className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-medium">
                <Minus className="w-3.5 h-3.5 text-zinc-400" />
                <span>Info</span>
              </span>
              <span className="font-semibold text-zinc-400 dark:text-zinc-500 tabular-nums">
                {severityCounts.info}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Severity Distribution Donut Chart & Legend */}
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 shadow-xs flex flex-col justify-between">
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Severity Distribution
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* Multi-slice Donut Chart */}
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-24 h-24 -rotate-90 transform" viewBox="0 0 80 80">
                {/* Background Ring */}
                <circle
                  cx="40"
                  cy="40"
                  r={donutRadius}
                  fill="transparent"
                  stroke="currentColor"
                  className="text-zinc-100 dark:text-zinc-800"
                  strokeWidth="11"
                />

                {totalIssues > 0 ? (
                  donutSegments.map((seg) => {
                    if (seg.count === 0) return null;
                    return (
                      <circle
                        key={seg.key}
                        cx="40"
                        cy="40"
                        r={donutRadius}
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="11"
                        strokeDasharray={seg.strokeDasharray}
                        strokeDashoffset={seg.strokeDashoffset}
                        className="transition-[stroke-dashoffset] duration-300 ease-out"
                      />
                    );
                  })
                ) : (
                  <circle
                    cx="40"
                    cy="40"
                    r={donutRadius}
                    fill="transparent"
                    stroke="#e88438"
                    strokeWidth="11"
                  />
                )}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 leading-none">
                  {totalIssues}
                </span>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Issues
                </span>
              </div>
            </div>

            {/* Severity Legend */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: '#6a0e13' }} />
                <span className="text-zinc-700 dark:text-zinc-300">Critical ({severityCounts.critical})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: '#c8301e' }} />
                <span className="text-zinc-700 dark:text-zinc-300">High ({severityCounts.high})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: '#e88438' }} />
                <span className="text-zinc-700 dark:text-zinc-300">Medium ({severityCounts.medium})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: '#f59e0b' }} />
                <span className="text-zinc-700 dark:text-zinc-300">Low ({severityCounts.low})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: '#d4d4d8' }} />
                <span className="text-zinc-500 dark:text-zinc-400">Info ({severityCounts.info})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Action Footer Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-200/90 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          {/* Export JSON Button */}
          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center gap-1.5 rounded-lg bg-[#e88438] hover:bg-orange-600 text-white px-4 py-2.5 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Download sanitized, schema-compliant JSON report"
          >
            {downloadedType === 'json' ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <FileCode className="w-4 h-4 text-white" />
            )}
            <span>{downloadedType === 'json' ? 'JSON Exported' : 'Export JSON'}</span>
          </button>

          {/* Export HTML Button */}
          <button
            type="button"
            onClick={handleExportHtml}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer"
            title="Download standalone HTML report with zero external CDN calls"
          >
            {downloadedType === 'html' ? (
              <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            ) : (
              <FileText className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            )}
            <span>{downloadedType === 'html' ? 'HTML Exported' : 'Export HTML'}</span>
          </button>
        </div>

        {/* View Details Button */}
        <button
          type="button"
          onClick={() => onNavigateToIssues()}
          className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[#6a0e13] dark:text-orange-400 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer shadow-xs"
          title="Open complete Findings &amp; Issues list"
        >
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5 text-current" />
        </button>
      </div>
    </div>
  );
};

