/**
 * @file src/collectors/page/metadata.collector.ts
 * @description Extracts search engine optimization (SEO) metadata, OpenGraph, Twitter Cards, and robot directives.
 */

import type { SeoData } from '../../types/inspection';
import { redactSecretsFromString } from '../../security/secret-redactor';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class MetadataCollector implements PageCollector<SeoData> {
  readonly id = 'metadata';
  readonly name = 'SEO & Social Metadata Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const pageUrl = context.url || (doc.location?.href !== 'about:blank' ? doc.location?.href : '') || '';

    // Title
    const rawTitle = (doc.title || '').trim();
    const title = redactSecretsFromString(rawTitle);
    const titleLength = title.length;

    // Description
    const descMeta = doc.querySelector('meta[name="description" i]');
    const rawDesc = descMeta?.getAttribute('content') || undefined;
    const description = rawDesc ? redactSecretsFromString(rawDesc.trim()) : undefined;
    const descriptionLength = description ? description.length : 0;

    // Meta Robots
    const robotsMeta = doc.querySelector('meta[name="robots" i], meta[name="googlebot" i]');
    const metaRobots = robotsMeta?.getAttribute('content') || undefined;
    const robotsContent = (metaRobots || '').toLowerCase();
    const metaRobotsDirectives: string[] = [];
    if (robotsContent.includes('noindex')) metaRobotsDirectives.push('noindex');
    if (robotsContent.includes('nofollow')) metaRobotsDirectives.push('nofollow');
    if (robotsContent.includes('noarchive')) metaRobotsDirectives.push('noarchive');
    if (robotsContent.includes('nosnippet')) metaRobotsDirectives.push('nosnippet');

    // Canonical
    const canonicalEl = doc.querySelector('link[rel="canonical" i]');
    let canonicalUrl: string | undefined = undefined;
    let canonicalMatches = false;
    if (canonicalEl) {
      const rawHref = canonicalEl.getAttribute('href');
      if (rawHref) {
        try {
          const resolved = new URL(rawHref, pageUrl || 'http://localhost');
          resolved.username = '';
          resolved.password = '';
          canonicalUrl = resolved.toString();
          if (pageUrl) {
            const currentUrl = new URL(pageUrl);
            currentUrl.username = '';
            currentUrl.password = '';
            currentUrl.hash = '';
            const testCanonical = new URL(canonicalUrl);
            testCanonical.hash = '';
            canonicalMatches = currentUrl.toString().replace(/\/$/, '') === testCanonical.toString().replace(/\/$/, '');
          }
        } catch {
          canonicalUrl = rawHref;
        }
      }
    }

    // Hreflang Tags
    const hreflangTags: Array<{ lang: string; href: string }> = [];
    doc.querySelectorAll('link[rel="alternate" i][hreflang]').forEach((el) => {
      const lang = el.getAttribute('hreflang') || '';
      const href = el.getAttribute('href') || '';
      if (lang && href) {
        hreflangTags.push({ lang, href });
      }
    });

    // OpenGraph
    const openGraph: Record<string, string> = {};
    doc.querySelectorAll('meta[property^="og:" i]').forEach((el) => {
      const property = el.getAttribute('property') || '';
      const content = el.getAttribute('content') || '';
      if (property) {
        openGraph[property.toLowerCase()] = redactSecretsFromString(content);
      }
    });

    // Twitter Cards
    const twitterCards: Record<string, string> = {};
    doc.querySelectorAll('meta[name^="twitter:" i], meta[property^="twitter:" i]').forEach((el) => {
      const name = el.getAttribute('name') || el.getAttribute('property') || '';
      const content = el.getAttribute('content') || '';
      if (name) {
        twitterCards[name.toLowerCase()] = redactSecretsFromString(content);
      }
    });

    // Structured Data count
    const structuredDataCount = doc.querySelectorAll('script[type="application/ld+json"]').length;

    const data: SeoData = {
      title,
      titleLength,
      description,
      descriptionLength,
      metaRobots,
      metaRobotsDirectives: metaRobotsDirectives.length > 0 ? metaRobotsDirectives : undefined,
      canonicalUrl,
      canonicalMatches,
      hreflangTags,
      openGraph,
      twitterCards,
      structuredDataCount,
    };

    let collectedCount = 0;
    if (title) collectedCount++;
    if (description) collectedCount++;
    if (metaRobots) collectedCount++;
    if (canonicalUrl) collectedCount++;
    if (hreflangTags.length > 0) collectedCount++;
    if (Object.keys(openGraph).length > 0) collectedCount++;
    if (Object.keys(twitterCards).length > 0) collectedCount++;
    if (structuredDataCount > 0) collectedCount++;

    return createCollectionResult<SeoData>({
      module: this.id,
      status: 'completed',
      data,
      coverage: {
        expected: 8,
        collected: collectedCount,
        unavailable: Math.max(0, 8 - collectedCount),
        supported: true,
      },
      limitations: [
        'Search ranking cannot be inferred from client-side markup.',
        'HTTP X-Robots-Tag response header is not observable in DOM.',
      ],
      sources: ['DOM:head>meta', 'DOM:head>link', 'DOM:title'],
    });
  }
}

export const metadataCollector = new MetadataCollector();
