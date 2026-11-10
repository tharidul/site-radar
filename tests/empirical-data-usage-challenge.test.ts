import { describe, it, expect } from 'vitest';
import type { PerformanceData, ResourceCategoryMetrics } from '../src/types/inspection';
import { MESSAGE_CHANNELS, type MessageProtocol } from '../src/types/messaging';

/**
 * Representation of PerformanceResourceTiming according to W3C Resource Timing spec
 */
export interface MockResourceTiming {
  name: string;
  initiatorType: string;
  duration: number;
  responseEnd: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  deliveryType?: string;
  nextHopProtocol?: string;
}

/**
 * Mathematical aggregation function implementing Section 6.1 / Section 7 model
 */
export function aggregateMetricsModel(
  resources: MockResourceTiming[],
  pageOrigin: string,
  navigation?: MockResourceTiming,
  cacheByteStrategy: 'section6_encoded_preferred' | 'section7_max' = 'section6_encoded_preferred'
) {
  let wireTransferBytes = 0;
  let decodedBytes = 0;
  let cacheHitBytes = 0;
  let cacheHitCount = 0;
  let opaqueResourceCount = 0;
  const opaqueResourceOrigins = new Set<string>();

  const isCrossOrigin = (entry: MockResourceTiming): boolean => {
    if (navigation && entry === navigation) return false;
    try {
      const url = new URL(entry.name);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
      return url.origin !== pageOrigin;
    } catch {
      return false;
    }
  };

  const allEntries = navigation ? [navigation, ...resources] : resources;

  for (const e of allEntries) {
    if (e.transferSize > 0) {
      // 1. Measured Network Transfer (M)
      wireTransferBytes += e.transferSize;
      decodedBytes += e.decodedBodySize;
    } else if (e.transferSize === 0 && (e.encodedBodySize > 0 || e.decodedBodySize > 0)) {
      // 2. Local Cache Hit (C)
      cacheHitCount++;
      const resourceCacheBytes =
        cacheByteStrategy === 'section7_max'
          ? Math.max(e.encodedBodySize, e.decodedBodySize)
          : e.encodedBodySize || e.decodedBodySize;
      cacheHitBytes += resourceCacheBytes;
      decodedBytes += e.decodedBodySize;
    } else if (e.transferSize === 0 && e.encodedBodySize === 0 && e.decodedBodySize === 0) {
      if (isCrossOrigin(e)) {
        // 3. Opaque Cross-Origin (O)
        opaqueResourceCount++;
        try {
          opaqueResourceOrigins.add(new URL(e.name).origin);
        } catch {
          // ignore invalid
        }
      }
      // 4. Zero-byte non-network (Z) -> ignored from wire & cache
    }
  }

  return {
    totalRequests: allEntries.length,
    wireTransferBytes,
    decodedBytes,
    cacheHitCount,
    cacheHitBytes,
    opaqueResourceCount,
    opaqueResourceOrigins: Array.from(opaqueResourceOrigins),
  };
}

