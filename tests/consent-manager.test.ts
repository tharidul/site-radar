import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConsentManager,
  CONSENT_STORAGE_KEY,
  ORIGIN_CONSENT_STORAGE_KEY,
} from '../src/intelligence/consent-manager';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';

describe('ConsentManager Persistence & Hydration (HIGH-05)', () => {
  let adapter: MockBrowserAdapter;
  let manager: ConsentManager;

  beforeEach(() => {
    adapter = new MockBrowserAdapter();
    manager = new ConsentManager(adapter);
  });

  it('persists global provider consent to local storage and hydrates across SW restart', async () => {
    await manager.setConsent('doh', true);
    await manager.setConsent('crt-sh', true);

    const raw = await adapter.getStorage([CONSENT_STORAGE_KEY], 'local');
    expect(raw[CONSENT_STORAGE_KEY]).toMatchObject({
      doh: true,
      'ip-asn': false,
      'crt-sh': true,
      tls: false,
      reputation: false,
    });

    // Simulate MV3 service worker restart with fresh ConsentManager instance sharing storage
    const freshManager = new ConsentManager(adapter);
    expect(freshManager.isLoaded()).toBe(false);
    expect(freshManager.hasConsent('doh')).toBe(false);

    await freshManager.ensureLoaded();
    expect(freshManager.isLoaded()).toBe(true);
    expect(freshManager.hasConsent('doh')).toBe(true);
    expect(freshManager.hasConsent('crt-sh')).toBe(true);
    expect(freshManager.hasConsent('ip-asn')).toBe(false);
    expect(freshManager.hasConsent('https://example.com', 'doh')).toBe(true);
  });

  it('persists per-origin consent overrides and restores them on ensureLoaded', async () => {
    await manager.setConsent('https://example.com', { doh: true, tls: true });

    const raw = await adapter.getStorage([ORIGIN_CONSENT_STORAGE_KEY], 'local');
    expect(raw[ORIGIN_CONSENT_STORAGE_KEY]).toMatchObject({
      'https://example.com': {
        doh: true,
        tls: true,
        'ip-asn': false,
        'crt-sh': false,
        reputation: false,
      },
    });

    const freshManager = new ConsentManager(adapter);
    await freshManager.ensureLoaded();

    expect(freshManager.hasConsent('https://example.com', 'doh')).toBe(true);
    expect(freshManager.hasConsent('https://example.com', 'tls')).toBe(true);
    expect(freshManager.hasConsent('https://other.example', 'doh')).toBe(false);
  });

  it('preserves previously persisted providers when setConsent is called before ensureLoaded on cold boot', async () => {
    await manager.setConsent('ip-asn', true);

    const coldManager = new ConsentManager(adapter);
    // Immediate synchronous update is visible right away and does not clobber ip-asn
    const writePromise = coldManager.setConsent('doh', true);
    expect(coldManager.hasConsent('doh')).toBe(true);
    await writePromise;

    expect(coldManager.hasConsent('ip-asn')).toBe(true);
    expect(coldManager.hasConsent('doh')).toBe(true);

    const verifiedManager = new ConsentManager(adapter);
    await verifiedManager.ensureLoaded();
    expect(verifiedManager.hasConsent('ip-asn')).toBe(true);
    expect(verifiedManager.hasConsent('doh')).toBe(true);
  });

  it('persists revokeConsent(origin) and clearConsent() / revokeConsent()', async () => {
    await manager.setConsent('doh', true);
    await manager.setConsent('https://example.com', { tls: true });
    await manager.setConsent('https://keep.example', { 'crt-sh': true });

    await manager.revokeConsent('https://example.com');

    const afterOriginRevoke = new ConsentManager(adapter);
    await afterOriginRevoke.ensureLoaded();
    expect(afterOriginRevoke.hasConsent('doh')).toBe(true);
    expect(afterOriginRevoke.hasConsent('https://example.com', 'tls')).toBe(false);
    expect(afterOriginRevoke.hasConsent('https://keep.example', 'crt-sh')).toBe(true);

    await afterOriginRevoke.clearConsent();

    const afterClear = new ConsentManager(adapter);
    await afterClear.ensureLoaded();
    expect(afterClear.hasConsent('doh')).toBe(false);
    expect(afterClear.hasConsent('https://keep.example', 'crt-sh')).toBe(false);
    expect(() => afterClear.assertConsent('https://keep.example', 'crt-sh')).toThrow(
      /User consent required/,
    );
  });

  it('deduplicates concurrent ensureLoaded calls', async () => {
    await manager.setConsent('tls', true);

    const freshManager = new ConsentManager(adapter);
    await Promise.all([
      freshManager.ensureLoaded(),
      freshManager.ensureLoaded(),
      freshManager.loadConsent(),
    ]);

    expect(freshManager.isLoaded()).toBe(true);
    expect(freshManager.hasConsent('tls')).toBe(true);
  });
});
