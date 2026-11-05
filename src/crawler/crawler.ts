/**
 * @file src/crawler/crawler.ts
 * @description Bounded same-origin crawler engine with robots.txt adherence,
 * sitemap ingestion, concurrency boundaries, and cancellation support.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 10, Feature 32.
 */

import { BoundedSpider, type SpiderOptions, DEFAULT_CRAWL_LIMITS } from './spider';
import type { CrawlLimits } from '@/types/crawler';

export { DEFAULT_CRAWL_LIMITS };

export class WebsiteCrawler extends BoundedSpider {
  constructor(limitsOrOptions?: Partial<CrawlLimits> | SpiderOptions) {
    super(limitsOrOptions);
  }
}
