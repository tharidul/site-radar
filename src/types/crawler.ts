
export interface CrawlLimits {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  perPageTimeoutMs: number;
  maxSitemapEntries: number;
  retryCount: number;
  maxRedirects: number;
  sameOriginOnly: boolean;
}

export type CrawlStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'paused'
  | 'aborted'
  | 'error';

export interface RobotsDirectives {
  userAgent: string;
  allowed: string[];
  disallowed: string[];
  sitemaps: string[];
  crawlDelay?: number;
}

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
}

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

export interface ExcludedUrl {
  url: string;
  reason: CrawlExclusionReason;
  details?: string;
}

export interface CrawledPage {
  url: string;
  normalizedUrl: string;
  depth: number;
  status: number | 'error';
  mimeType?: string;
  error?: string;
  title?: string;
  parentUrl?: string;
  durationMs: number;
  linksFound: number;
}

export interface CrawlProgress {
  pagesAttempted: number;
  pagesCompleted: number;
  pagesQueued: number;
  currentDepth: number;
  excludedUrls: ExcludedUrl[];
  activeUrls: string[];
}

export interface CrawlResult {
  origin: string;
  startedAt: number;
  finishedAt: number;
  status: CrawlStatus;
  pages: CrawledPage[];
  sitemaps: string[];
  robots?: RobotsDirectives;
  progress: CrawlProgress;
  error?: string;
}
