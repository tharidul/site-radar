/**
 * @file src/analyzers/index.ts
 * @description Central export and composite runner for all category analyzers.
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

  return allFindings;
}
