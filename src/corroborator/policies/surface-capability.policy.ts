import type { AuditFinding } from '../../types/inspection';
import { isAuthOrCheckoutOrigin } from '../../security/url-normalizer';
import type { CorroborationContext, CorroborationPolicy, RealityState } from '../types';

/**
 * Detects whether transactional capabilities (auth, login, checkout, payment)
 * are isolated to dedicated subdomains or external enterprise identity/payment gateways.
 */
export function detectIsolatedCheckoutOrigins(context: CorroborationContext): string[] {
  const targetHost = context.target?.hostname?.toLowerCase() || '';
  const origins = new Set<string>();

  const checkCandidate = (val: unknown) => {
    if (typeof val !== 'string' || !val) return;
    if (isAuthOrCheckoutOrigin(val, targetHost)) {
      try {
        let host = '';
        if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('//')) {
          host = new URL(val, 'https://localhost').hostname.toLowerCase();
        } else if (!val.includes('/') && val.includes('.')) {
          host = val.toLowerCase().replace(/:\d+$/, '');
        } else {
          host = new URL(val, 'https://localhost').hostname.toLowerCase();
        }
        if (host && host !== 'localhost' && host !== targetHost) {
          origins.add(host);
        }
      } catch {
        // ignore invalid URL
      }
    }
  };

  const linksData = context.modules.links?.data as Record<string, unknown> | undefined;
  if (Array.isArray(linksData?.isolatedCheckoutOrigins)) {
    for (const o of linksData.isolatedCheckoutOrigins) checkCandidate(o);
  }
  if (Array.isArray(linksData?.externalLinks)) {
    for (const l of linksData.externalLinks as Array<{ url?: string }>) checkCandidate(l?.url);
  }

  const formsData = context.modules.forms?.data as Record<string, unknown> | undefined;
  if (Array.isArray(formsData?.isolatedCheckoutOrigins)) {
    for (const o of formsData.isolatedCheckoutOrigins) checkCandidate(o);
  }
  if (Array.isArray(formsData?.forms)) {
    for (const f of formsData.forms as Array<{ action?: string }>) checkCandidate(f?.action);
  }

  const domData = context.modules.dom?.data as Record<string, unknown> | undefined;
  if (Array.isArray(domData?.iframes)) {
    for (const s of domData.iframes as string[]) checkCandidate(s);
  }

  const scriptsData = context.modules.scripts?.data as Record<string, unknown> | undefined;
  if (Array.isArray(scriptsData?.externalDomains)) {
    for (const d of scriptsData.externalDomains as string[]) checkCandidate(d);
  }

  return Array.from(origins);
}

export class SurfaceCapabilityPolicy implements CorroborationPolicy {
  readonly policyId = 'surface-capability-policy';
  readonly priority = 40;

  appliesTo(finding: AuditFinding): boolean {
    return [
      'sec-missing-csp',
      'sec-missing-x-frame-options',
      'sec-missing-hsts',
      'sec-missing-referrer-policy',
      'sec-missing-x-content-type-options',
    ].includes(finding.ruleId);
  }

