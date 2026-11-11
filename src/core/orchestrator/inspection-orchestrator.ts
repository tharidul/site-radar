
import type {
  InspectionMode,
  WebsiteInspection,
  CollectionResult,
  AuditFinding,
  InspectionSummary,
  CategoryScore,
  TechnologyData,
  PerformanceData,
} from '../../types/inspection';
import type { ScanProgressEvent } from '../../types/messaging';
import type { CrawlLimits } from '../../types/crawler';
import { MESSAGE_CHANNELS } from '../../types/messaging';
import { getBrowserAdapter, type BrowserAdapter } from '../../browser/adapters';
import type { StorageArea } from '../../types/browser';
import { messageBus, type IMessageBus } from '../../messaging/bus';
import { validateScheme } from '../../security/scheme-validator';
import { normalizeUrl, isSameOrigin } from '../../security/url-normalizer';
import { cancellationManager, type ICancellationManager, ScanCancelledError } from './cancellation';
import { getModePlan } from './mode-plans';
import { TaskScheduler, type ScheduledTask } from './scheduler';
import { runAllAnalyzers } from '../../analyzers';
import { calculateInspectionScores } from '../../scoring';
import { runPageCollector } from '../../collectors/page';
import { detectBackendFromHeaders } from '../../collectors/page/backend-signatures';
import { WebsiteCrawler } from '../../crawler/crawler';
import { isLocalDevelopmentHost } from '../../security/private-network.guard';
import {
  consentManager,
  DohResolver,
  AsnLookupClient,
  CtLogsClient,
  TlsEvaluator,
} from '../../intelligence';
import { HeadersService, BadgeService } from '../../services';

export type ScanLifecycleState = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface ActiveScanSession {
  scanId: string;
  mode: InspectionMode;
  targetUrl: string;
  tabId: number;
  state: ScanLifecycleState;
  startedAt: number;
  completedAt?: number;
  inspection?: WebsiteInspection;
  error?: string;
  progress?: ScanProgressEvent;
}

export interface InspectionOptions {
  crawlLimits?: Partial<CrawlLimits>;
  externalConsent?: Record<string, boolean>;
  skipIntelligence?: boolean;
  refreshPage?: boolean;
}

export interface OrchestratorOptions {
  browserAdapter?: BrowserAdapter;
  bus?: IMessageBus;
  cancellation?: ICancellationManager;
}

export class InspectionOrchestrator {
  private adapter: BrowserAdapter;
  private bus: IMessageBus;
  private cancellation: ICancellationManager;
  private activeSessions = new Map<string, ActiveScanSession>();

  constructor(options?: OrchestratorOptions) {
    this.adapter = options?.browserAdapter || getBrowserAdapter();
    this.bus = options?.bus || messageBus;
    this.cancellation = options?.cancellation || cancellationManager;
  }

  private getStorageAreaName(): StorageArea {
    return this.adapter.capabilities?.supportsSessionStorage ? 'session' : 'local';
  }

  async persistSession(session: ActiveScanSession): Promise<void> {
    try {
      const area = this.getStorageAreaName();
      const payload: ActiveScanSession = {
        scanId: session.scanId,
        mode: session.mode,
        targetUrl: session.targetUrl,
        tabId: session.tabId,
        state: session.state,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        error: session.error,
        progress: session.progress,
        inspection: session.inspection,
      };

      const items: Record<string, unknown> = {
        siteradar_session_latest: payload,
      };

      if (session.targetUrl) {
        try {
          const origin = new URL(session.targetUrl).origin;
          items[`siteradar_session_origin_${origin}`] = payload;
        } catch {}
      }

      if (session.tabId !== undefined) {
        items[`siteradar_session_tab_${session.tabId}`] = payload;
      }

      await this.adapter.setStorage(items, area);
    } catch (err) {
      console.warn('Failed to persist session to storage:', err);
    }
  }

  async restoreFromStorage(tabId?: number, url?: string): Promise<ActiveScanSession | undefined> {
    try {
      const area = this.getStorageAreaName();
      const keysToFetch: string[] = ['siteradar_session_latest'];
      if (tabId !== undefined) {
        keysToFetch.push(`siteradar_session_tab_${tabId}`);
      }
      if (url) {
        try {
          const origin = new URL(url).origin;
          keysToFetch.push(`siteradar_session_origin_${origin}`);
        } catch {}
      }

      const stored = await this.adapter.getStorage<ActiveScanSession>(keysToFetch, area);

      let candidate: ActiveScanSession | undefined;
      if (url) {
        try {
          const origin = new URL(url).origin;
          candidate = stored[`siteradar_session_origin_${origin}`];
        } catch {}
      }
      if (!candidate && tabId !== undefined) {
        candidate = stored[`siteradar_session_tab_${tabId}`];
      }
      if (!candidate) {
        candidate = stored['siteradar_session_latest'];
      }

      if (candidate && candidate.scanId) {
        this.activeSessions.set(candidate.scanId, candidate);
        return candidate;
      }
    } catch (err) {
      console.warn('Failed to restore session from storage:', err);
    }
    return undefined;
  }

