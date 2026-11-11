import { describe, it, expect } from 'vitest';
import { technologyCollector } from '../src/collectors/page/technology.collector';

describe('TechnologyCollector - Tailwind CSS detection', () => {
  it('does not falsely detect Tailwind on generic HTML with flex/grid/p- classes', () => {
    // Simulated DOM resembling Amazon: generic utility or BEM-like classes
    document.body.innerHTML = `
      <header class="nav-flex nav-p-header">
        <div class="shop-grid top-p-search"></div>
        <div class="max-w-banner a-button-inner bg-dark"></div>
      </header>
    `;

    const context = {
      document,
      window,
      url: 'https://www.amazon.com',
      mode: 'deep' as const,
    };

    const result = technologyCollector.collect(context);
    const tailwind = result.data?.technologies.find((t) => t.name.toLowerCase().includes('tailwind'));
    expect(tailwind).toBeUndefined();
  });

  it('correctly detects Tailwind when variant modifiers or root variables exist', () => {
    document.body.innerHTML = `
      <div class="flex flex-col items-center justify-between p-4 rounded-lg bg-blue-500 hover:bg-blue-600 sm:p-6 dark:text-white">
        Content
      </div>
    `;

    const context = {
      document,
      window,
      url: 'https://example.com',
      mode: 'deep' as const,
    };

    const result = technologyCollector.collect(context);
    const tailwind = result.data?.technologies.find((t) => t.name.toLowerCase().includes('tailwind'));
    expect(tailwind).toBeDefined();
    expect(tailwind?.category).toBe('CSS Framework');
  });

  it('does not falsely detect Bootstrap on scripts like dotcom-bootstrap.js', () => {
    document.body.innerHTML = `
      <script src="https://static.files.bbci.co.uk/ws/simorgh-assets/public/news/dotcom-bootstrap.js"></script>
    `;

    const context = {
      document,
      window,
      url: 'https://www.bbc.com',
      mode: 'deep' as const,
    };

    const result = technologyCollector.collect(context);
    const bootstrap = result.data?.technologies.find((t) => t.name.toLowerCase().includes('bootstrap'));
    expect(bootstrap).toBeUndefined();
  });

  it('correctly detects authentic Bootstrap scripts and stylesheets with versions', () => {
    document.body.innerHTML = `
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    `;

    const context = {
      document,
      window,
      url: 'https://example.com',
      mode: 'deep' as const,
    };

    const result = technologyCollector.collect(context);
    const bootstrap = result.data?.technologies.find((t) => t.name.toLowerCase().includes('bootstrap'));
    expect(bootstrap).toBeDefined();
    expect(bootstrap?.version).toBe('5.3.3');
  });
});
