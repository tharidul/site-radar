import { z } from 'zod';
import { SiteRadarAuditor } from '../auditor';
import type { AccessibilityAuditResult } from '../types';

export const AuditA11ySchema = z.object({
  url: z.string().url().describe('The website URL to audit for WCAG 2.2 AA accessibility and axe-core compliance'),
  timeoutMs: z.number().optional().default(25000).describe('Max navigation timeout in milliseconds. Default: 25000'),
});

export async function handleAuditAccessibility(rawArgs: z.input<typeof AuditA11ySchema>): Promise<AccessibilityAuditResult> {
  const args = AuditA11ySchema.parse(rawArgs);
  const audit = await SiteRadarAuditor.auditUrl(args.url, { mode: 'deep', timeoutMs: args.timeoutMs });
  const a11yScoreObj = audit.scores['accessibility'];
  const a11yScore = a11yScoreObj ? a11yScoreObj.score : 100;
  const a11yFindings = audit.findings.filter((f) => f.category.toLowerCase() === 'accessibility');

  const axeEvalFinding = a11yFindings.find((f) => f.ruleId === 'a11y-axe-evaluation');
  const totalViolations = (axeEvalFinding?.evidence?.find((e) => e.label === 'Total Violations')?.value as number) || 0;

  const axeViolations = a11yFindings
    .filter((f) => f.ruleId.startsWith('a11y-axe-') && f.ruleId !== 'a11y-axe-evaluation' && f.status === 'failed')
    .map((f) => {
      const nodesCount = (f.evidence?.find((e) => e.label === 'Nodes Affected')?.value as number) || 1;
      return {
        id: f.ruleId.replace('a11y-axe-', ''),
        impact: f.severity,
        description: f.description,
        help: f.title,
        helpUrl: f.references?.[0] || 'https://dequeuniversity.com/rules/axe/',
        nodesCount,
      };
    });

  const violationsByImpact = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };

  for (const v of axeViolations) {
    if (v.impact === 'critical') violationsByImpact.critical++;
    else if (v.impact === 'high') violationsByImpact.serious++;
    else if (v.impact === 'medium') violationsByImpact.moderate++;
    else violationsByImpact.minor++;
  }

  let markdown = `## ♿ SiteRadar Accessibility Audit: ${args.url}\n\n`;
  markdown += `**Accessibility Score:** **${a11yScore}/100**\n\n`;
  markdown += `| Total Axe Violations | Critical | Serious | Moderate | Minor |\n`;
  markdown += `| :---: | :---: | :---: | :---: | :---: |\n`;
  markdown += `| **${totalViolations}** | ${violationsByImpact.critical} | ${violationsByImpact.serious} | ${violationsByImpact.moderate} | ${violationsByImpact.minor} |\n\n`;

  if (axeViolations.length > 0) {
    markdown += `### ⚠️ Accessibility Violations\n\n`;
    for (const v of axeViolations) {
      markdown += `#### ❌ \`${v.id}\` [${v.impact.toUpperCase()}] (${v.nodesCount} node${v.nodesCount > 1 ? 's' : ''} affected)\n`;
      markdown += `${v.description}\n`;
      markdown += `> **Remediation Guide:** [${v.helpUrl}](${v.helpUrl})\n\n`;
    }
  } else {
    markdown += `✅ **Zero automated WCAG 2.2 AA violations detected by axe-core!**\n\n`;
  }

  const semanticFindings = a11yFindings.filter((f) => !f.ruleId.startsWith('a11y-axe-'));
  if (semanticFindings.length > 0) {
    markdown += `### 🏛️ Semantic & Agentic Markup Findings\n\n`;
    for (const sf of semanticFindings) {
      const icon = sf.status === 'passed' ? '✅' : sf.status === 'warning' ? '⚠️' : 'ℹ️';
      markdown += `- ${icon} **${sf.title}:** ${sf.explanation || sf.description}\n`;
    }
  }

  return {
    url: args.url,
    score: a11yScore,
    totalViolations,
    passesCount: a11yFindings.filter((f) => f.status === 'passed').length,
    violationsByImpact,
    axeViolations,
    findings: a11yFindings,
    markdownReport: markdown,
  };
}

