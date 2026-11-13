import type { AuditFinding } from '../../types/inspection';
import type { CorroborationContext, CorroborationPolicy, RealityState } from '../types';

export class CwvRealityGatePolicy implements CorroborationPolicy {
  readonly policyId = 'cwv-reality-gate-policy';
  readonly priority = 50;

  appliesTo(finding: AuditFinding): boolean {
    return (
      finding.ruleId === 'perf-render-blocking-resources' ||
      finding.ruleId === 'perf-excessive-dom-depth'
    );
  }

  corroborate(finding: AuditFinding, context: CorroborationContext): AuditFinding {
    const perfData = context.modules.performance?.data as
      | Record<string, unknown>
      | undefined;

    let fcpMs: number | undefined;
    let lcpMs: number | undefined;

    if (perfData) {
      const paintTiming = perfData.paintTiming as { fcpMs?: number; fpMs?: number } | undefined;
      const webVitals = perfData.webVitals as { lcpMs?: number } | undefined;

      fcpMs =
        typeof paintTiming?.fcpMs === 'number'
          ? paintTiming.fcpMs
          : typeof perfData.fcpMs === 'number'
          ? (perfData.fcpMs as number)
          : typeof perfData.fcp === 'number'
          ? (perfData.fcp as number)
          : undefined;

      lcpMs =
        typeof webVitals?.lcpMs === 'number'
          ? webVitals.lcpMs
          : typeof perfData.lcpMs === 'number'
          ? (perfData.lcpMs as number)
          : typeof perfData.lcp === 'number'
          ? (perfData.lcp as number)
          : undefined;
    }

    // Fallback: inspect evidence for FCP or LCP values
    if (fcpMs === undefined && Array.isArray(finding.evidence)) {
      const fcpEv = finding.evidence.find((e) =>
        /fcp|first.*contentful.*paint/i.test(e.label)
      );
      if (typeof fcpEv?.value === 'number') {
        fcpMs = fcpEv.value;
      } else if (typeof fcpEv?.value === 'string' && !isNaN(Number(fcpEv.value))) {
        fcpMs = Number(fcpEv.value);
      }
    }

    if (lcpMs === undefined && Array.isArray(finding.evidence)) {
      const lcpEv = finding.evidence.find((e) =>
        /lcp|largest.*contentful.*paint/i.test(e.label)
      );
      if (typeof lcpEv?.value === 'number') {
        lcpMs = lcpEv.value;
      } else if (typeof lcpEv?.value === 'string' && !isNaN(Number(lcpEv.value))) {
        lcpMs = Number(lcpEv.value);
      }
    }

    if (fcpMs !== undefined && lcpMs !== undefined && fcpMs < 1000 && lcpMs < 2500) {
      const previousState: RealityState = finding.realityState ?? 'TRUE_DEFECT';
      const nextState: RealityState = 'SYNTHETIC_NOISE';
      const explanation =
        'Real-world Core Web Vitals confirmed fast rendering (FCP < 1.0s, LCP < 2.5s); render-blocking warning downgraded to diagnostic note.';

      return {
        ...finding,
        realityState: nextState,
        realityMultiplier: 0.05,
        explanation,
        corroborationTraces: [
          ...(finding.corroborationTraces ?? []),
          {
            policyId: this.policyId,
            previousState,
            nextState,
            multiplierApplied: 0.05,
            reason: explanation,
          },
        ],
      };
    }

    return finding;
  }
}

export const cwvRealityGatePolicy = new CwvRealityGatePolicy();
