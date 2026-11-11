import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Options / Settings Page Configuration', () => {
  it('manifest specifies options_ui with open_in_tab: true', () => {
    const manifestPath = path.resolve(__dirname, '../.output/chrome-mv3/manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifest.options_ui).toBeDefined();
      expect(manifest.options_ui.open_in_tab).toBe(true);
      expect(manifest.options_ui.page).toBe('options.html');
    }
  });

  it('options index.html contains manifest.open_in_tab metadata', () => {
    const indexPath = path.resolve(__dirname, '../entrypoints/options/index.html');
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain('name="manifest.open_in_tab"');
    expect(content).toContain('content="true"');
  });

  it('wxt.config.ts configures options_ui with open_in_tab: true', () => {
    const configPath = path.resolve(__dirname, '../wxt.config.ts');
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('open_in_tab: true');
  });
});

