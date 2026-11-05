/**
 * @file src/security/scheme-validator.ts
 * @description URL scheme validation and protocol whitelist guard.
 * Rejects javascript:, data:, file:, chrome:, about:, and extension protocols.
 */

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

const PROHIBITED_SCHEMES = new Set([
  'javascript:',
  'data:',
  'file:',
  'chrome:',
  'chrome-extension:',
  'about:',
  'moz-extension:',
  'blob:',
  'vbscript:',
  'filesystem:',
]);

export interface SchemeValidationResult {
  valid: boolean;
  scheme?: string;
  reason?: string;
}

/**
 * Checks if a scheme string is strictly allowed ('http:' or 'https:').
 */
export function isAllowedScheme(scheme: string): boolean {
  const normalized = scheme.endsWith(':') ? scheme.toLowerCase() : `${scheme.toLowerCase()}:`;
  return ALLOWED_SCHEMES.has(normalized);
}

/**
 * Checks if a scheme string is known to be prohibited.
 */
export function isProhibitedScheme(scheme: string): boolean {
  const normalized = scheme.endsWith(':') ? scheme.toLowerCase() : `${scheme.toLowerCase()}:`;
  return PROHIBITED_SCHEMES.has(normalized);
}

/**
 * Validates the protocol scheme of a URL string.
 */
export function validateScheme(urlStr: string): SchemeValidationResult {
  if (!urlStr || typeof urlStr !== 'string') {
    return { valid: false, reason: 'Empty or invalid URL input' };
  }

  const trimmed = urlStr.trim();
  try {
    const parsed = new URL(trimmed);
    const scheme = parsed.protocol.toLowerCase();

    if (isAllowedScheme(scheme)) {
      return { valid: true, scheme };
    }

    if (isProhibitedScheme(scheme)) {
      return {
        valid: false,
        scheme,
        reason: `Prohibited URL scheme: ${scheme}`,
      };
    }

    return {
      valid: false,
      scheme,
      reason: `Unsupported URL scheme: ${scheme}`,
    };
  } catch (err: any) {
    return {
      valid: false,
      reason: `Malformed URL: ${err.message}`,
    };
  }
}
