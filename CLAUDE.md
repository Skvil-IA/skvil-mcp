# CLAUDE.md

## Project Overview

skvil-mcp is a Model Context Protocol (MCP) server that provides AI agents with direct access to the Skvil security scanner API. It allows agents to verify skill safety, submit scan results, and check on-chain certifications without manual HTTP calls.

## Commands

```bash
npm install           # Install dependencies
npm run build         # Compile TypeScript to dist/
npm run dev           # Watch mode (auto-recompile)
npm run lint          # ESLint check
npm run format        # Prettier format
npm run format:check  # Prettier check
npm run typecheck     # TypeScript type check (no emit)
npm start             # Run the MCP server (stdio transport)
```

## Architecture

- `src/index.ts` — Entry point: creates McpServer, registers tools, connects stdio transport
- `src/tools.ts` — All 6 MCP tool definitions with Zod schemas and handlers
- `src/api.ts` — HTTP client for api.skvil.com (native fetch, 15s timeout)
- `src/config.ts` — API key resolution (env var → mcp-config.json → legacy config)
- `src/types.ts` — TypeScript interfaces for API responses

## Key Design Decisions

- **stdio transport** — standard for local MCP servers, spawned as subprocess by the AI client
- **Auto-registration** — `skvil_register` tool caches the API key in `~/.skvil/mcp-config.json`
- **Zero config** — works out of the box with `npx @skvil/mcp-server`
- **Native fetch** — no HTTP dependencies, Node 18+ built-in
- **Error handling** — all errors are caught and returned as structured MCP error content
