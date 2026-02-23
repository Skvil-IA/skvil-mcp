#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.js';
import { VERSION } from './version.js';

process.on('unhandledRejection', (err) => {
  process.stderr.write(`[skvil-mcp] unhandled rejection: ${err}\n`);
  process.exit(1);
});

const server = new McpServer({
  name: 'skvil',
  version: VERSION,
});

registerTools(server);

try {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[skvil-mcp] failed to start: ${message}\n`);
  process.exit(1);
}
