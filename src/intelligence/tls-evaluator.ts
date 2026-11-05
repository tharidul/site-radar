/**
 * @file src/intelligence/tls-evaluator.ts
 * @description Evaluates TLS configuration, HSTS policies, and HTTP security response headers.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 6, Feature 37.
 */

import type { TlsInspectionResult, SecurityHeadersEvaluation } from '@/types/intelligence';

export { type SecurityHeadersEvaluation };

export class TlsEvaluator {
  /**
   * Alias method for evaluating security response headers.
   */
  evaluateSecurityHeaders(headers: Record<string, string | null> | Headers): SecurityHeadersEvaluation {
    return this.evaluateHeaders(headers);
  }

  /**
   * Evaluates security headers from a Headers object or key-value map.
   */
  evaluateHeaders(headers: Record<string, string | null> | Headers): SecurityHeadersEvaluation {
    const getHeader = (name: string): string | undefined => {
      if (typeof (headers as Headers).get === 'function') {
        return (headers as Headers).get(name) || undefined;
      }
      const record = headers as Record<string, string | null>;
      const matchKey = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase());
      return (matchKey && record[matchKey]) || undefined;
    };

    // 1. Strict-Transport-Security (HSTS)
    const hstsRaw = getHeader('strict-transport-security');
    let hstsMaxAge: number | undefined;
    let hstsIncludeSubDomains = false;
    let hstsPreload = false;

    if (hstsRaw) {
      const maxAgeMatch = /max-age\s*=\s*(\d+)/i.exec(hstsRaw);
      if (maxAgeMatch && maxAgeMatch[1]) {
        hstsMaxAge = parseInt(maxAgeMatch[1], 10);
      }
      hstsIncludeSubDomains = /includesubdomains/i.test(hstsRaw);
      hstsPreload = /preload/i.test(hstsRaw);
    }

    // 2. Content-Security-Policy (CSP)
    const cspRaw = getHeader('content-security-policy');
    let hasUpgradeInsecureRequests = false;
    let hasFrameAncestors = false;

    if (cspRaw) {
      hasUpgradeInsecureRequests = /upgrade-insecure-requests/i.test(cspRaw);
      hasFrameAncestors = /frame-ancestors/i.test(cspRaw);
    }

    // 3. X-Frame-Options
    const xfoRaw = getHeader('x-frame-options');
    const xfoVal = xfoRaw?.toUpperCase().trim();

    // 4. X-Content-Type-Options
    const xctoRaw = getHeader('x-content-type-options');
    const isNoSniff = xctoRaw ? /nosniff/i.test(xctoRaw) : false;

    // 5. Referrer-Policy
    const rpRaw = getHeader('referrer-policy');

    // 6. Permissions-Policy
    const ppRaw = getHeader('permissions-policy') || getHeader('feature-policy');

    return {
      hsts: {
        present: Boolean(hstsRaw),
        maxAge: hstsMaxAge,
        includeSubDomains: hstsIncludeSubDomains,
        preload: hstsPreload,
        rawHeader: hstsRaw,
      },
      csp: {
        present: Boolean(cspRaw),
        rawHeader: cspRaw,
        hasUpgradeInsecureRequests,
        hasFrameAncestors,
      },
      frameOptions: {
        present: Boolean(xfoRaw),
        value: xfoVal,
        directive: xfoVal,
      },
      xFrameOptions: {
        present: Boolean(xfoRaw),
        directive: xfoVal,
      },
      contentTypeOptions: {
        present: Boolean(xctoRaw),
        isNoSniff,
      },
      xContentTypeOptions: {
        present: Boolean(xctoRaw),
        isNoSniff,
      },
      referrerPolicy: {
        present: Boolean(rpRaw),
        policy: rpRaw,
      },
      permissionsPolicy: {
        present: Boolean(ppRaw),
        rawHeader: ppRaw,
      },
    };
  }

  /**
   * Constructs basic TLS inspection result model from inspected host and headers.
   */
  evaluateTls(host: string, isHttps: boolean, port = 443): TlsInspectionResult {
    return {
      host,
      port,
      protocol: isHttps ? 'TLSv1.3' : undefined,
      valid: isHttps,
      authorized: isHttps,
      queriedAt: Date.now(),
      provider: 'browser-synthesized',
      certificate: isHttps
        ? {
            subject: `CN=${host}`,
            issuer: 'Observable via CT logs',
            validFrom: '',
            validTo: '',
            daysUntilExpiration: 90,
            hasExpired: false,
            san: [host],
          }
        : undefined,
    };
  }
}

export const tlsEvaluator = new TlsEvaluator();
