
export interface UrlNormalizationOptions {
  stripFragment?: boolean;
  stripDefaultPorts?: boolean;
  collapseSlashes?: boolean;
  sortQueryParams?: boolean;
  stripTrackingParams?: boolean;
  lowercaseHost?: boolean;
}

const DEFAULT_OPTIONS: Required<UrlNormalizationOptions> = {
  stripFragment: true,
  stripDefaultPorts: true,
  collapseSlashes: true,
  sortQueryParams: true,
  stripTrackingParams: true,
  lowercaseHost: true,
};

const TRACKING_PARAM_REGEX = /^(utm_[a-z0-9_]+|gclid|fbclid|mc_eid|msclkid|dclid|_hsenc|_hsmi)$/i;

export function normalizeUrl(rawUrl: string, options?: UrlNormalizationOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const trimmed = rawUrl.trim();

  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    throw new Error('URL contains invalid control characters');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch (err: any) {
    throw new Error(`Failed to parse URL: ${err.message}`, { cause: err });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported URL scheme: ${url.protocol}`);
  }

  url.username = '';
  url.password = '';

  if (opts.stripFragment) {
    url.hash = '';
  }

  if (opts.lowercaseHost) {
    url.hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
  }

  if (opts.stripDefaultPorts) {
    if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
      url.port = '';
    }
  }

  if (opts.collapseSlashes) {
    url.pathname = url.pathname.replace(/\/+/g, '/');
  }

  if (url.search) {
    const params = new URLSearchParams(url.search);
    const keys = Array.from(new Set(params.keys())).sort();
    const sorted = new URLSearchParams();

    for (const key of keys) {
      if (opts.stripTrackingParams && TRACKING_PARAM_REGEX.test(key)) {
        continue;
      }
      const values = params.getAll(key).sort();
      for (const val of values) {
        sorted.append(key, val);
      }
    }

    const searchStr = sorted.toString();
    url.search = searchStr ? `?${searchStr}` : '';
  }

  return url.toString();
}

export function isSameOrigin(urlA: string, urlB: string): boolean {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    return a.origin === b.origin;
  } catch {
    return false;
  }
}

export function isAllowedCrawlUrl(candidateUrl: string, baseOriginUrl: string): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const base = new URL(baseOriginUrl);

    if (candidate.origin !== base.origin) return false;

    if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') return false;

    const EXCLUDED_EXTENSIONS = /\.(pdf|zip|tar|gz|7z|rar|exe|dmg|iso|mp4|webm|mp3|wav|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot)$/i;
    if (EXCLUDED_EXTENSIONS.test(candidate.pathname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const AUTH_CHECKOUT_SUBDOMAIN_REGEX =
  /^(?:login|signin|auth|passport|sso|identity|account|accounts|my|member|portal|gateway|checkout|pay|payment|payments|cashier|trade|buy|order|orders|shoppingcart|cart|secure)\./i;

export const THIRD_PARTY_GATEWAY_REGEX =
  /(?:accounts\.google\.com|appleid\.apple\.com|checkout\.stripe\.com|pay\.stripe\.com|(?:^|\.)paypal\.com|checkout\.shopify\.com|pay\.shopify\.com|payments\.amazon\.com|pay\.google\.com|klarna\.com|adyen\.com|(?:^|\.)auth0\.com|(?:^|\.)okta\.com|(?:^|\.)clerk\.accounts\.dev)/i;

const MULTI_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'gov.uk', 'ac.uk',
  'com.au', 'net.au', 'org.au', 'edu.au',
  'co.nz', 'net.nz', 'org.nz',
  'co.jp', 'ne.jp',
  'com.br', 'com.mx', 'com.ar',
  'co.in', 'net.in', 'org.in', 'gen.in',
  'com.sg', 'edu.sg',
  'com.tr', 'com.tw', 'com.hk',
  'co.za', 'com.my',
]);

export function getRegistrableDomain(hostname: string): string {
  if (!hostname) return '';
  const cleanHost = hostname.toLowerCase().trim().replace(/:\d+$/, '');
  const parts = cleanHost.split('.');
  if (parts.length <= 2) return cleanHost;

  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

export function isAuthOrCheckoutOrigin(candidateHostOrUrl: string, targetHostOrBaseDomain: string): boolean {
  if (!candidateHostOrUrl) return false;
  try {
    let host = '';
    if (candidateHostOrUrl.startsWith('http://') || candidateHostOrUrl.startsWith('https://') || candidateHostOrUrl.startsWith('//')) {
      const u = new URL(candidateHostOrUrl, 'https://localhost');
      host = u.hostname.toLowerCase();
    } else if (!candidateHostOrUrl.includes('/') && candidateHostOrUrl.includes('.')) {
      host = candidateHostOrUrl.toLowerCase().replace(/:\d+$/, '');
    } else {
      const u = new URL(candidateHostOrUrl, 'https://localhost');
      host = u.hostname.toLowerCase();
    }

    if (!host || host === 'localhost') return false;

    if (THIRD_PARTY_GATEWAY_REGEX.test(host)) {
      return true;
    }

    const baseDomain = targetHostOrBaseDomain.includes('.')
      ? getRegistrableDomain(targetHostOrBaseDomain)
      : targetHostOrBaseDomain;

    if (baseDomain && (host === baseDomain || host.endsWith(`.${baseDomain}`))) {
      if (AUTH_CHECKOUT_SUBDOMAIN_REGEX.test(host)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

