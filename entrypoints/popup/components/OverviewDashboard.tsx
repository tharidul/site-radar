
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
  ArrowRight,
  Cpu,
} from 'lucide-react';
import type { WebsiteInspection, AuditFinding, Severity, CategoryScore, TechnologyData } from '@/types/inspection';
import { Button } from './Button';
import { PageVitalsCard } from './PageVitalsCard';
import { OptimizationMatrixCard } from './OptimizationMatrixCard';
import { ExportDropdown } from './ExportDropdown';
import type { DashboardTab } from './TabBar';
import { getScoreColor } from '@/utils/colors';
import { isLocalDevelopmentHost } from '@/security/private-network.guard';

interface OverviewDashboardProps {
  inspection: WebsiteInspection;
  onNavigateToIssues: (filter?: { severity?: Severity | 'all'; category?: string }) => void;
  onNavigateToTab?: (tab: DashboardTab) => void;
  liveMetrics?: {
    resourceCount: number;
    wireTransferBytes: number;
    decodedBytes: number;
    cacheHitCount: number;
    cacheHitBytes: number;
    opaqueResourceCount: number;
  } | null;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  inspection,
  onNavigateToIssues,
  onNavigateToTab,
  liveMetrics,
}) => {
  const findings = inspection.findings || [];
  const scores = inspection.scores || {};
  const techData = (inspection.modules?.technology?.data as TechnologyData | undefined)?.technologies || [];

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

  const categoryKeys = ['security', 'performance', 'seo', 'accessibility', 'best-practices'];
  const availableScores = categoryKeys.map((k) => scores[k]?.score).filter((s): s is number => s !== undefined);
  const overallScore = inspection.overallScore !== undefined
    ? inspection.overallScore
    : (availableScores.length > 0
        ? Math.round(availableScores.reduce((a, b) => a + b, 0) / availableScores.length)
        : 92);

  const overallColor = getScoreColor(overallScore);
  const grade = overallColor.grade;
  let gradeDescription = 'Well-optimized. No major issues found.';
  if (overallScore >= 90) {
    gradeDescription = 'Well-optimized. No major issues found.';
  } else if (overallScore >= 80) {
    gradeDescription = 'Good shape overall, with a few minor items to clean up.';
  } else if (overallScore >= 70) {
    gradeDescription = 'Several security, speed, or SEO issues need attention.';
  } else if (overallScore >= 60) {
    gradeDescription = 'Notable problems detected across security or performance.';
  } else {
    gradeDescription = 'Critical security or configuration issues found.';
  }

  const gaugeRadius = 41;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeDashOffset = gaugeCircumference * (1 - Math.min(100, Math.max(0, overallScore)) / 100);

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
  ].map((cat) => {
    const colorDef = getScoreColor(cat.score);
    return {
      ...cat,
      color: colorDef.stroke,
      textColor: colorDef.textColor,
      grade: colorDef.grade,
    };
  }), [scores]);

  const isLocalDev = Boolean(
    inspection.target?.isLocalDevelopment ||
    (inspection.target?.hostname && isLocalDevelopmentHost(inspection.target.hostname))
  );

  return (
    <div className="min-h-full flex flex-col bg-[#f8f8fa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      <div className="flex-1 p-4 space-y-3.5">
        {isLocalDev && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
            <span className="font-semibold shrink-0">🛠️ Localhost Dev Mode:</span>
            <span>Security &amp; canonical rules adapted for loopback testing.</span>
          </div>
        )}
        <div className="rounded-md bg-white dark:bg-zinc-900 p-3 min-[400px]:p-4 sm:p-5 shadow-xs flex items-center justify-between gap-3 min-[400px]:gap-4">
          <div className="flex items-center gap-3 min-[400px]:gap-4 min-w-0 flex-1">
            <div className="relative w-22 h-22 min-[400px]:w-24 min-[400px]:h-24 min-[500px]:w-[102px] min-[500px]:h-[102px] shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={gaugeRadius}
                  fill="transparent"
                  stroke="currentColor"
                  className="text-zinc-200 dark:text-zinc-800"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={gaugeRadius}
                  fill="transparent"
                  stroke={overallColor.stroke}
                  strokeWidth="8"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeDashOffset}
                  strokeLinecap="round"
                  className="transition-[stroke-dashoffset] duration-300 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-2xl min-[400px]:text-3xl min-[500px]:text-4xl font-black text-zinc-900 dark:text-white tracking-tight leading-none tabular-nums">
                  {overallScore}
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 min-[400px]:gap-2 flex-wrap">
                <h2 className="text-sm min-[400px]:text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight truncate">
                  Overall Health
                </h2>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs min-[400px]:text-xs font-bold border shrink-0 ${overallColor.badgeBg} ${overallColor.badgeBorder} ${overallColor.badgeText}`}>
                  Grade {grade}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 min-[400px]:mt-1 leading-snug line-clamp-2">
                {dynamicDescription}
              </p>
            </div>
          </div>

          <div className="border-l border-zinc-200/80 dark:border-zinc-800 pl-2.5 min-[400px]:pl-4 sm:pl-5 shrink-0 space-y-1 sm:space-y-1.5 min-w-[105px] min-[400px]:min-w-[125px] sm:min-w-[145px]">
            <div className="text-2xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 sm:mb-2 whitespace-nowrap">
              {totalRules} CHECKS RUN
            </div>

            <div className="flex items-center justify-between text-xs py-0.5 gap-2">
              <span className="flex items-center gap-1.5 min-[400px]:gap-2 text-zinc-700 dark:text-zinc-300">
                <CheckCircle2 className="w-3 h-3 min-[400px]:w-3.5 min-[400px]:h-3.5 text-emerald-500 shrink-0" />
                <span>Passed</span>
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {passedCount}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-0.5 gap-2">
              <span className="flex items-center gap-1.5 min-[400px]:gap-2 text-zinc-700 dark:text-zinc-300">
                <XCircle className="w-3 h-3 min-[400px]:w-3.5 min-[400px]:h-3.5 text-rose-500 shrink-0" />
                <span>Failed</span>
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                {failedCount}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-0.5 gap-2">
              <span className="flex items-center gap-1.5 min-[400px]:gap-2 text-zinc-700 dark:text-zinc-300">
                <AlertTriangle className="w-3 h-3 min-[400px]:w-3.5 min-[400px]:h-3.5 text-amber-500 shrink-0" />
                <span>Warnings</span>
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {warningCount}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-0.5 gap-2">
              <span className="flex items-center gap-1.5 min-[400px]:gap-2 text-zinc-500 dark:text-zinc-400">
                <Info className="w-3 h-3 min-[400px]:w-3.5 min-[400px]:h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                <span>Info / N/A</span>
              </span>
              <span className="font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">
                {infoStatusCount + naCount}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5 min-[400px]:gap-2">
          {categoriesConfig.map((cat) => {
            const miniRadius = 17.5;
            const miniCircumference = 2 * Math.PI * miniRadius;
            const miniDashOffset = miniCircumference * (1 - Math.min(100, Math.max(0, cat.score)) / 100);

            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => onNavigateToIssues({ category: cat.key })}
                className="rounded-md bg-white dark:bg-zinc-900 px-1 min-[400px]:px-1.5 py-2 min-[400px]:py-2.5 flex flex-col items-center justify-center text-center shadow-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-100 active:scale-[0.97] cursor-pointer"
                title={`View ${cat.label} findings (${cat.score})`}
              >
                <div className="relative w-12 h-12 min-[380px]:w-[52px] min-[380px]:h-[52px] min-[480px]:w-14 min-[480px]:h-14 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 44 44">
                    <circle
                      cx="22"
                      cy="22"
                      r={miniRadius}
                      fill="transparent"
                      stroke="currentColor"
                      className="text-zinc-200 dark:text-zinc-800"
                      strokeWidth="3.5"
                    />
                    <circle
                      cx="22"
                      cy="22"
                      r={miniRadius}
                      fill="transparent"
                      stroke={cat.color}
                      strokeWidth="3.5"
                      strokeDasharray={miniCircumference}
                      strokeDashoffset={miniDashOffset}
                      strokeLinecap="round"
                      className="transition-[stroke-dashoffset] duration-300 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-sm min-[400px]:text-base font-black text-zinc-900 dark:text-white tabular-nums leading-none tracking-tight">
                      {cat.score}
                    </span>
                  </div>
                </div>

                <span className="text-2xs sm:text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-1 sm:mt-1.5 leading-tight line-clamp-2 h-6 flex items-center justify-center text-center px-0.5">
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

      <OptimizationMatrixCard
        findings={findings}
        scores={scores}
        onNavigateToIssues={onNavigateToIssues}
      />

      {techData.length > 0 && (
        <div className="rounded-md bg-white dark:bg-zinc-900 p-3 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#CEFF52]" />
              <span>Detected Technologies &amp; Frameworks</span>
            </span>
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium tabular-nums">
              {techData.length} identified
            </span>
          </div>
          <div
            className={`grid gap-1.5 ${
              techData.length === 1 ? 'grid-cols-1' : 'grid-cols-1 min-[440px]:grid-cols-2'
            }`}
          >
            {techData.map((tech, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-100"
                title={tech.evidence ? `Detected via: ${tech.evidence}` : undefined}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                    {tech.name}
                  </span>
                  {tech.version && (
                    <span className="shrink-0 text-2xs font-medium px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700/60 text-zinc-800 dark:text-zinc-300 tabular-nums">
                      v{tech.version}
                    </span>
                  )}
                </div>
                <span className="text-2xs text-zinc-500 dark:text-zinc-400 truncate shrink-0 ml-1.5">
                  {tech.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <PageVitalsCard inspection={inspection} liveMetrics={liveMetrics} />
    </div>

    <div className="sticky bottom-0 z-30 flex items-center justify-between px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-[#f8f8fa] dark:bg-zinc-950">
      <ExportDropdown inspection={inspection} direction="up" align="left" />

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

