
import { BoundedSpider, type SpiderOptions, DEFAULT_CRAWL_LIMITS } from './spider';
import type { CrawlLimits } from '@/types/crawler';

export { DEFAULT_CRAWL_LIMITS };

export class WebsiteCrawler extends BoundedSpider {
  constructor(limitsOrOptions?: Partial<CrawlLimits> | SpiderOptions) {
    super(limitsOrOptions);
  }
}
