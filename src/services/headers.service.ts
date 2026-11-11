import type {
  HeaderCategory,
  HeaderItem,
  HeaderLeakItem,
  HeaderStatus,
  MissingSecurityHeader,
  ResponseHeadersData,
} from '@/types/inspection';

const SECURITY_HEADERS = new Set([
  'strict-transport-security',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'feature-policy',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'x-xss-protection',
  'x-permitted-cross-domain-policies',
]);

const CACHING_HEADERS = new Set([
  'cache-control',
  'pragma',
  'expires',
  'etag',
  'last-modified',
  'age',
  'vary',
  'clear-site-data',
]);

const SERVER_HEADERS = new Set([
  'server',
  'x-powered-by',
  'x-aspnet-version',
  'x-aspnetmvc-version',
  'x-runtime',
  'x-version',
  'x-generator',
  'via',
]);

const NETWORK_HEADERS = new Set([
  'alt-svc',
  'cf-ray',
  'cf-cache-status',
  'x-cache',
  'x-cache-hits',
  'x-served-by',
  'x-amz-cf-id',
  'x-amz-cf-pop',
  'x-azure-ref',
  'server-timing',
  'connection',
  'keep-alive',
  'transfer-encoding',
]);

const CORS_HEADERS = new Set([
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-expose-headers',
  'access-control-allow-credentials',
  'access-control-max-age',
  'timing-allow-origin',
]);

const CONTENT_HEADERS = new Set([
  'content-type',
  'content-length',
  'content-encoding',
  'content-language',
  'content-disposition',
  'content-range',
  'accept-ranges',
]);

export class HeadersService {
  /**
   * Categorize a header name
   */
  static getCategory(headerName: string): HeaderCategory {
    const lower = headerName.toLowerCase();
    if (SECURITY_HEADERS.has(lower)) return 'security';
    if (CACHING_HEADERS.has(lower)) return 'caching';
    if (SERVER_HEADERS.has(lower)) return 'server';
    if (NETWORK_HEADERS.has(lower)) return 'network';
    if (CORS_HEADERS.has(lower)) return 'cors';
    if (CONTENT_HEADERS.has(lower)) return 'content';
    return 'other';
  }

