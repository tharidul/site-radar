
import type {
  InspectionMode,
  WebsiteInspection,
  CollectionResult,
  LayoutScrollType,
  ScrollConfidence,
} from './inspection';
import type { TabInfo } from './browser';
import type { CrawlLimits } from './crawler';

export const MESSAGE_CHANNELS = {
  START_INSPECTION: 'INSPECTION_START',
  CANCEL_INSPECTION: 'INSPECTION_CANCEL',
  GET_INSPECTION_STATE: 'INSPECTION_GET_STATE',
  CLEAR_IN_MEMORY_STATE: 'STATE_CLEAR',

  SCAN_PROGRESS: 'INSPECTION_PROGRESS_EVENT',
  SCAN_COMPLETED: 'INSPECTION_COMPLETED_EVENT',
  SCAN_FAILED: 'INSPECTION_FAILED_EVENT',

  GET_ACTIVE_TAB: 'TAB_GET_ACTIVE',

  EXECUTE_COLLECTOR: 'COLLECTOR_EXECUTE',
  PING_CONTENT_SCRIPT: 'CONTENT_SCRIPT_PING',
  MEASURE_SCROLLED_PAGE: 'PAGE_MEASURE_SCROLLED',
  GET_LIVE_METRICS: 'PAGE_GET_LIVE_METRICS',

  CHECK_EXTERNAL_CONSENT: 'CONSENT_CHECK',
  SET_EXTERNAL_CONSENT: 'CONSENT_SET',
} as const;

export type MessageChannel = (typeof MESSAGE_CHANNELS)[keyof typeof MESSAGE_CHANNELS];

export interface ScanProgressEvent {
  scanId: string;
  mode: InspectionMode;
  step: string;
  module?: string;
  percent: number;
  completedModules: number;
  totalModules: number;
  timestamp: number;
}

export interface MessageProtocol {
  [MESSAGE_CHANNELS.START_INSPECTION]: {
    request: {
      mode: InspectionMode;
      tabId?: number;
      crawlLimits?: Partial<CrawlLimits>;
      externalConsent?: Record<string, boolean>;
      refreshPage?: boolean;
    };
    response: {
      success: boolean;
      scanId: string;
      error?: string;
    };
  };

  [MESSAGE_CHANNELS.CANCEL_INSPECTION]: {
    request: {
      scanId: string;
    };
    response: {
      success: boolean;
      error?: string;
    };
  };

  [MESSAGE_CHANNELS.GET_INSPECTION_STATE]: {
    request: {
      scanId?: string;
      tabId?: number;
      url?: string;
    };
    response: {
      state: 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';
      inspection?: WebsiteInspection;
      progress?: ScanProgressEvent;
    };
  };

  [MESSAGE_CHANNELS.CLEAR_IN_MEMORY_STATE]: {
    request: void;
    response: {
      success: boolean;
    };
  };

  [MESSAGE_CHANNELS.GET_ACTIVE_TAB]: {
    request: void;
    response: {
      tab: TabInfo | null;
      error?: string;
    };
  };

  [MESSAGE_CHANNELS.EXECUTE_COLLECTOR]: {
    request: {
      module: string;
      options?: unknown;
    };
    response: {
      result: CollectionResult<unknown>;
      error?: string;
    };
  };

  [MESSAGE_CHANNELS.PING_CONTENT_SCRIPT]: {
    request: void;
    response: {
      pong: boolean;
      url: string;
      readyState: string;
    };
  };

  [MESSAGE_CHANNELS.MEASURE_SCROLLED_PAGE]: {
    request: void;
    response: {
      success: boolean;
      scrolledResourceCount?: number;
      scrolledTransferSizeApprox?: number;
      scrolledDecodedSizeApprox?: number;
      scrolledWireTransferBytes?: number;
      scrolledDecodedBytes?: number;
      scrolledCacheHitCount?: number;
      scrolledCacheHitBytes?: number;
      scrolledOpaqueResourceCount?: number;
      isInfiniteScroll?: boolean;
      layoutScrollType?: LayoutScrollType;
      isFixedHeight?: boolean;
      scrollConfidence?: ScrollConfidence;
      scrollSignals?: string[];
      error?: string;
    };
  };

  [MESSAGE_CHANNELS.GET_LIVE_METRICS]: {
    request: void;
    response: {
      success: boolean;
      resourceCount: number;
      wireTransferBytes: number;
      decodedBytes: number;
      cacheHitCount: number;
      cacheHitBytes: number;
      opaqueResourceCount: number;
      error?: string;
    };
  };

  [MESSAGE_CHANNELS.CHECK_EXTERNAL_CONSENT]: {
    request: {
      provider: string;
    };
    response: {
      granted: boolean;
    };
  };

  [MESSAGE_CHANNELS.SET_EXTERNAL_CONSENT]: {
    request: {
      provider: string;
      granted: boolean;
    };
    response: {
      success: boolean;
    };
  };

  [MESSAGE_CHANNELS.SCAN_PROGRESS]: {
    request: ScanProgressEvent;
    response: void;
  };

  [MESSAGE_CHANNELS.SCAN_COMPLETED]: {
    request: {
      scanId: string;
      inspection?: WebsiteInspection;
    };
    response: void;
  };

  [MESSAGE_CHANNELS.SCAN_FAILED]: {
    request: {
      scanId: string;
      error: string;
    };
    response: void;
  };
}

export type ProtocolChannel = keyof MessageProtocol;

export interface MessageEnvelope<TChannel extends MessageChannel = MessageChannel> {
  id: string;
  type: TChannel;
  payload: TChannel extends keyof MessageProtocol
    ? MessageProtocol[TChannel]['request']
    : unknown;
  sender?: 'popup' | 'background' | 'content';
  timestamp: number;
}

export interface ResponseEnvelope<TResult = unknown> {
  success: boolean;
  data?: TResult;
  error?: string;
}
