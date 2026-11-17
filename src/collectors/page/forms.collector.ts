import type { FormsData } from '../../types/inspection';
import { isAuthOrCheckoutOrigin } from '../../security/url-normalizer';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

function isElementVisible(el: Element, win?: Window | null): boolean {
  if (!el) return false;

  let curr: Element | null = el;
  while (curr && curr !== curr.ownerDocument?.documentElement) {
    // 1. Native HTML5 hidden attribute or aria-hidden="true"
    if (curr.hasAttribute('hidden') || curr.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    // 2. Closed dialog element
    if (curr.tagName.toLowerCase() === 'dialog' && !curr.hasAttribute('open')) {
      return false;
    }

    // 3. Common modal/drawer classes indicating closed/hidden state
    const classAttr = curr.getAttribute('class');
    if (classAttr) {
      const cls = classAttr.toLowerCase();
      if (
        cls.includes('modal-hidden') ||
        cls.includes('is-hidden') ||
        cls.includes('drawer-closed') ||
        cls.includes('popup-hidden') ||
        cls.includes('dialog-hidden')
      ) {
        return false;
      }
    }

    // 4. Inline CSS styling
    const htmlCurr = curr as HTMLElement;
    if (htmlCurr.style) {
      const d = htmlCurr.style.display?.toLowerCase();
      const v = htmlCurr.style.visibility?.toLowerCase();
      const o = htmlCurr.style.opacity;
      if (d === 'none' || v === 'hidden' || o === '0') {
        return false;
      }
    }

    // 5. Computed styling if window is present
    if (win && typeof win.getComputedStyle === 'function') {
      try {
        const style = win.getComputedStyle(curr);
        if (style) {
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
          }
        }
      } catch {
        // Ignore computed style errors in non-standard DOMs
      }
    }

    // 6. Real browser offsetParent check
    if (typeof (curr as HTMLElement).offsetParent !== 'undefined') {
      const htmlEl = curr as HTMLElement;
      if (htmlEl.offsetParent === null && curr.tagName.toLowerCase() !== 'body') {
        let isFixed = false;
        if (htmlEl.style?.position === 'fixed') {
          isFixed = true;
        } else if (win && typeof win.getComputedStyle === 'function') {
          try {
            isFixed = win.getComputedStyle(curr)?.position === 'fixed';
          } catch {}
        }
        if (!isFixed) {
          return false;
        }
      }
    }

    curr = curr.parentElement;
  }

  return true;
}

export class FormsCollector implements PageCollector<FormsData> {
  readonly id = 'forms';
  readonly name = 'Form & Input Security Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const pageUrl = context.url || (doc.location?.href !== 'about:blank' ? doc.location?.href : '') || '';
    let isPageHttps = false;
    let pageHostname = '';
    try {
      const parsed = new URL(pageUrl || 'http://localhost');
      isPageHttps = parsed.protocol === 'https:';
      pageHostname = parsed.hostname;
    } catch {
      isPageHttps = false;
      pageHostname = '';
    }

    const formElements = doc.querySelectorAll('form');
    const formCount = formElements.length;
    let containsUnencryptedSubmissions = false;
    const forms: FormsData['forms'] = [];
    const isolatedCheckoutOrigins = new Set<string>();

    let hasVisiblePasswordField = false;
    let hasHiddenPasswordField = false;
    let hasVisiblePostForm = false;
    let hasHiddenPostForm = false;
    let dormantModalFormsCount = 0;

