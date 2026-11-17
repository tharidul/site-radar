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

  it('does not penalize category score for unobservable properties, recording telemetryCoverageIndex instead', () => {
    const findings: AuditFinding[] = [
      makeFinding({ id: 's1', category: 'security', ruleId: 'sec-https-enforced', status: 'passed', severity: 'critical' }),
      ...Array.from({ length: 9 }, (_, i) =>
        makeFinding({ id: `u-${i}`, category: 'security', ruleId: `sec-unavail-${i}`, status: 'not-available' }),
      ),
    ];

    const result = calculateCategoryScore('security', findings);
    expect(result.totalChecks).toBe(1);
    expect(result.coveragePercent).toBe(10);
    expect(result.telemetryCoverageIndex).toBe(10);
    expect(result.score).toBe(100);
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

describe('calculateCategoryScore - Canonical Deduplication', () => {
  it('deduplicates a11y-axe-image-alt and a11y-missing-alt to a single canonical rule', () => {
    const findings: AuditFinding[] = [
      makeFinding({
        id: '1',
        category: 'accessibility',
        ruleId: 'a11y-axe-image-alt',
        severity: 'high',
        status: 'failed',
        violationPressure: 0.2,
      }),
      makeFinding({
        id: '2',
        category: 'accessibility',
        ruleId: 'a11y-missing-alt',
        severity: 'high',
        status: 'failed',
      }),
      makeFinding({
        id: '3',
        category: 'accessibility',
        ruleId: 'a11y-valid-aria',
        severity: 'medium',
        status: 'passed',
      }),
    ];

    const result = calculateCategoryScore('accessibility', findings);
    // 3 findings input, but 2 share canonical key 'a11y-image-alt-canonical' -> total evaluated checks = 2
    expect(result.totalChecks).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.passed).toBe(1);
    // Deduplication should retain the finding with violationPressure
    expect(result.deductionsExplanation?.length).toBe(1);
  });

  it('deduplicates a11y-axe-html-has-lang and a11y-missing-lang to a single canonical rule', () => {
    const findings: AuditFinding[] = [
      makeFinding({
        id: '1',
        category: 'accessibility',
        ruleId: 'a11y-axe-html-has-lang',
        severity: 'high',
        status: 'failed',
      }),
      makeFinding({
        id: '2',
        category: 'accessibility',
        ruleId: 'a11y-missing-lang',
        severity: 'high',
        status: 'failed',
      }),
    ];

    const result = calculateCategoryScore('accessibility', findings);
    expect(result.totalChecks).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('deduplicates a11y-axe-landmark-one-main, a11y-missing-landmarks, and a11y-axe-region to a single canonical rule', () => {
    const findings: AuditFinding[] = [
      makeFinding({
        id: '1',
        category: 'accessibility',
        ruleId: 'a11y-axe-landmark-one-main',
        severity: 'medium',
        status: 'failed',
      }),
      makeFinding({
        id: '2',
        category: 'accessibility',
        ruleId: 'a11y-missing-landmarks',
        severity: 'medium',
        status: 'failed',
      }),
      makeFinding({
        id: '3',
        category: 'accessibility',
        ruleId: 'a11y-axe-region',
        severity: 'medium',
        status: 'failed',
      }),
    ];

    const result = calculateCategoryScore('accessibility', findings);
    expect(result.totalChecks).toBe(1);
    expect(result.failed).toBe(1);
  });
});

describe('calculateCategoryScore - Critical Failure Isolation and Cap', () => {
  it('never sets hasCriticalFailure or criticalCapTriggered for isolated image-alt critical failures', () => {
    const findings: AuditFinding[] = [
      makeFinding({
        id: '1',
        category: 'accessibility',
        ruleId: 'a11y-missing-alt',
        severity: 'critical',
        status: 'failed',
        blastTier: 'decorative',
        blastWeight: 0.25,
        violationPressure: 0.15,
      }),
      makeFinding({
        id: '2',
        category: 'accessibility',
        ruleId: 'a11y-valid-aria',
        severity: 'medium',
        status: 'passed',
      }),
    ];

    const result = calculateCategoryScore('accessibility', findings);
    expect(result.hasCriticalFailure).toBe(false);
    expect(result.criticalCapTriggered).toBe(false);
    // Score should not be capped at 49, mild pressure leaves high score
    expect(result.score).toBeGreaterThan(80);
  });

  it('never sets hasCriticalFailure or criticalCapTriggered for color-contrast critical failures', () => {
    const findings: AuditFinding[] = [
      makeFinding({
        id: '1',
        category: 'accessibility',
        ruleId: 'a11y-axe-color-contrast',
        severity: 'critical',
        status: 'failed',
        violationPressure: 0.20,
      }),
      makeFinding({
        id: '2',
        category: 'accessibility',
        ruleId: 'a11y-valid-aria',
        severity: 'medium',
        status: 'passed',
      }),
    ];

    const result = calculateCategoryScore('accessibility', findings);
    expect(result.hasCriticalFailure).toBe(false);
    expect(result.criticalCapTriggered).toBe(false);
    expect(result.score).toBeGreaterThan(70);
  });

  it('sets hasCriticalFailure and triggers criticalCapTriggered (capped at 49) on true critical flow defect with Pr >= 0.8', () => {
    const findings: AuditFinding[] = [
      makeFinding({
        id: '1',
        category: 'security',
        ruleId: 'sec-payment-form-tampering',
        severity: 'critical',
        status: 'failed',
        blastTier: 'critical_flow',
        blastWeight: 3.0,
        violationPressure: 0.85,
      }),
      makeFinding({
        id: '2',
        category: 'security',
        ruleId: 'sec-https-enforced',
        severity: 'high',
        status: 'passed',
      }),
      makeFinding({
        id: '3',
        category: 'security',
        ruleId: 'sec-tls-modern',
        severity: 'medium',
        status: 'passed',
      }),
    ];

    const result = calculateCategoryScore('security', findings);
    expect(result.hasCriticalFailure).toBe(true);
    expect(result.criticalCapTriggered).toBe(true);
    expect(result.score).toBeLessThanOrEqual(49);
    expect(result.deductionsExplanation?.some((d) => d.includes('Critical failure override applied'))).toBe(true);
  });

  it('sets hasCriticalFailure but does NOT trigger criticalCapTriggered when Pr < 0.8', () => {
    const findings: AuditFinding[] = [
      makeFinding({
        id: '1',
        category: 'security',
        ruleId: 'sec-checkout-auth-leak',
        severity: 'critical',
        status: 'failed',
        blastTier: 'critical_flow',
        blastWeight: 3.0,
        violationPressure: 0.30,
      }),
      makeFinding({
        id: '2',
        category: 'security',
        ruleId: 'sec-https-enforced',
        severity: 'high',
        status: 'passed',
      }),
      makeFinding({
        id: '3',
        category: 'security',
        ruleId: 'sec-tls-modern',
        severity: 'medium',
        status: 'passed',
      }),
    ];

    const result = calculateCategoryScore('security', findings);
    expect(result.hasCriticalFailure).toBe(true);
    expect(result.criticalCapTriggered).toBe(false);
    expect(result.score).toBeGreaterThan(49);
  });

  it('never sets hasCriticalFailure when realityState is not TRUE_DEFECT or undefined', () => {
    const findings: AuditFinding[] = [
      makeFinding({
        id: '1',
        category: 'security',
        ruleId: 'sec-payment-csrf',
        severity: 'critical',
        status: 'failed',
        realityState: 'SYNTHETIC_NOISE',
        blastTier: 'critical_flow',
        blastWeight: 3.0,
        violationPressure: 0.95,
      }),
      makeFinding({
        id: '2',
        category: 'security',
        ruleId: 'sec-https-enforced',
        severity: 'high',
        status: 'passed',
      }),
    ];

    const result = calculateCategoryScore('security', findings);
    expect(result.hasCriticalFailure).toBe(false);
    expect(result.criticalCapTriggered).toBe(false);
  });
});

describe('calculateCategoryScore - Direct Violation Pressure & Scope Denominator', () => {
  it('uses finding.violationPressure directly for Pr', () => {
    const findings: AuditFinding[] = [
      makeFinding({
        id: '1',
        category: 'accessibility',
        ruleId: 'a11y-button-name',
        severity: 'high',
        status: 'failed',
        violationPressure: 0.25,
      }),
    ];

    const result = calculateCategoryScore('accessibility', findings);
    expect(findings[0]?.violationPressure).toBe(0.25);
    // Base weight is 15. Deduction is 15 * 1.0 * 0.25 = 3.75, so score is ~75
    expect(result.score).toBe(75);
  });

  it('correctly processes findings with universeDenominator and weightedDensity', () => {
    const finding = makeFinding({
      id: '1',
      category: 'accessibility',
      ruleId: 'a11y-focus-visible',
      severity: 'medium',
      status: 'failed',
      weightedDensity: 0.05,
      evidence: [
        {
          label: 'Universe Scope',
          value: '2 affected of 40 (5.0%)',
          source: 'test',
          observedAt: Date.now(),
        },
      ],
    });

    const result = calculateCategoryScore('accessibility', [finding]);
    expect(finding.violationPressure).toBeDefined();
    expect(finding.violationPressure).toBeLessThan(0.5);
    // Score should reflect mild pressure
    expect(result.score).toBeGreaterThan(50);
  });
});
