
import {
  type ProtocolChannel,
  type MessageProtocol,
  type MessageEnvelope,
  type ResponseEnvelope,
} from '../types/messaging';
import { getBrowserAdapter, type BrowserAdapter } from '../browser/adapters';

declare const browser: any;

export interface MessageListenerOptions {
  requireInternalSender?: boolean;
}

interface ListenerEntry {
  handler: (payload: any, sender: chrome.runtime.MessageSender) => any;
  requireInternalSender: boolean;
}

const INTERNAL_EXTENSION_TAB_PATHS = new Set([
  '/options.html',
  '/popup.html',
  '/sidepanel.html',
]);

function getExtensionRuntime(): any {
  const runtimeBrowser =
    (globalThis as any).browser ?? (typeof browser !== 'undefined' ? browser : undefined);
  const runtimeChrome =
    (globalThis as any).chrome ?? (typeof chrome !== 'undefined' ? chrome : undefined);

  if (runtimeBrowser?.runtime?.id) {
    try {
      const baseUrl =
        typeof runtimeBrowser.runtime.getURL === 'function' ? runtimeBrowser.runtime.getURL('') : '';
      if (typeof baseUrl === 'string' && baseUrl.startsWith('moz-extension://')) {
        return runtimeBrowser.runtime;
      }
    } catch {
      // Ignore getURL errors in mocked contexts
    }
    if (!runtimeChrome?.runtime?.id) {
      return runtimeBrowser.runtime;
    }
  }

  return runtimeChrome?.runtime ?? runtimeBrowser?.runtime;
}

function parseExtensionUrl(rawUrl: string): { origin: string; pathname: string } | null {
  try {
    const parsed = new URL(rawUrl);
    if (
      (parsed.protocol !== 'chrome-extension:' && parsed.protocol !== 'moz-extension:') ||
      !parsed.host
    ) {
      return null;
    }
    return {
      origin: `${parsed.protocol}//${parsed.host}`,
      pathname: parsed.pathname,
    };
  } catch {
    return null;
  }
}

function resolveExtensionOrigin(runtime: any): string | null {
  if (typeof runtime?.getURL === 'function') {
    try {
      const base = runtime.getURL('');
      if (typeof base === 'string' && base.length > 0) {
        const parsed = parseExtensionUrl(base);
        if (parsed) {
          return parsed.origin;
        }
      }
    } catch {
      // Ignore getURL errors in mocked/restricted contexts
    }
  }
  if (runtime?.id) {
    return `chrome-extension://${runtime.id}`;
  }
  return null;
}

/**
 * Validates that an incoming runtime message originated from an internal
 * extension context (e.g. popup, sidepanel, options, or background page)
 * rather than an injected content script or external page.
 */
export function isInternalExtensionSender(
  sender?: chrome.runtime.MessageSender | null,
): boolean {
  const runtime = getExtensionRuntime();
  if (!sender || !runtime?.id) {
    return false;
  }
  if (sender.id !== runtime.id) {
    return false;
  }

  const extensionOrigin = resolveExtensionOrigin(runtime);
  if (!extensionOrigin || typeof sender.url !== 'string') {
    return false;
  }

  const parsedSenderUrl = parseExtensionUrl(sender.url);
  if (!parsedSenderUrl || parsedSenderUrl.origin !== extensionOrigin) {
    return false;
  }

  if (sender.tab !== undefined) {
    if (sender.frameId !== 0 || !INTERNAL_EXTENSION_TAB_PATHS.has(parsedSenderUrl.pathname)) {
      return false;
    }
    if (typeof sender.tab.url === 'string') {
      const parsedTabUrl = parseExtensionUrl(sender.tab.url);
      if (!parsedTabUrl || parsedTabUrl.origin !== extensionOrigin) {
        return false;
      }
    }
  }

  return true;
}

export interface IMessageBus {
  sendToBackground<C extends ProtocolChannel>(
    channel: C,
    payload: MessageProtocol[C]['request'],
  ): Promise<MessageProtocol[C]['response']>;

  sendToTab<C extends ProtocolChannel>(
    tabId: number,
    channel: C,
    payload: MessageProtocol[C]['request'],
  ): Promise<MessageProtocol[C]['response']>;

  onMessage<C extends ProtocolChannel>(
    channel: C,
    handler: (
      payload: MessageProtocol[C]['request'],
      sender: chrome.runtime.MessageSender,
    ) => Promise<MessageProtocol[C]['response']> | MessageProtocol[C]['response'],
    options?: MessageListenerOptions,
  ): () => void;
}

export class ExtensionMessageBus implements IMessageBus {
  private adapter?: BrowserAdapter;
  private localListeners = new Map<ProtocolChannel, Set<ListenerEntry>>();
  private runtimeListenerAttached = false;

  constructor(adapter?: BrowserAdapter) {
    this.adapter = adapter;
  }

