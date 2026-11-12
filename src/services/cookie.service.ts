
import type {
  InspectedCookie,
  CookieSecurityAudit,
  CookieAuditSummary,
  SameSiteStatus,
} from '@/types/cookies';

let mockCookiesStore: InspectedCookie[] = [];

export function setMockCookies(cookies: InspectedCookie[]) {
  mockCookiesStore = [...cookies];
}

export function getMockCookies(): InspectedCookie[] {
  return [...mockCookiesStore];
}

export function clearMockCookies() {
  mockCookiesStore = [];
}

export function assertValidCookieDomain(targetUrl: string, domain?: string): void {
  if (!domain) return;

  let targetHost: string;
  try {
    targetHost = new URL(targetUrl).hostname.toLowerCase().replace(/\.+$/, '');
  } catch {
    throw new Error(`Invalid target URL: '${targetUrl}'`);
  }

  if (!targetHost) {
    throw new Error(`Invalid target URL hostname: '${targetUrl}'`);
  }

  const cleanCookieDomain = domain.trim().replace(/^\./, '').replace(/\.+$/, '').toLowerCase();
  if (!cleanCookieDomain || cleanCookieDomain.startsWith('.')) {
    throw new Error(`Security Violation: Invalid cookie domain '${domain}' while auditing '${targetHost}'`);
  }

  const isExactMatch = cleanCookieDomain === targetHost;
  const isValidParentDomain = cleanCookieDomain.includes('.') && targetHost.endsWith(`.${cleanCookieDomain}`);
  if (!isExactMatch && !isValidParentDomain) {
    throw new Error(`Security Violation: Cannot set cookie for '${domain}' while auditing '${targetHost}'`);
  }
}

export function buildCookieUrl(url: string, domain?: string, path?: string, secure?: boolean): string {
  assertValidCookieDomain(url, domain);
  try {
    const parsed = new URL(url);
    const scheme = secure !== undefined ? (secure ? 'https:' : 'http:') : parsed.protocol;
    const cleanDomain = domain
      ? domain.trim().replace(/^\./, '').replace(/\.+$/, '').toLowerCase()
      : parsed.hostname;
    const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '/';
    return `${scheme}//${cleanDomain}${cleanPath}`;
  } catch {
    const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '/';
    return `https://localhost${cleanPath}`;
  }
}

export function auditCookie(cookie: InspectedCookie): CookieSecurityAudit {
  const nowSec = Date.now() / 1000;
  const isExpired = cookie.expirationDate !== undefined && cookie.expirationDate > 0 && cookie.expirationDate < nowSec;
  const missingSecure = !cookie.secure;
  const missingHttpOnly = !cookie.httpOnly;
  const sameSiteNoneInsecure =
    (cookie.sameSite === 'no_restriction' || cookie.sameSite === 'unspecified') && !cookie.secure;

  return {
    missingSecure,
    missingHttpOnly,
    sameSiteNoneInsecure,
    isExpired,
  };
}

export interface FormattedCookieLifetime {
  isSession: boolean;
  isExpired: boolean;
  label: string;
  relative: string;
  fullDate: string;
}

function formatRelativeTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(days / 365);
  return `${years}y ${months % 12}mo`;
}

export function formatCookieLifetime(cookie: { session: boolean; expirationDate?: number }): FormattedCookieLifetime {
  if (cookie.session || !cookie.expirationDate || cookie.expirationDate <= 0) {
    return {
      isSession: true,
      isExpired: false,
      label: 'Session',
      relative: 'Until browser closes',
      fullDate: 'Until session ends',
    };
  }

  const expMs = cookie.expirationDate * 1000;
  const nowMs = Date.now();
  const diffSec = Math.round((expMs - nowMs) / 1000);
  const isExpired = diffSec <= 0;

  const dateObj = new Date(expMs);
  const fullDate = dateObj.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isExpired) {
    const absDiff = Math.abs(diffSec);
    const ago = formatRelativeTime(absDiff);
    return {
      isSession: false,
      isExpired: true,
      label: `Expired (${ago} ago)`,
      relative: `${ago} ago`,
      fullDate,
    };
  }

  const remaining = formatRelativeTime(diffSec);
  return {
    isSession: false,
    isExpired: false,
    label: `In ${remaining}`,
    relative: `in ${remaining}`,
    fullDate,
  };
}

export function computeAuditSummary(cookies: InspectedCookie[]): CookieAuditSummary {
  let sessionCount = 0;
  let persistentCount = 0;
  let missingSecureCount = 0;
  let missingHttpOnlyCount = 0;

  for (const c of cookies) {
    if (c.session) {
      sessionCount++;
    } else {
      persistentCount++;
    }
    const audit = auditCookie(c);
    if (audit.missingSecure) missingSecureCount++;
    if (audit.missingHttpOnly) missingHttpOnlyCount++;
  }

  return {
    total: cookies.length,
    sessionCount,
    persistentCount,
    missingSecureCount,
    missingHttpOnlyCount,
  };
}

export class CookieService {
  private setMockCookie(cookie: Partial<InspectedCookie>): boolean {
    const existingIdx = mockCookiesStore.findIndex(
      (c) => c.name === cookie.name && c.domain === cookie.domain,
    );
    const newCookie: InspectedCookie = {
      name: cookie.name!,
      value: cookie.value ?? '',
      domain: cookie.domain ?? 'localhost',
      path: cookie.path ?? '/',
      secure: cookie.secure ?? false,
      httpOnly: cookie.httpOnly ?? false,
      sameSite: cookie.sameSite ?? 'lax',
      session: cookie.session ?? true,
      expirationDate: cookie.expirationDate,
    };
    if (existingIdx >= 0) {
      mockCookiesStore[existingIdx] = newCookie;
    } else {
      mockCookiesStore.push(newCookie);
    }
    return true;
  }

