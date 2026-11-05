/**
 * @file src/collectors/page/accessibility.collector.ts
 * @description Injects and executes axe-core automated accessibility audits (WCAG 2.1 AA).
 */

import axe from 'axe-core';
import type { AccessibilityData } from '../../types/inspection';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class AccessibilityCollector implements PageCollector<AccessibilityData> {
  readonly id = 'accessibility';
  readonly name = 'axe-core Automated Accessibility Collector';

  async collect(context: CollectorContext) {
    const doc = context.document;

    let axeCoreEvaluated = false;
    let totalViolations = 0;
    const violationCountsByImpact = {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
    };
    let passesCount = 0;
    let incompleteCount = 0;
    let inapplicableCount = 0;
    const violations: AccessibilityData['violations'] = [];
    const errors: string[] = [];

    try {
      const axeRunner = (axe as unknown as { default?: typeof axe }).default || axe;
      const targetElement = doc.body || doc.documentElement || doc;

      const results = await axeRunner.run(targetElement, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
        },
        resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable'],
      });

      axeCoreEvaluated = true;
      passesCount = results.passes?.length || 0;
      incompleteCount = results.incomplete?.length || 0;
      inapplicableCount = results.inapplicable?.length || 0;

      if (results.violations) {
        results.violations.forEach((v) => {
          const impact = (v.impact as 'critical' | 'serious' | 'moderate' | 'minor') || 'minor';
          violationCountsByImpact[impact] = (violationCountsByImpact[impact] || 0) + 1;
          totalViolations++;

          violations.push({
            id: v.id,
            impact,
            description: v.description,
            help: v.help,
            helpUrl: v.helpUrl,
            nodesCount: v.nodes?.length || 0,
          });
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`axe-core execution error: ${msg}`);
    }

    const data: AccessibilityData = {
      axeCoreEvaluated,
      totalViolations,
      violationCountsByImpact,
      passesCount,
      incompleteCount,
      inapplicableCount,
      violations,
    };

    return createCollectionResult<AccessibilityData>({
      module: this.id,
      status: axeCoreEvaluated ? 'completed' : 'failed',
      data,
      coverage: {
        expected: 4,
        collected: axeCoreEvaluated ? 4 : 0,
        unavailable: axeCoreEvaluated ? 0 : 4,
        supported: true,
      },
      limitations: [
        'Automated axe-core rules cover 30–50% of WCAG criteria; human review is required for full conformance.',
        'Closed shadow DOM subtrees and cross-origin iframes are not evaluated.',
      ],
      errors: errors.length > 0 ? errors : undefined,
      sources: ['axe-core', 'DOM:document'],
    });
  }
}

export const accessibilityCollector = new AccessibilityCollector();
