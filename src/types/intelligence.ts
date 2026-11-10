
export type IntelligenceProviderType =
  | 'doh'
  | 'ip-asn'
  | 'crt-sh'
  | 'tls'
  | 'reputation';

export type IntelligenceConsentState = Record<string, boolean>;

export type DnsRecordType =
  | 'A'
  | 'AAAA'
  | 'MX'
  | 'TXT'
  | 'CNAME'
  | 'CAA'
  | 'NS'
  | 'SOA';

export interface DnsAnswer {
  name: string;
  type: number;
  typeName: DnsRecordType | string;
  TTL: number;
  data: string;
}

export interface DnsLookupResult {
  domain: string;
  resolver: string;
  answers: DnsAnswer[];
  queriedAt: number;
  responseCode: number;
  status?: number;
  isTruncated?: boolean;
  isDnssecValidated?: boolean;
  dnssecValid?: boolean;
  error?: string;
}

export interface IpAsnLookupResult {
  ip: string;
  asn?: number;
  asNumber?: number;
  asOrganization?: string;
  isp?: string;
  countryCode?: string;
  countryName?: string;
  country?: string;
  city?: string;
  region?: string;
  queriedAt: number;
  provider: string;
  error?: string;
}

export interface CertificateTransparencyRecord {
  id: number | string;
  issuerName: string;
  commonName: string;
  nameValue: string;
  notBefore: string;
  notAfter: string;
  serialNumber: string;
  loggedAt?: string;
}

export interface CertificateTransparencyResult {
  domain: string;
  totalFound: number;
  certificates: CertificateTransparencyRecord[];
  records?: CertificateTransparencyRecord[];
  subdomainsDiscovered?: string[];
  queriedAt: number;
  provider: string;
  error?: string;
}

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

export interface TlsInspectionResult {
  host: string;
  port: number;
  protocol?: string;
  cipher?: string;
  valid: boolean;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  issuer?: string;
  subject?: string;
  authorized: boolean;
  certificate?: unknown;
  securityHeaders?: SecurityHeadersEvaluation;
  error?: string;
  queriedAt: number;
  provider: string;
}

export interface ConsentDisclosure {
  providerName: string;
  providerUrl: string;
  lookupType: IntelligenceProviderType;
  targetHost: string;
  dataToSend: string[];
  privacyPolicyUrl?: string;
  isPublicService: boolean;
}

export interface ConsentState {
  granted: boolean;
  grantedAt: number;
  allowedProviders: Record<string, boolean>;
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
