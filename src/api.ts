import { getApiKey, getBaseUrl, saveApiKey } from './config.js';
import type {
  VerifyResponse,
  RegisterResponse,
  StatsResponse,
  CertifiedSkill,
  ScanPayload,
  ScanResponse,
  ReportResponse,
  ApiError,
} from './types.js';

const USER_AGENT = 'skvil-mcp/0.1.0';
const TIMEOUT_MS = 15_000;

export class SkvilApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`HTTP ${status}: ${detail}`);
    this.name = 'SkvilApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth) {
    const key = getApiKey();
    if (!key) {
      throw new SkvilApiError(
        401,
        'No API key configured. Use skvil_register to get one, or set SKVIL_API_KEY env var.',
      );
    }
    headers['X-API-Key'] = key;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      let detail = text;
      try {
        const parsed = JSON.parse(text) as ApiError;
        detail = parsed.detail || text;
      } catch {
        // Use raw text
      }
      throw new SkvilApiError(response.status, detail);
    }

    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Check if a skill is safe by its composite hash. */
export async function verify(hash: string): Promise<VerifyResponse> {
  return request<VerifyResponse>('GET', `/verify/${encodeURIComponent(hash)}`);
}

/** Get community statistics. */
export async function stats(): Promise<StatsResponse> {
  return request<StatsResponse>('GET', '/stats');
}

/** List actively certified skills. */
export async function certified(): Promise<CertifiedSkill[]> {
  return request<CertifiedSkill[]>('GET', '/certified');
}

/** Register for a free API key and cache it locally. */
export async function register(): Promise<RegisterResponse> {
  const result = await request<RegisterResponse>('POST', '/register');
  saveApiKey(result.api_key, result.key_prefix);
  return result;
}

/** Submit scan results for a skill. */
export async function scan(payload: ScanPayload): Promise<ScanResponse> {
  return request<ScanResponse>('POST', '/scan', { body: payload, auth: true });
}

/** Report a suspicious skill. */
export async function report(
  hash: string,
  reason: string,
  details?: string,
): Promise<ReportResponse> {
  const body: Record<string, string> = { composite_hash: hash, reason };
  if (details) body.details = details;
  return request<ReportResponse>('POST', '/report', { body, auth: true });
}
