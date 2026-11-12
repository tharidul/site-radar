
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

  static parse(content: string, targetUserAgent = '*'): RobotsDirectives {
    const parser = new RobotsParser(targetUserAgent);
    return parser.parse(content);
  }

  static isAllowed(path: string, directives: RobotsDirectives): boolean {
    const parser = new RobotsParser(directives.userAgent);
    parser.allowed = [...directives.allowed];
    parser.disallowed = [...directives.disallowed];
    return parser.isAllowed(path);
  }

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

        if (!inUserAgentSection || !currentGroup) {
          currentGroup = {
            userAgents: [ua],
            allowed: new Set<string>(),
            disallowed: new Set<string>(),
          };
          groups.push(currentGroup);
          inUserAgentSection = true;
        } else {
          if (!currentGroup.userAgents.includes(ua)) {
            currentGroup.userAgents.push(ua);
          }
        }
        continue;
      }

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
      for (const rule of bestGroup.allowed) {
        allowedSet.add(rule);
      }
      for (const rule of bestGroup.disallowed) {
        disallowedSet.add(rule);
      }
      this.crawlDelay = bestGroup.crawlDelay;
    } else {
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

  isAllowed(path: string): boolean {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    let longestMatchLength = -1;
    let allowedByMatch = true;

    for (const rule of this.disallowed) {
      if (this.matchesRule(cleanPath, rule)) {
        if (rule.length > longestMatchLength) {
          longestMatchLength = rule.length;
          allowedByMatch = false;
        }
      }
    }

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

  getAllowed(): string[] {
    return [...this.allowed];
  }

  getDisallowed(): string[] {
    return [...this.disallowed];
  }

  getUserAgent(): string {
    return this.userAgent;
  }

  getSitemaps(): string[] {
    return [...this.sitemaps];
  }

  private matchesRule(path: string, rule: string): boolean {
    if (!rule) return false;
    if (rule === '/') return true;

    let regexStr = '^' + rule
      .replace(/[-[\]{}()+?.,\\^|#\s]/g, '\\$&')
      .replace(/\*/g, '.*');

    if (!regexStr.endsWith('$')) {
      regexStr += '.*';
    } else {
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
