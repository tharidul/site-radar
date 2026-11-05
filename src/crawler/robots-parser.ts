/**
 * @file src/crawler/robots-parser.ts
 * @description Standard robots.txt parser adhering to the Robots Exclusion Standard (RFC 9309).
 * Re-exports RobotsParser from robots.ts for backwards compatibility.
 */

export { RobotsParser } from './robots';
export type { RobotsDirectives } from '@/types/crawler';
