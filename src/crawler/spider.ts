
import type {
  CrawlLimits,
  CrawlProgress,
  CrawlResult,
  CrawledPage,
  ExcludedUrl,
  RobotsDirectives,
} from '@/types/crawler';
import { validateScheme } from '@/security/scheme-validator';
import { normalizeUrl } from '@/security/url-normalizer';
import { validatePublicUrl } from '@/security/private-network.guard';
import { RobotsParser } from './robots';

export const DEFAULT_CRAWL_LIMITS: CrawlLimits = {
  maxPages: 50,
  maxDepth: 3,
  concurrency: 2,
  perPageTimeoutMs: 15000,
  maxSitemapEntries: 5000,
  retryCount: 1,
  maxRedirects: 5,
  sameOriginOnly: true,
};

interface QueueItem {
  url: string;
  depth: number;
  parentUrl?: string;
}

export interface SpiderOptions {
  limits?: Partial<CrawlLimits>;
  signal?: AbortSignal;
  onProgress?: (progress: CrawlProgress) => void;
}

export class BoundedSpider {
  protected limits: CrawlLimits;
  protected signal?: AbortSignal;
  protected onProgress?: (progress: CrawlProgress) => void;
  protected robotsParser = new RobotsParser();
  protected activeAbortController: AbortController | null = null;

  constructor(options?: SpiderOptions | Partial<CrawlLimits>) {
    if (options && 'limits' in options) {
      this.limits = { ...DEFAULT_CRAWL_LIMITS, ...options.limits };
      this.signal = options.signal;
      this.onProgress = options.onProgress;
    } else {
      this.limits = { ...DEFAULT_CRAWL_LIMITS, ...(options as Partial<CrawlLimits>) };
    }
  }

  setRobotsDirectives(directives: RobotsDirectives): void {
    const rawLines = [
      `User-agent: ${directives.userAgent}`,
      ...directives.disallowed.map((d) => `Disallow: ${d}`),
      ...directives.allowed.map((a) => `Allow: ${a}`),
      ...directives.sitemaps.map((s) => `Sitemap: ${s}`),
    ].join('\n');
    this.robotsParser.parse(rawLines);
  }

  abort(): void {
    this.activeAbortController?.abort('Cancelled by caller');
  }

