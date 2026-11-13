import type { AuditFinding } from '../../types/inspection';
import type { CorroborationContext, CorroborationPolicy, RealityState } from '../types';

function normalizeUrl(rawUrl: string, base?: string): URL | null {
  try {
    const parsed = new URL(rawUrl, base);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }
    parsed.hash = '';
    let cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (!cleanPath) cleanPath = '/';
    parsed.pathname = cleanPath;
    return parsed;
  } catch {
    return null;
  }
}

const CAMPAIGN_PREFIXES = [
  'utm_',
  'gad_',
  'alb',
  'aff_',
  'affiliate',
  'jsc_',
  'mtm_',
  'pk_',
  'fb_',
  'ga_',
  'ad_',
  'acnt',
];

const CAMPAIGN_EXACT = new Set([
  'gclid',
  'dclid',
  'fbclid',
  'msclkid',
  'yclid',
  'mc_cid',
  'mc_eid',
  'igshid',
  '_ga',
  '_gl',
  '_hsenc',
  '_hsmi',
  'hsctatracking',
  'spm',
  'ref',
  'source',
  'campaign',
  'medium',
  'term',
  'content',
]);

function isCampaignOrTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  if (CAMPAIGN_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return true;
  }
  return CAMPAIGN_EXACT.has(lower);
}

export class CanonicalSemanticsPolicy implements CorroborationPolicy {
  readonly policyId = 'canonical-semantics-policy';
  readonly priority = 30;

  appliesTo(finding: AuditFinding): boolean {
    return finding.ruleId === 'seo-canonical-matches';
  }

  corroborate(finding: AuditFinding, context: CorroborationContext): AuditFinding {
    if (!context.target?.url) {
      return finding;
    }

    let declaredCanonical: string | undefined;

    // Check evidence first
    if (Array.isArray(finding.evidence)) {
      const match = finding.evidence.find(
        (e) =>
          e.label === 'Declared Canonical URL' ||
          e.label === 'Canonical URL' ||
          e.label === 'Production Canonical URL' ||
          e.label.toLowerCase().includes('canonical')
      );
      if (
        match &&
        typeof match.value === 'string' &&
        match.value !== 'Missing' &&
        match.value !== 'null'
      ) {
        declaredCanonical = match.value;
      }
    }

    // Check module data fallback
    if (!declaredCanonical) {
      const metadata = context.modules.metadata?.data as Record<string, unknown> | undefined;
      const seo = context.modules.seo?.data as Record<string, unknown> | undefined;
      const identity = context.modules.identity?.data as Record<string, unknown> | undefined;

      declaredCanonical =
        (typeof metadata?.canonicalUrl === 'string' ? metadata.canonicalUrl : undefined) ||
        (typeof metadata?.canonical === 'string' ? metadata.canonical : undefined) ||
        (typeof seo?.canonicalUrl === 'string' ? seo.canonicalUrl : undefined) ||
        (typeof seo?.canonical === 'string' ? seo.canonical : undefined) ||
        (typeof identity?.canonicalUrl === 'string' ? identity.canonicalUrl : undefined) ||
        (typeof identity?.canonical === 'string' ? identity.canonical : undefined);
    }

    if (!declaredCanonical) {
      return finding;
    }

    const targetUrl = normalizeUrl(context.target.url);
    const canonicalUrl = normalizeUrl(declaredCanonical, context.target.url);

    if (!targetUrl || !canonicalUrl) {
      return finding;
    }

    const originMatches = targetUrl.origin === canonicalUrl.origin;
    const pathnameMatches = targetUrl.pathname === canonicalUrl.pathname;

    if (!originMatches || !pathnameMatches) {
      return finding;
    }

    const targetParams = targetUrl.searchParams;
    const canonicalParams = canonicalUrl.searchParams;
    const targetKeys = Array.from(targetParams.keys());

    if (targetKeys.length === 0) {
      return finding;
    }

    const canonicalIsClean = Array.from(canonicalParams.keys()).length === 0;

    let isSubsetWithoutCampaignParams = false;
    if (!canonicalIsClean) {
      let isSubset = true;
      for (const [key, val] of canonicalParams.entries()) {
        if (targetParams.get(key) !== val) {
          isSubset = false;
          break;
        }
      }
      if (isSubset) {
        const droppedKeys = targetKeys.filter((k) => !canonicalParams.has(k));
        if (droppedKeys.length > 0 && droppedKeys.every((k) => isCampaignOrTrackingParam(k))) {
          isSubsetWithoutCampaignParams = true;
        }
      }
    }

    const targetHasCampaignParams = targetKeys.some((k) => isCampaignOrTrackingParam(k));
    const qualifies =
      canonicalIsClean ||
      isSubsetWithoutCampaignParams ||
      (targetHasCampaignParams && targetKeys.length > Array.from(canonicalParams.keys()).length);

    if (qualifies) {
      const previousState: RealityState = finding.realityState ?? 'TRUE_DEFECT';
      const nextState: RealityState = 'ARCHITECTURAL_PATTERN';
      const reason =
        'Canonical URL properly consolidates query/tracking parameters to master page';

      return {
        ...finding,
        realityState: nextState,
        realityMultiplier: 0.0,
        status: 'passed',
        explanation: reason,
        evidence: [
          ...finding.evidence,
          {
            label: 'Canonical Consolidation',
            value: reason,
            source: 'canonical-semantics-policy',
            observedAt: Date.now(),
          },
        ],
        corroborationTraces: [
          ...(finding.corroborationTraces ?? []),
          {
            policyId: this.policyId,
            previousState,
            nextState,
            multiplierApplied: 0.0,
            reason,
          },
        ],
      };
    }

    return finding;
  }
}

export const canonicalSemanticsPolicy = new CanonicalSemanticsPolicy();
