import type { AuditFinding } from '../../types/inspection';
import type { CorroborationContext, CorroborationPolicy, RealityState } from '../types';

export class SurfaceCapabilityPolicy implements CorroborationPolicy {
  readonly policyId = 'surface-capability-policy';
  readonly priority = 40;

  appliesTo(finding: AuditFinding): boolean {
    return [
      'sec-missing-csp',
      'sec-missing-x-frame-options',
      'sec-missing-hsts',
    ].includes(finding.ruleId);
  }

  corroborate(finding: AuditFinding, context: CorroborationContext): AuditFinding {
    const formsData = context.modules.forms?.data as Record<string, unknown> | undefined;
    const domData = context.modules.dom?.data as Record<string, unknown> | undefined;
    const secData = (context.modules.security?.data ??
      context.modules.securitySignals?.data) as Record<string, unknown> | undefined;

    // Check 1: password input exists
    const hasPasswordInput = Boolean(
      formsData?.hasPasswordForms ||
      (Array.isArray(formsData?.forms) &&
        (formsData.forms as Array<{
          hasPasswordField?: boolean;
          fieldTypes?: string[];
        }>).some(
          (f) =>
            f.hasPasswordField ||
            f.fieldTypes?.some((t) => t.toLowerCase() === 'password')
        )) ||
      domData?.hasPasswordInput ||
      (typeof domData?.passwordInputsCount === 'number' && domData.passwordInputsCount > 0)
    );

    // Check 2: payment iframe exists
    const hasPaymentIframe = Boolean(
      domData?.hasPaymentIframe ||
      (typeof domData?.paymentFramesCount === 'number' && domData.paymentFramesCount > 0) ||
      (Array.isArray(domData?.iframes) &&
        (domData.iframes as string[]).some((src) =>
          /stripe|paypal|braintree|square|adyen|checkout|pay\./i.test(src)
        )) ||
      secData?.hasPaymentMount
    );

    // Check 3: state-changing POST forms
    const hasPostForm = Boolean(
      (Array.isArray(formsData?.forms) &&
        (formsData.forms as Array<{ method?: string }>).some(
          (f) => String(f.method || '').toUpperCase() === 'POST'
        )) ||
      formsData?.hasStateChangingPostForm
    );

    const hasAuthOrPayment = hasPasswordInput || hasPaymentIframe || hasPostForm;

    if (!hasAuthOrPayment) {
      if (
        finding.ruleId === 'sec-missing-x-frame-options' ||
        finding.ruleId === 'sec-missing-csp'
      ) {
        const previousState: RealityState = finding.realityState ?? 'TRUE_DEFECT';
        const nextState: RealityState = 'ARCHITECTURAL_PATTERN';
        const explanation =
          'Public catalog/read-only page with no credential or payment inputs; high-security framing/CSP policies are isolated to checkout/auth subdomains.';

        return {
          ...finding,
          realityState: nextState,
          realityMultiplier: 0.1,
          explanation,
          corroborationTraces: [
            ...(finding.corroborationTraces ?? []),
            {
              policyId: this.policyId,
              previousState,
              nextState,
              multiplierApplied: 0.1,
              reason: explanation,
            },
          ],
        };
      }

      if (finding.ruleId === 'sec-missing-hsts') {
        const previousState: RealityState = finding.realityState ?? 'TRUE_DEFECT';
        const nextState: RealityState = 'ARCHITECTURAL_PATTERN';
        const explanation =
          'Public catalog/read-only page with no credential or payment inputs; high-security transport policies are isolated to checkout/auth subdomains.';

        return {
          ...finding,
          realityState: nextState,
          realityMultiplier: 0.1,
          explanation,
          corroborationTraces: [
            ...(finding.corroborationTraces ?? []),
            {
              policyId: this.policyId,
              previousState,
              nextState,
              multiplierApplied: 0.1,
              reason: explanation,
            },
          ],
        };
      }
    }

    return finding;
  }
}

export const surfaceCapabilityPolicy = new SurfaceCapabilityPolicy();
