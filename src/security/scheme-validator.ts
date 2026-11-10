
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

export function isAllowedScheme(scheme: string): boolean {
  const normalized = scheme.endsWith(':') ? scheme.toLowerCase() : `${scheme.toLowerCase()}:`;
  return ALLOWED_SCHEMES.has(normalized);
}

export function isProhibitedScheme(scheme: string): boolean {
  const normalized = scheme.endsWith(':') ? scheme.toLowerCase() : `${scheme.toLowerCase()}:`;
  return PROHIBITED_SCHEMES.has(normalized);
}

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
