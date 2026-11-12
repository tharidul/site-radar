
import type { PrivateNetworkViolationReason, ValidationResult } from '../types/security';

interface Ipv4Cidr {
  network: number;
  mask: number;
  reason: PrivateNetworkViolationReason;
}

function toUint32(a: number, b: number, c: number, d: number): number {
  return (((a << 24) | (b << 16) | (c << 8) | d) >>> 0);
}

function cidrMask(prefix: number): number {
  if (prefix === 0) return 0;
  if (prefix === 32) return 0xFFFFFFFF >>> 0;
  return ((0xFFFFFFFF << (32 - prefix)) >>> 0);
}

const IPV4_BLOCKED_RANGES: Ipv4Cidr[] = [
  { network: toUint32(0, 0, 0, 0), mask: cidrMask(8), reason: 'RESERVED_IP' },
  { network: toUint32(10, 0, 0, 0), mask: cidrMask(8), reason: 'PRIVATE_RFC1918_IP' },
  { network: toUint32(100, 64, 0, 0), mask: cidrMask(10), reason: 'CARRIER_GRADE_NAT_IP' },
  { network: toUint32(127, 0, 0, 0), mask: cidrMask(8), reason: 'LOOPBACK_IP' },
  { network: toUint32(169, 254, 0, 0), mask: cidrMask(16), reason: 'LINK_LOCAL_IP' },
  { network: toUint32(172, 16, 0, 0), mask: cidrMask(12), reason: 'PRIVATE_RFC1918_IP' },
  { network: toUint32(192, 0, 0, 0), mask: cidrMask(24), reason: 'RESERVED_IP' },
  { network: toUint32(192, 0, 2, 0), mask: cidrMask(24), reason: 'DOCUMENTATION_IP' },
  { network: toUint32(192, 88, 99, 0), mask: cidrMask(24), reason: 'RESERVED_IP' },
  { network: toUint32(192, 168, 0, 0), mask: cidrMask(16), reason: 'PRIVATE_RFC1918_IP' },
  { network: toUint32(198, 18, 0, 0), mask: cidrMask(15), reason: 'RESERVED_IP' },
  { network: toUint32(198, 51, 100, 0), mask: cidrMask(24), reason: 'DOCUMENTATION_IP' },
  { network: toUint32(203, 0, 113, 0), mask: cidrMask(24), reason: 'DOCUMENTATION_IP' },
  { network: toUint32(224, 0, 0, 0), mask: cidrMask(4), reason: 'MULTICAST_IP' },
  { network: toUint32(255, 255, 255, 255), mask: cidrMask(32), reason: 'BROADCAST_IP' },
  { network: toUint32(240, 0, 0, 0), mask: cidrMask(4), reason: 'RESERVED_IP' },
];

export function parseIpv4ToUint32(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    nums.push(n);
  }
  if (nums.length !== 4) return null;
  const [a, b, c, d] = nums;
  if (a === undefined || b === undefined || c === undefined || d === undefined) return null;
  return toUint32(a, b, c, d);
}

export interface IpCheckResult {
  private: boolean;
  isPrivate: boolean;
  isPublic: boolean;
  isLoopback: boolean;
  isLinkLocal: boolean;
  reason?: PrivateNetworkViolationReason;
}

export function checkIpv4Private(ip: string): IpCheckResult {
  const ipInt = parseIpv4ToUint32(ip);
  if (ipInt === null) {
    return {
      private: false,
      isPrivate: false,
      isPublic: false,
      isLoopback: false,
      isLinkLocal: false,
    };
  }
  for (const block of IPV4_BLOCKED_RANGES) {
    if ((ipInt & block.mask) === (block.network & block.mask)) {
      return {
        private: true,
        isPrivate: true,
        isPublic: false,
        isLoopback: block.reason === 'LOOPBACK_IP',
        isLinkLocal: block.reason === 'LINK_LOCAL_IP',
        reason: block.reason,
      };
    }
  }
  return {
    private: false,
    isPrivate: false,
    isPublic: true,
    isLoopback: false,
    isLinkLocal: false,
  };
}

