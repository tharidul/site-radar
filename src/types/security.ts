/**
 * @file src/types/security.ts
 * @description Security guardrails, private network (SSRF) validation, URL scheme
 * filtering, and zero-secret redaction contracts.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 10, 14.
 */

/**
 * IP address protocol family.
 */
export type IpAddressFamily = 'ipv4' | 'ipv6';

/**
 * Reason codes for private network, SSRF, or scheme violations.
 */
export type PrivateNetworkViolationReason =
  | 'INVALID_URL'
  | 'UNSUPPORTED_SCHEME'
  | 'SINGLE_LABEL_HOST'
  | 'RESERVED_HOSTNAME'
  | 'LOOPBACK_IP'
  | 'PRIVATE_RFC1918_IP'
  | 'LINK_LOCAL_IP'
  | 'MULTICAST_IP'
  | 'BROADCAST_IP'
  | 'CARRIER_GRADE_NAT_IP'
  | 'DOCUMENTATION_IP'
  | 'RESERVED_IP'
  | 'IPV6_ULA'
  | 'IPV6_LINK_LOCAL'
  | 'IPV6_MULTICAST'
  | 'DNS_REBINDING_DETECTED'
  | 'DNS_RESOLUTION_FAILED';

/**
 * Definition of a reserved or private IP address range.
 */
export interface IpRangeDefinition {
  /** CIDR notation (e.g. '10.0.0.0/8', 'fc00::/7') */
  cidr: string;
  /** Address family */
  family: IpAddressFamily;
  /** Descriptive reason for reservation (e.g. 'RFC 1918 Private Network') */
  description: string;
  /** Governing RFC specification reference */
  rfc?: string;
}

/**
 * Outcome of an IP address validation check.
 */
export interface IpValidationResult {
  /** The evaluated IP string */
  ip: string;
  /** Whether the string is a syntactically valid IP address */
  valid: boolean;
  /** IP protocol family */
  family?: IpAddressFamily;
  /** True if public and safe for external network communication */
  isPublic: boolean;
  /** RFC 1918 or ULA private network address */
  isPrivate: boolean;
  /** 127.0.0.0/8 or ::1 loopback address */
  isLoopback: boolean;
  /** 169.254.0.0/16 or fe80::/10 link-local address */
  isLinkLocal: boolean;
  /** 224.0.0.0/4 or ff00::/8 multicast address */
  isMulticast: boolean;
  /** Reserved, broadcast, or documentation address */
  isReserved: boolean;
  /** Rejection reason if not public */
  reason?: PrivateNetworkViolationReason | string;
}

/**
 * Outcome of a URL validation and scheme normalization check.
 */
export interface UrlValidationResult {
  /** Original input URL */
  url: string;
  /** True if URL is safe, valid, and uses http/https scheme */
  valid: boolean;
  /** Normalized URL with fragments stripped and lowercased host */
  normalizedUrl?: string;
  /** Protocol scheme (e.g. 'https:') */
  protocol?: string;
  /** Canonical hostname */
  hostname?: string;
  /** Explicit port number if specified */
  port?: number;
  /** Protocol, host, and port origin string */
  origin?: string;
  /** True if scheme is strictly 'http:' or 'https:' */
  isHttpOrHttps: boolean;
  /** True if hostname resolves to localhost or loopback name */
  isLocalhost: boolean;
  /** Rejection explanation if invalid */
  reason?: PrivateNetworkViolationReason | string;
}

/**
 * Detailed validation result returned by validatePublicUrl.
 */
export interface ValidationResult {
  valid: boolean;
  reason?: PrivateNetworkViolationReason;
  ip?: string;
  resolvedIps?: string[];
}

/**
 * Result of validating whether a URL falls within the permitted crawl boundary.
 */
export interface CrawlBoundaryResult {
  /** Whether the URL is allowed to be crawled */
  allowed: boolean;
  /** The evaluated URL */
  url: string;
  /** Canonical normalized URL */
  normalizedUrl: string;
  /** Expected target origin */
  origin: string;
  /** Detailed reason if crawling this URL is prohibited */
  reason?: string;
}

/**
 * Configuration options for the secret redaction engine.
 */
export interface SecretRedactionOptions {
  /** Replacement mask string (default: '[REDACTED]') */
  maskString?: string;
  /** Custom RegExp patterns for sensitive object keys */
  sensitiveKeyPatterns?: RegExp[];
  /** Custom RegExp patterns for sensitive string values (e.g. bearer tokens, JWTs) */
  sensitiveValuePatterns?: RegExp[];
  /** Maximum string length allowed before truncation */
  maxStringLength?: number;
}

/**
 * Summary metrics of a redaction operation.
 */
export interface RedactionSummary {
  /** Total count of secrets or sensitive fields redacted */
  totalRedactions: number;
  /** List of property keys that were redacted */
  keysRedacted: string[];
  /** Number of values masked within text strings */
  valuesMaskedCount: number;
}
