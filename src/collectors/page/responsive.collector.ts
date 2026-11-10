
import type { ResponsiveData } from '../../types/inspection';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

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
    let undersizedCount = 0;

    interactiveElements.forEach((el) => {
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (rect.width < 44 || rect.height < 44) {
            undersizedCount++;
          }
        }
      } catch {
      }
    });

    const tapTargetsEvaluation = {
      total: interactiveElements.length,
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
      limitations: [
        'Tap target bounding rect evaluations reflect the active browser viewport dimension.',
      ],
      sources: ['DOM:meta[name="viewport"]', 'DOM:getBoundingClientRect', 'DOM:scrollWidth'],
    });
  }
}

export const responsiveCollector = new ResponsiveCollector();
