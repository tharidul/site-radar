
import type { CollectionResult, CollectionStatus, CollectionCoverage } from '../../types/inspection';

export interface CollectorContext {
  document: Document;
  window?: Window;
  url?: string;
  options?: Record<string, unknown>;
}

export interface PageCollector<T = unknown> {
  readonly id: string;
  readonly name: string;
  collect(context: CollectorContext): Promise<CollectionResult<T>> | CollectionResult<T>;
}

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