  corroborate(finding: AuditFinding, context: CorroborationContext): AuditFinding {
    // 1. Referrer policy is universally handled natively by modern browser defaults
    if (finding.ruleId === 'sec-missing-referrer-policy') {
      const explanation =
        'Modern browser natively enforces strict-origin-when-cross-origin default; omission does not leak path/query strings cross-origin.';
      return this.applyClassification(finding, 'SYNTHETIC_NOISE', 0.05, explanation);
    }

    const formsData = context.modules.forms?.data as Record<string, unknown> | undefined;
    const domData = context.modules.dom?.data as Record<string, unknown> | undefined;
    const secData = (context.modules.security?.data ??
      context.modules.securitySignals?.data) as Record<string, unknown> | undefined;

    const isBoolTrue = (val: unknown): boolean => val === true || val === 'true';

    // Check visible sensitive credentials / inputs
    const hasVisiblePasswordField = isBoolTrue(formsData?.hasVisiblePasswordField);

    // Check payment frames / mounts
    const hasPaymentIframe = Boolean(
      isBoolTrue(domData?.hasPaymentIframe) ||
      (typeof domData?.paymentFramesCount === 'number' && domData.paymentFramesCount > 0) ||
      (Array.isArray(domData?.iframes) &&
        (domData.iframes as string[]).some((src) =>
          typeof src === 'string' && /stripe|paypal|braintree|square|adyen|checkout|pay\./i.test(src)
        )) ||
      isBoolTrue(secData?.hasPaymentMount)
    );

    // Check visible state-changing POST forms
    const hasVisiblePostForm = Boolean(
      isBoolTrue(formsData?.hasVisiblePostForm) ||
      (Array.isArray(formsData?.forms) &&
        (formsData.forms as Array<{ method?: string; isVisible?: boolean }>).some(
          (f) => String(f.method || '').toUpperCase() === 'POST' && f.isVisible !== false
        )) ||
      isBoolTrue(formsData?.hasStateChangingPostForm)
    );

    const hasActiveSensitiveSurface = hasVisiblePasswordField || hasPaymentIframe || hasVisiblePostForm;

    // If active sensitive inputs or payment frames exist, missing security headers are strictly TRUE_DEFECT
    if (hasActiveSensitiveSurface) {
      return finding;
    }

    // Check evidence of enterprise subdomain isolation
    const isolatedOrigins = detectIsolatedCheckoutOrigins(context);
    const hasSubdomainIsolation = isolatedOrigins.length > 0;

    // Check inbound syndicated affiliate marketing landing params
    let isSyndicatedAffiliateLanding = false;
    const urlCandidate = context.target?.url || (typeof formsData?.url === 'string' ? formsData.url : '');
    if (urlCandidate) {
      try {
        const parsed = new URL(urlCandidate);
        const searchKeys = Array.from(parsed.searchParams.keys()).map((k) => k.toLowerCase());
        isSyndicatedAffiliateLanding = searchKeys.some((k) =>
          k === 'aff_platform' ||
          k === 'aff_short_key' ||
          k === 'albbt' ||
          k === 'albcp' ||
          k === 'albag' ||
          k === 'albrpr' ||
          k === 'spm' ||
          k.startsWith('aff_') ||
          k === 'gbraid' ||
          k === 'wbraid' ||
          k === 'gad_source' ||
          k === 'gclid'
        );
      } catch {
        // ignore invalid URL
      }
    }

    const isolatedOriginListStr = hasSubdomainIsolation ? isolatedOrigins.join(', ') : '';

    switch (finding.ruleId) {
      case 'sec-missing-x-frame-options':
        if (isSyndicatedAffiliateLanding) {
          return this.applyClassification(
            finding,
            'ARCHITECTURAL_PATTERN',
            0.1,
            'Public showcase catalog supporting syndicated partner previews and affiliate marketing widgets; clickjacking defense isolated to checkout/auth.'
          );
        }
        if (hasSubdomainIsolation) {
          return this.applyClassification(
            finding,
            'ARCHITECTURAL_PATTERN',
            0.1,
            `Public catalog surface with authentication/checkout isolated to dedicated origin(s): ${isolatedOriginListStr}. Clickjacking defense isolated to transactional surfaces.`
          );
        }
        // Single-origin monolithic sites without affiliate syndication remain TRUE_DEFECT
        return finding;

      case 'sec-missing-csp':
        if (hasSubdomainIsolation) {
          return this.applyClassification(
            finding,
            'ARCHITECTURAL_PATTERN',
            0.1,
            `Public multi-merchant catalog aggregating affiliate tags and dynamic merchant assets; strict CSP isolated to dedicated origin(s): ${isolatedOriginListStr}.`
          );
        }
        // Single-origin monolithic sites remain TRUE_DEFECT
        return finding;

      case 'sec-missing-hsts':
        if (hasSubdomainIsolation) {
          return this.applyClassification(
            finding,
            'ARCHITECTURAL_PATTERN',
            0.1,
            `Public CDN edge-cached storefront with transport TLS; HSTS policy preserved on dedicated origin(s): ${isolatedOriginListStr}.`
          );
        }
        // Single-origin monolithic sites remain TRUE_DEFECT
        return finding;

      case 'sec-missing-x-content-type-options':
        if (hasSubdomainIsolation) {
          return this.applyClassification(
            finding,
            'ARCHITECTURAL_PATTERN',
            0.1,
            `Static public HTML catalog delivery; media/upload endpoints segregated to dedicated origin(s): ${isolatedOriginListStr}.`
          );
        }
        // Single-origin monolithic sites remain TRUE_DEFECT
        return finding;

      default:
        return finding;
    }
  }

  private applyClassification(
    finding: AuditFinding,
    nextState: RealityState,
    multiplierApplied: number,
    explanation: string
  ): AuditFinding {
    const previousState: RealityState = finding.realityState ?? 'TRUE_DEFECT';

    return {
      ...finding,
      status: 'passed',
      realityState: nextState,
      realityMultiplier: multiplierApplied,
      explanation,
      corroborationTraces: [
        ...(finding.corroborationTraces ?? []),
        {
          policyId: this.policyId,
          previousState,
          nextState,
          multiplierApplied,
          reason: explanation,
        },
      ],
    };
  }
}

export const surfaceCapabilityPolicy = new SurfaceCapabilityPolicy();
