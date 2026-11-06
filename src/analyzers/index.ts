/**
 * @file src/analyzers/index.ts
 * @description Central export, priority sorter, and composite runner for all category analyzers.
 */

import type { AuditFinding } from '../types/inspection';
import type { Analyzer, AnalyzerContext } from './types';
import { SecurityAnalyzer } from './security.analyzer';
import { PerformanceAnalyzer } from './performance.analyzer';
import { SeoAnalyzer } from './seo.analyzer';
import { AccessibilityAnalyzer } from './accessibility.analyzer';
import { PrivacyAnalyzer } from './privacy.analyzer';
import { TechnologyAnalyzer } from './technology.analyzer';
import { FormsAnalyzer } from './forms.analyzer';
import { ResponsiveAnalyzer } from './responsive.analyzer';

export * from './types';
export * from './rule-catalog';
export * from './finding-builder';
export * from './security.analyzer';
export * from './performance.analyzer';
export * from './seo.analyzer';
export * from './accessibility.analyzer';
export * from './privacy.analyzer';
export * from './technology.analyzer';
export * from './forms.analyzer';
export * from './responsive.analyzer';

export const ALL_ANALYZERS: Analyzer[] = [
  new SecurityAnalyzer(),
  new PerformanceAnalyzer(),
  new SeoAnalyzer(),
  new AccessibilityAnalyzer(),
  new PrivacyAnalyzer(),
  new TechnologyAnalyzer(),
  new FormsAnalyzer(),
  new ResponsiveAnalyzer(),
];

export const CATEGORY_PRIORITY: Record<string, number> = {
  security: 1,
  performance: 2,
  accessibility: 3,
  seo: 4,
  'best-practices': 5,
};

/**
 * Priority rank calculation:
 * - TIER 1: ACTIVE ISSUES (failed, warning) appear FIRST, ordered strictly by severity:
 *   Critical Failed (0) -> Critical Warning (5) -> High Failed (10) -> High Warning (15) ->
 *   Medium Failed (20) -> Medium Warning (25) -> Low Failed (30) -> Low Warning (35) -> Info (40-45)
 * - TIER 2: NON-ISSUES (passed, not-applicable, not-available, info) appear at the BOTTOM (1000+),
 *   also ordered strictly by severity so Critical/High are NEVER below Low/Info:
 *   Critical Passed/NA (1000-1004) -> High Passed/NA (1100-1104) -> Medium Passed/NA (1200-1204) ->
 *   Low Passed/NA (1300-1304) -> Info Passed/NA (1400-1404)
 */
export function getFindingSortRank(finding: AuditFinding): number {
  const isFailed = finding.status === 'failed';
  const isWarning = finding.status === 'warning';
  const isIssue = isFailed || isWarning;

  // Severity base rank: Critical = 0, High = 10, Medium = 20, Low = 30, Info = 40
  let severityRank = 40;
  switch (finding.severity) {
    case 'critical':
      severityRank = 0;
      break;
    case 'high':
      severityRank = 10;
      break;
    case 'medium':
      severityRank = 20;
      break;
    case 'low':
      severityRank = 30;
      break;
    case 'info':
    default:
      severityRank = 40;
      break;
  }

  // TIER 1: ACTIVE ISSUES (failed and warning)
  // These ALWAYS appear at the very top of the list!
  if (isIssue) {
    // Within the same severity: failed (0) comes before warning (5)
    const statusOffset = isFailed ? 0 : 5;
    return severityRank + statusOffset; // Range: 0 to 45
  }

  // TIER 2: NON-ISSUES (passed, not-applicable, not-available, info)
  // These ALWAYS appear below active issues (starting at 1000).
  // Strictly ordered by severity: Critical (1000) -> High (1100) -> Medium (1200) -> Low (1300) -> Info (1400)
  // Within the same severity: Passed (0) -> Info (2) -> Not-Applicable / Not-Available (4)
  let nonIssueStatusOffset = 4;
  if (finding.status === 'passed') {
    nonIssueStatusOffset = 0;
  } else if (finding.status === 'info') {
    nonIssueStatusOffset = 2;
  } else {
    // 'not-applicable', 'not-available', 'error', etc.
    nonIssueStatusOffset = 4;
  }

  return 1000 + (severityRank * 10) + nonIssueStatusOffset;
}

export function sortFindingsByPriority(findings: AuditFinding[]): AuditFinding[] {
  return [...findings].sort((a, b) => {
    const rankA = getFindingSortRank(a);
    const rankB = getFindingSortRank(b);
    if (rankA !== rankB) {
      return rankA - rankB;
    }

    const catA = CATEGORY_PRIORITY[a.category?.toLowerCase()] ?? 99;
    const catB = CATEGORY_PRIORITY[b.category?.toLowerCase()] ?? 99;
    if (catA !== catB) {
      return catA - catB;
    }

    return (a.title || '').localeCompare(b.title || '');
  });
}

export async function runAllAnalyzers(context: AnalyzerContext): Promise<AuditFinding[]> {
  const allFindings: AuditFinding[] = [];

  for (const analyzer of ALL_ANALYZERS) {
    try {
      const findings = await analyzer.analyze(context);
      allFindings.push(...findings);
    } catch (err: any) {
      // Isolate individual analyzer failures so one analyzer doesn't crash the pipeline
      console.warn(`Analyzer ${analyzer.id} failed:`, err);
    }
  }

  return sortFindingsByPriority(allFindings);
}
