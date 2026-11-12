import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { handleAuditHeaders } from './tools/headers.tool';
import { handleAuditSeo } from './tools/seo.tool';
import { handleDetectTech } from './tools/tech.tool';
import { handleAuditAccessibility } from './tools/a11y.tool';
import { handleFullAudit } from './tools/full-audit.tool';
import { BrowserRunner } from './browser';
import { assertSafePublicUrl } from './security';

export function createSiteRadarServer(): McpServer {
  const server = new McpServer({
    name: 'siteradar-mcp',
    version: '0.2.0',
  });

  // Tool 1: Audit HTTP & Security Headers
  server.tool(
    'siteradar_audit_headers',
    'Audit website HTTP response headers, evaluate critical security headers (HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, nosniff), and identify sensitive server technology leaks.',
    {
      url: z.string().url().describe('The target URL to inspect for HTTP response and security headers (e.g. https://example.com)'),
    },
    async ({ url }) => {
      try {
        await assertSafePublicUrl(url);
        const result = await handleAuditHeaders({ url });
        return {
          content: [
            {
              type: 'text',
              text: result.markdownReport,
            },
            {
              type: 'text',
              text: JSON.stringify(
                {
                  statusCode: result.statusCode,
                  securityScore: result.securityScore,
                  passedHeaders: result.passedHeaders,
                  missingSecurityHeaders: result.missingSecurityHeaders,
                  leaks: result.leaks,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Header audit failed: ${err.message}` }],
        };
      }
    },
  );

  // Tool 2: Audit SEO & AEO
  server.tool(
    'siteradar_audit_seo',
    'Audit website SEO, OpenGraph tags, JSON-LD structured data schemas, heading hierarchy, robots meta directives, conversational question headings, and LLMs.txt context readiness.',
    {
      url: z.string().url().describe('The target website URL to audit for SEO and AEO/LLM friendliness'),
      useBrowser: z.boolean().optional().default(false).describe('Whether to run in deep headless browser mode (true) or fast HTTP fetch mode (false). Default: false'),
    },
    async ({ url, useBrowser }) => {
      try {
        await assertSafePublicUrl(url);
        const result = await handleAuditSeo({ url, useBrowser });
        return {
          content: [
            {
              type: 'text',
              text: result.markdownReport,
            },
            {
              type: 'text',
              text: JSON.stringify(
                {
                  score: result.score,
                  title: result.title,
                  metaDescription: result.metaDescription,
                  canonicalUrl: result.canonicalUrl,
                  headingsSummary: result.headingsSummary,
                  structuredDataCount: result.structuredDataCount,
                  aiCrawlerStatus: result.aiCrawlerStatus,
                  hasLlmsTxt: result.hasLlmsTxt,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `SEO audit failed: ${err.message}` }],
        };
      }
    },
  );

  // Tool 3: Detect Technology Stack
  server.tool(
    'siteradar_detect_tech',
    'Fingerprint frontend JavaScript frameworks (React, Next.js, Vue, Angular, Svelte), CSS frameworks (Tailwind, Bootstrap), web servers (Nginx, Apache), cloud edge platforms (Cloudflare, Vercel), and CMS engines.',
    {
      url: z.string().url().describe('The target website URL to fingerprint for technology stack'),
      deep: z.boolean().optional().default(false).describe('Whether to run deep headless browser fingerprinting to inspect runtime window globals. Default: false'),
    },
    async ({ url, deep }) => {
      try {
        await assertSafePublicUrl(url);
        const result = await handleDetectTech({ url, deep });
        return {
          content: [
            {
              type: 'text',
              text: result.markdownReport,
            },
            {
              type: 'text',
              text: JSON.stringify(
                {
                  technologies: result.technologies,
                  frameworks: result.frameworks,
                  cssFrameworks: result.cssFrameworks,
                  servers: result.servers,
                  cdns: result.cdns,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Technology detection failed: ${err.message}` }],
        };
      }
    },
  );

  // Tool 4: Audit Accessibility (axe-core + Playwright)
  server.tool(
    'siteradar_audit_accessibility',
    'Run automated WCAG 2.2 AA accessibility evaluations powered by axe-core in a live headless browser. Evaluates color contrast, landmarks, image alt attributes, button roles, and zoom restrictions.',
    {
      url: z.string().url().describe('The target website URL to audit for WCAG 2.2 AA accessibility'),
      timeoutMs: z.number().optional().default(25000).describe('Max navigation timeout in milliseconds. Default: 25000'),
    },
    async ({ url, timeoutMs }) => {
      try {
        await assertSafePublicUrl(url);
        const result = await handleAuditAccessibility({ url, timeoutMs });
        return {
          content: [
            {
              type: 'text',
              text: result.markdownReport,
            },
            {
              type: 'text',
              text: JSON.stringify(
                {
                  score: result.score,
                  totalViolations: result.totalViolations,
                  violationsByImpact: result.violationsByImpact,
                  axeViolations: result.axeViolations,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Accessibility audit failed: ${err.message}` }],
        };
      }
    },
  );

  // Tool 5: Full 5-Pillar SiteRadar Audit
  server.tool(
    'siteradar_full_audit',
    'Execute a comprehensive 5-pillar technical audit (Security, Performance & Core Web Vitals, SEO & AEO, Accessibility, Best Practices) using Playwright headless browser and the SiteRadar scoring engine.',
    {
      url: z.string().url().describe('The target website URL to conduct a comprehensive SiteRadar technical audit on'),
      mode: z.enum(['fast', 'deep']).optional().default('deep').describe('Audit mode: "deep" uses Playwright for live Core Web Vitals and axe-core; "fast" performs instant HTTP/DOM evaluation. Default: deep'),
      timeoutMs: z.number().optional().default(30000).describe('Max navigation timeout in milliseconds for deep mode. Default: 30000'),
    },
    async ({ url, mode, timeoutMs }) => {
      try {
        await assertSafePublicUrl(url);
        const result = await handleFullAudit({ url, mode, timeoutMs });
        return {
          content: [
            {
              type: 'text',
              text: result.markdownReport,
            },
            {
              type: 'text',
              text: JSON.stringify(
                {
                  overallScore: result.overallScore,
                  scores: result.scores,
                  summary: result.summary,
                  technologies: result.technologies,
                  topIssues: result.topIssues.map((i) => ({
                    category: i.category,
                    title: i.title,
                    severity: i.severity,
                    status: i.status,
                    description: i.description,
                    recommendation: i.recommendation,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Full audit failed: ${err.message}` }],
        };
      }
    },
  );

  return server;
}

