import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@/types': path.resolve(__dirname, './src/types'),
        '@/security': path.resolve(__dirname, './src/security'),
        '@/collectors': path.resolve(__dirname, './src/collectors'),
        '@/analyzers': path.resolve(__dirname, './src/analyzers'),
        '@/scoring': path.resolve(__dirname, './src/scoring'),
        '@/core': path.resolve(__dirname, './src/core'),
        '@/browser': path.resolve(__dirname, './src/browser'),
        '@/messaging': path.resolve(__dirname, './src/messaging'),
        '@/services': path.resolve(__dirname, './src/services'),
        '@/utils': path.resolve(__dirname, './src/utils'),
      },
    },
  }),
  manifest: (env) => ({
    name: 'SiteRadar',
    description: 'Evidence-based website technical inspection, security auditing, and accessibility analysis.',
    version: '0.2.0',
    permissions: [
      'activeTab',
      'tabs',
      'scripting',
      'storage',
      'cookies',
      'contextMenus',
    ],
    host_permissions: [
      '*://*/*',
    ],
    ...(env.browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'siteradar@local.audit',
          strict_min_version: '109.0',
          data_collection_permissions: {
            required: ['none'],
          },
        },
      },
    }),
  }),
});
