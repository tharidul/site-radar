
import type { AuditFinding, SecuritySignalsData, FormsData, JavaScriptData, CssData } from '../types/inspection';
import type { Analyzer, AnalyzerContext } from './types';
import { getModuleData } from './types';
import { FindingBuilder } from './finding-builder';

export class SecurityAnalyzer implements Analyzer {
  readonly id = 'security-analyzer';
  readonly category = 'security';

  analyze(context: AnalyzerContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const { target, modules } = context;

    const secRes = getModuleData<SecuritySignalsData>(modules, 'securitySignals', 'security');
    const secData = secRes.data;

    const isHttps = target.url.startsWith('https://');
    if (!isHttps) {
      findings.push(
        new FindingBuilder('sec-https-enforced')
          .setStatus('failed')
          .setSeverity('critical')
          .setConfidence(1.0)
          .addEvidence('URL Scheme', target.url.split(':')[0], 'target')
          .setExpectedBehavior('Target website must be served exclusively over encrypted TLS/HTTPS.')
          .setExplanation('Serving content over unencrypted HTTP exposes traffic to interception, credential harvesting, and tampering.')
          .build(),
      );
    } else {
      findings.push(
        new FindingBuilder('sec-https-enforced')
          .setStatus('passed')
          .setSeverity('critical')
          .setConfidence(1.0)
          .addEvidence('HTTPS URL', target.url, 'target')
          .setExpectedBehavior('Target website must be served exclusively over encrypted TLS/HTTPS.')
          .setExplanation('Target website serves content over encrypted HTTPS.')
          .build(),
      );
    }

    if (!secData) {
      findings.push(
        new FindingBuilder('sec-mixed-content')
          .setStatus('not-available')
          .addEvidence('Unavailable Reason', secRes.unavailableReason || 'Security module not evaluated')
          .build(),
        new FindingBuilder('sec-missing-hsts')
          .setStatus('not-available')
          .addEvidence('Unavailable Reason', secRes.unavailableReason || 'Security module not evaluated')
          .build(),
      );
    } else {
      const hasMixed = Boolean(secData.mixedContentDetected);
      if (!isHttps) {
        findings.push(
          new FindingBuilder('sec-mixed-content')
            .setStatus('not-applicable')
            .setConfidence(1.0)
            .addEvidence('Page Scheme', 'HTTP (Mixed content check only applies to HTTPS)')
            .build(),
        );
      } else if (hasMixed) {
        findings.push(
          new FindingBuilder('sec-mixed-content')
            .setStatus('failed')
            .setSeverity('high')
            .setConfidence(1.0)
            .addEvidence('Mixed Content Detected', true)
            .setExpectedBehavior('All subresources on HTTPS page must be loaded securely over HTTPS.')
            .setExplanation('Insecure HTTP subresources on an HTTPS page degrade encryption guarantees.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('sec-mixed-content')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Insecure Subresources', 0)
            .setExpectedBehavior('All subresources on HTTPS page must be loaded securely over HTTPS.')
            .setExplanation('No insecure plaintext HTTP subresources detected.')
            .build(),
        );
      }

      const headers = secData.securityHeaders;
      const headersObservable = headers !== undefined && typeof headers === 'object';

      const cspHeader = headersObservable
        ? Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-security-policy')?.[1]
        : undefined;
      const hasCsp = Boolean(cspHeader) || Boolean(secData.cspPresent);

      if (hasCsp) {
        findings.push(
          new FindingBuilder('sec-missing-csp')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Content Security Policy', cspHeader || 'Declared via <meta> tag')
            .build(),
        );
      } else if (headersObservable) {
        findings.push(
          new FindingBuilder('sec-missing-csp')
            .setStatus('failed')
            .setSeverity('medium')
            .setConfidence(0.9)
            .addEvidence('Content-Security-Policy', 'Missing from response headers and meta tags')
            .setExpectedBehavior('Implement a Content-Security-Policy restricting script-src, object-src, and default-src.')
            .setExplanation('No Content Security Policy detected. CSP provides defense-in-depth against XSS and data injection.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('sec-missing-csp')
            .setStatus('not-available')
            .setTitle('Content Security Policy (Unobservable)')
            .setDescription('No meta CSP tag detected in DOM; HTTP response headers require network inspection to evaluate.')
            .setConfidence(0.5)
            .addEvidence('Observation Context', 'HTTP response headers not directly accessible in content script context')
            .build(),
        );
      }

      if (headersObservable) {
        const hstsHeader = Object.entries(headers).find(
          ([k]) => k.toLowerCase() === 'strict-transport-security',
        )?.[1];
        if (hstsHeader) {
          findings.push(
            new FindingBuilder('sec-missing-hsts')
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('Strict-Transport-Security', hstsHeader)
              .build(),
          );
        } else if (!isHttps) {
          findings.push(
            new FindingBuilder('sec-missing-hsts')
              .setStatus('not-applicable')
              .addEvidence('Page Scheme', 'HTTP (HSTS only applies to HTTPS origins)')
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder('sec-missing-hsts')
              .setStatus('failed')
              .setSeverity('medium')
              .setConfidence(0.9)
              .addEvidence('Strict-Transport-Security', 'Missing from response headers')
              .setExpectedBehavior('Declare Strict-Transport-Security header with max-age >= 31536000.')
              .setExplanation('HSTS ensures browsers automatically request HTTPS, protecting against SSL stripping on initial visits.')
              .build(),
          );
        }
      } else {
        findings.push(
          new FindingBuilder('sec-missing-hsts')
            .setStatus(isHttps ? 'not-available' : 'not-applicable')
            .setTitle(isHttps ? 'Strict-Transport-Security (Unobservable)' : 'Strict-Transport-Security')
            .setDescription(
              isHttps
                ? 'HSTS HTTP response header is not directly accessible in passive content script mode.'
                : 'HSTS only applies to HTTPS origins.',
            )
            .addEvidence('Observation Context', 'HTTP response headers not directly accessible in content script context')
            .build(),
        );
      }

      if (headersObservable) {
        const xcto = Object.entries(headers).find(
          ([k]) => k.toLowerCase() === 'x-content-type-options',
        )?.[1];
        if (xcto && xcto.toLowerCase().includes('nosniff')) {
          findings.push(
            new FindingBuilder('sec-missing-x-content-type-options')
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('X-Content-Type-Options', xcto)
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder('sec-missing-x-content-type-options')
              .setStatus('failed')
              .setSeverity('low')
              .setConfidence(0.9)
              .addEvidence('X-Content-Type-Options', xcto || 'Missing')
              .build(),
          );
        }
      } else {
        findings.push(
          new FindingBuilder('sec-missing-x-content-type-options')
            .setStatus('not-available')
            .setTitle('MIME-Sniffing Protection (Unobservable)')
            .setDescription('X-Content-Type-Options header is not directly accessible in passive content script mode.')
            .addEvidence('Observation Context', 'HTTP response headers not directly accessible in content script context')
            .build(),
        );
      }

      if (headersObservable) {
        const xfo = Object.entries(headers).find(
          ([k]) => k.toLowerCase() === 'x-frame-options',
        )?.[1];
        const cspFrameAncestors = cspHeader && cspHeader.toLowerCase().includes('frame-ancestors');
        if (xfo || cspFrameAncestors) {
          findings.push(
            new FindingBuilder('sec-missing-x-frame-options')
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('Clickjacking Protection', xfo ? `X-Frame-Options: ${xfo}` : 'CSP frame-ancestors declared')
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder('sec-missing-x-frame-options')
              .setStatus('failed')
              .setSeverity('medium')
              .setConfidence(0.85)
              .addEvidence('Frame Protection', 'Neither X-Frame-Options nor CSP frame-ancestors observed')
              .build(),
          );
        }
      } else {
        findings.push(
          new FindingBuilder('sec-missing-x-frame-options')
            .setStatus('not-available')
            .setTitle('Clickjacking Protection (Unobservable)')
            .setDescription('Neither X-Frame-Options header nor CSP frame-ancestors could be observed in passive content script mode.')
            .addEvidence('Observation Context', 'HTTP response headers not directly accessible in content script context')
            .build(),
        );
      }

      const refPol = headersObservable
        ? Object.entries(headers).find(([k]) => k.toLowerCase() === 'referrer-policy')?.[1]
        : undefined;
      const effectiveReferrer = refPol || secData.metaReferrerPolicy;

      if (effectiveReferrer) {
        if (!effectiveReferrer.toLowerCase().includes('unsafe-url')) {
          findings.push(
            new FindingBuilder('sec-missing-referrer-policy')
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('Referrer-Policy', effectiveReferrer)
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder('sec-missing-referrer-policy')
              .setStatus('failed')
              .setSeverity('low')
              .setConfidence(0.85)
              .addEvidence('Referrer-Policy', effectiveReferrer)
              .setExpectedBehavior('Referrer-Policy should not use unsafe-url in production.')
              .setExplanation('unsafe-url leaks entire origin, path, and query strings on all cross-origin requests.')
              .build(),
          );
        }
      } else if (headersObservable) {
        findings.push(
          new FindingBuilder('sec-missing-referrer-policy')
            .setStatus('failed')
            .setSeverity('low')
            .setConfidence(0.85)
            .addEvidence('Referrer-Policy', 'Missing from response headers and meta tags')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('sec-missing-referrer-policy')
            .setStatus('not-available')
            .setTitle('Referrer Policy (Unobservable)')
            .setDescription('No meta referrer tag detected in DOM; HTTP response header requires network inspection.')
            .addEvidence('Observation Context', 'HTTP response headers and meta referrer tag not directly accessible')
            .build(),
        );
      }

      if (headersObservable) {
        const permPol = Object.entries(headers).find(
          ([k]) => k.toLowerCase() === 'permissions-policy' || k.toLowerCase() === 'feature-policy',
        )?.[1];
        if (permPol) {
          findings.push(
            new FindingBuilder('sec-missing-permissions-policy')
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('Permissions-Policy', permPol)
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder('sec-missing-permissions-policy')
              .setStatus('info')
              .setSeverity('low')
              .setConfidence(0.8)
              .addEvidence('Permissions-Policy', 'None declared')
              .build(),
          );
        }
      } else {
        findings.push(
          new FindingBuilder('sec-missing-permissions-policy')
            .setStatus('not-available')
            .setTitle('Permissions Policy (Unobservable)')
            .setDescription('Permissions-Policy header is not directly accessible in passive content script mode.')
            .addEvidence('Observation Context', 'HTTP response headers not directly accessible in content script context')
            .build(),
        );
      }
    }

    const isFirstPartyAsset = (assetUrl: string): boolean => {
      if (!assetUrl) return true;
      if (
        assetUrl.startsWith(target.origin) ||
        assetUrl.startsWith('/') ||
        assetUrl.startsWith('data:') ||
        assetUrl.startsWith('blob:')
      ) {
        return true;
      }
      try {
        const parsed = new URL(assetUrl, target.origin);
        const assetHost = parsed.hostname.toLowerCase();
        const targetHost = (target.hostname || parsed.hostname).toLowerCase();

        if (assetHost === targetHost || assetHost.endsWith('.' + targetHost)) {
          return true;
        }

        const twoPartTlds = ['.co.uk', '.gov.uk', '.ac.uk', '.org.uk', '.com.au', '.net.au', '.co.jp', '.co.nz', '.com.br'];
        const hasTwoPart = twoPartTlds.some((tld) => targetHost.endsWith(tld));
        const parts = targetHost.split('.');
        const apexDomain = hasTwoPart && parts.length > 2
          ? parts.slice(-3).join('.')
          : parts.length > 2
            ? parts.slice(-2).join('.')
            : targetHost;

        if (apexDomain && (assetHost === apexDomain || assetHost.endsWith('.' + apexDomain))) {
          return true;
        }

        const brand = apexDomain.split('.')[0];
        if (brand && brand.length >= 4 && (assetHost.includes(brand + 'cdn.') || assetHost.includes(brand + 'assets.'))) {
          return true;
        }
      } catch {}
      return false;
    };

    const scriptsRes = getModuleData<JavaScriptData>(modules, 'scripts');
    if (scriptsRes.data?.scripts) {
      const externalScripts = scriptsRes.data.scripts.filter(
        (s) => s.src && !isFirstPartyAsset(s.src),
      );
      if (externalScripts.length > 0) {
        const withoutSri = externalScripts.filter((s) => !s.hasSri);
        if (withoutSri.length > 0) {
          findings.push(
            new FindingBuilder('sec-missing-sri-scripts')
              .setStatus('warning')
              .setSeverity('low')
              .setConfidence(0.7)
              .addEvidence('External Scripts Without SRI', withoutSri.length)
              .addEvidence('Total External Scripts', externalScripts.length)
              .setExpectedBehavior('Static external CDN scripts should include subresource integrity hashes.')
              .setExplanation('External scripts loaded without integrity attributes could be modified if the hosting CDN is compromised.')
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder('sec-missing-sri-scripts')
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('External Scripts with SRI', externalScripts.length)
              .build(),
          );
        }
      } else {
        findings.push(
          new FindingBuilder('sec-missing-sri-scripts')
            .setStatus('not-applicable')
            .addEvidence('External Scripts', 'No external third-party script tags present')
            .build(),
        );
      }
    }

    const stylesRes = getModuleData<CssData>(modules, 'styles');
    if (stylesRes.data?.stylesheets) {
      const externalStyles = stylesRes.data.stylesheets.filter(
        (s) => s.href && !isFirstPartyAsset(s.href),
      );
      if (externalStyles.length > 0) {
        const withoutSri = externalStyles.filter((s) => !s.hasSri);
        if (withoutSri.length > 0) {
          findings.push(
            new FindingBuilder('sec-missing-sri-links')
              .setStatus('warning')
              .setSeverity('low')
              .setConfidence(0.7)
              .addEvidence('External Stylesheets Without SRI', withoutSri.length)
              .build(),
          );
        } else {
          findings.push(
            new FindingBuilder('sec-missing-sri-links')
              .setStatus('passed')
              .setConfidence(1.0)
              .addEvidence('External Stylesheets with SRI', externalStyles.length)
              .build(),
          );
        }
      } else {
        findings.push(
          new FindingBuilder('sec-missing-sri-links')
            .setStatus('not-applicable')
            .addEvidence('External Stylesheets', 'No external third-party stylesheets present')
            .build(),
        );
      }
    }

    const formsRes = getModuleData<FormsData>(modules, 'forms');
    const forms = formsRes.data?.forms;
    if (forms && forms.length > 0) {
      let hasInsecureAction = false;
      let insecureActionUrl = '';
      let hasInsecurePassword = false;

      for (const form of forms) {
        const action = form.action?.trim() || '';
        const isInsecureAction = action.startsWith('http://') || action.startsWith('javascript:');
        if (isInsecureAction) {
          hasInsecureAction = true;
          insecureActionUrl = action;
        }

        const hasPassword = form.hasPasswordField || (form.fieldTypes && form.fieldTypes.includes('password'));
        if (hasPassword && (!isHttps || isInsecureAction)) {
          hasInsecurePassword = true;
        }
      }

      if (hasInsecurePassword) {
        findings.push(
          new FindingBuilder('sec-password-over-http')
            .setStatus('failed')
            .setSeverity('critical')
            .setConfidence(1.0)
            .addEvidence('Password Field Present', true)
            .addEvidence('Connection Transport', isHttps ? 'Insecure form action' : 'Unencrypted HTTP plaintext')
            .setExpectedBehavior('Password authentication inputs must be submitted strictly over encrypted HTTPS.')
            .setExplanation('Submitting passwords over unencrypted transport allows immediate credential theft by network attackers.')
            .build(),
        );
      }

      if (hasInsecureAction) {
        findings.push(
          new FindingBuilder('sec-form-action-secure')
            .setStatus('failed')
            .setSeverity('critical')
            .setConfidence(1.0)
            .addEvidence('Insecure Form Action Target', insecureActionUrl)
            .setExpectedBehavior('All form actions must target encrypted HTTPS endpoints.')
            .setExplanation('Form action targets an unencrypted HTTP endpoint or unsafe javascript scheme.')
            .build(),
        );
      } else {
        findings.push(
          new FindingBuilder('sec-form-action-secure')
            .setStatus('passed')
            .setConfidence(1.0)
            .addEvidence('Secure Form Actions', true)
            .build(),
        );
      }
    } else {
      findings.push(
        new FindingBuilder('sec-form-action-secure')
          .setStatus('not-applicable')
          .addEvidence('Forms Present', 0)
          .build(),
      );
    }

    return findings;
  }
}
