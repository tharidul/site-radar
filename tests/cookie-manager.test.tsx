import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  cookieService,
  setMockCookies,
  clearMockCookies,
  auditCookie,
  computeAuditSummary,
  buildCookieUrl,
  formatCookieLifetime,
} from '../src/services/cookie.service';
import { CookiesView } from '../entrypoints/popup/components/CookiesView';
import type { InspectedCookie } from '../src/types/cookies';

describe('CookieService and Cookie Security Inspector', () => {
  beforeEach(() => {
    clearMockCookies();
  });

  const sampleCookies: InspectedCookie[] = [
    {
      name: 'session_id',
      value: 'xyz123abc456',
      domain: 'example.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      session: true,
    },
    {
      name: 'tracking_id',
      value: 'track_9988',
      domain: 'example.com',
      path: '/',
      secure: false,
      httpOnly: false,
      sameSite: 'lax',
      session: false,
      expirationDate: Math.floor(Date.now() / 1000) + 86400 * 30,
    },
    {
      name: 'third_party_token',
      value: 'tok_000',
      domain: '.example.com',
      path: '/api',
      secure: false,
      httpOnly: false,
      sameSite: 'no_restriction',
      session: true,
    },
  ];

  it('buildCookieUrl creates correct target URLs for cookie operations', () => {
    expect(buildCookieUrl('https://example.com/page', 'example.com', '/api', true)).toBe(
      'https://example.com/api',
    );
    expect(buildCookieUrl('https://example.com/', '.sub.example.com', '/', true)).toBe(
      'https://sub.example.com/',
    );
  });

  it('auditCookie correctly identifies missing security flags', () => {
    const secureCookie = sampleCookies[0]!;
    const insecureCookie = sampleCookies[1]!;
    const sameSiteNoneCookie = sampleCookies[2]!;

    const secureAudit = auditCookie(secureCookie);
    expect(secureAudit.missingSecure).toBe(false);
    expect(secureAudit.missingHttpOnly).toBe(false);
    expect(secureAudit.sameSiteNoneInsecure).toBe(false);

    const insecureAudit = auditCookie(insecureCookie);
    expect(insecureAudit.missingSecure).toBe(true);
    expect(insecureAudit.missingHttpOnly).toBe(true);

    const thirdPartyAudit = auditCookie(sameSiteNoneCookie);
    expect(thirdPartyAudit.sameSiteNoneInsecure).toBe(true);
  });

  it('computeAuditSummary aggregates statistics properly', () => {
    const summary = computeAuditSummary(sampleCookies);
    expect(summary.total).toBe(3);
    expect(summary.sessionCount).toBe(2);
    expect(summary.persistentCount).toBe(1);
    expect(summary.missingSecureCount).toBe(2);
    expect(summary.missingHttpOnlyCount).toBe(2);
  });

  it('cookieService exports cookies to JSON and HTTP header formats', () => {
    const jsonStr = cookieService.exportJson(sampleCookies);
    expect(jsonStr).toContain('"session_id"');
    expect(jsonStr).toContain('"xyz123abc456"');

    const headerStr = cookieService.exportHeaderString(sampleCookies);
    expect(headerStr).toContain('session_id=xyz123abc456; tracking_id=track_9988; third_party_token=tok_000');
  });

  it('cookieService imports cookies from JSON correctly', async () => {
    const targetUrl = 'https://example.com/';
    const importPayload = JSON.stringify([
      {
        name: 'imported_token',
        value: 'val_123',
        domain: 'example.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        session: true,
      },
      {
        name: 'imported_cart',
        value: 'cart_item_4',
        domain: 'example.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'lax',
        session: true,
      },
    ]);

    const result = await cookieService.importJson(targetUrl, importPayload);
    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);

    const cookies = await cookieService.getCookies(targetUrl);
    expect(cookies.some((c) => c.name === 'imported_token')).toBe(true);
    expect(cookies.some((c) => c.name === 'imported_cart')).toBe(true);
  });

  it('cookieService sets and deletes cookies in mock store', async () => {
    const targetUrl = 'https://example.com/';
    await cookieService.setCookie(targetUrl, {
      name: 'auth_jwt',
      value: 'secret_jwt_string',
      domain: 'example.com',
      secure: true,
      httpOnly: true,
    });

    let list = await cookieService.getCookies(targetUrl);
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe('auth_jwt');
    expect(list[0]?.value).toBe('secret_jwt_string');

    await cookieService.deleteCookie(targetUrl, list[0]!);
    list = await cookieService.getCookies(targetUrl);
    expect(list.length).toBe(0);
  });

  it('formatCookieLifetime formats session, persistent, and expired lifetimes correctly', () => {
    const sessionRes = formatCookieLifetime({ session: true });
    expect(sessionRes.isSession).toBe(true);
    expect(sessionRes.isExpired).toBe(false);
    expect(sessionRes.label).toBe('Session');
    expect(sessionRes.relative).toBe('Until browser closes');

    const future7dSec = Math.floor(Date.now() / 1000) + 86400 * 7;
    const persistentRes = formatCookieLifetime({ session: false, expirationDate: future7dSec });
    expect(persistentRes.isSession).toBe(false);
    expect(persistentRes.isExpired).toBe(false);
    expect(persistentRes.label).toMatch(/^In (6|7)d$/);
    expect(persistentRes.fullDate).not.toBe('Until session ends');

    const future35dSec = Math.floor(Date.now() / 1000) + 86400 * 35;
    const persistent35dRes = formatCookieLifetime({ session: false, expirationDate: future35dSec });
    expect(persistent35dRes.label).toBe('In 1mo');

    const pastSec = Math.floor(Date.now() / 1000) - 7200;
    const expiredRes = formatCookieLifetime({ session: false, expirationDate: pastSec });
    expect(expiredRes.isSession).toBe(false);
    expect(expiredRes.isExpired).toBe(true);
    expect(expiredRes.label).toMatch(/^Expired \(2h ago\)$/);
  });

  it('CookiesView renders clean UI layout with search and actions', () => {
    setMockCookies(sampleCookies);
    const html = renderToString(<CookiesView targetUrl="https://example.com/" />);

    expect(html).toContain('Cookie Manager &amp; Inspector');
    expect(html).toContain('example.com');

    expect(html).toContain('Add Cookie');
    expect(html).toContain('Export');
    expect(html).toContain('Import');

    expect(html).toContain('Search cookies by name or value...');
    expect(html).toContain('Total');
    expect(html).toContain('Session');
    expect(html).toContain('Loading domain cookies...');
  });

  it('cookie Key and formatting supports accordion expand and collapse', () => {
    const cookie = sampleCookies[0]!;
    const cookieKey = `${cookie.name}-${cookie.domain}-${cookie.path}`;
    expect(cookieKey).toBe('session_id-example.com-/');

    const lifetime = formatCookieLifetime(cookie);
    expect(lifetime.label).toBe('Session');
  });
});

