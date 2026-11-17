import { describe, it, expect, beforeEach } from 'vitest';
import { formsCollector } from '../src/collectors/page/forms.collector';
import { surfaceCapabilityPolicy } from '../src/corroborator/policies/surface-capability.policy';
import type { AuditFinding, WebsiteTarget } from '../src/types/inspection';
import type { CorroborationContext } from '../src/corroborator/types';

function createMockTarget(overrides: Partial<WebsiteTarget> = {}): WebsiteTarget {
  return {
    url: 'https://example.com',
    origin: 'https://example.com',
    hostname: 'example.com',
    inspectedAt: Date.now(),
    ...overrides,
  };
}

function createMockFinding(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    id: 'test-finding',
    category: 'security',
    ruleId: 'sec-missing-csp',
    title: 'Missing CSP',
    description: 'No Content Security Policy header found.',
    severity: 'high',
    status: 'failed',
    evidence: [],
    source: 'headers',
    realityState: 'TRUE_DEFECT',
    realityMultiplier: 1.0,
    ...overrides,
  };
}

describe('FormsCollector - Visibility & Dormant Modal Forms', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects visible password fields and visible POST forms on standard login page', () => {
    document.body.innerHTML = `
      <form id="login-form" action="/login" method="POST">
        <input type="text" name="username" id="user" />
        <input type="password" name="password" id="pass" />
        <button type="submit">Sign In</button>
      </form>
    `;

    const result = formsCollector.collect({
      document,
      window,
      url: 'https://example.com/login',
    });

    expect(result.data).toBeDefined();
    expect(result.data?.hasVisiblePasswordField).toBe(true);
    expect(result.data?.hasHiddenPasswordField).toBe(false);
    expect(result.data?.hasVisiblePostForm).toBe(true);
    expect(result.data?.hasHiddenPostForm).toBe(false);
    expect(result.data?.dormantModalFormsCount).toBe(0);
  });

  it('detects hidden password fields and hidden POST forms inside dormant modals', () => {
    document.body.innerHTML = `
      <header>
        <a href="/login">Sign In</a>
      </header>
      <main>
        <h1>Product Catalog</h1>
      </main>
      <div id="dormant-auth-modal" class="modal modal-hidden" aria-hidden="true" style="display: none;">
        <form id="popup-login" action="/auth/login" method="POST">
          <input type="email" name="email" />
          <input type="password" name="password" />
          <button type="submit">Log In</button>
        </form>
      </div>
    `;

    const result = formsCollector.collect({
      document,
      window,
      url: 'https://example.com/item/1005001.html?aff_platform=default&albbt=1',
    });

    expect(result.data).toBeDefined();
    expect(result.data?.hasVisiblePasswordField).toBe(false);
    expect(result.data?.hasHiddenPasswordField).toBe(true);
    expect(result.data?.hasVisiblePostForm).toBe(false);
    expect(result.data?.hasHiddenPostForm).toBe(true);
    expect(result.data?.dormantModalFormsCount).toBe(1);
  });

  it('detects dormant closed dialog containing password input', () => {
    document.body.innerHTML = `
      <dialog id="login-dialog">
        <form method="POST" action="/session">
          <input type="password" name="pwd" />
        </form>
      </dialog>
    `;

    const result = formsCollector.collect({
      document,
      window,
      url: 'https://example.com',
    });

    expect(result.data?.hasVisiblePasswordField).toBe(false);
    expect(result.data?.hasHiddenPasswordField).toBe(true);
    expect(result.data?.hasVisiblePostForm).toBe(false);
    expect(result.data?.hasHiddenPostForm).toBe(true);
    expect(result.data?.dormantModalFormsCount).toBe(1);
  });
});

