import { z } from 'zod';
import { SiteRadarAuditor } from '../auditor';
import type { AuditToolResult } from '../types';

export const FullAuditSchema = z.object({
  url: z.string().url().describe('The website URL to conduct a comprehensive SiteRadar technical audit on'),
  mode: z.enum(['fast', 'deep']).optional().default('deep').describe('Audit mode: "deep" uses Playwright headless browser for live Core Web Vitals and axe-core accessibility; "fast" performs instant HTTP/DOM evaluation. Default: deep'),
  timeoutMs: z.number().optional().default(30000).describe('Max navigation timeout in milliseconds for deep mode. Default: 30000'),
});

export async function handleFullAudit(rawArgs: z.input<typeof FullAuditSchema>): Promise<AuditToolResult> {
  const args = FullAuditSchema.parse(rawArgs);
  return await SiteRadarAuditor.auditUrl(args.url, {
    mode: args.mode,
    timeoutMs: args.timeoutMs,
  });
}

