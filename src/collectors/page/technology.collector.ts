
import type { DetectedTechnology, TechnologyData } from '../../types/inspection';
import { type CollectorContext, type PageCollector, createCollectionResult } from './types';
import { detectBackendFromDom } from './backend-signatures';

interface TechSignature {
  name: string;
  category: string;
  matches: (
    doc: Document,
    scripts: HTMLScriptElement[],
    links: HTMLLinkElement[],
    win?: Window,
  ) => { matched: boolean; version?: string; evidence: string; confidence: number };
}

const TECH_SIGNATURES: TechSignature[] = [
  {
    name: 'React',
    category: 'JavaScript Framework',
    matches: (doc, scripts, links, win) => {
      if (doc.querySelector('script[id="__NEXT_DATA__"]') || doc.querySelector('#__next')) {
        return { matched: true, evidence: 'Next.js application runtime (React-based)', confidence: 1.0 };
      }
      if (doc.querySelector('#___gatsby, div[id="gatsby-focus-wrapper"]')) {
        return { matched: true, evidence: 'Gatsby application root (React-based)', confidence: 1.0 };
      }

      for (const script of scripts) {
        const text = script.textContent || '';
        if (text.includes('self.__next_f') || text.includes('__next_f.push')) {
          return { matched: true, evidence: 'Next.js App Router RSC stream (React 18/19)', confidence: 1.0 };
        }
        if (text.includes('window.__remixContext') || text.includes('window.__remixManifest')) {
          return { matched: true, evidence: 'Remix application context (React-based)', confidence: 1.0 };
        }
      }

      if (doc.querySelector('[data-reactroot], [data-reactid], [data-react-helmet]')) {
        return { matched: true, evidence: 'React DOM attributes (data-reactroot / data-react-helmet)', confidence: 0.98 };
      }
      if (doc.querySelector('[data-radix-portal], [data-radix-popper-content-wrapper], [data-radix-collection-item]')) {
        return { matched: true, evidence: 'Radix UI primitive components (React)', confidence: 0.95 };
      }
      if (doc.querySelector('style[data-styled], style[data-emotion], style[data-styled-components]')) {
        return { matched: true, evidence: 'CSS-in-JS style tags (styled-components / Emotion for React)', confidence: 0.9 };
      }

      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (/(?:^|\/|[._-])react(?:[-._]dom)?(?:\.production|\.development)?(?:\.min)?\.js/i.test(src) ||
            src.includes('/react@') || src.includes('/react-dom@') || src.includes('/_next/static/chunks/framework-') ||
            src.includes('/_next/static/chunks/main-') || src.includes('static/js/main.') || src.includes('chunk-vendors.')) {
          const vMatch = src.match(/react(?:-dom)?@([\d.]+)/i);
          return { matched: true, version: vMatch ? vMatch[1] : undefined, evidence: `Script asset: ${src.split('/').pop()}`, confidence: 0.95 };
        }
      }

      for (const script of scripts) {
        const text = script.textContent || '';
        if (text.includes('__REACT_DEVTOOLS_GLOBAL_HOOK__') || text.includes('_reactRootContainer') ||
            text.includes('createRoot(') || text.includes('ReactDOM.render') || text.includes('react-dom') ||
            text.includes('react/jsx-runtime') || text.includes('jsx-runtime')) {
          return { matched: true, evidence: 'React runtime initialization patterns in inline script', confidence: 0.92 };
        }
      }

      const rootEl = doc.querySelector('#root, #__next');
      if (rootEl && rootEl.children.length > 0) {
        const hasModuleScripts = scripts.some((s) => s.type === 'module' || (s.src && s.src.includes('assets/')));
        if (hasModuleScripts) {
          return { matched: true, evidence: '#root mount container with client script bundle', confidence: 0.85 };
        }
      }

      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Next.js',
    category: 'Web Framework',
    matches: (doc, scripts, links) => {
      if (doc.querySelector('script[id="__NEXT_DATA__"]')) {
        return { matched: true, evidence: 'script#__NEXT_DATA__ presence (Pages Router)', confidence: 1.0 };
      }
      if (doc.querySelector('meta[name="next-head-count"]')) {
        return { matched: true, evidence: 'meta[name="next-head-count"] header tag', confidence: 1.0 };
      }
      if (doc.querySelector('#__next, #__next-build-watcher')) {
        return { matched: true, evidence: '#__next mounting container', confidence: 0.98 };
      }

      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('/_next/static/')) {
          return { matched: true, evidence: '/_next/static/ asset directory', confidence: 0.98 };
        }
        const text = script.textContent || '';
        if (text.includes('self.__next_f') || text.includes('__next_f.push')) {
          return { matched: true, evidence: 'Next.js App Router streaming payload (self.__next_f)', confidence: 1.0 };
        }
      }

      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (href.includes('/_next/static/')) {
          return { matched: true, evidence: '/_next/static/ stylesheet/preload asset', confidence: 0.95 };
        }
      }

      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Vue.js',
    category: 'JavaScript Framework',
    matches: (doc, scripts) => {
      if (doc.querySelector('[data-v-]') || doc.querySelector('style[data-v-]')) {
        return { matched: true, evidence: 'Scoped CSS data-v-* attributes (Vue Single File Components)', confidence: 0.98 };
      }
      if (doc.querySelector('[data-server-rendered]')) {
        return { matched: true, evidence: 'data-server-rendered SSR attribute (Vue / Nuxt)', confidence: 0.95 };
      }
      if (doc.querySelector('#__nuxt') || doc.querySelector('script[id="__NUXT_DATA__"]')) {
        return { matched: true, evidence: 'Nuxt.js Vue application container', confidence: 0.98 };
      }
      if (doc.querySelector('[v-cloak], [v-if], [v-for], [v-model]')) {
        return { matched: true, evidence: 'Vue template directives in DOM', confidence: 0.95 };
      }

      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (/(?:^|\/|[._-])vue(?:\.runtime|\.global)?(?:\.esm-browser)?(?:\.min)?\.js/i.test(src) || src.includes('/vue@')) {
          const vMatch = src.match(/vue@([\d.]+)/i);
          return { matched: true, version: vMatch ? vMatch[1] : undefined, evidence: `Vue script asset: ${src.split('/').pop()}`, confidence: 0.95 };
        }
        const text = script.textContent || '';
        if (text.includes('Vue.createApp') || text.includes('__VUE__') || text.includes('__VUE_OPTIONS_API__') || text.includes('__VUE_HMR_RUNTIME__')) {
          return { matched: true, evidence: 'Vue 3 runtime symbols in inline script', confidence: 0.95 };
        }
      }

      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Nuxt.js',
    category: 'Web Framework',
    matches: (doc, scripts, links) => {
      if (doc.querySelector('#__nuxt') || doc.querySelector('script[id="__NUXT_DATA__"]')) {
        return { matched: true, evidence: '#__nuxt element or __NUXT_DATA__ script', confidence: 1.0 };
      }
      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('/_nuxt/')) {
          return { matched: true, evidence: '/_nuxt/ asset directory', confidence: 0.98 };
        }
      }
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (href.includes('/_nuxt/')) {
          return { matched: true, evidence: '/_nuxt/ stylesheet link', confidence: 0.95 };
        }
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Svelte',
    category: 'JavaScript Framework',
    matches: (doc, scripts, links) => {
      if (doc.querySelector('[class*="svelte-"]')) {
        return { matched: true, evidence: 'Scoped svelte-* class name patterns on DOM elements', confidence: 0.98 };
      }
      if (doc.querySelector('div[id^="svelte-"]')) {
        return { matched: true, evidence: 'svelte-* mount id attribute', confidence: 0.95 };
      }
      if (doc.querySelector('script[data-sveltekit-hydrate]')) {
        return { matched: true, evidence: 'script[data-sveltekit-hydrate] SvelteKit tag', confidence: 1.0 };
      }

      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('/_app/immutable/') || src.includes('svelte-')) {
          return { matched: true, evidence: 'SvelteKit immutable asset directory (/_app/immutable/)', confidence: 0.98 };
        }
        const text = script.textContent || '';
        if (text.includes('__svelte') || text.includes('svelte-kit:')) {
          return { matched: true, evidence: 'SvelteKit hydration symbols in inline script', confidence: 0.95 };
        }
      }

      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (href.includes('/_app/immutable/')) {
          return { matched: true, evidence: 'SvelteKit immutable stylesheet link', confidence: 0.95 };
        }
      }

      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Angular',
    category: 'JavaScript Framework',
    matches: (doc, scripts) => {
      const ngVersion = doc.querySelector('[ng-version]');
      if (ngVersion) {
        const v = ngVersion.getAttribute('ng-version') || undefined;
        return { matched: true, version: v, evidence: `ng-version attribute: ${v}`, confidence: 1.0 };
      }
      if (doc.querySelector('app-root, [ng-app], [ng-controller], [ng-reflect-], [ng-model]')) {
        return { matched: true, evidence: 'Angular directive or <app-root> mount element', confidence: 0.95 };
      }
      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('angular') || src.includes('zone.js')) {
          return { matched: true, evidence: `Angular script asset: ${src.split('/').pop()}`, confidence: 0.9 };
        }
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Solid.js',
    category: 'JavaScript Framework',
    matches: (doc, scripts) => {
      if (doc.querySelector('[data-hk]')) {
        return { matched: true, evidence: 'data-hk hydration keys (Solid.js)', confidence: 0.98 };
      }
      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('solid-js') || src.includes('solid.js')) {
          return { matched: true, evidence: 'Solid.js library script', confidence: 0.95 };
        }
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Remix',
    category: 'Web Framework',
    matches: (doc, scripts, links) => {
      for (const script of scripts) {
        const text = script.textContent || '';
        if (text.includes('window.__remixContext') || text.includes('window.__remixManifest') || text.includes('window.__remixRouteModules')) {
          return { matched: true, evidence: 'Remix context payload in inline script', confidence: 1.0 };
        }
      }
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (/\/build\/manifest-[a-f0-9]+\.js/i.test(href)) {
          return { matched: true, evidence: 'Remix build manifest asset link', confidence: 0.95 };
        }
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Gatsby',
    category: 'Web Framework',
    matches: (doc, scripts) => {
      if (doc.querySelector('#___gatsby, div[id="gatsby-focus-wrapper"], script[id="gatsby-chunk-mapping"]')) {
        return { matched: true, evidence: '#___gatsby container element', confidence: 1.0 };
      }
      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('gatsby')) {
          return { matched: true, evidence: 'Gatsby script asset', confidence: 0.95 };
        }
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
      if (doc.querySelector('astro-island, [data-astro-cid], style[data-astro-cid], [data-astro-rerun]')) {
        return { matched: true, evidence: 'Astro island / component attributes in DOM', confidence: 0.98 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Alpine.js',
    category: 'JavaScript Framework',
    matches: (doc, scripts) => {
      if (doc.querySelector('[x-data], [x-init], [x-show], [x-bind], [x-on], [x-model], [x-text]')) {
        return { matched: true, evidence: 'Alpine.js x-* directives in DOM', confidence: 0.98 };
      }
      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('alpine') || src.includes('alpinejs')) {
          return { matched: true, evidence: 'Alpine.js script asset', confidence: 0.95 };
        }
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'HTMX',
    category: 'JavaScript Library',
    matches: (doc, scripts) => {
      if (doc.querySelector('[hx-get], [hx-post], [hx-target], [hx-trigger], [hx-swap], [hx-push-url], [hx-select]')) {
        return { matched: true, evidence: 'HTMX hx-* attributes in DOM', confidence: 1.0 };
      }
      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('htmx')) {
          const vMatch = src.match(/htmx(?:\.org)?@([\d.]+)/i);
          return { matched: true, version: vMatch ? vMatch[1] : undefined, evidence: 'HTMX script asset', confidence: 0.95 };
        }
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Preact',
    category: 'JavaScript Framework',
    matches: (doc, scripts) => {
      if (doc.querySelector('[data-preact]')) {
        return { matched: true, evidence: 'data-preact attribute', confidence: 0.95 };
      }
      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('preact')) {
          return { matched: true, evidence: 'Preact script asset', confidence: 0.95 };
        }
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Qwik',
    category: 'JavaScript Framework',
    matches: (doc) => {
      if (doc.querySelector('[q\\:container], [q\\:id], [q\\:key], script[type="qwik/json"]')) {
        return { matched: true, evidence: 'Qwik q:container / qwik/json script', confidence: 1.0 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'jQuery',
    category: 'JavaScript Library',
    matches: (doc, scripts) => {
      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (/(?:^|\/|[._-])jquery(?:[-._]([\d.]+))?(?:\.min)?\.js/i.test(src) || src.includes('/jquery/')) {
          const vMatch = src.match(/jquery[-._]([\d.]+)/i) || src.match(/jquery@([\d.]+)/i);
          return { matched: true, version: vMatch ? vMatch[1] : undefined, evidence: `jQuery asset: ${src.split('/').pop()}`, confidence: 0.95 };
        }
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Ember.js',
    category: 'JavaScript Framework',
    matches: (doc, scripts) => {
      if (doc.querySelector('[class*="ember-view"], div[id^="ember"]')) {
        return { matched: true, evidence: 'ember-view class name or id attribute', confidence: 0.95 };
      }
      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('ember')) {
          return { matched: true, evidence: 'Ember script asset', confidence: 0.9 };
        }
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },

  {
    name: 'Tailwind CSS',
    category: 'CSS Framework',
    matches: (doc, scripts, links) => {
      const hasLayout = doc.querySelector('[class*="flex"], [class*="grid"]');
      const hasSpacing = doc.querySelector('[class*="mx-auto"], [class*="p-"], [class*="gap-"]');
      const hasSizing = doc.querySelector('[class*="max-w-"], [class*="w-full"], [class*="h-"]');
      const hasStyling = doc.querySelector('[class*="rounded-"], [class*="shadow-"], [class*="bg-"]');
      if (hasLayout && hasSpacing && hasSizing && hasStyling) {
        return { matched: true, evidence: 'Atomic Tailwind utility class combinations across DOM nodes', confidence: 0.92 };
      }

      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (href.includes('tailwind')) {
          return { matched: true, evidence: `Tailwind stylesheet link: ${href.split('/').pop()}`, confidence: 0.95 };
        }
      }

      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Bootstrap',
    category: 'CSS Framework',
    matches: (doc, scripts, links) => {
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (href.includes('bootstrap')) {
          const vMatch = href.match(/bootstrap@?([\d.]+)/i);
          return { matched: true, version: vMatch ? vMatch[1] : undefined, evidence: `Bootstrap stylesheet: ${href.split('/').pop()}`, confidence: 0.98 };
        }
      }
      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('bootstrap')) {
          const vMatch = src.match(/bootstrap@?([\d.]+)/i);
          return { matched: true, version: vMatch ? vMatch[1] : undefined, evidence: `Bootstrap script: ${src.split('/').pop()}`, confidence: 0.98 };
        }
      }
      if (doc.querySelector('.container-fluid, .row, [class*="col-md-"], [class*="col-lg-"], .btn-primary')) {
        return { matched: true, evidence: 'Bootstrap grid system and component class patterns', confidence: 0.88 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Material UI (MUI)',
    category: 'UI Library',
    matches: (doc) => {
      if (doc.querySelector('[class*="MuiButton-"], [class*="MuiTypography-"], [class*="MuiBox-"], [class*="MuiGrid-"]')) {
        return { matched: true, evidence: 'MUI component class patterns (MuiButton / MuiTypography)', confidence: 0.95 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Chakra UI',
    category: 'UI Library',
    matches: (doc) => {
      if (doc.querySelector('[data-chakra-component], [class*="chakra-"]')) {
        return { matched: true, evidence: 'Chakra UI data attributes or class patterns', confidence: 0.95 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Ant Design',
    category: 'UI Library',
    matches: (doc) => {
      if (doc.querySelector('[class*="ant-btn"], [class*="ant-layout"], [class*="ant-row"]')) {
        return { matched: true, evidence: 'Ant Design component class patterns (ant-*)', confidence: 0.95 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },

  {
    name: 'WordPress',
    category: 'CMS',
    matches: (doc, scripts, links) => {
      const generator = doc.querySelector('meta[name="generator" i]')?.getAttribute('content') || '';
      if (/wordpress/i.test(generator)) {
        const vMatch = generator.match(/wordpress\s*([\d.]+)/i);
        return { matched: true, version: vMatch ? vMatch[1] : undefined, evidence: `meta[generator]: ${generator}`, confidence: 1.0 };
      }
      if (doc.querySelector('link[href*="wp-content"], script[src*="wp-content"], link[rel*="wlwmanifest"]')) {
        return { matched: true, evidence: 'wp-content paths in assets', confidence: 0.98 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Shopify',
    category: 'Ecommerce',
    matches: (doc, scripts, links) => {
      if (doc.querySelector('script[src*="cdn.shopify.com"], link[href*="cdn.shopify.com"], meta[name="shopify-digital-wallet"]')) {
        return { matched: true, evidence: 'cdn.shopify.com assets or Shopify meta tags', confidence: 0.98 };
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
        return { matched: true, evidence: 'data-wf-page attribute on <html>', confidence: 0.98 };
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
        return { matched: true, evidence: 'static.parastorage.com or Wix meta headers', confidence: 0.98 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Squarespace',
    category: 'CMS',
    matches: (doc) => {
      if (doc.querySelector('link[href*="squarespace.com"], script[src*="squarespace.com"], html[id*="collection-"]')) {
        return { matched: true, evidence: 'Squarespace CDN assets or collection markup', confidence: 0.95 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },
  {
    name: 'Ghost',
    category: 'CMS',
    matches: (doc) => {
      const generator = doc.querySelector('meta[name="generator" i]')?.getAttribute('content') || '';
      if (/ghost/i.test(generator)) {
        const vMatch = generator.match(/ghost\s*([\d.]+)/i);
        return { matched: true, version: vMatch ? vMatch[1] : undefined, evidence: `meta[generator]: ${generator}`, confidence: 1.0 };
      }
      if (doc.querySelector('script[src*="ghost.io"], link[href*="ghost.io"]')) {
        return { matched: true, evidence: 'Ghost portal assets', confidence: 0.95 };
      }
      return { matched: false, evidence: '', confidence: 0 };
    },
  },

  {
    name: 'Cloudflare',
    category: 'CDN & Security',
    matches: (doc, scripts) => {
      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('cloudflare.com') || src.includes('challenges.cloudflare.com')) {
          return { matched: true, evidence: 'Cloudflare script / Turnstile assets', confidence: 0.98 };
        }
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
    const scripts = Array.from(doc.querySelectorAll('script'));
    const links = Array.from(doc.querySelectorAll('link'));
    const win = context.window;

    const detectedMap = new Map<string, DetectedTechnology>();

    const mainWorldTech = (context.options?.mainWorldTech as DetectedTechnology[]) || [];
    if (Array.isArray(mainWorldTech)) {
      for (const t of mainWorldTech) {
        if (t && t.name) {
          detectedMap.set(t.name.toLowerCase(), t);
        }
      }
    }

    for (const sig of TECH_SIGNATURES) {
      try {
        const result = sig.matches(doc, scripts, links, win);
        if (result.matched) {
          const key = sig.name.toLowerCase();
          const existing = detectedMap.get(key);
          if (!existing || result.confidence > existing.confidence || (result.version && !existing.version)) {
            detectedMap.set(key, {
              name: sig.name,
              category: sig.category,
              version: result.version || existing?.version,
              confidence: Math.max(result.confidence, existing?.confidence || 0),
              evidence: result.evidence || existing?.evidence || 'DOM signature',
            });
          }
        }
      } catch {
      }
    }

    try {
      const backendDomTech = detectBackendFromDom(doc, win);
      for (const b of backendDomTech) {
        const key = b.name.toLowerCase();
        const existing = detectedMap.get(key);
        if (!existing || b.confidence > existing.confidence) {
          detectedMap.set(key, b);
        }
      }
    } catch {
    }

    if (detectedMap.has('next.js') || detectedMap.has('remix') || detectedMap.has('gatsby')) {
      if (!detectedMap.has('react')) {
        const framework = detectedMap.get('next.js') ? 'Next.js' : detectedMap.get('remix') ? 'Remix' : 'Gatsby';
        detectedMap.set('react', {
          name: 'React',
          category: 'JavaScript Framework',
          confidence: 0.98,
          evidence: `Implied dependency of ${framework}`,
        });
      }
    }

    if (detectedMap.has('nuxt.js') && !detectedMap.has('vue.js')) {
      detectedMap.set('vue.js', {
        name: 'Vue.js',
        category: 'JavaScript Framework',
        confidence: 0.98,
        evidence: 'Implied dependency of Nuxt.js',
      });
    }

    const technologies = Array.from(detectedMap.values());
    const categoriesFound = Array.from(new Set(technologies.map((t) => t.category)));

    const data: TechnologyData = {
      technologies,
      categoriesFound,
    };

    return createCollectionResult<TechnologyData>({
      module: this.id,
      status: 'completed',
      data,
      coverage: {
        expected: 5,
        collected: technologies.length,
        unavailable: 0,
        supported: true,
      },
      limitations: [
        'Technology detection is heuristic; heavily obfuscated custom builds may omit public signatures.',
      ],
      sources: [
        'DOM:meta[name="generator"]',
        'DOM:scripts[src]',
        'DOM:inline-scripts',
        'DOM:classes',
        'DOM:attributes',
        'MainWorld:globals',
      ],
    });
  }
}

export const technologyCollector = new TechnologyCollector();