  private deleteMockCookie(cookie: InspectedCookie): boolean {
    mockCookiesStore = mockCookiesStore.filter(
      (c) => !(c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path),
    );
    return true;
  }

  async getCookies(targetUrl: string): Promise<InspectedCookie[]> {
    try {
      if (typeof chrome === 'undefined' || !chrome.cookies?.getAll) {
        return [...mockCookiesStore];
      }

      const urlObj = new URL(targetUrl);
      const urlCookies = await chrome.cookies.getAll({ url: targetUrl });

      const domain = urlObj.hostname;
      let domainCookies: chrome.cookies.Cookie[] = [];
      try {
        domainCookies = await chrome.cookies.getAll({ domain });
      } catch {
      }

      const map = new Map<string, InspectedCookie>();
      const allRaw = [...urlCookies, ...domainCookies];

      for (const c of allRaw) {
        const key = `${c.name}|${c.domain}|${c.path}|${c.storeId || ''}`;
        if (!map.has(key)) {
          map.set(key, {
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            secure: c.secure,
            httpOnly: c.httpOnly,
            sameSite: c.sameSite as SameSiteStatus,
            session: c.session,
            expirationDate: c.expirationDate,
            hostOnly: c.hostOnly,
            storeId: c.storeId,
            partitionKey: c.partitionKey,
          });
        }
      }

      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (err: any) {
      if (err?.message?.includes('not implemented')) {
        return [...mockCookiesStore];
      }
      console.error('Failed to get cookies:', err);
      return [];
    }
  }

  async setCookie(targetUrl: string, cookie: Partial<InspectedCookie>): Promise<boolean> {
    if (!cookie.name) {
      throw new Error('Cookie name is required');
    }

    assertValidCookieDomain(targetUrl, cookie.domain);

    try {
      if (typeof chrome === 'undefined' || !chrome.cookies?.set) {
        return this.setMockCookie(cookie);
      }

      const opUrl = buildCookieUrl(targetUrl, cookie.domain, cookie.path, cookie.secure);

      const details: chrome.cookies.SetDetails = {
        url: opUrl,
        name: cookie.name,
        value: cookie.value ?? '',
        path: cookie.path || '/',
        secure: cookie.secure ?? false,
        httpOnly: cookie.httpOnly ?? false,
        sameSite: cookie.sameSite || 'lax',
      };

      if (cookie.domain && !cookie.domain.startsWith('.')) {
        details.domain = cookie.domain;
      }

      if (!cookie.session && cookie.expirationDate && cookie.expirationDate > 0) {
        details.expirationDate = cookie.expirationDate;
      }

      const res = await chrome.cookies.set(details);
      return !!res;
    } catch (err: any) {
      if (err?.message?.includes('not implemented')) {
        return this.setMockCookie(cookie);
      }
      throw new Error(err?.message || 'Failed to set cookie');
    }
  }

  async deleteCookie(targetUrl: string, cookie: InspectedCookie): Promise<boolean> {
    try {
      if (typeof chrome === 'undefined' || !chrome.cookies?.remove) {
        return this.deleteMockCookie(cookie);
      }

      const opUrl = buildCookieUrl(targetUrl, cookie.domain, cookie.path, cookie.secure);

      const res = await chrome.cookies.remove({
        url: opUrl,
        name: cookie.name,
        storeId: cookie.storeId,
      });
      return !!res;
    } catch (err: any) {
      if (err?.message?.includes('not implemented')) {
        return this.deleteMockCookie(cookie);
      }
      throw new Error(err?.message || `Failed to remove cookie ${cookie.name}`);
    }
  }

  async clearAll(targetUrl: string, cookies: InspectedCookie[]): Promise<number> {
    let deleted = 0;
    for (const c of cookies) {
      try {
        await this.deleteCookie(targetUrl, c);
        deleted++;
      } catch {
      }
    }
    return deleted;
  }

  exportJson(cookies: InspectedCookie[]): string {
    return JSON.stringify(cookies, null, 2);
  }

  exportHeaderString(cookies: InspectedCookie[]): string {
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }

  async importJson(targetUrl: string, jsonString: string): Promise<{ success: number; failed: number }> {
    let parsed: any[];
    try {
      const data = JSON.parse(jsonString);
      parsed = Array.isArray(data) ? data : [data];
    } catch {
      throw new Error('Invalid JSON format. Please provide a valid cookie array.');
    }

    let success = 0;
    let failed = 0;

    for (const item of parsed) {
      if (!item.name) {
        failed++;
        continue;
      }
      try {
        await this.setCookie(targetUrl, {
          name: String(item.name),
          value: item.value !== undefined ? String(item.value) : '',
          domain: item.domain ? String(item.domain) : undefined,
          path: item.path ? String(item.path) : '/',
          secure: Boolean(item.secure),
          httpOnly: Boolean(item.httpOnly),
          sameSite: (item.sameSite as SameSiteStatus) || 'lax',
          session: Boolean(item.session),
          expirationDate: typeof item.expirationDate === 'number' ? item.expirationDate : undefined,
        });
        success++;
      } catch {
        failed++;
      }
    }

    return { success, failed };
  }
}

export const cookieService = new CookieService();
