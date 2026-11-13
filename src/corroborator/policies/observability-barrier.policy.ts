import type { AuditFinding } from '../../types/inspection';
import type { CorroborationContext, CorroborationPolicy, RealityState } from '../types';

export class ObservabilityBarrierPolicy implements CorroborationPolicy {
  readonly policyId = 'observability-barrier-policy';
  readonly priority = 10;

  appliesTo(finding: AuditFinding): boolean {
    if (finding.status === 'not-available' || (finding.status as string) === 'blocked') {
      return true;
    }

    if (Array.isArray(finding.evidence)) {
      return finding.evidence.some((e) => {
        const valStr = String(e.value ?? '').toLowerCase();
        const labelStr = String(e.label ?? '').toLowerCase();
        return (
          valStr.includes('consent') ||
          valStr.includes('unobservable') ||
          labelStr.includes('consent') ||
          labelStr.includes('unobservable')
        );
      });
    }

    return false;
  }

  corroborate(finding: AuditFinding, _context: CorroborationContext): AuditFinding {
    const previousState: RealityState = finding.realityState ?? 'TRUE_DEFECT';
    const nextState: RealityState = 'OBSERVABILITY_LIMIT';
    const reason =
      'Evaluation limited by platform boundary, consent barrier, or unobservable telemetry';

    return {
      ...finding,
      realityState: nextState,
      realityMultiplier: 0.0,
      corroborationTraces: [
        ...(finding.corroborationTraces ?? []),
        {
          policyId: this.policyId,
          previousState,
          nextState,
          multiplierApplied: 0.0,
          reason,
        },
      ],
    };
  }
}

export const observabilityBarrierPolicy = new ObservabilityBarrierPolicy();
