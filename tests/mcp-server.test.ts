// @vitest-environment node

import { describe, it, expect, afterAll } from 'vitest';
import { handleAuditHeaders } from '../src/mcp/tools/headers.tool';
import { handleAuditSeo } from '../src/mcp/tools/seo.tool';
import { handleDetectTech } from '../src/mcp/tools/tech.tool';
import { handleAuditAccessibility } from '../src/mcp/tools/a11y.tool';
import { handleFullAudit } from '../src/mcp/tools/full-audit.tool';
import { BrowserRunner } from '../src/mcp/browser';

describe('SiteRadar MCP Server Tools', () => {
  afterAll(async () => {
    await BrowserRunner.closeBrowser();
  });

  it('audits HTTP headers and evaluates missing security headers', async () => {
    const result = await handleAuditHeaders({ url: 'https://example.com' });
    expect(result.url).toBe('https://example.com');
    expect(result.statusCode).toBe(200);
    expect(result.securityScore).toBeGreaterThanOrEqual(0);
    expect(result.missingSecurityHeaders.length).toBeGreaterThan(0);
    expect(result.markdownReport).toContain('SiteRadar Header Security Audit');
  });

  it('audits SEO and extracts metadata in fast mode', async () => {
    const result = await handleAuditSeo({ url: 'https://example.com', useBrowser: false });
    expect(result.url).toBe('https://example.com');
    expect(result.score).toBeGreaterThan(50);
    expect(result.title).toContain('Example');
    expect(result.markdownReport).toContain('SiteRadar SEO');
  });

  it('detects technologies on target URL', async () => {
    const result = await handleDetectTech({ url: 'https://example.com', deep: false });
    expect(result.url).toBe('https://example.com');
    expect(Array.isArray(result.technologies)).toBe(true);
    expect(result.markdownReport).toContain('Technology Stack Fingerprint');
  });

  it('runs live axe-core accessibility audit via Playwright', async () => {
    const result = await handleAuditAccessibility({ url: 'https://example.com' });
    expect(result.url).toBe('https://example.com');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.markdownReport).toContain('Accessibility Audit');
  }, 35000);

  it('runs full 5-pillar SiteRadar audit with scores and breakdown', async () => {
    const result = await handleFullAudit({ url: 'https://example.com', mode: 'fast' });
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.scores['security']).toBeDefined();
    expect(result.scores['seo']).toBeDefined();
    expect(result.summary.totalFindings).toBeGreaterThan(0);
    expect(result.markdownReport).toContain('SiteRadar Audit: example.com');
  }, 25000);
});
