/**
 * @file src/security/secret-redactor.ts
 * @description Zero-secret redaction engine. Masks credentials, tokens, API keys,
 * authorization headers, session cookies, and form values with cycle protection.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 14.
 */

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /pwd/i,
  /passphrase/i,
  /passcode/i,
  /pin/i,
  /security[_-]?code/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api[_-]?key/i,
  /auth/i,
  /authorization/i,
  /bearer/i,
  /cookie/i,
  /session/i,
  /private[_-]?key/i,
  /credential/i,
  /ssn/i,
  /cvv|cvc/i,
  /credit[_-]?card/i,
  /csrf|xsrf/i,
];

const SECRET_PATTERNS: Array<{
  name: string;
  regex: RegExp;
  replacement: string | ((substring: string, ...args: any[]) => string);
}> = [
  {
    name: 'JWT',
    regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
    replacement: '[REDACTED_JWT]',
  },
  {
    name: 'AwsAccessKey',
    regex: /(?<![a-zA-Z0-9])(AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}(?![a-zA-Z0-9])/g,
    replacement: '[REDACTED_AWS_KEY]',
  },
  {
    name: 'GitHubToken',
    regex: /(?<![a-zA-Z0-9])(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}|gho_[a-zA-Z0-9]{36}|ghu_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}|ghr_[a-zA-Z0-9]{36})(?![a-zA-Z0-9])/g,
    replacement: '[REDACTED_GITHUB_TOKEN]',
  },
  {
    name: 'GoogleApiKey',
    regex: /(?<![a-zA-Z0-9])AIza[0-9A-Za-z\-_]{32,40}(?![a-zA-Z0-9])/g,
    replacement: '[REDACTED_GOOGLE_API_KEY]',
  },
  {
    name: 'StripeKey',
    regex: /(?<![a-zA-Z0-9])(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24,}(?![a-zA-Z0-9])/g,
    replacement: '[REDACTED_STRIPE_KEY]',
  },
  {
    name: 'SlackToken',
    regex: /(?<![a-zA-Z0-9])xox[baprs](?:-[0-9a-zA-Z]{1,48}){2,4}(?![a-zA-Z0-9])/g,
    replacement: '[REDACTED_SLACK_TOKEN]',
  },
  {
    name: 'OpenAiKey',
    regex: /(?<![a-zA-Z0-9])sk-(?:proj-)?[a-zA-Z0-9_\-]{32,}(?![a-zA-Z0-9])/g,
    replacement: '[REDACTED_OPENAI_KEY]',
  },
  {
    name: 'PemPrivateKey',
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
  {
    name: 'BearerToken',
    regex: /\bBearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
    replacement: 'Bearer [REDACTED_TOKEN]',
  },
  {
    name: 'BasicAuthHeader',
    regex: /\bBasic\s+[a-zA-Z0-9+/]+=*\b/gi,
    replacement: 'Basic [REDACTED_TOKEN]',
  },
  {
    name: 'BasicAuthUrl',
    regex: /(https?:\/\/)([^:\s\/]+):([^@\s\/]+)@/g,
    replacement: (_match: string, proto: string, user: string) => `${proto}${user}:[REDACTED]@`,
  },
  {
    name: 'SensitiveQueryParam',
    regex: /([?&](?:password|passwd|pwd|passphrase|passcode|secret|token|apikey|api[_-]?key|auth|authorization|credential|session|cookie)=)(?!\[REDACTED)([^&#\s]+)/gi,
    replacement: '$1[REDACTED]',
  },
];

/**
 * Validates a numeric string against the Luhn algorithm (ISO/IEC 7812).
 */
export function isValidLuhn(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digits)) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * Redacts known secret patterns from an individual string.
 */
export function redactSecretsFromString(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (typeof pattern.replacement === 'function') {
      result = result.replace(pattern.regex, pattern.replacement);
    } else {
      result = result.replace(pattern.regex, pattern.replacement);
    }
  }

  // Credit card detection with Luhn verification (Amex 4-6-5, 16-digit 4-4-4-4, and 13-19 unhyphenated digits)
  result = result.replace(
    /\b(?:\d{4}[ -]?){3}\d{4}\b|\b\d{4}[ -]\d{6}[ -]\d{5}\b|\b\d{13,19}\b/g,
    (match) => {
      if (isValidLuhn(match)) {
        return '[REDACTED_CREDIT_CARD]';
      }
      return match;
    },
  );

  return result;
}

/**
 * Checks if an object property key indicates sensitive data.
 */
export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, '');
  return SENSITIVE_KEY_PATTERNS.some((p) => p.test(normalized));
}

