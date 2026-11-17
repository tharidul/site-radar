// @vitest-environment node

import { describe, it, expect, afterAll } from 'vitest';
import { SiteRadarAuditor } from '../src/mcp/auditor';
import { BrowserRunner } from '../src/mcp/browser';

const BENCHMARK_SITES = [
  { name: 'Hacker News', url: 'https://news.ycombinator.com', expectedCategory: 'Lightweight Community Forum' },
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page', expectedCategory: 'Open Content' },
  { name: 'GitHub', url: 'https://github.com', expectedCategory: 'Developer Platform' },
  { name: 'Stripe', url: 'https://stripe.com', expectedCategory: 'Fintech' },
  { name: 'Vercel', url: 'https://vercel.com', expectedCategory: 'Edge Jamstack' },
  { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/', expectedCategory: 'Technical Docs' },
  { name: 'BBC News', url: 'https://www.bbc.com', expectedCategory: 'News Media' },
  { name: 'Python.org', url: 'https://www.python.org', expectedCategory: 'Open Source Portal' },
  { name: 'AliExpress', url: 'https://www.aliexpress.com', expectedCategory: 'E-Commerce Storefront' },
  { name: 'Cloudflare', url: 'https://www.cloudflare.com', expectedCategory: 'Edge Infrastructure' },
];

describe('SiteRadar 10-Website Real-World Audit Benchmark', () => {
  afterAll(async () => {
    await BrowserRunner.closeBrowser();
  });

  for (const site of BENCHMARK_SITES) {
    it(`evaluates ${site.name} (${site.url}) with valid scores, findings, and corroboration`, async () => {
      const result = await SiteRadarAuditor.auditUrl(site.url, { mode: 'fast' });

      expect(result).toBeDefined();
      expect(result.target.url).toBe(site.url);
      expect(result.target.hostname).toBeTruthy();

      // Overall quality score must be a valid number between 1 and 100
      expect(result.overallScore).toBeGreaterThanOrEqual(1);
      expect(result.overallScore).toBeLessThanOrEqual(100);

      // Must have calculated scores for all core audit pillars
      expect(result.scores['security']).toBeDefined();
      expect(result.scores['security']!.score).toBeGreaterThanOrEqual(0);

      expect(result.scores['performance']).toBeDefined();
      expect(result.scores['performance']!.score).toBeGreaterThanOrEqual(0);

      expect(result.scores['seo']).toBeDefined();
      expect(result.scores['seo']!.score).toBeGreaterThanOrEqual(0);

      expect(result.scores['accessibility']).toBeDefined();
      expect(result.scores['accessibility']!.score).toBeGreaterThanOrEqual(0);

      // Must have evaluated findings and summary statistics
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.summary.totalFindings).toBeGreaterThan(0);
      expect(result.summary.completedModules).toBeGreaterThan(0);

      // Corroboration Engine should have classified reality states
      const hasRealityStates = result.findings.some((f) => f.realityState !== undefined);
      expect(hasRealityStates).toBe(true);

      // Markdown report must be generated
      expect(result.markdownReport).toContain(`SiteRadar Audit: ${result.target.hostname}`);
    }, 25000);
  }
});
