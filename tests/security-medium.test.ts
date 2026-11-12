import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isProhibitedHostname,
  validatePublicUrl,
} from '../src/security/private-network.guard';
import { BoundedSpider } from '../src/crawler/spider';
import { redactSecrets } from '../src/security/secret-redactor';
import { StructuredDataCollector } from '../src/collectors/page/structured-data.collector';
import {
  CookieService,
  buildCookieUrl,
  clearMockCookies,
  getMockCookies,
} from '../src/services/cookie.service';
import { AsnLookupClient } from '../src/intelligence/asn-lookup';
import { consentManager } from '../src/intelligence/consent-manager';

describe('MED-01: Wildcard DNS SSRF Guard & Spider Validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks exact and subdomain wildcard DNS hostnames in isProhibitedHostname', () => {
    const blockedHosts = [
      'nip.io',
      '127.0.0.1.nip.io',
      '10.0.0.1.NIP.IO.',
      'sslip.io',
      '169.254.169.254.sslip.io',
      'localtest.me',
      'sub.localtest.me',
      'vcap.me',
      'app.vcap.me',
      'lvh.me',
      'test.lvh.me',
    ];

    for (const host of blockedHosts) {
      expect(isProhibitedHostname(host), `expected ${host} to be blocked`).toBe(true);
    }

    expect(isProhibitedHostname('example.com')).toBe(false);
    expect(isProhibitedHostname('mynip.io')).toBe(false);
    expect(isProhibitedHostname('notlocaltest.me')).toBe(false);
  });

  it('rejects wildcard DNS URLs in validatePublicUrl without a DoH resolver', async () => {
    const urls = [
      'http://127.0.0.1.nip.io/',
      'http://169.254.169.254.sslip.io/latest/meta-data',
      'https://sub.localtest.me/admin',
      'http://app.vcap.me:8080/',
      'http://internal.lvh.me/',
    ];

    for (const url of urls) {
      const res = await validatePublicUrl(url);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('RESERVED_HOSTNAME');
    }
  });

  it('blocks wildcard DNS seed URLs in BoundedSpider before issuing any fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const spider = new BoundedSpider({ maxPages: 5, maxDepth: 1 });

    const result = await spider.crawl('http://127.0.0.1.nip.io/');
    expect(result.status).toBe('error');
    expect(result.error).toContain('RESERVED_HOSTNAME');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks HTTP 302 redirects to private/wildcard-DNS targets before fetching the redirect target', async () => {
    const fetchedUrls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      fetchedUrls.push(url);

      if (url.endsWith('/robots.txt')) {
        return new Response('', { status: 404 });
      }

      if (url === 'https://example.com/') {
        return new Response(null, {
          status: 302,
          headers: { location: 'http://169.254.169.254.sslip.io/latest/meta-data' },
        });
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });

    const spider = new BoundedSpider({ maxPages: 5, maxDepth: 1 });
    const result = await spider.crawl('https://example.com/');

    expect(fetchedUrls).not.toContain('http://169.254.169.254.sslip.io/latest/meta-data');
    expect(result.pages[0]?.status).toBe('error');
    expect(result.pages[0]?.error).toContain('SSRF Blocked');
    expect(result.progress.excludedUrls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'http://169.254.169.254.sslip.io/latest/meta-data',
          reason: 'private-ip',
        }),
      ]),
    );
  });
});

