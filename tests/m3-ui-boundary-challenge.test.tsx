import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PageVitalsCard } from '../entrypoints/popup/components/PageVitalsCard';
import type { PerformanceData, WebsiteInspection } from '../src/types/inspection';

/**
 * Milestone 3 Adversarial UI Boundary & Zero-State Test Suite
 *
 * Verifies rendering boundaries, tooltips, fallback states, legacy compatibility,
 * and extreme numeric scenarios for PageVitalsCard.
 */
describe('Milestone 3 UI Boundary & Zero-State Adversarial Challenge', () => {
  const PAGE_URL = 'https://siteradar.dev/benchmark';
  const PAGE_ORIGIN = 'https://siteradar.dev';

  function createMockInspection(perfData?: Partial<PerformanceData>): WebsiteInspection {
    return {
      id: 'ui-boundary-test-id',
      mode: 'quick',
      startedAt: 1700000000000,
      completedAt: 1700000000500,
      target: {
        url: PAGE_URL,
        origin: PAGE_ORIGIN,
        hostname: 'siteradar.dev',
        inspectedAt: 1700000000000,
      },
      browser: { name: 'chrome' },
      summary: { completedModules: 1, partialModules: 0, failedModules: 0, totalFindings: 0 },
      findings: [],
      modules: {
        performance: {
          module: 'performance',
          status: 'completed',
          collectedAt: 1700000000000,
          errors: [],
          limitations: [],
          sources: ['PerformanceCollector'],
          coverage: { expected: 4, collected: 4, unavailable: 0, supported: true },
          data: perfData as PerformanceData,
        },
      },
    };
  }

  function renderToDoc(jsx: React.ReactElement): HTMLElement {
    const container = document.createElement('div');
    container.innerHTML = renderToString(jsx);
    return container;
  }

  const cleanHtml = (html: string) => html.replace(/<!-- -->/g, '');

  describe('Case 1: 100% Cache Hit Page Adversarial Scenario', () => {
    it('renders emerald cache badge and falls back to decoded size without false wire transfer bytes', () => {
      // Case 1: 100% Cache Hit Page: wireTransferBytes: 0, decodedBytes: 450000, cacheHitCount: 12, cacheHitBytes: 150000
      const inspection = createMockInspection({
        resourceCount: 12,
        wireTransferBytes: 0,
        decodedBytes: 450000,
        transferSizeApprox: 0,
        decodedSizeApprox: 450000,
        cacheHitCount: 12,
        cacheHitBytes: 150000,
        opaqueResourceCount: 0,
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      // 1. Assert emerald cache badge appears with count and size
      expect(html).toContain('12 cached');
      expect(html).toContain('146.5 KB'); // 150000 / 1024 = 146.48 -> 146.5 KB

      // Verify styling classes for emerald cache badge
      const cacheBadge = Array.from(doc.querySelectorAll('span')).find((el) =>
        el.textContent?.includes('12 cached')
      );
      expect(cacheBadge).toBeDefined();
      expect(cacheBadge?.className).toContain('bg-emerald-500/10');
      expect(cacheBadge?.className).toContain('text-emerald-700');
      expect(cacheBadge?.getAttribute('title')).toBe(
        'Assets served from local browser cache without network transfer.'
      );

      // 2. Assert fallback to decoded size (~439.5 KB)
      // 450000 / 1024 = 439.45 -> ~439.5 KB
      expect(html).toContain('~439.5 KB');

      // 3. Assert wire transfer bytes label is NOT rendered because wireTransferBytes === 0
      expect(html).not.toContain('Wire: 0 B');
      expect(html).not.toContain('Wire:');

      // 4. TAO warning pill should NOT be rendered when opaqueResourceCount is 0
      expect(html).not.toContain('cross-origin (no TAO)');
    });

    it('renders scrolled cache hits cleanly alongside initial cache hits', () => {
      const inspection = createMockInspection({
        resourceCount: 10,
        wireTransferBytes: 0,
        decodedBytes: 300000,
        cacheHitCount: 10,
        cacheHitBytes: 100000,
        scrolledResourceCount: 25,
        scrolledWireTransferBytes: 0,
        scrolledDecodedBytes: 800000,
        scrolledCacheHitCount: 25,
        scrolledCacheHitBytes: 250000,
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      expect(html).toContain('10 cached (97.7 KB)');
      expect(html).toContain('~293 KB');
      expect(html).toContain('Full Page:');
      expect(html).toContain('25 cached (244.1 KB)');
      expect(html).toContain('~781.3 KB');
      expect(html).not.toContain('Wire:');
    });
  });

  describe('Case 2: 100% Opaque Cross-Origin Page (Zero TAO)', () => {
    it('renders amber TAO pill with explanatory security tooltip and shows request count rather than 0 B', () => {
      // Case 2: 100% Opaque Cross-Origin Page: wireTransferBytes: 0, decodedBytes: 0, opaqueResourceCount: 8, resourceCount: 8
      const inspection = createMockInspection({
        resourceCount: 8,
        wireTransferBytes: 0,
        decodedBytes: 0,
        transferSizeApprox: 0,
        decodedSizeApprox: 0,
        cacheHitCount: 0,
        cacheHitBytes: 0,
        opaqueResourceCount: 8,
        opaqueResourceOrigins: ['https://cdn.thirdparty.com', 'https://tracker.analytics.io'],
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      // 1. Assert amber TAO warning pill appears
      expect(html).toContain('8 cross-origin (no TAO)');

      const taoBadge = Array.from(doc.querySelectorAll('span')).find((el) =>
        el.textContent?.includes('8 cross-origin (no TAO)')
      );
      expect(taoBadge).toBeDefined();
      expect(taoBadge?.className).toContain('bg-amber-500/10');
      expect(taoBadge?.className).toContain('text-amber-700');
      expect(taoBadge?.getAttribute('title')).toBe(
        'Browser security (Timing-Allow-Origin) restricts measuring wire transfer sizes for cross-origin resources lacking TAO headers. Wire total reflects measured assets only.'
      );

      // 2. Assert metric displays '8 reqs' rather than '0 B'
      expect(html).toContain('8 reqs');
      expect(html).toContain('(Initial • 8 reqs)');
      expect(html).not.toContain('0 B');
      expect(html).not.toContain('Wire:');
      expect(html).not.toContain('~0 B');

      // 3. Cache badge must not appear
      expect(html).not.toContain('cached');
    });

    it('renders scrolled opaque cross-origin warning alongside initial opaque count', () => {
      const inspection = createMockInspection({
        resourceCount: 4,
        wireTransferBytes: 0,
        decodedBytes: 0,
        opaqueResourceCount: 4,
        scrolledResourceCount: 16,
        scrolledWireTransferBytes: 0,
        scrolledDecodedBytes: 0,
        scrolledOpaqueResourceCount: 16,
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      expect(html).toContain('4 cross-origin (no TAO)');
      expect(html).toContain('4 reqs');
      expect(html).toContain('Full Page:');
      expect(html).toContain('16 cross-origin (no TAO)');
      expect(html).toContain('16 reqs');
      expect(html).not.toContain('0 B');
    });
  });

  describe('Case 3: Mixed Real-World Page Scenario', () => {
    it('renders Wire, Decoded, cache badge, and TAO warning pill cleanly together', () => {
      // Case 3: Mixed Real-World Page:
      // wireTransferBytes: 350000, decodedBytes: 1200000, cacheHitCount: 4, cacheHitBytes: 80000, opaqueResourceCount: 6
      const inspection = createMockInspection({
        resourceCount: 30,
        wireTransferBytes: 350000,
        decodedBytes: 1200000,
        transferSizeApprox: 350000,
        decodedSizeApprox: 1200000,
        cacheHitCount: 4,
        cacheHitBytes: 80000,
        opaqueResourceCount: 6,
        opaqueResourceOrigins: ['https://fonts.googleapis.com', 'https://widget.intercom.io'],
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      // 1. Assert Wire metric: 350000 / 1024 = 341.796875 -> 341.8 KB
      expect(html).toContain('Wire: 341.8 KB');

      const wireSpan = Array.from(doc.querySelectorAll('span')).find((el) =>
        el.textContent?.includes('Wire: 341.8 KB')
      );
      expect(wireSpan).toBeDefined();
      expect(wireSpan?.getAttribute('title')).toBe(
        'Wire transfer reflects compressed bytes received over network. Decoded reflects uncompressed size in memory.'
      );
      expect(wireSpan?.className).toContain('font-extrabold');
      expect(wireSpan?.className).toContain('dark:text-[#CEFF52]');

      // 2. Assert Decoded metric: 1200000 / (1024 * 1024) = 1.1444 -> 1.1 MB
      expect(html).toContain('Decoded: 1.1 MB');

      const decodedSpan = Array.from(doc.querySelectorAll('span')).find((el) =>
        el.textContent?.includes('Decoded: 1.1 MB')
      );
      expect(decodedSpan).toBeDefined();
      expect(decodedSpan?.getAttribute('title')).toBe(
        'Decoded reflects uncompressed size in memory.'
      );

      // 3. Assert Cache Badge: 80000 / 1024 = 78.125 -> 78.1 KB
      expect(html).toContain('4 cached (78.1 KB)');

      // 4. Assert TAO warning pill
      expect(html).toContain('6 cross-origin (no TAO)');

      // 5. Assert Initial request count
      expect(html).toContain('(Initial • 30 reqs)');
    });

    it('renders complete dual-metric full page state with lazy delta in mixed real-world page', () => {
      const inspection = createMockInspection({
        resourceCount: 20,
        wireTransferBytes: 300000,
        decodedBytes: 1000000,
        cacheHitCount: 3,
        cacheHitBytes: 60000,
        opaqueResourceCount: 4,
        scrolledResourceCount: 48,
        scrolledWireTransferBytes: 750000,
        scrolledDecodedBytes: 2500000,
        scrolledCacheHitCount: 7,
        scrolledCacheHitBytes: 150000,
        scrolledOpaqueResourceCount: 9,
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      // Initial checks
      expect(html).toContain('Wire: 293 KB');
      expect(html).toContain('Decoded: 976.6 KB');
      expect(html).toContain('3 cached (58.6 KB)');
      expect(html).toContain('4 cross-origin (no TAO)');

      // Scrolled checks
      expect(html).toContain('Full Page:');
      expect(html).toContain('Wire: 732.4 KB');
      expect(html).toContain('Decoded: 2.4 MB');
      expect(html).toContain('(Scrolled • 48 reqs)');
      expect(html).toContain('7 cached (146.5 KB)');
      expect(html).toContain('9 cross-origin (no TAO)');

      // Lazy delta: (750000 - 300000) / 1024 = 439.45 -> +439.5 KB lazy
      expect(html).toContain('+439.5 KB lazy');
    });
  });

  describe('Case 4: Legacy Backward Compatibility', () => {
    it('gracefully handles legacy performance data containing only transferSizeApprox and decodedSizeApprox', () => {
      // Case 4: Missing all new M2/M3 fields (wireTransferBytes: undefined, cacheHitCount: undefined, etc.)
      const inspection = createMockInspection({
        resourceCount: 15,
        transferSizeApprox: 245000,
        decodedSizeApprox: 500000,
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      // 245000 / 1024 = 239.2578 -> 239.3 KB
      // 500000 / 1024 = 488.28 -> 488.3 KB
      expect(html).toContain('Wire: 239.3 KB');
      expect(html).toContain('Decoded: 488.3 KB');
      expect(html).toContain('(Initial • 15 reqs)');

      // Neither cache badge nor TAO warning pill should render
      expect(html).not.toContain('cached');
      expect(html).not.toContain('cross-origin (no TAO)');
    });

    it('handles legacy performance data with only transferSizeApprox (decodedSizeApprox missing)', () => {
      const inspection = createMockInspection({
        resourceCount: 10,
        transferSizeApprox: 102400, // 100 KB
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      expect(html).toContain('Wire: 100 KB');
      expect(html).not.toContain('Decoded:');
      expect(html).toContain('(Initial • 10 reqs)');
    });

    it('handles legacy performance data with only decodedSizeApprox (transferSizeApprox missing or 0)', () => {
      const inspection = createMockInspection({
        resourceCount: 10,
        decodedSizeApprox: 614400, // 600 KB
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      // Falls back to decoded uncompressed size approximation
      expect(html).toContain('~600 KB');
      expect(html).not.toContain('Wire:');
    });

    it('handles legacy scrolled data fields smoothly', () => {
      const inspection = createMockInspection({
        resourceCount: 8,
        transferSizeApprox: 100000,
        scrolledResourceCount: 22,
        scrolledTransferSizeApprox: 300000,
        scrolledDecodedSizeApprox: 800000,
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      expect(html).toContain('Wire: 97.7 KB');
      expect(html).toContain('Full Page:');
      expect(html).toContain('Wire: 293 KB');
      expect(html).toContain('Decoded: 781.3 KB');
      expect(html).toContain('+195.3 KB lazy');
    });
  });

  describe('Case 5: Zero-Resource Empty State', () => {
    it('renders cleanly with 0 reqs without crashing when resourceCount is 0 and bytes are 0/undefined', () => {
      // Case 5: Zero-Resource Empty State
      const inspection = createMockInspection({
        resourceCount: 0,
        wireTransferBytes: 0,
        decodedBytes: 0,
        transferSizeApprox: 0,
        decodedSizeApprox: 0,
        cacheHitCount: 0,
        cacheHitBytes: 0,
        opaqueResourceCount: 0,
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      expect(html).toContain('Page Loading Times &amp; Data Usage');
      expect(html).toContain('0 reqs');
      expect(html).toContain('(Initial • 0 reqs)');

      // No NaN or undefined in the HTML
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('null');
      expect(html).not.toContain('Wire:');
      expect(html).not.toContain('Decoded:');
      expect(html).not.toContain('cached');
      expect(html).not.toContain('cross-origin');
    });

    it('renders safely when performance data object is completely empty', () => {
      const inspection = createMockInspection({});

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      expect(html).toContain('Page Loading Times &amp; Data Usage');
      expect(html).toContain('0 reqs');
      expect(html).toContain('—'); // Primary time fallback
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('undefined');
    });

    it('renders safely when modules.performance is completely missing', () => {
      const minimalInspection: WebsiteInspection = {
        id: 'no-module-id',
        mode: 'quick',
        startedAt: Date.now(),
        target: {
          url: PAGE_URL,
          origin: PAGE_ORIGIN,
          hostname: 'siteradar.dev',
          inspectedAt: Date.now(),
        },
        browser: { name: 'chrome' },
        summary: { completedModules: 0, partialModules: 0, failedModules: 0, totalFindings: 0 },
        findings: [],
        modules: {},
      };

      const doc = renderToDoc(<PageVitalsCard inspection={minimalInspection} />);
      const html = cleanHtml(doc.innerHTML);

      expect(html).toContain('Page Loading Times &amp; Data Usage');
      expect(html).toContain('0 reqs');
      expect(html).toContain('—');
    });
  });

  describe('Case 6: Extreme Sizing & Number Boundary Stress', () => {
    it('formats gigabytes and terabytes correctly without throwing or array out-of-bounds', () => {
      // 5 GB wire transfer, 1.5 TB decoded bytes
      const fiveGB = 5 * 1024 * 1024 * 1024;
      const onePointFiveTB = 1.5 * 1024 * 1024 * 1024 * 1024;

      const inspection = createMockInspection({
        resourceCount: 2000,
        wireTransferBytes: fiveGB,
        decodedBytes: onePointFiveTB,
        cacheHitCount: 50,
        cacheHitBytes: 2 * 1024 * 1024 * 1024, // 2 GB
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      // Verify exact formatted strings
      expect(html).toContain('Wire: 5 GB');
      expect(html).toContain('Decoded: 1.5 TB');
      expect(html).toContain('50 cached (2 GB)');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('undefined');
    });

    it('caps unit index safely at TB for ultra-extreme values (e.g. 10 Petabytes)', () => {
      const tenPB = 10 * 1024 * 1024 * 1024 * 1024 * 1024; // 10,240 TB
      const inspection = createMockInspection({
        resourceCount: 50000,
        wireTransferBytes: tenPB,
        decodedBytes: tenPB * 2,
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      // Should be capped at TB (10240 TB and 20480 TB) without throwing
      expect(html).toContain('Wire: 10240 TB');
      expect(html).toContain('Decoded: 20480 TB');
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('NaN');
    });

    it('handles exact unit boundary thresholds (1 B, 1023 B, 1024 B, 1 MB)', () => {
      // Test 1 B
      const inspection1B = createMockInspection({
        resourceCount: 1,
        wireTransferBytes: 1,
        decodedBytes: 1023,
      });
      const html1 = cleanHtml(renderToString(<PageVitalsCard inspection={inspection1B} />));
      expect(html1).toContain('Wire: 1 B');
      expect(html1).toContain('Decoded: 1023 B');

      // Test exactly 1024 bytes (1 KB)
      const inspection1KB = createMockInspection({
        resourceCount: 1,
        wireTransferBytes: 1024,
        decodedBytes: 1024 * 1024,
      });
      const html2 = cleanHtml(renderToString(<PageVitalsCard inspection={inspection1KB} />));
      expect(html2).toContain('Wire: 1 KB');
      expect(html2).toContain('Decoded: 1 MB');
    });

    it('handles negative or NaN numeric inputs safely by falling back to 0 B', () => {
      const negativeInspection = createMockInspection({
        resourceCount: 2,
        wireTransferBytes: -1024,
        decodedBytes: NaN,
      });

      const doc = renderToDoc(<PageVitalsCard inspection={negativeInspection} />);
      const html = cleanHtml(doc.innerHTML);

      // wireBytes <= 0 and decodedBytes is NaN -> should fall back to reqs count
      expect(html).toContain('2 reqs');
      expect(html).not.toContain('Wire:');
      expect(html).not.toContain('Decoded:');
      expect(html).not.toContain('NaN');
    });
  });

  describe('Case 7: Advanced Stress & Layout Boundary Invariants', () => {
    it('does not display a negative lazy badge if scrolled wire bytes is less than or equal to initial wire bytes', () => {
      const inspection = createMockInspection({
        resourceCount: 10,
        wireTransferBytes: 500000,
        decodedBytes: 1000000,
        scrolledResourceCount: 10,
        scrolledWireTransferBytes: 400000, // anomaly: smaller than initial
        scrolledDecodedBytes: 900000,
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      // lazy delta badge (+... lazy) must NOT be rendered when lazyWire <= 0
      expect(html).not.toMatch(/\+\S+\s+lazy/);
      expect(html).not.toContain('lazy</span>');
      expect(html).not.toContain('- B lazy');
      expect(html).not.toContain('+0 B lazy');
    });

    it('renders Infinite Feed (Bounded) badge with explanatory tooltip when infinite scroll is detected', () => {
      const inspection = createMockInspection({
        resourceCount: 15,
        wireTransferBytes: 200000,
        scrolledResourceCount: 80,
        scrolledWireTransferBytes: 1200000,
        isInfiniteScrollDetected: true,
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      expect(html).toContain('Infinite Feed (Bounded)');
      const infiniteChip = Array.from(doc.querySelectorAll('span')).find((el) =>
        el.textContent?.includes('Infinite Feed (Bounded)')
      );
      expect(infiniteChip).toBeDefined();
      expect(infiniteChip?.className).toContain('bg-sky-500/10');
      expect(infiniteChip?.getAttribute('title')).toBe(
        'This site appends infinite content on scroll. Measurement was safely bounded to initial loaded viewports.'
      );
    });

    it('handles missing cacheHitBytes gracefully when cacheHitCount > 0', () => {
      const inspection = createMockInspection({
        resourceCount: 5,
        wireTransferBytes: 50000,
        cacheHitCount: 5,
        cacheHitBytes: undefined, // undefined cacheHitBytes
      });

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      // Should default cacheHitBytes to 0 and render (0 B) without error
      expect(html).toContain('5 cached (0 B)');
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('NaN');
    });

    it('computes totalRequests from resources module when perfData.resourceCount is undefined', () => {
      const inspection: WebsiteInspection = {
        id: 'resource-module-fallback-id',
        mode: 'quick',
        startedAt: Date.now(),
        target: {
          url: PAGE_URL,
          origin: PAGE_ORIGIN,
          hostname: 'siteradar.dev',
          inspectedAt: Date.now(),
        },
        browser: { name: 'chrome' },
        summary: { completedModules: 2, partialModules: 0, failedModules: 0, totalFindings: 0 },
        findings: [],
        modules: {
          performance: {
            module: 'performance',
            status: 'completed',
            collectedAt: Date.now(),
            data: {
              // resourceCount is undefined
              wireTransferBytes: 10000,
            } as PerformanceData,
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: [],
          },
          resources: {
            module: 'resources',
            status: 'completed',
            collectedAt: Date.now(),
            data: {
              scripts: [{ url: 'a.js' }, { url: 'b.js' }],
              stylesheets: [{ url: 'c.css' }],
              images: [{ url: 'd.png' }, { url: 'e.png' }, { url: 'f.png' }],
            },
            coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
            limitations: [],
            errors: [],
            sources: [],
          },
        },
      };

      const doc = renderToDoc(<PageVitalsCard inspection={inspection} />);
      const html = cleanHtml(doc.innerHTML);

      // totalRequests = 2 scripts + 1 css + 3 images = 6
      expect(html).toContain('(Initial • 6 reqs)');
    });
  });
});