/**
 * Recursively redacts secrets from objects, arrays, and primitives.
 * Handles cyclical structures gracefully without infinite recursion using an active recursion stack.
 * Preserves Date, RegExp, Error, and TypedArray/ArrayBuffer instances without destruction.
 */
export function redactSecrets<T>(data: T, activeStack = new Set<object>()): T {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return redactSecretsFromString(data) as unknown as T;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (activeStack.has(data as object)) {
    return '[CIRCULAR]' as unknown as T;
  }

  // Preserve Date instances without destroying prototypes/slots
  if (data instanceof Date) {
    return new Date(data.getTime()) as unknown as T;
  }

  // Preserve RegExp instances
  if (data instanceof RegExp) {
    return new RegExp(data.source, data.flags) as unknown as T;
  }

  // Preserve Error instances with redacted message and stack
  if (data instanceof Error) {
    const copy = new (data.constructor as new (msg?: string) => Error)(
      redactSecretsFromString(data.message),
    );
    copy.name = data.name;
    if (data.stack) {
      copy.stack = redactSecretsFromString(data.stack);
    }
    return copy as unknown as T;
  }

  // Preserve TypedArrays and ArrayBuffer views without converting to plain object
  if (ArrayBuffer.isView(data)) {
    return (typeof (data as any).slice === 'function' ? (data as any).slice() : data) as unknown as T;
  }

  activeStack.add(data as object);
  try {
    if (Array.isArray(data)) {
      return data.map((item) => redactSecrets(item, activeStack)) as unknown as T;
    }

    if (data instanceof Set) {
      const copy = new Set();
      for (const item of data) {
        copy.add(redactSecrets(item, activeStack));
      }
      return copy as unknown as T;
    }

    if (data instanceof Map) {
      const copy = new Map();
      for (const [k, v] of data.entries()) {
        const sanitizedVal = isSensitiveKey(String(k)) ? '[REDACTED]' : redactSecrets(v, activeStack);
        copy.set(k, sanitizedVal);
      }
      return copy as unknown as T;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSecrets(value, activeStack);
      }
    }

    return result as T;
  } finally {
    activeStack.delete(data as object);
  }
}

/**
 * Sanitized form field structure preserving architecture and types without collecting values.
 */
export interface SanitizedFormField {
  name: string;
  id?: string;
  type: string;
  autocomplete?: string;
  required: boolean;
  hasValue: boolean; // boolean indicator only; value is never collected
}

/**
 * Sanitizes form inputs collected from the DOM.
 * Guarantees zero user input collection while preserving structural metadata.
 */
export function sanitizeFormField(field: {
  name?: string;
  id?: string;
  type?: string;
  autocomplete?: string;
  required?: boolean;
  value?: unknown;
}): SanitizedFormField {
  return {
    name: field.name ? redactSecretsFromString(field.name) : '',
    id: field.id ? redactSecretsFromString(field.id) : undefined,
    type: (field.type || 'text').toLowerCase(),
    autocomplete: field.autocomplete,
    required: Boolean(field.required),
    hasValue: Boolean(field.value !== undefined && field.value !== null && field.value !== ''),
  };
}