  /**
   * Determine status of an observed header
   */
  static getHeaderStatus(name: string, value: string): { status: HeaderStatus; description?: string; recommendation?: string } {
    const lower = name.toLowerCase();

    // Check for version leaks
    if (lower === 'x-powered-by') {
      return {
        status: 'leak',
        description: 'Exposes underlying framework/runtime technology, aiding targeted exploit scanning.',
        recommendation: 'Disable X-Powered-By in your server/framework configuration (e.g. app.disable("x-powered-by") in Express).',
      };
    }

    if (lower === 'server' && (/\d+\.\d+/.test(value) || /ubuntu|debian|centos|apache|nginx/i.test(value))) {
      return {
        status: 'leak',
        description: 'Reveals server software and version numbers, allowing attackers to identify unpatched CVEs.',
        recommendation: 'Configure your web server to suppress detailed version banners (e.g. ServerTokens Prod in Apache, server_tokens off in Nginx).',
      };
    }

    if (lower === 'x-aspnet-version' || lower === 'x-aspnetmvc-version') {
      return {
        status: 'leak',
        description: 'Reveals precise .NET Framework and ASP.NET MVC version numbers.',
        recommendation: 'Remove via web.config: <httpRuntime enableVersionHeader="false" />',
      };
    }

    if (lower === 'x-xss-protection') {
      if (value === '0') {
        return {
          status: 'info',
          description: 'Auditor disabled legacy XSS filter to prevent side-channel leaks (recommended practice for modern CSP).',
        };
      }
      return {
        status: 'warning',
        description: 'Legacy header superseded by Content Security Policy. Can introduce client vulnerabilities in older browsers.',
        recommendation: 'Use Content-Security-Policy instead, or set X-XSS-Protection: 0.',
      };
    }

    if (lower === 'strict-transport-security') {
      const hasSubDomains = /includesubdomains/i.test(value);
      const hasPreload = /preload/i.test(value);
      return {
        status: 'secure',
        description: `Enforces TLS connections (subdomains: ${hasSubDomains ? 'yes' : 'no'}, preload: ${hasPreload ? 'yes' : 'no'}).`,
      };
    }

    if (lower === 'content-security-policy') {
      return {
        status: 'secure',
        description: 'Restricts script execution sources and resource origins, mitigating XSS and data injection.',
      };
    }

    if (lower === 'x-content-type-options') {
      if (value.toLowerCase().includes('nosniff')) {
        return {
          status: 'secure',
          description: 'Prevents MIME-type sniffing, enforcing declared Content-Type.',
        };
      }
      return {
        status: 'warning',
        description: 'Header present but missing the recommended "nosniff" directive.',
        recommendation: 'Set X-Content-Type-Options: nosniff',
      };
    }

    if (lower === 'x-frame-options') {
      const v = value.toUpperCase();
      if (v === 'DENY' || v === 'SAMEORIGIN') {
        return {
          status: 'secure',
          description: `Protects against clickjacking by restricting framing (${v}).`,
        };
      }
      return {
        status: 'warning',
        description: 'Non-standard framing protection directive.',
        recommendation: 'Use DENY, SAMEORIGIN, or CSP frame-ancestors.',
      };
    }

    if (lower === 'referrer-policy') {
      return {
        status: 'secure',
        description: `Controls outgoing Referer header exposure (${value}).`,
      };
    }

    if (lower === 'permissions-policy') {
      return {
        status: 'secure',
        description: 'Restricts browser hardware and sensitive features (camera, microphone, geolocation).',
      };
    }

    if (lower === 'cross-origin-opener-policy') {
      return {
        status: 'secure',
        description: `Enforces browsing context isolation (${value}).`,
      };
    }

    if (lower === 'cache-control') {
      return {
        status: 'info',
        description: `HTTP caching directives (${value}).`,
      };
    }

    if (SECURITY_HEADERS.has(lower)) {
      return { status: 'secure' };
    }

    return { status: 'info' };
  }

  /**
   * Identify missing recommended security headers
   */
  static getMissingSecurityHeaders(headers: Record<string, string>, isHttps: boolean): MissingSecurityHeader[] {
    const missing: MissingSecurityHeader[] = [];

    if (isHttps && !headers['strict-transport-security']) {
      missing.push({
        name: 'Strict-Transport-Security',
        severity: 'high',
        title: 'Missing HSTS (HTTP Strict Transport Security)',
        description: 'Without HSTS, initial connections may be vulnerable to SSL-stripping and man-in-the-middle attacks.',
        recommendation: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
        exampleValue: 'max-age=31536000; includeSubDomains',
      });
    }

    if (!headers['content-security-policy']) {
      missing.push({
        name: 'Content-Security-Policy',
        severity: 'high',
        title: 'Missing Content Security Policy (CSP)',
        description: 'CSP provides critical defense-in-depth against Cross-Site Scripting (XSS), clickjacking, and packet sniffing.',
        recommendation: 'Define a Content-Security-Policy directive restricting script-src, style-src, and object-src.',
        exampleValue: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;",
      });
    }

    if (!headers['x-content-type-options']) {
      missing.push({
        name: 'X-Content-Type-Options',
        severity: 'high',
        title: 'Missing X-Content-Type-Options: nosniff',
        description: 'Allows older browsers to MIME-sniff response bodies away from declared Content-Types, enabling executable payload execution.',
        recommendation: 'Set X-Content-Type-Options: nosniff on all responses.',
        exampleValue: 'nosniff',
      });
    }

    if (!headers['x-frame-options'] && !headers['content-security-policy']?.includes('frame-ancestors')) {
      missing.push({
        name: 'X-Frame-Options',
        severity: 'medium',
        title: 'Missing Frame Ancestors / Clickjacking Protection',
        description: 'The page can be embedded inside external iframes, leaving users vulnerable to clickjacking attacks.',
        recommendation: 'Set X-Frame-Options: SAMEORIGIN or CSP frame-ancestors directive.',
        exampleValue: 'SAMEORIGIN',
      });
    }

    if (!headers['referrer-policy']) {
      missing.push({
        name: 'Referrer-Policy',
        severity: 'medium',
        title: 'Missing Referrer-Policy',
        description: 'Without an explicit Referrer-Policy, full sensitive URLs (including tokens or search queries) may leak in the Referer header to external destinations.',
        recommendation: 'Set Referrer-Policy: strict-origin-when-cross-origin',
        exampleValue: 'strict-origin-when-cross-origin',
      });
    }

    if (!headers['permissions-policy'] && !headers['feature-policy']) {
      missing.push({
        name: 'Permissions-Policy',
        severity: 'low',
        title: 'Missing Permissions-Policy',
        description: 'Does not explicitly disable unused sensitive browser APIs like camera, microphone, or geolocation.',
        recommendation: 'Add Permissions-Policy: camera=(), microphone=(), geolocation=()',
        exampleValue: 'camera=(), microphone=(), geolocation=()',
      });
    }

    return missing;
  }

