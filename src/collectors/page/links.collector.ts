/**
 * @file src/collectors/page/links.collector.ts
 * @description Analyzes anchor links for actionable security and QA signals:
 * reverse tabnabbing vulnerabilities, dangerous protocols (javascript:, data:),
 * empty hrefs, and internal/external boundary counts. (Pruned: 100-item raw link dump).
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

    const externalLinks: LinkItem[] = [];
    const invalidProtocols = new Set<string>();
    const protocolCounts: Record<string, number> = {};
    let emptyHrefs = 0;
    let tabnabbingVulnerableCount = 0;
    let internalCount = 0;
    let externalCount = 0;

    anchorElements.forEach((el) => {
      const rawHref = el.getAttribute('href');
      if (rawHref === null || rawHref === '' || rawHref === '#') {
        emptyHrefs++;
      }

      if (!rawHref) return;

      const trimmedHref = rawHref.trim();
      const rawText = (el.textContent || '').trim();
      const text = redactSecretsFromString(rawText).slice(0, 80);
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

      if (isExternal) {
        externalCount++;
      } else {
        internalCount++;
      }

      const relLower = (rel || '').toLowerCase();
      const hasNoopener = relLower.includes('noopener');
      const hasNoreferrer = relLower.includes('noreferrer');

      // Check reverse tabnabbing (target="_blank" without noopener)
      const isVulnerableTabnabbing = Boolean(target === '_blank' && isExternal && !hasNoopener && !hasNoreferrer);
      if (isVulnerableTabnabbing) {
        tabnabbingVulnerableCount++;
      }

      // Store only actionable links (vulnerable tabnabbing or sample external links up to 25)
      if (isExternal && (isVulnerableTabnabbing || externalLinks.length < 25)) {
        externalLinks.push({
          url: sanitizedHref,
          text: text || undefined,
          rel,
          target,
          isExternal: true,
          isVulnerableTabnabbing,
          hasNoopener,
          hasNoreferrer,
        });
      }
    });

    const data: LinksData = {
      totalLinks,
      internalLinks: [], // Zero bloat: raw internal links omitted
      externalLinks,
      invalidProtocols: Array.from(invalidProtocols),
      emptyHrefs,
      internalCount,
      externalCount,
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
        'Link presence does not verify destination server reachability or HTTP 200 response.',
      ],
      sources: ['DOM:a[href]', 'DOM:area[href]'],
    });
  }
}

export const linksCollector = new LinksCollector();
