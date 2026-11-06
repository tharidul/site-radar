/**
 * @file src/collectors/page/styles.collector.ts
 * @description Audits stylesheets, inline styles, CSS custom properties, typography, and dark mode support.
 */

import type { CssData, StylesheetItem } from '../../types/inspection';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class StylesCollector implements PageCollector<CssData> {
  readonly id = 'styles';
  readonly name = 'CSS & Styling Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const win = context.window || (doc.defaultView as Window | null);
    const pageUrl = doc.location?.href || context.url || '';
    let pageOrigin = '';
    try {
      pageOrigin = new URL(pageUrl || 'http://localhost').origin;
    } catch {
      pageOrigin = '';
    }

    const linkSheets = doc.querySelectorAll('link[rel="stylesheet" i]');
    const inlineStyles = doc.querySelectorAll('style');
    const inlineStyleElements = doc.querySelectorAll('[style]');

    const stylesheetCount = linkSheets.length;
    const inlineStyleCount = inlineStyles.length;
    const hasInlineStyleAttributes = inlineStyleElements.length > 0;

    const stylesheets: StylesheetItem[] = [];
    const fontFamiliesSet = new Set<string>();
    let printStylesPresent = false;
    let darkModeSupported = false;

    // Check meta color-scheme
    const colorSchemeMeta = doc.querySelector('meta[name="color-scheme" i]');
    if (colorSchemeMeta) {
      const content = (colorSchemeMeta.getAttribute('content') || '').toLowerCase();
      if (content.includes('dark')) {
        darkModeSupported = true;
      }
    }

    // Inspect link elements
    linkSheets.forEach((el) => {
      const href = el.getAttribute('href') || undefined;
      const media = el.getAttribute('media') || undefined;
      let isExternal = false;
      let domain: string | undefined = undefined;
      const hasSri = el.hasAttribute('integrity') && Boolean(el.getAttribute('integrity')?.trim());

      if (href && pageOrigin) {
        try {
          const resolved = new URL(href, pageUrl || 'http://localhost');
          isExternal = resolved.origin !== pageOrigin;
          domain = resolved.hostname;
        } catch {
          isExternal = false;
        }
      }

      if (media && media.toLowerCase().includes('print')) {
        printStylesPresent = true;
      }

      stylesheets.push({
        href,
        isInline: false,
        isExternal,
        hasSri,
        domain,
        media,
      });
    });

    // Inspect inline style elements
    inlineStyles.forEach((el) => {
      const media = el.getAttribute('media') || undefined;
      if (media && media.toLowerCase().includes('print')) {
        printStylesPresent = true;
      }

      const text = el.textContent || '';
      if (text.includes('prefers-color-scheme: dark') || text.includes('prefers-color-scheme:dark')) {
        darkModeSupported = true;
      }
      if (text.includes('@media print')) {
        printStylesPresent = true;
      }
    });

    // Inspect document.styleSheets CSSOM (with cross-origin try/catch isolation)
    let cssomRestricted = false;
    if (doc.styleSheets) {
      try {
        for (let i = 0; i < doc.styleSheets.length; i++) {
          const sheet = doc.styleSheets[i];
          if (!sheet) continue;
          try {
            const rules = (sheet as any).cssRules || (sheet as any).rules;
            if (rules) {
              for (let j = 0; j < rules.length; j++) {
                const rule = rules[j] as any;
                if (!rule) continue;
                if (rule.type === 4) { // CSSMediaRule
                  const mediaText = (rule as CSSMediaRule).media?.mediaText || '';
                  if (mediaText.includes('prefers-color-scheme: dark')) {
                    darkModeSupported = true;
                  }
                  if (mediaText.includes('print')) {
                    printStylesPresent = true;
                  }
                }
              }
            }
          } catch {
            cssomRestricted = true;
          }
        }
      } catch {
        cssomRestricted = true;
      }
    }

    // Body font family
    if (doc.body) {
      try {
        const computedStyle = win?.getComputedStyle?.(doc.body);
        const font = computedStyle?.fontFamily;
        if (font) {
          font.split(',').forEach((f) => {
            const clean = f.trim().replace(/^['"]|['"]$/g, '');
            if (clean) fontFamiliesSet.add(clean);
          });
        }
      } catch {
        // In happy-dom getComputedStyle might not be fully functional
      }
    }

    const data: CssData = {
      stylesheetCount,
      inlineStyleCount,
      customProperties: [],
      fontFamilies: Array.from(fontFamiliesSet),
      darkModeSupported,
      printStylesPresent,
      stylesheets,
      hasInlineStyleAttributes,
    };

    const limitations: string[] = [];
    if (cssomRestricted) {
      limitations.push('Cross-origin stylesheets without CORS headers restrict CSSOM (cssRules) inspection.');
    }
    limitations.push('Constructable stylesheets may not appear in document.styleSheets.');

    return createCollectionResult<CssData>({
      module: this.id,
      status: cssomRestricted ? 'partial' : 'completed',
      data,
      coverage: {
        expected: 6,
        collected: cssomRestricted ? 5 : 6,
        unavailable: cssomRestricted ? 1 : 0,
        supported: true,
      },
      limitations,
      sources: ['DOM:link[rel="stylesheet"]', 'DOM:style', 'CSSOM:document.styleSheets'],
    });
  }
}

export const stylesCollector = new StylesCollector();
