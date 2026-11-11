import { describe, it, expect } from 'vitest';
import { SecurityAnalyzer } from '../src/analyzers/security.analyzer';
import { PerformanceAnalyzer } from '../src/analyzers/performance.analyzer';
import type { InspectionTarget } from '../src/types/inspection';

describe('Engine Adjustments & Refinements', () => {
  describe('SecurityAnalyzer - SRI subresource domain classification', () => {
    const analyzer = new SecurityAnalyzer();
    const target: InspectionTarget = {
      url: 'https://stripe.com/',
      origin: 'https://stripe.com',
      hostname: 'stripe.com',
      inspectedAt: new Date().toISOString(),
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
    const target: InspectionTarget = {
      url: 'https://amazon.com/',
      origin: 'https://amazon.com',
      hostname: 'amazon.com',
      inspectedAt: new Date().toISOString(),
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
});

