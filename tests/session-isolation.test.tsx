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

    const appleSession = orchestrator.getSession(undefined, 101, 'https://www.apple.com/');
    expect(appleSession).toBeDefined();
    expect(appleSession?.targetUrl).toBe('https://www.apple.com/');

    const mismatchedSession = orchestrator.getSession(undefined, 103, 'https://www.apple.com/');
    expect(mismatchedSession).toBeUndefined();

    const navigatedSession = orchestrator.getSession(undefined, 102, 'https://www.google.com/');
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
      confidence: 1.0,
      evidence: [],
      source: 'test',
      references: [],
    };

    const html = renderToString(
      <FindingsExplorer
        findings={[mockFinding]}
        activeSeverityFilter="all"
        onSelectSeverityFilter={() => {}}
      />
    );

    expect(html).toContain('not-available');
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
      confidence: 1.0,
      evidence: [],
      source: 'test',
      references: [],
    };

    const html = renderToString(
      <FindingsExplorer
        findings={[passedFinding]}
        activeSeverityFilter="all"
        onSelectSeverityFilter={() => {}}
      />
    );

    expect(html).toContain('Check passed');
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
        inspectedAt: Date.now(),
      },
      mode: 'quick',
      modules: {
        performance: {
          module: 'performance',
          status: 'completed',
          collectedAt: Date.now(),
          errors: [],
          data: {
            resourceCount: 10,
            webVitals: undefined,
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
      identity: { module: 'identity', status: 'completed' as const, collectedAt: Date.now(), errors: [], data: {}, coverage: { expected: 1, collected: 1, unavailable: 0, supported: true }, limitations: [], sources: [] },
      metadata: { module: 'metadata', status: 'completed' as const, collectedAt: Date.now(), errors: [], data: {}, coverage: { expected: 1, collected: 1, unavailable: 0, supported: true }, limitations: [], sources: [] },
      security: { module: 'security', status: 'completed' as const, collectedAt: Date.now(), errors: [], data: {}, coverage: { expected: 1, collected: 1, unavailable: 0, supported: true }, limitations: [], sources: [] },
      dom: { module: 'dom', status: 'completed' as const, collectedAt: Date.now(), errors: [], data: {}, coverage: { expected: 1, collected: 1, unavailable: 0, supported: true }, limitations: [], sources: [] },
    };

    const html = renderToString(<ModuleAccordions modules={modules} />);

    const readyMatches = html.match(/>Ready<\/span>/g);
    expect(readyMatches?.length).toBe(4);

    expect(html).toContain('Infrastructure &amp; DNS');
    expect(html).toContain('skipped');
  });
});
