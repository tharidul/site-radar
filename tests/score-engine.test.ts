import { describe, it, expect } from 'vitest';
import { calculateCategoryScore, calculateInspectionScores } from '../src/scoring/score-engine';
import type { AuditFinding } from '../src/types/inspection';

function makeFinding(overrides: Partial<AuditFinding> & { id: string; ruleId: string }): AuditFinding {
  return {
    category: 'security',
    title: overrides.ruleId,
    description: '',
    severity: 'medium',
    status: 'not-available',
    expectedBehavior: '',
    explanation: '',
    recommendation: '',
    evidence: [],
    source: 'TestCollector',
    references: [],
    ...overrides,
  };
}

describe('calculateCategoryScore - axe severity weights', () => {
  it('correctly scales deduction points based on axe violation severity', () => {
    const findings: AuditFinding[] = [
      {
        id: '1',
        category: 'accessibility',
        ruleId: 'a11y-axe-image-redundant-alt',
        title: 'axe: image-redundant-alt',
        description: 'Image alt redundant',
        severity: 'low',
        status: 'failed',
        confidence: 1.0,
        expectedBehavior: '',
        explanation: '',
        recommendation: '',
        evidence: [],
        source: 'AxeCoreCollector',
        references: [],
      },
      {
        id: '2',
        category: 'accessibility',
        ruleId: 'a11y-axe-region',
        title: 'axe: region',
        description: 'Landmarks missing',
        severity: 'medium',
        status: 'failed',
        confidence: 1.0,
        expectedBehavior: '',
        explanation: '',
        recommendation: '',
        evidence: [],
        source: 'AxeCoreCollector',
        references: [],
      },
      {
        id: '3',
        category: 'accessibility',
        ruleId: 'a11y-missing-alt',
        title: 'Image Accessible Name Alternatives',
        description: 'Passed',
        severity: 'high',
        status: 'passed',
        confidence: 1.0,
        expectedBehavior: '',
        explanation: '',
        recommendation: '',
        evidence: [],
        source: 'MediaCollector',
        references: [],
      },
    ];

    const result = calculateCategoryScore('accessibility', findings);
    expect(result.failed).toBe(2);
    expect(result.passed).toBe(1);

    // Verify low severity axe check deducts 3 points, not 12
    const lowDeduction = result.deductionsExplanation?.find((d) => d.includes('image-redundant-alt'));
    expect(lowDeduction).toContain('-3 pts');

    // Verify medium severity axe check deducts 8 points, not 12
    const medDeduction = result.deductionsExplanation?.find((d) => d.includes('region'));
    expect(medDeduction).toContain('-8 pts');
  });
});

describe('calculateCategoryScore - unobservable / 0 evaluated checks (INFO-01)', () => {
  it('returns score 0 instead of 75 when all category checks are not-available or error', () => {
    const findings: AuditFinding[] = [
      makeFinding({ id: 's1', category: 'security', ruleId: 'sec-hsts', status: 'not-available', severity: 'high' }),
      makeFinding({ id: 's2', category: 'security', ruleId: 'sec-csp', status: 'error', severity: 'high' }),
      makeFinding({ id: 's3', category: 'security', ruleId: 'sec-xfo', status: 'not-available', severity: 'medium' }),
    ];

    const result = calculateCategoryScore('security', findings);

    expect(result.score).toBe(0);
    expect(result.totalChecks).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.warnings).toBe(0);
    expect(result.unavailable).toBe(3);
    expect(result.coveragePercent).toBe(0);
    expect(result.deductionsExplanation?.length).toBeGreaterThan(0);
    expect(result.deductionsExplanation?.[0]).toContain('0% scan coverage');
  });

  it('returns score 0 when a category has no findings or only not-applicable/info findings', () => {
    const emptyResult = calculateCategoryScore('performance', []);
    expect(emptyResult.score).toBe(0);
    expect(emptyResult.totalChecks).toBe(0);
    expect(emptyResult.coveragePercent).toBe(0);
    expect(emptyResult.deductionsExplanation?.[0]).toContain('No applicable checks evaluated');

    const nonEvaluatedOnly = calculateCategoryScore('performance', [
      makeFinding({ id: 'p1', category: 'performance', ruleId: 'perf-info', status: 'info', severity: 'info' }),
      makeFinding({ id: 'p2', category: 'performance', ruleId: 'perf-na', status: 'not-applicable', severity: 'low' }),
    ]);
    expect(nonEvaluatedOnly.score).toBe(0);
    expect(nonEvaluatedOnly.totalChecks).toBe(0);
    expect(nonEvaluatedOnly.notApplicableCount).toBe(1);
    expect(nonEvaluatedOnly.coveragePercent).toBe(0);
  });

  it('retains coverage ceiling behavior when at least one check is evaluated with partial coverage', () => {
    const findings: AuditFinding[] = [
      makeFinding({ id: 's1', category: 'security', ruleId: 'sec-https-enforced', status: 'passed', severity: 'critical' }),
      ...Array.from({ length: 9 }, (_, i) =>
        makeFinding({ id: `u-${i}`, category: 'security', ruleId: `sec-unavail-${i}`, status: 'not-available' }),
      ),
    ];

    const result = calculateCategoryScore('security', findings);
    expect(result.totalChecks).toBe(1);
    expect(result.coveragePercent).toBe(10);
    expect(result.score).toBe(Math.round(75 + 25 * 0.1));
  });

  it('computes overallScore 0 in calculateInspectionScores when all categories have 0 evaluated checks', () => {
    const findings: AuditFinding[] = [
      makeFinding({ id: '1', category: 'security', ruleId: 'sec-1', status: 'not-available' }),
      makeFinding({ id: '2', category: 'performance', ruleId: 'perf-1', status: 'error' }),
    ];

    const result = calculateInspectionScores(findings);
    expect(result.overallScore).toBe(0);
    expect(result.totalChecksEvaluated).toBe(0);
    expect(result.scores.security?.score).toBe(0);
    expect(result.scores.performance?.score).toBe(0);
    expect(result.scores.seo?.score).toBe(0);
    expect(result.scores.accessibility?.score).toBe(0);
  });
});
