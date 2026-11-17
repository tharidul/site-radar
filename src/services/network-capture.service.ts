export interface CapturedTabHeaders {
  tabId: number;
  url: string;
  statusCode: number;
  statusLine?: string;
  headers: Record<string, string>;
  rawHeaders: Array<{ name: string; value?: string }>;
  timestamp: number;
}

export class NetworkCaptureService {
  private cache = new Map<number, CapturedTabHeaders>();
  private isListening = false;

  init(webExtApi?: any): void {
    const api =
      webExtApi ??
      (typeof chrome !== 'undefined'
        ? chrome
        : typeof browser !== 'undefined'
          ? (browser as any)
          : undefined);

    if (!api?.webRequest?.onHeadersReceived || this.isListening) {
      return;
    }

    try {
      api.webRequest.onHeadersReceived.addListener(
        (details: any) => {
          if (details && typeof details.tabId === 'number' && details.tabId >= 0 && details.type === 'main_frame') {
            const headersMap: Record<string, string> = {};
            const rawHeaders: Array<{ name: string; value?: string }> = [];

            if (Array.isArray(details.responseHeaders)) {
              for (const h of details.responseHeaders) {
                if (h.name && h.value !== undefined) {
                  headersMap[h.name.toLowerCase()] = h.value;
                  rawHeaders.push({ name: h.name, value: h.value });
                }
              }
            }

            this.cache.set(details.tabId, {
              tabId: details.tabId,
              url: details.url,
              statusCode: details.statusCode ?? 200,
              statusLine: details.statusLine,
              headers: headersMap,
              rawHeaders,
              timestamp: Date.now(),
            });
          }
        },
        { urls: ['<all_urls>'], types: ['main_frame'] },
        ['responseHeaders'],
      );
      this.isListening = true;
    } catch (err) {
      console.warn('NetworkCaptureService: Failed to attach onHeadersReceived listener', err);
    }
  }

  getCapturedHeaders(tabId?: number): CapturedTabHeaders | undefined {
    if (typeof tabId !== 'number' || tabId < 0) return undefined;
    return this.cache.get(tabId);
  }

  setCapturedHeaders(tabId: number, data: CapturedTabHeaders): void {
    this.cache.set(tabId, data);
  }

  removeTab(tabId: number): void {
    this.cache.delete(tabId);
  }

  clear(): void {
    this.cache.clear();
  }

  isInitialized(): boolean {
    return this.isListening;
  }
}

export const networkCaptureService = new NetworkCaptureService();