describe('SurfaceCapabilityPolicy - PUBLIC_CATALOG Refinement', () => {
  it('covers all 5 target security rules in appliesTo', () => {
    const rules = [
      'sec-missing-csp',
      'sec-missing-x-frame-options',
      'sec-missing-hsts',
      'sec-missing-referrer-policy',
      'sec-missing-x-content-type-options',
    ];

    for (const ruleId of rules) {
      expect(surfaceCapabilityPolicy.appliesTo(createMockFinding({ ruleId }))).toBe(true);
    }

    expect(surfaceCapabilityPolicy.appliesTo(createMockFinding({ ruleId: 'sec-other' }))).toBe(false);
  });

  it('classifies surface as PUBLIC_CATALOG when isolated subdomains exist and password fields are dormant', () => {
    const target = createMockTarget({
      url: 'https://www.aliexpress.com/item/100500600.html?aff_platform=true&albbt=1&utm_source=adwords',
      origin: 'https://www.aliexpress.com',
      hostname: 'www.aliexpress.com',
    });

    const context: CorroborationContext = {
      target,
      modules: {
        forms: {
          module: 'forms',
          status: 'completed',
          collectedAt: Date.now(),
          data: {
            formCount: 1,
            forms: [
              {
                action: 'https://login.aliexpress.com/login',
                method: 'POST',
                fieldCount: 2,
                fieldTypes: ['text', 'password'],
                hasPasswordField: true,
                isSecureAction: true,
                isVisible: false,
              },
            ],
            containsUnencryptedSubmissions: false,
            hasPasswordForms: true,
            hasVisiblePasswordField: false,
            hasHiddenPasswordField: true,
            hasVisiblePostForm: false,
            hasHiddenPostForm: true,
            dormantModalFormsCount: 1,
            isolatedCheckoutOrigins: ['login.aliexpress.com'],
          },
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          limitations: [],
          errors: [],
          sources: ['DOM:form'],
        },
      },
    };

    const csp = surfaceCapabilityPolicy.corroborate(
      createMockFinding({ ruleId: 'sec-missing-csp' }),
      context
    );
    expect(csp.realityState).toBe('ARCHITECTURAL_PATTERN');
    expect(csp.realityMultiplier).toBe(0.1);
    expect(csp.explanation).toBe(
      'Public multi-merchant catalog aggregating affiliate tags and dynamic merchant assets; strict CSP isolated to dedicated origin(s): login.aliexpress.com.'
    );

    const xfo = surfaceCapabilityPolicy.corroborate(
      createMockFinding({ ruleId: 'sec-missing-x-frame-options' }),
      context
    );
    expect(xfo.realityState).toBe('ARCHITECTURAL_PATTERN');
    expect(xfo.realityMultiplier).toBe(0.1);
    expect(xfo.explanation).toBe(
      'Public showcase catalog supporting syndicated partner previews and affiliate marketing widgets; clickjacking defense isolated to checkout/auth.'
    );

    const hsts = surfaceCapabilityPolicy.corroborate(
      createMockFinding({ ruleId: 'sec-missing-hsts' }),
      context
    );
    expect(hsts.realityState).toBe('ARCHITECTURAL_PATTERN');
    expect(hsts.realityMultiplier).toBe(0.1);
    expect(hsts.explanation).toBe(
      'Public CDN edge-cached storefront with transport TLS; HSTS policy preserved on dedicated origin(s): login.aliexpress.com.'
    );

    const referrer = surfaceCapabilityPolicy.corroborate(
      createMockFinding({ ruleId: 'sec-missing-referrer-policy' }),
      context
    );
    expect(referrer.realityState).toBe('SYNTHETIC_NOISE');
    expect(referrer.realityMultiplier).toBe(0.05);
    expect(referrer.explanation).toBe(
      'Modern browser natively enforces strict-origin-when-cross-origin default; omission does not leak path/query strings cross-origin.'
    );

    const xcto = surfaceCapabilityPolicy.corroborate(
      createMockFinding({ ruleId: 'sec-missing-x-content-type-options' }),
      context
    );
    expect(xcto.realityState).toBe('ARCHITECTURAL_PATTERN');
    expect(xcto.realityMultiplier).toBe(0.1);
    expect(xcto.explanation).toBe(
      'Static public HTML catalog delivery; media/upload endpoints segregated to dedicated origin(s): login.aliexpress.com.'
    );
  });

  it('keeps TRUE_DEFECT with 1.0 multiplier when active visible password field exists', () => {
    const target = createMockTarget({
      url: 'https://example.com/?aff_platform=true',
    });

    const context: CorroborationContext = {
      target,
      modules: {
        forms: {
          module: 'forms',
          status: 'completed',
          collectedAt: Date.now(),
          data: {
            hasVisiblePasswordField: true,
            hasHiddenPasswordField: false,
            hasVisiblePostForm: true,
          },
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          limitations: [],
          errors: [],
          sources: ['DOM:form'],
        },
      },
    };

    const csp = surfaceCapabilityPolicy.corroborate(
      createMockFinding({ ruleId: 'sec-missing-csp' }),
      context
    );
    expect(csp.realityState).toBe('TRUE_DEFECT');
    expect(csp.realityMultiplier).toBe(1.0);
  });

  it('keeps TRUE_DEFECT with 1.0 multiplier when payment iframe exists', () => {
    const target = createMockTarget({
      url: 'https://example.com/checkout?utm_source=ad',
    });

    const context: CorroborationContext = {
      target,
      modules: {
        dom: {
          module: 'dom',
          status: 'completed',
          collectedAt: Date.now(),
          data: {
            hasPaymentIframe: true,
          },
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          limitations: [],
          errors: [],
          sources: ['DOM'],
        },
      },
    };

    const xfo = surfaceCapabilityPolicy.corroborate(
      createMockFinding({ ruleId: 'sec-missing-x-frame-options' }),
      context
    );
    expect(xfo.realityState).toBe('TRUE_DEFECT');
    expect(xfo.realityMultiplier).toBe(1.0);
  });

  it('keeps TRUE_DEFECT for single-origin monolithic sites without isolated subdomains', () => {
    const target = createMockTarget({
      url: 'https://pcbuilders.lk/',
      origin: 'https://pcbuilders.lk',
      hostname: 'pcbuilders.lk',
    });

    const context: CorroborationContext = {
      target,
      modules: {
        forms: {
          module: 'forms',
          status: 'completed',
          collectedAt: Date.now(),
          data: {
            hasVisiblePasswordField: false,
            hasHiddenPasswordField: false,
            hasVisiblePostForm: false,
            isolatedCheckoutOrigins: [],
          },
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          limitations: [],
          errors: [],
          sources: ['DOM:form'],
        },
        links: {
          module: 'links',
          status: 'completed',
          collectedAt: Date.now(),
          data: {
            totalLinks: 20,
            externalLinks: [{ url: 'https://facebook.com/pcbuilders' }],
            isolatedCheckoutOrigins: [],
          },
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          limitations: [],
          errors: [],
          sources: ['DOM:a'],
        },
      },
    };

    const csp = surfaceCapabilityPolicy.corroborate(createMockFinding({ ruleId: 'sec-missing-csp' }), context);
    expect(csp.realityState).toBe('TRUE_DEFECT');
    expect(csp.realityMultiplier).toBe(1.0);

    const xfo = surfaceCapabilityPolicy.corroborate(createMockFinding({ ruleId: 'sec-missing-x-frame-options' }), context);
    expect(xfo.realityState).toBe('TRUE_DEFECT');
    expect(xfo.realityMultiplier).toBe(1.0);

    const hsts = surfaceCapabilityPolicy.corroborate(createMockFinding({ ruleId: 'sec-missing-hsts' }), context);
    expect(hsts.realityState).toBe('TRUE_DEFECT');
    expect(hsts.realityMultiplier).toBe(1.0);

    const xcto = surfaceCapabilityPolicy.corroborate(createMockFinding({ ruleId: 'sec-missing-x-content-type-options' }), context);
    expect(xcto.realityState).toBe('TRUE_DEFECT');
    expect(xcto.realityMultiplier).toBe(1.0);

    const ref = surfaceCapabilityPolicy.corroborate(createMockFinding({ ruleId: 'sec-missing-referrer-policy' }), context);
    expect(ref.realityState).toBe('SYNTHETIC_NOISE');
    expect(ref.realityMultiplier).toBe(0.05);
  });
});
