
import type { StructuredDataInfo } from '../../types/inspection';
import { redactSecrets, redactSecretsFromString } from '../../security/secret-redactor';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class StructuredDataCollector implements PageCollector<StructuredDataInfo> {
  readonly id = 'structuredData';
  readonly name = 'Structured Data & Schema Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const schemas: StructuredDataInfo['schemas'] = [];
    const syntaxErrors: string[] = [];

    let jsonLdCount = 0;
    let microdataCount = 0;
    let rdfaCount = 0;

    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach((script) => {
      jsonLdCount++;
      const rawText = (script.textContent || '').trim();
      if (!rawText) {
        schemas.push({
          type: 'json-ld',
          valid: false,
          errors: ['Empty JSON-LD script block'],
        });
        return;
      }

      try {
        const parsed = JSON.parse(rawText);
        const sanitized = redactSecrets(parsed);
        const contextStr = typeof sanitized === 'object' && sanitized !== null && '@context' in sanitized
          ? String((sanitized as Record<string, unknown>)['@context'])
          : undefined;
        const schemaType = typeof sanitized === 'object' && sanitized !== null && '@type' in sanitized
          ? String((sanitized as Record<string, unknown>)['@type'])
          : undefined;
        const topLevelProps = typeof sanitized === 'object' && sanitized !== null
          ? Object.keys(sanitized)
          : undefined;

        schemas.push({
          type: 'json-ld',
          context: contextStr,
          schemaType,
          valid: true,
          topLevelProperties: topLevelProps,
          rawSnippet: redactSecretsFromString(rawText.slice(0, 300)),
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Invalid JSON';
        syntaxErrors.push(errMsg);
        schemas.push({
          type: 'json-ld',
          valid: false,
          errors: [errMsg],
          rawSnippet: redactSecretsFromString(rawText.slice(0, 300)),
        });
      }
    });

    const microdataElements = doc.querySelectorAll('[itemscope]');
    microdataElements.forEach((el) => {
      microdataCount++;
      const itemType = el.getAttribute('itemtype') || undefined;
      const props: string[] = [];
      el.querySelectorAll('[itemprop]').forEach((propEl) => {
        const propName = propEl.getAttribute('itemprop');
        if (propName) props.push(propName);
      });

      schemas.push({
        type: 'microdata',
        schemaType: itemType,
        valid: Boolean(itemType),
        topLevelProperties: props.length > 0 ? props : undefined,
      });
    });

    const rdfaElements = doc.querySelectorAll('[typeof], [vocab]');
    rdfaElements.forEach((el) => {
      rdfaCount++;
      const typeOf = el.getAttribute('typeof') || undefined;
      const vocab = el.getAttribute('vocab') || undefined;

      schemas.push({
        type: 'rdfa',
        context: vocab,
        schemaType: typeOf,
        valid: Boolean(typeOf || vocab),
      });
    });

    const totalFound = schemas.length;
    const data: StructuredDataInfo = {
      schemas,
      totalFound,
      jsonLdCount,
      microdataCount,
      rdfaCount,
      syntaxErrors: syntaxErrors.length > 0 ? syntaxErrors : undefined,
    };

    return createCollectionResult<StructuredDataInfo>({
      module: this.id,
      status: syntaxErrors.length > 0 ? 'partial' : 'completed',
      data,
      coverage: {
        expected: 3,
        collected: 3,
        unavailable: 0,
        supported: true,
      },
      limitations: [
        'Syntax validity does not guarantee rich-snippet eligibility by search engines.',
        'Snippets are truncated to 300 characters to prevent memory overflow.',
      ],
      sources: ['DOM:script[type="application/ld+json"]', 'DOM:[itemscope]', 'DOM:[typeof]'],
    });
  }
}

export const structuredDataCollector = new StructuredDataCollector();
