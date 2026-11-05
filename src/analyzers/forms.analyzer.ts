/**
 * @file src/analyzers/forms.analyzer.ts
 * @description Evaluates cross-origin form submission actions and input destinations under Best Practices.
 */

import type { AuditFinding, FormsData } from '../types/inspection';
import type { Analyzer, AnalyzerContext } from './types';
import { getModuleData } from './types';
import { FindingBuilder } from './finding-builder';

export class FormsAnalyzer implements Analyzer {
  readonly id = 'forms-analyzer';
  readonly category = 'best-practices';

  analyze(context: AnalyzerContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const { target, modules } = context;

    const formsRes = getModuleData<FormsData>(modules, 'forms');
    const formsData = formsRes.data;

    if (!formsData || !formsData.forms || formsData.forms.length === 0) {
      findings.push(
        new FindingBuilder('priv-unredacted-form-action')
          .setCategory('best-practices')
          .setStatus('not-applicable')
          .setConfidence(1.0)
          .addEvidence('Forms Present', 0)
          .build(),
      );
      return findings;
    }

    let externalActionForms = 0;

    for (const form of formsData.forms) {
      if (form.action) {
        try {
          const actionOrigin = new URL(form.action, target.url).origin;
          if (actionOrigin !== target.origin) {
            externalActionForms++;
          }
        } catch {
          // ignore parsing error
        }
      }
    }

    if (externalActionForms > 0) {
      findings.push(
        new FindingBuilder('priv-unredacted-form-action')
          .setCategory('best-practices')
          .setStatus('warning')
          .setSeverity('low')
          .setConfidence(0.85)
          .addEvidence('Forms Submitting Cross-Origin', externalActionForms)
          .setExpectedBehavior('Form action endpoints should submit to same-origin or explicitly trusted endpoints.')
          .setExplanation('Cross-origin form submissions send form data to external domains, requiring review for privacy compliance.')
          .build(),
      );
    } else {
      findings.push(
        new FindingBuilder('priv-unredacted-form-action')
          .setCategory('best-practices')
          .setStatus('passed')
          .setConfidence(1.0)
          .addEvidence('Same-origin Submissions', true)
          .build(),
      );
    }

    return findings;
  }
}