describe('MED-02: Prototype Pollution Prevention in SecretRedactor', () => {
  afterEach(() => {
    // Ensure global prototype stays clean even if a test fails
    delete (Object.prototype as Record<string, unknown>).polluted;
  });

  it('strips __proto__, constructor, and prototype keys without polluting Object.prototype', () => {
    const maliciousJson = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true},"@context":"https://schema.org","@type":"Organization","apiKey":"super-secret-value","nested":{"__proto__":{"deepPolluted":true},"name":"Acme"}}',
    );

    const sanitized = redactSecrets(maliciousJson) as Record<string, unknown>;

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).deepPolluted).toBeUndefined();
    expect(Object.getPrototypeOf(sanitized)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(sanitized, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(sanitized, 'prototype')).toBe(false);
    expect(sanitized['@context']).toBe('https://schema.org');
    expect(sanitized['@type']).toBe('Organization');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).name).toBe('Acme');
  });

  it('remains compatible with StructuredDataCollector JSON-LD parsing', () => {
    document.body.innerHTML = `
      <script type="application/ld+json">
        {"__proto__":{"polluted":true},"@context":"https://schema.org","@type":"WebSite","name":"Safe Site","token":"secret123"}
      </script>
    `;

    const collector = new StructuredDataCollector();
    const res = collector.collect({
      document,
      url: 'https://example.com',
    } as any);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(res.data?.schemas[0]?.valid).toBe(true);
    expect(res.data?.schemas[0]?.schemaType).toBe('WebSite');
    expect(res.data?.schemas[0]?.topLevelProperties).toEqual(['@context', '@type', 'name', 'token']);
  });
});

describe('MED-03: Cookie Domain Isolation in CookieService', () => {
  const service = new CookieService();

  beforeEach(() => {
    clearMockCookies();
  });

  afterEach(() => {
    clearMockCookies();
  });

  it('allows exact hostname and valid parent domains', async () => {
    expect(buildCookieUrl('https://sub.example.com/app', 'sub.example.com', '/')).toBe(
      'https://sub.example.com/',
    );
    expect(buildCookieUrl('https://sub.example.com/app', '.example.com', '/')).toBe(
      'https://example.com/',
    );

    const okExact = await service.setCookie('https://sub.example.com', {
      name: 'sid',
      value: '123',
      domain: 'sub.example.com',
    });
    const okParent = await service.setCookie('https://sub.example.com', {
      name: 'parent_sid',
      value: '456',
      domain: '.example.com',
    });

    expect(okExact).toBe(true);
    expect(okParent).toBe(true);
    expect(getMockCookies()).toHaveLength(2);
  });

  it('rejects cross-domain, sibling-suffix, child-subdomain, and TLD cookie domains', async () => {
    const invalidDomains = [
      'google.com',
      '.google.com',
      'evil-example.com',
      'deep.sub.example.com',
      '.com',
    ];

    for (const domain of invalidDomains) {
      expect(() => buildCookieUrl('https://sub.example.com', domain)).toThrow(
        /Security Violation/,
      );
      await expect(
        service.setCookie('https://sub.example.com', {
          name: 'poison',
          value: 'evil',
          domain,
        }),
      ).rejects.toThrow(/Security Violation/);
    }

    expect(getMockCookies()).toHaveLength(0);
  });

  it('rejects cross-domain cookies during importJson without poisoning store', async () => {
    const payload = JSON.stringify([
      { name: 'valid_cookie', value: 'ok', domain: '.example.com' },
      { name: 'evil_cookie', value: 'hijack', domain: 'google.com' },
    ]);

    const result = await service.importJson('https://app.example.com', payload);
    expect(result).toEqual({ success: 1, failed: 1 });
    expect(getMockCookies().map((c) => c.name)).toEqual(['valid_cookie']);
  });
});

describe('MED-10: AsnLookupClient Global Consent Enforcement', () => {
  beforeEach(async () => {
    await consentManager.clearConsent();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await consentManager.clearConsent();
  });

  it('throws when targetOrigin is omitted and global ip-asn consent is not granted', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const client = new AsnLookupClient();

    await expect(client.lookup('8.8.8.8')).rejects.toThrow(
      'User consent required: external IP/ASN lookup blocked',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('allows lookup without targetOrigin once global ip-asn consent is granted and passes AbortSignal', async () => {
    await consentManager.setConsent('ip-asn', true);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          asn: 'AS15169',
          org: 'Google LLC',
          country_code: 'US',
          country_name: 'United States',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const client = new AsnLookupClient();
    const res = await client.lookup('8.8.8.8');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(res.asn).toBe(15169);
    expect(res.asOrganization).toBe('Google LLC');
  });
});
