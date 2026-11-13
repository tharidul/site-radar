
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

function extractAffectedAndTotal(finding: AuditFinding): { affected: number; total: number } | null {
  if (!finding.evidence || !Array.isArray(finding.evidence) || finding.evidence.length === 0) {
    return null;
  }

  let affected: number | undefined;
  let total: number | undefined;

  for (const ev of finding.evidence) {
    if (ev.value === undefined || ev.value === null) continue;
    const val = typeof ev.value === 'number' ? ev.value : parseFloat(String(ev.value));
    if (isNaN(val)) continue;

    const label = (ev.label || '').toLowerCase();

    if (
      label.includes('total') ||
      label.includes('evaluated') ||
      label.includes('all images') ||
      label.includes('all nodes')
    ) {
      if (
        !label.includes('missing') &&
        !label.includes('affected') &&
        !label.includes('without') &&
        !label.includes('unlabeled') &&
        !label.includes('failing') &&
        !label.includes('violation')
      ) {
        total = val;
      }
    }

    if (
      label.includes('missing') ||
      label.includes('affected') ||
      label.includes('without sri') ||
      label.includes('without') ||
      label.includes('unlabeled') ||
      label.includes('failing') ||
      (label.includes('violation') && !label.includes('total violations'))
    ) {
      if (!label.includes('total') || label.includes('missing') || label.includes('without') || label.includes('unlabeled')) {
        affected = val;
      }
    }
  }

  if (affected !== undefined && total !== undefined && total > 0) {
    return { affected, total };
  }

  return null;
}

