import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';
import path from 'path';

export default defineConfig({
  plugins: [WxtVitest()],
  resolve: {
    alias: {
      '@/security': path.resolve(import.meta.dirname, './src/security'),
      '@/browser': path.resolve(import.meta.dirname, './src/browser'),
      '@/messaging': path.resolve(import.meta.dirname, './src/messaging'),
      '@/types': path.resolve(import.meta.dirname, './src/types'),
      '@/core': path.resolve(import.meta.dirname, './src/core'),
      '@/collectors': path.resolve(import.meta.dirname, './src/collectors'),
      '@/analyzers': path.resolve(import.meta.dirname, './src/analyzers'),
      '@/scoring': path.resolve(import.meta.dirname, './src/scoring'),
      '@/crawler': path.resolve(import.meta.dirname, './src/crawler'),
      '@/intelligence': path.resolve(import.meta.dirname, './src/intelligence'),
      '@/export': path.resolve(import.meta.dirname, './src/export'),
      '@/exporters': path.resolve(import.meta.dirname, './src/exporters'),
      '@/services': path.resolve(import.meta.dirname, './src/services'),
      '@/utils': path.resolve(import.meta.dirname, './src/utils'),
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: {
        settings: {
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
    globals: true,
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
    ],
  },
});
