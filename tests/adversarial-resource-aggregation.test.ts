import { describe, it, expect } from 'vitest';
import {
  aggregateResourceMetrics,
  extractHttpOrigin,
  categorizeResource,
} from '../src/collectors/page/resource-aggregator';
import { PerformanceCollector } from '../src/collectors/page/performance.collector';
import type { CollectorContext } from '../src/collectors/page/types';

describe('Adversarial Stress Testing: Resource Aggregator & Performance Collector', () => {
  const PAGE_URL = 'https://example.com/sub/page.html';
  const PAGE_ORIGIN = 'https://example.com';

  describe('1. Adversarial Scenario: Empty resources array []', () => {
    it('handles empty resources array without navigation timing', () => {
      const res = aggregateResourceMetrics([], undefined, PAGE_URL);

      expect(res.totalRequests).toBe(0);
      expect(res.wireTransferBytes).toBe(0);
      expect(res.decodedBytes).toBe(0);
      expect(res.cacheHitCount).toBe(0);
      expect(res.cacheHitBytes).toBe(0);
      expect(res.opaqueResourceCount).toBe(0);
      expect(res.opaqueResourceOrigins).toEqual([]);
      expect(res.resourceTypes).toEqual({});

      // All 7 canonical categories must exist and have 0 values
      const categories = ['scripts', 'stylesheets', 'images', 'media', 'fonts', 'fetch/xhr', 'other'];
      expect(Object.keys(res.categoryBreakdown).sort()).toEqual(categories.sort());
      for (const cat of categories) {
        expect(res.categoryBreakdown[cat]).toEqual({
          count: 0,
          wireBytes: 0,
          decodedBytes: 0,
          cacheHitCount: 0,
          opaqueCount: 0,
        });
      }
    });

    it('handles empty resources array WITH standard wire navigation timing', () => {
      const mockNav = {
        name: PAGE_URL,
        entryType: 'navigation',
        startTime: 0,
        duration: 200,
        transferSize: 4500,
        encodedBodySize: 4200,
        decodedBodySize: 18000,
      } as PerformanceNavigationTiming;

      const res = aggregateResourceMetrics([], mockNav, PAGE_URL);

      expect(res.totalRequests).toBe(1);
      expect(res.wireTransferBytes).toBe(4500);
      expect(res.decodedBytes).toBe(18000);
      expect(res.cacheHitCount).toBe(0);
      expect(res.cacheHitBytes).toBe(0);
      expect(res.opaqueResourceCount).toBe(0);
      expect(res.opaqueResourceOrigins).toEqual([]);
    });

    it('handles empty resources array WITH cached navigation timing (transferSize === 0)', () => {
      const mockCachedNav = {
        name: PAGE_URL,
        entryType: 'navigation',
        startTime: 0,
        duration: 15,
        transferSize: 0,
        encodedBodySize: 5200,
        decodedBodySize: 22000,
      } as PerformanceNavigationTiming;

      const res = aggregateResourceMetrics([], mockCachedNav, PAGE_URL);

      expect(res.totalRequests).toBe(1);
      expect(res.wireTransferBytes).toBe(0);
      expect(res.decodedBytes).toBe(22000);
      expect(res.cacheHitCount).toBe(1);
      expect(res.cacheHitBytes).toBe(5200);
      expect(res.opaqueResourceCount).toBe(0);
    });

    it('handles default arguments when called with undefined', () => {
      const res = aggregateResourceMetrics();
      expect(res.totalRequests).toBe(0);
      expect(res.wireTransferBytes).toBe(0);
      expect(res.decodedBytes).toBe(0);
      expect(res.cacheHitCount).toBe(0);
      expect(res.cacheHitBytes).toBe(0);
      expect(res.opaqueResourceCount).toBe(0);
    });
  });

  describe('2. Adversarial Scenario: 100% Cache Hits', () => {
    it('verifies wireTransferBytes === 0, cacheHitCount === N, cacheHitBytes === sum(encodedBodySize)', () => {
      const encodedSizes = [120000, 240000, 360000, 480000, 600000];
      const decodedSizes = [350000, 700000, 1050000, 1400000, 1750000];
      const sumEncoded = encodedSizes.reduce((a, b) => a + b, 0); // 1,800,000
      const sumDecoded = decodedSizes.reduce((a, b) => a + b, 0); // 5,250,000

      const cachedEntries: PerformanceResourceTiming[] = encodedSizes.map((enc, idx) => ({
        name: `https://example.com/assets/cached-${idx}.js`,
        entryType: 'resource',
        startTime: 10 * idx,
        duration: 2,
        initiatorType: 'script',
        transferSize: 0,
        encodedBodySize: enc,
        decodedBodySize: decodedSizes[idx],
        toJSON: () => ({}),
      } as unknown as PerformanceResourceTiming));

      const res = aggregateResourceMetrics(cachedEntries, undefined, PAGE_URL);

      expect(res.totalRequests).toBe(5);
      expect(res.wireTransferBytes).toBe(0);
      expect(res.cacheHitCount).toBe(5);
      expect(res.cacheHitBytes).toBe(sumEncoded);
      expect(res.decodedBytes).toBe(sumDecoded);
      expect(res.opaqueResourceCount).toBe(0);
      expect(res.opaqueResourceOrigins).toEqual([]);

      // Category breakdown check
      expect(res.categoryBreakdown.scripts?.count).toBe(5);
      expect(res.categoryBreakdown.scripts?.wireBytes).toBe(0);
      expect(res.categoryBreakdown.scripts?.cacheHitCount).toBe(5);
      expect(res.categoryBreakdown.scripts?.decodedBytes).toBe(sumDecoded);
    });

    it('falls back to decodedBodySize when encodedBodySize === 0 for memory-cached assets', () => {
      const memoryCached: PerformanceResourceTiming[] = [
        {
          name: 'https://example.com/assets/memory-cached.png',
          entryType: 'resource',
          startTime: 5,
          duration: 1,
          initiatorType: 'img',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 45000,
          toJSON: () => ({}),
        } as unknown as PerformanceResourceTiming,
      ];

      const res = aggregateResourceMetrics(memoryCached, undefined, PAGE_URL);

      expect(res.wireTransferBytes).toBe(0);
      expect(res.cacheHitCount).toBe(1);
      expect(res.cacheHitBytes).toBe(45000);
      expect(res.decodedBytes).toBe(45000);
    });
  });

  describe('3. Adversarial Scenario: 100% Opaque Cross-Origin Resources', () => {
    it('verifies opaqueResourceCount === N, wireTransferBytes === 0, decodedBytes === 0, and unique origins recorded', () => {
      const opaqueResources: PerformanceResourceTiming[] = [
        {
          name: 'https://cdn1.tracker.com/analytics.js',
          initiatorType: 'script',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
        {
          name: 'https://cdn2.thirdparty.org/widget.css',
          initiatorType: 'link',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
        {
          name: 'https://cdn1.tracker.com/pixel.png', // duplicate origin
          initiatorType: 'img',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
        {
          name: 'https://adservice.google.com/ads.js',
          initiatorType: 'script',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
      ] as unknown as PerformanceResourceTiming[];

      const res = aggregateResourceMetrics(opaqueResources, undefined, PAGE_URL);

      expect(res.totalRequests).toBe(4);
      expect(res.wireTransferBytes).toBe(0);
      expect(res.decodedBytes).toBe(0);
      expect(res.cacheHitCount).toBe(0);
      expect(res.cacheHitBytes).toBe(0);
      expect(res.opaqueResourceCount).toBe(4);

      // Verify unique origins deduplication
      expect(res.opaqueResourceOrigins.sort()).toEqual([
        'https://adservice.google.com',
        'https://cdn1.tracker.com',
        'https://cdn2.thirdparty.org',
      ].sort());

      // Category breakdown opaqueCount check
      expect(res.categoryBreakdown.scripts?.opaqueCount).toBe(2);
      expect(res.categoryBreakdown.stylesheets?.opaqueCount).toBe(1);
      expect(res.categoryBreakdown.images?.opaqueCount).toBe(1);
    });

    it('does NOT classify same-origin zero-byte resources as opaque', () => {
      const sameOriginZeroByte: PerformanceResourceTiming[] = [
        {
          name: 'https://example.com/assets/empty.js',
          initiatorType: 'script',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
      ] as unknown as PerformanceResourceTiming[];

      const res = aggregateResourceMetrics(sameOriginZeroByte, undefined, PAGE_URL);

      expect(res.opaqueResourceCount).toBe(0);
      expect(res.opaqueResourceOrigins).toEqual([]);
      expect(res.wireTransferBytes).toBe(0);
      expect(res.cacheHitCount).toBe(0);
    });
  });

  describe('4. Adversarial Scenario: Non-HTTP Schemes', () => {
    it('verifies data:, blob:, and about:blank URLs are NOT classified as opaque cross-origin', () => {
      const nonHttpResources: PerformanceResourceTiming[] = [
        {
          name: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==',
          initiatorType: 'img',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
        {
          name: 'blob:https://example.com/1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
          initiatorType: 'img',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
        {
          name: 'blob:null/subresource-worker-blob',
          initiatorType: 'other',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
        {
          name: 'about:blank',
          initiatorType: 'other',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
        {
          name: 'javascript:void(0)',
          initiatorType: 'other',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
      ] as unknown as PerformanceResourceTiming[];

      const res = aggregateResourceMetrics(nonHttpResources, undefined, PAGE_URL);

      expect(res.totalRequests).toBe(5);
      expect(res.wireTransferBytes).toBe(0);
      expect(res.decodedBytes).toBe(0);
      expect(res.cacheHitCount).toBe(0);
      expect(res.cacheHitBytes).toBe(0);
      expect(res.opaqueResourceCount).toBe(0);
      expect(res.opaqueResourceOrigins).toEqual([]);

      // Test extractHttpOrigin directly
      expect(extractHttpOrigin('data:text/html;base64,AAA')).toBe('');
      expect(extractHttpOrigin('blob:https://example.com/uuid')).toBe('');
      expect(extractHttpOrigin('about:blank')).toBe('');
      expect(extractHttpOrigin('javascript:void(0)')).toBe('');
    });
  });

  describe('5. Adversarial Scenario: Malformed URLs', () => {
    it('verifies malformed and edge-case URLs do not throw TypeError', () => {
      const malformedResources: PerformanceResourceTiming[] = [
        {
          name: 'invalid-url:///',
          initiatorType: 'other',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
        {
          name: '',
          initiatorType: 'other',
          transferSize: 100,
          encodedBodySize: 80,
          decodedBodySize: 200,
        },
        {
          name: '   ',
          initiatorType: 'other',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
        {
          name: 'https://[invalid-ipv6/test.js',
          initiatorType: 'script',
          transferSize: 500,
          encodedBodySize: 450,
          decodedBodySize: 1200,
        },
        {
          // Relative path without base origin
          name: '/static/bundle.js',
          initiatorType: 'script',
          transferSize: 2000,
          encodedBodySize: 1900,
          decodedBodySize: 6000,
        },
      ] as unknown as PerformanceResourceTiming[];

      // Call without pageUrl or base origin
      expect(() => {
        const res = aggregateResourceMetrics(malformedResources, undefined, undefined);
        expect(res.totalRequests).toBe(5);
        expect(res.wireTransferBytes).toBe(100 + 500 + 2000);
        expect(res.decodedBytes).toBe(200 + 1200 + 6000);
      }).not.toThrow();

      // Call with pageUrl
      expect(() => {
        const resWithBase = aggregateResourceMetrics(malformedResources, undefined, PAGE_URL);
        expect(resWithBase.totalRequests).toBe(5);
        // Relative url '/static/bundle.js' resolves to https://example.com/static/bundle.js, same-origin
        expect(resWithBase.wireTransferBytes).toBe(100 + 500 + 2000);
      }).not.toThrow();

      // extractHttpOrigin robustness directly
      expect(extractHttpOrigin('')).toBe('');
      expect(extractHttpOrigin(undefined)).toBe('');
      expect(extractHttpOrigin('htp:not-url')).toBe('');
      expect(extractHttpOrigin('file:///etc/passwd')).toBe('');
      expect(extractHttpOrigin('ws://localhost:8080')).toBe('');
    });
  });

  describe('6. Adversarial Scenario: 304 Not Modified Revalidation', () => {
    it('verifies wire bytes = transferSize (250) and decoded = decodedBodySize (30000)', () => {
      const revalidatedResource: PerformanceResourceTiming[] = [
        {
          name: 'https://example.com/assets/app.chunk.js',
          initiatorType: 'script',
          transferSize: 250,
          encodedBodySize: 10000,
          decodedBodySize: 30000,
        } as unknown as PerformanceResourceTiming,
      ];

      const res = aggregateResourceMetrics(revalidatedResource, undefined, PAGE_URL);

      // Wire bytes must reflect the actual 304 header packet (250 bytes)
      expect(res.wireTransferBytes).toBe(250);
      // Decoded bytes in browser memory is 30,000 bytes
      expect(res.decodedBytes).toBe(30000);
      // 304 revalidation involves a network round-trip, so cacheHitCount is 0
      expect(res.cacheHitCount).toBe(0);
      expect(res.cacheHitBytes).toBe(0);
      expect(res.opaqueResourceCount).toBe(0);

      // Verify category breakdown reflects this accurately
      expect(res.categoryBreakdown.scripts?.wireBytes).toBe(250);
      expect(res.categoryBreakdown.scripts?.decodedBytes).toBe(30000);
      expect(res.categoryBreakdown.scripts?.cacheHitCount).toBe(0);
    });
  });

  describe('7. Categorization Stress Probes', () => {
    it('categorizes all resource types across queries, hashes, and initiatorTypes', () => {
      const entries: Array<[string, string, string]> = [
        ['https://example.com/lib.min.js?v=1.2.3', 'script', 'scripts'],
        ['https://example.com/chunk.mjs#hash', '', 'scripts'],
        ['https://example.com/styles.css?theme=dark', 'link', 'stylesheets'],
        ['https://example.com/theme.scss', '', 'stylesheets'],
        ['https://example.com/logo.webp?w=200', 'img', 'images'],
        ['https://example.com/photo.jpeg', '', 'images'],
        ['https://example.com/intro.mp4', 'video', 'media'],
        ['https://example.com/sound.ogg', 'audio', 'media'],
        ['https://example.com/inter.woff2', 'font', 'fonts'],
        ['https://example.com/roboto.ttf', '', 'fonts'],
        ['https://example.com/api/v1/graphql', 'fetch', 'fetch/xhr'],
        ['https://example.com/api/v1/users', 'xmlhttprequest', 'fetch/xhr'],
        ['https://example.com/archive.zip', 'other', 'other'],
      ];

      for (const [name, initiatorType, expectedCategory] of entries) {
        const cat = categorizeResource({
          name,
          initiatorType,
        } as PerformanceResourceTiming);
        expect(cat).toBe(expectedCategory);
      }
    });
  });

  describe('8. PerformanceCollector Integration Stress Tests', () => {
    it('collects performance data accurately with mock window and performance entries', () => {
      const collector = new PerformanceCollector();

      const mockNav = {
        name: PAGE_URL,
        entryType: 'navigation',
        startTime: 0,
        domainLookupStart: 10,
        domainLookupEnd: 30,
        connectStart: 30,
        connectEnd: 60,
        requestStart: 60,
        responseStart: 120,
        domContentLoadedEventEnd: 300,
        loadEventEnd: 500,
        transferSize: 5000,
        encodedBodySize: 4500,
        decodedBodySize: 20000,
      };

      const mockResources = [
        {
          name: 'https://example.com/script.js',
          initiatorType: 'script',
          transferSize: 15000,
          encodedBodySize: 14000,
          decodedBodySize: 50000,
        },
        {
          name: 'https://example.com/cached.css',
          initiatorType: 'link',
          transferSize: 0,
          encodedBodySize: 8000,
          decodedBodySize: 32000,
        },
        {
          name: 'https://adservice.google.com/ad.js',
          initiatorType: 'script',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
      ];

      const mockPaints = [
        { name: 'first-paint', startTime: 150 },
        { name: 'first-contentful-paint', startTime: 200 },
      ];

      const mockPerf = {
        getEntriesByType: (type: string) => {
          if (type === 'navigation') return [mockNav];
          if (type === 'resource') return mockResources;
          if (type === 'paint') return mockPaints;
          return [];
        },
      };

      const mockContext: CollectorContext = {
        url: PAGE_URL,
        document: {} as Document,
        window: {
          performance: mockPerf,
          location: { href: PAGE_URL, origin: PAGE_ORIGIN },
        } as unknown as Window,
      };

      const result = collector.collect(mockContext);

      expect(result.status).toBe('completed');
      expect(result.data).toBeDefined();
      const data = result.data!;
      expect(data.resourceCount).toBe(4); // 3 resources + 1 navigation
      expect(data.wireTransferBytes).toBe(5000 + 15000); // 20000
      expect(data.transferSizeApprox).toBe(20000);
      expect(data.decodedBytes).toBe(20000 + 50000 + 32000); // 102000
      expect(data.decodedSizeApprox).toBe(102000);
      expect(data.cacheHitCount).toBe(1);
      expect(data.cacheHitBytes).toBe(8000);
      expect(data.opaqueResourceCount).toBe(1);
      expect(data.opaqueResourceOrigins).toEqual(['https://adservice.google.com']);
      expect(data.navigationTiming?.dnsLookupMs).toBe(20);
      expect(data.navigationTiming?.tcpConnectMs).toBe(30);
      expect(data.navigationTiming?.ttfbMs).toBe(60);
      expect(data.paintTiming?.fcpMs).toBe(200);
    });

    it('gracefully handles missing performance API or exceptions', () => {
      const collector = new PerformanceCollector();
      const emptyContext: CollectorContext = {
        url: PAGE_URL,
        document: {} as Document,
        window: {} as unknown as Window,
      };

      const result = collector.collect(emptyContext);

      expect(result.status).toBe('partial');
      expect(result.data).toBeDefined();
      const data = result.data!;
      expect(data.resourceCount).toBe(0);
      expect(data.wireTransferBytes).toBe(0);
      expect(data.decodedBytes).toBe(0);
      expect(data.cacheHitCount).toBe(0);
      expect(data.cacheHitBytes).toBe(0);
      expect(data.opaqueResourceCount).toBe(0);
      expect(data.opaqueResourceOrigins).toEqual([]);
    });

    it('handles legacy window.performance.timing fallback', () => {
      const collector = new PerformanceCollector();
      const legacyTiming = {
        navigationStart: 1000,
        fetchStart: 1000,
        domainLookupStart: 1010,
        domainLookupEnd: 1025,
        connectStart: 1025,
        connectEnd: 1050,
        requestStart: 1050,
        responseStart: 1100,
        domContentLoadedEventEnd: 1300,
        loadEventEnd: 1600,
      };

      const mockContext: CollectorContext = {
        url: PAGE_URL,
        document: {} as Document,
        window: {
          performance: {
            timing: legacyTiming,
            getEntriesByType: (type: string) => [],
          },
          location: { href: PAGE_URL, origin: PAGE_ORIGIN },
        } as unknown as Window,
      };

      const result = collector.collect(mockContext);

      expect(result.status).toBe('completed');
      expect(result.data).toBeDefined();
      expect(result.data!.navigationTiming).toEqual({
        dnsLookupMs: 15,
        tcpConnectMs: 25,
        ttfbMs: 50,
        domLoadMs: 300,
        fullLoadMs: 600,
      });
    });
  });
});