export function isPrivateIpv4(ip: string): boolean {
  return checkIpv4Private(ip).private;
}

export function parseIpv6ToBigInt(ip: string): bigint | null {
  let clean = ip.trim();
  if (clean.startsWith('[') && clean.endsWith(']')) {
    clean = clean.slice(1, -1);
  } else if (clean.startsWith('[') || clean.endsWith(']')) {
    return null;
  }

  const lastColon = clean.lastIndexOf(':');
  if (lastColon !== -1) {
    const potentialIpv4 = clean.substring(lastColon + 1);
    const ipv4Int = parseIpv4ToUint32(potentialIpv4);
    if (ipv4Int !== null) {
      const p1 = ((ipv4Int >>> 16) & 0xFFFF).toString(16);
      const p2 = (ipv4Int & 0xFFFF).toString(16);
      clean = clean.substring(0, lastColon) + ':' + p1 + ':' + p2;
    }
  }

  const parts = clean.split('::');
  if (parts.length > 2) return null;

  const head = parts[0] ? parts[0].split(':').filter(Boolean) : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':').filter(Boolean) : [];

  if (parts.length === 1 && head.length !== 8) return null;
  if (parts.length === 2 && head.length + tail.length > 7) return null;

  const middle = new Array(8 - head.length - tail.length).fill('0');
  const full = [...head, ...middle, ...tail];

  let result = 0n;
  for (const hex of full) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(hex)) return null;
    result = (result << 16n) | BigInt(parseInt(hex, 16));
  }
  return result;
}

export function checkIpv6Private(ip: string): IpCheckResult {
  const val = parseIpv6ToBigInt(ip);
  if (val === null) {
    return {
      private: false,
      isPrivate: false,
      isPublic: false,
      isLoopback: false,
      isLinkLocal: false,
    };
  }

  const makeBlocked = (reason: PrivateNetworkViolationReason): IpCheckResult => ({
    private: true,
    isPrivate: true,
    isPublic: false,
    isLoopback: reason === 'LOOPBACK_IP',
    isLinkLocal: reason === 'IPV6_LINK_LOCAL' || reason === 'LINK_LOCAL_IP',
    reason,
  });

  if (val === 0n) return makeBlocked('RESERVED_IP');

  if (val === 1n) return makeBlocked('LOOPBACK_IP');

  if ((val >> 32n) === 0xffffn || (val >> 32n) === 0n) {
    const embeddedIpv4 = Number(val & 0xFFFFFFFFn) >>> 0;
    const octets = [
      (embeddedIpv4 >>> 24) & 0xFF,
      (embeddedIpv4 >>> 16) & 0xFF,
      (embeddedIpv4 >>> 8) & 0xFF,
      embeddedIpv4 & 0xFF,
    ];
    return checkIpv4Private(octets.join('.'));
  }

  if ((val >> 112n) === 0x2002n) {
    const embeddedIpv4 = Number((val >> 80n) & 0xFFFFFFFFn) >>> 0;
    const octets = [
      (embeddedIpv4 >>> 24) & 0xFF,
      (embeddedIpv4 >>> 16) & 0xFF,
      (embeddedIpv4 >>> 8) & 0xFF,
      embeddedIpv4 & 0xFF,
    ];
    return checkIpv4Private(octets.join('.'));
  }

  if ((val >> 121n) === (0xfc00n >> 9n)) {
    return makeBlocked('IPV6_ULA');
  }

  if ((val >> 118n) === (0xfe80n >> 6n)) {
    return makeBlocked('IPV6_LINK_LOCAL');
  }

  if ((val >> 120n) === 0xffn) {
    return makeBlocked('IPV6_MULTICAST');
  }

  if ((val >> 96n) === 0x20010db8n) {
    return makeBlocked('DOCUMENTATION_IP');
  }

  return {
    private: false,
    isPrivate: false,
    isPublic: true,
    isLoopback: false,
    isLinkLocal: false,
  };
}

