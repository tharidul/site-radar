import type { ResourceCategoryMetrics } from '../../types/inspection';

export interface AggregatedMetrics {
  totalRequests: number;
  wireTransferBytes: number;
  decodedBytes: number;
  cacheHitCount: number;
  cacheHitBytes: number;
  opaqueResourceCount: number;
  opaqueResourceOrigins: string[];
  resourceTypes: Record<string, number>;
  categoryBreakdown: Record<string, ResourceCategoryMetrics>;
}

/**
 * Safely extracts the HTTP/HTTPS origin from a URL string, returning '' for
 * invalid URLs, relative URLs without base, or non-HTTP schemes (data, blob, about).
 */
export function extractHttpOrigin(urlStr?: string, baseUrl?: string): string {
  if (!urlStr) return '';
  const trimmed = urlStr.trim();
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('about:') ||
    trimmed.startsWith('javascript:')
  ) {
    return '';
  }

  try {
    const parsed = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    // Non-parseable or malformed URL
  }
  return '';
}

/**
 * Categorizes a PerformanceResourceTiming entry into one of seven canonical groups:
 * 'scripts' | 'stylesheets' | 'images' | 'media' | 'fonts' | 'fetch/xhr' | 'other'
 */
export function categorizeResource(res: PerformanceResourceTiming): string {
  const init = (res.initiatorType || '').toLowerCase();
  const name = (res.name || '').toLowerCase();
  const pathname = name.split(/[?#]/)[0] ?? '';

  // 1. Scripts
  if (
    init === 'script' ||
    /\.(js|mjs|cjs|jsx|ts|tsx)$/.test(pathname) ||
    /\.(js|mjs|cjs|jsx|ts|tsx)($|\?)/.test(name)
  ) {
    return 'scripts';
  }

  // 2. Stylesheets
  if (
    init === 'css' ||
    (init === 'link' && (name.includes('/css') || name.includes('.css'))) ||
    /\.(css|scss|sass|less)$/.test(pathname) ||
    /\.(css|scss|sass|less)($|\?)/.test(name)
  ) {
    return 'stylesheets';
  }

  // 3. Images
  if (
    init === 'img' ||
    init === 'image' ||
    /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|tiff?)$/.test(pathname) ||
    /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|tiff?)($|\?)/.test(name)
  ) {
    return 'images';
  }

  // 4. Media (audio / video)
  if (
    init === 'video' ||
    init === 'audio' ||
    /\.(mp4|webm|ogg|mp3|wav|flac|aac|m4a|m4v|mov)$/.test(pathname) ||
    /\.(mp4|webm|ogg|mp3|wav|flac|aac|m4a|m4v|mov)($|\?)/.test(name)
  ) {
    return 'media';
  }

  // 5. Fonts
  if (
    init === 'font' ||
    /\.(woff2?|ttf|otf|eot)$/.test(pathname) ||
    /\.(woff2?|ttf|otf|eot)($|\?)/.test(name)
  ) {
    return 'fonts';
  }

  // 6. Fetch / XHR
  if (
    init === 'fetch' ||
    init === 'xmlhttprequest'
  ) {
    return 'fetch/xhr';
  }

  // 7. Other
  return 'other';
}

/**
 * Creates an initialized category breakdown mapping with all 7 canonical categories.
 */
function createDefaultCategoryBreakdown(): Record<string, ResourceCategoryMetrics> {
  return {
    scripts: { count: 0, wireBytes: 0, decodedBytes: 0, cacheHitCount: 0, opaqueCount: 0 },
    stylesheets: { count: 0, wireBytes: 0, decodedBytes: 0, cacheHitCount: 0, opaqueCount: 0 },
    images: { count: 0, wireBytes: 0, decodedBytes: 0, cacheHitCount: 0, opaqueCount: 0 },
    media: { count: 0, wireBytes: 0, decodedBytes: 0, cacheHitCount: 0, opaqueCount: 0 },
    fonts: { count: 0, wireBytes: 0, decodedBytes: 0, cacheHitCount: 0, opaqueCount: 0 },
    'fetch/xhr': { count: 0, wireBytes: 0, decodedBytes: 0, cacheHitCount: 0, opaqueCount: 0 },
    other: { count: 0, wireBytes: 0, decodedBytes: 0, cacheHitCount: 0, opaqueCount: 0 },
  };
}

