/**
 * @file src/collectors/page/technology.collector.ts
 * @description Fingerprints web frameworks, CMS platforms, CDNs, and libraries through deterministic DOM signatures.
 */

import type { TechnologyData } from '../../types/inspection';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';

interface TechSignature {
  name: string;
  category: string;
  matches: (doc: Document) => { matched: boolean; version?: string; evidence: string; confidence: number };
}

const TECH_SIGNATURES: TechSignature[] = [
  // CMS
  {
    name: 'WordPress',
    category: 'CMS',
    matches: (doc) => {
      const generator = doc.querySelector('meta[name="generator" i]')?.getAttribute('content') || '';
      if (/wordpress/i.test(generator)) {
        const vMatch = generator.match(/wordpress\s*([\d.]+)/i);
        return { matched: true, version: vMatch ? vMatch[1] : undefined, evidence: `meta[generator]: ${generator}`, confidence: 1.0 };
      }
      if (doc.querySelector('link[href*="wp-content"], script[src*="wp-content"], link[rel*="wlwmanifest"]')) {
        return { matched: true, evidence: 'wp-content paths in assets', confidence: 0.95 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Shopify',
    category: 'Ecommerce',
    matches: (doc) => {
      if (doc.querySelector('script[src*="cdn.shopify.com"], link[href*="cdn.shopify.com"]')) {
        return { matched: true, evidence: 'cdn.shopify.com asset links', confidence: 0.95 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Webflow',
    category: 'CMS',
    matches: (doc) => {
      const generator = doc.querySelector('meta[name="generator" i]')?.getAttribute('content') || '';
      if (/webflow/i.test(generator)) {
        return { matched: true, evidence: `meta[generator]: ${generator}`, confidence: 1.0 };
      }
      if (doc.documentElement.getAttribute('data-wf-page') || doc.documentElement.getAttribute('data-wf-site')) {
        return { matched: true, evidence: 'data-wf-page attribute on <html>', confidence: 0.95 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Wix',
    category: 'CMS',
    matches: (doc) => {
      const generator = doc.querySelector('meta[name="generator" i]')?.getAttribute('content') || '';
      if (/wix/i.test(generator)) {
        return { matched: true, evidence: `meta[generator]: ${generator}`, confidence: 1.0 };
      }
      if (doc.querySelector('meta[name="X-Wix-Meta-Site-Id"], script[src*="static.parastorage.com"]')) {
        return { matched: true, evidence: 'static.parastorage.com or Wix meta headers', confidence: 0.95 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },

  // Frameworks
  {
    name: 'React',
    category: 'JavaScript Framework',
    matches: (doc) => {
      if (doc.querySelector('[data-reactroot], [data-reactid]')) {
        return { matched: true, evidence: 'data-reactroot attribute present', confidence: 0.95 };
      }
      if (doc.querySelector('script[id="__NEXT_DATA__"]')) {
        return { matched: true, evidence: 'Next.js React data layer', confidence: 0.9 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Next.js',
    category: 'Web Framework',
    matches: (doc) => {
      if (doc.querySelector('script[id="__NEXT_DATA__"]')) {
        return { matched: true, evidence: 'script#__NEXT_DATA__ presence', confidence: 1.0 };
      }
      if (doc.querySelector('link[href*="/_next/static/"], script[src*="/_next/static/"]')) {
        return { matched: true, evidence: '/_next/static/ asset directory', confidence: 0.95 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Vue.js',
    category: 'JavaScript Framework',
    matches: (doc) => {
      if (doc.querySelector('[data-v-]') || doc.querySelector('[data-server-rendered]')) {
        return { matched: true, evidence: 'Scoped CSS data-v-* or SSR attribute', confidence: 0.9 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Nuxt.js',
    category: 'Web Framework',
    matches: (doc) => {
      if (doc.querySelector('#__nuxt') || doc.querySelector('script[id="__NUXT_DATA__"]')) {
        return { matched: true, evidence: '#__nuxt mounting element or __NUXT_DATA__ script', confidence: 1.0 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Angular',
    category: 'JavaScript Framework',
    matches: (doc) => {
      const ngVersion = doc.querySelector('[ng-version]');
      if (ngVersion) {
        const v = ngVersion.getAttribute('ng-version') || undefined;
        return { matched: true, version: v, evidence: `ng-version attribute: ${v}`, confidence: 1.0 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Astro',
    category: 'Web Framework',
    matches: (doc) => {
      const generator = doc.querySelector('meta[name="generator" i]')?.getAttribute('content') || '';
      if (/astro/i.test(generator)) {
        const vMatch = generator.match(/astro\s*v?([\d.]+)/i);
        return { matched: true, version: vMatch ? vMatch[1] : undefined, evidence: `meta[generator]: ${generator}`, confidence: 1.0 };
      }
      if (doc.querySelector('style[data-astro-cid]')) {
        return { matched: true, evidence: 'data-astro-cid style attribute', confidence: 0.95 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },

  // CSS Frameworks
  {
    name: 'Tailwind CSS',
    category: 'CSS Framework',
    matches: (doc) => {
      if (doc.querySelector('[class*="flex"], [class*="grid"], [class*="text-"], [class*="bg-"]')) {
        const hasUtilities = doc.querySelector('[class*="max-w-"], [class*="mx-auto"], [class*="items-center"]');
        if (hasUtilities) {
          return { matched: true, evidence: 'Atomic utility class pattern matches', confidence: 0.85 };
        }
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Bootstrap',
    category: 'CSS Framework',
    matches: (doc) => {
      if (doc.querySelector('link[href*="bootstrap"]') || doc.querySelector('script[src*="bootstrap"]')) {
        return { matched: true, evidence: 'Bootstrap asset URLs', confidence: 0.95 };
      }
      if (doc.querySelector('.container-fluid, .row, [class*="col-md-"]')) {
        return { matched: true, evidence: 'Bootstrap grid system class patterns', confidence: 0.85 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },

  // CDNs
  {
    name: 'Cloudflare',
    category: 'CDN & Security',
    matches: (doc) => {
      if (doc.querySelector('script[src*="cloudflare.com"], script[src*="challenges.cloudflare.com"]')) {
        return { matched: true, evidence: 'Cloudflare script / Turnstile assets', confidence: 0.95 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
];

export class TechnologyCollector implements PageCollector<TechnologyData> {
  readonly id = 'technology';
  readonly name = 'Technology Fingerprinting Collector';

  collect(context: CollectorContext) {
    const doc = context.document;
    const technologies: TechnologyData['technologies'] = [];

    for (const sig of TECH_SIGNATURES) {
      try {
        const result = sig.matches(doc);
        if (result.matched) {
          technologies.push({
            name: sig.name,
            category: sig.category,
            version: result.version,
            confidence: result.confidence,
            evidence: result.evidence,
          });
        }
      } catch {
        // Individual signature evaluation failure contained
      }
    }

    const data: TechnologyData = {
      technologies,
    };

    return createCollectionResult<TechnologyData>({
      module: this.id,
      status: 'completed',
      data,
      coverage: {
        expected: 5,
        collected: 5,
        unavailable: 0,
        supported: true,
      },
      limitations: [
        'Technology detection is heuristic; heavily minified or custom builds may obscure signatures.',
        'Global window JavaScript variables are inaccessible inside content script isolated worlds.',
      ],
      sources: ['DOM:meta[name="generator"]', 'DOM:scripts', 'DOM:classes', 'DOM:attributes'],
    });
  }
}

export const technologyCollector = new TechnologyCollector();