    formElements.forEach((form) => {
      const isFormVisible = isElementVisible(form, context.window);
      const isModal = Boolean(
        form.closest('dialog, [role="dialog"], .modal, .modal-dialog, [aria-modal="true"], .popup, .drawer') ||
        form.matches('dialog, [role="dialog"], .modal, [aria-modal="true"]')
      );

      if (!isFormVisible || isModal) {
        if (!isFormVisible) {
          dormantModalFormsCount++;
        }
      }

      const rawAction = form.getAttribute('action') || '';
      const method = (form.getAttribute('method') || 'GET').toUpperCase();
      let resolvedAction = rawAction;
      let isSecureAction = true;

      if (method === 'POST') {
        if (isFormVisible) {
          hasVisiblePostForm = true;
        } else {
          hasHiddenPostForm = true;
        }
      }

      if (rawAction) {
        try {
          const resolved = new URL(rawAction, pageUrl || 'http://localhost');
          resolved.username = '';
          resolved.password = '';
          resolvedAction = resolved.toString();
          isSecureAction = resolved.protocol === 'https:';
          if (pageHostname && isAuthOrCheckoutOrigin(resolved.origin, pageHostname)) {
            isolatedCheckoutOrigins.add(resolved.hostname);
          }
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
          const isInputVisible = isFormVisible && isElementVisible(input, context.window);
          if (isInputVisible) {
            hasVisiblePasswordField = true;
          } else {
            hasHiddenPasswordField = true;
          }
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
          isVisible: isFormVisible,
        });
      }
    });

    // Also check standalone password inputs outside forms
    const standalonePasswordInputs = doc.querySelectorAll('input[type="password"]');
    standalonePasswordInputs.forEach((pwInput) => {
      if (pwInput.closest('form')) {
        return;
      }
      const isVisible = isElementVisible(pwInput, context.window);
      if (isVisible) {
        hasVisiblePasswordField = true;
      } else {
        hasHiddenPasswordField = true;
      }
    });

    const hasPasswordForms = forms.some((f) => f.hasPasswordField) || hasVisiblePasswordField || hasHiddenPasswordField;

    const allInputElements = doc.querySelectorAll('input, textarea, select');
    let totalInputCount = 0;
    let labeledInputCount = 0;
    let autocompleteInputCount = 0;
    const unlabeledInputSamples: string[] = [];

    allInputElements.forEach((el) => {
      const type = (el.getAttribute('type') || el.tagName.toLowerCase()).toLowerCase();
      if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset' || type === 'image') {
        return;
      }
      if (!isElementVisible(el, context.window)) {
        return;
      }
      const elName = el.getAttribute('name') || '';
      const elId = el.getAttribute('id') || '';
      if (/^(?:g-recaptcha-response|h-captcha-response|cf-turnstile-response)/i.test(elName) ||
          /^(?:g-recaptcha-response|h-captcha-response|cf-turnstile-response)/i.test(elId)) {
        return;
      }

      totalInputCount++;

      let hasLabel = false;
      const inputId = el.getAttribute('id');
      if (inputId) {
        try {
          const matchingLabel = doc.querySelector(`label[for="${CSS.escape(inputId)}"]`);
          if (matchingLabel && (matchingLabel.textContent || '').trim().length > 0) {
            hasLabel = true;
          }
        } catch {
        }
      }

      if (!hasLabel && el.closest('label')) {
        hasLabel = true;
      }
      if (!hasLabel && (el.getAttribute('aria-label') || '').trim().length > 0) {
        hasLabel = true;
      }
      if (!hasLabel && (el.getAttribute('aria-labelledby') || '').trim().length > 0) {
        hasLabel = true;
      }
      if (!hasLabel && (el.getAttribute('title') || '').trim().length > 0) {
        hasLabel = true;
      }

      if (hasLabel) {
        labeledInputCount++;
      } else {
        if (unlabeledInputSamples.length < 5) {
          const name = el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : '';
          const id = inputId ? `#${inputId}` : '';
          unlabeledInputSamples.push(`${el.tagName.toLowerCase()}${id}${name}`);
        }
      }

      const auto = el.getAttribute('autocomplete');
      if (auto && auto.toLowerCase() !== 'off') {
        autocompleteInputCount++;
      }
    });

    const unlabeledInputCount = totalInputCount - labeledInputCount;

    const data: FormsData = {
      formCount,
      forms,
      containsUnencryptedSubmissions,
      hasPasswordForms,
      hasVisiblePasswordField,
      hasHiddenPasswordField,
      hasVisiblePostForm,
      hasHiddenPostForm,
      dormantModalFormsCount,
      totalInputCount,
      unlabeledInputCount,
      autocompleteInputCount,
      unlabeledInputSamples,
      isolatedCheckoutOrigins: Array.from(isolatedCheckoutOrigins),
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
