/**
 * @file src/types/crawler.ts
 * @description Contracts, boundary limits, robots.txt directives, sitemap models,
 * and crawl progress data structures for Website Deep Inspection.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 10.
 */

/**
 * Operational boundary constraints for same-origin crawling.
 */
export interface CrawlLimits {
  /** Maximum number of distinct pages to crawl (default: 50) */
  maxPages: number;
  /** Maximum link traversal depth from root seed (default: 3) */
  maxDepth: number;
  /** Maximum number of concurrent page fetches (default: 2) */
  concurrency: number;
  /** Timeout in milliseconds per page request (default: 15000) */
  perPageTimeoutMs: number;
  /** Maximum number of XML sitemap URLs to parse (default: 5000) */
  maxSitemapEntries: number;
  /** Number of retries allowed for failed network requests (default: 1) */
  retryCount: number;
  /** Maximum number of HTTP redirects to follow per page (default: 5) */
  maxRedirects: number;
  /** Strict same-origin crawl boundary (default: true) */
  sameOriginOnly: boolean;
}

/**
 * State machine status of the crawler engine.
 */
export type CrawlStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'paused'
  | 'aborted'
  | 'error';

/**
 * Directives parsed from the target origin's robots.txt file.
 */
export interface RobotsDirectives {
  /** Target User-Agent matching our inspection (e.g. '*' or specific) */
  userAgent: string;
  /** List of path prefixes explicitly allowed */
  allowed: string[];
  /** List of path prefixes explicitly disallowed */
  disallowed: string[];
  /** Discovered sitemap URLs referenced in robots.txt */
  sitemaps: string[];
  /** Crawl delay directive in seconds, if specified */
  crawlDelay?: number;
}

/**
 * Entry extracted from an XML sitemap.
 */
export interface SitemapEntry {
  /** Full URL of the sitemap location */
  loc: string;
  /** Last modification date ISO string, if provided */
  lastmod?: string;
  /** Change frequency hint */
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  /** Crawl priority between 0.0 and 1.0 */
  priority?: number;
}

/**
 * Explicit reasons for excluding a URL from the crawl queue.
 */
export type CrawlExclusionReason =
  | 'out-of-scope'
  | 'scheme-disallowed'
  | 'max-depth-exceeded'
  | 'max-pages-reached'
  | 'robots-disallowed'
  | 'redirect-limit-exceeded'
  | 'invalid-url'
  | 'private-ip'
  | 'timeout'
  | 'error';

/**
 * Record of a URL excluded from the crawl traversal.
 */
export interface ExcludedUrl {
  /** URL that was rejected */
  url: string;
  /** Governing exclusion reason */
  reason: CrawlExclusionReason;
  /** Diagnostic detail */
  details?: string;
}

/**
 * Summary of an individually crawled page.
 */
export interface CrawledPage {
  /** Requested page URL */
  url: string;
  /** Normalized canonical URL */
  normalizedUrl: string;
  /** Crawl tree depth at which this page was discovered */
  depth: number;
  /** HTTP response status code or 'error' */
  status: number | 'error';
  /** Detected MIME content type */
  mimeType?: string;
  /** Error message if fetch failed */
  error?: string;
  /** Page title if parsed */
  title?: string;
  /** Referring parent URL */
  parentUrl?: string;
  /** Request duration in milliseconds */
  durationMs: number;
  /** Number of internal links discovered on this page */
  linksFound: number;
}

/**
 * Live crawl execution progress indicators.
 */
export interface CrawlProgress {
  /** Total pages where inspection fetch was initiated */
  pagesAttempted: number;
  /** Total pages successfully audited */
  pagesCompleted: number;
  /** Number of discovered URLs currently waiting in the crawl queue */
  pagesQueued: number;
  /** Current active traversal depth */
  currentDepth: number;
  /** List of URLs excluded with corresponding justification */
  excludedUrls: ExcludedUrl[];
  /** Currently active in-flight request URLs */
  activeUrls: string[];
}

/**
 * Comprehensive outcome returned upon completion of deep crawl.
 */
export interface CrawlResult {
  /** Target origin crawled */
  origin: string;
  /** Epoch start time in milliseconds */
  startedAt: number;
  /** Epoch finish time in milliseconds */
  finishedAt: number;
  /** Final status of the crawl run */
  status: CrawlStatus;
  /** List of audited pages */
  pages: CrawledPage[];
  /** Discovered sitemaps */
  sitemaps: string[];
  /** Evaluated robots.txt directives */
  robots?: RobotsDirectives;
  /** Crawl coverage and exclusions summary */
  progress: CrawlProgress;
  /** Fatal error message if crawl failed */
  error?: string;
}
