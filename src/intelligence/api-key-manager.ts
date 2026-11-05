/**
 * @file src/intelligence/api-key-manager.ts
 * @description Transient, in-memory session API key manager.
 * Strictly guarantees zero persistence to disk, zero telemetry, and zero key leakage in reports or exports.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 6.3, 14, Feature 39.
 */

import type { ApiKeyConfig } from '@/types/intelligence';

export class ApiKeyManager {
  private keyStore = new Map<string, ApiKeyConfig>();

  /**
   * Sets or updates an optional third-party API key in session memory.
   */
  setKey(provider: string, key: string, isSessionOnly = true): void {
    if (!key || typeof key !== 'string') {
      throw new Error('API key must be a non-empty string');
    }
    const cleanProvider = provider.toLowerCase().trim();
    this.keyStore.set(cleanProvider, {
      provider: cleanProvider,
      key: key.trim(),
      isSessionOnly,
      setAt: Date.now(),
    });
  }

  /**
   * Retrieves an API key for the specified provider from active session memory.
   */
  getKey(provider: string): string | undefined {
    return this.keyStore.get(provider.toLowerCase().trim())?.key;
  }

  /**
   * Checks whether an API key is configured for the given provider.
   */
  hasKey(provider: string): boolean {
    return this.keyStore.has(provider.toLowerCase().trim());
  }

  /**
   * Removes a configured API key from memory immediately.
   */
  removeKey(provider: string): boolean {
    return this.keyStore.delete(provider.toLowerCase().trim());
  }

  /**
   * Clears all configured API keys from memory immediately.
   */
  clearAllKeys(): void {
    this.keyStore.clear();
  }

  /**
   * Lists the names of providers currently configured with an API key.
   */
  getConfiguredProviders(): string[] {
    return Array.from(this.keyStore.keys());
  }

  /**
   * Lists non-sensitive metadata for configured providers without exposing secret keys.
   */
  listConfiguredProviders(): Array<{ provider: string; setAt: number; isSessionOnly: boolean }> {
    return Array.from(this.keyStore.values()).map((cfg) => ({
      provider: cfg.provider,
      setAt: cfg.setAt,
      isSessionOnly: cfg.isSessionOnly,
    }));
  }

  /**
   * Custom serializer preventing secret keys from ever leaking during JSON serialization.
   */
  toJSON(): Record<string, unknown> {
    return {
      configuredProviders: Array.from(this.keyStore.keys()),
    };
  }
}

export const apiKeyManager = new ApiKeyManager();
