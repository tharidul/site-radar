/**
 * @file src/collectors/page/types.ts
 * @description Core types and interfaces for in-tab page collectors.
 */

import type { CollectionResult, CollectionStatus, CollectionCoverage } from '../../types/inspection';

export interface CollectorContext {
  /** The target Document tree to inspect */
  document: Document;
  /** Host Window context if available */
  window?: Window;
  /** Active page URL */
  url?: string;
  /** Optional execution options */
  options?: Record<string, unknown>;
}

export interface PageCollector<T = unknown> {
  /** Unique module identifier matching inspection domain contracts */
  readonly id: string;
  /** Human-readable collector name */
  readonly name: string;
  /** Executes collection logic and returns a strongly-typed CollectionResult */
  collect(context: CollectorContext): Promise<CollectionResult<T>> | CollectionResult<T>;
}

/**
 * Standard factory helper for constructing CollectionResult envelopes.
 */
export function createCollectionResult<T>(params: {
  module: string;
  status: CollectionStatus;
  data: T | null;
  coverage: CollectionCoverage;
  limitations?: string[];
  errors?: string[];
  sources?: string[];
}): CollectionResult<T> {
  return {
    module: params.module,
    status: params.status,
    collectedAt: Date.now(),
    data: params.data,
    coverage: params.coverage,
    limitations: params.limitations ?? [],
    errors: params.errors ?? [],
    sources: params.sources ?? [],
  };
}
