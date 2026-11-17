import type { AuditFinding } from '../../types/inspection';
import type {
  BlastTier,
  CorroborationContext,
  CorroborationPolicy,
  FindingTargetScope,
  RealityState,
  ScopeResolution,
} from '../types';

export const SCOPE_TO_BLAST_TIER: Record<FindingTargetScope, BlastTier> = {
  images: 'decorative',
  interactive: 'interactive',
  forms: 'interactive',
  text_nodes: 'content',
  landmarks: 'content',
  dom_elements: 'content',
  page: 'content',
};

export const BLAST_TIER_TO_WEIGHT: Record<BlastTier, number> = {
  decorative: 0.25,
  content: 1.0,
  interactive: 1.5,
  critical_flow: 3.0,
};

export function resolveTargetScope(finding: AuditFinding): FindingTargetScope {
  if (finding.targetScope) {
    return finding.targetScope;
  }

  const ruleId = finding.ruleId.toLowerCase();
  const axeId = ruleId.startsWith('a11y-axe-') ? ruleId.replace('a11y-axe-', '') : ruleId;

  // 1. Images
  if (
    axeId === 'image-alt' ||
    axeId === 'image-redundant-alt' ||
    axeId === 'input-image-alt' ||
    axeId === 'svg-img-alt' ||
    axeId === 'area-alt' ||
    axeId.includes('image') ||
    axeId.includes('img') ||
    axeId.includes('alt')
  ) {
    return 'images';
  }

  // 2. Landmarks & Regions
  if (
    axeId === 'region' ||
    axeId.startsWith('landmark') ||
    axeId.includes('landmark') ||
    axeId.includes('region')
  ) {
    return 'landmarks';
  }

  // 3. Text Nodes & Contrast
  if (
    axeId.startsWith('color-contrast') ||
    axeId.includes('contrast') ||
    axeId === 'p-as-heading' ||
    axeId.includes('heading') ||
    axeId.includes('text')
  ) {
    return 'text_nodes';
  }

  // 4. Forms
  if (
    axeId === 'label' ||
    axeId === 'label-title-only' ||
    axeId === 'form-field-multiple-labels' ||
    axeId === 'select-name' ||
    axeId === 'autocomplete-valid' ||
    axeId === 'aria-input-field-name' ||
    axeId.includes('form') ||
    axeId.includes('input') ||
    (axeId.includes('label') && !axeId.includes('content-name-mismatch'))
  ) {
    return 'forms';
  }

  // 5. Interactive (buttons, links, clickables, controls)
  if (
    axeId === 'button-name' ||
    axeId === 'link-name' ||
    axeId === 'link-in-text-block' ||
    axeId === 'target-size' ||
    axeId === 'tabindex' ||
    axeId === 'nested-interactive' ||
    axeId === 'focus-order-semantics' ||
    axeId === 'keyboard' ||
    axeId === 'accesskeys' ||
    axeId === 'label-content-name-mismatch' ||
    axeId.includes('button') ||
    axeId.includes('link') ||
    axeId.includes('clickable') ||
    axeId.includes('interactive')
  ) {
    return 'interactive';
  }

  // 6. Page-level rules
  if (
    axeId === 'html-has-lang' ||
    axeId === 'html-lang-valid' ||
    axeId === 'document-title' ||
    axeId === 'meta-viewport' ||
    axeId === 'bypass' ||
    axeId === 'page-has-heading-one' ||
    axeId.includes('lang') ||
    axeId.includes('viewport') ||
    axeId.includes('title')
  ) {
    return 'page';
  }

  // 7. General DOM elements (duplicate-id, aria-*, etc.)
  return 'dom_elements';
}

