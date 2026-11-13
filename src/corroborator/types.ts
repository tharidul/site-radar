import type {
  AuditFinding,
  CollectionCoverage,
  CollectionResult,
  CollectionStatus,
  WebsiteTarget,
} from '../types/inspection';

export type RealityState =
  | 'TRUE_DEFECT'
  | 'ARCHITECTURAL_PATTERN'
  | 'OBSERVABILITY_LIMIT'
  | 'SYNTHETIC_NOISE';

export type BlastTier = 'decorative' | 'content' | 'interactive' | 'critical_flow';

export interface CorroborationTrace {
  policyId: string;
  previousState: RealityState;
  nextState: RealityState;
  multiplierApplied: number;
  reason: string;
}

export interface ModuleData<T = unknown> {
  module?: string;
  status?: CollectionStatus | string;
  collectedAt?: number;
  data?: T | null;
  coverage?: CollectionCoverage;
  limitations?: string[];
  errors?: string[];
  sources?: string[];
  [key: string]: unknown;
}

export interface CorroborationContext {
  target: WebsiteTarget;
  modules: Record<string, CollectionResult<unknown> | ModuleData<unknown>>;
  isLocalDevelopment?: boolean;
}

export interface CorroborationPolicy {
  readonly policyId: string;
  readonly priority: number;
  appliesTo(finding: AuditFinding): boolean;
  corroborate(finding: AuditFinding, context: CorroborationContext): AuditFinding;
}

export type { AuditFinding, WebsiteTarget, CollectionResult };
