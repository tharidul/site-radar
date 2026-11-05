/**
 * @file src/collectors/page/links.collector.ts
 * @description Analyzes anchor links, tabnabbing vulnerabilities, protocol schemes, and internal/external boundaries.
 */

import type { LinksData, LinkItem } from '../../types/inspection';
import { redactSecretsFromString } from '../../security/secret-redactor';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class LinksCollector implements PageCollector<LinksData> {
  readonly id = 'links';
  readonly name = 'Links Inventory & Security Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const pageUrl = context.url || (doc.location?.href !== 'about:blank' ? doc.location?.href : '') || '';
    let pageOrigin = '';
    try {
      pageOrigin = new URL(pageUrl || 'http://localhost').origin;
    } catch {
      pageOrigin = '';
    }

    const anchorElements = doc.querySelectorAll('a, area');
    const totalLinks = anchorElements.length;

    const internalLinks: LinkItem[] = [];
    const externalLinks: LinkItem[] = [];
    const invalidProtocols = new Set<string>();
    const protocolCounts: Record<string, number> = {};
    let emptyHrefs = 0;
    let tabnabbingVulnerableCount = 0;

    anchorElements.forEach((el) => {
      const rawHref = el.getAttribute('href');
      if (rawHref === null || rawHref === '' || rawHref === '#') {
        emptyHrefs++;
      }

      if (!rawHref) return;

      const trimmedHref = rawHref.trim();
      const rawText = (el.textContent || '').trim();
      const text = redactSecretsFromString(rawText).slice(0, 100);
      const rel = el.getAttribute('rel') || undefined;
      const target = el.getAttribute('target') || undefined;

      // Protocol analysis
      let protocol = '';
      const schemeMatch = trimmedHref.match(/^([a-zA-Z0-9+.-]+):/);
      if (schemeMatch && schemeMatch[1]) {
        protocol = schemeMatch[1].toLowerCase() + ':';
      } else {
        protocol = 'relative:';
      }

      protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1;

      if (['javascript:', 'data:', 'file:', 'vbscript:'].includes(protocol)) {
        invalidProtocols.add(protocol);
      }

      let isExternal = false;
      let sanitizedHref = trimmedHref;

      if (protocol === 'http:' || protocol === 'https:' || protocol === 'relative:') {
        try {
          const resolved = new URL(trimmedHref, pageUrl || 'http://localhost');
          resolved.username = '';
          resolved.password = '';
          sanitizedHref = resolved.toString();
          isExternal = Boolean(pageOrigin && resolved.origin !== pageOrigin);
        } catch {
          sanitizedHref = redactSecretsFromString(trimmedHref);
        }
      }

      const relLower = (rel || '').toLowerCase();
      const hasNoopener = relLower.includes('noopener');
      const hasNoreferrer = relLower.includes('noreferrer');

      // Check tabnabbing
      const isVulnerableTabnabbing = Boolean(target === '_blank' && isExternal && !hasNoopener && !hasNoreferrer);
      if (isVulnerableTabnabbing) {
        tabnabbingVulnerableCount++;
      }

      const linkItem: LinkItem = {
        url: sanitizedHref,
        text: text || undefined,
        rel,
        target,
        isExternal,
        isVulnerableTabnabbing,
        hasNoopener,
        hasNoreferrer,
      };

      if (isExternal) {
        if (externalLinks.length < 100) externalLinks.push(linkItem);
      } else {
        if (internalLinks.length < 100) internalLinks.push(linkItem);
      }
    });

    const data: LinksData = {
      totalLinks,
      internalLinks,
      externalLinks,
      invalidProtocols: Array.from(invalidProtocols),
      emptyHrefs,
      internalCount: internalLinks.length,
      externalCount: externalLinks.length,
      tabnabbingVulnerableCount,
      protocolCounts,
    };

    return createCollectionResult<LinksData>({
      module: this.id,
      status: 'completed',
      data,
      coverage: {
        expected: 5,
        collected: 5,
        unavailable: 0,
        supported: true,
      },
      limitations: [
        'DOM link presence does not verify HTTP response code (200 OK) or server reachability.',
        'Sample lists are capped at 100 entries each to conserve memory.',
      ],
      sources: ['DOM:a[href]', 'DOM:area[href]'],
    });
  }
}

export const linksCollector = new LinksCollector();
