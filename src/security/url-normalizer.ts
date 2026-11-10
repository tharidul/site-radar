
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
    throw new Error(`Failed to parse URL: ${err.message}`);
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
