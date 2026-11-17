import { describe, it, expect } from 'vitest';
import { CorroborationEngine } from '../src/corroborator/corroborator-engine';
import {
  UniversalScopePolicy,
  universalScopePolicy,
  resolveTargetScope,
  resolveUniverseDenominator,
  computeViolationPressure,
} from '../src/corroborator/policies/universal-scope.policy';
import { calculateCategoryScore } from '../src/scoring/score-engine';
import type { AuditFinding, WebsiteTarget } from '../src/types/inspection';
import type { CorroborationContext } from '../src/corroborator/types';

function createMockTarget(overrides: Partial<WebsiteTarget> = {}): WebsiteTarget {
  return {
    url: 'https://example.com/shop',
    origin: 'https://example.com',
    hostname: 'example.com',
    inspectedAt: Date.now(),
    isLocalDevelopment: false,
    ...overrides,
  };
}

function createMockFinding(
  overrides: Partial<AuditFinding> & { id: string; ruleId: string }
): AuditFinding {
  return {
    category: 'accessibility',
    title: overrides.ruleId,
    description: 'Mock finding description',
    severity: 'medium',
    status: 'failed',
    evidence: [],
    source: 'TestCollector',
    references: [],
    ...overrides,
  };
}

describe('UniversalScopePolicy', () => {
  it('has correct policy metadata (policyId and priority 25)', () => {
    expect(universalScopePolicy.policyId).toBe('universal-scope-policy');
    expect(universalScopePolicy.priority).toBe(25);
  });

  describe('resolveTargetScope', () => {
    it('correctly maps axe-core and native rules to scopes', () => {
      expect(resolveTargetScope(createMockFinding({ id: '1', ruleId: 'a11y-axe-image-alt' }))).toBe('images');
      expect(resolveTargetScope(createMockFinding({ id: '2', ruleId: 'a11y-axe-color-contrast' }))).toBe('text_nodes');
      expect(resolveTargetScope(createMockFinding({ id: '3', ruleId: 'a11y-axe-label-content-name-mismatch' }))).toBe('interactive');
      expect(resolveTargetScope(createMockFinding({ id: '4', ruleId: 'a11y-axe-region' }))).toBe('landmarks');
      expect(resolveTargetScope(createMockFinding({ id: '5', ruleId: 'a11y-axe-landmark-one-main' }))).toBe('landmarks');
      expect(resolveTargetScope(createMockFinding({ id: '6', ruleId: 'a11y-axe-link-name' }))).toBe('interactive');
      expect(resolveTargetScope(createMockFinding({ id: '7', ruleId: 'a11y-axe-button-name' }))).toBe('interactive');
      expect(resolveTargetScope(createMockFinding({ id: '8', ruleId: 'a11y-axe-label' }))).toBe('forms');
      expect(resolveTargetScope(createMockFinding({ id: '9', ruleId: 'a11y-axe-html-has-lang' }))).toBe('page');
      expect(resolveTargetScope(createMockFinding({ id: '10', ruleId: 'a11y-axe-duplicate-id' }))).toBe('dom_elements');
    });

    it('honors explicitly specified targetScope on finding', () => {
      const finding = createMockFinding({
        id: 'custom-scope',
        ruleId: 'custom-rule',
        targetScope: 'interactive',
      });
      expect(resolveTargetScope(finding)).toBe('interactive');
    });
  });

  describe('resolveUniverseDenominator', () => {
    const context: CorroborationContext = {
      target: createMockTarget(),
      modules: {
        media: {
          module: 'media',
          status: 'completed',
          collectedAt: Date.now(),
          data: { totalImages: 286 },
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          limitations: [],
          errors: [],
          sources: ['DOM:img'],
        },
        dom: {
          module: 'dom',
          status: 'completed',
          collectedAt: Date.now(),
          data: {
            elementCount: 1250,
            nativeButtonsCount: 18,
            interactiveElementsCount: 6,
            landmarkElements: [{ tag: 'header' }, { tag: 'nav' }, { tag: 'main' }, { tag: 'footer' }],
            hasMainLandmark: true,
          },
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          limitations: [],
          errors: [],
          sources: ['DOM'],
        },
        links: {
          module: 'links',
          status: 'completed',
          collectedAt: Date.now(),
          data: { totalLinks: 42 },
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          limitations: [],
          errors: [],
          sources: ['DOM:a'],
        },
        forms: {
          module: 'forms',
          status: 'completed',
          collectedAt: Date.now(),
          data: { totalInputCount: 14, formCount: 2 },
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          limitations: [],
          errors: [],
          sources: ['DOM:form'],
        },
      },
    };

    it('resolves denominator for images scope', () => {
      expect(resolveUniverseDenominator('images', context, 2)).toBe(286);
    });

    it('resolves denominator for interactive scope (nativeButtons + interactiveElements + links)', () => {
      // 18 nativeButtons + 6 interactiveElements + 42 links = 66
      expect(resolveUniverseDenominator('interactive', context, 3)).toBe(66);
    });

    it('resolves denominator for forms scope', () => {
      expect(resolveUniverseDenominator('forms', context, 1)).toBe(14);
    });

    it('resolves denominator for landmarks scope', () => {
      expect(resolveUniverseDenominator('landmarks', context, 1)).toBe(4);
    });

    it('resolves denominator for text_nodes / dom_elements scope', () => {
      expect(resolveUniverseDenominator('text_nodes', context, 5)).toBe(1250);
      expect(resolveUniverseDenominator('dom_elements', context, 10)).toBe(1250);
    });

    it('resolves denominator for page scope', () => {
      expect(resolveUniverseDenominator('page', context, 1)).toBe(1);
    });

    it('falls back to Math.max(affected, 1) when modules are empty', () => {
      const emptyContext: CorroborationContext = {
        target: createMockTarget(),
        modules: {},
      };
      expect(resolveUniverseDenominator('images', emptyContext, 4)).toBe(4);
      expect(resolveUniverseDenominator('interactive', emptyContext, 0)).toBe(1);
    });
  });

  describe('computeViolationPressure', () => {
    it('computes expected non-linear pressure curve', () => {
      // Zero affected -> 0 pressure
      expect(computeViolationPressure(0, 0.25, 0)).toBe(0);

      // Low density decorative image violation: 2 of 286 (~0.007 density, 0.25 weight, 2 affected)
      const pDecorative = computeViolationPressure(2 / 286, 0.25, 2);
      expect(pDecorative).toBeGreaterThan(0.04);
      expect(pDecorative).toBeLessThan(0.15);

      // High density critical violation: 10 of 10 (1.0 density, 3.0 weight, 10 affected)
      const pCritical = computeViolationPressure(1.0, 3.0, 10);
      expect(pCritical).toBe(1.0);
    });
  });

  describe('Policy Execution & Engine Integration', () => {
    it('corroborates axe-core image alt finding and resolves universe density and pressure', () => {
      const finding = createMockFinding({
        id: 'axe-img-1',
        ruleId: 'a11y-axe-image-alt',
        severity: 'critical',
        status: 'failed',
        evidence: [
          { label: 'Violation ID', value: 'image-alt', source: 'axe', observedAt: Date.now() },
          { label: 'Impact', value: 'critical', source: 'axe', observedAt: Date.now() },
          { label: 'Nodes Affected', value: 2, source: 'axe', observedAt: Date.now() },
        ],
      });

      const context: CorroborationContext = {
        target: createMockTarget(),
        modules: {
          media: {
            module: 'media',
            status: 'completed',
            collectedAt: Date.now(),
            data: { totalImages: 286 },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['DOM:img'],
          },
        },
      };

      const engine = new CorroborationEngine([universalScopePolicy]);
      const results = engine.corroborate([finding], context);

      expect(results).toHaveLength(1);
      const corroborated = results[0]!;

      expect(corroborated.targetScope).toBe('images');
      expect(corroborated.universeDenominator).toBe(286);
      expect(corroborated.weightedDensity).toBeCloseTo(2 / 286, 4);
      expect(corroborated.blastTier).toBe('decorative');
      expect(corroborated.blastWeight).toBe(0.25);
      expect(corroborated.violationPressure).toBeDefined();
      expect(corroborated.violationPressure).toBeLessThan(0.15);

      const scopeEvidence = corroborated.evidence.find((e) => e.label === 'Universe Scope');
      expect(scopeEvidence).toBeDefined();
      expect(scopeEvidence?.value).toBe('2 affected of 286 (0.7%)');

      expect(corroborated.corroborationTraces).toHaveLength(1);
      expect(corroborated.corroborationTraces?.[0]?.policyId).toBe('universal-scope-policy');
    });

    it('enables score > 95 in calculateCategoryScore for 2 missing alts on 286 images without false 49 cap', () => {
      const finding = createMockFinding({
        id: 'axe-img-2',
        ruleId: 'a11y-axe-image-alt',
        severity: 'critical',
        status: 'failed',
        evidence: [
          { label: 'Violation ID', value: 'image-alt', source: 'axe', observedAt: Date.now() },
          { label: 'Nodes Affected', value: 2, source: 'axe', observedAt: Date.now() },
        ],
      });

      const context: CorroborationContext = {
        target: createMockTarget(),
        modules: {
          media: {
            module: 'media',
            status: 'completed',
            collectedAt: Date.now(),
            data: { totalImages: 286 },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['DOM:img'],
          },
        },
      };

      const engine = new CorroborationEngine([universalScopePolicy]);
      const [corroborated] = engine.corroborate([finding], context);

      const passedHeadingFinding = createMockFinding({
        id: 'heading-order',
        ruleId: 'a11y-heading-order',
        status: 'passed',
        severity: 'medium',
      });

      const passedAriaFinding = createMockFinding({
        id: 'valid-aria',
        ruleId: 'a11y-valid-aria',
        status: 'passed',
        severity: 'high',
      });

      const scoreResult = calculateCategoryScore('accessibility', [corroborated!, passedHeadingFinding, passedAriaFinding]);

      expect(scoreResult.score).toBeGreaterThan(95);
      expect(scoreResult.criticalCapTriggered).toBeFalsy();
    });

    it('corroborates interactive and form rules correctly', () => {
      const buttonFinding = createMockFinding({
        id: 'btn-1',
        ruleId: 'a11y-axe-button-name',
        severity: 'high',
        status: 'failed',
        evidence: [{ label: 'Nodes Affected', value: 1, source: 'axe', observedAt: Date.now() }],
      });

      const formFinding = createMockFinding({
        id: 'form-1',
        ruleId: 'a11y-axe-label',
        severity: 'high',
        status: 'failed',
        evidence: [{ label: 'Nodes Affected', value: 2, source: 'axe', observedAt: Date.now() }],
      });

      const context: CorroborationContext = {
        target: createMockTarget(),
        modules: {
          dom: {
            module: 'dom',
            status: 'completed',
            collectedAt: Date.now(),
            data: { nativeButtonsCount: 20, nonSemanticClickableCount: 5 },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['DOM'],
          },
          forms: {
            module: 'forms',
            status: 'completed',
            collectedAt: Date.now(),
            data: { totalInputCount: 10 },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: ['DOM:form'],
          },
        },
      };

      const engine = new CorroborationEngine([universalScopePolicy]);
      const [corroboratedBtn, corroboratedForm] = engine.corroborate([buttonFinding, formFinding], context);

      expect(corroboratedBtn?.targetScope).toBe('interactive');
      expect(corroboratedBtn?.universeDenominator).toBe(25);
      expect(corroboratedBtn?.weightedDensity).toBeCloseTo(1 / 25, 4);

      expect(corroboratedForm?.targetScope).toBe('forms');
      expect(corroboratedForm?.universeDenominator).toBe(10);
      expect(corroboratedForm?.weightedDensity).toBeCloseTo(2 / 10, 4);
    });

    it('skips a11y-axe-evaluation summary finding', () => {
      const summaryFinding = createMockFinding({
        id: 'axe-eval',
        ruleId: 'a11y-axe-evaluation',
        severity: 'info',
        status: 'failed',
      });

      expect(universalScopePolicy.appliesTo(summaryFinding)).toBe(false);
    });
  });
});
