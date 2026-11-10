
export type SameSiteStatus = 'no_restriction' | 'lax' | 'strict' | 'unspecified';

export interface InspectedCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: SameSiteStatus;
  session: boolean;
  expirationDate?: number;
  hostOnly?: boolean;
  storeId?: string;
  partitionKey?: {
    topLevelSite?: string;
  };
}

export type CookieSecurityFlag = 'missing_secure' | 'missing_httponly' | 'samesite_none_insecure';

export interface CookieSecurityAudit {
  missingSecure: boolean;
  missingHttpOnly: boolean;
  sameSiteNoneInsecure: boolean;
  isExpired: boolean;
}

export interface CookieAuditSummary {
  total: number;
  sessionCount: number;
  persistentCount: number;
  missingSecureCount: number;
  missingHttpOnlyCount: number;
}

