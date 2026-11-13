import type { AuditFinding } from '../types/inspection';
import type {
  CorroborationContext,
  CorroborationPolicy,
  RealityState,
} from './types';
import { ALL_CORROBORATION_POLICIES } from './policies';

export class CorroborationEngine {
  private readonly policies: CorroborationPolicy[] = [];

  constructor(policies: CorroborationPolicy[] = ALL_CORROBORATION_POLICIES) {
    this.registerPolicies(policies);
  }

  registerPolicy(policy: CorroborationPolicy): void {
    this.policies.push(policy);
    this.sortPolicies();
  }

  registerPolicies(policies: CorroborationPolicy[]): void {
    for (const policy of policies) {
      this.policies.push(policy);
    }
    this.sortPolicies();
  }

  getPolicies(): readonly CorroborationPolicy[] {
    return [...this.policies];
  }

  private sortPolicies(): void {
    this.policies.sort((a, b) => a.priority - b.priority);
  }

  corroborate(
    findings: AuditFinding[],
    context: CorroborationContext
  ): AuditFinding[] {
    return findings.map((finding) => {
      const initialRealityState: RealityState =
        finding.status === 'failed' || finding.status === 'warning'
          ? 'TRUE_DEFECT'
          : (finding.realityState ?? 'TRUE_DEFECT');

      let current: AuditFinding = {
        ...finding,
        realityState: initialRealityState,
        realityMultiplier: finding.realityMultiplier ?? 1.0,
        corroborationTraces: finding.corroborationTraces
          ? [...finding.corroborationTraces]
          : [],
      };

      for (const policy of this.policies) {
        if (policy.appliesTo(current)) {
          current = policy.corroborate(current, context);
        }
      }

      return current;
    });
  }
}
