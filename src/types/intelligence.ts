/**
 * @file src/types/intelligence.ts
 * @description External intelligence data contracts, DoH DNS lookups, IP/ASN mapping,
 * Certificate Transparency queries, live TLS indicators, and consent disclosure models.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 6, 11.
 */

/**
 * Types of external intelligence lookup providers.
 */
export type IntelligenceProviderType =
  | 'doh'
  | 'ip-asn'
  | 'crt-sh'
  | 'tls'
  | 'reputation';

/**
 * Map of provider identifiers to approval status.
 */
export type IntelligenceConsentState = Record<string, boolean>;

/**
 * Standard DNS record types queried via DNS-over-HTTPS.
 */
export type DnsRecordType =
  | 'A'
  | 'AAAA'
  | 'MX'
  | 'TXT'
  | 'CNAME'
  | 'CAA'
  | 'NS'
  | 'SOA';

/**
 * Individual answer returned by a DNS-over-HTTPS resolver.
 */
export interface DnsAnswer {
  /** Query name */
  name: string;
  /** Numerical RR type */
  type: number;
  /** Human-readable RR type name */
  typeName: DnsRecordType | string;
  /** Time-To-Live in seconds */
  TTL: number;
  /** DNS record value string */
  data: string;
}

/**
 * Complete result of a DNS lookup operation.
 */
export interface DnsLookupResult {
  /** Target domain evaluated */
  domain: string;
  /** URL or identity of the DoH resolver (e.g. Google, Cloudflare) */
  resolver: string;
  /** List of received DNS answers */
  answers: DnsAnswer[];
  /** Epoch timestamp in milliseconds when lookup completed */
  queriedAt: number;
  /** DNS RCODE status (0 = NOERROR, 3 = NXDOMAIN, 2 = SERVFAIL) */
  responseCode: number;
  /** Compatibility alias for responseCode */
  status?: number;
  /** True if response was truncated */
  isTruncated?: boolean;
  /** True if DNSSEC authenticated data flag is set */
  isDnssecValidated?: boolean;
  /** Compatibility alias for isDnssecValidated */
  dnssecValid?: boolean;
  /** Error message if lookup failed */
  error?: string;
}

/**
 * Result of resolving an IP address to ASN and geolocation metadata.
 */
export interface IpAsnLookupResult {
  /** Resolved public IP address */
  ip: string;
  /** Autonomous System Number (e.g. 15169) */
  asn?: number;
  /** Compatibility alias for asn */
  asNumber?: number;
  /** Autonomous System organization name (e.g. 'Google LLC') */
  asOrganization?: string;
  /** Internet Service Provider name */
  isp?: string;
  /** ISO two-letter country code */
  countryCode?: string;
  /** Country name */
  countryName?: string;
  /** Compatibility alias for countryName */
  country?: string;
  /** City name */
  city?: string;
  /** Region or state name */
  region?: string;
  /** Epoch timestamp in milliseconds when lookup occurred */
  queriedAt: number;
  /** Provider consulted */
  provider: string;
  /** Error message if query failed */
  error?: string;
}

/**
 * Entry from a Certificate Transparency (CT) log.
 */
export interface CertificateTransparencyRecord {
  /** CT log entry identifier */
  id: number | string;
  /** Issuing Certificate Authority name */
  issuerName: string;
  /** Subject Common Name */
  commonName: string;
  /** Subject Alternative Names string */
  nameValue: string;
  /** Validity start date ISO string */
  notBefore: string;
  /** Validity expiration date ISO string */
  notAfter: string;
  /** Certificate serial number */
  serialNumber: string;
  /** Log timestamp */
  loggedAt?: string;
}

/**
 * Aggregated Certificate Transparency log lookup result.
 */
export interface CertificateTransparencyResult {
  /** Query domain */
  domain: string;
  /** Total matching certificates found */
  totalFound: number;
  /** List of recent certificate entries */
  certificates: CertificateTransparencyRecord[];
  /** Compatibility alias for certificates */
  records?: CertificateTransparencyRecord[];
  /** List of unique subdomains extracted from certificate SANs */
  subdomainsDiscovered?: string[];
  /** Epoch timestamp in milliseconds */
  queriedAt: number;
  /** CT service queried (e.g. crt.sh) */
  provider: string;
  /** Error message if query failed */
  error?: string;
}

/**
 * Security headers evaluation result.
 */
export interface SecurityHeadersEvaluation {
  hsts: {
    present: boolean;
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
    rawHeader?: string;
  };
  csp: {
    present: boolean;
    rawHeader?: string;
    hasUpgradeInsecureRequests?: boolean;
    hasFrameAncestors?: boolean;
  };
  frameOptions: {
    present: boolean;
    value?: string;
    directive?: string;
  };
  xFrameOptions?: {
    present: boolean;
    directive?: string;
  };
  contentTypeOptions: {
    present: boolean;
    isNoSniff?: boolean;
  };
  xContentTypeOptions?: {
    present: boolean;
    isNoSniff?: boolean;
  };
  referrerPolicy: {
    present: boolean;
    policy?: string;
  };
  permissionsPolicy: {
    present: boolean;
    rawHeader?: string;
  };
}

/**
 * Result of evaluating live TLS security indicators.
 */
export interface TlsInspectionResult {
  /** Inspected hostname */
  host: string;
  /** Destination port (normally 443) */
  port: number;
  /** Negotiated TLS protocol version (e.g. 'TLSv1.3') */
  protocol?: string;
  /** Negotiated cipher suite */
  cipher?: string;
  /** True if certificate chain validates successfully */
  valid: boolean;
  /** Certificate validity start ISO string */
  validFrom?: string;
  /** Certificate validity expiration ISO string */
  validTo?: string;
  /** Days remaining until certificate expiration */
  daysRemaining?: number;
  /** Issuing CA organization */
  issuer?: string;
  /** Subject organization */
  subject?: string;
  /** Whether the certificate is trusted and authorized */
  authorized: boolean;
  /** Detailed certificate object */
  certificate?: unknown;
  /** Security headers evaluation */
  securityHeaders?: SecurityHeadersEvaluation;
  /** Error message if TLS inspection failed */
  error?: string;
  /** Epoch timestamp */
  queriedAt: number;
  /** Service or mechanism used for inspection */
  provider: string;
}

/**
 * Disclosure prompt presented to user prior to initiating external queries.
 */
export interface ConsentDisclosure {
  /** Friendly provider display name */
  providerName: string;
  /** Endpoint URL of the provider service */
  providerUrl: string;
  /** Type of intelligence lookup being performed */
  lookupType: IntelligenceProviderType;
  /** Target hostname or domain being transmitted */
  targetHost: string;
  /** List of specific data fields sent in request */
  dataToSend: string[];
  /** Link to provider's privacy policy */
  privacyPolicyUrl?: string;
  /** True if querying an unauthenticated public API */
  isPublicService: boolean;
}

/**
 * User consent state for external intelligence queries.
 */
export interface ConsentState {
  /** True if user approved external lookups */
  granted: boolean;
  /** Epoch timestamp in milliseconds when consent was recorded */
  grantedAt: number;
  /** Map of provider identifiers to approval status */
  allowedProviders: Record<string, boolean>;
  /** Whether user selected to remember this choice for session */
  rememberChoice: boolean;
}

declare module './inspection' {
  interface CategoryScore {
    hasCriticalFailure?: boolean;
  }
}

declare module '@/types/inspection' {
  interface CategoryScore {
    hasCriticalFailure?: boolean;
  }
}
