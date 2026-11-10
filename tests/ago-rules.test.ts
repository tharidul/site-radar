import { describe, it, expect } from 'vitest';
import { AccessibilityAnalyzer } from '../src/analyzers/accessibility.analyzer';
import { FormsCollector } from '../src/collectors/page/forms.collector';
import { DomCollector } from '../src/collectors/page/dom.collector';
import type { AnalyzerContext } from '../src/analyzers/types';

describe('AGO (Agentic Optimization) Rules Evaluation', () => {
  it('FormsCollector accurately audits input label associations and autocomplete attributes', () => {
    const collector = new FormsCollector();
    const doc = document.implementation.createHTMLDocument();

    const form = doc.createElement('form');
    form.action = 'https://example.com/checkout';
    doc.body.appendChild(form);

    const label1 = doc.createElement('label');
    label1.setAttribute('for', 'email-input');
    label1.textContent = 'Email Address';
    form.appendChild(label1);

    const input1 = doc.createElement('input');
    input1.id = 'email-input';
    input1.name = 'email';
    input1.type = 'email';
    input1.setAttribute('autocomplete', 'email');
    form.appendChild(input1);

    const input2 = doc.createElement('input');
    input2.name = 'promo-code';
    input2.type = 'text';
    form.appendChild(input2);

    const result = collector.collect({ document: doc });
    expect(result.data?.totalInputCount).toBe(2);
    expect(result.data?.unlabeledInputCount).toBe(1);
    expect(result.data?.autocompleteInputCount).toBe(1);
    expect(result.data?.unlabeledInputSamples).toContain('input[name="promo-code"]');
  });

  it('DomCollector flags non-semantic clickable elements lacking accessible roles', () => {
    const collector = new DomCollector();
    const doc = document.implementation.createHTMLDocument();

    const btn = doc.createElement('button');
    btn.textContent = 'Submit';
    doc.body.appendChild(btn);

    const clickDiv = doc.createElement('div');
    clickDiv.setAttribute('onclick', 'handleClick()');
    clickDiv.id = 'fake-btn';
    doc.body.appendChild(clickDiv);

    const clickSpan = doc.createElement('span');
    clickSpan.setAttribute('tabindex', '0');
    doc.body.appendChild(clickSpan);

    const result = collector.collect({ document: doc });
    expect(result.data?.nativeButtonsCount).toBe(1);
    expect(result.data?.nonSemanticClickableCount).toBe(2);
    expect(result.data?.nonSemanticClickableSamples).toContain('div#fake-btn');
  });

  it('AccessibilityAnalyzer produces passing AGO findings when forms, buttons, and DOM depth are optimal', () => {
    const analyzer = new AccessibilityAnalyzer();
    const context: AnalyzerContext = {
      mode: 'quick',
      target: {
        url: 'https://example.com',
        origin: 'https://example.com',
        hostname: 'example.com',
        inspectedAt: Date.now(),
      },
      modules: {
        forms: {
          module: 'forms',
          status: 'completed',
          collectedAt: Date.now(),
          errors: [],
          limitations: [],
          sources: [],
          coverage: { expected: 3, collected: 3, unavailable: 0, supported: true },
          data: {
            formCount: 1,
            forms: [],
            containsUnencryptedSubmissions: false,
            totalInputCount: 3,
            unlabeledInputCount: 0,
            autocompleteInputCount: 3,
            unlabeledInputSamples: [],
          },
        },
        dom: {
          module: 'dom',
          status: 'completed',
          collectedAt: Date.now(),
          errors: [],
          limitations: [],
          sources: [],
          coverage: { expected: 6, collected: 6, unavailable: 0, supported: true },
          data: {
            elementCount: 450,
            maxDomDepth: 18,
            hiddenNodeCount: 0,
            headingHierarchy: [],
            landmarkElements: [{ tag: 'main', role: 'main' }],
            hasMainLandmark: true,
            nonSemanticClickableCount: 0,
            nativeButtonsCount: 12,
            nonSemanticClickableSamples: [],
          },
        },
      },
    };

    const findings = analyzer.analyze(context);

    const formRule = findings.find((f) => f.ruleId === 'ago-form-labels');
    expect(formRule).toBeDefined();
    expect(formRule?.category).toBe('accessibility');
    expect(formRule?.status).toBe('passed');

    const clickRule = findings.find((f) => f.ruleId === 'ago-interactive-elements');
    expect(clickRule).toBeDefined();
    expect(clickRule?.category).toBe('accessibility');
    expect(clickRule?.status).toBe('passed');

    const domRule = findings.find((f) => f.ruleId === 'ago-dom-token-bloat');
    expect(domRule).toBeDefined();
    expect(domRule?.category).toBe('accessibility');
    expect(domRule?.status).toBe('passed');
  });

  it('AccessibilityAnalyzer flags warnings when unlabeled inputs, clickable divs, or deep nesting are detected', () => {
    const analyzer = new AccessibilityAnalyzer();
    const context: AnalyzerContext = {
      mode: 'quick',
      target: {
        url: 'https://example.com',
        origin: 'https://example.com',
        hostname: 'example.com',
        inspectedAt: Date.now(),
      },
      modules: {
        forms: {
          module: 'forms',
          status: 'completed',
          collectedAt: Date.now(),
          errors: [],
          limitations: [],
          sources: [],
          coverage: { expected: 3, collected: 3, unavailable: 0, supported: true },
          data: {
            formCount: 1,
            forms: [],
            containsUnencryptedSubmissions: false,
            totalInputCount: 4,
            unlabeledInputCount: 2,
            autocompleteInputCount: 0,
            unlabeledInputSamples: ['input[name="password"]', 'input[name="ssn"]'],
          },
        },
        dom: {
          module: 'dom',
          status: 'completed',
          collectedAt: Date.now(),
          errors: [],
          limitations: [],
          sources: [],
          coverage: { expected: 6, collected: 6, unavailable: 0, supported: true },
          data: {
            elementCount: 2500,
            maxDomDepth: 38,
            hiddenNodeCount: 0,
            headingHierarchy: [],
            landmarkElements: [{ tag: 'main', role: 'main' }],
            hasMainLandmark: true,
            nonSemanticClickableCount: 5,
            nativeButtonsCount: 2,
            nonSemanticClickableSamples: ['div#submit-btn'],
          },
        },
      },
    };

    const findings = analyzer.analyze(context);

    const formRule = findings.find((f) => f.ruleId === 'ago-form-labels');
    expect(formRule?.status).toBe('warning');
    expect(formRule?.severity).toBe('medium');

    const clickRule = findings.find((f) => f.ruleId === 'ago-interactive-elements');
    expect(clickRule?.status).toBe('warning');
    expect(clickRule?.severity).toBe('medium');

    const domRule = findings.find((f) => f.ruleId === 'ago-dom-token-bloat');
    expect(domRule?.status).toBe('warning');
    expect(domRule?.severity).toBe('low');
  });
});