function isCriticalFlowControl(finding: AuditFinding, blastWeight: number): boolean {
  if (finding.blastTier === 'critical_flow') return true;
  if (finding.blastTier === 'decorative' || finding.blastTier === 'content' || finding.blastTier === 'interactive') return false;
  if (blastWeight >= 3.0) return true;
  if (finding.ruleId.includes('image') || finding.ruleId.includes('alt') || finding.ruleId.includes('color-contrast')) return false;
  const ruleIdLower = finding.ruleId.toLowerCase();
  if (/checkout|payment|auth|password|login|submit/i.test(ruleIdLower)) return true;
  if (finding.category.toLowerCase() === 'security' && finding.severity === 'critical') return true;
  return false;
}

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
  let criticalCapTriggered = false;
  let isHeuristic = false;

  let earnedPoints = 0;
  let maxPossiblePoints = 0;
  const deductionsExplanation: string[] = [];

  const realityCounts: Record<'TRUE_DEFECT' | 'ARCHITECTURAL_PATTERN' | 'OBSERVABILITY_LIMIT' | 'SYNTHETIC_NOISE' | 'PASS', number> = {
    TRUE_DEFECT: 0,
    ARCHITECTURAL_PATTERN: 0,
    OBSERVABILITY_LIMIT: 0,
    SYNTHETIC_NOISE: 0,
    PASS: 0,
  };

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

    // Reality multiplier (mu)
    let mu: number;
    if (finding.realityMultiplier !== undefined) {
      mu = finding.realityMultiplier;
    } else if (finding.realityState === 'ARCHITECTURAL_PATTERN' || finding.realityState === 'OBSERVABILITY_LIMIT') {
      mu = 0.0;
    } else if (finding.realityState === 'SYNTHETIC_NOISE') {
      mu = 0.05;
    } else {
      mu = 1.0;
    }

    // Special Reality State handling
    if (finding.realityState === 'ARCHITECTURAL_PATTERN') {
      passed++;
      earnedPoints += weight * 1.0;
      maxPossiblePoints += weight;
      realityCounts.ARCHITECTURAL_PATTERN++;
      continue;
    }

    if (finding.realityState === 'OBSERVABILITY_LIMIT') {
      unavailable++;
      realityCounts.OBSERVABILITY_LIMIT++;
      continue;
    }

    switch (finding.status) {
      case 'passed':
        passed++;
        earnedPoints += weight * 1.0;
        maxPossiblePoints += weight;
        realityCounts.PASS++;
        break;

      case 'warning': {
        warnings++;
        if (finding.realityState === 'SYNTHETIC_NOISE') {
          realityCounts.SYNTHETIC_NOISE++;
        } else {
          realityCounts.TRUE_DEFECT++;
        }

        const effectiveDeduction = weight * 0.5 * confidence * mu;
        earnedPoints += weight * (1.0 - effectiveDeduction / weight);
        maxPossiblePoints += weight;
        if (effectiveDeduction > 0) {
          deductionsExplanation.push(
            `Warning on ${rule?.title || finding.ruleId}: -${Math.round(effectiveDeduction)} pts (confidence: ${Math.round(confidence * 100)}%)`,
          );
        }
        break;
      }

      case 'failed': {
        failed++;
        if (finding.realityState === 'SYNTHETIC_NOISE') {
          realityCounts.SYNTHETIC_NOISE++;
        } else {
          realityCounts.TRUE_DEFECT++;
        }

        // Compute Violation Density (delta_r) and Pressure (P_r)
        let density: number | undefined;
        let Pr = 1.0;
        const counts = extractAffectedAndTotal(finding);

        const blastWeight = finding.blastWeight || (
          finding.blastTier === 'decorative' ? 0.25 :
          finding.blastTier === 'interactive' ? 1.5 :
          finding.blastTier === 'critical_flow' ? 3.0 :
          finding.blastTier === 'content' ? 1.0 :
          (finding.ruleId.includes('image') || finding.ruleId.includes('alt')) ? 0.25 :
          (finding.ruleId.includes('button') || finding.ruleId.includes('interactive')) ? 1.5 :
          1.0
        );

        if (finding.violationPressure !== undefined) {
          Pr = finding.violationPressure;
          density = finding.weightedDensity;
        } else if (counts && counts.total > 0) {
          density = counts.affected / counts.total;
          Pr = Math.min(1.0, Math.pow(density, 0.6) + 0.25 * (1.0 - Math.exp(-0.08 * blastWeight * counts.affected)));
        } else if (finding.weightedDensity !== undefined) {
          density = finding.weightedDensity;
          const affected = 1;
          Pr = Math.min(1.0, Math.pow(density, 0.6) + 0.25 * (1.0 - Math.exp(-0.08 * blastWeight * affected)));
        } else {
          Pr = 1.0;
        }

        finding.violationPressure = Pr;
        if (density !== undefined) {
          finding.weightedDensity = density;
        }

        const effectiveDeduction = weight * mu * Pr;
        earnedPoints += weight * (1.0 - Math.min(1.0, mu * Pr));
        maxPossiblePoints += weight;

        if (finding.severity === 'critical' && mu > 0.5) {
          hasCriticalFailure = true;
          if (Pr >= 0.8 && isCriticalFlowControl(finding, blastWeight)) {
            criticalCapTriggered = true;
          }
        }

        if (effectiveDeduction > 0) {
          deductionsExplanation.push(
            `Failed check ${rule?.title || finding.ruleId} [${finding.severity}]: -${Math.round(effectiveDeduction)} pts`,
          );
        }
        break;
      }

      case 'info':
        break;

      case 'not-available':
      case 'error':
        unavailable++;
        realityCounts.OBSERVABILITY_LIMIT++;
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
  const telemetryCoverageIndex = totalApplicable > 0
    ? Math.round((evaluatedChecks / totalApplicable) * 100)
    : 100;

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

    if (criticalCapTriggered && rawScore > 49) {
      rawScore = 49;
      deductionsExplanation.push('Critical failure override applied: score capped at 49 on critical flow control');
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
    telemetryCoverageIndex,
    realityCounts,
    isHeuristic,
    hasCriticalFailure,
    deductionsExplanation,
    scoringFormula: 'Continuous violation pressure & reality multipliers with severity weights, Coverage Ceiling if <70%, Unobservable (0 evaluated)=0',
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
