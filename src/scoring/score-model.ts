
import type { CategoryScore } from '../types/inspection';

export interface DetailedCategoryScore extends CategoryScore {
  coveragePercent: number;
  hasCriticalFailure: boolean;
  scoringFormula: string;
  unavailable: number;
  notApplicableCount?: number;
  deductionsExplanation?: string[];
  telemetryCoverageIndex?: number;
  realityCounts?: Record<'TRUE_DEFECT' | 'ARCHITECTURAL_PATTERN' | 'OBSERVABILITY_LIMIT' | 'SYNTHETIC_NOISE' | 'PASS', number>;
}

export interface ScoreCalculationResult {
  overallScore: number;
  categories: string[];
  scores: Record<string, DetailedCategoryScore>;
  totalChecksEvaluated: number;
}
