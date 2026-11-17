// @vitest-environment node

import { describe, it, expect } from 'vitest';
import {
  CALIBRATION_CASES,
  cleanBaselineCase,
  criticalCheckoutFailCase,
  decorativeAltFailCase,
  architecturalPatternCase,
  taoOpaqueLimitCase,
  fastSyntheticCssCase,
} from './fixtures/calibration/cases';
import {
  auditCalibrationCase,
  compareCaseResults,
  computeCalibrationMetrics,
  findMatchingFinding,
} from '../scripts/calibrate-engine';

describe('Calibration Engine Harness & Invariants Test Suite', () => {
  describe('Fixture 01: Clean Baseline Invariants', () => {
    it('achieves a perfect 100/100 overall score with zero deductions across all categories', async () => {
      const result = await auditCalibrationCase(cleanBaselineCase);

      expect(result.overallScore).toBe(100);
      expect(result.scores['security']?.score).toBe(100);
      expect(result.scores['performance']?.score).toBe(100);
      expect(result.scores['seo']?.score).toBe(100);
      expect(result.scores['accessibility']?.score).toBe(100);
      expect(result.scores['best-practices']?.score).toBe(100);

      // Telemetry Coverage Index must be 100%
      expect(result.telemetryCoverageIndex).toBe(100);

      // Must have zero failed findings and zero TRUE_DEFECT reality states
      const failedFindings = result.findings.filter((f) => f.status === 'failed');
      expect(failedFindings).toHaveLength(0);
      expect(result.realityCounts.TRUE_DEFECT).toBe(0);
    });

    it('emits all expected baseline compliance checks with passed status', async () => {
      const result = await auditCalibrationCase(cleanBaselineCase);

      for (const ef of cleanBaselineCase.expectedFindings) {
        const found = findMatchingFinding(result.findings, ef.ruleId);
        expect(found).toBeDefined();
        expect(found?.status).toBe('passed');
      }
    });
  });

  describe('Fixture 02: Critical Checkout Failure Invariants', () => {
    it('corroborates high-blast security flaws to TRUE_DEFECT and caps security score at <= 49', async () => {
      const result = await auditCalibrationCase(criticalCheckoutFailCase);

      const secScore = result.scores['security'];
      expect(secScore).toBeDefined();
      expect(secScore!.score).toBeLessThanOrEqual(49);
      expect(secScore!.criticalCapTriggered).toBe(true);
      expect(secScore!.deductionsExplanation?.some((d) => d.includes('Critical failure override'))).toBe(true);

      // Verify insecure form action
      const formActionFinding = findMatchingFinding(result.findings, 'sec-insecure-form-action');
      expect(formActionFinding).toBeDefined();
      expect(formActionFinding!.status).toBe('failed');
      expect(formActionFinding!.severity).toBe('critical');
      expect(formActionFinding!.realityState).toBe('TRUE_DEFECT');

      // Verify password over HTTP
      const passwordFinding = findMatchingFinding(result.findings, 'sec-password-over-http');
      expect(passwordFinding).toBeDefined();
      expect(passwordFinding!.status).toBe('failed');
      expect(passwordFinding!.severity).toBe('critical');
      expect(passwordFinding!.realityState).toBe('TRUE_DEFECT');

      // Verify unlabeled button
      const buttonFinding = findMatchingFinding(result.findings, 'a11y-axe-button-name');
      expect(buttonFinding).toBeDefined();
      expect(buttonFinding!.status).toBe('failed');
      expect(buttonFinding!.realityState).toBe('TRUE_DEFECT');
    });

    it('causes severe score impact on checkout flow while isolating unaffected categories', async () => {
      const result = await auditCalibrationCase(criticalCheckoutFailCase);

      // Security is severely degraded
      expect(result.scores['security']!.score).toBeLessThanOrEqual(49);

      // Accessibility is degraded by unlabeled purchase button
      expect(result.scores['accessibility']!.score).toBeLessThanOrEqual(70);

      // Overall score is pulled down
      expect(result.overallScore).toBeLessThan(80);
    });
  });

  describe('Fixture 03: Decorative Alt Low Blast Radius Invariants', () => {
    it('resolves 2/300 missing thumbnail alts to decorative blast tier with <= 3 point deduction', async () => {
      const result = await auditCalibrationCase(decorativeAltFailCase);

      const a11yScore = result.scores['accessibility'];
      expect(a11yScore).toBeDefined();

      // Invariant: Missing 2 out of 300 thumbnail alts must not trigger a catastrophic drop
      expect(a11yScore!.score).toBeGreaterThanOrEqual(95);
      expect(a11yScore!.criticalCapTriggered).toBeFalsy();

      // Find the axe image-alt finding and verify blast tier resolution
      const imgFinding = result.findings.find(
        (f) => f.ruleId === 'a11y-axe-image-alt' || f.ruleId === 'a11y-missing-alt',
      );
      expect(imgFinding).toBeDefined();
      expect(imgFinding?.blastTier).toBe('decorative');
      expect(imgFinding?.blastWeight).toBe(0.25);
      expect(imgFinding?.weightedDensity).toBeLessThan(0.01);
      expect(imgFinding?.violationPressure).toBeLessThan(0.10);
    });

    it('strictly satisfies blast radius stability without false critical failure alarm', async () => {
      const result = await auditCalibrationCase(decorativeAltFailCase);
      const comparison = compareCaseResults(decorativeAltFailCase, result);

      expect(comparison.blastRadiusStable).toBe(true);
      expect(comparison.realityCounts.TRUE_DEFECT).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Fixture 04: Architectural Pattern Invariants', () => {
    it('corroborates Stripe without SRI and canonical query stripping to ARCHITECTURAL_PATTERN with 0.0 multiplier', async () => {
      const result = await auditCalibrationCase(architecturalPatternCase);

      // Stripe & GTM scripts without SRI must corroborate to ARCHITECTURAL_PATTERN
      const sriFinding = findMatchingFinding(result.findings, 'sec-missing-sri-scripts');
      expect(sriFinding).toBeDefined();
      expect(sriFinding!.realityState).toBe('ARCHITECTURAL_PATTERN');
      expect(sriFinding!.realityMultiplier).toBe(0.0);
      expect(sriFinding!.status).toBe('passed');

      // Canonical URL stripping utm_source, gclid must corroborate to ARCHITECTURAL_PATTERN
      const canonicalFinding = findMatchingFinding(result.findings, 'seo-canonical-matches');
      expect(canonicalFinding).toBeDefined();
      expect(canonicalFinding!.realityState).toBe('ARCHITECTURAL_PATTERN');
      expect(canonicalFinding!.realityMultiplier).toBe(0.0);
      expect(canonicalFinding!.status).toBe('passed');

      // Security and SEO scores must not be penalized by architectural patterns
      expect(result.scores['security']?.score).toBe(100);
      expect(result.scores['seo']?.score).toBe(100);
    });
  });

  describe('Fixture 05: Timing-Allow-Origin & Opaque Limit Invariants', () => {
    it('corroborates unobservable assets to OBSERVABILITY_LIMIT and deducts from TCI without penalizing score', async () => {
      const result = await auditCalibrationCase(taoOpaqueLimitCase);

      // Performance score must remain 100 (zero penalty for opaque third-party limits)
      expect(result.scores['performance']?.score).toBe(100);

      // Telemetry Coverage Index must be reduced (< 100%) due to unobservable metrics
      const perfTci = result.scores['performance']?.telemetryCoverageIndex;
      expect(perfTci).toBeDefined();
      expect(perfTci!).toBeLessThan(100);
      expect(perfTci!).toBeGreaterThanOrEqual(50);

      // Verify OBSERVABILITY_LIMIT reality count
      expect(result.realityCounts.OBSERVABILITY_LIMIT).toBeGreaterThan(0);

      // Opaque resource finding must have multiplier 0.0
      const opaqueFinding = findMatchingFinding(result.findings, 'perf-opaque-resources');
      expect(opaqueFinding).toBeDefined();
      expect(opaqueFinding!.realityState).toBe('OBSERVABILITY_LIMIT');
      expect(opaqueFinding!.realityMultiplier).toBe(0.0);
      expect(opaqueFinding!.status).toBe('not-available');
    });
  });

  describe('Fixture 06: Fast Synthetic Render-Blocking CSS Invariants', () => {
    it('downgrades render-blocking warning to SYNTHETIC_NOISE (multiplier 0.05) when CWV metrics confirm fast paint', async () => {
      const result = await auditCalibrationCase(fastSyntheticCssCase);

      // Performance score must remain >= 98
      expect(result.scores['performance']?.score).toBeGreaterThanOrEqual(98);

      // Render blocking finding must be downgraded to SYNTHETIC_NOISE
      const rbFinding = findMatchingFinding(result.findings, 'perf-render-blocking-resources');
      expect(rbFinding).toBeDefined();
      expect(rbFinding!.realityState).toBe('SYNTHETIC_NOISE');
      expect(rbFinding!.realityMultiplier).toBe(0.05);
      expect(rbFinding!.corroborationTraces?.some((t) => t.policyId === 'cwv-reality-gate-policy')).toBe(true);
    });
  });

  describe('Full Testbed Calibration Performance & Metrics Stability', () => {
    it('maintains >= 90% precision, recall, reality accuracy, and 100% blast radius stability across all fixtures', async () => {
      const comparisons = [];
      for (const caseDef of CALIBRATION_CASES) {
        const actual = await auditCalibrationCase(caseDef);
        const comp = compareCaseResults(caseDef, actual);
        comparisons.push(comp);
      }

      const metrics = computeCalibrationMetrics(comparisons);

      expect(metrics.totalCases).toBe(6);
      expect(metrics.precision).toBeGreaterThanOrEqual(0.90);
      expect(metrics.recall).toBeGreaterThanOrEqual(0.90);
      expect(metrics.f1Score).toBeGreaterThanOrEqual(0.90);
      expect(metrics.realityClassificationAccuracy).toBeGreaterThanOrEqual(0.90);
      expect(metrics.blastRadiusStability).toBe(1.0);
      expect(metrics.criticalDiscrepancies).toBe(0);
    });

    it('executes repeat runs with deterministic idempotency (zero score or finding drift)', async () => {
      const run1 = await auditCalibrationCase(cleanBaselineCase);
      const run2 = await auditCalibrationCase(cleanBaselineCase);

      expect(run1.overallScore).toBe(run2.overallScore);
      expect(run1.findings.length).toBe(run2.findings.length);

      const run1Checkout = await auditCalibrationCase(criticalCheckoutFailCase);
      const run2Checkout = await auditCalibrationCase(criticalCheckoutFailCase);

      expect(run1Checkout.overallScore).toBe(run2Checkout.overallScore);
      expect(run1Checkout.scores['security']?.score).toBe(run2Checkout.scores['security']?.score);
      expect(run1Checkout.findings.length).toBe(run2Checkout.findings.length);
    });
  });
});
