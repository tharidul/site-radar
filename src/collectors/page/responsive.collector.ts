/**
 * @file src/collectors/page/responsive.collector.ts
 * @description Analyzes viewport configuration, tap target sizing, horizontal overflow, and text-to-HTML content ratio.
 */

import type { ResponsiveData } from '../../types/inspection';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class ResponsiveCollector implements PageCollector<ResponsiveData> {
  readonly id = 'responsive';
  readonly name = 'Responsive & Layout Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const win = context.window || (doc.defaultView as Window | null);

    // 1. Viewport Meta Tag
    const viewportMeta = doc.querySelector('meta[name="viewport" i]');
    const hasViewportTag = Boolean(viewportMeta);
    const viewportContent = viewportMeta?.getAttribute('content') || undefined;

    // 2. Tap Targets Evaluation
    const interactiveElements = doc.querySelectorAll('a, button, input:not([type="hidden"]), select');
    let undersizedCount = 0;

    interactiveElements.forEach((el) => {
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) { // Element is visible
          if (rect.width < 44 || rect.height < 44) {
            undersizedCount++;
          }
        }
      } catch {
        // Handle bounding client rect failures in simulated DOM
      }
    });

    const tapTargetsEvaluation = {
      total: interactiveElements.length,
      undersized: undersizedCount,
    };

    // 3. Horizontal Overflow Detection
    let horizontalOverflowDetected = false;

    if (doc.documentElement) {
      const scrollWidth = doc.documentElement.scrollWidth || 0;
      const clientWidth = win?.innerWidth || doc.documentElement.clientWidth || 0;
      if (clientWidth > 0 && scrollWidth > clientWidth + 5) {
        horizontalOverflowDetected = true;
      }
    }

    // 4. Content Text Metrics
    const rawHtml = doc.documentElement?.innerHTML || '';
    const totalHtmlLength = rawHtml.length;

    let textContent = '';
    if (doc.body) {
      const clone = doc.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('script, style, noscript, svg').forEach((n) => n.remove());
      textContent = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    const words = textContent.length > 0 ? textContent.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;
    const textToHtmlRatio = totalHtmlLength > 0 ? Number((textContent.length / totalHtmlLength).toFixed(4)) : 0;

    const allowsZoom = viewportContent
      ? !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?/i.test(viewportContent)
      : true;

    const data: ResponsiveData = {
      hasViewportTag,
      viewportContent,
      allowsZoom,
      tapTargetsEvaluation,
      horizontalOverflowDetected,
      wordCount,
      textToHtmlRatio,
    };

    return createCollectionResult<ResponsiveData>({
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
        'Tap target bounding rect evaluations reflect the active browser viewport dimension.',
        'Word count and text ratio exclude embedded scripts, stylesheets, and svg paths.',
      ],
      sources: ['DOM:meta[name="viewport"]', 'DOM:getBoundingClientRect', 'DOM:textContent'],
    });
  }
}

export const responsiveCollector = new ResponsiveCollector();
