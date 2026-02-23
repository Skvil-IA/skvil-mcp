import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.skvil');
const CONFIG_FILE = join(CONFIG_DIR, 'mcp-config.json');

interface McpConfig {
  api_key?: string;
  key_prefix?: string;
  registered_at?: string;
}

function readConfig(): McpConfig {
  try {
    if (!existsSync(CONFIG_FILE)) return {};
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as McpConfig;
  } catch {
    return {};
  }
}

function writeConfig(config: McpConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

/**
 * Resolve the API key from (in priority order):
 * 1. SKVIL_API_KEY environment variable
 * 2. Cached key in ~/.skvil/mcp-config.json
 * 3. Legacy Python client config at ~/.skvil/config
 */
export function getApiKey(): string | null {
  if (process.env.SKVIL_API_KEY) {
    return process.env.SKVIL_API_KEY;
  }

  const config = readConfig();
  if (config.api_key) {
    return config.api_key;
  }

  // Try legacy Python client config
  try {
    const legacyPath = join(homedir(), '.skvil', 'config');
    if (existsSync(legacyPath)) {
      const content = readFileSync(legacyPath, 'utf-8');
      const match = content.match(/^api_key\s*=\s*(.+)$/m);
      if (match) return match[1].trim();
    }
  } catch {
    // Ignore read errors
  }

  return null;
}

/** Cache a newly registered API key for future use. */
export function saveApiKey(apiKey: string, keyPrefix: string): void {
  const config = readConfig();
  config.api_key = apiKey;
  config.key_prefix = keyPrefix;
  config.registered_at = new Date().toISOString();
  writeConfig(config);
}

/** Get the API base URL (override with SKVIL_API_URL env var). */
export function getBaseUrl(): string {
  return process.env.SKVIL_API_URL || 'https://api.skvil.com';
}
