# Project: SiteRadar Page Vitals Data Usage Accuracy & Transparency

## Architecture
- **Framework & Stack**: WXT (Web Extension Tools) 0.21.5 with Vite, React 19, TypeScript, Tailwind CSS, Vitest with `happy-dom`.
- **Runtime Targets**: Google Chrome (MV3 service worker) and Mozilla Firefox (MV3 background script).
- **Core Principles**:
  - Zero-backend, local-first runtime. No remote server, no external database, no user accounts.
  - Zero invasive permissions: operates strictly via standard Web APIs (`PerformanceResourceTiming`, `PerformanceNavigationTiming`) without requiring intrusive `"debugger"` (CDP) or `"webRequest"` permissions.
  - Measurement Accuracy: accurately distinguishes network wire transfer bytes (compressed over-the-wire) from decoded uncompressed bytes in memory.
  - Cache Isolation: local cache hits (`transferSize === 0`) are accounted for as cache hits, never falsely added into network wire transfer totals.
  - Opaque Resource Accounting: cross-origin resources lacking `Timing-Allow-Origin` (TAO) headers are tracked explicitly (`opaqueResourceCount`) and clearly disclosed to users rather than silently counted as zero-byte downloads.
  - User Transparency: UI presents dual-metric data usage (`Wire` vs `Decoded`), cache hit badges, and informative TAO disclaimers with tooltips.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Authoritative Validation Report | Technical report on wire vs decoded bytes, TAO blind spot, DevTools vs webRequest vs CDP, and recommendations | M1 | Requirement R1 |
| 2 | Unified Metrics Type Contracts | `PerformanceData` schema with explicit `wireTransferBytes`, `decodedBytes`, `cachedResourceCount`, `taoRestrictedCount`, `categorizedUsage` | M1 | Requirement R1, R2 |
| 3 | Shared Resource Aggregator Engine | Centralized `aggregateResourceMetrics` function computing wire, decoded, cache, and opaque metrics | M2 | Requirement R2 |
| 4 | Performance Collector Modernization | Update `performance.collector.ts` to use shared aggregator, removing cache-fallback wire inflation | M2 | Requirement R2 |
| 5 | Scrolled Page Resource Aggregation | Update `entrypoints/content.ts` and orchestrator to track full-page lazy-loaded wire and decoded metrics | M2 | Requirement R2 |
| 6 | Page Vitals Card Dual-Metric UI | Display both Wire Transfer and Decoded uncompressed data usage in `PageVitalsCard.tsx` | M3 | Requirement R3 |
| 7 | TAO-Restricted Indicator & Tooltip | Clear warning badge and explanatory tooltip for cross-origin resources lacking TAO headers | M3 | Requirement R3 |
| 8 | Cache Hit Indicator & Badges | Badge showing count and size of assets served from browser cache | M3 | Requirement R3 |
| 9 | Scrolled Lazy-Load Delta UI | Transparent initial viewport vs full-page scrolled data usage comparison | M3 | Requirement R3 |
| 10 | Collector & Aggregator Unit Tests | Vitest suite testing wire vs decoded sizes, cache hits, 304 revalidation, and opaque cross-origin resources | M4 | Requirement R4 |
| 11 | Page Vitals Card Component Tests | Unit tests verifying UI rendering of wire/decoded metrics, TAO warnings, and cache badges | M4 | Requirement R4 |
| 12 | Empirical Validation Test Harness | Multi-origin local test fixture and empirical validation script comparing against DevTools Network tab | M4 | Requirement R4 |
| 13 | Build & Regression Pass | Verify all test suites pass (`npm test`) and production build completes cleanly (`npm run build`) | M4 | Requirement R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Technical Validation Report & Data Contracts | Features 1, 2 | none | DONE |
| M2 | Data Collection & Resource Aggregation Engine | Features 3, 4, 5 | M1 | DONE |
| M3 | UI Clarity, Transparency & Disclaimer Badges | Features 6, 7, 8, 9 | M2 | IN_PROGRESS |
| M4 | Automated Test Suites, Empirical Validation & Build Pass | Features 10, 11, 12, 13 | M1, M2, M3 | PLANNED |

## Interface Contracts
### `src/types/inspection.ts`
```typescript
export interface ResourceCategoryMetrics {
  count: number;
  wireBytes: number;
  decodedBytes: number;
  cacheHitCount: number;
  opaqueCount: number;
}

export interface PerformanceData {
  navigationTiming?: {
    dnsLookupMs: number;
    tcpConnectMs: number;
    tlsHandshakeMs?: number;
    ttfbMs: number;
    domLoadMs: number;
    fullLoadMs: number;
  };
  paintTiming?: {
    fcpMs?: number;
    fpMs?: number;
  };
  webVitals?: {
    lcpMs?: number;
    clsScore?: number;
    inpMs?: number;
  };
  resourceCount: number;
  // Backward compatibility fields
  transferSizeApprox?: number;
  decodedSizeApprox?: number;
  // Enhanced byte metrics
  wireTransferBytes?: number;
  decodedBytes?: number;
  // Cache & Opaque tracking
  cacheHitCount?: number;
  cacheHitBytes?: number;
  opaqueResourceCount?: number;
  opaqueResourceOrigins?: string[];
  resourceTypes?: Record<string, number>;
  categoryBreakdown?: Record<string, ResourceCategoryMetrics>;
  // Scrolled full-page metrics
  scrolledResourceCount?: number;
  scrolledTransferSizeApprox?: number;
  scrolledDecodedSizeApprox?: number;
  scrolledWireTransferBytes?: number;
  scrolledDecodedBytes?: number;
  scrolledCacheHitCount?: number;
  scrolledCacheHitBytes?: number;
  scrolledOpaqueResourceCount?: number;
  isInfiniteScrollDetected?: boolean;
}
```

### `src/collectors/page/resource-aggregator.ts`
```typescript
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

export function aggregateResourceMetrics(
  resources: PerformanceResourceTiming[],
  navigation?: PerformanceNavigationTiming,
  pageUrl?: string
): AggregatedMetrics;
```

## Code Layout
```
├── docs/
│   └── reports/
│       └── data-usage-validation-report.md # Comprehensive R1 technical report
├── entrypoints/
│   ├── background.ts                       # Service worker
│   ├── content.ts                          # Content script: collector dispatch & scroll measurement
│   └── popup/
│       └── components/
│           ├── PageVitalsCard.tsx          # Page Vitals & Data Usage display
│           └── OverviewDashboard.tsx       # Main dashboard embedding PageVitalsCard
├── src/
│   ├── types/
│   │   ├── inspection.ts                   # PerformanceData & ResourceCategoryMetrics
│   │   └── messaging.ts                    # MEASURE_SCROLLED_PAGE contract
│   ├── collectors/
│   │   └── page/
│   │       ├── performance.collector.ts    # Page performance collector
│   │       └── resource-aggregator.ts      # Shared resource timing aggregation engine
│   └── core/
│       └── orchestrator/
│           └── inspection-orchestrator.ts  # Orchestrates collection & attaches scrolled data
└── tests/
    ├── performance-collector.test.ts       # Unit tests for collector & aggregator
    ├── page-vitals.test.tsx                # PageVitalsCard rendering & UI tests
    └── fixtures/
        └── mock-fixture-server.mjs         # Multi-origin empirical test fixture
```
