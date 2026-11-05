/**
 * @file src/crawler/robots.ts
 * @description RFC 9309 compliant robots.txt parser and path matcher.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 10, Feature 30.
 */

import type { RobotsDirectives } from '@/types/crawler';

interface RobotsGroup {
  userAgents: string[];
  allowed: Set<string>;
  disallowed: Set<string>;
  crawlDelay?: number;
}

export class RobotsParser {
  private allowed: string[] = [];
  private disallowed: string[] = [];
  private sitemaps: string[] = [];
  private crawlDelay?: number;
  private userAgent: string;

  constructor(userAgent = '*') {
    this.userAgent = userAgent.toLowerCase();
  }

  /**
   * Static helper to parse content for a given user-agent.
   */
  static parse(content: string, targetUserAgent = '*'): RobotsDirectives {
    const parser = new RobotsParser(targetUserAgent);
    return parser.parse(content);
  }

  /**
   * Static helper to evaluate path allowance against parsed directives.
   */
  static isAllowed(path: string, directives: RobotsDirectives): boolean {
    const parser = new RobotsParser(directives.userAgent);
    (parser as any).allowed = [...directives.allowed];
    (parser as any).disallowed = [...directives.disallowed];
    return parser.isAllowed(path);
  }

  /**
   * Parses the raw content of a robots.txt file adhering strictly to RFC 9309 § 2.2.1.
   * Specific User-Agent blocks take full precedence; wildcard '*' rules are NOT merged
   * into specific User-Agent blocks.
   */
  parse(content: string): RobotsDirectives {
    this.allowed = [];
    this.disallowed = [];
    this.sitemaps = [];
    this.crawlDelay = undefined;

    const allowedSet = new Set<string>();
    const disallowedSet = new Set<string>();
    const sitemapsSet = new Set<string>();

    const lines = content.split(/\r?\n/);
    const groups: RobotsGroup[] = [];
    let currentGroup: RobotsGroup | null = null;
    let inUserAgentSection = false;

    for (const rawLine of lines) {
      // Strip comments and trim whitespace
      const line = rawLine.replace(/#.*$/, '').trim();
      if (!line) continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const field = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();

      if (field === 'sitemap') {
        if (value) {
          sitemapsSet.add(value);
        }
        continue;
      }

      if (field === 'user-agent') {
        const ua = value.toLowerCase();
        if (!ua) continue;

        // If we were previously adding directives, start a new group
        if (!inUserAgentSection || !currentGroup) {
          currentGroup = {
            userAgents: [ua],
            allowed: new Set<string>(),
            disallowed: new Set<string>(),
          };
          groups.push(currentGroup);
          inUserAgentSection = true;
        } else {
          // Multiple consecutive user-agent lines belong to the same group
          if (!currentGroup.userAgents.includes(ua)) {
            currentGroup.userAgents.push(ua);
          }
        }
        continue;
      }

      // We encountered a directive line (allow, disallow, crawl-delay)
      inUserAgentSection = false;
      if (!currentGroup) continue;

      if (field === 'disallow') {
        if (value) {
          currentGroup.disallowed.add(value);
        }
      } else if (field === 'allow') {
        if (value) {
          currentGroup.allowed.add(value);
        }
      } else if (field === 'crawl-delay') {
        const delay = parseFloat(value);
        if (!isNaN(delay) && delay >= 0) {
          currentGroup.crawlDelay = delay;
        }
      }
    }

    // Select the applicable group according to RFC 9309 § 2.2.1:
    // "If there are multiple matching groups, the group with the most specific match MUST be used.
    //  Only one group can be used by the crawler."
    // Most specific match = group with the longest matching user-agent token.
    let bestGroup: RobotsGroup | null = null;
    let maxMatchLen = -1;

    for (const group of groups) {
      for (const ua of group.userAgents) {
        if (ua !== '*' && (ua === this.userAgent || this.userAgent.includes(ua))) {
          if (ua.length > maxMatchLen) {
            maxMatchLen = ua.length;
            bestGroup = group;
          }
        }
      }
    }

    if (bestGroup) {
      // Use ONLY the single group with the most specific match
      for (const rule of bestGroup.allowed) {
        allowedSet.add(rule);
      }
      for (const rule of bestGroup.disallowed) {
        disallowedSet.add(rule);
      }
      this.crawlDelay = bestGroup.crawlDelay;
    } else {
      // 2. Fall back to wildcard '*' group if no specific group matched
      const wildcardMatches = groups.filter((g) => g.userAgents.includes('*'));
      for (const group of wildcardMatches) {
        for (const rule of group.allowed) {
          allowedSet.add(rule);
        }
        for (const rule of group.disallowed) {
          disallowedSet.add(rule);
        }
        if (group.crawlDelay !== undefined && this.crawlDelay === undefined) {
          this.crawlDelay = group.crawlDelay;
        }
      }
    }

    this.allowed = Array.from(allowedSet);
    this.disallowed = Array.from(disallowedSet);
    this.sitemaps = Array.from(sitemapsSet);

    return {
      userAgent: this.userAgent,
      allowed: this.allowed,
      disallowed: this.disallowed,
      sitemaps: this.sitemaps,
      crawlDelay: this.crawlDelay,
    };
  }

  /**
   * Evaluates whether a given URL path is allowed by the parsed directives.
   * Longer path match takes precedence; Allow overrides Disallow if equal length.
   */
  isAllowed(path: string): boolean {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    let longestMatchLength = -1;
    let allowedByMatch = true;

    // Check disallowed rules
    for (const rule of this.disallowed) {
      if (this.matchesRule(cleanPath, rule)) {
        if (rule.length > longestMatchLength) {
          longestMatchLength = rule.length;
          allowedByMatch = false;
        }
      }
    }

    // Check allowed rules (Allow takes precedence on tie or longer match)
    for (const rule of this.allowed) {
      if (this.matchesRule(cleanPath, rule)) {
        if (rule.length >= longestMatchLength) {
          longestMatchLength = rule.length;
          allowedByMatch = true;
        }
      }
    }

    return allowedByMatch;
  }

  /**
   * Returns list of discovered sitemap URLs referenced in robots.txt.
   */
  getSitemaps(): string[] {
    return [...this.sitemaps];
  }

  /**
   * Matches path against robots.txt rule supporting wildcards (*) and end-of-path ($).
   */
  private matchesRule(path: string, rule: string): boolean {
    if (!rule) return false;
    if (rule === '/') return true;

    // Convert robots.txt pattern to regex
    // Escape special regex characters except * and $
    let regexStr = '^' + rule
      .replace(/[-[\]{}()+?.,\\^|#\s]/g, '\\$&')
      .replace(/\*/g, '.*');

    if (!regexStr.endsWith('$')) {
      // In robots.txt, prefix match is standard unless $ terminates
      regexStr += '.*';
    } else {
      // Remove trailing $ before adding string end anchor
      regexStr = regexStr.slice(0, -1) + '$';
    }

    try {
      const regex = new RegExp(regexStr);
      return regex.test(path);
    } catch {
      return path.startsWith(rule);
    }
  }
}
