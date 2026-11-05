/**
 * @file src/security/private-network.guard.ts
 * @description Private network, loopback, link-local, multicast, and DNS rebinding guard.
 * Validates IPv4 and IPv6 addresses using zero-allocation bitwise and BigInt CIDR checks.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 10, 14.
 */

import type { PrivateNetworkViolationReason, ValidationResult } from '../types/security';

interface Ipv4Cidr {
  network: number; // unsigned 32-bit int
  mask: number;    // unsigned 32-bit int
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

// Pre-computed CIDRs for high-throughput zero-allocation checking
const IPV4_BLOCKED_RANGES: Ipv4Cidr[] = [
  { network: toUint32(0, 0, 0, 0), mask: cidrMask(8), reason: 'RESERVED_IP' },              // 0.0.0.0/8
  { network: toUint32(10, 0, 0, 0), mask: cidrMask(8), reason: 'PRIVATE_RFC1918_IP' },        // 10.0.0.0/8
  { network: toUint32(100, 64, 0, 0), mask: cidrMask(10), reason: 'CARRIER_GRADE_NAT_IP' },   // 100.64.0.0/10
  { network: toUint32(127, 0, 0, 0), mask: cidrMask(8), reason: 'LOOPBACK_IP' },             // 127.0.0.0/8
  { network: toUint32(169, 254, 0, 0), mask: cidrMask(16), reason: 'LINK_LOCAL_IP' },        // 169.254.0.0/16
  { network: toUint32(172, 16, 0, 0), mask: cidrMask(12), reason: 'PRIVATE_RFC1918_IP' },     // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  { network: toUint32(192, 0, 0, 0), mask: cidrMask(24), reason: 'RESERVED_IP' },            // 192.0.0.0/24
  { network: toUint32(192, 0, 2, 0), mask: cidrMask(24), reason: 'DOCUMENTATION_IP' },        // 192.0.2.0/24
  { network: toUint32(192, 88, 99, 0), mask: cidrMask(24), reason: 'RESERVED_IP' },          // 192.88.99.0/24
  { network: toUint32(192, 168, 0, 0), mask: cidrMask(16), reason: 'PRIVATE_RFC1918_IP' },    // 192.168.0.0/16
  { network: toUint32(198, 18, 0, 0), mask: cidrMask(15), reason: 'RESERVED_IP' },           // 198.18.0.0/15
  { network: toUint32(198, 51, 100, 0), mask: cidrMask(24), reason: 'DOCUMENTATION_IP' },    // 198.51.100.0/24
  { network: toUint32(203, 0, 113, 0), mask: cidrMask(24), reason: 'DOCUMENTATION_IP' },     // 203.0.113.0/24
  { network: toUint32(224, 0, 0, 0), mask: cidrMask(4), reason: 'MULTICAST_IP' },            // 224.0.0.0/4
  { network: toUint32(255, 255, 255, 255), mask: cidrMask(32), reason: 'BROADCAST_IP' },    // 255.255.255.255/32 (longest match before 240.0.0.0/4)
  { network: toUint32(240, 0, 0, 0), mask: cidrMask(4), reason: 'RESERVED_IP' },             // 240.0.0.0/4
];

/**
 * Parses an IPv4 string into an unsigned 32-bit integer.
 * Returns null if the string is not a valid 4-octet IPv4 address.
 */
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

/**
 * Validates whether an IPv4 address belongs to a private, loopback, or reserved range.
 */
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

/**
 * Parses an IPv6 string into a 128-bit BigInt.
 * Supports standard shorthand (::), brackets, and IPv4-mapped trailing notation.
 */
export function parseIpv6ToBigInt(ip: string): bigint | null {
  let clean = ip.trim();
  if (clean.startsWith('[') && clean.endsWith(']')) {
    clean = clean.slice(1, -1);
  } else if (clean.startsWith('[') || clean.endsWith(']')) {
    return null;
  }

  // Handle IPv4-mapped trailing notation e.g. ::ffff:192.168.1.1
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

/**
 * Validates whether an IPv6 address belongs to a private, loopback, link-local, ULA, or reserved range.
 */
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

  // 1. Unspecified ::/128
  if (val === 0n) return makeBlocked('RESERVED_IP');

  // 2. Loopback ::1/128
  if (val === 1n) return makeBlocked('LOOPBACK_IP');

  // 3. IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96)
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

  // 4. 6to4 prefix (2002::/16) -> bits 16..47 are IPv4
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

  // 5. Unique Local Address (ULA - fc00::/7)
  if ((val >> 121n) === (0xfc00n >> 9n)) {
    return makeBlocked('IPV6_ULA');
  }

  // 6. Link-Local Unicast (fe80::/10)
  if ((val >> 118n) === (0xfe80n >> 6n)) {
    return makeBlocked('IPV6_LINK_LOCAL');
  }

  // 7. Multicast (ff00::/8)
  if ((val >> 120n) === 0xffn) {
    return makeBlocked('IPV6_MULTICAST');
  }

  // 8. Documentation (2001:db8::/32)
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

/**
 * Returns true if the IP string is a private, loopback, or reserved address (IPv4 or IPv6).
 */
export function isPrivateIp(ip: string): boolean {
  return checkIpv4Private(ip).private || checkIpv6Private(ip).private;
}

/**
 * Checks whether a hostname belongs to a prohibited, internal, or reserved domain.
 */
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

  // IPv6 address literals (e.g., '[2001:4860:4860::8888]' or '2001:4860:4860::8888') are not single-label hostnames
  if (parseIpv6ToBigInt(host) !== null) {
    return false;
  }

  // Reject malformed bracketed hosts
  if (host.includes('[') || host.includes(']')) {
    return true;
  }

  // Reject single-label local hostnames (e.g., 'http://router', 'http://nas')
  if (!host.includes('.')) return true;
  return false;
}

/**
 * Validates a target URL against private networks and SSRF vectors.
 * If a DoH resolver is provided, resolves the hostname to ensure no DNS rebinding to private IPs.
 */
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

  // Direct IP literal check (IPv4 or IPv6)
  const ipv4Check = checkIpv4Private(cleanHostname);
  if (ipv4Check.private) {
    return { valid: false, reason: ipv4Check.reason, ip: cleanHostname };
  }
  const ipv6Check = checkIpv6Private(cleanHostname);
  if (ipv6Check.private) {
    return { valid: false, reason: ipv6Check.reason, ip: cleanHostname };
  }

  // Check if target is an IP literal (IPv4 or IPv6)
  const isIpv4Literal = parseIpv4ToUint32(cleanHostname) !== null;
  const isIpv6Literal = parseIpv6ToBigInt(cleanHostname) !== null;
  const isIpLiteral = isIpv4Literal || isIpv6Literal;

  if (isIpLiteral) {
    // Valid public IP literal: bypass hostname prohibition checks and DoH resolution
    return { valid: true, ip: cleanHostname, resolvedIps: [cleanHostname] };
  }

  // Hostname string checks
  if (isProhibitedHostname(rawHostname)) {
    return { valid: false, reason: 'RESERVED_HOSTNAME' };
  }

  // Pre-flight DNS Rebinding verification via DoH
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
