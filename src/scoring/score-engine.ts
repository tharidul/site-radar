
import type { AuditFinding } from '../types/inspection';
import { getRuleDefinition } from '../analyzers/rule-catalog';
import type { DetailedCategoryScore, ScoreCalculationResult } from './score-model';

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

const CATEGORY_WEIGHTS: Record<string, number> = {
  security: 0.30,
  performance: 0.25,
  seo: 0.20,
  accessibility: 0.15,
  'best-practices': 0.10,
};

const RULE_CANONICAL_ALIASES: Record<string, string> = {
  'sec-missing-https': 'sec-https-enforced',
  'sec-insecure-form-action': 'sec-form-action-secure',
  'perf-slow-lcp': 'perf-lcp',
  'perf-high-cls': 'perf-cls',
  'perf-slow-ttfb': 'perf-ttfb',
  'perf-slow-fcp': 'perf-fcp',
  'seo-missing-title': 'seo-title-present',
  'seo-missing-description': 'seo-meta-description',
  'seo-missing-canonical': 'seo-canonical-matches',
  'resp-missing-viewport': 'resp-viewport-valid',
  'priv-missing-privacy-policy': 'privacy-policy-link',
};

export function calculateCategoryScore(
  category: string,
  findings: AuditFinding[],
): DetailedCategoryScore {
  const catLower = category.toLowerCase();
  const categoryFindings = findings.filter(
    (f) => f.category.toLowerCase() === catLower || (catLower === 'best-practices' && (f.category.toLowerCase() === 'privacy' || f.category.toLowerCase() === 'content')),
  );

  let passed = 0;
  let failed = 0;
  let warnings = 0;
  let unavailable = 0;
  let notApplicable = 0;
  let hasCriticalFailure = false;
  let isHeuristic = false;

  let earnedPoints = 0;
  let maxPossiblePoints = 0;
  const deductionsExplanation: string[] = [];

  const seenCanonicalRules = new Set<string>();

  for (const finding of categoryFindings) {
    const canonicalKey = RULE_CANONICAL_ALIASES[finding.ruleId] || finding.ruleId;
    if (seenCanonicalRules.has(canonicalKey)) {
      continue;
    }
    seenCanonicalRules.add(canonicalKey);

    const rule = getRuleDefinition(finding.ruleId);
    let weight = finding.ruleId.startsWith('a11y-axe-')
      ? (SEVERITY_WEIGHTS[finding.severity] ?? 8)
      : (rule?.weight ?? (SEVERITY_WEIGHTS[finding.severity] || 5));
    if (weight === 0 && finding.severity !== 'info') {
      weight = 5;
    }
    if (finding.confidence !== undefined || rule?.isHeuristic) {
      isHeuristic = true;
    }

    const confidence = finding.confidence !== undefined ? finding.confidence : 1.0;

    switch (finding.status) {
      case 'passed':
        passed++;
        earnedPoints += weight * 1.0;
        maxPossiblePoints += weight;
        break;
      case 'warning':
        warnings++;
        earnedPoints += weight * (1.0 - 0.5 * confidence);
        maxPossiblePoints += weight;
        deductionsExplanation.push(
          `Warning on ${rule?.title || finding.ruleId}: -${Math.round(weight * 0.5 * confidence)} pts (confidence: ${Math.round(confidence * 100)}%)`,
        );
        break;
      case 'failed':
        failed++;
        maxPossiblePoints += weight;
        if (finding.severity === 'critical') {
          hasCriticalFailure = true;
        }
        deductionsExplanation.push(
          `Failed check ${rule?.title || finding.ruleId} [${finding.severity}]: -${weight} pts`,
        );
        break;
      case 'info':
        break;
      case 'not-available':
      case 'error':
        unavailable++;
        break;
      case 'not-applicable':
        notApplicable++;
        break;
    }
  }

  const evaluatedChecks = passed + failed + warnings;
  const totalApplicable = evaluatedChecks + unavailable;
  const coverageRate = evaluatedChecks === 0
    ? 0
    : (totalApplicable > 0 ? evaluatedChecks / totalApplicable : 1.0);
  const coveragePercent = Math.round(coverageRate * 100);

  let scoreRounded: number;
  if (evaluatedChecks === 0) {
    // INFO-01: Never award a passing/moderate coverage-ceiling score (75) when zero checks were evaluated.
    scoreRounded = 0;
    deductionsExplanation.push(
      unavailable > 0
        ? `No checks could be evaluated (${unavailable} unobservable or errored; 0% scan coverage): score set to 0`
        : 'No applicable checks evaluated in this category: score set to 0',
    );
  } else {
    let rawScore = maxPossiblePoints > 0 ? (earnedPoints / maxPossiblePoints) * 100 : 100;

    if (hasCriticalFailure && rawScore > 49) {
      rawScore = 49;
      deductionsExplanation.push('Critical failure override applied: score capped at 49');
    }

    let finalScore = rawScore;
    if (coverageRate < 0.70 && totalApplicable > 0) {
      const coverageCeiling = Math.round(75 + 25 * coverageRate);
      if (finalScore > coverageCeiling) {
        finalScore = coverageCeiling;
        deductionsExplanation.push(
          `Limited scan coverage (${coveragePercent}% evaluated): score capped at ${coverageCeiling} (unobservable properties require network inspection)`,
        );
      }
    }

    scoreRounded = Math.max(0, Math.min(100, Math.round(finalScore)));
  }

  return {
    category,
    score: scoreRounded,
    passed,
    failed,
    warnings,
    unavailable,
    notApplicableCount: notApplicable,
    totalChecks: evaluatedChecks,
    weight: CATEGORY_WEIGHTS[catLower] ?? 0.20,
    coveragePercent,
    isHeuristic,
    hasCriticalFailure,
    deductionsExplanation,
    scoringFormula: 'Weighted severity points with confidence factor (Passed=100%, Warning=50-75%, Failed=0%), Critical Cap=49, Coverage Ceiling if <70%, Unobservable (0 evaluated)=0',
  };
}

export function calculateInspectionScores(
  findings: AuditFinding[],
  targetCategories?: string[],
): ScoreCalculationResult {
  const defaultCats = ['security', 'performance', 'seo', 'accessibility'];
  const hasBestPractices = findings.some(
    (f) =>
      f.category.toLowerCase() === 'best-practices' ||
      f.category.toLowerCase() === 'privacy' ||
      f.category.toLowerCase() === 'content',
  );

  const categories = targetCategories || (hasBestPractices ? [...defaultCats, 'best-practices'] : defaultCats);
  const scores: Record<string, DetailedCategoryScore> = {};

  let weightedSum = 0;
  let totalWeight = 0;
  let totalEvaluated = 0;

  for (const cat of categories) {
    const catScore = calculateCategoryScore(cat, findings);
    scores[cat] = catScore;
    weightedSum += catScore.score * catScore.weight;
    totalWeight += catScore.weight;
    totalEvaluated += catScore.totalChecks;
  }

  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100;

  return {
    overallScore,
    categories,
    scores,
    totalChecksEvaluated: totalEvaluated,
  };
}
