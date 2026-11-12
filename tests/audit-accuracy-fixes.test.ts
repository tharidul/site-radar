import { describe, it, expect, afterEach, vi } from 'vitest';
import { getBrowserAdapter, setBrowserAdapter } from '../src/browser/adapters';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';
import { canonicalUrlsMatch } from '../src/utils/canonical';
import { SeoAnalyzer } from '../src/analyzers/seo.analyzer';
import { AccessibilityAnalyzer } from '../src/analyzers/accessibility.analyzer';
import { FormsCollector } from '../src/collectors/page/forms.collector';
import { InspectionOrchestrator } from '../src/core/orchestrator/inspection-orchestrator';

describe('Audit accuracy & Chrome detection fixes', () => {
  const originalBrowser = (globalThis as any).browser;
  const originalChrome = (globalThis as any).chrome;

  afterEach(() => {
    setBrowserAdapter(null);
    (globalThis as any).browser = originalBrowser;
    (globalThis as any).chrome = originalChrome;
    vi.restoreAllMocks();
  });

  it('selects ChromeMV3Adapter when WXT browser polyfill is present in Chrome', () => {
    (globalThis as any).browser = {
      runtime: {
        id: 'chrome-ext-id',
        getURL: (p: string) => `chrome-extension://chrome-ext-id/${p}`,
      },
    };
    (globalThis as any).chrome = {
      runtime: { id: 'chrome-ext-id' },
    };

    const adapter = getBrowserAdapter();
    expect(adapter.browserType).toBe('chrome');
    expect(adapter.name).toBe('chrome');
  });

  it('selects FirefoxMV3Adapter when running inside a moz-extension environment', () => {
    (globalThis as any).browser = {
      runtime: {
        id: 'siteradar@local.audit',
        getURL: (p: string) => `moz-extension://1234-5678/${p}`,
      },
    };
    delete (globalThis as any).chrome;

    const adapter = getBrowserAdapter();
    expect(adapter.browserType).toBe('firefox');
    expect(adapter.name).toBe('firefox');
  });

  it('treats canonical URLs stripping tracking or js_challenge params as matching', () => {
    expect(
      canonicalUrlsMatch(
        'https://www.aliexpress.com/?spm=a2g0o.home.logo.1.10906278D7zCsv',
        'https://www.aliexpress.com/',
      ),
    ).toBe(true);

    expect(
      canonicalUrlsMatch(
        'https://www.reddit.com/?js_challenge=1&jsc_orig_r=&jsc_token=abc&solution=def',
        'https://www.reddit.com/',
      ),
    ).toBe(true);

    // Genuine path or content query mismatches should remain false
    expect(canonicalUrlsMatch('https://example.com/blog?page=2', 'https://example.com/blog')).toBe(false);
    expect(canonicalUrlsMatch('https://example.com/post-a', 'https://example.com/post-b')).toBe(false);

    const analyzer = new SeoAnalyzer();
    const findings = analyzer.analyze({
      target: {
        url: 'https://www.reddit.com/?js_challenge=1&jsc_token=abc&solution=def',
        origin: 'https://www.reddit.com',
        hostname: 'www.reddit.com',
        inspectedAt: Date.now(),
      },
      mode: 'deep',
      modules: {
        metadata: {
          data: {
            title: 'Reddit',
            canonicalUrl: 'https://www.reddit.com/',
            canonicalMatches: false,
          },
        },
      },
    } as any);

    const canonicalFinding = findings.find((f) => f.ruleId === 'seo-canonical-matches');
    expect(canonicalFinding?.status).toBe('passed');
  });

  it('excludes hidden and CAPTCHA response inputs from unlabeled input counts', () => {
    document.body.innerHTML = `
      <form>
        <label for="search-q">Search</label>
        <input id="search-q" name="q" type="text" />
        <textarea id="g-recaptcha-response-100000" name="g-recaptcha-response"></textarea>
        <input name="cf-turnstile-response" type="text" />
        <input name="hidden-aria" type="text" aria-hidden="true" />
      </form>
    `;

    const collector = new FormsCollector();
    const res = collector.collect({ document, window, url: 'https://www.reddit.com/' });

    expect(res.data?.totalInputCount).toBe(1);
    expect(res.data?.unlabeledInputCount).toBe(0);
    expect(res.data?.unlabeledInputSamples).toEqual([]);
  });

  it('reports accurate DOM bloat cause when only element count exceeds 2000', () => {
    const analyzer = new AccessibilityAnalyzer();
    const findings = analyzer.analyze({
      target: {
        url: 'https://github.com/',
        origin: 'https://github.com',
        hostname: 'github.com',
        inspectedAt: Date.now(),
      },
      mode: 'deep',
      modules: {
        dom: {
          data: {
            maxDomDepth: 28,
            elementCount: 2265,
          },
        },
      },
    } as any);

    const bloatFinding = findings.find((f) => f.ruleId === 'ago-dom-token-bloat');
    expect(bloatFinding?.status).toBe('warning');
    expect(bloatFinding?.explanation).toContain('2265 > 2,000 elements');
    expect(bloatFinding?.explanation).not.toContain('> 32 levels');
  });

  it('deduplicates module aliases and separates blocked modules from failedModules in summary', () => {
    const orchestrator = new InspectionOrchestrator({ browserAdapter: new MockBrowserAdapter() });
    const dummyCompleted = {
      module: 'test',
      status: 'completed',
      collectedAt: Date.now(),
      data: null,
      coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
      limitations: [],
      errors: [],
      sources: [],
    };
    const dummyBlocked = {
      ...dummyCompleted,
      status: 'blocked',
    };

    const summary = (orchestrator as any).computeSummary(
      {
        security: dummyCompleted,
        securitySignals: dummyCompleted,
        securityHeaders: dummyCompleted,
        privacy: dummyCompleted,
        privacySignals: dummyCompleted,
        metadata: dummyCompleted,
        seo: dummyCompleted,
        dom: dummyCompleted,
        content: dummyCompleted,
        dns: dummyBlocked,
        tls: dummyBlocked,
      },
      [],
    );

    expect(summary.completedModules).toBe(4);
    expect(summary.failedModules).toBe(0);
    expect(summary.blockedModules).toBe(2);
  });
});

