
import type { CrawlLimits, ExcludedUrl, CrawlExclusionReason } from '@/types/crawler';
import { normalizeUrl } from '@/security/url-normalizer';
import { validateScheme } from '@/security/scheme-validator';

export interface QueueItem {
  url: string;
  normalizedUrl: string;
  depth: number;
  parentUrl?: string;
}

export class CrawlQueue {
  private queue: QueueItem[] = [];
  private seen = new Set<string>();
  private exclusions: ExcludedUrl[] = [];
  private origin: string;
  private limits: CrawlLimits;

  constructor(seedUrl: string, limits: CrawlLimits) {
    this.limits = limits;
    const parsed = new URL(seedUrl);
    this.origin = parsed.origin;

    this.enqueue(seedUrl, 0);
  }

  enqueue(rawUrl: string, depth: number, parentUrl?: string): boolean {
    if (depth > this.limits.maxDepth) {
      this.recordExclusion(rawUrl, 'max-depth-exceeded', `Depth ${depth} exceeds maxDepth ${this.limits.maxDepth}`);
      return false;
    }

    const schemeCheck = validateScheme(rawUrl);
    if (!schemeCheck.valid) {
      this.recordExclusion(rawUrl, 'scheme-disallowed', schemeCheck.reason);
      return false;
    }

    let normalized: string;
    try {
      normalized = normalizeUrl(rawUrl);
    } catch (err) {
      this.recordExclusion(rawUrl, 'invalid-url', err instanceof Error ? err.message : String(err));
      return false;
    }

    if (this.limits.sameOriginOnly) {
      try {
        const u = new URL(normalized);
        if (u.origin !== this.origin) {
          this.recordExclusion(normalized, 'out-of-scope', `Cross-origin URL: ${u.origin} !== ${this.origin}`);
          return false;
        }
      } catch {
        this.recordExclusion(normalized, 'invalid-url', 'Malformed URL');
        return false;
      }
    }

    if (this.seen.has(normalized)) {
      return false;
    }

    if (this.seen.size >= this.limits.maxPages) {
      this.recordExclusion(normalized, 'max-pages-reached', `Crawl capacity limit ${this.limits.maxPages} reached`);
      return false;
    }

    this.seen.add(normalized);
    this.queue.push({
      url: rawUrl,
      normalizedUrl: normalized,
      depth,
      parentUrl,
    });
    return true;
  }

  dequeue(): QueueItem | undefined {
    return this.queue.shift();
  }

  hasPending(): boolean {
    return this.queue.length > 0;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get seenCount(): number {
    return this.seen.size;
  }

  get excludedUrls(): ExcludedUrl[] {
    return [...this.exclusions];
  }

  private recordExclusion(url: string, reason: CrawlExclusionReason, details?: string): void {
    if (this.exclusions.length < 500) {
      this.exclusions.push({ url, reason, details });
    }
  }
}