  async clearStorageSession(): Promise<void> {
    try {
      const area = this.getStorageAreaName();
      const all = await this.adapter.getStorage<unknown>(null, area);
      const keysToRemove = Object.keys(all).filter((k) => k.startsWith('siteradar_session_'));
      if (keysToRemove.length > 0) {
        await this.adapter.removeStorage(keysToRemove, area);
      }
    } catch (err) {
      console.warn('Failed to clear session storage:', err);
    }
  }

  getSession(scanId?: string, tabId?: number, url?: string): ActiveScanSession | undefined {
    if (scanId) {
      return this.activeSessions.get(scanId);
    }
    const sessions = Array.from(this.activeSessions.values());
    if (sessions.length === 0) return undefined;

    // 1. Prioritize matching both tabId AND same origin URL
    if (tabId !== undefined && url) {
      for (let i = sessions.length - 1; i >= 0; i--) {
        const s = sessions[i];
        if (!s) continue;
        if (s.tabId === tabId && s.targetUrl && isSameOrigin(s.targetUrl, url)) {
          return s;
        }
      }
    }

    // 2. Prioritize matching same origin URL
    if (url) {
      for (let i = sessions.length - 1; i >= 0; i--) {
        const s = sessions[i];
        if (!s) continue;
        if (s.targetUrl && isSameOrigin(s.targetUrl, url)) {
          return s;
        }
      }
    }

    // 3. Match on tabId
    if (tabId !== undefined) {
      for (let i = sessions.length - 1; i >= 0; i--) {
        const s = sessions[i];
        if (!s) continue;
        if (s.tabId === tabId) {
          return s;
        }
      }
    }

    // 4. Fallback to latest session if url is omitted or matches
    const latest = sessions[sessions.length - 1];
    if (!url || (latest?.targetUrl && isSameOrigin(latest.targetUrl, url))) {
      return latest;
    }

    return undefined;
  }

  async clearSessions(): Promise<void> {
    for (const [id, session] of this.activeSessions.entries()) {
      if (session.state === 'running') {
        this.cancellation.cancel(id, 'Session state cleared');
      }
      if (session.tabId) {
        BadgeService.clear(session.tabId);
      }
    }
    this.activeSessions.clear();
    BadgeService.clear();
    await this.clearStorageSession();
  }