  /**
   * Detect server and technology leaks
   */
  static getLeaks(headers: Record<string, string>): HeaderLeakItem[] {
    const leaks: HeaderLeakItem[] = [];

    if (headers['x-powered-by']) {
      leaks.push({
        name: 'X-Powered-By',
        value: headers['x-powered-by'],
        risk: 'Reveals backend technology and framework used by the application.',
        recommendation: 'Remove X-Powered-By in web framework configuration.',
      });
    }

    const server = headers['server'];
    if (server && (/\d+\.\d+/.test(server) || /ubuntu|debian|centos/i.test(server))) {
      leaks.push({
        name: 'Server',
        value: server,
        risk: 'Reveals operating system or precise server software version numbers.',
        recommendation: 'Suppress verbose version details in server configuration.',
      });
    }

    if (headers['x-aspnet-version']) {
      leaks.push({
        name: 'X-AspNet-Version',
        value: headers['x-aspnet-version'],
        risk: 'Exposes ASP.NET framework version.',
        recommendation: 'Disable enableVersionHeader in web.config.',
      });
    }

    return leaks;
  }

  /**
   * Process raw headers into complete ResponseHeadersData
   */
  static processHeaders(
    rawMap: Record<string, string>,
    statusCode: number,
    statusText: string,
    url: string,
    method: string = 'HEAD',
  ): ResponseHeadersData {
    const headers: Record<string, string> = {};
    const rawHeaders: Array<{ name: string; value: string }> = [];

    // Normalize keys to lowercase
    for (const [key, val] of Object.entries(rawMap)) {
      const lower = key.toLowerCase();
      headers[lower] = val;
      rawHeaders.push({ name: key, value: val });
    }

    // Sort alphabetically
    rawHeaders.sort((a, b) => a.name.localeCompare(b.name));

    const categorizedHeaders: HeaderItem[] = rawHeaders.map((h) => {
      const cat = this.getCategory(h.name);
      const statusInfo = this.getHeaderStatus(h.name, h.value);
      return {
        name: h.name,
        value: h.value,
        category: cat,
        status: statusInfo.status,
        description: statusInfo.description,
        recommendation: statusInfo.recommendation,
      };
    });

    const isHttps = url.startsWith('https:');
    const missingSecurityHeaders = this.getMissingSecurityHeaders(headers, isHttps);
    const leaks = this.getLeaks(headers);

    const curlCommand = `curl -I -sS -L "${url}"`;

    let rawHeadersText = `HTTP/1.1 ${statusCode} ${statusText || 'OK'}\r\n`;
    for (const h of rawHeaders) {
      rawHeadersText += `${h.name}: ${h.value}\r\n`;
    }

    return {
      statusCode,
      statusText: statusText || (statusCode === 200 ? 'OK' : ''),
      url,
      method,
      headers,
      rawHeaders,
      categorizedHeaders,
      missingSecurityHeaders,
      leaks,
      curlCommand,
      rawHeadersText,
      retrievedAt: Date.now(),
    };
  }
}

