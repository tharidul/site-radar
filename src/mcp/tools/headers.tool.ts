import { z } from 'zod';
import { HeadersService } from '../../services/headers.service';
import { assertSafePublicUrl } from '../security';
import { validatePublicUrl } from '../../security/private-network.guard';
import type { HeaderAuditResult } from '../types';

export const AuditHeadersSchema = z.object({
  url: z.string().url().describe('The target URL to inspect for HTTP response and security headers (e.g. https://example.com)'),
});

export async function handleAuditHeaders(args: z.infer<typeof AuditHeadersSchema>): Promise<HeaderAuditResult> {
  const url = args.url;
  await assertSafePublicUrl(url);

  let statusCode = 200;
  let statusText = 'OK';
  const headersMap: Record<string, string> = {};

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 SiteRadar/0.2.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (resp.url && resp.url !== url) {
      const redirectCheck = await validatePublicUrl(resp.url);
      if (!redirectCheck.valid) {
        throw new Error(`SSRF Blocked: Redirect destination is a private, loopback, or reserved address (${redirectCheck.reason || 'Restricted IP'})`);
      }
    }

    statusCode = resp.status;
    statusText = resp.statusText;
    resp.headers.forEach((val, key) => {
      headersMap[key.toLowerCase()] = val;
    });
  } catch (err: any) {
    throw new Error(`Failed to fetch HTTP headers for ${url}: ${err.message}`);
  }

  const processed = HeadersService.processHeaders(headersMap, statusCode, statusText, url);

  // Compute a security headers score based on present vs missing
  const totalCoreSecurityHeaders = 6; // HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options
  const missingCount = processed.missingSecurityHeaders.length;
  const passedCount = Math.max(0, totalCoreSecurityHeaders - missingCount);
  const securityScore = Math.round((passedCount / totalCoreSecurityHeaders) * 100);

  const passedHeaders: string[] = [];
  if (headersMap['strict-transport-security']) passedHeaders.push('Strict-Transport-Security (HSTS)');
  if (headersMap['content-security-policy']) passedHeaders.push('Content-Security-Policy (CSP)');
  if (headersMap['x-frame-options']) passedHeaders.push('X-Frame-Options');
  if (headersMap['referrer-policy']) passedHeaders.push('Referrer-Policy');
  if (headersMap['permissions-policy']) passedHeaders.push('Permissions-Policy');
  if (headersMap['x-content-type-options']) passedHeaders.push('X-Content-Type-Options');

  let markdown = `## 🛡️ SiteRadar Header Security Audit: ${url}\n\n`;
  markdown += `**Status:** \`${statusCode} ${statusText}\` | **Security Header Score:** **${securityScore}/100**\n\n`;

  if (passedHeaders.length > 0) {
    markdown += `### ✅ Configured Security Headers (${passedHeaders.length})\n`;
    for (const h of passedHeaders) {
      markdown += `- **${h}**\n`;
    }
    markdown += `\n`;
  }

  if (processed.missingSecurityHeaders.length > 0) {
    markdown += `### ⚠️ Missing Security Headers (${processed.missingSecurityHeaders.length})\n\n`;
    markdown += `| Header | Severity | Recommendation |\n`;
    markdown += `| :--- | :---: | :--- |\n`;
    for (const missing of processed.missingSecurityHeaders) {
      markdown += `| \`${missing.name}\` | **${missing.severity.toUpperCase()}** | ${missing.recommendation} |\n`;
    }
    markdown += `\n`;
  }

  if (processed.leaks.length > 0) {
    markdown += `### 🔍 Information Leaks Detected (${processed.leaks.length})\n\n`;
    for (const leak of processed.leaks) {
      markdown += `- **\`${leak.name}\`**: \`${leak.value}\`\n  > ${leak.risk}\n`;
    }
    markdown += `\n`;
  }

  markdown += `> **cURL Reproduction:**\n\`\`\`bash\n${processed.curlCommand}\n\`\`\`\n`;

  return {
    url,
    statusCode,
    statusText,
    securityScore,
    passedHeaders,
    missingSecurityHeaders: processed.missingSecurityHeaders,
    leaks: processed.leaks,
    categorizedHeaders: processed.categorizedHeaders,
    markdownReport: markdown,
  };
}