  async startInspection(
    mode: InspectionMode,
    targetTabId?: number,
    options?: InspectionOptions,
  ): Promise<
    WebsiteInspection & {
      scores?: Record<string, CategoryScore> & {
        security: CategoryScore;
        seo: CategoryScore;
        performance: CategoryScore;
        accessibility: CategoryScore;
      };
    }
  > {
    let tab = targetTabId !== undefined
      ? await this.adapter.getTab(targetTabId)
      : await this.adapter.getActiveTab();

    if (!tab && this.adapter.browserType === 'mock') {
      tab = {
        id: targetTabId ?? 1,
        url: 'https://example.com',
        title: 'Mock Tab',
        active: true,
        windowId: 1,
        incognito: false,
      };
      if ('setMockTab' in this.adapter && typeof (this.adapter as any).setMockTab === 'function') {
        (this.adapter as any).setMockTab(tab);
      }
    }

    if (!tab || tab.id === undefined) {
      throw new Error('No inspectable browser tab found');
    }

    if (!tab.url) {
      throw new Error('Target tab has no valid URL loaded');
    }

    const schemeCheck = validateScheme(tab.url);
    if (!schemeCheck.valid) {
      throw new Error(`Cannot inspect URL: ${schemeCheck.reason || 'Restricted scheme'}`);
    }

    const normalizedUrl = normalizeUrl(tab.url);
    const parsedUrl = new URL(normalizedUrl);
    const tabId = tab.id;

    const scanId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `scan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const signal = this.cancellation.register(scanId);

    const session: ActiveScanSession = {
      scanId,
      mode,
      targetUrl: normalizedUrl,
      tabId,
      state: 'running',
      startedAt: Date.now(),
    };
    this.activeSessions.set(scanId, session);

    const isLocalDev = isLocalDevelopmentHost(parsedUrl.hostname);

    const inspection: WebsiteInspection = {
      id: scanId,
      mode,
      target: {
        url: normalizedUrl,
        origin: parsedUrl.origin,
        hostname: parsedUrl.hostname,
        inspectedAt: session.startedAt,
        isLocalDevelopment: isLocalDev,
      },
      isDevelopmentEnvironment: isLocalDev,
      browser: {
        name: this.adapter.browserType === 'firefox' ? 'firefox' : 'chrome',
      },
      modules: {},
      findings: [],
      summary: {
        completedModules: 0,
        partialModules: 0,
        failedModules: 0,
        totalFindings: 0,
        passedFindings: 0,
        warningFindings: 0,
        failedFindings: 0,
      },
      startedAt: session.startedAt,
    };

    session.inspection = inspection;
    this.persistSession(session).catch(() => {});

    if (tabId) {
      BadgeService.setScanning(tabId);
    }

    try {
      const plan = getModePlan(mode);

      const shouldRefresh = Boolean(options?.refreshPage);
      if (shouldRefresh) {
        const refreshProgress: ScanProgressEvent = {
          scanId,
          mode,
          step: 'Hard refreshing page (clearing cache) for accurate data usage...',
          percent: 3,
          completedModules: 0,
          totalModules: plan.modules.length,
          timestamp: Date.now(),
        };
        session.progress = refreshProgress;
        this.emitProgress(refreshProgress);

        await this.adapter.reloadTab(tabId, { bypassCache: true, signal, timeoutMs: 15000 });

        if (signal.aborted) throw signal.reason;

        await new Promise((resolve) => setTimeout(resolve, 350));

        const readyProgress: ScanProgressEvent = {
          scanId,
          mode,
          step: 'Page refreshed. Initializing audit modules...',
          percent: 6,
          completedModules: 0,
          totalModules: plan.modules.length,
          timestamp: Date.now(),
        };
        session.progress = readyProgress;
        this.emitProgress(readyProgress);
      }

      await this.ensureContentScriptInjected(tabId, signal);

      const tasks: ScheduledTask[] = plan.modules.map((planItem) => ({
        planItem,
        run: async ({ signal: moduleSignal }) => {
          if (moduleSignal.aborted) {
            throw moduleSignal.reason;
          }

          let moduleOptions: Record<string, unknown> | undefined;

          if (planItem.id === 'technology') {
            try {
              if (this.adapter.capabilities?.hasScriptingApi) {
                const mainWorldResults = await this.adapter.executeScript({
                  tabId,
                  world: 'MAIN',
                  func: () => {
                    const results: Array<{ name: string; category: string; version?: string; evidence: string; confidence: number }> = [];
                    try {
                      const w = window as any;
                      if (w.React?.version) {
                        results.push({ name: 'React', category: 'JavaScript Framework', version: String(w.React.version), evidence: `window.React.version: ${w.React.version}`, confidence: 1.0 });
                      } else if (w.React || w.ReactDOM || w.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size > 0) {
                        results.push({ name: 'React', category: 'JavaScript Framework', evidence: 'window.React / ReactDOM in main world', confidence: 0.98 });
                      } else {
                        const candidates = document.querySelectorAll('#root, #__next, #app, #main, [id*="root"], body > div');
                        for (const el of Array.from(candidates)) {
                          const keys = Object.keys(el);
                          const fiberKey = keys.find((k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance') || k.startsWith('__reactContainer') || k.startsWith('_reactRootContainer'));
                          if (fiberKey) {
                            results.push({ name: 'React', category: 'JavaScript Framework', evidence: `React Fiber mounted on DOM node #${(el as HTMLElement).id || el.tagName.toLowerCase()} (${fiberKey})`, confidence: 1.0 });
                            break;
                          }
                        }
                      }

                      if (w.next?.version) {
                        results.push({ name: 'Next.js', category: 'Web Framework', version: String(w.next.version), evidence: `window.next.version: ${w.next.version}`, confidence: 1.0 });
                      } else if (w.__NEXT_DATA__ || w.next || w.__next_f) {
                        results.push({ name: 'Next.js', category: 'Web Framework', evidence: 'window.__NEXT_DATA__ / window.next in main world', confidence: 1.0 });
                      }

                      if (w.Vue?.version) {
                        results.push({ name: 'Vue.js', category: 'JavaScript Framework', version: String(w.Vue.version), evidence: `window.Vue.version: ${w.Vue.version}`, confidence: 1.0 });
                      } else if (w.Vue || w.__VUE__ || w.__VUE_HMR_RUNTIME__) {
                        results.push({ name: 'Vue.js', category: 'JavaScript Framework', evidence: 'window.Vue / __VUE__ in main world', confidence: 0.98 });
                      } else {
                        const el = document.querySelector('#app, #root, body > div');
                        if (el && ('__vue__' in el || '__vue_app__' in el)) {
                          results.push({ name: 'Vue.js', category: 'JavaScript Framework', evidence: 'Vue instance mounted on DOM node', confidence: 1.0 });
                        }
                      }

                      if (w.$nuxt || w.__NUXT__ || w.__NUXT_DATA__) {
                        results.push({ name: 'Nuxt.js', category: 'Web Framework', evidence: 'window.$nuxt / __NUXT__ in main world', confidence: 1.0 });
                      }

                      if (w.angular?.version?.full) {
                        results.push({ name: 'Angular', category: 'JavaScript Framework', version: String(w.angular.version.full), evidence: `window.angular.version: ${w.angular.version.full}`, confidence: 1.0 });
                      } else if (w.angular || w.ng || w.getAllAngularRootElements) {
                        results.push({ name: 'Angular', category: 'JavaScript Framework', evidence: 'window.angular / window.ng in main world', confidence: 0.95 });
                      }

                      if (w.__remixContext || w.__remixManifest) {
                        results.push({ name: 'Remix', category: 'Web Framework', evidence: 'window.__remixContext in main world', confidence: 1.0 });
                      }

                      if (w.___gatsby) {
                        results.push({ name: 'Gatsby', category: 'Web Framework', evidence: 'window.___gatsby in main world', confidence: 1.0 });
                      }

                      if (w.Solid || w._$HY) {
                        results.push({ name: 'Solid.js', category: 'JavaScript Framework', evidence: 'window.Solid in main world', confidence: 0.95 });
                      }

                      if (w.Alpine?.version) {
                        results.push({ name: 'Alpine.js', category: 'JavaScript Framework', version: String(w.Alpine.version), evidence: `window.Alpine.version: ${w.Alpine.version}`, confidence: 1.0 });
                      } else if (w.Alpine) {
                        results.push({ name: 'Alpine.js', category: 'JavaScript Framework', evidence: 'window.Alpine in main world', confidence: 0.95 });
                      }

                      if (w.htmx?.version) {
                        results.push({ name: 'HTMX', category: 'JavaScript Library', version: String(w.htmx.version), evidence: `window.htmx.version: ${w.htmx.version}`, confidence: 1.0 });
                      } else if (w.htmx) {
                        results.push({ name: 'HTMX', category: 'JavaScript Library', evidence: 'window.htmx in main world', confidence: 0.95 });
                      }

                      if (w.jQuery?.fn?.jquery) {
                        results.push({ name: 'jQuery', category: 'JavaScript Library', version: String(w.jQuery.fn.jquery), evidence: `window.jQuery.fn.jquery: ${w.jQuery.fn.jquery}`, confidence: 1.0 });
                      } else if (w.$?.fn?.jquery) {
                        results.push({ name: 'jQuery', category: 'JavaScript Library', version: String(w.$.fn.jquery), evidence: `window.$.fn.jquery: ${w.$.fn.jquery}`, confidence: 1.0 });
                      }
                    } catch {
                    }
                    return results;
                  },
                });
                if (mainWorldResults && mainWorldResults[0] && Array.isArray(mainWorldResults[0])) {
                  moduleOptions = { mainWorldTech: mainWorldResults[0] };
                }
              }
            } catch {
            }
          }

          try {
            const response = await this.bus.sendToTab(
              tabId,
              MESSAGE_CHANNELS.EXECUTE_COLLECTOR,
              { module: planItem.id, options: moduleOptions },
            );

            if (response && response.result) {
              return response.result;
            }
          } catch {
          }

          if (this.adapter.browserType === 'mock') {
            const res = await runPageCollector(planItem.id, {
              document: (typeof document !== 'undefined' ? document : undefined) as unknown as Document,
              window: typeof window !== 'undefined' ? window : undefined,
              url: normalizedUrl,
              options: moduleOptions,
            });
            if (res.status === 'partial') {
              res.status = 'completed';
            }
            return res;
          }

          throw new Error(`Collector ${planItem.id} failed in tab ${tabId}`);
        },
      }));

      const scheduler = new TaskScheduler({
        scanId,
        maxConcurrency: plan.maxConcurrency,
        signal,
        onProgress: (p) => {
          const effectivePercent = mode === 'deep' ? Math.round(p.percent * 0.4) : p.percent;
          const progressEvent: ScanProgressEvent = {
            scanId,
            mode,
            step: `Evaluating ${p.moduleName}...`,
            module: p.moduleId,
            percent: effectivePercent,
            completedModules: p.completedCount,
            totalModules: mode === 'deep' ? plan.modules.length + 5 : p.totalCount,
            timestamp: Date.now(),
          };
          session.progress = progressEvent;
          this.emitProgress(progressEvent);
        },
      });

      const moduleResults = await scheduler.executeAll(tasks);
      inspection.modules = { ...moduleResults };

      try {
        if (!signal.aborted && this.adapter.browserType !== 'mock') {
          const scrollProgress: ScanProgressEvent = {
            scanId,
            mode,
            step: 'Measuring full page data usage & below-the-fold assets...',
            percent: Math.min(92, (session.progress?.percent || 50) + 5),
            completedModules: Object.keys(inspection.modules).length,
            totalModules: plan.modules.length,
            timestamp: Date.now(),
          };
          session.progress = scrollProgress;
          this.emitProgress(scrollProgress);

          const scrollRes = await this.bus.sendToTab(
            tabId,
            MESSAGE_CHANNELS.MEASURE_SCROLLED_PAGE,
            undefined,
          );

          if (scrollRes && scrollRes.success) {
            const perfModule = inspection.modules['performance'];
            if (perfModule && perfModule.data) {
              const perfData = perfModule.data as PerformanceData;
              perfData.scrolledResourceCount = scrollRes.scrolledResourceCount;
              perfData.scrolledTransferSizeApprox = scrollRes.scrolledTransferSizeApprox;
              perfData.scrolledDecodedSizeApprox = scrollRes.scrolledDecodedSizeApprox;
              perfData.scrolledWireTransferBytes = scrollRes.scrolledWireTransferBytes;
              perfData.scrolledDecodedBytes = scrollRes.scrolledDecodedBytes;
              perfData.scrolledCacheHitCount = scrollRes.scrolledCacheHitCount;
              perfData.scrolledCacheHitBytes = scrollRes.scrolledCacheHitBytes;
              perfData.scrolledOpaqueResourceCount = scrollRes.scrolledOpaqueResourceCount;
              perfData.isInfiniteScrollDetected = scrollRes.isInfiniteScroll;
            }
          }
        }
      } catch {
      }

      try {
        if (typeof fetch === 'function' && inspection.target.url.startsWith('http')) {
          const resp = await fetch(inspection.target.url, {
            method: 'HEAD',
            credentials: 'omit',
            cache: 'no-cache',
          });
          const headersMap: Record<string, string> = {};
          resp.headers.forEach((val, key) => {
            headersMap[key.toLowerCase()] = val;
          });
          if (Object.keys(headersMap).length > 0) {
            const headersData = HeadersService.processHeaders(
              headersMap,
              resp.status,
              resp.statusText,
              inspection.target.url,
              'HEAD',
            );

            inspection.modules['headers'] = {
              module: 'headers',
              status: 'completed',
              collectedAt: Date.now(),
              data: headersData,
              coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
              limitations: [],
              errors: [],
              sources: ['HttpHeadResponse'],
            };

            const secModule = inspection.modules['security'] || inspection.modules['securitySignals'];
            if (secModule && secModule.data) {
              (secModule.data as any).securityHeaders = headersMap;
              (secModule.data as any).responseHeaders = headersData;
            }

            const techModule = inspection.modules['technology'];
            if (techModule && techModule.data) {
              const techData = techModule.data as TechnologyData;
              const backendTech = detectBackendFromHeaders(headersMap);
              if (backendTech.length > 0) {
                const currentList = techData.technologies || [];
                const existingNames = new Set(currentList.map((t: any) => t.name.toLowerCase()));

                for (const b of backendTech) {
                  const key = b.name.toLowerCase();
                  if (!existingNames.has(key)) {
                    currentList.push(b);
                    existingNames.add(key);
                  } else {
                    const existing = currentList.find((t: any) => t.name.toLowerCase() === key);
                    if (existing) {
                      if (!existing.version && b.version) existing.version = b.version;
                      if (b.confidence > existing.confidence) {
                        existing.confidence = b.confidence;
                        existing.evidence = b.evidence;
                      }
                    }
                  }
                }

                techData.technologies = currentList;
                const catSet = new Set(techData.categoriesFound || []);
                currentList.forEach((t: any) => {
                  if (t.category) catSet.add(t.category);
                });
                techData.categoriesFound = Array.from(catSet);
              }
            }
          }
        }
      } catch {
      }

      if (inspection.modules['security']) {
        inspection.modules['securitySignals'] = inspection.modules['security'];
        inspection.modules['securityHeaders'] = inspection.modules['security'];
      }
      if (inspection.modules['privacy']) {
        inspection.modules['privacySignals'] = inspection.modules['privacy'];
      }
      if (inspection.modules['metadata']) {
        inspection.modules['seo'] = inspection.modules['metadata'];
      }
      if (inspection.modules['dom']) {
        inspection.modules['content'] = inspection.modules['dom'];
      }

      const scriptsMod = inspection.modules['scripts'];
      const stylesMod = inspection.modules['styles'];
      const mediaMod = inspection.modules['media'];
      const linksMod = inspection.modules['links'];

      const scriptsData = scriptsMod?.data as any;
      const stylesData = stylesMod?.data as any;
      const mediaData = mediaMod?.data as any;
      const linksData = linksMod?.data as any;

      const scriptsList = scriptsData?.scripts || [];
      const stylesheetsList = stylesData?.stylesheets || [];
      const imagesList = mediaData?.images || [];

      const originsSet = new Set<string>();
      if (scriptsData?.externalDomains) {
        scriptsData.externalDomains.forEach((d: string) => {
          if (d && !d.includes('localhost')) originsSet.add(d);
        });
      }
      if (stylesheetsList) {
        stylesheetsList.forEach((s: any) => {
          if (s.isExternal && s.domain) originsSet.add(s.domain);
        });
      }
      if (linksData?.externalLinks) {
        linksData.externalLinks.forEach((l: any) => {
          try {
            if (l.url) {
              const u = new URL(l.url, 'http://localhost');
              if (u.hostname && !u.hostname.includes('localhost')) {
                originsSet.add(u.hostname);
              }
            }
          } catch {
          }
        });
      }

      inspection.modules['resources'] = {
        module: 'resources',
        status: (scriptsMod?.status === 'completed' || mediaMod?.status === 'completed' || stylesMod?.status === 'completed') ? 'completed' : 'partial',
        collectedAt: Date.now(),
        data: {
          scripts: scriptsList,
          scriptCount: scriptsData?.scriptCount ?? scriptsList.length,
          stylesheets: stylesheetsList,
          stylesheetCount: stylesData?.stylesheetCount ?? stylesheetsList.length,
          images: imagesList,
          imageCount: mediaData?.totalImages ?? imagesList.length,
          thirdPartyOrigins: Array.from(originsSet).sort(),
        },
        coverage: {
          expected: 4,
          collected: (scriptsMod ? 1 : 0) + (stylesMod ? 1 : 0) + (mediaMod ? 1 : 0) + (linksMod ? 1 : 0),
          unavailable: 0,
          supported: true,
        },
        limitations: [],
        errors: [],
        sources: ['DOM:script', 'DOM:link[rel="stylesheet"]', 'DOM:img', 'DOM:a'],
      };

      if (signal.aborted) {
        throw signal.reason || new ScanCancelledError(scanId);
      }

      if (mode === 'deep') {
        this.emitProgress({
          scanId,
          mode,
          step: 'Running site discovery and bounded same-origin crawler...',
          module: 'crawler',
          percent: 45,
          completedModules: Object.keys(inspection.modules).length,
          totalModules: plan.modules.length + 5,
          timestamp: Date.now(),
        });

        if (isLocalDev) {
          inspection.modules['crawler'] = {
            module: 'crawler',
            status: 'skipped',
            collectedAt: Date.now(),
            data: null,
            coverage: {
              expected: 0,
              collected: 0,
              unavailable: 0,
              supported: true,
              message: 'Local development target (crawler skipped to prevent loopback recursion)',
            },
            limitations: ['Crawler disabled on local development hostnames to prevent private loopback traversal.'],
            errors: [],
            sources: ['WebsiteCrawler'],
          };
        } else {
          const crawler = new WebsiteCrawler({
            ...options?.crawlLimits,
          });

          const crawlResult = await crawler.crawl(inspection.target.origin, signal);

          inspection.modules['crawler'] = {
            module: 'crawler',
            status:
              crawlResult.status === 'error'
                ? 'failed'
                : crawlResult.status === 'aborted'
                ? 'partial'
                : 'completed',
            collectedAt: crawlResult.finishedAt,
            data: crawlResult,
            coverage: {
              expected: options?.crawlLimits?.maxPages || 50,
              collected: crawlResult.pages.length,
              unavailable: crawlResult.progress.excludedUrls.length,
              supported: true,
            },
            limitations: [],
            errors: crawlResult.error ? [crawlResult.error] : [],
            sources: ['WebsiteCrawler'],
          };

          if (crawlResult.robots) {
            inspection.modules['robots'] = {
              module: 'robots',
              status: 'completed',
              collectedAt: Date.now(),
              data: crawlResult.robots,
              coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
              limitations: [],
              errors: [],
              sources: ['RobotsParser'],
            };
          }

          if (crawlResult.sitemaps && crawlResult.sitemaps.length > 0) {
            inspection.modules['sitemap'] = {
              module: 'sitemap',
              status: 'completed',
              collectedAt: Date.now(),
              data: {
                sitemaps: crawlResult.sitemaps,
                totalFound: crawlResult.sitemaps.length,
              },
              coverage: {
                expected: 1,
                collected: crawlResult.sitemaps.length,
                unavailable: 0,
                supported: true,
              },
              limitations: [],
              errors: [],
              sources: ['SitemapParser'],
            };
          }
        }

        if (signal.aborted) {
          throw signal.reason || new ScanCancelledError(scanId);
        }

        this.emitProgress({
          scanId,
          mode,
          step: 'Evaluating external intelligence lookups...',
          module: 'intelligence',
          percent: 75,
          completedModules: Object.keys(inspection.modules).length,
          totalModules: plan.modules.length + 5,
          timestamp: Date.now(),
        });

        if (options?.externalConsent) {
          consentManager.setConsent(inspection.target.origin, options.externalConsent);
        }

        if (isLocalDev) {
          const makeLocalDevSkipped = (name: string, source: string, desc: string): CollectionResult => ({
            module: name,
            status: 'skipped',
            collectedAt: Date.now(),
            data: null,
            coverage: { expected: 0, collected: 0, unavailable: 0, supported: true, message: 'Local development target' },
            limitations: [`External ${desc} lookups do not apply to local development environments.`],
            errors: [],
            sources: [source],
          });
          inspection.modules['dns'] = makeLocalDevSkipped('dns', 'DohResolver', 'DNS');
          inspection.modules['ipAsn'] = makeLocalDevSkipped('ipAsn', 'AsnLookupClient', 'BGP/ASN');
          inspection.modules['certificate'] = makeLocalDevSkipped('certificate', 'CtLogsClient', 'Certificate Transparency');
          inspection.modules['tls'] = makeLocalDevSkipped('tls', 'TlsEvaluator', 'remote TLS');
        } else if (!options?.skipIntelligence) {
          if (consentManager.hasConsent(inspection.target.origin, 'doh')) {
            try {
              const doh = new DohResolver({ skipConsentCheck: false });
              const dnsRes = await doh.resolve(inspection.target.hostname, 'A', inspection.target.origin);
              inspection.modules['dns'] = {
                module: 'dns',
                status: dnsRes.error ? 'partial' : 'completed',
                collectedAt: dnsRes.queriedAt,
                data: dnsRes,
                coverage: { expected: 1, collected: dnsRes.answers.length, unavailable: 0, supported: true },
                limitations: [],
                errors: dnsRes.error ? [dnsRes.error] : [],
                sources: ['DohResolver'],
              };
            } catch (err: any) {
              inspection.modules['dns'] = {
                module: 'dns',
                status: 'failed',
                collectedAt: Date.now(),
                data: null,
                coverage: { expected: 1, collected: 0, unavailable: 1, supported: true },
                limitations: [],
                errors: [err.message],
                sources: ['DohResolver'],
              };
            }
          } else {
            inspection.modules['dns'] = {
              module: 'dns',
              status: 'blocked',
              collectedAt: Date.now(),
              data: null,
              coverage: {
                expected: 1,
                collected: 0,
                unavailable: 1,
                supported: true,
                message: 'User consent required',
              },
              limitations: ['External lookup paused pending user consent in Settings (⚙️)'],
              errors: [],
              sources: ['ConsentManager'],
            };
          }

          if (consentManager.hasConsent(inspection.target.origin, 'ip-asn')) {
            try {
              const asnClient = new AsnLookupClient({ skipConsentCheck: false });
              const dnsData = inspection.modules['dns']?.data as any;
              const targetIp = dnsData?.answers?.[0]?.data;
              if (targetIp) {
                const asnRes = await asnClient.lookup(targetIp, inspection.target.origin);
                inspection.modules['ipAsn'] = {
                  module: 'ipAsn',
                  status: asnRes.error ? 'partial' : 'completed',
                  collectedAt: asnRes.queriedAt,
                  data: asnRes,
                  coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
                  limitations: [],
                  errors: asnRes.error ? [asnRes.error] : [],
                  sources: ['AsnLookupClient'],
                };
              }
            } catch (err: any) {
              inspection.modules['ipAsn'] = {
                module: 'ipAsn',
                status: 'failed',
                collectedAt: Date.now(),
                data: null,
                coverage: { expected: 1, collected: 0, unavailable: 1, supported: true },
                limitations: [],
                errors: [err.message],
                sources: ['AsnLookupClient'],
              };
            }
          } else {
            inspection.modules['ipAsn'] = {
              module: 'ipAsn',
              status: 'blocked',
              collectedAt: Date.now(),
              data: null,
              coverage: {
                expected: 1,
                collected: 0,
                unavailable: 1,
                supported: true,
                message: 'User consent required',
              },
              limitations: ['External lookup paused pending user consent in Settings (⚙️)'],
              errors: [],
              sources: ['ConsentManager'],
            };
          }

          if (consentManager.hasConsent(inspection.target.origin, 'crt-sh')) {
            try {
              const ctClient = new CtLogsClient({ skipConsentCheck: false });
              const ctRes = await ctClient.query(inspection.target.hostname);
              inspection.modules['certificate'] = {
                module: 'certificate',
                status: ctRes.error ? 'partial' : 'completed',
                collectedAt: ctRes.queriedAt,
                data: ctRes,
                coverage: {
                  expected: 1,
                  collected: ctRes.certificates.length,
                  unavailable: 0,
                  supported: true,
                },
                limitations: [],
                errors: ctRes.error ? [ctRes.error] : [],
                sources: ['CtLogsClient'],
              };
            } catch (err: any) {
              inspection.modules['certificate'] = {
                module: 'certificate',
                status: 'failed',
                collectedAt: Date.now(),
                data: null,
                coverage: { expected: 1, collected: 0, unavailable: 1, supported: true },
                limitations: [],
                errors: [err.message],
                sources: ['CtLogsClient'],
              };
            }
          } else {
            inspection.modules['certificate'] = {
              module: 'certificate',
              status: 'blocked',
              collectedAt: Date.now(),
              data: null,
              coverage: {
                expected: 1,
                collected: 0,
                unavailable: 1,
                supported: true,
                message: 'User consent required',
              },
              limitations: ['External lookup paused pending user consent in Settings (⚙️)'],
              errors: [],
              sources: ['ConsentManager'],
            };
          }

          if (consentManager.hasConsent(inspection.target.origin, 'tls')) {
            try {
              const tls = new TlsEvaluator();
              const tlsRes = tls.evaluateTls(
                inspection.target.hostname,
                inspection.target.url.startsWith('https:'),
              );
              inspection.modules['tls'] = {
                module: 'tls',
                status: 'completed',
                collectedAt: tlsRes.queriedAt,
                data: tlsRes,
                coverage: { expected: 1, collected: 1, unavailable: 0, supported: true },
                limitations: [],
                errors: [],
                sources: ['TlsEvaluator'],
              };
            } catch (err: any) {
              inspection.modules['tls'] = {
                module: 'tls',
                status: 'failed',
                collectedAt: Date.now(),
                data: null,
                coverage: { expected: 1, collected: 0, unavailable: 1, supported: true },
                limitations: [],
                errors: [err.message],
                sources: ['TlsEvaluator'],
              };
            }
          } else {
            inspection.modules['tls'] = {
              module: 'tls',
              status: 'blocked',
              collectedAt: Date.now(),
              data: null,
              coverage: {
                expected: 1,
                collected: 0,
                unavailable: 1,
                supported: true,
                message: 'User consent required',
              },
              limitations: ['External lookup paused pending user consent in Settings (⚙️)'],
              errors: [],
              sources: ['ConsentManager'],
            };
          }
        }
      }

      if (signal.aborted) {
        throw signal.reason || new ScanCancelledError(scanId);
      }

      inspection.findings = await this.executeAnalyzers(
        inspection.target,
        mode,
        inspection.modules,
        signal,
      );

      if (!inspection.target.url.startsWith('https://') && !isLocalDev) {
        if (!inspection.findings.some((f) => f.ruleId === 'sec-missing-https')) {
          inspection.findings.push({
            id: `sec-missing-https-${scanId}`,
            ruleId: 'sec-missing-https',
            category: 'security',
            title: 'Missing HTTPS Encryption',
            description: 'The target website is served over unencrypted HTTP, leaving all traffic vulnerable to interception and tampering.',
            severity: 'critical',
            status: 'failed',
            evidence: [
              {
                label: 'Insecure URL Scheme',
                value: inspection.target.url,
                source: 'target',
                observedAt: Date.now(),
              },
            ],
            recommendation: 'Configure TLS/SSL certificate and redirect all HTTP traffic to HTTPS.',
            source: 'SecuritySignalsCollector',
            references: ['https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security'],
          });
        }
      }

      const scoreCalculation = calculateInspectionScores(inspection.findings);
      inspection.scores = scoreCalculation.scores;
      inspection.overallScore = scoreCalculation.overallScore;

      inspection.summary = this.computeSummary(inspection.modules, inspection.findings);
      inspection.completedAt = Date.now();

      session.state = 'completed';
      session.completedAt = inspection.completedAt;

      if (tabId) {
        const issuesCount = (inspection.summary?.failedFindings || 0) + (inspection.summary?.warningFindings || 0);
        BadgeService.setScoreBadge(tabId, scoreCalculation.overallScore, issuesCount);
      }

      await this.persistSession(session);

      this.emitCompleted(scanId, inspection);

      return inspection as any;
    } catch (err: any) {
      if (tabId) {
        BadgeService.clear(tabId);
      }
      if (err instanceof ScanCancelledError || signal.aborted) {
        session.state = 'cancelled';
        session.error = 'Scan cancelled by user';
        this.emitProgress({
          scanId,
          mode,
          step: 'Scan cancelled',
          percent: session.progress?.percent || 0,
          completedModules: session.progress?.completedModules || 0,
          totalModules: session.progress?.totalModules || 0,
          timestamp: Date.now(),
        });
      } else {
        session.state = 'failed';
        session.error = err?.message || 'Inspection failed unexpectedly';
        this.emitFailed(scanId, session.error || 'Inspection failed unexpectedly');
      }
      this.persistSession(session).catch(() => {});
      throw err;
    } finally {
      this.cancellation.cleanup(scanId);
    }
  }

  cancelInspection(scanId: string): boolean {
    const session = this.activeSessions.get(scanId);
    if (!session || session.state !== 'running') {
      return false;
    }
    if (session.tabId) {
      BadgeService.clear(session.tabId);
    }
    return this.cancellation.cancel(scanId, 'Cancelled by user');
  }

  private async ensureContentScriptInjected(tabId: number, signal: AbortSignal): Promise<void> {
    try {
      const pong = await this.bus.sendToTab(tabId, MESSAGE_CHANNELS.PING_CONTENT_SCRIPT, undefined as void);
      if (pong?.pong) {
        return;
      }
    } catch {}

    if (this.adapter.browserType === 'mock') {
      return;
    }

    if (signal.aborted) throw signal.reason;

    try {
      await this.adapter.executeScript({
        tabId,
        files: ['content-scripts/content.js'],
      });
    } catch (err: any) {
      throw new Error(`Failed to inject inspection content script into tab: ${err.message}`);
    }

    let retries = 3;
    while (retries > 0) {
      if (signal.aborted) throw signal.reason;
      try {
        await new Promise((resolve) => setTimeout(resolve, 80));
        const pong = await this.bus.sendToTab(tabId, MESSAGE_CHANNELS.PING_CONTENT_SCRIPT, undefined as void);
        if (pong?.pong) {
          return;
        }
        retries--;
      } catch {
        retries--;
      }
    }

    throw new Error('Content script failed to respond to ping after injection');
  }

  private async executeAnalyzers(
    target: WebsiteInspection['target'],
    mode: InspectionMode,
    modules: Record<string, CollectionResult<unknown>>,
    signal: AbortSignal,
  ): Promise<AuditFinding[]> {
    if (signal.aborted) throw signal.reason;

    return await runAllAnalyzers({
      target,
      mode,
      modules,
    });
  }

  private computeSummary(
    modules: Record<string, CollectionResult<unknown>>,
    findings: AuditFinding[],
  ): InspectionSummary {
    let completedModules = 0;
    let partialModules = 0;
    let failedModules = 0;

    const seenCanonical = new Set<string>();

    for (const [key, res] of Object.entries(modules)) {
      const canonicalKey =
        key === 'securitySignals' ? 'security' : key === 'privacySignals' ? 'privacy' : key;

      if (seenCanonical.has(canonicalKey)) continue;
      seenCanonical.add(canonicalKey);

      if (res.status === 'completed') completedModules++;
      else if (res.status === 'partial') partialModules++;
      else if (res.status === 'failed' || res.status === 'blocked') failedModules++;
    }

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

    return {
      completedModules,
      partialModules,
      failedModules,
      totalFindings: findings.length,
      passedFindings,
      warningFindings,
      failedFindings,
      infoFindings,
      notApplicableFindings,
      notAvailableFindings,
      errorFindings,
    };
  }

  private emitProgress(event: ScanProgressEvent): void {
    try {
      this.bus.sendToBackground(MESSAGE_CHANNELS.SCAN_PROGRESS, event).catch(() => {});
    } catch {}
  }

  private emitCompleted(scanId: string, inspection: WebsiteInspection): void {
    try {
      this.bus.sendToBackground(MESSAGE_CHANNELS.SCAN_COMPLETED, { scanId, inspection }).catch(() => {});
    } catch {}
  }

  private emitFailed(scanId: string, error: string): void {
    try {
      this.bus.sendToBackground(MESSAGE_CHANNELS.SCAN_FAILED, { scanId, error }).catch(() => {});
    } catch {}
  }
}

export const inspectionOrchestrator = new InspectionOrchestrator();