/**
 * Centralized aggregator for Resource Timing and Navigation Timing metrics.
 * Eliminates cache-fallback wire inflation, accounts for local cache hits,
 * tracks opaque cross-origin resources lacking Timing-Allow-Origin, and computes
 * categorized byte totals.
 */
export function aggregateResourceMetrics(
  resources: PerformanceResourceTiming[] = [],
  navigation?: PerformanceNavigationTiming,
  pageUrl?: string
): AggregatedMetrics {
  // Determine page origin defensively
  let pageOrigin = extractHttpOrigin(pageUrl);
  if (!pageOrigin && typeof window !== 'undefined' && window.location?.origin) {
    pageOrigin = extractHttpOrigin(window.location.origin);
  }
  if (!pageOrigin && navigation?.name) {
    pageOrigin = extractHttpOrigin(navigation.name);
  }

  let wireTransferBytes = 0;
  let decodedBytes = 0;
  let cacheHitCount = 0;
  let cacheHitBytes = 0;
  let opaqueResourceCount = 0;
  const opaqueOriginsSet = new Set<string>();
  const resourceTypes: Record<string, number> = {};
  const categoryBreakdown = createDefaultCategoryBreakdown();

  // 1. Account for Navigation Timing entry (HTML document)
  if (navigation) {
    if (navigation.transferSize > 0) {
      wireTransferBytes += navigation.transferSize;
    } else if (
      navigation.transferSize === 0 &&
      (navigation.encodedBodySize > 0 || navigation.decodedBodySize > 0)
    ) {
      cacheHitCount++;
      const cachedBytes =
        navigation.encodedBodySize > 0
          ? navigation.encodedBodySize
          : navigation.decodedBodySize;
      cacheHitBytes += cachedBytes;
    }

    if (navigation.decodedBodySize > 0) {
      decodedBytes += navigation.decodedBodySize;
    }
  }

  // 2. Account for PerformanceResourceTiming entries
  for (const res of resources) {
    const type = res.initiatorType || 'other';
    resourceTypes[type] = (resourceTypes[type] || 0) + 1;

    const cat = categorizeResource(res);
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = {
        count: 0,
        wireBytes: 0,
        decodedBytes: 0,
        cacheHitCount: 0,
        opaqueCount: 0,
      };
    }
    categoryBreakdown[cat].count++;

    const resOrigin = extractHttpOrigin(res.name, pageOrigin || undefined);
    const isCrossOrigin = Boolean(pageOrigin && resOrigin && resOrigin !== pageOrigin);

    if (res.transferSize > 0) {
      // Measured Network Transfer (same-origin or cross-origin with TAO)
      wireTransferBytes += res.transferSize;
      categoryBreakdown[cat].wireBytes += res.transferSize;
    } else if (
      res.transferSize === 0 &&
      (res.encodedBodySize > 0 || res.decodedBodySize > 0)
    ) {
      // Local Cache Hit (disk or memory cache, not over network wire)
      cacheHitCount++;
      const cachedBytes =
        res.encodedBodySize > 0 ? res.encodedBodySize : res.decodedBodySize;
      cacheHitBytes += cachedBytes;
      categoryBreakdown[cat].cacheHitCount++;
    } else if (
      isCrossOrigin &&
      res.transferSize === 0 &&
      res.encodedBodySize === 0 &&
      res.decodedBodySize === 0
    ) {
      // Opaque Cross-Origin: timing and sizes restricted by missing Timing-Allow-Origin
      opaqueResourceCount++;
      categoryBreakdown[cat].opaqueCount++;
      if (resOrigin) {
        opaqueOriginsSet.add(resOrigin);
      }
    }

    if (res.decodedBodySize > 0) {
      decodedBytes += res.decodedBodySize;
      categoryBreakdown[cat].decodedBytes += res.decodedBodySize;
    }
  }

  return {
    totalRequests: resources.length + (navigation ? 1 : 0),
    wireTransferBytes,
    decodedBytes,
    cacheHitCount,
    cacheHitBytes,
    opaqueResourceCount,
    opaqueResourceOrigins: Array.from(opaqueOriginsSet),
    resourceTypes,
    categoryBreakdown,
  };
}
