#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSiteRadarServer } from './server';
import { BrowserRunner } from './browser';

async function main() {
  const server = createSiteRadarServer();
  const transport = new StdioServerTransport();

  const cleanup = async () => {
    try {
      await BrowserRunner.closeBrowser();
    } catch {}
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => {
    BrowserRunner.closeBrowser().catch(() => {});
  });

  await server.connect(transport);
  console.error('SiteRadar MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error starting SiteRadar MCP server:', err);
  process.exit(1);
});

