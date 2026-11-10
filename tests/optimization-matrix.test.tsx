import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { OptimizationMatrixCard } from '../entrypoints/popup/components/OptimizationMatrixCard';
import { FindingsExplorer } from '../entrypoints/popup/components/FindingsExplorer';
import type { AuditFinding } from '../src/types/inspection';

describe('OptimizationMatrixCard (SEO · AEO · AGO)', () => {
  const mockFindings: AuditFinding[] = [
    {
      id: 'f-seo-1',
      ruleId: 'seo-title-present',
      category: 'seo',
      severity: 'low',
      status: 'passed',
      title: 'Document Title Tag Present',
      description: 'Document title is present and optimal length.',
      evidence: [],
      source: 'MetadataCollector',
    },
    {
      id: 'f-seo-2',
      ruleId: 'seo-canonical-matches',
      category: 'seo',
      severity: 'medium',
      status: 'passed',
      title: 'Canonical URL Matches Target',
      description: 'Canonical tag is declared properly.',
      evidence: [],
      source: 'MetadataCollector',
    },
    {
      id: 'f-aeo-1',
      ruleId: 'aeo-llms-txt',
      category: 'seo',
      severity: 'info',
      status: 'passed',
      title: 'AEO llms.txt Present',
      description: 'Site defines /llms.txt for AI scraping.',
      evidence: [],
      source: 'MetadataCollector',
    },
    {
      id: 'f-aeo-2',
      ruleId: 'aeo-ai-crawlers',
      category: 'seo',
      severity: 'medium',
      status: 'passed',
      title: 'AI Web Crawler Access Permitted',
      description: 'GPTBot, PerplexityBot, and ClaudeBot allowed.',
      evidence: [],
      source: 'MetadataCollector',
    },
    {
      id: 'f-aeo-3',
      ruleId: 'aeo-faq-schema',
      category: 'seo',
      severity: 'low',
      status: 'warning',
      title: 'AEO Q&A and FAQ Schema Missing',
      description: 'No FAQPage or QAPage schema found.',
      evidence: [],
      source: 'StructuredDataCollector',
    },
    {
      id: 'f-ago-1',
      ruleId: 'ago-form-labels',
      category: 'accessibility',
      severity: 'medium',
      status: 'passed',
      title: 'Agentic Form Labels & Autocomplete',
      description: 'All inputs have accessible labels and autocomplete.',
      evidence: [],
      source: 'FormsCollector',
    },
    {
      id: 'f-ago-2',
      ruleId: 'ago-interactive-elements',
      category: 'accessibility',
      severity: 'medium',
      status: 'passed',
      title: 'Semantic Interactive Element Structure',
      description: 'All clickable elements use native buttons or ARIA roles.',
      evidence: [],
      source: 'DomCollector',
    },
    {
      id: 'f-ago-3',
      ruleId: 'ago-dom-token-bloat',
      category: 'accessibility',
      severity: 'low',
      status: 'passed',
      title: 'Lean DOM Nesting & Token Depth',
      description: 'DOM depth is within limits.',
      evidence: [],
      source: 'DomCollector',
    },
  ];

  it('renders the OptimizationMatrixCard with all three pillars: SEO, AEO, and AGO', () => {
    const handleNavigate = vi.fn();
    const html = renderToString(
      <OptimizationMatrixCard
        findings={mockFindings}
        scores={{ seo: { category: 'seo', score: 92, totalChecks: 6, passed: 5, warnings: 1, failed: 0, weight: 1 } }}
        onNavigateToIssues={handleNavigate}
      />
    );

    expect(html).toContain('AI &amp; Search Optimization (The O&#x27;s)');
    expect(html).toContain('index');

    expect(html).toContain('SEO');
    expect(html).toContain('Search Engines');
    expect(html).toContain('AEO');
    expect(html).toContain('Answer Engines');
    expect(html).toContain('AGO');
    expect(html).toContain('AI Web Agents');

    expect(html).toContain('Metadata, canonical, and heading hierarchy verified');
    expect(html).toContain('Q&amp;A and FAQ Schema Missing');
  });

  it('FindingsExplorer filters to AEO and AGO and renders dedicated category banners', () => {
    const divAeo = document.createElement('div');
    divAeo.innerHTML = renderToString(
      <FindingsExplorer
        findings={mockFindings}
        activeSeverityFilter="all"
        activeCategoryFilter="aeo"
        onSelectSeverityFilter={() => {}}
      />
    );

    expect(divAeo.textContent).toContain('AEO Audit');
    expect(divAeo.textContent).toContain('AEO llms.txt Present');
    expect(divAeo.textContent).toContain('AI Web Crawler Access Permitted');
    expect(divAeo.textContent).not.toContain('Document Title Tag Present');
    expect(divAeo.textContent).not.toContain('Agentic Form Labels');

    const divAgo = document.createElement('div');
    divAgo.innerHTML = renderToString(
      <FindingsExplorer
        findings={mockFindings}
        activeSeverityFilter="all"
        activeCategoryFilter="ago"
        onSelectSeverityFilter={() => {}}
      />
    );

    expect(divAgo.textContent).toContain('AGO Audit');
    expect(divAgo.textContent).toContain('Agentic Form Labels & Autocomplete');
    expect(divAgo.textContent).toContain('Semantic Interactive Element Structure');
    expect(divAgo.textContent).not.toContain('AEO llms.txt Present');
  });
});
