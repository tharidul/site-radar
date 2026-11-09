/**
 * @file src/types/messaging.ts
 * @description Type-safe messaging protocol defining request/response contracts
 * and event channels across extension boundaries (Popup, Background, Content Scripts).
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 8, 9.
 */

import type { InspectionMode, WebsiteInspection, CollectionResult } from './inspection';
import type { TabInfo } from './browser';
import type { CrawlLimits } from './crawler';

/**
 * Message channel identifier constants.
 */
export const MESSAGE_CHANNELS = {
  // Inspection lifecycle
  START_INSPECTION: 'INSPECTION_START',
  CANCEL_INSPECTION: 'INSPECTION_CANCEL',
  GET_INSPECTION_STATE: 'INSPECTION_GET_STATE',
  CLEAR_IN_MEMORY_STATE: 'STATE_CLEAR',

  // Progress events (Broadcast)
  SCAN_PROGRESS: 'INSPECTION_PROGRESS_EVENT',
  SCAN_COMPLETED: 'INSPECTION_COMPLETED_EVENT',
  SCAN_FAILED: 'INSPECTION_FAILED_EVENT',

  // Browser & Tab queries
  GET_ACTIVE_TAB: 'TAB_GET_ACTIVE',

  // Content script execution
  EXECUTE_COLLECTOR: 'COLLECTOR_EXECUTE',
  PING_CONTENT_SCRIPT: 'CONTENT_SCRIPT_PING',
  MEASURE_SCROLLED_PAGE: 'PAGE_MEASURE_SCROLLED',

  // Consent & Provider settings
  CHECK_EXTERNAL_CONSENT: 'CONSENT_CHECK',
  SET_EXTERNAL_CONSENT: 'CONSENT_SET',
} as const;

export type MessageChannel = (typeof MESSAGE_CHANNELS)[keyof typeof MESSAGE_CHANNELS];

/**
 * Real-time progress update event emitted during an audit.
 */
export interface ScanProgressEvent {
  /** Active scan session identifier */
  scanId: string;
  /** Inspection mode running */
  mode: InspectionMode;
  /** Current pipeline phase or description (e.g. 'Collecting DOM metadata...') */
  step: string;
  /** Identifier of the module currently being evaluated */
  module?: string;
  /** Overall percentage progress (0 to 100) */
  percent: number;
  /** Number of modules completed so far */
  completedModules: number;
  /** Total number of modules scheduled */
  totalModules: number;
  /** Event timestamp in milliseconds */
  timestamp: number;
}

/**
 * Request & Response payload mappings for all message channels.
 */
export interface MessageProtocol {
  [MESSAGE_CHANNELS.START_INSPECTION]: {
    request: {
      mode: InspectionMode;
      tabId?: number;
      crawlLimits?: Partial<CrawlLimits>;
      externalConsent?: Record<string, boolean>;
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
      isInfiniteScroll?: boolean;
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

/**
 * Standard envelope wrapping all cross-context extension messages.
 */
export interface MessageEnvelope<TChannel extends MessageChannel = MessageChannel> {
  /** Unique message envelope identifier */
  id: string;
  /** Protocol channel */
  type: TChannel;
  /** Strongly typed request payload */
  payload: TChannel extends keyof MessageProtocol
    ? MessageProtocol[TChannel]['request']
    : unknown;
  /** Extension sender context */
  sender?: 'popup' | 'background' | 'content';
  /** Message creation epoch timestamp */
  timestamp: number;
}

/**
 * Standard envelope returned in response to an extension message.
 */
export interface ResponseEnvelope<TResult = unknown> {
  /** Whether the requested operation succeeded */
  success: boolean;
  /** Strongly-typed response data */
  data?: TResult;
  /** Error message if operation failed */
  error?: string;
}
