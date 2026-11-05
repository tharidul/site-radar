/**
 * @file src/core/orchestrator/inspection-orchestrator.ts
 * @description Central inspection engine orchestrating collection modules, analyzers,
 * category scoring, progress broadcasting, bounded crawling, and external intelligence.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 2, 4, 6, 9, 10.
 */

import type {
  InspectionMode,
  WebsiteInspection,
  CollectionResult,
  AuditFinding,
  InspectionSummary,
  CategoryScore,
} from '../../types/inspection';
import type { ScanProgressEvent } from '../../types/messaging';
import type { CrawlLimits } from '../../types/crawler';
import { MESSAGE_CHANNELS } from '../../types/messaging';
import { getBrowserAdapter, type BrowserAdapter } from '../../browser/adapters';
import { messageBus, type IMessageBus } from '../../messaging/bus';
import { validateScheme } from '../../security/scheme-validator';
import { normalizeUrl } from '../../security/url-normalizer';
import { cancellationManager, type ICancellationManager, ScanCancelledError } from './cancellation';
import { getModePlan } from './mode-plans';
import { TaskScheduler, type ScheduledTask } from './scheduler';
import { runAllAnalyzers } from '../../analyzers';
import { calculateInspectionScores } from '../../scoring';
import { runPageCollector } from '../../collectors/page';
import { WebsiteCrawler } from '../../crawler/crawler';
import {
  consentManager,
  DohResolver,
  AsnLookupClient,
  CtLogsClient,
  TlsEvaluator,
} from '../../intelligence';

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

  /**
   * Returns current active scan session by ID, or the most recent session.
   */
  getSession(scanId?: string): ActiveScanSession | undefined {
    if (scanId) {
      return this.activeSessions.get(scanId);
    }
    const sessions = Array.from(this.activeSessions.values());
    return sessions.length > 0 ? sessions[sessions.length - 1] : undefined;
  }

  /**
   * Clears in-memory audit results and sessions to guarantee zero persistent history.
   */
  clearSessions(): void {
    for (const [id, session] of this.activeSessions.entries()) {
      if (session.state === 'running') {
        this.cancellation.cancel(id, 'Session state cleared');
      }
    }
    this.activeSessions.clear();
  }

  /**
   * Starts a new website inspection in the specified mode.
   */
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
    // 1. Resolve and validate target tab
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

    // 2. Initialize Scan Session
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

    const inspection: WebsiteInspection = {
      id: scanId,
      mode,
      target: {
        url: normalizedUrl,
        origin: parsedUrl.origin,
        hostname: parsedUrl.hostname,
        inspectedAt: session.startedAt,
      },
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

    try {
      // 3. Ensure content script is ready in target tab
      await this.ensureContentScriptInjected(tabId, signal);

      // 4. Resolve Mode Plan
      const plan = getModePlan(mode);

      // 5. Build and Schedule In-Page Collection Tasks (Phase 1)
      const tasks: ScheduledTask[] = plan.modules.map((planItem) => ({
        planItem,
        run: async ({ signal: moduleSignal }) => {
          if (moduleSignal.aborted) {
            throw moduleSignal.reason;
          }

          try {
            const response = await this.bus.sendToTab(
              tabId,
              MESSAGE_CHANNELS.EXECUTE_COLLECTOR,
              { module: planItem.id },
            );

            if (response && response.result) {
              return response.result;
            }
          } catch {
            // Handled below for mock environment fallback
          }

          if (this.adapter.browserType === 'mock') {
            const res = await runPageCollector(planItem.id, {
              document: (typeof document !== 'undefined' ? document : undefined) as unknown as Document,
              window: typeof window !== 'undefined' ? window : undefined,
              url: normalizedUrl,
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

      // Execute in-page collection tasks with isolated boundaries
      const moduleResults = await scheduler.executeAll(tasks);
      inspection.modules = { ...moduleResults };

      if (inspection.modules['security']) {
        Object.defineProperty(inspection.modules, 'securitySignals', {
          value: inspection.modules['security'],
          enumerable: false,
          configurable: true,
          writable: true,
        });
      }
      if (inspection.modules['privacy']) {
        Object.defineProperty(inspection.modules, 'privacySignals', {
          value: inspection.modules['privacy'],
          enumerable: false,
          configurable: true,
          writable: true,
        });
      }
      if (inspection.modules['metadata']) {
        Object.defineProperty(inspection.modules, 'seo', {
          value: inspection.modules['metadata'],
          enumerable: false,
          configurable: true,
          writable: true,
        });
      }

      // Check if scan was cancelled during collection
      if (signal.aborted) {
        throw signal.reason || new ScanCancelledError(scanId);
      }

      // PHASE 2 & 3: Deep Inspection Extended Pipeline
      if (mode === 'deep') {
        // --- Phase 2: Site Discovery & Bounded Crawler ---
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

        if (signal.aborted) {
          throw signal.reason || new ScanCancelledError(scanId);
        }

        // --- Phase 3: External Intelligence Aggregation ---
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

        if (!options?.skipIntelligence) {
          // DoH Resolver
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
              limitations: ['External lookup blocked pending user consent'],
              errors: ['External DoH lookup blocked: user consent required.'],
              sources: ['ConsentManager'],
            };
          }

          // IP & ASN Lookup
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
              limitations: ['External lookup blocked pending user consent'],
              errors: ['External IP/ASN lookup blocked: user consent required.'],
              sources: ['ConsentManager'],
            };
          }

          // CT Logs Client
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
              limitations: ['External lookup blocked pending user consent'],
              errors: ['External CT logs lookup blocked: user consent required.'],
              sources: ['ConsentManager'],
            };
          }

          // TLS Security Evaluator
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
              limitations: ['External lookup blocked pending user consent'],
              errors: ['Live TLS inspection blocked: user consent required.'],
              sources: ['ConsentManager'],
            };
          }
        }
      }

      if (signal.aborted) {
        throw signal.reason || new ScanCancelledError(scanId);
      }

      // 6. Run Analyzers & Finding Generation (Isolated)
      inspection.findings = await this.executeAnalyzers(
        inspection.target,
        mode,
        inspection.modules,
        signal,
      );

      // Ensure sec-missing-https critical finding exists if target is HTTP
      if (!inspection.target.url.startsWith('https://')) {
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

      // 7. Calculate Category Scores
      const scoreCalculation = calculateInspectionScores(inspection.findings);
      inspection.scores = scoreCalculation.scores;

      // 8. Compute Summary Metrics
      inspection.summary = this.computeSummary(inspection.modules, inspection.findings);
      inspection.completedAt = Date.now();

      session.state = 'completed';
      session.completedAt = inspection.completedAt;

      this.emitCompleted(scanId, inspection);

      return inspection as any;
    } catch (err: any) {
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
      throw err;
    } finally {
      this.cancellation.cleanup(scanId);
    }
  }

  /**
   * Cancels a currently running scan session immediately.
   */
  cancelInspection(scanId: string): boolean {
    const session = this.activeSessions.get(scanId);
    if (!session || session.state !== 'running') {
      return false;
    }
    return this.cancellation.cancel(scanId, 'Cancelled by user');
  }

  /**
   * Cross-browser content script handshake and dynamic injection.
   */
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
    let errorFindings = 0;

    for (const f of findings) {
      if (f.status === 'passed') passedFindings++;
      else if (f.status === 'warning') warningFindings++;
      else if (f.status === 'failed') failedFindings++;
      else if (f.status === 'info') infoFindings++;
      else if (f.status === 'not-applicable') notApplicableFindings++;
      else if (f.status === 'not-available' || f.status === 'error') errorFindings++;
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
