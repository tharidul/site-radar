import { SiteRadarAuditor } from '../src/mcp/auditor';
import { BrowserRunner } from '../src/mcp/browser';
import * as fs from 'fs';
import * as path from 'path';

export interface SiteBenchmarkResult {
  url: string;
  hostname: string;
  name: string;
  archetype: string;
  durationMs: number;
  overallScore: number;
  scores: {
    security: number;
    performance: number;
    seo: number;
    accessibility: number;
    bestPractices: number;
  };
  realityStates: {
    trueDefects: number;
    architecturalPatterns: number;
    observabilityLimits: number;
    syntheticNoise: number;
  };
  summary: {
    totalFindings: number;
    passed: number;
    warning: number;
    failed: number;
  };
  technologies: Array<{ name: string; category: string; version?: string }>;
  topIssues: Array<{ title: string; category: string; severity: string; realityState?: string }>;
  error?: string;
}

const TARGET_SITES = [
  { name: 'Hacker News', url: 'https://news.ycombinator.com', archetype: 'Lightweight Community Forum' },
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page', archetype: 'Massive Content / Open Encyclopedia' },
  { name: 'GitHub', url: 'https://github.com', archetype: 'Developer Platform & Cloud SaaS' },
  { name: 'Stripe', url: 'https://stripe.com', archetype: 'Fintech & Payment Infrastructure' },
  { name: 'Vercel', url: 'https://vercel.com', archetype: 'Next.js Edge Jamstack Showcase' },
  { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/', archetype: 'Technical Documentation & Standards' },
  { name: 'BBC News', url: 'https://www.bbc.com', archetype: 'Global Editorial News & Media' },
  { name: 'Python.org', url: 'https://www.python.org', archetype: 'Open Source Community Portal' },
  { name: 'AliExpress', url: 'https://www.aliexpress.com', archetype: 'Enterprise E-Commerce Storefront' },
  { name: 'Cloudflare', url: 'https://www.cloudflare.com', archetype: 'Web Security & Edge Infrastructure' },
];

async function runBenchmark(mode: 'fast' | 'deep' = 'deep') {
  console.log(`\n=============================================================`);
  console.log(`🚀 Starting SiteRadar 10-Website Audit Benchmark`);
  console.log(`Mode: ${mode.toUpperCase()} (Playwright Headless + Corroboration Engine)`);
  console.log(`=============================================================\n`);

  const results: SiteBenchmarkResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < TARGET_SITES.length; i++) {
    const site = TARGET_SITES[i]!;
    console.log(`[${i + 1}/${TARGET_SITES.length}] Auditing ${site.name} (${site.url})...`);
    const siteStart = Date.now();

    try {
      const audit = await SiteRadarAuditor.auditUrl(site.url, {
        mode,
        timeoutMs: 25000,
      });

      const durationMs = Date.now() - siteStart;

      // Count reality states across findings
      let trueDefects = 0;
      let architecturalPatterns = 0;
      let observabilityLimits = 0;
      let syntheticNoise = 0;

      for (const f of audit.findings) {
        if (f.realityState === 'TRUE_DEFECT') trueDefects++;
        else if (f.realityState === 'ARCHITECTURAL_PATTERN') architecturalPatterns++;
        else if (f.realityState === 'OBSERVABILITY_LIMIT') observabilityLimits++;
        else if (f.realityState === 'SYNTHETIC_NOISE') syntheticNoise++;
      }

      const res: SiteBenchmarkResult = {
        name: site.name,
        url: site.url,
        hostname: audit.target.hostname,
        archetype: site.archetype,
        durationMs,
        overallScore: audit.overallScore,
        scores: {
          security: audit.scores['security']?.score ?? 0,
          performance: audit.scores['performance']?.score ?? 0,
          seo: audit.scores['seo']?.score ?? 0,
          accessibility: audit.scores['accessibility']?.score ?? 0,
          bestPractices: audit.scores['best-practices']?.score ?? audit.scores['privacy']?.score ?? 0,
        },
        realityStates: {
          trueDefects,
          architecturalPatterns,
          observabilityLimits,
          syntheticNoise,
        },
        summary: {
          totalFindings: audit.summary.totalFindings,
          passed: audit.summary.passedFindings ?? 0,
          warning: audit.summary.warningFindings ?? 0,
          failed: audit.summary.failedFindings ?? 0,
        },
        technologies: audit.technologies.map(t => ({ name: t.name, category: t.category, version: t.version })),
        topIssues: audit.topIssues.slice(0, 5).map(issue => ({
          title: issue.title,
          category: issue.category,
          severity: issue.severity,
          realityState: issue.realityState,
        })),
      };

      results.push(res);
      console.log(`   ✓ Completed in ${(durationMs / 1000).toFixed(1)}s | Overall Score: ${res.overallScore}/100 [Sec: ${res.scores.security}, Perf: ${res.scores.performance}, SEO: ${res.scores.seo}, A11y: ${res.scores.accessibility}]`);
      console.log(`     Reality: ${trueDefects} true defects, ${architecturalPatterns} arch patterns, ${observabilityLimits} obs limits, ${syntheticNoise} synthetic noise`);
    } catch (err: any) {
      const durationMs = Date.now() - siteStart;
      console.error(`   ✗ Error auditing ${site.name}:`, err.message || err);
      results.push({
        name: site.name,
        url: site.url,
        hostname: new URL(site.url).hostname,
        archetype: site.archetype,
        durationMs,
        overallScore: 0,
        scores: { security: 0, performance: 0, seo: 0, accessibility: 0, bestPractices: 0 },
        realityStates: { trueDefects: 0, architecturalPatterns: 0, observabilityLimits: 0, syntheticNoise: 0 },
        summary: { totalFindings: 0, passed: 0, warning: 0, failed: 0 },
        technologies: [],
        topIssues: [],
        error: err.message || String(err),
      });
    }
  }

  await BrowserRunner.closeBrowser();

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=============================================================`);
  console.log(`✅ All 10 websites audited in ${totalDuration}s`);
  console.log(`=============================================================\n`);

  generateReport(results, totalDuration, mode);
}

function generateReport(results: SiteBenchmarkResult[], totalDuration: string, mode: string) {
  let md = `# SiteRadar: 10-Website Real-World Audit Benchmark\n\n`;
  md += `**Execution Date:** ${new Date().toISOString()}\n`;
  md += `**Audit Engine:** SiteRadar v0.2.0 with Corroboration Engine (Blast-Radius & Reality Model)\n`;
  md += `**Audit Mode:** ${mode.toUpperCase()} (Playwright Headless Browser + axe-core + CWV)\n`;
  md += `**Total Benchmark Runtime:** ${totalDuration} seconds\n\n`;

  md += `## 1. Executive Summary Table\n\n`;
  md += `| Website | Archetype | Overall Score | Security | Perf | SEO | A11y | Best Pract | Tech Detected | Time |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: |\n`;

  for (const r of results) {
    if (r.error) {
      md += `| **${r.name}** | ${r.archetype} | *Error* | - | - | - | - | - | ${r.error} | ${(r.durationMs / 1000).toFixed(1)}s |\n`;
      continue;
    }
    const badge = (s: number) => (s >= 90 ? `🟢 ${s}` : s >= 70 ? `🟡 ${s}` : `🔴 ${s}`);
    const tech = r.technologies.slice(0, 3).map(t => t.name).join(', ') || 'N/A';
    md += `| **${r.name}** | ${r.archetype} | **${badge(r.overallScore)}** | ${r.scores.security} | ${r.scores.performance} | ${r.scores.seo} | ${r.scores.accessibility} | ${r.scores.bestPractices} | ${tech} | ${(r.durationMs / 1000).toFixed(1)}s |\n`;
  }

  md += `\n## 2. Corroboration Reality State Analysis\n\n`;
  md += `The Corroboration Engine categorizes candidate findings into 4 reality states, eliminating false positives caused by enterprise trust boundaries and synthetic simulation noise.\n\n`;
  md += `| Website | True Defects | Architectural Patterns | Observability Limits | Synthetic Noise | Total Evaluated |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const r of results) {
    if (r.error) continue;
    md += `| **${r.name}** | ${r.realityStates.trueDefects} | ${r.realityStates.architecturalPatterns} | ${r.realityStates.observabilityLimits} | ${r.realityStates.syntheticNoise} | ${r.summary.totalFindings} |\n`;
  }

  md += `\n## 3. Deep-Dive Per-Site Findings\n\n`;

  for (const r of results) {
    md += `### ${r.name} (${r.url})\n\n`;
    md += `- **Archetype:** ${r.archetype}\n`;
    md += `- **Overall Score:** **${r.overallScore}/100**\n`;
    md += `- **Scores:** Security: ${r.scores.security} | Perf: ${r.scores.performance} | SEO: ${r.scores.seo} | A11y: ${r.scores.accessibility} | Best Practices: ${r.scores.bestPractices}\n`;
    md += `- **Technologies Detected:** ${r.technologies.map(t => `${t.name}${t.version ? ` (${t.version})` : ''}`).join(', ') || 'None identified'}\n`;

    if (r.topIssues.length > 0) {
      md += `- **Top Priority Findings:**\n`;
      for (const issue of r.topIssues) {
        const stateTag = issue.realityState ? ` [${issue.realityState}]` : '';
        md += `  - **[${issue.category.toUpperCase()}]** ${issue.title} (*${issue.severity}*)${stateTag}\n`;
      }
    } else {
      md += `- **Top Priority Findings:** Clean bill of health; zero high/critical issues.\n`;
    }
    md += `\n`;
  }

  const outputPath = path.resolve(process.cwd(), 'BENCHMARK_10_WEBSITES.md');
  fs.writeFileSync(outputPath, md, 'utf-8');
  console.log(`📄 Detailed benchmark report written to: ${outputPath}`);

  const jsonOutputPath = path.resolve(process.cwd(), 'BENCHMARK_10_WEBSITES.json');
  fs.writeFileSync(jsonOutputPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`📄 Raw benchmark JSON written to: ${jsonOutputPath}`);
}

const args = process.argv.slice(2);
const mode = args.includes('--fast') ? 'fast' : 'deep';

runBenchmark(mode).catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
