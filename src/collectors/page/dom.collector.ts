
import type { DomSemanticData, HeadingItem, LandmarkItem } from '../../types/inspection';
import { redactSecretsFromString } from '../../security/secret-redactor';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class DomCollector implements PageCollector<DomSemanticData> {
  readonly id = 'dom';
  readonly name = 'DOM & Semantic Hierarchy Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const allElements = doc.querySelectorAll('*');
    const elementCount = allElements.length;

    const headingHierarchy: HeadingItem[] = [];
    const headingElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
    let h1Count = 0;
    let headingOrderValid = true;
    let previousLevel = 0;

    headingElements.forEach((el) => {
      let level = 0;
      const tagName = el.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tagName)) {
        level = parseInt(tagName.charAt(1), 10);
      } else {
        const ariaLevel = el.getAttribute('aria-level');
        level = ariaLevel ? parseInt(ariaLevel, 10) : 2;
      }

      if (level === 1) h1Count++;

      if (previousLevel > 0 && level > previousLevel + 1) {
        headingOrderValid = false;
      }
      previousLevel = level;

      const rawText = (el.textContent || '').trim();
      const text = redactSecretsFromString(rawText).slice(0, 150);

      headingHierarchy.push({
        level,
        text,
        id: el.id || undefined,
      });
    });

    const landmarkElements: LandmarkItem[] = [];
    let hasMainLandmark = false;

    const landmarkSelectors = [
      { selector: 'main, [role="main"]', tag: 'main', role: 'main' },
      { selector: 'header, [role="banner"]', tag: 'header', role: 'banner' },
      { selector: 'nav, [role="navigation"]', tag: 'nav', role: 'navigation' },
      { selector: 'aside, [role="complementary"]', tag: 'aside', role: 'complementary' },
      { selector: 'footer, [role="contentinfo"]', tag: 'footer', role: 'contentinfo' },
      { selector: '[role="search"]', tag: 'div', role: 'search' },
    ];

    landmarkSelectors.forEach(({ selector, tag, role }) => {
      const matches = doc.querySelectorAll(selector);
      matches.forEach((el) => {
        if (role === 'main' || tag === 'main') {
          hasMainLandmark = true;
        }
        landmarkElements.push({
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role') || role,
          label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || undefined,
        });
      });
    });

    const hiddenNodes = doc.querySelectorAll('[hidden], [aria-hidden="true"]');
    const hiddenNodeCount = hiddenNodes.length;

    let maxDomDepth = 0;
    function calculateDepth(node: Node, depth: number) {
      if (depth > maxDomDepth) maxDomDepth = depth;
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child && child.nodeType === 1) {
          calculateDepth(child, depth + 1);
        }
      }
    }
    if (doc.documentElement) {
      calculateDepth(doc.documentElement, 1);
    }

    const tablesCount = doc.querySelectorAll('table').length;
    const listsCount = doc.querySelectorAll('ul, ol').length;
    const definitionListsCount = doc.querySelectorAll('dl').length;

    const nativeButtonsCount = doc.querySelectorAll(
      'button, a[href], input[type="button" i], input[type="submit" i]'
    ).length;

    const nonSemanticMatches = doc.querySelectorAll(
      'div[onclick], span[onclick], i[onclick], div[tabindex="0"], span[tabindex="0"]'
    );
    const nonSemanticClickableSamples: string[] = [];
    let nonSemanticClickableCount = 0;

    nonSemanticMatches.forEach((el) => {
      const role = (el.getAttribute('role') || '').toLowerCase();
      if (
        role !== 'button' &&
        role !== 'link' &&
        role !== 'tab' &&
        role !== 'menuitem' &&
        role !== 'checkbox'
      ) {
        nonSemanticClickableCount++;
        if (nonSemanticClickableSamples.length < 5) {
          const id = el.id ? `#${el.id}` : '';
          const cls =
            el.className && typeof el.className === 'string'
              ? `.${el.className.trim().split(/\s+/)[0]}`
              : '';
          nonSemanticClickableSamples.push(`${el.tagName.toLowerCase()}${id}${cls}`);
        }
      }
    });

    const data: DomSemanticData = {
      elementCount,
      headingHierarchy,
      landmarkElements,
      hiddenNodeCount,
      customElementCount: 0,
      maxDomDepth,
      hasMainLandmark,
      hasMultipleH1: h1Count > 1,
      headingOrderValid,
      customElementTags: [],
      tablesCount,
      listsCount,
      definitionListsCount,
      nonSemanticClickableCount,
      nativeButtonsCount,
      nonSemanticClickableSamples,
    };

    return createCollectionResult<DomSemanticData>({
      module: this.id,
      status: 'completed',
      data,
      coverage: {
        expected: 6,
        collected: 6,
        unavailable: 0,
        supported: true,
      },
      limitations: [
        'Closed shadow DOM subtrees are not traversable.',
        'Cross-origin iframe contents cannot be evaluated.',
      ],
      sources: ['DOM:querySelectorAll', 'DOM:landmarks', 'DOM:headings'],
    });
  }
}

export const domCollector = new DomCollector();
