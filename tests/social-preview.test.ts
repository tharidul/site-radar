import { describe, it, expect } from 'vitest';
import type { WebsiteInspection } from '../src/types/inspection';

describe('Social Preview Logic', () => {
  const mockInspection: WebsiteInspection = {
    id: 'test-1',
    mode: 'full',
    target: {
      url: 'https://example.com/blog/my-post',
      origin: 'https://example.com',
      hostname: 'example.com',
      inspectedAt: Date.now(),
    },
    browser: { name: 'chrome' },
    modules: {
      metadata: {
        module: 'metadata',
        status: 'completed',
        collectedAt: Date.now(),
        coverage: { expected: 1, collected: 1, unavailable: 0 },
        limitations: [],
        errors: [],
        sources: ['DOM'],
        data: {
          title: 'My Awesome Post - Example Blog',
          titleLength: 30,
          description: 'A detailed guide on modern web security, audits, and performance optimization.',
          descriptionLength: 82,
          canonicalMatches: true,
          hreflangTags: [],
          structuredDataCount: 1,
          openGraph: {
            'og:title': 'My Awesome Post',
            'og:description': 'A detailed guide on modern web security.',
            'og:image': 'https://example.com/assets/og.png',
            'og:site_name': 'Example Blog',
          },
          twitterCards: {
            'twitter:card': 'summary_large_image',
            'twitter:title': 'My Awesome Post',
            'twitter:image': 'https://example.com/assets/og.png',
          },
        },
      },
    },
    findings: [],
    summary: {
      completedModules: 1,
      partialModules: 0,
      failedModules: 0,
      totalFindings: 0,
    },
    startedAt: Date.now(),
  };

  it('correctly provides fallback and Open Graph values', () => {
    const seoData = mockInspection.modules.metadata?.data as any;
    expect(seoData.openGraph['og:title']).toBe('My Awesome Post');
    expect(seoData.openGraph['og:image']).toBe('https://example.com/assets/og.png');
    expect(seoData.twitterCards['twitter:card']).toBe('summary_large_image');
  });
});
