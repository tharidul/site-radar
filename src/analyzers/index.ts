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
 * - Failed issues on TOP: Critical (10) -> High (20) -> Medium (30) -> Low (40)
 * - Warnings next: Critical (50) -> High (60) -> Medium (70) -> Low (80)
 * - Info (100)
 * - N/A & Not Available (110)
 * - Passed items at the BOTTOM: Critical (210) -> High (220) -> Medium (230) -> Low (240) -> Info (250)
 */
export function getFindingSortRank(finding: AuditFinding): number {
  const isFailed = finding.status === 'failed';
  const isWarning = finding.status === 'warning';
  const isPassed = finding.status === 'passed';

  if (isFailed) {
    switch (finding.severity) {
      case 'critical': return 10;
      case 'high': return 20;
      case 'medium': return 30;
      case 'low': return 40;
      default: return 45;
    }
  }

  if (isWarning) {
    switch (finding.severity) {
      case 'critical': return 50;
      case 'high': return 60;
      case 'medium': return 70;
      case 'low': return 80;
      default: return 85;
    }
  }

  if (finding.status === 'info' || finding.severity === 'info') {
    return 100;
  }

  if (finding.status === 'not-applicable' || finding.status === 'not-available' || finding.status === 'error') {
    return 110;
  }

  if (isPassed) {
    switch (finding.severity) {
      case 'critical': return 210;
      case 'high': return 220;
      case 'medium': return 230;
      case 'low': return 240;
      default: return 250;
    }
  }

  return 300;
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
