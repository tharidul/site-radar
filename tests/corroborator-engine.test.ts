import { describe, it, expect } from 'vitest';
import { CorroborationEngine } from '../src/corroborator/corroborator-engine';
import {
  canonicalSemanticsPolicy,
  assetMutabilityPolicy,
  surfaceCapabilityPolicy,
  cwvRealityGatePolicy,
  observabilityBarrierPolicy,
  ALL_CORROBORATION_POLICIES,
} from '../src/corroborator/policies';
import { calculateCategoryScore, calculateInspectionScores } from '../src/scoring/score-engine';
import type { AuditFinding, WebsiteTarget } from '../src/types/inspection';
import type { CorroborationContext } from '../src/corroborator/types';

function createMockTarget(overrides: Partial<WebsiteTarget> = {}): WebsiteTarget {
  return {
    url: 'https://example.com/products/catalog',
    origin: 'https://example.com',
    hostname: 'example.com',
    inspectedAt: Date.now(),
    isLocalDevelopment: false,
    ...overrides,
  };
}

function createMockFinding(overrides: Partial<AuditFinding> & { id: string; ruleId: string }): AuditFinding {
  return {
    category: 'security',
    title: overrides.ruleId,
    description: 'Test finding description',
    severity: 'medium',
    status: 'failed',
    evidence: [],
    source: 'TestCollector',
    references: [],
    ...overrides,
  };
}

