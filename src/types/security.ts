
export type IpAddressFamily = 'ipv4' | 'ipv6';

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

export interface IpRangeDefinition {
  cidr: string;
  family: IpAddressFamily;
  description: string;
  rfc?: string;
}

export interface IpValidationResult {
  ip: string;
  valid: boolean;
  family?: IpAddressFamily;
  isPublic: boolean;
  isPrivate: boolean;
  isLoopback: boolean;
  isLinkLocal: boolean;
  isMulticast: boolean;
  isReserved: boolean;
  reason?: PrivateNetworkViolationReason | string;
}

export interface UrlValidationResult {
  url: string;
  valid: boolean;
  normalizedUrl?: string;
  protocol?: string;
  hostname?: string;
  port?: number;
  origin?: string;
  isHttpOrHttps: boolean;
  isLocalhost: boolean;
  reason?: PrivateNetworkViolationReason | string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: PrivateNetworkViolationReason;
  ip?: string;
  resolvedIps?: string[];
}

export interface CrawlBoundaryResult {
  allowed: boolean;
  url: string;
  normalizedUrl: string;
  origin: string;
  reason?: string;
}

export interface SecretRedactionOptions {
  maskString?: string;
  sensitiveKeyPatterns?: RegExp[];
  sensitiveValuePatterns?: RegExp[];
  maxStringLength?: number;
}

export interface RedactionSummary {
  totalRedactions: number;
  keysRedacted: string[];
  valuesMaskedCount: number;
}
