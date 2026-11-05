/**
 * @file src/crawler/sitemap.ts
 * @description XML Sitemap and Sitemap Index parser and link extractor.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 10, Feature 31.
 */

import type { SitemapEntry } from '@/types/crawler';

export interface ParsedSitemap {
  isIndex: boolean;
  entries: SitemapEntry[];
  subSitemaps: string[];
  nestedSitemaps: string[];
  totalFound: number;
  errors: string[];
}

export interface ParsedSitemapResult extends ParsedSitemap {}

export class SitemapParser {
  private maxEntries: number;

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Static helper for direct parsing with default or custom maxEntries.
   */
  static parse(xmlText: string, maxEntries = 5000): ParsedSitemap {
    const parser = new SitemapParser(maxEntries);
    return parser.parse(xmlText);
  }

  /**
   * Parses raw XML sitemap or sitemap index string.
   */
  parse(xmlContent: string, _sitemapUrl?: string): ParsedSitemap {
    const entries: SitemapEntry[] = [];
    const subSitemaps: string[] = [];
    const errors: string[] = [];
    let isIndex = false;

    if (!xmlContent || !xmlContent.trim()) {
      return {
        isIndex: false,
        entries: [],
        subSitemaps: [],
        nestedSitemaps: [],
        totalFound: 0,
        errors: ['Empty sitemap content'],
      };
    }

    try {
      // Clean CDATA wrappers and decode basic XML entities
      const cleanedXml = xmlContent.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');

      // Determine if this is a sitemapindex or urlset
      isIndex = /<sitemapindex[\s>]/i.test(cleanedXml);

      if (isIndex) {
        // Parse sitemap index: <sitemap><loc>...</loc><lastmod>...</lastmod></sitemap>
        const sitemapBlockRegex = /<sitemap[\s>]([\s\S]*?)<\/sitemap>/gi;
        let match: RegExpExecArray | null;

        while ((match = sitemapBlockRegex.exec(cleanedXml)) !== null && subSitemaps.length < this.maxEntries) {
          const block = match[1] || '';
          const locMatch = /<loc>([\s\S]*?)<\/loc>/i.exec(block);
          if (locMatch && locMatch[1]) {
            const loc = this.decodeXmlEntities(locMatch[1].trim());
            if (loc && !subSitemaps.includes(loc)) {
              subSitemaps.push(loc);
            }
          }
        }
      } else {
        // Parse standard urlset: <url><loc>...</loc><lastmod>...</lastmod><priority>...</priority></url>
        const urlBlockRegex = /<url[\s>]([\s\S]*?)<\/url>/gi;
        let match: RegExpExecArray | null;

        while ((match = urlBlockRegex.exec(cleanedXml)) !== null && entries.length < this.maxEntries) {
          const block = match[1] || '';
          const locMatch = /<loc>([\s\S]*?)<\/loc>/i.exec(block);
          if (!locMatch || !locMatch[1]) continue;

          const loc = this.decodeXmlEntities(locMatch[1].trim());
          const lastmodMatch = /<lastmod>([\s\S]*?)<\/lastmod>/i.exec(block);
          const changefreqMatch = /<changefreq>([\s\S]*?)<\/changefreq>/i.exec(block);
          const priorityMatch = /<priority>([\s\S]*?)<\/priority>/i.exec(block);

          let priority: number | undefined;
          if (priorityMatch && priorityMatch[1]) {
            const parsed = parseFloat(priorityMatch[1].trim());
            if (!isNaN(parsed) && parsed >= 0.0 && parsed <= 1.0) {
              priority = parsed;
            }
          }

          entries.push({
            loc,
            lastmod: lastmodMatch?.[1]?.trim(),
            changefreq: changefreqMatch?.[1]?.trim() as SitemapEntry['changefreq'],
            priority,
          });
        }
      }
    } catch (err: any) {
      errors.push(err?.message || 'XML parsing error in sitemap');
    }

    return {
      isIndex,
      entries,
      subSitemaps,
      nestedSitemaps: subSitemaps,
      totalFound: isIndex ? subSitemaps.length : entries.length,
      errors,
    };
  }

  private decodeXmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
}
