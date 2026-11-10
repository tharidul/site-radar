
import type { CategoryScore } from '../types/inspection';

export interface DetailedCategoryScore extends CategoryScore {
  coveragePercent: number;
  hasCriticalFailure: boolean;
  scoringFormula: string;
  unavailable: number;
  notApplicableCount?: number;
  deductionsExplanation?: string[];
}

export interface ScoreCalculationResult {
  overallScore: number;
  categories: string[];
  scores: Record<string, DetailedCategoryScore>;
  totalChecksEvaluated: number;
}
