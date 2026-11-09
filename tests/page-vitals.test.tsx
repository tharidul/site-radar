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

  it('OverviewDashboard renders direct Copy JSON button next to Export JSON and Export HTML', () => {
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

    // Verify Copy JSON button is present with correct labeling and title
    expect(html).toContain('Copy JSON');
    expect(html).toContain('Copy sanitized JSON audit report directly to clipboard');

    // Verify Export JSON and Export HTML buttons are also preserved
    expect(html).toContain('Export JSON');
    expect(html).toContain('Export HTML');
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
});
