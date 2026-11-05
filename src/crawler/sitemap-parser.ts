/**
 * @file src/crawler/sitemap-parser.ts
 * @description XML Sitemap and Sitemap Index parser.
 * Re-exports SitemapParser from sitemap.ts for backwards compatibility.
 */

export { SitemapParser } from './sitemap';
export type { ParsedSitemap, ParsedSitemapResult } from './sitemap';
export type { SitemapEntry } from '@/types/crawler';
