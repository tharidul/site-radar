import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PageVitalsCard } from '../entrypoints/popup/components/PageVitalsCard';
import { OverviewDashboard } from '../entrypoints/popup/components/OverviewDashboard';
import { MetadataCollector } from '../src/collectors/page/metadata.collector';
import { PerformanceCollector } from '../src/collectors/page/performance.collector';
import { copyJsonReport } from '../src/export/download';
import type { WebsiteInspection } from '../src/types/inspection';

describe('PageVitalsCard and Performance/Metadata Collectors', () => {
  it('MetadataCollector extracts keywords and keywordsList from meta[name="keywords"]', () => {
    const collector = new MetadataCollector();
    const doc = document.implementation.createHTMLDocument();
    doc.title = 'Test Title';

    const metaDesc = doc.createElement('meta');
    metaDesc.name = 'description';
    metaDesc.content = 'A portfolio of software projects and cloud services.';
    doc.head.appendChild(metaDesc);

    const metaKeywords = doc.createElement('meta');
    metaKeywords.name = 'keywords';
    metaKeywords.content = 'developer, full-stack, typescript, react, cloud';
    doc.head.appendChild(metaKeywords);

    const result = collector.collect({ document: doc });
    expect(result.data?.title).toBe('Test Title');
    expect(result.data?.description).toBe('A portfolio of software projects and cloud services.');
    expect(result.data?.keywords).toBe('developer, full-stack, typescript, react, cloud');
    expect(result.data?.keywordsList).toEqual(['developer', 'full-stack', 'typescript', 'react', 'cloud']);
  });

  it('PageVitalsCard renders loading times and data usage', () => {
    const mockInspection: WebsiteInspection = {
      id: 'test-vitals-id',
      mode: 'quick',
      startedAt: Date.now(),
      completedAt: Date.now() + 500,
      target: {
        url: 'https://tharidulakmal.com/',
        origin: 'https://tharidulakmal.com',
        hostname: 'tharidulakmal.com',
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
          errors: [],
          limitations: [],
          sources: [],
          coverage: { expected: 4, collected: 4, unavailable: 0, supported: true },
          data: {
            navigationTiming: {
              dnsLookupMs: 0,
              tcpConnectMs: 0,
              ttfbMs: 42,
              domLoadMs: 812,
              fullLoadMs: 812,
            },
            paintTiming: { fcpMs: 812 },
            webVitals: { lcpMs: 812, clsScore: 0.001 },
            resourceCount: 24,
            transferSizeApprox: 1258291, // ~1.2 MB
          },
        },
      },
    };

    const html = renderToString(<PageVitalsCard inspection={mockInspection} />);

    // 1. Loading times
    expect(html).toContain('Page Loading Times &amp; Data Usage');
    expect(html).toContain('42ms'); // TTFB
    expect(html).toContain('812ms'); // FCP & LCP

    // 2. Data usage
    expect(html).toContain('1.2 MB'); // Transferred size
    expect(html).toContain('Data Usage:');
  });

  it('PageVitalsCard handles missing performance data gracefully with fallback indicators', () => {
    const minimalInspection: WebsiteInspection = {
      id: 'minimal-id',
      mode: 'quick',
      startedAt: Date.now(),
      target: {
        url: 'https://example.com/',
        origin: 'https://example.com',
        hostname: 'example.com',
        inspectedAt: Date.now(),
      },
      browser: { name: 'firefox' },
      summary: { completedModules: 0, partialModules: 0, failedModules: 0, totalFindings: 0 },
      findings: [],
      modules: {},
    };

    const html = renderToString(<PageVitalsCard inspection={minimalInspection} />);

    expect(html).toContain('Page Loading Times &amp; Data Usage');
    expect(html).toContain('TTFB');
    expect(html).toContain('FCP');
    expect(html).toContain('LCP');
    expect(html).toContain('Load Event');
  });

  it('OverviewDashboard renders unified Export dropdown eliminating button spam', () => {
    const mockInspection: WebsiteInspection = {
      id: 'copy-btn-test-id',
      mode: 'quick',
      startedAt: Date.now(),
      target: {
        url: 'https://example.com/',
        origin: 'https://example.com',
        hostname: 'example.com',
        inspectedAt: Date.now(),
      },
      browser: { name: 'chrome' },
      summary: { completedModules: 1, partialModules: 0, failedModules: 0, totalFindings: 0 },
      findings: [],
      modules: {},
    };

    const html = renderToString(
      <OverviewDashboard
        inspection={mockInspection}
        onNavigateToIssues={() => {}}
      />
    );

    // Verify Export dropdown trigger is rendered with proper accessible attributes
    expect(html).toContain('Export');
    expect(html).toContain('title="Export or copy audit report"');
    expect(html).toContain('aria-haspopup="menu"');
  });

  it('copyJsonReport copies sanitized JSON report using clipboard or textarea fallback', async () => {
    const mockInspection: WebsiteInspection = {
      id: 'copy-report-test-id',
      mode: 'quick',
      startedAt: Date.now(),
      target: {
        url: 'https://example.com/',
        origin: 'https://example.com',
        hostname: 'example.com',
        inspectedAt: Date.now(),
      },
      browser: { name: 'chrome' },
      summary: { completedModules: 1, partialModules: 0, failedModules: 0, totalFindings: 0 },
      findings: [],
      modules: {},
    };

    let clipboardText = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          clipboardText = text;
        },
      },
      configurable: true,
      writable: true,
    });

    const success = await copyJsonReport(mockInspection);
    expect(success).toBe(true);
    expect(clipboardText).toContain('website-intelligence-json');
    expect(clipboardText).toContain('https://example.com/');
  });

  it('PageVitalsCard renders both initial and scrolled full page data usage side-by-side', () => {
    const scrolledInspection: WebsiteInspection = {
      id: 'scrolled-id',
      mode: 'quick',
      startedAt: Date.now(),
      target: {
        url: 'https://example.com/',
        origin: 'https://example.com',
        hostname: 'example.com',
        inspectedAt: Date.now(),
      },
      browser: { name: 'chrome' },
      summary: { completedModules: 1, partialModules: 0, failedModules: 0, totalFindings: 0 },
      findings: [],
      modules: {
        performance: {
          module: 'performance',
          status: 'completed',
          collectedAt: Date.now(),
          data: {
            resourceCount: 20,
            transferSizeApprox: 400 * 1024, // 400 KB initial
            scrolledResourceCount: 65,
            scrolledTransferSizeApprox: 1800 * 1024, // 1.8 MB full page
          },
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          limitations: [],
          errors: [],
          sources: ['PerformanceCollector'],
        },
      },
    };

    const html = renderToString(<PageVitalsCard inspection={scrolledInspection} />);

    // Initial usage
    expect(html).toContain('Data Usage:');
    expect(html).toContain('400 KB');
    expect(html).toContain('Initial');

    // Full page scrolled usage
    expect(html).toContain('Full Page:');
    expect(html).toContain('1.8 MB');
    expect(html).toContain('Scrolled');
    expect(html).toContain('65');
    expect(html).toContain('lazy');
  });

  it('PageVitalsCard provides option to scroll and measure full page when unmeasured', () => {
    const unscrolledInspection: WebsiteInspection = {
      id: 'unscrolled-id',
      mode: 'quick',
      startedAt: Date.now(),
      target: {
        url: 'https://example.com/',
        origin: 'https://example.com',
        hostname: 'example.com',
        inspectedAt: Date.now(),
      },
      browser: { name: 'chrome' },
      summary: { completedModules: 1, partialModules: 0, failedModules: 0, totalFindings: 0 },
      findings: [],
      modules: {
        performance: {
          module: 'performance',
          status: 'completed',
          collectedAt: Date.now(),
          data: {
            resourceCount: 15,
            transferSizeApprox: 300 * 1024,
          },
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          limitations: [],
          errors: [],
          sources: ['PerformanceCollector'],
        },
      },
    };

    const html = renderToString(<PageVitalsCard inspection={unscrolledInspection} />);
    expect(html).toContain('Scroll &amp; measure full page');
  });

  it('PageVitalsCard displays Infinite Feed (Bounded) badge when infinite scroll is detected', () => {
    const infiniteInspection: WebsiteInspection = {
      id: 'infinite-id',
      mode: 'quick',
      startedAt: Date.now(),
      target: {
        url: 'https://unsplash.com/',
        origin: 'https://unsplash.com',
        hostname: 'unsplash.com',
        inspectedAt: Date.now(),
      },
      browser: { name: 'chrome' },
      summary: { completedModules: 1, partialModules: 0, failedModules: 0, totalFindings: 0 },
      findings: [],
      modules: {
        performance: {
          module: 'performance',
          status: 'completed',
          collectedAt: Date.now(),
          data: {
            resourceCount: 20,
            transferSizeApprox: 500 * 1024,
            scrolledResourceCount: 90,
            scrolledTransferSizeApprox: 4500 * 1024,
            isInfiniteScrollDetected: true,
          },
          coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
          limitations: [],
          errors: [],
          sources: ['PerformanceCollector'],
        },
      },
    };

    const html = renderToString(<PageVitalsCard inspection={infiniteInspection} />);
    expect(html).toContain('Infinite Feed (Bounded)');
  });
});
