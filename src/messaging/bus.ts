
import {
  type ProtocolChannel,
  type MessageProtocol,
  type MessageEnvelope,
  type ResponseEnvelope,
} from '../types/messaging';
import { getBrowserAdapter, type BrowserAdapter } from '../browser/adapters';

export interface MessageListenerOptions {
  requireInternalSender?: boolean;
}

interface ListenerEntry {
  handler: (payload: any, sender: chrome.runtime.MessageSender) => any;
  requireInternalSender: boolean;
}

/**
 * Validates that an incoming runtime message originated from an internal
 * extension context (e.g. popup, sidepanel, options, or background page)
 * rather than an injected content script or external page.
 */
export function isInternalExtensionSender(
  sender?: chrome.runtime.MessageSender | null,
): boolean {
  if (!sender || typeof chrome === 'undefined' || !chrome.runtime?.id) {
    return false;
  }
  if (sender.id !== chrome.runtime.id || sender.tab !== undefined) {
    return false;
  }
  const extensionOrigin = `chrome-extension://${chrome.runtime.id}`;
  return (
    typeof sender.url === 'string' &&
    (sender.url === extensionOrigin || sender.url.startsWith(`${extensionOrigin}/`))
  );
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

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      this.runtimeListenerAttached = true;
      chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
        if (!sender || sender.id !== chrome.runtime.id) {
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
