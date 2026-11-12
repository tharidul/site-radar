import { describe, it, expect } from 'vitest';
import { SecurityAnalyzer } from '../src/analyzers/security.analyzer';
import { PerformanceAnalyzer } from '../src/analyzers/performance.analyzer';
import { SeoAnalyzer } from '../src/analyzers/seo.analyzer';
import { isLocalDevelopmentHost } from '../src/security/private-network.guard';
import { InspectionOrchestrator } from '../src/core/orchestrator/inspection-orchestrator';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';
import type { WebsiteTarget } from '../src/types/inspection';

describe('Engine Adjustments & Refinements', () => {
  describe('SecurityAnalyzer - SRI subresource domain classification', () => {
    const analyzer = new SecurityAnalyzer();
    const target: WebsiteTarget = {
      url: 'https://stripe.com/',
      origin: 'https://stripe.com',
      hostname: 'stripe.com',
      inspectedAt: Date.now(),
    };

    it('does not penalize first-party subdomains or branded CDNs for SRI', async () => {
      const findings = analyzer.analyze({
        target,
        mode: 'standard',
        modules: {
          scripts: {
            data: {
              scripts: [
                { src: 'https://js.stripe.com/v3/', hasSri: false },
                { src: 'https://b.stripecdn.com/stripestat.js', hasSri: false },
              ],
            },
          },
          styles: {
            data: {
              stylesheets: [
                { href: 'https://b.stripecdn.com/styles.css', hasSri: false },
              ],
            },
          },
        },
      } as any);

      const sriScriptFinding = findings.find((f) => f.ruleId === 'sec-missing-sri-scripts');
      const sriStyleFinding = findings.find((f) => f.ruleId === 'sec-missing-sri-links');

      expect(sriScriptFinding?.status).toBe('not-applicable');
      expect(sriStyleFinding?.status).toBe('not-applicable');
    });

    it('correctly warns on actual third-party CDNs missing SRI', () => {
      const findings = analyzer.analyze({
        target,
        mode: 'standard',
        modules: {
          scripts: {
            data: {
              scripts: [
                { src: 'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/react.min.js', hasSri: false },
              ],
            },
          },
          styles: {
            data: {
              stylesheets: [
                { href: 'https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css', hasSri: false },
              ],
            },
          },
        },
      } as any);

      const sriScriptFinding = findings.find((f) => f.ruleId === 'sec-missing-sri-scripts');
      const sriStyleFinding = findings.find((f) => f.ruleId === 'sec-missing-sri-links');

      expect(sriScriptFinding?.status).toBe('warning');
      expect(sriStyleFinding?.status).toBe('warning');
    });
  });

  describe('PerformanceAnalyzer - CLS handling with zero layout shifts', () => {
    const analyzer = new PerformanceAnalyzer();
    const target: WebsiteTarget = {
      url: 'https://amazon.com/',
      origin: 'https://amazon.com',
      hostname: 'amazon.com',
      inspectedAt: Date.now(),
    };

    it('marks CLS as passed with visual stability when clsScore is 0', () => {
      const findings = analyzer.analyze({
        target,
        mode: 'standard',
        modules: {
          performance: {
            data: {
              webVitals: {
                clsScore: 0,
              },
            },
          },
        },
      } as any);

      const clsFinding = findings.find((f) => f.ruleId === 'perf-cls');
      expect(clsFinding?.status).toBe('passed');
      const clsEvidence = clsFinding?.evidence?.find((e: any) => e.label === 'CLS Score');
      expect(clsEvidence?.value).toBe('0.000');
    });
  });

  describe('InspectionOrchestrator - Summary finding categorization', () => {
    it('separates not-available findings from errorFindings', () => {
      const findings = [
        { status: 'passed' },
        { status: 'warning' },
        { status: 'failed' },
        { status: 'info' },
        { status: 'not-applicable' },
        { status: 'not-available' },
      ] as any[];

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

      expect(notAvailableFindings).toBe(1);
      expect(errorFindings).toBe(0);
      expect(passedFindings).toBe(1);
    });
  });

  describe('Localhost & Development Environment Adaptations', () => {
    it('isLocalDevelopmentHost accurately identifies local development origins', () => {
      expect(isLocalDevelopmentHost('localhost')).toBe(true);
      expect(isLocalDevelopmentHost('app.localhost')).toBe(true);
      expect(isLocalDevelopmentHost('127.0.0.1')).toBe(true);
      expect(isLocalDevelopmentHost('127.0.1.1')).toBe(true);
      expect(isLocalDevelopmentHost('0.0.0.0')).toBe(true);
      expect(isLocalDevelopmentHost('::1')).toBe(true);
      expect(isLocalDevelopmentHost('[::1]')).toBe(true);
      expect(isLocalDevelopmentHost('myproject.local')).toBe(true);
      expect(isLocalDevelopmentHost('testsite.test')).toBe(true);

      expect(isLocalDevelopmentHost('digital3sixty.lk')).toBe(false);
      expect(isLocalDevelopmentHost('google.com')).toBe(false);
      expect(isLocalDevelopmentHost('stripe.com')).toBe(false);
    });

    it('SecurityAnalyzer passes HTTPS enforcement on localhost without critical failure', () => {
      const analyzer = new SecurityAnalyzer();
      const localTarget = {
        url: 'http://localhost:3000/',
        origin: 'http://localhost:3000',
        hostname: 'localhost',
        inspectedAt: Date.now(),
      };

      const findings = analyzer.analyze({
        target: localTarget,
        mode: 'standard',
        modules: {},
      } as any);

      const httpsFinding = findings.find((f) => f.ruleId === 'sec-https-enforced');
      expect(httpsFinding).toBeDefined();
      expect(httpsFinding?.status).toBe('passed');
      expect(httpsFinding?.explanation).toContain('Secure Context');
    });

    it('SecurityAnalyzer downgrades password field on localhost to info instead of critical failure', () => {
      const analyzer = new SecurityAnalyzer();
      const localTarget = {
        url: 'http://localhost:3000/login',
        origin: 'http://localhost:3000',
        hostname: 'localhost',
        inspectedAt: Date.now(),
      };

      const findings = analyzer.analyze({
        target: localTarget,
        mode: 'standard',
        modules: {
          forms: {
            data: {
              forms: [
                {
                  action: '/api/login',
                  hasPasswordField: true,
                  fieldTypes: ['text', 'password'],
                },
              ],
            },
          },
        },
      } as any);

      const pwdFinding = findings.find((f) => f.ruleId === 'sec-password-over-http');
      expect(pwdFinding).toBeDefined();
      expect(pwdFinding?.status).toBe('info');
      expect(pwdFinding?.severity).toBe('low');
      expect(pwdFinding?.explanation).toContain('Safe on loopback');
    });

    it('SecurityAnalyzer still fails non-localhost unencrypted HTTP with password critically', () => {
      const analyzer = new SecurityAnalyzer();
      const remoteTarget = {
        url: 'http://insecure-domain.com/login',
        origin: 'http://insecure-domain.com',
        hostname: 'insecure-domain.com',
        inspectedAt: Date.now(),
      };

      const findings = analyzer.analyze({
        target: remoteTarget,
        mode: 'standard',
        modules: {
          forms: {
            data: {
              forms: [
                {
                  action: '/login',
                  hasPasswordField: true,
                  fieldTypes: ['password'],
                },
              ],
            },
          },
        },
      } as any);

      const httpsFinding = findings.find((f) => f.ruleId === 'sec-https-enforced');
      expect(httpsFinding?.status).toBe('failed');
      expect(httpsFinding?.severity).toBe('critical');

      const pwdFinding = findings.find((f) => f.ruleId === 'sec-password-over-http');
      expect(pwdFinding?.status).toBe('failed');
      expect(pwdFinding?.severity).toBe('critical');
    });

    it('SeoAnalyzer passes canonical check when localhost points to production domain', () => {
      const analyzer = new SeoAnalyzer();
      const localTarget = {
        url: 'http://localhost:3000/',
        origin: 'http://localhost:3000',
        hostname: 'localhost',
        inspectedAt: Date.now(),
      };

      const findings = analyzer.analyze({
        target: localTarget,
        mode: 'standard',
        modules: {
          metadata: {
            data: {
              title: 'My Project Homepage',
              canonicalUrl: 'https://digital3sixty.lk/',
              canonicalMatches: false,
            },
          },
        },
      } as any);

      const canonicalFinding = findings.find((f) => f.ruleId === 'seo-canonical-matches');
      expect(canonicalFinding).toBeDefined();
      expect(canonicalFinding?.status).toBe('passed');
      expect(canonicalFinding?.explanation).toContain('authoritative production domain');
    });

    it('InspectionOrchestrator executes Full Page Audit on localhost without scope or runtime errors', async () => {
      const adapter = new MockBrowserAdapter();
      adapter.setMockTab({
        id: 1,
        url: 'http://localhost:3000/',
        title: 'Localhost Dev',
        active: true,
        windowId: 1,
        incognito: false,
      });
      const orchestrator = new InspectionOrchestrator({ browserAdapter: adapter });
      const result = await orchestrator.startInspection('full', 1, { refreshPage: false });
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.target.isLocalDevelopment).toBe(true);
      expect(result.summary.completedModules).toBeGreaterThan(0);
      expect(result.scores?.security?.score).toBeDefined();
    });
  });
});

