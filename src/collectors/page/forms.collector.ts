/**
 * @file src/collectors/page/forms.collector.ts
 * @description Audits form elements, action security, and input field types with ZERO secret capture.
 */

import type { FormsData } from '../../types/inspection';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

export class FormsCollector implements PageCollector<FormsData> {
  readonly id = 'forms';
  readonly name = 'Form & Input Security Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const pageUrl = context.url || (doc.location?.href !== 'about:blank' ? doc.location?.href : '') || '';
    let isPageHttps = false;
    try {
      const parsed = new URL(pageUrl || 'http://localhost');
      isPageHttps = parsed.protocol === 'https:';
    } catch {
      isPageHttps = false;
    }

    const formElements = doc.querySelectorAll('form');
    const formCount = formElements.length;
    let containsUnencryptedSubmissions = false;
    const forms: FormsData['forms'] = [];

    formElements.forEach((form) => {
      const rawAction = form.getAttribute('action') || '';
      const method = (form.getAttribute('method') || 'GET').toUpperCase();
      let resolvedAction = rawAction;
      let isSecureAction = true;

      if (rawAction) {
        try {
          const resolved = new URL(rawAction, pageUrl || 'http://localhost');
          resolved.username = '';
          resolved.password = '';
          resolvedAction = resolved.toString();
          isSecureAction = resolved.protocol === 'https:';
        } catch {
          resolvedAction = rawAction;
          isSecureAction = isPageHttps;
        }
      } else {
        isSecureAction = isPageHttps;
      }

      if (isPageHttps && !isSecureAction) {
        containsUnencryptedSubmissions = true;
      }

      // Fields extraction
      const inputs = form.querySelectorAll('input, textarea, select, button');
      const fieldCount = inputs.length;
      const fieldTypes: string[] = [];
      const fields: Array<{ name?: string; type: string; hasValue: boolean; required?: boolean }> = [];
      let hasPasswordField = false;
      let hasCsrfToken = false;

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] as HTMLInputElement;
        const type = (input.getAttribute('type') || input.tagName.toLowerCase()).toLowerCase();
        fieldTypes.push(type);

        if (type === 'password') {
          hasPasswordField = true;
        }

        const name = input.getAttribute('name') || '';
        if (/csrf|xsrf|token/i.test(name)) {
          hasCsrfToken = true;
        }

        fields.push({
          name: name || undefined,
          type,
          hasValue: Boolean(input.value && input.value.trim().length > 0),
          required: Boolean(input.required),
        });
      }

      if (forms.length < 25) {
        forms.push({
          action: resolvedAction,
          method,
          fieldCount,
          fieldTypes,
          hasPasswordField,
          isSecureAction,
          hasCsrfToken,
          fields,
        });
      }
    });

    const hasPasswordForms = forms.some((f) => f.hasPasswordField);

    const data: FormsData = {
      formCount,
      forms,
      containsUnencryptedSubmissions,
      hasPasswordForms,
    };

    return createCollectionResult<FormsData>({
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
        'Single-page applications submitting data exclusively through JavaScript fetch/XHR lack native form actions.',
        'User input values and credential strings are STRICTLY ZERO-COLLECTED for user privacy and security.',
      ],
      sources: ['DOM:form', 'DOM:input', 'DOM:textarea', 'DOM:select'],
    });
  }
}

export const formsCollector = new FormsCollector();