export function isPrivateIpv6(ip: string): boolean {
  return checkIpv6Private(ip).private;
}

export function isPrivateIp(ip: string): boolean {
  return checkIpv4Private(ip).private || checkIpv6Private(ip).private;
}

export function isLocalDevelopmentHost(hostname?: string): boolean {
  if (!hostname) return false;
  let host = hostname.toLowerCase().trim();
  if (host.includes('://')) {
    try {
      host = new URL(host).hostname.toLowerCase();
    } catch {}
  }
  if (host.includes(':') && !host.includes('::')) {
    host = host.split(':')[0] || '';
  }
  host = host.replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host.startsWith('127.') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.test')
  );
}

export function isLocalDevelopmentUrl(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  try {
    const u = new URL(rawUrl);
    return isLocalDevelopmentHost(u.hostname);
  } catch {
    return false;
  }
}

export function isProhibitedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().trim().replace(/\.+$/, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local')) return true;
  if (
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.endsWith('.home') ||
    host.endsWith('.corp') ||
    host.endsWith('.intra')
  ) {
    return true;
  }
  if (host.endsWith('.test') || host.endsWith('.example') || host.endsWith('.invalid')) {
    return true;
  }
  if (host.endsWith('.onion')) return true;
  const wildcardDnsDomains = ['nip.io', 'sslip.io', 'localtest.me', 'vcap.me', 'lvh.me'];
  if (wildcardDnsDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    return true;
  }

  if (parseIpv6ToBigInt(host) !== null) {
    return false;
  }

  if (host.includes('[') || host.includes(']')) {
    return true;
  }

  if (!host.includes('.')) return true;
  return false;
}

export async function validatePublicUrl(
  urlStr: string,
  options?: { dohResolver?: (hostname: string) => Promise<string[]> },
): Promise<ValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { valid: false, reason: 'INVALID_URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'UNSUPPORTED_SCHEME' };
  }

  const rawHostname = parsed.hostname;
  const isIpv6Bracketed = rawHostname.startsWith('[') && rawHostname.endsWith(']');
  const cleanHostname = isIpv6Bracketed ? rawHostname.slice(1, -1) : rawHostname;

  const ipv4Check = checkIpv4Private(cleanHostname);
  if (ipv4Check.private) {
    return { valid: false, reason: ipv4Check.reason, ip: cleanHostname };
  }
  const ipv6Check = checkIpv6Private(cleanHostname);
  if (ipv6Check.private) {
    return { valid: false, reason: ipv6Check.reason, ip: cleanHostname };
  }

  const isIpv4Literal = parseIpv4ToUint32(cleanHostname) !== null;
  const isIpv6Literal = parseIpv6ToBigInt(cleanHostname) !== null;
  const isIpLiteral = isIpv4Literal || isIpv6Literal;

  if (isIpLiteral) {
    return { valid: true, ip: cleanHostname, resolvedIps: [cleanHostname] };
  }

  if (isProhibitedHostname(rawHostname)) {
    return { valid: false, reason: 'RESERVED_HOSTNAME' };
  }

  if (options?.dohResolver) {
    try {
      const resolvedIps = await options.dohResolver(rawHostname);
      if (!resolvedIps || resolvedIps.length === 0) {
        return { valid: false, reason: 'DNS_RESOLUTION_FAILED' };
      }
      for (const resolvedIp of resolvedIps) {
        if (isPrivateIp(resolvedIp)) {
          return {
            valid: false,
            reason: 'DNS_REBINDING_DETECTED',
            ip: resolvedIp,
            resolvedIps,
          };
        }
      }
      return { valid: true, resolvedIps };
    } catch {
      return { valid: false, reason: 'DNS_RESOLUTION_FAILED' };
    }
  }

  return { valid: true };
}
