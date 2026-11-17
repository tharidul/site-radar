import type { CorroborationPolicy } from '../types';
import {
  CanonicalSemanticsPolicy,
  canonicalSemanticsPolicy,
} from './canonical-semantics.policy';
import {
  AssetMutabilityPolicy,
  assetMutabilityPolicy,
} from './asset-mutability.policy';
import {
  UniversalScopePolicy,
  universalScopePolicy,
} from './universal-scope.policy';
import {
  SurfaceCapabilityPolicy,
  surfaceCapabilityPolicy,
} from './surface-capability.policy';
import {
  CwvRealityGatePolicy,
  cwvRealityGatePolicy,
} from './cwv-reality-gate.policy';
import {
  ObservabilityBarrierPolicy,
  observabilityBarrierPolicy,
} from './observability-barrier.policy';

export {
  CanonicalSemanticsPolicy,
  canonicalSemanticsPolicy,
  AssetMutabilityPolicy,
  assetMutabilityPolicy,
  UniversalScopePolicy,
  universalScopePolicy,
  SurfaceCapabilityPolicy,
  surfaceCapabilityPolicy,
  CwvRealityGatePolicy,
  cwvRealityGatePolicy,
  ObservabilityBarrierPolicy,
  observabilityBarrierPolicy,
};

export const ALL_CORROBORATION_POLICIES: CorroborationPolicy[] = [
  observabilityBarrierPolicy,
  assetMutabilityPolicy,
  universalScopePolicy,
  canonicalSemanticsPolicy,
  surfaceCapabilityPolicy,
  cwvRealityGatePolicy,
];