export function extractAffectedNodes(finding: AuditFinding): number {
  if (!finding.evidence || !Array.isArray(finding.evidence)) {
    return 1;
  }

  // 1. Direct check for 'Nodes Affected' (axe-core standard)
  const nodesAffectedEv = finding.evidence.find(
    (e) => e.label && /nodes?\s*affected/i.test(e.label)
  );
  if (nodesAffectedEv?.value !== undefined && nodesAffectedEv.value !== null) {
    const val =
      typeof nodesAffectedEv.value === 'number'
        ? nodesAffectedEv.value
        : parseInt(String(nodesAffectedEv.value), 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Generic check for missing / affected / failing / count labels
  for (const ev of finding.evidence) {
    if (ev.value === undefined || ev.value === null) continue;
    const label = (ev.label || '').toLowerCase();

    // Skip total / evaluated / passes / score
    if (
      label.includes('total') ||
      label.includes('evaluated') ||
      label.includes('passes') ||
      label.includes('score')
    ) {
      continue;
    }

    if (
      label.includes('affected') ||
      label.includes('missing') ||
      label.includes('failing') ||
      label.includes('without') ||
      label.includes('unlabeled') ||
      label.includes('non-semantic') ||
      label.includes('violations') ||
      label.includes('insecure')
    ) {
      const val =
        typeof ev.value === 'number'
          ? ev.value
          : parseInt(String(ev.value), 10);
      if (!isNaN(val) && val > 0) return val;
    }
  }

  // 3. Fallback: check any evidence whose value is a positive number
  for (const ev of finding.evidence) {
    if (typeof ev.value === 'number' && ev.value > 0) {
      const label = (ev.label || '').toLowerCase();
      if (!label.includes('total') && !label.includes('passes') && !label.includes('score')) {
        return ev.value;
      }
    }
  }

  return 1;
}

export function resolveUniverseDenominator(
  scope: FindingTargetScope,
  context: CorroborationContext,
  affectedCount: number
): number {
  const domData = (context.modules.dom?.data ?? {}) as Record<string, unknown>;
  const mediaData = (context.modules.media?.data ?? context.modules.images?.data ?? {}) as Record<
    string,
    unknown
  >;
  const formsData = (context.modules.forms?.data ?? {}) as Record<string, unknown>;
  const linksData = (context.modules.links?.data ?? {}) as Record<string, unknown>;

  let denominator = 0;

  switch (scope) {
    case 'images': {
      if (typeof mediaData.totalImages === 'number' && mediaData.totalImages > 0) {
        denominator = mediaData.totalImages;
      } else if (Array.isArray(mediaData.images) && mediaData.images.length > 0) {
        denominator = mediaData.images.length;
      }
      break;
    }

    case 'interactive': {
      const nativeButtons =
        typeof domData.nativeButtonsCount === 'number' ? domData.nativeButtonsCount : 0;
      const interactiveElements =
        typeof domData.interactiveElementsCount === 'number'
          ? domData.interactiveElementsCount
          : typeof domData.nonSemanticClickableCount === 'number'
          ? domData.nonSemanticClickableCount
          : 0;
      const linksCount =
        typeof domData.linksCount === 'number'
          ? domData.linksCount
          : typeof linksData.totalLinks === 'number'
          ? linksData.totalLinks
          : 0;

      denominator = nativeButtons + interactiveElements + linksCount;
      break;
    }

    case 'forms': {
      if (typeof formsData.totalInputCount === 'number' && formsData.totalInputCount > 0) {
        denominator = formsData.totalInputCount;
      } else if (Array.isArray(formsData.forms) && formsData.forms.length > 0) {
        denominator = formsData.forms.reduce((sum, f) => {
          const form = f as { fieldCount?: number };
          return sum + (typeof form.fieldCount === 'number' ? form.fieldCount : 0);
        }, 0);
      } else if (typeof formsData.formCount === 'number' && formsData.formCount > 0) {
        denominator = formsData.formCount;
      }
      break;
    }

    case 'landmarks': {
      if (Array.isArray(domData.landmarkElements) && domData.landmarkElements.length > 0) {
        denominator = domData.landmarkElements.length;
      } else if (typeof domData.landmarksCount === 'number' && domData.landmarksCount > 0) {
        denominator = domData.landmarksCount;
      } else if (domData.hasMainLandmark) {
        denominator = 1;
      }
      break;
    }

    case 'text_nodes': {
      if (typeof domData.textNodeCount === 'number' && domData.textNodeCount > 0) {
        denominator = domData.textNodeCount;
      } else if (typeof domData.elementCount === 'number' && domData.elementCount > 0) {
        denominator = domData.elementCount;
      }
      break;
    }

    case 'dom_elements': {
      if (typeof domData.elementCount === 'number' && domData.elementCount > 0) {
        denominator = domData.elementCount;
      }
      break;
    }

    case 'page': {
      denominator = 1;
      break;
    }
  }

  // Fallback: Ensure denominator is at least affectedCount or 1
  if (!denominator || isNaN(denominator) || denominator <= 0) {
    denominator = Math.max(affectedCount, 1);
  }

  return denominator;
}

export function computeViolationPressure(
  density: number,
  blastWeight: number,
  affected: number
): number {
  if (affected <= 0 || density <= 0) return 0;
  const raw =
    Math.pow(density, 0.6) + 0.25 * (1.0 - Math.exp(-0.08 * blastWeight * affected));
  return Math.min(1.0, Math.max(0, raw));
}

export class UniversalScopePolicy implements CorroborationPolicy {
  readonly policyId = 'universal-scope-policy';
  readonly priority = 25;

  appliesTo(finding: AuditFinding): boolean {
    if (finding.status !== 'failed' && finding.status !== 'warning') {
      return false;
    }

    if (finding.ruleId === 'a11y-axe-evaluation') {
      return false;
    }

    // Already resolved with both pressure and density
    if (finding.violationPressure !== undefined && finding.weightedDensity !== undefined) {
      return false;
    }

    // All individual axe-core rules lack universe denominators
    if (finding.ruleId.startsWith('a11y-axe-')) {
      return true;
    }

    // Explicit target scope requested
    if (finding.targetScope) {
      return true;
    }

    // Native rules that have affected counts but lack a total denominator
    return this.hasAffectedCountWithoutTotal(finding);
  }

  private hasAffectedCountWithoutTotal(finding: AuditFinding): boolean {
    if (!finding.evidence || !Array.isArray(finding.evidence) || finding.evidence.length === 0) {
      return false;
    }

    let hasAffected = false;
    let hasTotal = false;

    for (const ev of finding.evidence) {
      if (ev.value === undefined || ev.value === null) continue;
      const val = typeof ev.value === 'number' ? ev.value : parseFloat(String(ev.value));
      if (isNaN(val)) continue;

      const label = (ev.label || '').toLowerCase();

      if (
        (label.includes('total') ||
          label.includes('evaluated') ||
          label.includes('all images') ||
          label.includes('all nodes') ||
          label.includes('universe') ||
          label.includes('denominator')) &&
        !label.includes('missing') &&
        !label.includes('affected') &&
        !label.includes('without') &&
        !label.includes('unlabeled') &&
        !label.includes('failing') &&
        !label.includes('violation')
      ) {
        if (val > 0) hasTotal = true;
      }

      if (
        label.includes('node') ||
        label.includes('affected') ||
        label.includes('missing') ||
        label.includes('failing') ||
        label.includes('without') ||
        label.includes('unlabeled') ||
        label.includes('non-semantic')
      ) {
        if (val > 0) hasAffected = true;
      }
    }

    return hasAffected && !hasTotal;
  }

  resolve(
    finding: AuditFinding,
    context: CorroborationContext
  ): ScopeResolution {
    const scope = resolveTargetScope(finding);
    const affected = extractAffectedNodes(finding);
    const denominator = resolveUniverseDenominator(scope, context, affected);
    const density = Math.min(1.0, affected / denominator);

    const blastTier: BlastTier =
      finding.blastTier || SCOPE_TO_BLAST_TIER[scope] || 'content';
    const blastWeight: number =
      finding.blastWeight || BLAST_TIER_TO_WEIGHT[blastTier] || 1.0;

    const violationPressure = computeViolationPressure(density, blastWeight, affected);

    return {
      scope,
      denominator,
      affected,
      density,
      blastTier,
      blastWeight,
      violationPressure,
    };
  }

  corroborate(finding: AuditFinding, context: CorroborationContext): AuditFinding {
    const resolution = this.resolve(finding, context);
    const { scope, denominator, affected, density, blastTier, blastWeight, violationPressure } =
      resolution;

    const existingEvidence = finding.evidence ? [...finding.evidence] : [];
    const filteredEvidence = existingEvidence.filter((e) => e.label !== 'Universe Scope');
    filteredEvidence.push({
      label: 'Universe Scope',
      value: `${affected} affected of ${denominator} (${(density * 100).toFixed(1)}%)`,
      source: 'universal-scope-policy',
      observedAt: Date.now(),
    });

    const previousState: RealityState = finding.realityState ?? 'TRUE_DEFECT';
    const nextState: RealityState = previousState;
    const explanation = `Resolved universe scope '${scope}' (${affected} affected of ${denominator}, density ${(density * 100).toFixed(1)}%, blastTier: ${blastTier}, violationPressure: ${violationPressure.toFixed(3)})`;

    return {
      ...finding,
      realityState: previousState,
      realityMultiplier: finding.realityMultiplier ?? 1.0,
      blastTier,
      blastWeight,
      weightedDensity: density,
      violationPressure,
      targetScope: scope,
      universeDenominator: denominator,
      evidence: filteredEvidence,
      corroborationTraces: [
        ...(finding.corroborationTraces ?? []),
        {
          policyId: this.policyId,
          previousState,
          nextState,
          multiplierApplied: finding.realityMultiplier ?? 1.0,
          reason: explanation,
        },
      ],
    };
  }
}

export const universalScopePolicy = new UniversalScopePolicy();
