import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import axe from 'axe-core';

export interface BrowserPageData {
  url: string;
  finalUrl: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  html: string;
  axeResults: {
    axeCoreEvaluated: boolean;
    totalViolations: number;
    violationCountsByImpact: {
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
    };
    passesCount: number;
    incompleteCount: number;
    inapplicableCount: number;
    violations: Array<{
      id: string;
      impact: 'critical' | 'serious' | 'moderate' | 'minor';
      description: string;
      help: string;
      helpUrl: string;
      nodesCount: number;
    }>;
  };
  performanceData: {
    navigationTiming?: {
      dnsLookupMs: number;
      tcpConnectMs: number;
      ttfbMs: number;
      domLoadMs: number;
      fullLoadMs: number;
    };
    paintTiming?: {
      fpMs?: number;
      fcpMs?: number;
    };
    webVitals?: {
      lcpMs?: number;
      clsScore?: number;
      fidMs?: number;
    };
  };
  runtimeGlobals: {
    nextVersion?: string;
    hasReact?: boolean;
    hasVue?: boolean;
    hasAngular?: boolean;
    hasSvelte?: boolean;
    hasJQuery?: boolean;
    customGlobals: string[];
  };
  responsiveData: {
    hasHorizontalOverflow: boolean;
    viewportMeta?: string;
    scrollWidth: number;
    clientWidth: number;
  };
}

export class BrowserRunner {
  private static browserInstance: Browser | null = null;