  private getActiveAdapter(): BrowserAdapter {
    return this.adapter || getBrowserAdapter();
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  async sendToBackground<C extends ProtocolChannel>(
    channel: C,
    payload: MessageProtocol[C]['request'],
  ): Promise<MessageProtocol[C]['response']> {
    const envelope: MessageEnvelope<C> = {
      id: this.generateId(),
      type: channel,
      payload: payload as any,
      timestamp: Date.now(),
    };

    const adapter = this.getActiveAdapter();
    if (adapter.browserType === 'mock' && this.localListeners.has(channel)) {
      return this.dispatchLocally(channel, payload);
    }
    const response = await adapter.sendMessage<MessageEnvelope<C>, ResponseEnvelope<MessageProtocol[C]['response']>>(
      envelope,
    );

    if (response && typeof response === 'object' && 'success' in response) {
      if (response.success) {
        return response.data as MessageProtocol[C]['response'];
      }
      throw new Error(response.error || 'Operation failed');
    }

    return response as unknown as MessageProtocol[C]['response'];
  }

  async sendToTab<C extends ProtocolChannel>(
    tabId: number,
    channel: C,
    payload: MessageProtocol[C]['request'],
  ): Promise<MessageProtocol[C]['response']> {
    const envelope: MessageEnvelope<C> = {
      id: this.generateId(),
      type: channel,
      payload: payload as any,
      timestamp: Date.now(),
    };

    const adapter = this.getActiveAdapter();
    if (adapter.browserType === 'mock' && this.localListeners.has(channel)) {
      return this.dispatchLocally(channel, payload);
    }
    const response = await adapter.sendTabMessage<MessageEnvelope<C>, ResponseEnvelope<MessageProtocol[C]['response']>>(
      tabId,
      envelope,
    );

    if (response && typeof response === 'object' && 'success' in response) {
      if (response.success) {
        return response.data as MessageProtocol[C]['response'];
      }
      throw new Error(response.error || 'Operation failed');
    }

    return response as unknown as MessageProtocol[C]['response'];
  }

  onMessage<C extends ProtocolChannel>(
    channel: C,
    handler: (
      payload: MessageProtocol[C]['request'],
      sender: chrome.runtime.MessageSender,
    ) => Promise<MessageProtocol[C]['response']> | MessageProtocol[C]['response'],
    options?: MessageListenerOptions,
  ): () => void {
    if (!this.localListeners.has(channel)) {
      this.localListeners.set(channel, new Set());
    }
    const entry: ListenerEntry = {
      handler,
      requireInternalSender: Boolean(options?.requireInternalSender),
    };
    this.localListeners.get(channel)!.add(entry);

    this.ensureRuntimeListener();

    return () => {
      const set = this.localListeners.get(channel);
      if (set) {
        set.delete(entry);
        if (set.size === 0) {
          this.localListeners.delete(channel);
        }
      }
    };
  }

  private ensureRuntimeListener(): void {
    if (this.runtimeListenerAttached) return;

    const runtime = getExtensionRuntime();
    if (runtime?.onMessage?.addListener) {
      this.runtimeListenerAttached = true;
      runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
        const activeRuntime = getExtensionRuntime();
        if (!sender || !activeRuntime?.id || sender.id !== activeRuntime.id) {
          return false;
        }

        if (!message || typeof message !== 'object' || !('type' in message)) {
          return false;
        }

        const channel = message.type as ProtocolChannel;
        const entries = this.localListeners.get(channel);

        if (!entries || entries.size === 0) {
          return false;
        }

        const authorizedEntries = Array.from(entries).filter(
          (entry) => !entry.requireInternalSender || isInternalExtensionSender(sender),
        );

        if (authorizedEntries.length === 0) {
          sendResponse({
            success: false,
            error: 'Unauthorized: internal extension context required',
          });
          return true;
        }

        const payload = message.payload;
        (async () => {
          try {
            let lastResult: any;
            for (const entry of authorizedEntries) {
              lastResult = await entry.handler(payload, sender);
            }
            sendResponse({
              success: true,
              data: lastResult,
            });
          } catch (err: any) {
            sendResponse({
              success: false,
              error: err.message || 'Unknown messaging error',
            });
          }
        })();

        return true;
      });
    }
  }

  async dispatchLocally<C extends ProtocolChannel>(
    channel: C,
    payload: MessageProtocol[C]['request'],
    sender?: chrome.runtime.MessageSender,
  ): Promise<MessageProtocol[C]['response']> {
    const entries = this.localListeners.get(channel);
    if (!entries || entries.size === 0) {
      throw new Error(`No handlers registered for channel: ${channel}`);
    }

    const entryList = Array.from(entries);
    const authorizedEntries = sender
      ? entryList.filter(
          (entry) => !entry.requireInternalSender || isInternalExtensionSender(sender),
        )
      : entryList;

    if (authorizedEntries.length === 0) {
      throw new Error('Unauthorized: internal extension context required');
    }

    const mockSender = sender || ({ id: 'mock-sender' } as chrome.runtime.MessageSender);
    let result: any;
    for (const entry of authorizedEntries) {
      result = await entry.handler(payload, mockSender);
    }
    return result;
  }
}

export const messageBus = new ExtensionMessageBus();

export function createMessageBus(adapter?: BrowserAdapter): IMessageBus {
  return new ExtensionMessageBus(adapter);
}
