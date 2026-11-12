import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { exportToHtml, sha256Base64 } from '../src/export/html.exporter';
import { exportToJson } from '../src/export/json.exporter';
import { generateReportFilename } from '../src/export/download';
import {
  InspectionOrchestrator,
  detectMainWorldTechnologies,
  type ActiveScanSession,
} from '../src/core/orchestrator/inspection-orchestrator';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';
import type { WebsiteInspection } from '../src/types/inspection';

function makeInspection(): WebsiteInspection {
  return {
    id: 'scan_low_test',
    mode: 'full',
    target: {
      url: 'https://example.com/',
      origin: 'https://example.com',
      hostname: 'example.com',
      inspectedAt: 1700000000000,
      isLocalDevelopment: false,
    },
    browser: { name: 'chrome' },
    modules: {},
    findings: [
      {
        id: 'f1',
        ruleId: 'SEC-01',
        category: 'security',
        severity: 'high',
        status: 'failed',
        title: 'Missing HSTS',
        description: 'Strict-Transport-Security header is missing.',
        evidence: [],
        source: 'headers',
      },
      {
        id: 'f2',
        ruleId: 'SEO-01',
        category: 'seo',
        severity: 'low',
        status: 'warning',
        title: 'Short meta description',
        description: 'Description is shorter than recommended.',
        evidence: [],
        source: 'dom',
      },
    ],
    summary: {
      completedModules: 1,
      partialModules: 0,
      failedModules: 0,
      totalFindings: 2,
      passedFindings: 0,
      warningFindings: 1,
      failedFindings: 1,
    },
    startedAt: 1700000000000,
    completedAt: 1700000001000,
  };
}

describe('LOW-01: Exported HTML Report CSP without unsafe-inline in script-src', () => {
  it('computes SHA-256 base64 matching node:crypto for ASCII and Unicode inputs', () => {
    for (const sample of ['', 'hello', 'SiteRadar UTF-8 ✓ — π']) {
      const expected = createHash('sha256').update(sample, 'utf8').digest('base64');
      expect(sha256Base64(sample)).toBe(expected);
    }
  });

  it('replaces unsafe-inline with the exact SHA-256 hash of the inline filter script', () => {
    const html = exportToHtml(makeInspection());
    const cspMatch = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    expect(cspMatch).not.toBeNull();

    const csp = cspMatch![1]!;
    const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/);
    expect(scriptSrcMatch).not.toBeNull();
    expect(scriptSrcMatch![1]).not.toContain("'unsafe-inline'");
    expect(scriptSrcMatch![1]).toMatch(/^'sha256-[A-Za-z0-9+/=]+'$/);

    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    const expectedHash = createHash('sha256').update(scriptMatch![1]!, 'utf8').digest('base64');
    expect(scriptSrcMatch![1]).toBe(`'sha256-${expectedHash}'`);
  });

  it('does not import node:crypto or Node-only crypto in html.exporter.ts', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/export/html.exporter.ts'), 'utf8');
    expect(source).not.toMatch(/from\s+['"](?:node:)?crypto['"]/);
    expect(source).not.toMatch(/require\(['"](?:node:)?crypto['"]\)/);
  });

  it('preserves interactive search and severity filtering behavior in the exported report', () => {
    const html = exportToHtml(makeInspection());
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();

    document.body.innerHTML = html.match(/<body>([\s\S]*)<script>/)![1]!;
    // Execute the inline filter script in the DOM
    new Function(scriptMatch![1]!)();

    const countEl = document.getElementById('findings-count');
    const highBtn = document.querySelector<HTMLButtonElement>('.filter-btn[data-filter="high"]');
    const searchInput = document.getElementById('finding-search') as HTMLInputElement;

    expect(countEl?.textContent).toBe('2');
    highBtn?.click();
    expect(countEl?.textContent).toBe('1');

    const allBtn = document.querySelector<HTMLButtonElement>('.filter-btn[data-filter="all"]');
    allBtn?.click();
    expect(countEl?.textContent).toBe('2');

    searchInput.value = 'hsts';
    searchInput.dispatchEvent(new Event('input'));
    expect(countEl?.textContent).toBe('1');
  });
});

describe('LOW-02: MAIN-world technology detection DOM clobbering resilience', () => {
  const clobberedGlobals = [
    'React',
    'ReactDOM',
    '__REACT_DEVTOOLS_GLOBAL_HOOK__',
    'next',
    '__NEXT_DATA__',
    '__next_f',
    'Vue',
    '__VUE__',
    '__VUE_HMR_RUNTIME__',
    '$nuxt',
    '__NUXT__',
    '__NUXT_DATA__',
    'angular',
    'ng',
    'getAllAngularRootElements',
    '__remixContext',
    '__remixManifest',
    '___gatsby',
    'Solid',
    '_$HY',
    'Alpine',
    'htmx',
    'jQuery',
    '$',
  ];

  afterEach(() => {
    document.body.innerHTML = '';
    for (const key of clobberedGlobals) {
      try {
        delete (window as any)[key];
      } catch {
        (window as any)[key] = undefined;
      }
    }
  });

  it('ignores DOM elements, HTMLCollections, and NodeLists clobbering framework globals', () => {
    document.body.innerHTML = `
      <form id="React" name="React"><input name="version" value="18.2.0"></form>
      <div id="next"></div>
      <div id="next"></div>
      <div id="Vue"></div>
      <div id="__VUE__"></div>
      <form id="angular"><input name="version"></form>
      <div id="Alpine"></div>
      <div id="htmx"></div>
      <div id="jQuery"></div>
      <div id="__remixContext"></div>
      <div id="___gatsby"></div>
    `;

    // Explicitly simulate browser named-access DOM clobbering on window
    const form = document.getElementById('React') as HTMLFormElement;
    const nextCollection = document.querySelectorAll('#next');
    const divVue = document.getElementById('Vue')!;
    const divVueFlag = document.getElementById('__VUE__')!;
    const angularForm = document.getElementById('angular')!;

    (window as any).React = form;
    (window as any).next = document.getElementsByTagName('div'); // HTMLCollection
    (window as any).__next_f = nextCollection; // NodeList
    (window as any).Vue = divVue;
    (window as any).__VUE__ = divVueFlag;
    (window as any).angular = angularForm;
    (window as any).Alpine = document.getElementById('Alpine');
    (window as any).htmx = document.getElementById('htmx');
    (window as any).jQuery = document.getElementById('jQuery');
    (window as any).__remixContext = document.getElementById('__remixContext');
    (window as any).___gatsby = document.getElementById('___gatsby');

    const detected = detectMainWorldTechnologies();
    expect(detected).toEqual([]);
  });

  it('detects legitimate non-DOM framework globals accurately', () => {
    (window as any).React = { version: '18.2.0' };
    (window as any).__VUE__ = true;
    (window as any).angular = { version: { full: '1.8.3' } };
    (window as any).jQuery = Object.assign(() => {}, { fn: { jquery: '3.7.1' } });

    const detected = detectMainWorldTechnologies();
    expect(detected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'React', version: '18.2.0' }),
        expect.objectContaining({ name: 'Vue.js' }),
        expect.objectContaining({ name: 'Angular', version: '1.8.3' }),
        expect.objectContaining({ name: 'jQuery', version: '3.7.1' }),
      ]),
    );
  });
});

