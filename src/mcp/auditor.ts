import { Window as HappyWindow } from 'happy-dom';
import type { AuditFinding, CategoryScore, CollectionResult, InspectionSummary, TechnologyData, WebsiteTarget } from '../types/inspection';
import { runAllAnalyzers } from '../analyzers';
import { calculateInspectionScores } from '../scoring';
import { PAGE_COLLECTORS } from '../collectors/page';
import { HeadersService } from '../services/headers.service';
import { BrowserRunner, type BrowserPageData } from './browser';
import type { AuditToolResult } from './types';

// Ensure window & document globals exist in Node for collectors
const defaultHappyWin = new HappyWindow({ url: 'https://localhost' });
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = defaultHappyWin;
}
if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = defaultHappyWin.document;
}

export class SiteRadarAuditor {
  /**
   * Run a full deep audit using Playwright headless browser
   */
  static async auditUrl(targetUrl: string, options?: { mode?: 'fast' | 'deep'; timeoutMs?: number }): Promise<AuditToolResult> {
    const mode = options?.mode || 'deep';
    const parsed = new URL(targetUrl);
    const target: WebsiteTarget = {
      url: targetUrl,
      origin: parsed.origin,
      hostname: parsed.hostname,
      inspectedAt: new Date().toISOString(),
    };

    let browserData: BrowserPageData | null = null;
    let html = '';
    let responseHeaders: Record<string, string> = {};
    let statusCode = 200;
    let statusText = 'OK';

    if (mode === 'deep') {
      try {
        browserData = await BrowserRunner.capturePage(targetUrl, options?.timeoutMs || 25000);
        html = browserData.html;
        responseHeaders = browserData.headers;
        statusCode = browserData.status;
        statusText = browserData.statusText;
      } catch (err) {
        console.warn(`Browser capture failed, falling back to fast fetch: ${err}`);
      }
    }

    if (!html) {
      // Fast fetch mode or fallback
      try {
        const resp = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 SiteRadar/0.2.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          redirect: 'follow',
        });
        statusCode = resp.status;
        statusText = resp.statusText;
        resp.headers.forEach((val, key) => {
          responseHeaders[key.toLowerCase()] = val;
        });
        html = await resp.text();
      } catch (fetchErr: any) {
        throw new Error(`Failed to fetch URL ${targetUrl}: ${fetchErr.message}`);
      }
    }

    // Set up HappyDOM with the HTML
    const domWin = new HappyWindow({ url: targetUrl });
    const domDoc = domWin.document;
    domDoc.body.innerHTML = html;

    // Run all registered DOM page collectors
    const modules: Record<string, CollectionResult<unknown>> = {};
    for (const [modId, collector] of Object.entries(PAGE_COLLECTORS)) {
      try {
        modules[modId] = await collector.collect({
          document: domDoc as any,
          window: domWin as any,
          url: targetUrl,
          mode,
        });
      } catch (err: any) {
        modules[modId] = {
          module: modId,
          status: 'failed',
          collectedAt: Date.now(),
          data: null,
          coverage: { expected: 1, collected: 0, unavailable: 1, supported: true },
          limitations: [],
          errors: [err.message || String(err)],
          sources: [],
        };
      }
    }

    // Augment with Response Headers
    const headersData = HeadersService.processHeaders(responseHeaders, statusCode, statusText, targetUrl);
    modules['headers'] = {
      module: 'headers',
      status: 'completed',
      collectedAt: Date.now(),
      data: headersData,
      coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
      limitations: [],
      errors: [],
      sources: ['HttpHeadResponse'],
    };

    // If browser data is available, inject the live high-fidelity metrics
    if (browserData) {
      // Live Axe-core accessibility results
      modules['accessibility'] = {
        module: 'accessibility',
        status: 'completed',
        collectedAt: Date.now(),
        data: browserData.axeResults,
        coverage: { expected: 15, collected: 4, unavailable: 0, supported: true },
        limitations: ['Automated axe-core rules cover 30–50% of WCAG criteria'],
        errors: [],
        sources: ['axe-core', 'DOM:document'],
      };

      // Live Performance & Core Web Vitals
      modules['performance'] = {
        module: 'performance',
        status: 'completed',
        collectedAt: Date.now(),
        data: {
          navigationTiming: browserData.performanceData.navigationTiming,
          paintTiming: browserData.performanceData.paintTiming,
          webVitals: browserData.performanceData.webVitals,
          resourceSummary: {
            totalRequests: 0,
            wireTransferBytes: 0,
            decodedBytes: 0,
            cacheHitCount: 0,
            cacheHitBytes: 0,
            opaqueResourceCount: 0,
            opaqueResourceOrigins: [],
            resourceTypes: {},
            categoryBreakdown: {},
          },
        },
        coverage: { expected: 6, collected: 4, unavailable: 0, supported: true },
        limitations: [],
        errors: [],
        sources: ['PerformanceNavigationTiming', 'PerformancePaintTiming'],
      };

      // Live responsive overflow
      if (modules['responsive']?.data) {
        const respData = modules['responsive'].data as any;
        respData.horizontalOverflow = browserData.responsiveData.hasHorizontalOverflow;
      }

      // Inject runtime globals into technology module if detected
      if (browserData.runtimeGlobals && modules['technology']?.data) {
        const techData = modules['technology'].data as TechnologyData;
        if (browserData.runtimeGlobals.nextVersion && !techData.technologies.some((t) => t.name === 'Next.js')) {
          techData.technologies.push({
            name: 'Next.js',
            category: 'Web Framework',
            version: browserData.runtimeGlobals.nextVersion,
            confidence: 1,
            evidence: ['window.next.version runtime global detected'],
            sources: ['window.next'],
          });
        }
        if (browserData.runtimeGlobals.hasReact && !techData.technologies.some((t) => t.name === 'React')) {
          techData.technologies.push({
            name: 'React',
            category: 'JavaScript Framework',
            confidence: 1,
            evidence: ['React DOM runtime mounting detected'],
            sources: ['React'],
          });
        }
      }
    }

    // Run all analyzers
    const findings = await runAllAnalyzers({
      target,
      mode,
      modules,
    });

    // Calculate score model
    const scoreResult = calculateInspectionScores(findings);

    // Build summary counts
    let passedFindings = 0;
    let warningFindings = 0;
    let failedFindings = 0;
    let infoFindings = 0;
    let notApplicableFindings = 0;
    let notAvailableFindings = 0;
    let errorFindings = 0;

    for (const f of findings) {
      if (f.status === 'passed') passedFindings++;
      else if (f.status === 'warning') warningFindings++;
      else if (f.status === 'failed') failedFindings++;
      else if (f.status === 'info') infoFindings++;
      else if (f.status === 'not-applicable') notApplicableFindings++;
      else if (f.status === 'not-available') notAvailableFindings++;
      else if (f.status === 'error') errorFindings++;
    }

    const summary: InspectionSummary = {
      completedModules: Object.values(modules).filter((m) => m.status === 'completed').length,
      partialModules: Object.values(modules).filter((m) => m.status === 'partial').length,
      failedModules: Object.values(modules).filter((m) => m.status === 'failed' || m.status === 'blocked').length,
      totalFindings: findings.length,
      passedFindings,
      warningFindings,
      failedFindings,
      infoFindings,
      notApplicableFindings,
      notAvailableFindings,
      errorFindings,
    };

    const techList: TechnologyData['technologies'] = (modules['technology']?.data as TechnologyData)?.technologies || [];
    const topIssues = findings.filter((f) => f.status === 'failed' || f.status === 'warning');

    // Generate Markdown Report
    const markdownReport = this.generateMarkdownReport(target, scoreResult.overallScore, scoreResult.scores, topIssues, techList, summary);

    return {
      target,
      overallScore: scoreResult.overallScore,
      scores: scoreResult.scores,
      summary,
      topIssues,
      technologies: techList,
      markdownReport,
      findings,
    };
  }

  private static generateMarkdownReport(
    target: WebsiteTarget,
    overallScore: number,
    scores: Record<string, CategoryScore>,
    issues: AuditFinding[],
    technologies: TechnologyData['technologies'],
    summary: InspectionSummary,
  ): string {
    const getBadge = (score: number) => {
      if (score >= 90) return '🟢 PASS';
      if (score >= 70) return '🟡 MODERATE';
      return '🔴 ATTENTION';
    };

    let md = `# SiteRadar Audit: ${target.hostname}\n\n`;
    md += `**Target URL:** ${target.url}\n`;
    md += `**Inspected At:** ${target.inspectedAt}\n`;
    md += `**Overall Quality Score:** **${overallScore}/100** (${getBadge(overallScore)})\n\n`;

    md += `### Score Breakdown\n\n`;
    md += `| Category | Score | Rating | Passed / Total | Notes |\n`;
    md += `| :--- | :---: | :---: | :---: | :--- |\n`;

    for (const [catKey, scoreObj] of Object.entries(scores)) {
      const name = catKey.charAt(0).toUpperCase() + catKey.slice(1);
      const badge = getBadge(scoreObj.score);
      const passedRatio = `${scoreObj.passed}/${scoreObj.totalChecks}`;
      const deductionNote = scoreObj.deductionsExplanation.length > 0
        ? scoreObj.deductionsExplanation[0]
        : 'All checks passed';
      md += `| **${name}** | **${scoreObj.score}** | ${badge} | ${passedRatio} | ${deductionNote} |\n`;
    }

    if (technologies.length > 0) {
      md += `\n### Technology Stack Detected\n\n`;
      for (const t of technologies) {
        const ver = t.version ? ` \`${t.version}\`` : '';
        md += `- **${t.name}**${ver} (${t.category})\n`;
      }
    }

    if (issues.length > 0) {
      md += `\n### Priority Issues Detected (${issues.length})\n\n`;
      for (const issue of issues.slice(0, 10)) {
        const icon = issue.status === 'failed' ? '❌' : '⚠️';
        md += `#### ${icon} [${issue.category.toUpperCase()}] ${issue.title} (${issue.severity})\n`;
        md += `${issue.description}\n\n`;
        if (issue.recommendation) {
          md += `> **Recommendation:** ${issue.recommendation}\n\n`;
        }
      }
      if (issues.length > 10) {
        md += `*(+${issues.length - 10} more issues omitted for brevity; see full findings JSON)*\n\n`;
      }
    } else {
      md += `\n✅ **Zero critical or warning issues detected across all evaluated categories.**\n\n`;
    }

    return md;
  }
}

