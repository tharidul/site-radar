
import type { ResponsiveData } from '../../types/inspection';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export const MAX_TAP_TARGET_ELEMENTS = 200;

export class ResponsiveCollector implements PageCollector<ResponsiveData> {
  readonly id = 'responsive';
  readonly name = 'Responsive & Layout Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const win = context.window || (doc.defaultView as Window | null);

    const viewportMeta = doc.querySelector('meta[name="viewport" i]');
    const hasViewportTag = Boolean(viewportMeta);
    const viewportContent = viewportMeta?.getAttribute('content') || undefined;

    const allowsZoom = viewportContent
      ? !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?/i.test(viewportContent)
      : true;

    const interactiveElements = doc.querySelectorAll('a, button, input:not([type="hidden"]), select');
    const sampleLimit = Math.min(interactiveElements.length, MAX_TAP_TARGET_ELEMENTS);
    let undersizedCount = 0;

    // Cap synchronous getBoundingClientRect() calls to prevent layout thrashing on large DOMs
    for (let i = 0; i < sampleLimit; i++) {
      const el = interactiveElements[i];
      if (!el) continue;
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (rect.width < 44 || rect.height < 44) {
            undersizedCount++;
          }
        }
      } catch {
      }
    }

    const tapTargetsEvaluation = {
      total: sampleLimit,
      undersized: undersizedCount,
    };

    let horizontalOverflowDetected = false;

    if (doc.documentElement) {
      const scrollWidth = doc.documentElement.scrollWidth || 0;
      const clientWidth = win?.innerWidth || doc.documentElement.clientWidth || 0;
      if (clientWidth > 0 && scrollWidth > clientWidth + 5) {
        horizontalOverflowDetected = true;
      }
    }

    const data: ResponsiveData = {
      hasViewportTag,
      viewportContent,
      allowsZoom,
      tapTargetsEvaluation,
      horizontalOverflowDetected,
    };

    const limitations = [
      'Tap target bounding rect evaluations reflect the active browser viewport dimension.',
    ];
    if (interactiveElements.length > MAX_TAP_TARGET_ELEMENTS) {
      limitations.push(
        `Evaluated a capped sample of ${MAX_TAP_TARGET_ELEMENTS} of ${interactiveElements.length} interactive elements.`,
      );
    }

    return createCollectionResult<ResponsiveData>({
      module: this.id,
      status: 'completed',
      data,
      coverage: {
        expected: 3,
        collected: 3,
        unavailable: 0,
        supported: true,
      },
      limitations,
      sources: ['DOM:meta[name="viewport"]', 'DOM:getBoundingClientRect', 'DOM:scrollWidth'],
    });
  }
}

export const responsiveCollector = new ResponsiveCollector();