describe('LOW-03: Ephemeral RAM-only sessions when session storage is unsupported', () => {
  let adapter: MockBrowserAdapter;
  let orchestrator: InspectionOrchestrator;

  beforeEach(() => {
    adapter = new MockBrowserAdapter();
    (adapter.capabilities as { supportsSessionStorage: boolean }).supportsSessionStorage = false;
    orchestrator = new InspectionOrchestrator({ browserAdapter: adapter });
  });

  it('does not fall back to local disk storage on persistSession, restoreFromStorage, or clearStorageSession', async () => {
    const session: ActiveScanSession = {
      scanId: 'scan_ram_only',
      mode: 'full',
      targetUrl: 'https://example.com/',
      tabId: 7,
      state: 'completed',
      startedAt: Date.now(),
    };

    await orchestrator.persistSession(session);

    expect(adapter.storage.local.size).toBe(0);
    expect(adapter.storage.session.size).toBe(0);

    // Pre-populate local storage with an unrelated key to verify clearStorageSession never touches local
    adapter.storage.local.set('siteradar_session_should_not_touch', { stale: true });
    await orchestrator.clearStorageSession();
    expect(adapter.storage.local.has('siteradar_session_should_not_touch')).toBe(true);

    const freshOrchestrator = new InspectionOrchestrator({ browserAdapter: adapter });
    const restored = await freshOrchestrator.restoreFromStorage(7, 'https://example.com/');
    expect(restored).toBeUndefined();
  });
});

describe('SiteRadar Export Branding', () => {
  it('exports JSON reports with siteradar-json format identifier', () => {
    const parsed = JSON.parse(exportToJson(makeInspection()));
    expect(parsed.exportFormat).toBe('siteradar-json');
  });

  it('generates report filenames with siteradar- prefix', () => {
    const filename = generateReportFilename('example.com', 'full', 'json', 1700000000000);
    expect(filename.startsWith('siteradar-')).toBe(true);
    expect(filename).toBe('siteradar-example.com-full-2023-11-14.json');
  });
});
