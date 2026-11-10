
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

export function getFindingSortRank(finding: AuditFinding): number {
  const isFailed = finding.status === 'failed';
  const isWarning = finding.status === 'warning';
  const isIssue = isFailed || isWarning;

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

  if (isIssue) {
    const statusOffset = isFailed ? 0 : 5;
    return severityRank + statusOffset;
  }

  let nonIssueStatusOffset = 4;
  if (finding.status === 'passed') {
    nonIssueStatusOffset = 0;
  } else if (finding.status === 'info') {
    nonIssueStatusOffset = 2;
  } else {
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
      console.warn(`Analyzer ${analyzer.id} failed:`, err);
    }
  }

  return sortFindingsByPriority(allFindings);
}
