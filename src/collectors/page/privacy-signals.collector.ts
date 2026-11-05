/**
 * @file src/collectors/page/privacy-signals.collector.ts
 * @description Detects consent management platforms (CMPs), privacy policy links, third-party tracker domains, and storage API usage.
 */

import type { PrivacySignalsData } from '../../types/inspection';
import { redactSecretsFromString } from '../../security/secret-redactor';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

const KNOWN_TRACKER_PATTERNS = [
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'connect.facebook.net',
  'hotjar.com',
  'clarity.ms',
  'tiktok.com/analytics',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'segment.com',
  'segment.io',
  'mixpanel.com',
  'crazyegg.com',
  'doubleclick.net',
  'adsymptotic.com',
  'quantserve.com',
  'scorecardresearch.com',
  'adnxs.com',
];

const KNOWN_CMPS: Array<{ name: string; selectors: string[] }> = [
  { name: 'OneTrust', selectors: ['#onetrust-consent-sdk', '.onetrust-pc-dark', '#onetrust-banner-sdk'] },
  { name: 'Cookiebot', selectors: ['#CybotCookiebotDialog', '#CookiebotWidget', 'script[src*="cookiebot.com"]'] },
  { name: 'Complianz', selectors: ['.cmplz-cookiebanner', '#cmplz-cookiebanner', 'script[src*="complianz"]'] },
  { name: 'Usercentrics', selectors: ['#usercentrics-root', 'script[src*="usercentrics.eu"]'] },
  { name: 'Quantcast Choice', selectors: ['.qc-cmp2-container', '#qc-cmp2-ui'] },
  { name: 'Iubenda', selectors: ['.iubenda-cs-banner', '#iubenda-cs-banner'] },
  { name: 'Didomi', selectors: ['#didomi-host', '.didomi-popup-container'] },
  { name: 'Klaro', selectors: ['.klaro', '#klaro'] },
  { name: 'Termly', selectors: ['script[src*="termly.io"]', '.termly-cookie-preference-button'] },
  { name: 'TrustArc', selectors: ['#truste-consent-track', '#consent_blackbar'] },
  { name: 'Axeptio', selectors: ['#axeptio_overlay', 'script[src*="axept.io"]'] },
];

export class PrivacySignalsCollector implements PageCollector<PrivacySignalsData> {
  readonly id = 'privacySignals';
  readonly name = 'Privacy & Tracker Signals Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const win = context.window || (doc.defaultView as Window | null);
    const pageUrl = doc.location?.href || context.url || '';

    // 1. Consent Management Platform (CMP) detection
    let consentBannerDetected = false;

    for (const cmp of KNOWN_CMPS) {
      for (const selector of cmp.selectors) {
        if (doc.querySelector(selector)) {
          consentBannerDetected = true;
          break;
        }
      }
      if (consentBannerDetected) break;
    }

    if (!consentBannerDetected) {
      const genericNotice = doc.querySelector(
        '[id*="cookie" i], [class*="cookie-banner" i], [class*="cookie-notice" i], [class*="cookie-consent" i], [aria-label*="cookie" i]',
      );
      if (genericNotice) {
        consentBannerDetected = true;
      }
    }

    // 2. Privacy Policy Links
    const privacyPolicyLinks: string[] = [];
    const privacyCandidates = doc.querySelectorAll('a[href]');
    privacyCandidates.forEach((a) => {
      const href = a.getAttribute('href') || '';
      const text = (a.textContent || '').toLowerCase();
      const lowerHref = href.toLowerCase();

      if (
        lowerHref.includes('privacy') ||
        lowerHref.includes('datenschutz') ||
        lowerHref.includes('politique-de-confidentialite') ||
        text.includes('privacy policy') ||
        text.includes('datenschutz')
      ) {
        try {
          const resolved = new URL(href, pageUrl || 'http://localhost');
          resolved.username = '';
          resolved.password = '';
          const cleanUrl = resolved.toString();
          if (!privacyPolicyLinks.includes(cleanUrl) && privacyPolicyLinks.length < 5) {
            privacyPolicyLinks.push(cleanUrl);
          }
        } catch {
          const clean = redactSecretsFromString(href);
          if (!privacyPolicyLinks.includes(clean) && privacyPolicyLinks.length < 5) {
            privacyPolicyLinks.push(clean);
          }
        }
      }
    });

    // 3. Third-Party Tracker Identification
    let pageHostname = '';
    try {
      pageHostname = new URL(pageUrl || 'http://localhost').hostname.toLowerCase();
    } catch {}

    const basePageDomain = pageHostname.replace(/^www\./, '');

    const trackersFound = new Set<string>();
    const scriptSrcs = doc.querySelectorAll('script[src], iframe[src]');
    scriptSrcs.forEach((el) => {
      const src = (el.getAttribute('src') || '').toLowerCase();
      for (const pattern of KNOWN_TRACKER_PATTERNS) {
        if (src.includes(pattern)) {
          // Verify it is genuinely third-party relative to inspected page
          const isFirstParty =
            (basePageDomain && pattern.includes(basePageDomain)) ||
            (basePageDomain.includes('google.') && (pattern.includes('google') || pattern.includes('doubleclick')));
          if (!isFirstParty) {
            trackersFound.add(pattern);
          }
          break;
        }
      }
    });

    // 4. Storage API Detection (ZERO VALUE COLLECTION GUARANTEE)
    const storageTypesUsed: string[] = [];
    if (win) {
      try {
        if (win.localStorage && win.localStorage.length > 0) {
          storageTypesUsed.push('localStorage');
        }
      } catch {
        // Storage access blocked
      }

      try {
        if (win.sessionStorage && win.sessionStorage.length > 0) {
          storageTypesUsed.push('sessionStorage');
        }
      } catch {
        // Storage access blocked
      }

      try {
        if (win.indexedDB) {
          storageTypesUsed.push('indexedDB');
        }
      } catch {
        // IndexedDB unavailable
      }
    }

    try {
      if (doc.cookie && doc.cookie.length > 0) {
        storageTypesUsed.push('cookies');
      }
    } catch {
      // Cookie access blocked
    }

    const thirdPartyTrackers = Array.from(trackersFound);

    const data: PrivacySignalsData = {
      consentBannerDetected,
      privacyPolicyLinks,
      thirdPartyTrackers,
      storageTypesUsed,
    };

    return createCollectionResult<PrivacySignalsData>({
      module: this.id,
      status: 'completed',
      data,
      coverage: {
        expected: 4,
        collected: 4,
        unavailable: 0,
        supported: true,
      },
      limitations: [
        'Server-side tracking and first-party CNAME cloaked trackers cannot be detected via DOM inspection.',
        'Storage inspection records existence only; cookie strings and storage values are NEVER collected or stored.',
      ],
      sources: ['DOM:CMP-selectors', 'DOM:a[href*="privacy"]', 'DOM:script[src]', 'Storage:existence'],
    });
  }
}

export const privacySignalsCollector = new PrivacySignalsCollector();