describe('CorroborationEngine & Policies', () => {
  describe('Canonical Query Consolidation (CanonicalSemanticsPolicy)', () => {
    it('reclassifies page URL with ad/campaign query parameters vs canonical root to ARCHITECTURAL_PATTERN and passed', () => {
      const corroborator = new CorroborationEngine([canonicalSemanticsPolicy]);
      const target = createMockTarget({
        url: 'https://example.com/shoes?acnt=paid_search&gclid=12345xyz&utm_source=google',
        origin: 'https://example.com',
        hostname: 'example.com',
      });

      const finding = createMockFinding({
        id: 'seo-canonical-1',
        category: 'seo',
        ruleId: 'seo-canonical-matches',
        status: 'failed',
        severity: 'high',
        evidence: [
          {
            label: 'Declared Canonical URL',
            value: 'https://example.com/shoes',
            source: 'metadata',
            observedAt: Date.now(),
          },
        ],
      });

      const context: CorroborationContext = {
        target,
        modules: {},
      };

      const results = corroborator.corroborate([finding], context);
      expect(results).toHaveLength(1);
      const corroborated = results[0];

      expect(corroborated.realityState).toBe('ARCHITECTURAL_PATTERN');
      expect(corroborated.realityMultiplier).toBe(0.0);
      expect(corroborated.status).toBe('passed');
      expect(corroborated.corroborationTraces).toHaveLength(1);
      expect(corroborated.corroborationTraces?.[0].policyId).toBe('canonical-semantics-policy');
      expect(corroborated.corroborationTraces?.[0].nextState).toBe('ARCHITECTURAL_PATTERN');
    });

    it('does not reclassify when canonical URL points to completely different domain or path without query consolidation', () => {
      const corroborator = new CorroborationEngine([canonicalSemanticsPolicy]);
      const target = createMockTarget({
        url: 'https://example.com/shoes',
        origin: 'https://example.com',
        hostname: 'example.com',
      });

      const finding = createMockFinding({
        id: 'seo-canonical-2',
        category: 'seo',
        ruleId: 'seo-canonical-matches',
        status: 'failed',
        severity: 'high',
        evidence: [
          {
            label: 'Declared Canonical URL',
            value: 'https://anotherdomain.com/shoes',
            source: 'metadata',
            observedAt: Date.now(),
          },
        ],
      });

      const results = corroborator.corroborate([finding], { target, modules: {} });
      expect(results[0].realityState).toBe('TRUE_DEFECT');
      expect(results[0].status).toBe('failed');
      expect(results[0].realityMultiplier).toBe(1.0);
    });
  });

  describe('Asset Mutability Policy (AssetMutabilityPolicy)', () => {
    it('reclassifies dynamic tracking / tag scripts missing SRI to ARCHITECTURAL_PATTERN and passed', () => {
      const corroborator = new CorroborationEngine([assetMutabilityPolicy]);
      const target = createMockTarget({
        url: 'https://example.com',
        origin: 'https://example.com',
        hostname: 'example.com',
      });

      const finding = createMockFinding({
        id: 'sec-sri-1',
        category: 'security',
        ruleId: 'sec-missing-sri-scripts',
        status: 'failed',
        severity: 'medium',
      });

      const context: CorroborationContext = {
        target,
        modules: {
          scripts: {
            module: 'scripts',
            status: 'completed',
            collectedAt: Date.now(),
            data: {
              scripts: [
                {
                  src: 'https://www.googletagmanager.com/gtm.js?id=GTM-TEST',
                  isInline: false,
                  hasSri: false,
                },
                {
                  src: 'https://connect.facebook.net/en_US/fbevents.js',
                  isInline: false,
                  hasSri: false,
                },
                {
                  src: 'https://js.stripe.com/v3/',
                  isInline: false,
                  hasSri: false,
                },
              ],
            },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['DOM:script'],
          },
        },
      };

      const results = corroborator.corroborate([finding], context);
      expect(results[0].realityState).toBe('ARCHITECTURAL_PATTERN');
      expect(results[0].realityMultiplier).toBe(0.0);
      expect(results[0].status).toBe('passed');
      expect(results[0].corroborationTraces?.[0].policyId).toBe('asset-mutability-policy');
    });

    it('keeps TRUE_DEFECT when external immutable CDN libraries like cdnjs or unpkg miss SRI', () => {
      const corroborator = new CorroborationEngine([assetMutabilityPolicy]);
      const target = createMockTarget({
        url: 'https://example.com',
        origin: 'https://example.com',
        hostname: 'example.com',
      });

      const finding = createMockFinding({
        id: 'sec-sri-2',
        category: 'security',
        ruleId: 'sec-missing-sri-scripts',
        status: 'failed',
        severity: 'medium',
      });

      const context: CorroborationContext = {
        target,
        modules: {
          scripts: {
            module: 'scripts',
            status: 'completed',
            collectedAt: Date.now(),
            data: {
              scripts: [
                {
                  src: 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
                  isInline: false,
                  hasSri: false,
                },
              ],
            },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['DOM:script'],
          },
        },
      };

      const results = corroborator.corroborate([finding], context);
      expect(results[0].realityState).toBe('TRUE_DEFECT');
      expect(results[0].realityMultiplier).toBe(1.0);
      expect(results[0].status).toBe('failed');
    });
  });

  describe('Surface Capability Policy (SurfaceCapabilityPolicy)', () => {
    it('reclassifies read-only public catalog missing CSP/XFO to ARCHITECTURAL_PATTERN with 0.1 multiplier', () => {
      const corroborator = new CorroborationEngine([surfaceCapabilityPolicy]);
      const target = createMockTarget({
        url: 'https://example.com/catalog',
        origin: 'https://example.com',
        hostname: 'example.com',
      });

      const cspFinding = createMockFinding({
        id: 'sec-csp-1',
        category: 'security',
        ruleId: 'sec-missing-csp',
        status: 'failed',
        severity: 'high',
      });

      const xfoFinding = createMockFinding({
        id: 'sec-xfo-1',
        category: 'security',
        ruleId: 'sec-missing-x-frame-options',
        status: 'failed',
        severity: 'medium',
      });

      const context: CorroborationContext = {
        target,
        modules: {
          forms: {
            module: 'forms',
            status: 'completed',
            collectedAt: Date.now(),
            data: {
              forms: [{ action: '/search', method: 'GET', hasPasswordField: false }],
              hasPasswordForms: false,
            },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['DOM:form'],
          },
          dom: {
            module: 'dom',
            status: 'completed',
            collectedAt: Date.now(),
            data: {
              hasPasswordInput: false,
              hasPaymentIframe: false,
            },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['DOM'],
          },
        },
      };

      const results = corroborator.corroborate([cspFinding, xfoFinding], context);

      expect(results[0].realityState).toBe('ARCHITECTURAL_PATTERN');
      expect(results[0].realityMultiplier).toBe(0.1);
      expect(results[0].corroborationTraces?.[0].policyId).toBe('surface-capability-policy');

      expect(results[1].realityState).toBe('ARCHITECTURAL_PATTERN');
      expect(results[1].realityMultiplier).toBe(0.1);
      expect(results[1].corroborationTraces?.[0].policyId).toBe('surface-capability-policy');
    });

    it('keeps TRUE_DEFECT with 1.0 multiplier when password or payment inputs are present', () => {
      const corroborator = new CorroborationEngine([surfaceCapabilityPolicy]);
      const target = createMockTarget();
      const cspFinding = createMockFinding({
        id: 'sec-csp-2',
        category: 'security',
        ruleId: 'sec-missing-csp',
        status: 'failed',
        severity: 'high',
      });

      const context: CorroborationContext = {
        target,
        modules: {
          forms: {
            module: 'forms',
            status: 'completed',
            collectedAt: Date.now(),
            data: {
              forms: [{ action: '/login', method: 'POST', hasPasswordField: true }],
              hasPasswordForms: true,
            },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['DOM:form'],
          },
        },
      };

      const results = corroborator.corroborate([cspFinding], context);
      expect(results[0].realityState).toBe('TRUE_DEFECT');
      expect(results[0].realityMultiplier).toBe(1.0);
    });
  });

  describe('CWV Reality Gate Policy (CwvRealityGatePolicy)', () => {
    it('downgrades render-blocking warning to SYNTHETIC_NOISE (0.05 multiplier) when FCP is 708ms and LCP is 2108ms', () => {
      const corroborator = new CorroborationEngine([cwvRealityGatePolicy]);
      const target = createMockTarget();

      const finding = createMockFinding({
        id: 'perf-render-1',
        category: 'performance',
        ruleId: 'perf-render-blocking-resources',
        status: 'warning',
        severity: 'medium',
      });

      const context: CorroborationContext = {
        target,
        modules: {
          performance: {
            module: 'performance',
            status: 'completed',
            collectedAt: Date.now(),
            data: {
              paintTiming: { fcpMs: 708 },
              webVitals: { lcpMs: 2108 },
            },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['PerformanceTiming'],
          },
        },
      };

      const results = corroborator.corroborate([finding], context);
      expect(results[0].realityState).toBe('SYNTHETIC_NOISE');
      expect(results[0].realityMultiplier).toBe(0.05);
      expect(results[0].corroborationTraces?.[0].policyId).toBe('cwv-reality-gate-policy');
    });

    it('keeps TRUE_DEFECT when CWV metrics are poor (e.g. FCP > 1000ms or LCP > 2500ms)', () => {
      const corroborator = new CorroborationEngine([cwvRealityGatePolicy]);
      const target = createMockTarget();

      const finding = createMockFinding({
        id: 'perf-render-2',
        category: 'performance',
        ruleId: 'perf-render-blocking-resources',
        status: 'warning',
        severity: 'medium',
      });

      const context: CorroborationContext = {
        target,
        modules: {
          performance: {
            module: 'performance',
            status: 'completed',
            collectedAt: Date.now(),
            data: {
              paintTiming: { fcpMs: 1450 },
              webVitals: { lcpMs: 3800 },
            },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['PerformanceTiming'],
          },
        },
      };

      const results = corroborator.corroborate([finding], context);
      expect(results[0].realityState).toBe('TRUE_DEFECT');
      expect(results[0].realityMultiplier).toBe(1.0);
    });
  });

  describe('Observability Barrier Policy (ObservabilityBarrierPolicy)', () => {
    it('classifies blocked consent or unobservable findings as OBSERVABILITY_LIMIT with 0.0 multiplier', () => {
      const corroborator = new CorroborationEngine([observabilityBarrierPolicy]);
      const target = createMockTarget();

      const findingBlocked = createMockFinding({
        id: 'sec-dns-consent',
        category: 'security',
        ruleId: 'sec-dns-lookup',
        status: 'blocked' as any,
        evidence: [
          {
            label: 'Consent Status',
            value: 'Blocked pending external intelligence consent',
            source: 'ConsentManager',
            observedAt: Date.now(),
          },
        ],
      });

      const findingNotAvailable = createMockFinding({
        id: 'perf-unobservable',
        category: 'performance',
        ruleId: 'perf-advanced-metric',
        status: 'not-available',
      });

      const results = corroborator.corroborate([findingBlocked, findingNotAvailable], {
        target,
        modules: {},
      });

      expect(results[0].realityState).toBe('OBSERVABILITY_LIMIT');
      expect(results[0].realityMultiplier).toBe(0.0);
      expect(results[0].corroborationTraces?.[0].policyId).toBe('observability-barrier-policy');

      expect(results[1].realityState).toBe('OBSERVABILITY_LIMIT');
      expect(results[1].realityMultiplier).toBe(0.0);
      expect(results[1].corroborationTraces?.[0].policyId).toBe('observability-barrier-policy');
    });
  });

  describe('Default CorroborationEngine & Multi-Policy Pipeline', () => {
    it('initializes default CorroborationEngine with ALL_CORROBORATION_POLICIES sorted by priority', () => {
      const corroborator = new CorroborationEngine();
      const policies = corroborator.getPolicies();
      expect(policies.length).toBe(ALL_CORROBORATION_POLICIES.length);

      // Verify ascending priority order
      for (let i = 1; i < policies.length; i++) {
        expect(policies[i].priority).toBeGreaterThanOrEqual(policies[i - 1].priority);
      }
    });

    it('processes mixed findings through multiple policies', () => {
      const corroborator = new CorroborationEngine();
      const target = createMockTarget({
        url: 'https://example.com/items?gclid=ad123',
      });

      const findings: AuditFinding[] = [
        createMockFinding({
          id: '1',
          ruleId: 'seo-canonical-matches',
          category: 'seo',
          status: 'failed',
          evidence: [{ label: 'Declared Canonical URL', value: 'https://example.com/items' }],
        }),
        createMockFinding({
          id: '2',
          ruleId: 'sec-missing-csp',
          category: 'security',
          status: 'failed',
        }),
        createMockFinding({
          id: '3',
          ruleId: 'perf-render-blocking-resources',
          category: 'performance',
          status: 'warning',
        }),
      ];

      const context: CorroborationContext = {
        target,
        modules: {
          forms: {
            module: 'forms',
            status: 'completed',
            collectedAt: Date.now(),
            data: { hasPasswordForms: false, forms: [] },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['DOM:form'],
          },
          performance: {
            module: 'performance',
            status: 'completed',
            collectedAt: Date.now(),
            data: { paintTiming: { fcpMs: 650 }, webVitals: { lcpMs: 1800 } },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['PerformanceTiming'],
          },
        },
      };

      const corroborated = corroborator.corroborate(findings, context);
      expect(corroborated[0].realityState).toBe('ARCHITECTURAL_PATTERN');
      expect(corroborated[0].status).toBe('passed');

      expect(corroborated[1].realityState).toBe('ARCHITECTURAL_PATTERN');
      expect(corroborated[1].realityMultiplier).toBe(0.1);

      expect(corroborated[2].realityState).toBe('SYNTHETIC_NOISE');
      expect(corroborated[2].realityMultiplier).toBe(0.05);
    });
  });

  describe('Density-Based Scoring & Blast Tier Integration', () => {
    it('produces score > 95 (not 27 or 49) when 2 out of 286 images miss alt text', () => {
      const findings: AuditFinding[] = [
        createMockFinding({
          id: 'a11y-img-alt',
          category: 'accessibility',
          ruleId: 'a11y-missing-alt',
          title: 'Image Alt Attribute Missing',
          severity: 'critical',
          status: 'failed',
          blastTier: 'decorative',
          blastWeight: 0.25,
          evidence: [
            { label: 'Images Missing Alt', value: 2 },
            { label: 'Total Images Evaluated', value: 286 },
          ],
        }),
        createMockFinding({
          id: 'a11y-aria-1',
          category: 'accessibility',
          ruleId: 'a11y-valid-aria',
          title: 'Valid ARIA Attributes',
          severity: 'high',
          status: 'passed',
        }),
        createMockFinding({
          id: 'a11y-headings-1',
          category: 'accessibility',
          ruleId: 'a11y-heading-order',
          title: 'Sequential Heading Structure',
          severity: 'medium',
          status: 'passed',
        }),
      ];

      const scoreResult = calculateCategoryScore('accessibility', findings);

      // Verify that 2 missing alts out of 286 produces a mild deduction, not a catastrophic 49 cap or 27 score
      expect(scoreResult.score).toBeGreaterThan(95);
      expect(scoreResult.criticalCapTriggered).toBeFalsy();
      expect(scoreResult.realityCounts?.TRUE_DEFECT).toBe(1);
    });

    it('correctly reports realityCounts and telemetryCoverageIndex in calculateCategoryScore', () => {
      const findings: AuditFinding[] = [
        createMockFinding({
          id: '1',
          category: 'security',
          ruleId: 'sec-arch-pattern',
          realityState: 'ARCHITECTURAL_PATTERN',
          realityMultiplier: 0.0,
          status: 'passed',
        }),
        createMockFinding({
          id: '2',
          category: 'security',
          ruleId: 'sec-true-defect',
          realityState: 'TRUE_DEFECT',
          realityMultiplier: 1.0,
          status: 'failed',
          severity: 'medium',
        }),
        createMockFinding({
          id: '3',
          category: 'security',
          ruleId: 'sec-observability',
          realityState: 'OBSERVABILITY_LIMIT',
          realityMultiplier: 0.0,
          status: 'not-available',
        }),
        createMockFinding({
          id: '4',
          category: 'security',
          ruleId: 'sec-noise',
          realityState: 'SYNTHETIC_NOISE',
          realityMultiplier: 0.05,
          status: 'warning',
          severity: 'low',
        }),
      ];

      const scoreResult = calculateCategoryScore('security', findings);

      expect(scoreResult.realityCounts).toBeDefined();
      expect(scoreResult.realityCounts?.ARCHITECTURAL_PATTERN).toBe(1);
      expect(scoreResult.realityCounts?.TRUE_DEFECT).toBe(1);
      expect(scoreResult.realityCounts?.OBSERVABILITY_LIMIT).toBe(1);
      expect(scoreResult.realityCounts?.SYNTHETIC_NOISE).toBe(1);

      // TCI: evaluated checks = 3 (ARCHITECTURAL_PATTERN, TRUE_DEFECT, SYNTHETIC_NOISE) / 4 applicable
      expect(scoreResult.telemetryCoverageIndex).toBeDefined();
      expect(scoreResult.telemetryCoverageIndex).toBe(75);
    });
  });
});