describe('Empirical Verification of Data Usage Mathematical Models & Invariants', () => {
  const PAGE_ORIGIN = 'https://example.com';

  describe('1. Mathematical Invariants from W3C Resource Timing Specs', () => {
    it('Invariant 1: Compressed resources have decodedBodySize > encodedBodySize', () => {
      const textResources: MockResourceTiming[] = [
        {
          name: 'https://example.com/assets/app.js',
          initiatorType: 'script',
          duration: 120,
          responseEnd: 150,
          transferSize: 42300,
          encodedBodySize: 42000,
          decodedBodySize: 185000,
        },
        {
          name: 'https://example.com/assets/styles.css',
          initiatorType: 'link',
          duration: 80,
          responseEnd: 100,
          transferSize: 15300,
          encodedBodySize: 15000,
          decodedBodySize: 72000,
        },
        {
          name: 'https://example.com/api/data.json',
          initiatorType: 'fetch',
          duration: 60,
          responseEnd: 80,
          transferSize: 8300,
          encodedBodySize: 8000,
          decodedBodySize: 35000,
        },
      ];

      for (const res of textResources) {
        expect(res.decodedBodySize).toBeGreaterThan(res.encodedBodySize);
        expect(res.transferSize).toBeGreaterThanOrEqual(res.encodedBodySize);
      }

      const aggregated = aggregateMetricsModel(textResources, PAGE_ORIGIN);
      expect(aggregated.wireTransferBytes).toBe(42300 + 15300 + 8300);
      expect(aggregated.decodedBytes).toBe(185000 + 72000 + 35000);
      expect(aggregated.cacheHitCount).toBe(0);
      expect(aggregated.opaqueResourceCount).toBe(0);
    });

    it('Invariant 2: Local cache hits have transferSize === 0 and encodedBodySize > 0', () => {
      const cachedResources: MockResourceTiming[] = [
        {
          name: 'https://example.com/assets/vendor.js',
          initiatorType: 'script',
          duration: 5,
          responseEnd: 10,
          transferSize: 0,
          encodedBodySize: 120000,
          decodedBodySize: 450000,
          deliveryType: 'cache',
        },
        {
          name: 'https://example.com/assets/hero.webp',
          initiatorType: 'img',
          duration: 2,
          responseEnd: 5,
          transferSize: 0,
          encodedBodySize: 85000,
          decodedBodySize: 85000,
          deliveryType: 'cache',
        },
      ];

      for (const res of cachedResources) {
        expect(res.transferSize).toBe(0);
        expect(res.encodedBodySize).toBeGreaterThan(0);
        expect(res.decodedBodySize).toBeGreaterThan(0);
      }

      // Test Section 6.1 strategy: encodedBodySize || decodedBodySize
      const aggregatedSec6 = aggregateMetricsModel(cachedResources, PAGE_ORIGIN, undefined, 'section6_encoded_preferred');
      expect(aggregatedSec6.wireTransferBytes).toBe(0);
      expect(aggregatedSec6.cacheHitCount).toBe(2);
      expect(aggregatedSec6.cacheHitBytes).toBe(120000 + 85000);
      expect(aggregatedSec6.decodedBytes).toBe(450000 + 85000);
      expect(aggregatedSec6.opaqueResourceCount).toBe(0);

      // Test Section 7 strategy: max(encodedBodySize, decodedBodySize)
      const aggregatedSec7 = aggregateMetricsModel(cachedResources, PAGE_ORIGIN, undefined, 'section7_max');
      expect(aggregatedSec7.cacheHitBytes).toBe(450000 + 85000); // 535,000 bytes
    });

    it('Invariant 3: 304 Not Modified revalidation has 0 < transferSize < encodedBodySize', () => {
      const revalidatedResource: MockResourceTiming = {
        name: 'https://example.com/assets/config.json',
        initiatorType: 'fetch',
        duration: 45,
        responseEnd: 50,
        transferSize: 280,
        encodedBodySize: 15400,
        decodedBodySize: 15400,
      };

      expect(revalidatedResource.transferSize).toBeGreaterThan(0);
      expect(revalidatedResource.transferSize).toBeLessThan(revalidatedResource.encodedBodySize);

      const aggregated = aggregateMetricsModel([revalidatedResource], PAGE_ORIGIN);
      expect(aggregated.wireTransferBytes).toBe(280);
      expect(aggregated.decodedBytes).toBe(15400);
      expect(aggregated.cacheHitCount).toBe(0);
    });

    it('Invariant 4: Cross-origin without TAO has transferSize === 0, encodedBodySize === 0, decodedBodySize === 0', () => {
      const crossOriginOpaqueResources: MockResourceTiming[] = [
        {
          name: 'https://cdn.thirdparty.com/analytics.js',
          initiatorType: 'script',
          duration: 85,
          responseEnd: 90,
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
        {
          name: 'https://adservice.google.com/ads.js',
          initiatorType: 'script',
          duration: 110,
          responseEnd: 115,
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
        {
          name: 'https://fonts.googleapis.com/css2?family=Inter',
          initiatorType: 'link',
          duration: 60,
          responseEnd: 65,
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
      ];

      for (const res of crossOriginOpaqueResources) {
        expect(res.transferSize).toBe(0);
        expect(res.encodedBodySize).toBe(0);
        expect(res.decodedBodySize).toBe(0);
      }

      const aggregated = aggregateMetricsModel(crossOriginOpaqueResources, PAGE_ORIGIN);
      expect(aggregated.wireTransferBytes).toBe(0);
      expect(aggregated.decodedBytes).toBe(0);
      expect(aggregated.cacheHitCount).toBe(0);
      expect(aggregated.cacheHitBytes).toBe(0);
      expect(aggregated.opaqueResourceCount).toBe(3);
      expect(aggregated.opaqueResourceOrigins).toEqual([
        'https://cdn.thirdparty.com',
        'https://adservice.google.com',
        'https://fonts.googleapis.com',
      ]);
    });
  });

  describe('2. Legacy Cache Fallback Defect Contrast Test', () => {
    it('empirically demonstrates how legacy code inflated wire transfer bytes with cached assets', () => {
      const mixedSession: MockResourceTiming[] = [
        {
          name: 'https://example.com/assets/small-fresh.js',
          initiatorType: 'script',
          duration: 50,
          responseEnd: 55,
          transferSize: 5000,
          encodedBodySize: 4700,
          decodedBodySize: 12000,
        },
        {
          name: 'https://example.com/assets/large-cached-bundle.js',
          initiatorType: 'script',
          duration: 2,
          responseEnd: 5,
          transferSize: 0,
          encodedBodySize: 3500000,
          decodedBodySize: 12000000,
        },
      ];

      let legacyTransferSizeApprox = 0;
      let legacyDecodedSizeApprox = 0;
      for (const res of mixedSession) {
        if (res.transferSize) {
          legacyTransferSizeApprox += res.transferSize;
        } else if (res.encodedBodySize) {
          legacyTransferSizeApprox += res.encodedBodySize;
        }
        if (res.decodedBodySize) {
          legacyDecodedSizeApprox += res.decodedBodySize;
        }
      }

      const modern = aggregateMetricsModel(mixedSession, PAGE_ORIGIN);

      expect(legacyTransferSizeApprox).toBe(3505000);
      expect(modern.wireTransferBytes).toBe(5000);
      expect(modern.cacheHitCount).toBe(1);
      expect(modern.cacheHitBytes).toBe(3500000);
      expect(modern.decodedBytes).toBe(12012000);

      const inflationFactor = legacyTransferSizeApprox / modern.wireTransferBytes;
      expect(inflationFactor).toBe(701);
    });
  });

  describe('3. Adversarial Edge Cases and Boundary Probes', () => {
    it('handles same-origin zero-byte HTTP 204 No Content responses', () => {
      const noContentResource: MockResourceTiming = {
        name: 'https://example.com/api/ping',
        initiatorType: 'fetch',
        duration: 30,
        responseEnd: 35,
        transferSize: 220,
        encodedBodySize: 0,
        decodedBodySize: 0,
      };

      const aggregated = aggregateMetricsModel([noContentResource], PAGE_ORIGIN);
      expect(aggregated.wireTransferBytes).toBe(220);
      expect(aggregated.decodedBytes).toBe(0);
      expect(aggregated.cacheHitCount).toBe(0);
      expect(aggregated.opaqueResourceCount).toBe(0);
    });

    it('handles non-network schemes (data: and blob: URLs) without falsely classifying as opaque', () => {
      const nonNetworkResources: MockResourceTiming[] = [
        {
          name: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==',
          initiatorType: 'img',
          duration: 0,
          responseEnd: 0,
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
        {
          name: 'blob:https://example.com/d94e2311-583b-466d-a3d8-111111111111',
          initiatorType: 'img',
          duration: 1,
          responseEnd: 1,
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
        },
      ];

      const aggregated = aggregateMetricsModel(nonNetworkResources, PAGE_ORIGIN);
      expect(aggregated.wireTransferBytes).toBe(0);
      expect(aggregated.decodedBytes).toBe(0);
      expect(aggregated.cacheHitCount).toBe(0);
      expect(aggregated.opaqueResourceCount).toBe(0);
    });

    it('correctly classifies cross-origin resources WITH Timing-Allow-Origin as measured, not opaque', () => {
      const taoPermittedResource: MockResourceTiming = {
        name: 'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
        initiatorType: 'script',
        duration: 65,
        responseEnd: 70,
        transferSize: 11200,
        encodedBodySize: 10900,
        decodedBodySize: 32000,
      };

      const aggregated = aggregateMetricsModel([taoPermittedResource], PAGE_ORIGIN);
      expect(aggregated.wireTransferBytes).toBe(11200);
      expect(aggregated.decodedBytes).toBe(32000);
      expect(aggregated.cacheHitCount).toBe(0);
      expect(aggregated.opaqueResourceCount).toBe(0);
    });

    it('correctly classifies cached cross-origin resources WITH Timing-Allow-Origin as cache hits, not opaque', () => {
      const taoPermittedCachedResource: MockResourceTiming = {
        name: 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
        initiatorType: 'script',
        duration: 3,
        responseEnd: 5,
        transferSize: 0,
        encodedBodySize: 42000,
        decodedBodySize: 130000,
      };

      const aggregated = aggregateMetricsModel([taoPermittedCachedResource], PAGE_ORIGIN);
      expect(aggregated.wireTransferBytes).toBe(0);
      expect(aggregated.decodedBytes).toBe(130000);
      expect(aggregated.cacheHitCount).toBe(1);
      expect(aggregated.cacheHitBytes).toBe(42000);
      expect(aggregated.opaqueResourceCount).toBe(0);
    });

    it('correctly includes PerformanceNavigationTiming root document if provided', () => {
      const navEntry: MockResourceTiming = {
        name: 'https://example.com/',
        initiatorType: 'navigation',
        duration: 350,
        responseEnd: 360,
        transferSize: 18500,
        encodedBodySize: 18000,
        decodedBodySize: 64000,
      };

      const resources: MockResourceTiming[] = [
        {
          name: 'https://example.com/app.js',
          initiatorType: 'script',
          duration: 100,
          responseEnd: 110,
          transferSize: 30000,
          encodedBodySize: 29500,
          decodedBodySize: 90000,
        },
      ];

      const aggregated = aggregateMetricsModel(resources, PAGE_ORIGIN, navEntry);
      expect(aggregated.totalRequests).toBe(2);
      expect(aggregated.wireTransferBytes).toBe(18500 + 30000);
      expect(aggregated.decodedBytes).toBe(64000 + 90000);
    });
  });

  describe('4. Type Contracts Conformance Verification', () => {
    it('verifies PerformanceData interface conforms to dual-metric specification', () => {
      const perfData: PerformanceData = {
        resourceCount: 10,
        transferSizeApprox: 250000,
        decodedSizeApprox: 800000,
        wireTransferBytes: 250000,
        decodedBytes: 800000,
        cacheHitCount: 4,
        cacheHitBytes: 120000,
        opaqueResourceCount: 3,
        opaqueResourceOrigins: ['https://ad.doubleclick.net', 'https://stats.wp.com'],
        categoryBreakdown: {
          script: { count: 5, wireBytes: 150000, decodedBytes: 500000, cacheHitCount: 2, opaqueCount: 1 },
          stylesheet: { count: 2, wireBytes: 40000, decodedBytes: 180000, cacheHitCount: 1, opaqueCount: 0 },
        },
        scrolledWireTransferBytes: 350000,
        scrolledDecodedBytes: 1100000,
        scrolledCacheHitCount: 6,
        scrolledCacheHitBytes: 180000,
        scrolledOpaqueResourceCount: 5,
      };

      expect(perfData.wireTransferBytes).toBe(250000);
      expect(perfData.decodedBytes).toBe(800000);
      expect(perfData.cacheHitCount).toBe(4);
      expect(perfData.opaqueResourceCount).toBe(3);
      expect(perfData.opaqueResourceOrigins?.length).toBe(2);
      expect(perfData.categoryBreakdown?.['script']?.wireBytes).toBe(150000);
    });

    it('verifies MEASURE_SCROLLED_PAGE response channel conforms to scrolled contract', () => {
      type ScrolledMsgResponse = MessageProtocol[typeof MESSAGE_CHANNELS.MEASURE_SCROLLED_PAGE]['response'];

      const response: ScrolledMsgResponse = {
        success: true,
        scrolledResourceCount: 25,
        scrolledWireTransferBytes: 450000,
        scrolledDecodedBytes: 1400000,
        scrolledCacheHitCount: 5,
        scrolledCacheHitBytes: 120000,
        scrolledOpaqueResourceCount: 4,
        isInfiniteScroll: false,
      };

      expect(response.success).toBe(true);
      expect(response.scrolledWireTransferBytes).toBe(450000);
      expect(response.scrolledOpaqueResourceCount).toBe(4);
    });
  });
});
