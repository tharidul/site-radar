
import type {
  AuditFinding,
  CollectionResult,
  InspectionMode,
  WebsiteTarget,
} from '../types/inspection';

export interface AnalyzerContext {
  target: WebsiteTarget;
  mode: InspectionMode;
  modules: Record<string, CollectionResult<unknown>>;
}

export interface Analyzer {
  readonly id: string;
  readonly category: string;
  analyze(context: AnalyzerContext): Promise<AuditFinding[]> | AuditFinding[];
}

export function getModuleData<T>(
  modules: Record<string, CollectionResult<unknown>>,
  ...moduleNames: string[]
): { data: T | null; status: string; unavailableReason?: string } {
  for (const name of moduleNames) {
    const result = modules[name] as CollectionResult<T> | undefined;
    if (result) {
      if (result.status === 'failed' || result.status === 'blocked' || result.status === 'unsupported') {
        return {
          data: null,
          status: result.status,
          unavailableReason: `Module ${name} ${result.status}: ${(result.errors || []).join('; ') || 'No error details'}`,
        };
      }
      return { data: result.data ?? null, status: result.status };
    }
  }
  return { data: null, status: 'skipped', unavailableReason: `Module ${moduleNames[0]} was not executed` };
}
