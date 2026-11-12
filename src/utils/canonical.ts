const TRACKING_OR_CHALLENGE_PARAM_EXACT = new Set([
  'spm',
  'fbclid',
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
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
  'js_challenge',
  'jsc_orig_r',
  'jsc_token',
  'solution',
]);

const TRACKING_PARAM_PREFIXES = ['utm_', 'jsc_', 'mtm_', 'pk_'];

function isTrackingOrChallengeParam(key: string): boolean {
  const lower = key.toLowerCase();
  if (TRACKING_OR_CHALLENGE_PARAM_EXACT.has(lower)) return true;
  return TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function normalizeUrlForCanonical(rawUrl: string, stripTracking: boolean): string {
  const parsed = new URL(rawUrl);
  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  if (stripTracking && parsed.search) {
    const kept = new URLSearchParams();
    parsed.searchParams.forEach((val, key) => {
      if (!isTrackingOrChallengeParam(key)) {
        kept.append(key, val);
      }
    });
    const nextSearch = kept.toString();
    parsed.search = nextSearch ? `?${nextSearch}` : '';
  }
  return parsed.toString().replace(/\/$/, '');
}

/**
 * Compare a page URL and its declared canonical URL, ignoring credentials,
 * fragments, trailing slashes, and known tracking/anti-bot challenge parameters.
 */
export function canonicalUrlsMatch(pageUrl: string, canonicalUrl: string): boolean {
  try {
    if (normalizeUrlForCanonical(pageUrl, false) === normalizeUrlForCanonical(canonicalUrl, false)) {
      return true;
    }
    return normalizeUrlForCanonical(pageUrl, true) === normalizeUrlForCanonical(canonicalUrl, true);
  } catch {
    return false;
  }
}