  static async getBrowser(): Promise<Browser> {
    if (!this.browserInstance || !this.browserInstance.isConnected()) {
      this.browserInstance = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
        ],
      });
    }
    return this.browserInstance;
  }

  static async closeBrowser(): Promise<void> {
    if (this.browserInstance) {
      try {
        await this.browserInstance.close();
      } catch {}
      this.browserInstance = null;
    }
  }

  static async capturePage(targetUrl: string, timeoutMs: number = 20000): Promise<BrowserPageData> {
    const browser = await this.getBrowser();
    const context: BrowserContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 SiteRadar/0.2.0',
      ignoreHTTPSErrors: true,
    });

    const page: Page = await context.newPage();

    let capturedHeaders: Record<string, string> = {};
    let capturedStatus = 200;
    let capturedStatusText = 'OK';

    try {
      const response = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });

      if (response) {
        capturedStatus = response.status();
        capturedStatusText = response.statusText();
        capturedHeaders = response.headers();
      }

      // Allow async scripts, hydration, and paints to settle
      await page.waitForTimeout(1500);

      const finalUrl = page.url();
      const html = await page.content();

      // In-page axe-core accessibility audit
      const axeSource = (axe as unknown as { default?: { source: string }; source?: string }).default?.source || axe.source;
      if (axeSource) {
        await page.evaluate(axeSource);
      }

      const rawAxe = await page.evaluate(async () => {
        try {
          const axeGlobal = (window as any).axe;
          if (!axeGlobal) return null;
          return await axeGlobal.run(document, {
            runOnly: {
              type: 'tag',
              values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
            },
            resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable'],
          });
        } catch {
          return null;
        }
      });

      const violationCountsByImpact = {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
      };
      const formattedViolations: BrowserPageData['axeResults']['violations'] = [];
      let totalViolations = 0;

      if (rawAxe && Array.isArray(rawAxe.violations)) {
        rawAxe.violations.forEach((v: any) => {
          const impact = (v.impact as 'critical' | 'serious' | 'moderate' | 'minor') || 'minor';
          violationCountsByImpact[impact] = (violationCountsByImpact[impact] || 0) + 1;
          totalViolations++;
          formattedViolations.push({
            id: v.id,
            impact,
            description: v.description,
            help: v.help,
            helpUrl: v.helpUrl,
            nodesCount: v.nodes?.length || 0,
          });
        });
      }

      const axeResults: BrowserPageData['axeResults'] = {
        axeCoreEvaluated: Boolean(rawAxe),
        totalViolations,
        violationCountsByImpact,
        passesCount: rawAxe?.passes?.length || 0,
        incompleteCount: rawAxe?.incomplete?.length || 0,
        inapplicableCount: rawAxe?.inapplicable?.length || 0,
        violations: formattedViolations,
      };

      // In-page performance metrics
      const rawPerf = await page.evaluate(() => {
        const p = window.performance;
        if (!p) return null;

        let nav: any = null;
        const navEntries = p.getEntriesByType('navigation');
        if (navEntries.length > 0) {
          const n = navEntries[0] as PerformanceNavigationTiming;
          nav = {
            dnsLookupMs: Math.max(0, Math.round(n.domainLookupEnd - n.domainLookupStart)),
            tcpConnectMs: Math.max(0, Math.round(n.connectEnd - n.connectStart)),
            ttfbMs: Math.max(0, Math.round(n.responseStart - n.requestStart)),
            domLoadMs: Math.max(0, Math.round(n.domContentLoadedEventEnd - n.startTime)),
            fullLoadMs: Math.max(0, Math.round(n.loadEventEnd - n.startTime)),
          };
        }

        const paints: any = {};
        p.getEntriesByType('paint').forEach((entry) => {
          if (entry.name === 'first-paint') paints.fpMs = Math.round(entry.startTime);
          if (entry.name === 'first-contentful-paint') paints.fcpMs = Math.round(entry.startTime);
        });

        let lcpMs: number | undefined;
        let clsScore: number | undefined;

        try {
          const lcps = p.getEntriesByType('largest-contentful-paint');
          if (lcps.length > 0) {
            lcpMs = Math.round(lcps[lcps.length - 1].startTime);
          }
        } catch {}

        try {
          const shifts = p.getEntriesByType('layout-shift');
          let clsSum = 0;
          for (const s of shifts as any[]) {
            if (!s.hadRecentInput) clsSum += s.value;
          }
          clsScore = parseFloat(clsSum.toFixed(4));
        } catch {}

        return {
          nav,
          paints,
          lcpMs,
          clsScore: clsScore !== undefined ? clsScore : 0.0,
        };
      });

      const performanceData: BrowserPageData['performanceData'] = {
        navigationTiming: rawPerf?.nav,
        paintTiming: rawPerf?.paints,
        webVitals: {
          lcpMs: rawPerf?.lcpMs,
          clsScore: rawPerf?.clsScore ?? 0.0,
        },
      };

      // In-page runtime globals & responsive measurements
      const inPageData = await page.evaluate(() => {
        const w = window as any;
        const nextVersion = w.next?.version || (w.__NEXT_DATA__?.buildId ? 'detected' : undefined);
        const hasReact = Boolean(w.React || w.__REACT_DEVTOOLS_GLOBAL_HOOK__ || document.querySelector('[data-reactroot], #__next'));
        const hasVue = Boolean(w.Vue || w.__VUE__ || document.querySelector('[data-v-]'));
        const hasAngular = Boolean(w.ng || document.querySelector('[ng-version], [ng-app]'));
        const hasSvelte = Boolean(w.__svelte || document.querySelector('.svelte-'));
        const hasJQuery = Boolean(w.jQuery || w.$?.fn?.jquery);

        const scrollWidth = document.documentElement.scrollWidth;
        const clientWidth = document.documentElement.clientWidth;
        const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || undefined;

        return {
          runtimeGlobals: {
            nextVersion,
            hasReact,
            hasVue,
            hasAngular,
            hasSvelte,
            hasJQuery,
            customGlobals: Object.keys(w).filter((k) => /^[A-Z][a-zA-Z0-9]+$/.test(k)).slice(0, 20),
          },
          responsiveData: {
            hasHorizontalOverflow: scrollWidth > clientWidth,
            viewportMeta,
            scrollWidth,
            clientWidth,
          },
        };
      });

      return {
        url: targetUrl,
        finalUrl,
        status: capturedStatus,
        statusText: capturedStatusText,
        headers: capturedHeaders,
        html,
        axeResults,
        performanceData,
        runtimeGlobals: inPageData.runtimeGlobals,
        responsiveData: inPageData.responsiveData,
      };
    } finally {
      await context.close().catch(() => {});
    }
  }
}

