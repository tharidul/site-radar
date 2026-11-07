import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { InspectionOrchestrator } from '../src/core/orchestrator/inspection-orchestrator';
import { FindingsExplorer } from '../entrypoints/popup/components/FindingsExplorer';
import { ModuleAccordions } from '../entrypoints/popup/components/ModuleAccordions';
import { PerformanceAnalyzer } from '../src/analyzers/performance.analyzer';
import type { AuditFinding } from '../src/types/inspection';

describe('Cross-Site Data Isolation & Web Vitals Clarifications', () => {
  it('getSession strictly isolates scan results by tabId and targetUrl', () => {
    const orchestrator = new InspectionOrchestrator();

    // Directly seed activeSessions map via session additions
    (orchestrator as any).activeSessions.set('scan_apple', {
      scanId: 'scan_apple',
      mode: 'quick',
      targetUrl: 'https://www.apple.com/',
      tabId: 101,
      state: 'completed',
      startedAt: Date.now(),
    });

    (orchestrator as any).activeSessions.set('scan_prev', {
      scanId: 'scan_prev',
      mode: 'quick',
      targetUrl: 'https://tharidulakmal.com/',
      tabId: 102,
      state: 'completed',
      startedAt: Date.now(),
    });

    // 1. Query for apple.com tab
    const appleSession = orchestrator.getSession(undefined, 101, 'https://www.apple.com/');
    expect(appleSession).toBeDefined();
    expect(appleSession?.targetUrl).toBe('https://www.apple.com/');

    // 2. Query for new tab (apple.com) that re-used tabId 102 or opened new tab
    const mismatchedSession = orchestrator.getSession(undefined, 103, 'https://www.apple.com/');
    // No session exists for tabId 103 on apple.com
    expect(mismatchedSession).toBeUndefined();

    // 3. Tab 102 navigated from tharidulakmal.com to google.com
    const navigatedSession = orchestrator.getSession(undefined, 102, 'https://www.google.com/');
    // URL changed! Old session must NOT be returned
    expect(navigatedSession).toBeUndefined();
  });

  it('FindingsExplorer does not render an alarming severity badge when a finding is NOT-AVAILABLE', () => {
    const mockFinding: AuditFinding = {
      id: 'f_perf_lcp',
      ruleId: 'perf-lcp',
      category: 'performance',
      title: 'Largest Contentful Paint (LCP)',
      description: 'Evaluates Largest Contentful Paint against Google Core Web Vitals targets.',
      severity: 'high',
      status: 'not-available',
      weight: 15,
      confidence: 1.0,
      evidence: [],
      references: [],
    };

    const html = renderToString(
      <FindingsExplorer
        findings={[mockFinding]}
        totalRulesEvaluated={1}
      />
    );

    // Should render NOT-AVAILABLE status badge
    expect(html).toContain('not-available');
    // Should NOT render the HIGH severity badge right next to it
    expect(html).not.toMatch(/>high<\/span>/i);
  });

  it('FindingsExplorer renders a sleek check icon for passed checks without text pill bloating', () => {
    const passedFinding: AuditFinding = {
      id: 'f_a11y_alt',
      ruleId: 'a11y-img-alt',
      category: 'accessibility',
      title: 'Image Alt Attributes',
      description: 'All images have descriptive alt attributes.',
      severity: 'low',
      status: 'passed',
      weight: 10,
      confidence: 1.0,
      evidence: [],
      references: [],
    };

    const html = renderToString(
      <FindingsExplorer
        findings={[passedFinding]}
        totalRulesEvaluated={1}
      />
    );

    // Should render clean check icon
    expect(html).toContain('Check passed');
    // Should NOT render bloated text pills [LOW] or [PASSED]
    expect(html).not.toMatch(/>low<\/span>/i);
    expect(html).not.toMatch(/>passed<\/span>/i);
  });

  it('PerformanceAnalyzer returns clear actionable explanation when LCP is not-available', () => {
    const analyzer = new PerformanceAnalyzer();
    const findings = analyzer.analyze({
      target: {
        url: 'https://www.apple.com/',
        origin: 'https://www.apple.com',
        hostname: 'www.apple.com',
        scheme: 'https',
      },
      mode: 'quick',
      modules: {
        performance: {
          module: 'performance',
          status: 'completed',
          data: {
            resourceCount: 10,
            webVitals: undefined, // Browser had no recorded LCP
          },
          coverage: { expected: 4, collected: 2, unavailable: 2, supported: true },
          limitations: [],
          sources: [],
        },
      },
    });

    const lcpFinding = findings.find((f) => f.ruleId === 'perf-lcp');
    expect(lcpFinding).toBeDefined();
    expect(lcpFinding?.status).toBe('not-available');
    expect(lcpFinding?.explanation).toContain('initial page load');
    expect(lcpFinding?.recommendation).toContain('Reload this tab');
  });

  it('ModuleAccordions resolves collector key aliases (metadata->seo, security->securityHeaders, dom->content) so completed modules are not marked SKIPPED', () => {
    const modules = {
      identity: { module: 'identity', status: 'completed' as const, data: {}, coverage: { expected: 1, collected: 1, unavailable: 0, supported: true }, limitations: [], sources: [] },
      metadata: { module: 'metadata', status: 'completed' as const, data: {}, coverage: { expected: 1, collected: 1, unavailable: 0, supported: true }, limitations: [], sources: [] },
      security: { module: 'security', status: 'completed' as const, data: {}, coverage: { expected: 1, collected: 1, unavailable: 0, supported: true }, limitations: [], sources: [] },
      dom: { module: 'dom', status: 'completed' as const, data: {}, coverage: { expected: 1, collected: 1, unavailable: 0, supported: true }, limitations: [], sources: [] },
    };

    const html = renderToString(<ModuleAccordions modules={modules} />);

    // In the HTML, Overview & Identity, SEO & Metadata, Security & Headers, and Content & DOM Structure must show Ready, NOT SKIPPED
    const readyMatches = html.match(/>Ready<\/span>/g);
    expect(readyMatches?.length).toBe(4);

    // Un-executed modules like DNS still show skipped
    expect(html).toContain('Infrastructure &amp; DNS');
    expect(html).toContain('skipped');
  });
});
