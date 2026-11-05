/**
 * @file src/scoring/score-model.ts
 * @description Domain contracts and scoring interfaces for category and inspection score calculations.
 */

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
