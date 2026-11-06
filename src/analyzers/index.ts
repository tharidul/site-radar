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
 * - Non-passed findings (issues requiring attention) appear FIRST, ordered by severity:
 *   Critical (10-40) -> High (110-140) -> Medium (210-240) -> Low (310-340) -> Info (410-440)
 *   Within each severity: Failed (10) -> Warning (20) -> Not-Available/N/A (30) -> Info (40)
 * - ALL PASSED items appear at the VERY BOTTOM (1010-1050), ordered by severity:
 *   Critical Passed (1010) -> High Passed (1020) -> Medium Passed (1030) -> Low Passed (1040) -> Info Passed (1050)
 */
export function getFindingSortRank(finding: AuditFinding): number {
  const isPassed = finding.status === 'passed';

  // 1. ALL PASSED items MUST be at the bottom, regardless of severity!
  if (isPassed) {
    switch (finding.severity) {
      case 'critical': return 1010;
      case 'high':     return 1020;
      case 'medium':   return 1030;
      case 'low':      return 1040;
      case 'info':
      default:         return 1050;
    }
  }

  // 2. All NON-PASSED items (issues, warnings, missing data):
  // Group primarily by severity: Critical (0) -> High (100) -> Medium (200) -> Low (300) -> Info (400)
  let severityScore = 400;
  switch (finding.severity) {
    case 'critical': severityScore = 0; break;
    case 'high':     severityScore = 100; break;
    case 'medium':   severityScore = 200; break;
    case 'low':      severityScore = 300; break;
    case 'info':
    default:         severityScore = 400; break;
  }

  // Sub-rank by status within severity: Failed is worst, then Warning, then Not-Available / N/A / Info
  let statusScore = 30;
  if (finding.status === 'failed') {
    statusScore = 10;
  } else if (finding.status === 'warning') {
    statusScore = 20;
  } else if (finding.status === 'not-available' || finding.status === 'not-applicable' || finding.status === 'error') {
    statusScore = 30;
  } else if (finding.status === 'info') {
    statusScore = 40;
  }

  return severityScore + statusScore;
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
