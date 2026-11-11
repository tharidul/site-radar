import { z } from 'zod';
import { SiteRadarAuditor } from '../auditor';
import type { TechDetectResult } from '../types';

export const DetectTechSchema = z.object({
  url: z.string().url().describe('The website URL to fingerprint for frontend frameworks, backend engines, CDNs, and CSS libraries'),
  deep: z.boolean().optional().default(false).describe('Whether to run deep headless browser fingerprinting (true) or fast static inspection (false). Default: false'),
});

export async function handleDetectTech(args: z.infer<typeof DetectTechSchema>): Promise<TechDetectResult> {
  const audit = await SiteRadarAuditor.auditUrl(args.url, { mode: args.deep ? 'deep' : 'fast' });
  const technologies = audit.technologies;

  const frameworks: string[] = [];
  const cssFrameworks: string[] = [];
  const servers: string[] = [];
  const cdns: string[] = [];

  for (const t of technologies) {
    const label = t.version ? `${t.name} (v${t.version})` : t.name;
    const cat = (t.category || '').toLowerCase();
    if (cat.includes('javascript') || cat.includes('web framework') || cat.includes('framework')) {
      frameworks.push(label);
    } else if (cat.includes('css')) {
      cssFrameworks.push(label);
    } else if (cat.includes('server')) {
      servers.push(label);
    } else if (cat.includes('cdn') || cat.includes('cloud') || cat.includes('edge')) {
      cdns.push(label);
    }
  }

  let markdown = `## ⚡ Technology Stack Fingerprint: ${args.url}\n\n`;
  if (technologies.length === 0) {
    markdown += `*No prominent framework or library fingerprints detected from public signatures.*\n`;
  } else {
    markdown += `| Component | Category | Version | Confidence |\n`;
    markdown += `| :--- | :--- | :---: | :---: |\n`;
    for (const t of technologies) {
      markdown += `| **${t.name}** | ${t.category} | ${t.version || '—'} | ${Math.round(t.confidence * 100)}% |\n`;
    }
    markdown += `\n`;

    markdown += `### Detailed Detection Evidence\n\n`;
    for (const t of technologies) {
      markdown += `- **${t.name}:**\n`;
      for (const ev of t.evidence) {
        markdown += `  - ${ev}\n`;
      }
    }
  }

  return {
    url: args.url,
    technologies,
    frameworks,
    cssFrameworks,
    servers,
    cdns,
    markdownReport: markdown,
  };
}

