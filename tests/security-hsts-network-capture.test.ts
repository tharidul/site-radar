import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkCaptureService } from '../src/services/network-capture.service';
import { SecuritySignalsCollector } from '../src/collectors/page/security-signals.collector';
import { SecurityAnalyzer } from '../src/analyzers/security.analyzer';
import { CorroborationEngine } from '../src/corroborator';
import { InspectionOrchestrator } from '../src/core/orchestrator/inspection-orchestrator';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';
import type { WebsiteTarget } from '../src/types/inspection';

describe('HSTS & Network Capture Architecture (Manifest V3 webRequest)', () => {
  let captureService: NetworkCaptureService;

  beforeEach(() => {
    captureService = new NetworkCaptureService();
  });

  describe('NetworkCaptureService', () => {
    it('captures and caches main_frame response headers per tabId', () => {
      let listener: any = null;
      const mockApi = {
        webRequest: {
          onHeadersReceived: {
            addListener: (fn: any) => {
              listener = fn;
            },
          },
        },
      };

      captureService.init(mockApi);
      expect(captureService.isInitialized()).toBe(true);

      // Simulate a main_frame response from Nginx on staging.digital3sixty.lk
      listener({
        tabId: 42,
        type: 'main_frame',
        url: 'https://staging.digital3sixty.lk/',
        statusCode: 200,
        statusLine: 'HTTP/1.1 200 OK',
        responseHeaders: [
          { name: 'Server', value: 'nginx' },
          { name: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { name: 'Content-Type', value: 'text/html; charset=utf-8' },
        ],
      });

      const captured = captureService.getCapturedHeaders(42);
      expect(captured).toBeDefined();
      expect(captured?.tabId).toBe(42);
      expect(captured?.url).toBe('https://staging.digital3sixty.lk/');
      expect(captured?.headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
      expect(captured?.headers['server']).toBe('nginx');

      // Ignores non-main_frame subresources
      listener({
        tabId: 42,
        type: 'sub_frame',
        url: 'https://staging.digital3sixty.lk/widget',
        statusCode: 200,
        responseHeaders: [{ name: 'Strict-Transport-Security', value: 'max-age=0' }],
      });
      // Cache still has the main_frame header
      expect(captureService.getCapturedHeaders(42)?.headers['strict-transport-security']).toBe(
        'max-age=63072000; includeSubDomains',
      );

      // Cleans up on tab remove
      captureService.removeTab(42);
      expect(captureService.getCapturedHeaders(42)).toBeUndefined();
    });
  });

  describe('SecuritySignalsCollector', () => {
    const collector = new SecuritySignalsCollector();

    it('identifies HSTS when authoritative securityHeaders are provided in context', async () => {
      const mockDoc = {
        location: { href: 'https://staging.digital3sixty.lk/' },
        querySelectorAll: () => [],
        querySelector: () => null,
      } as unknown as Document;

      const result = await collector.collect({
        document: mockDoc,
        url: 'https://staging.digital3sixty.lk/',
        options: {
          securityHeaders: {
            'strict-transport-security': 'max-age=63072000; includeSubDomains',
          },
          isAuthoritativeNetworkCapture: true,
          headersSource: 'webRequest',
        },
      });

      expect(result.data?.hstsPresent).toBe(true);
      expect(result.data?.isAuthoritativeNetworkCapture).toBe(true);
      expect(result.sources).toContain('webRequest.onHeadersReceived');
    });

    it('marks HSTS unverified and notes limitation when no network capture is provided in page context', async () => {
      const mockDoc = {
        location: { href: 'https://staging.digital3sixty.lk/' },
        querySelectorAll: () => [],
        querySelector: () => null,
      } as unknown as Document;

      const result = await collector.collect({
        document: mockDoc,
        url: 'https://staging.digital3sixty.lk/',
      });

      expect(result.data?.hstsPresent).toBe(false);
      expect(result.data?.isAuthoritativeNetworkCapture).toBe(false);
      expect(result.limitations.some((l) => l.includes('webRequest'))).toBe(true);
    });
  });

  describe('SecurityAnalyzer - HSTS evaluation', () => {
    const analyzer = new SecurityAnalyzer();
    const httpsTarget: WebsiteTarget = {
      url: 'https://staging.digital3sixty.lk/',
      origin: 'https://staging.digital3sixty.lk',
      hostname: 'staging.digital3sixty.lk',
      inspectedAt: Date.now(),
    };

    const httpTarget: WebsiteTarget = {
      url: 'http://localhost:3003/',
      origin: 'http://localhost:3003',
      hostname: 'localhost',
      inspectedAt: Date.now(),
    };

    it('passes with confidence 1.0 when HSTS is present on HTTPS target', () => {
      const findings = analyzer.analyze({
        target: httpsTarget,
        mode: 'standard',
        modules: {
          securitySignals: {
            data: {
              isHttps: true,
              upgradeInsecureRequests: false,
              cspPresent: false,
              hstsPresent: true,
              securityHeaders: {
                'strict-transport-security': 'max-age=63072000; includeSubDomains',
              },
              isAuthoritativeNetworkCapture: true,
              headersSource: 'webRequest',
            },
          },
        },
      } as any);

      const hstsFinding = findings.find((f) => f.ruleId === 'sec-missing-hsts');
      expect(hstsFinding).toBeDefined();
      expect(hstsFinding?.status).toBe('passed');
      expect(hstsFinding?.confidence).toBe(1.0);
    });

    it('marks not-applicable when tested against plaintext HTTP (localhost:3003)', () => {
      const findings = analyzer.analyze({
        target: httpTarget,
        mode: 'standard',
        modules: {
          securitySignals: {
            data: {
              isHttps: false,
              upgradeInsecureRequests: false,
              cspPresent: false,
              hstsPresent: false,
              securityHeaders: {
                'content-type': 'text/html',
              },
              isAuthoritativeNetworkCapture: true,
            },
          },
        },
      } as any);

      const hstsFinding = findings.find((f) => f.ruleId === 'sec-missing-hsts');
      expect(hstsFinding).toBeDefined();
      expect(hstsFinding?.status).toBe('not-applicable');
    });

    it('downgrades to not-available (Unobservable) when network headers were not authoritatively captured', () => {
      // Simulate page-context / CORS-restricted fallback where webRequest was unavailable
      const findings = analyzer.analyze({
        target: httpsTarget,
        mode: 'standard',
        modules: {
          securitySignals: {
            data: {
              isHttps: true,
              upgradeInsecureRequests: false,
              cspPresent: false,
              hstsPresent: false,
              securityHeaders: {
                'content-type': 'text/html',
              },
              isAuthoritativeNetworkCapture: false,
              headersSource: 'fetch',
            },
          },
        },
      } as any);

      const hstsFinding = findings.find((f) => f.ruleId === 'sec-missing-hsts');
      expect(hstsFinding).toBeDefined();
      expect(hstsFinding?.status).toBe('not-available');
      expect(hstsFinding?.title).toContain('Unobservable');
      expect(hstsFinding?.confidence).toBeLessThanOrEqual(0.5);
    });

    it('marks failed with confidence 0.9 ONLY when headers were authoritatively captured and HSTS is truly missing', () => {
      const findings = analyzer.analyze({
        target: httpsTarget,
        mode: 'standard',
        modules: {
          securitySignals: {
            data: {
              isHttps: true,
              upgradeInsecureRequests: false,
              cspPresent: false,
              hstsPresent: false,
              securityHeaders: {
                'content-type': 'text/html',
                'server': 'nginx',
              },
              isAuthoritativeNetworkCapture: true,
              headersSource: 'webRequest',
            },
          },
        },
      } as any);

      const hstsFinding = findings.find((f) => f.ruleId === 'sec-missing-hsts');
      expect(hstsFinding).toBeDefined();
      expect(hstsFinding?.status).toBe('failed');
      expect(hstsFinding?.confidence).toBe(0.9);
      expect(hstsFinding?.evidence?.[0]?.value).toContain('authoritative response headers');
    });
  });

  describe('Corroboration Engine with Observability Barrier', () => {
    const corroborator = new CorroborationEngine();
    const httpsTarget: WebsiteTarget = {
      url: 'https://staging.digital3sixty.lk/',
      origin: 'https://staging.digital3sixty.lk',
      hostname: 'staging.digital3sixty.lk',
      inspectedAt: Date.now(),
    };

    it('classifies unverified HSTS as OBSERVABILITY_LIMIT instead of TRUE_DEFECT', () => {
      const analyzer = new SecurityAnalyzer();
      const findings = analyzer.analyze({
        target: httpsTarget,
        mode: 'standard',
        modules: {
          securitySignals: {
            data: {
              isHttps: true,
              upgradeInsecureRequests: false,
              cspPresent: false,
              hstsPresent: false,
              securityHeaders: { 'content-type': 'text/html' },
              isAuthoritativeNetworkCapture: false,
              headersSource: 'fetch',
            },
          },
        },
      } as any);

      const corroborated = corroborator.corroborate(findings, {
        target: httpsTarget,
        modules: {},
      });

      const hstsFinding = corroborated.find((f) => f.ruleId === 'sec-missing-hsts');
      expect(hstsFinding).toBeDefined();
      expect(hstsFinding?.status).toBe('not-available');
      expect(hstsFinding?.realityState).toBe('OBSERVABILITY_LIMIT');
      expect(hstsFinding?.realityMultiplier).toBe(0.0);
    });
  });

  describe('InspectionOrchestrator Integration', () => {
    it('uses captured headers directly when available', async () => {
      const orchestrator = new InspectionOrchestrator({
        browserAdapter: new MockBrowserAdapter(),
      });

      const inspection = await orchestrator.startInspection('full', 101, {
        networkHeaders: {
          tabId: 101,
          url: 'https://staging.digital3sixty.lk/',
          statusCode: 200,
          statusLine: 'HTTP/1.1 200 OK',
          headers: {
            'strict-transport-security': 'max-age=63072000; includeSubDomains',
            'content-type': 'text/html',
          },
          rawHeaders: [
            { name: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          ],
          timestamp: Date.now(),
        },
      });

      expect(inspection).toBeDefined();

      const secData = inspection.modules['securitySignals']?.data as any;
      expect(secData?.hstsPresent).toBe(true);
      expect(secData?.isAuthoritativeNetworkCapture).toBe(true);

      const findings = inspection.findings ?? [];
      const hstsFinding = findings.find((f) => f.ruleId === 'sec-missing-hsts');
      expect(hstsFinding?.status).toBe('passed');
    });
  });
});
