import { z } from 'zod';
import { SiteRadarAuditor } from '../auditor';
import type { SeoAuditResult } from '../types';

export const AuditSeoSchema = z.object({
  url: z.string().url().describe('The target URL to audit for SEO, OpenGraph, JSON-LD structured data, and AEO/LLM friendliness'),
  useBrowser: z.boolean().optional().default(false).describe('Whether to use headless browser (true) or fast HTTP fetch (false). Default: false'),
});

export async function handleAuditSeo(args: z.infer<typeof AuditSeoSchema>): Promise<SeoAuditResult> {
  const audit = await SiteRadarAuditor.auditUrl(args.url, { mode: args.useBrowser ? 'deep' : 'fast' });
  const seoScoreObj = audit.scores['seo'];
  const seoScore = seoScoreObj ? seoScoreObj.score : 100;
  const seoFindings = audit.findings.filter((f) => f.category.toLowerCase() === 'seo');

  const titleFinding = seoFindings.find((f) => f.ruleId === 'seo-title-present');
  const title = titleFinding?.evidence?.find((e) => e.label === 'Title')?.value as string | undefined;

  const descFinding = seoFindings.find((f) => f.ruleId === 'seo-meta-description');
  const metaDescription = descFinding?.evidence?.find((e) => e.label === 'Description')?.value as string | undefined;

  const canonFinding = seoFindings.find((f) => f.ruleId === 'seo-canonical-matches');
  const canonicalUrl = canonFinding?.evidence?.find((e) => e.label === 'Canonical URL')?.value as string | undefined;

  const headingsFinding = seoFindings.find((f) => f.ruleId === 'seo-heading-hierarchy');
  const h1Count = (headingsFinding?.evidence?.find((e) => e.label === 'H1 Count')?.value as number) || 0;

  const schemaFinding = seoFindings.find((f) => f.ruleId === 'seo-structured-data-missing');
  const schemaCount = (schemaFinding?.evidence?.find((e) => e.label === 'Schema Count')?.value as number) || 0;

  const aeoAiCrawler = seoFindings.find((f) => f.ruleId === 'aeo-ai-crawlers');
  const aiCrawlerStatus = aeoAiCrawler?.evidence?.find((e) => e.label === 'Retrieval Status')?.value as string | undefined;

  const llmsTxtFinding = seoFindings.find((f) => f.ruleId === 'aeo-llms-txt');
  const hasLlmsTxt = llmsTxtFinding?.status === 'passed';

  let markdown = `## 🔍 SiteRadar SEO & AEO Audit: ${args.url}\n\n`;
  markdown += `**SEO Score:** **${seoScore}/100**\n\n`;
  markdown += `- **Document Title:** ${title ? `"${title}"` : '*(missing)*'}\n`;
  markdown += `- **Meta Description:** ${metaDescription ? `"${metaDescription}"` : '*(missing)*'}\n`;
  markdown += `- **Canonical Tag:** ${canonicalUrl ? `\`${canonicalUrl}\`` : '*(missing)*'}\n`;
  markdown += `- **Heading H1 Count:** ${h1Count}\n`;
  markdown += `- **JSON-LD Schema Objects:** ${schemaCount}\n`;
  if (aiCrawlerStatus) {
    markdown += `- **AI Crawler Access (GPTBot/ClaudeBot):** ${aiCrawlerStatus}\n`;
  }
  markdown += `- **LLMs.txt Standard File:** ${hasLlmsTxt ? '✅ Found' : 'ℹ️ Undeclared'}\n\n`;

  const issues = seoFindings.filter((f) => f.status === 'failed' || f.status === 'warning');
  if (issues.length > 0) {
    markdown += `### ⚠️ Identified SEO Issues (${issues.length})\n\n`;
    for (const issue of issues) {
      markdown += `#### ${issue.status === 'failed' ? '❌' : '⚠️'} ${issue.title} (${issue.severity})\n`;
      markdown += `${issue.description}\n`;
      if (issue.recommendation) {
        markdown += `> **Action:** ${issue.recommendation}\n\n`;
      }
    }
  } else {
    markdown += `✅ **All standard technical SEO checks passed.**\n`;
  }

  return {
    url: args.url,
    score: seoScore,
    title,
    metaDescription,
    canonicalUrl,
    headingsSummary: {
      h1Count,
      h2Count: 0,
      h3Count: 0,
    },
    structuredDataCount: schemaCount,
    aiCrawlerStatus,
    hasLlmsTxt,
    findings: seoFindings,
    markdownReport: markdown,
  };
}

