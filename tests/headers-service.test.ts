import { describe, it, expect } from 'vitest';
import { HeadersService } from '../src/services/headers.service';

describe('HeadersService', () => {
  it('categorizes headers accurately', () => {
    expect(HeadersService.getCategory('Content-Security-Policy')).toBe('security');
    expect(HeadersService.getCategory('Strict-Transport-Security')).toBe('security');
    expect(HeadersService.getCategory('Cache-Control')).toBe('caching');
    expect(HeadersService.getCategory('ETag')).toBe('caching');
    expect(HeadersService.getCategory('Server')).toBe('server');
    expect(HeadersService.getCategory('X-Powered-By')).toBe('server');
    expect(HeadersService.getCategory('CF-Ray')).toBe('network');
    expect(HeadersService.getCategory('Access-Control-Allow-Origin')).toBe('cors');
    expect(HeadersService.getCategory('Content-Type')).toBe('content');
    expect(HeadersService.getCategory('X-Custom-Header')).toBe('other');
  });

  it('detects security status and information leaks', () => {
    const leakStatus = HeadersService.getHeaderStatus('X-Powered-By', 'Express');
    expect(leakStatus.status).toBe('leak');
    expect(leakStatus.description).toContain('framework/runtime');

    const serverLeak = HeadersService.getHeaderStatus('Server', 'Apache/2.4.41 (Ubuntu)');
    expect(serverLeak.status).toBe('leak');
    expect(serverLeak.recommendation).toContain('ServerTokens');

    const cleanServer = HeadersService.getHeaderStatus('Server', 'cloudflare');
    expect(cleanServer.status).toBe('info');

    const hstsStatus = HeadersService.getHeaderStatus('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    expect(hstsStatus.status).toBe('secure');

    const cspStatus = HeadersService.getHeaderStatus('Content-Security-Policy', "default-src 'self'");
    expect(cspStatus.status).toBe('secure');
  });

  it('identifies missing recommended security headers on HTTPS', () => {
    const rawHeaders: Record<string, string> = {
      'content-type': 'text/html; charset=utf-8',
    };

    const missing = HeadersService.getMissingSecurityHeaders(rawHeaders, true);
    const missingNames = missing.map((m) => m.name);

    expect(missingNames).toContain('Strict-Transport-Security');
    expect(missingNames).toContain('Content-Security-Policy');
    expect(missingNames).toContain('X-Content-Type-Options');
    expect(missingNames).toContain('X-Frame-Options');
    expect(missingNames).toContain('Referrer-Policy');
  });

  it('does not flag HSTS as missing if present', () => {
    const rawHeaders: Record<string, string> = {
      'strict-transport-security': 'max-age=31536000',
      'content-security-policy': "default-src 'self'",
    };

    const missing = HeadersService.getMissingSecurityHeaders(rawHeaders, true);
    const missingNames = missing.map((m) => m.name);

    expect(missingNames).not.toContain('Strict-Transport-Security');
    expect(missingNames).not.toContain('Content-Security-Policy');
  });

  it('generates valid cURL command and formatted response', () => {
    const result = HeadersService.processHeaders(
      {
        'content-type': 'text/html',
        server: 'nginx',
      },
      200,
      'OK',
      'https://example.com/page',
      'HEAD',
    );

    expect(result.curlCommand).toBe('curl -I -sS -L "https://example.com/page"');
    expect(result.rawHeadersText).toContain('HTTP/1.1 200 OK');
    expect(result.rawHeadersText).toContain('content-type: text/html');
    expect(result.rawHeadersText).toContain('server: nginx');
    expect(result.statusCode).toBe(200);
  });
});

