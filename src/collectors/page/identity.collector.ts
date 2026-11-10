
import type { IdentityData } from '../../types/inspection';
import { redactSecretsFromString } from '../../security/secret-redactor';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class IdentityCollector implements PageCollector<IdentityData> {
  readonly id = 'identity';
  readonly name = 'Page Identity Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const rawUrl = context.url || (doc.location?.href !== 'about:blank' ? doc.location?.href : '') || '';
    
    let sanitizedUrl = rawUrl;
    let origin = '';
    try {
      const parsed = new URL(rawUrl || 'http://localhost');
      parsed.username = '';
      parsed.password = '';
      sanitizedUrl = parsed.toString();
      origin = parsed.origin;
    } catch {
      sanitizedUrl = rawUrl;
      origin = doc.location?.origin || '';
    }

    const rawTitle = doc.title || '';
    const title = redactSecretsFromString(rawTitle.trim());

    const language = doc.documentElement.getAttribute('lang') || undefined;
    const charset = doc.characterSet || doc.querySelector('meta[charset]')?.getAttribute('charset') || undefined;
    const viewport = doc.querySelector('meta[name="viewport" i]')?.getAttribute('content') || undefined;

    let canonical: string | undefined = undefined;
    const canonicalLink = doc.querySelector('link[rel="canonical" i]');
    if (canonicalLink) {
      const rawHref = canonicalLink.getAttribute('href');
      if (rawHref) {
        try {
          const resolved = new URL(rawHref, sanitizedUrl || 'http://localhost');
          resolved.username = '';
          resolved.password = '';
          canonical = resolved.toString();
        } catch {
          canonical = rawHref;
        }
      }
    }

    let faviconUrl: string | undefined = undefined;
    const iconLink = doc.querySelector('link[rel~="icon" i]');
    if (iconLink) {
      const rawIconHref = iconLink.getAttribute('href');
      if (rawIconHref) {
        try {
          const resolvedIcon = new URL(rawIconHref, sanitizedUrl || 'http://localhost');
          faviconUrl = resolvedIcon.toString();
        } catch {
          faviconUrl = rawIconHref;
        }
      }
    }
    if (!faviconUrl && origin && origin !== 'null') {
      faviconUrl = `${origin}/favicon.ico`;
    }

    const data: IdentityData = {
      url: sanitizedUrl,
      origin,
      title,
      language,
      charset,
      viewport,
      canonical,
      canonicalUrl: canonical,
      faviconUrl,
    };

    let collectedCount = 0;
    if (sanitizedUrl) collectedCount++;
    if (origin) collectedCount++;
    if (title) collectedCount++;
    if (language) collectedCount++;
    if (charset) collectedCount++;
    if (viewport) collectedCount++;
    if (canonical) collectedCount++;
    if (faviconUrl) collectedCount++;

    return createCollectionResult<IdentityData>({
      module: this.id,
      status: sanitizedUrl ? 'completed' : 'partial',
      data,
      coverage: {
        expected: 8,
        collected: collectedCount,
        unavailable: 8 - collectedCount,
        supported: true,
      },
      limitations: [
        'Canonical tag may be absent or dynamic.',
        'Favicon falls back to default /favicon.ico if undeclared in markup.',
      ],
      sources: ['DOM:document.location', 'DOM:head>meta', 'DOM:head>link', 'DOM:title'],
    });
  }
}

export const identityCollector = new IdentityCollector();
