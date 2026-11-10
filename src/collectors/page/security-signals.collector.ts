
import type { SecuritySignalsData } from '../../types/inspection';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class SecuritySignalsCollector implements PageCollector<SecuritySignalsData> {
  readonly id = 'securitySignals';
  readonly name = 'In-Page Security Signals Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const pageUrl = context.url || (doc.location?.href !== 'about:blank' ? doc.location?.href : '') || '';
    let isHttps = false;
    try {
      isHttps = new URL(pageUrl || 'http://localhost').protocol === 'https:';
    } catch {
      isHttps = false;
    }

    let mixedContentDetected = false;

    if (isHttps) {
      const subresourceElements = doc.querySelectorAll(
        'img[src], script[src], link[href], iframe[src], audio[src], video[src], source[src]',
      );

      subresourceElements.forEach((el) => {
        const rawUrl = el.getAttribute('src') || el.getAttribute('href') || '';
        if (rawUrl.startsWith('http://')) {
          mixedContentDetected = true;
        }
      });
    }

    let totalScripts = 0;
    let sriScripts = 0;
    const externalScripts = doc.querySelectorAll('script[src]');
    externalScripts.forEach((script) => {
      const src = script.getAttribute('src') || '';
      if (!src.startsWith('data:') && !src.startsWith('blob:')) {
        totalScripts++;
        if (script.hasAttribute('integrity') && script.getAttribute('integrity')?.trim()) {
          sriScripts++;
        }
      }
    });

    let totalLinks = 0;
    let sriLinks = 0;
    const externalStyles = doc.querySelectorAll('link[rel="stylesheet" i][href]');
    externalStyles.forEach((link) => {
      totalLinks++;
      if (link.hasAttribute('integrity') && link.getAttribute('integrity')?.trim()) {
        sriLinks++;
      }
    });

    let cspPresent = false;
    let upgradeInsecureRequests = false;

    const cspMeta = doc.querySelectorAll('meta[http-equiv="Content-Security-Policy" i]');
    if (cspMeta.length > 0) {
      cspPresent = true;
      cspMeta.forEach((meta) => {
        const content = (meta.getAttribute('content') || '').toLowerCase();
        if (content.includes('upgrade-insecure-requests')) {
          upgradeInsecureRequests = true;
        }
      });
    }

    const referrerMeta = doc.querySelector('meta[name="referrer" i]');
    const metaReferrerPolicy = referrerMeta?.getAttribute('content')?.trim() || undefined;

    const data: SecuritySignalsData = {
      isHttps,
      mixedContentDetected,
      sriScriptCoverage: {
        total: totalScripts,
        withSri: sriScripts,
      },
      sriLinkCoverage: {
        total: totalLinks,
        withSri: sriLinks,
      },
      upgradeInsecureRequests,
      cspPresent,
      hstsPresent: false,
      metaReferrerPolicy,
    };

    return createCollectionResult<SecuritySignalsData>({
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
        'HTTP response headers (HSTS, X-Frame-Options, server-delivered CSP) require background network observation.',
        'Active mixed content already blocked by browser network layers may not appear in the live DOM.',
      ],
      sources: ['DOM:location.protocol', 'DOM:meta[http-equiv]', 'DOM:subresources'],
    });
  }
}

export const securitySignalsCollector = new SecuritySignalsCollector();