  async crawl(seedUrl: string, externalSignal?: AbortSignal): Promise<CrawlResult> {
    const startedAt = Date.now();
    this.activeAbortController = new AbortController();

    const effectiveSignal = externalSignal || this.signal;
    if (effectiveSignal?.aborted) {
      return this.buildEmptyResult(seedUrl, startedAt, 'aborted');
    }

    const onExternalAbort = () => {
      this.activeAbortController?.abort(effectiveSignal?.reason);
    };
    effectiveSignal?.addEventListener('abort', onExternalAbort, { once: true });

    try {
      const schemeCheck = validateScheme(seedUrl);
      if (!schemeCheck.valid) {
        throw new Error(`Invalid seed URL scheme: ${schemeCheck.reason || 'Restricted scheme'}`);
      }

      const normalizedSeed = normalizeUrl(seedUrl);
      const parsedOrigin = new URL(normalizedSeed).origin;

      const seedPublicCheck = await validatePublicUrl(seedUrl);
      if (!seedPublicCheck.valid) {
        return this.buildEmptyResult(seedUrl, startedAt, 'error', `SSRF Blocked: ${seedPublicCheck.reason}`);
      }

      try {
        const robotsUrl = `${parsedOrigin}/robots.txt`;
        const robotsResp = await this.fetchWithTimeout(robotsUrl, 3000);
        if (robotsResp.ok) {
          const robotsTxt = await robotsResp.text();
          this.robotsParser.parse(robotsTxt);
        }
      } catch {
      }

      const visitedUrls = new Set<string>();
      const queuedUrls = new Set<string>();
      const queue: QueueItem[] = [{ url: normalizedSeed, depth: 0 }];
      queuedUrls.add(normalizedSeed);

      const crawledPages: CrawledPage[] = [];
      const excludedUrls: ExcludedUrl[] = [];
      const activeUrls = new Set<string>();

      const progress: CrawlProgress = {
        pagesAttempted: 0,
        pagesCompleted: 0,
        pagesQueued: 1,
        currentDepth: 0,
        excludedUrls,
        activeUrls: [],
      };

      const emitProgress = () => {
        if (this.onProgress) {
          this.onProgress({
            pagesAttempted: progress.pagesAttempted,
            pagesCompleted: progress.pagesCompleted,
            pagesQueued: queue.length,
            currentDepth: progress.currentDepth,
            excludedUrls: [...excludedUrls],
            activeUrls: Array.from(activeUrls),
          });
        }
      };

      emitProgress();

      const inFlight = new Set<Promise<void>>();

      while ((queue.length > 0 || inFlight.size > 0) && crawledPages.length < this.limits.maxPages) {
        if (this.isAborted(effectiveSignal)) break;

        while (
          queue.length > 0 &&
          inFlight.size < this.limits.concurrency &&
          crawledPages.length + inFlight.size < this.limits.maxPages
        ) {
          if (this.isAborted(effectiveSignal)) break;

          const item = queue.shift();
          if (!item) break;

          const { url, depth, parentUrl } = item;
          progress.currentDepth = Math.max(progress.currentDepth, depth);

          if (visitedUrls.has(url)) continue;
          visitedUrls.add(url);

          activeUrls.add(url);
          progress.pagesAttempted++;
          emitProgress();

          const task = (async () => {
            const fetchStartTime = Date.now();
            let pageStatus: number | 'error' = 200;
            let pageTitle: string | undefined;
            let mimeType: string | undefined;
            let errorMessage: string | undefined;
            const discoveredLinks: string[] = [];

            try {
              if (this.isAborted(effectiveSignal)) return;

              const response = await this.fetchWithTimeout(url, this.limits.perPageTimeoutMs);
              pageStatus = response.status;
              mimeType = response.headers.get('content-type') || undefined;

              const responseUrl = response.url;
              let isRedirectViolation = false;

              if (responseUrl && responseUrl !== url) {
                const destPublicCheck = await validatePublicUrl(responseUrl);
                if (!destPublicCheck.valid) {
                  isRedirectViolation = true;
                  pageStatus = 'error';
                  errorMessage = `SSRF Blocked: ${destPublicCheck.reason || 'Private IP'}`;
                  if (!excludedUrls.some((e) => e.url === responseUrl)) {
                    excludedUrls.push({
                      url: responseUrl,
                      reason: 'private-ip',
                      details: destPublicCheck.reason || 'Redirect to private IP blocked',
                    });
                  }
                } else {
                  let destOrigin: string | null = null;
                  try {
                    destOrigin = new URL(responseUrl).origin;
                  } catch {
                    destOrigin = null;
                  }

                  if (this.limits.sameOriginOnly && destOrigin && destOrigin !== parsedOrigin) {
                    isRedirectViolation = true;
                    errorMessage = `Cross-origin redirect to ${destOrigin} out-of-scope`;
                    if (!excludedUrls.some((e) => e.url === responseUrl)) {
                      excludedUrls.push({
                        url: responseUrl,
                        reason: 'out-of-scope',
                        details: `Redirected cross-origin to ${destOrigin}`,
                      });
                    }
                  }
                }
              }

              if (
                !isRedirectViolation &&
                response.ok &&
                mimeType &&
                /text\/html|application\/xhtml\+xml/i.test(mimeType)
              ) {
                const html = await response.text();
                const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
                pageTitle = titleMatch?.[1]?.trim();

                const linkHrefRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["']/gi;
                let match: RegExpExecArray | null;
                while ((match = linkHrefRegex.exec(html)) !== null) {
                  const href = match[1];
                  if (href) discoveredLinks.push(href);
                }
              }
            } catch (err: any) {
              pageStatus = 'error';
              errorMessage = err?.message || 'Network fetch failed';
              if (err?.message?.includes('Redirect limit exceeded')) {
                if (!excludedUrls.some((e) => e.url === url)) {
                  excludedUrls.push({
                    url,
                    reason: 'redirect-limit-exceeded',
                    details: err.message,
                  });
                }
              }
            } finally {
              activeUrls.delete(url);
            }

            const durationMs = Date.now() - fetchStartTime;

            crawledPages.push({
              url,
              normalizedUrl: url,
              depth,
              status: pageStatus,
              mimeType,
              error: errorMessage,
              title: pageTitle,
              parentUrl,
              durationMs,
              linksFound: discoveredLinks.length,
            });

            progress.pagesCompleted++;
            emitProgress();

            if (
              depth < this.limits.maxDepth &&
              crawledPages.length + queue.length < this.limits.maxPages * 2 &&
              !this.isAborted(effectiveSignal)
            ) {
              for (const rawLink of discoveredLinks) {
                try {
                  const resolved = new URL(rawLink, url);
                  const linkOrigin = resolved.origin;

                  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
                    if (!excludedUrls.some((e) => e.url === resolved.href)) {
                      excludedUrls.push({ url: resolved.href, reason: 'scheme-disallowed' });
                    }
                    continue;
                  }

                  if (this.limits.sameOriginOnly && linkOrigin !== parsedOrigin) {
                    if (!excludedUrls.some((e) => e.url === resolved.href)) {
                      excludedUrls.push({ url: resolved.href, reason: 'out-of-scope' });
                    }
                    continue;
                  }

                  const canonical = normalizeUrl(resolved.href);
                  if (visitedUrls.has(canonical) || queuedUrls.has(canonical)) {
                    continue;
                  }

                  if (!this.robotsParser.isAllowed(resolved.pathname)) {
                    if (!excludedUrls.some((e) => e.url === canonical)) {
                      excludedUrls.push({ url: canonical, reason: 'robots-disallowed' });
                    }
                    continue;
                  }

                  const publicCheck = await validatePublicUrl(canonical);
                  if (!publicCheck.valid) {
                    if (!excludedUrls.some((e) => e.url === canonical)) {
                      excludedUrls.push({ url: canonical, reason: 'private-ip', details: publicCheck.reason });
                    }
                    continue;
                  }

                  queuedUrls.add(canonical);
                  queue.push({
                    url: canonical,
                    depth: depth + 1,
                    parentUrl: url,
                  });
                } catch {
                }
              }
            }
          })();

          inFlight.add(task);
          task.finally(() => inFlight.delete(task));
        }

        if (inFlight.size > 0) {
          await Promise.race(Array.from(inFlight));
        }
      }

      if (inFlight.size > 0) {
        await Promise.allSettled(Array.from(inFlight));
      }

      const finishedAt = Date.now();
      const finalStatus = this.isAborted(effectiveSignal) ? 'aborted' : 'completed';

      return {
        origin: parsedOrigin,
        startedAt,
        finishedAt,
        status: finalStatus,
        pages: crawledPages,
        sitemaps: this.robotsParser.getSitemaps(),
        robots: (this.robotsParser as any).allowed.length > 0 || (this.robotsParser as any).disallowed.length > 0
          ? {
              userAgent: (this.robotsParser as any).userAgent || '*',
              allowed: (this.robotsParser as any).allowed || [],
              disallowed: (this.robotsParser as any).disallowed || [],
              sitemaps: this.robotsParser.getSitemaps(),
            }
          : undefined,
        progress,
      };
    } finally {
      if (effectiveSignal) {
        effectiveSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  private isAborted(effectiveSignal?: AbortSignal): boolean {
    return Boolean(this.activeAbortController?.signal.aborted || effectiveSignal?.aborted);
  }

  private async fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const onMainAbort = () => controller.abort();
    this.activeAbortController?.signal.addEventListener('abort', onMainAbort, { once: true });

    try {
      let currentUrl = url;
      let redirectCount = 0;
      let response: Response;

      while (true) {
        response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'WebsiteIntelligenceBot/1.0',
          },
        });

        if (
          [301, 302, 303, 307, 308].includes(response.status) &&
          response.headers.has('location')
        ) {
          redirectCount++;
          if (redirectCount > this.limits.maxRedirects) {
            throw new Error(`Redirect limit exceeded: max ${this.limits.maxRedirects} redirects allowed`);
          }

          const location = response.headers.get('location')!;
          currentUrl = new URL(location, currentUrl).href;
          continue;
        }

        break;
      }

      if (!response.url && currentUrl !== url) {
        Object.defineProperty(response, 'url', { value: currentUrl, configurable: true });
      }

      return response;
    } finally {
      clearTimeout(timer);
      this.activeAbortController?.signal.removeEventListener('abort', onMainAbort);
    }
  }

  private buildEmptyResult(
    seedUrl: string,
    startedAt: number,
    status: CrawlResult['status'],
    error?: string,
  ): CrawlResult {
    let origin = 'https://localhost';
    try {
      origin = new URL(seedUrl).origin;
    } catch {}

    return {
      origin,
      startedAt,
      finishedAt: Date.now(),
      status,
      pages: [],
      sitemaps: [],
      progress: {
        pagesAttempted: 0,
        pagesCompleted: 0,
        pagesQueued: 0,
        currentDepth: 0,
        excludedUrls: [],
        activeUrls: [],
      },
      error,
    };
  }
}
