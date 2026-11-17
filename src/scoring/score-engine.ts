
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
  security: 0.25,
  performance: 0.25,
  seo: 0.20,
  accessibility: 0.15,
  'best-practices': 0.10,
  aeo: 0.05,
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
  'a11y-axe-image-alt': 'a11y-image-alt-canonical',
  'a11y-missing-alt': 'a11y-image-alt-canonical',
  'a11y-axe-html-has-lang': 'a11y-lang-canonical',
  'a11y-missing-lang': 'a11y-lang-canonical',
  'a11y-axe-landmark-one-main': 'a11y-landmarks-canonical',
  'a11y-missing-landmarks': 'a11y-landmarks-canonical',
  'a11y-axe-region': 'a11y-landmarks-canonical',
};

function extractAffectedAndTotal(finding: AuditFinding): { affected: number; total: number } | null {
  const findingWithDenom = finding as AuditFinding & { universeDenominator?: number };
  let affected: number | undefined;
  let total: number | undefined;

  if (finding.evidence && Array.isArray(finding.evidence) && finding.evidence.length > 0) {
    for (const ev of finding.evidence) {
      if (ev.value === undefined || ev.value === null) continue;

      const strVal = String(ev.value);
      // Parse patterns like "3 affected of 20 (15.0%)", "2 of 286", "5 / 100"
      const ratioMatch = strVal.match(/(\d+(?:\.\d+)?)\s*(?:affected|failing|nodes|violations|items)?\s*(?:of|\/)\s*(\d+(?:\.\d+)?)/i);
      if (ratioMatch && ratioMatch[1] && ratioMatch[2]) {
        const parsedAffected = parseFloat(ratioMatch[1]);
        const parsedTotal = parseFloat(ratioMatch[2]);
        if (!isNaN(parsedAffected) && !isNaN(parsedTotal) && parsedTotal > 0) {
          if (affected === undefined) affected = parsedAffected;
          if (total === undefined) total = parsedTotal;
        }
      }

      const val = typeof ev.value === 'number' ? ev.value : parseFloat(strVal);
      if (isNaN(val)) continue;

      const label = (ev.label || '').toLowerCase();

      if (
        label.includes('total') ||
        label.includes('evaluated') ||
        label.includes('all images') ||
        label.includes('all nodes') ||
        label.includes('universe') ||
        label.includes('denominator')
      ) {
        if (
          !label.includes('missing') &&
          !label.includes('affected') &&
          !label.includes('without') &&
          !label.includes('unlabeled') &&
          !label.includes('failing') &&
          !label.includes('violation')
        ) {
          if (total === undefined) {
            total = val;
          }
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
          if (affected === undefined) {
            affected = val;
          }
        }
      }
    }
  }

  // Fallback / complement with universeDenominator
  if (total === undefined && typeof findingWithDenom.universeDenominator === 'number' && findingWithDenom.universeDenominator > 0) {
    total = findingWithDenom.universeDenominator;
  }

  // If total is known and weightedDensity is present, derive affected
  if (total !== undefined && total > 0) {
    if (affected === undefined && typeof finding.weightedDensity === 'number') {
      affected = Math.max(0, Math.round(finding.weightedDensity * total));
    }
    if (affected !== undefined) {
      return { affected, total };
    }
  }

  // If affected is known and weightedDensity is present, derive total
  if (affected !== undefined && affected > 0 && typeof finding.weightedDensity === 'number' && finding.weightedDensity > 0) {
    total = Math.round(affected / finding.weightedDensity);
    return { affected, total };
  }

  return null;
}

function isCriticalFlowControl(finding: AuditFinding, blastWeight: number): boolean {
  const ruleIdLower = finding.ruleId.toLowerCase();
  // Isolated image-alt, landmark or contrast issues must never flag critical failure
  if (
    ruleIdLower.includes('image') ||
    ruleIdLower.includes('alt') ||
    ruleIdLower.includes('contrast')
  ) {
    return false;
  }
  if (finding.blastTier === 'critical_flow') return true;
  if (finding.blastTier === 'decorative' || finding.blastTier === 'content' || finding.blastTier === 'interactive') return false;
  if (blastWeight >= 3.0) return true;
  if (/checkout|payment|auth|password|login|submit/i.test(ruleIdLower)) return true;
  if (finding.category.toLowerCase() === 'security' && finding.severity === 'critical') return true;
  return false;
}

export function calculateCategoryScore(
  category: string,
  findings: AuditFinding[],
): DetailedCategoryScore {
  const catLower = category.toLowerCase();
  const rawFindings = findings.filter(
    (f) => f.category.toLowerCase() === catLower || (catLower === 'best-practices' && (f.category.toLowerCase() === 'privacy' || f.category.toLowerCase() === 'content')),
  );

  // Deduplicate overlapping canonical rules, prioritizing corroborated findings with defects / violation pressure
  const categoryFindings = rawFindings.toSorted((a, b) => {
    const scoreFinding = (f: AuditFinding) => {
      let score = 0;
      if (f.status === 'failed') score += 40;
      else if (f.status === 'warning') score += 30;
      else if (f.status === 'passed') score += 20;
      else score += 10;

      if (f.realityState !== undefined) score += 8;
      if (f.violationPressure !== undefined) score += 4;
      if (f.weightedDensity !== undefined || (f as { universeDenominator?: number }).universeDenominator !== undefined) score += 2;
      if (f.evidence && f.evidence.length > 0) score += 1;
      return score;
    };
    return scoreFinding(b) - scoreFinding(a);
  });

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
        if (finding.realityState === 'SYNTHETIC_NOISE') {
          realityCounts.SYNTHETIC_NOISE++;
        } else {
          realityCounts.PASS++;
        }
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
          Pr = Math.max(0, Math.min(1.0, finding.violationPressure));
          density = finding.weightedDensity !== undefined
            ? finding.weightedDensity
            : (counts && counts.total > 0 ? counts.affected / counts.total : undefined);
        } else if (counts && counts.total > 0) {
          density = finding.weightedDensity !== undefined ? finding.weightedDensity : counts.affected / counts.total;
          Pr = Math.min(1.0, Math.pow(density, 0.6) + 0.25 * (1.0 - Math.exp(-0.08 * blastWeight * counts.affected)));
        } else if (finding.weightedDensity !== undefined) {
          density = finding.weightedDensity;
          const affected = (finding as { universeDenominator?: number }).universeDenominator
            ? Math.max(1, Math.round(density * (finding as { universeDenominator?: number }).universeDenominator!))
            : (counts?.affected ?? 1);
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

        if (
          finding.severity === 'critical' &&
          (finding.realityState === 'TRUE_DEFECT' || finding.realityState === undefined) &&
          isCriticalFlowControl(finding, blastWeight)
        ) {
          hasCriticalFailure = true;
          if (Pr >= 0.8) {
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

    scoreRounded = Math.max(0, Math.min(100, Math.round(rawScore)));
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
    criticalCapTriggered,
    deductionsExplanation,
    scoringFormula: 'Continuous violation pressure & reality multipliers with severity weights, Unobservable (0 evaluated)=0',
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
  const hasAeo = findings.some((f) => f.category.toLowerCase() === 'aeo');

  let defaultCatsList = hasBestPractices ? [...defaultCats, 'best-practices'] : defaultCats;
  if (hasAeo) {
    defaultCatsList = [...defaultCatsList, 'aeo'];
  }

  const categories = targetCategories || defaultCatsList;
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
