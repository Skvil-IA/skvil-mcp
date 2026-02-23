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

/** In-memory cache to avoid repeated disk reads. */
let cachedApiKey: string | null | undefined;
let cachedBaseUrl: string | undefined;

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
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

/**
 * Resolve the API key from (in priority order):
 * 1. SKVIL_API_KEY or SKVIL_KEDAVRA_API_KEY environment variable
 * 2. Cached key in ~/.skvil/mcp-config.json
 * 3. Legacy Python client config at ~/.skvil/config
 *
 * Result is memoized for the lifetime of the process.
 */
export function getApiKey(): string | null {
  if (cachedApiKey !== undefined) return cachedApiKey;

  const envKey = process.env.SKVIL_API_KEY || process.env.SKVIL_KEDAVRA_API_KEY;
  if (envKey) {
    cachedApiKey = envKey;
    return cachedApiKey;
  }

  const config = readConfig();
  if (config.api_key) {
    cachedApiKey = config.api_key;
    return cachedApiKey;
  }

  // Try legacy Python client config (key=value format)
  try {
    const legacyPath = join(homedir(), '.skvil', 'config');
    if (existsSync(legacyPath)) {
      const content = readFileSync(legacyPath, 'utf-8');
      const match = content.match(/^api_key\s*=\s*(.+)$/m);
      if (match) {
        const key = match[1].trim();
        if (/^[a-zA-Z0-9_-]+$/.test(key)) {
          cachedApiKey = key;
          return cachedApiKey;
        }
      }
    }
  } catch {
    // Ignore read errors
  }

  cachedApiKey = null;
  return null;
}

/** Cache a newly registered API key for future use. */
export function saveApiKey(apiKey: string, keyPrefix: string): void {
  const config = readConfig();
  config.api_key = apiKey;
  config.key_prefix = keyPrefix;
  config.registered_at = new Date().toISOString();
  writeConfig(config);
  cachedApiKey = apiKey;
}

/** Clear the memoized API key (used after registration). */
export function clearApiKeyCache(): void {
  cachedApiKey = undefined;
}

/**
 * Get the API base URL (override with SKVIL_API_URL or SKVIL_KEDAVRA_API_URL).
 * Enforces HTTPS for non-localhost URLs to prevent credential leakage.
 * Result is memoized for the lifetime of the process.
 */
export function getBaseUrl(): string {
  if (cachedBaseUrl !== undefined) return cachedBaseUrl;

  const override = process.env.SKVIL_API_URL || process.env.SKVIL_KEDAVRA_API_URL;
  if (override) {
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|::1)(:\d+)?/.test(override);
    if (!override.startsWith('https://') && !isLocalhost) {
      process.stderr.write(
        '[skvil-mcp] WARNING: SKVIL_API_URL must use HTTPS. Falling back to api.skvil.com.\n',
      );
      cachedBaseUrl = 'https://api.skvil.com';
    } else {
      cachedBaseUrl = override.replace(/\/+$/, '');
    }
  } else {
    cachedBaseUrl = 'https://api.skvil.com';
  }

  return cachedBaseUrl;
}
