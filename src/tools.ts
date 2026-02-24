import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as api from './api.js';
import { getApiKey } from './config.js';

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

const hashSchema = z
  .string()
  .regex(HASH_PATTERN, 'Must be "sha256:" followed by 64 hex characters')
  .describe('SHA-256 composite hash of the skill (e.g. "sha256:4a2f8b...c81e")');

function formatScore(score: number): string {
  if (score >= 80) return `${score.toFixed(1)} (safe)`;
  if (score >= 50) return `${score.toFixed(1)} (caution)`;
  return `${score.toFixed(1)} (danger)`;
}

/** Register all skvil tools on the MCP server. */
export function registerTools(server: McpServer): void {
  // ── skvil_verify ──────────────────────────────────────────────────────────
  server.tool(
    'skvil_verify',
    'Check if an AI agent skill is safe before installing it. Returns reputation ' +
      'score, risk level, certification status, and community scan data. ' +
      'Use this to verify any skill by its SHA-256 composite hash.',
    { hash: hashSchema },
    async ({ hash }) => {
      try {
        const result = await api.verify(hash);

        if (!result.known) {
          return {
            content: [
              {
                type: 'text',
                text:
                  `**Unknown skill** (${hash})\n\n` +
                  'This skill has never been scanned by the Skvil network.\n' +
                  'It has no reputation data or certification.\n\n' +
                  '**Recommendation:** Do not install without scanning first.',
              },
            ],
          };
        }

        const score = result.reputation_score ?? 0;
        const totalScans = result.total_scans ?? 0;

        const lines: string[] = [
          `**Skill verification: ${hash}**\n`,
          `- **Reputation score:** ${formatScore(score)}`,
          `- **Total community scans:** ${totalScans}`,
          `- **Risk level:** ${result.risk_summary?.last_risk_level ?? 'unknown'}`,
        ];

        if (result.certification) {
          lines.push(`- **Certification:** ${result.certification}`);
        } else {
          lines.push('- **Certification:** none');
        }

        if (result.confirmed_malicious) {
          lines.push(
            '\n**CONFIRMED MALICIOUS** — a Skvil admin has verified this skill is dangerous.',
          );
          lines.push('Do NOT install this skill.');
        }

        if (result.risk_summary) {
          const f = result.risk_summary.findings_by_severity;
          const critical = f.critical ?? 0;
          const high = f.high ?? 0;
          const medium = f.medium ?? 0;
          const low = f.low ?? 0;
          if (critical > 0 || high > 0) {
            lines.push(
              `\n**Findings:** ${critical} critical, ${high} high, ${medium} medium, ${low} low`,
            );
          }
        }

        if (result.crucible) {
          lines.push(`\n**Crucible behavioral analysis:** ${result.crucible.status}`);
          lines.push(`- Behavioral score: ${result.crucible.score}`);
          if (result.crucible.behavioral_findings.length > 0) {
            const descriptions = result.crucible.behavioral_findings
              .map((f) => f.description)
              .join(', ');
            lines.push(`- Findings: ${descriptions}`);
          }
        }

        // Decision recommendation
        lines.push('\n**Recommendation:**');
        if (result.confirmed_malicious) {
          lines.push('Do NOT install. This skill has been confirmed malicious.');
        } else if (result.crucible?.status === 'malicious') {
          lines.push('Do NOT install. Behavioral analysis detected malicious activity.');
        } else if (score >= 80 && result.certification) {
          lines.push(
            `Safe to install. This skill is certified (${result.certification}) ` +
              'with a strong reputation score.',
          );
        } else if (score >= 60) {
          lines.push('Likely safe, but not yet certified. Install with caution.');
        } else if (score < 40) {
          lines.push('Do NOT install. Low reputation score indicates potential risk.');
        } else {
          lines.push('Proceed with caution. Review findings before installing.');
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        return { content: [{ type: 'text', text: formatError('verify', error) }], isError: true };
      }
    },
  );

  // ── skvil_stats ───────────────────────────────────────────────────────────
  server.tool(
    'skvil_stats',
    'Get aggregate statistics from the Skvil community network: total skills ' +
      'scanned, trusted count, critical findings, and certified skills.',
    {},
    async () => {
      try {
        const result = await api.stats();
        return {
          content: [
            {
              type: 'text',
              text:
                '**Skvil community statistics**\n\n' +
                `- **Total skills scanned:** ${result.total}\n` +
                `- **Trusted** (reputation >= 70): ${result.trusted}\n` +
                `- **Critical findings:** ${result.critical}\n` +
                `- **Certified:** ${result.certified}`,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: formatError('stats', error) }], isError: true };
      }
    },
  );

  // ── skvil_certified ───────────────────────────────────────────────────────
  server.tool(
    'skvil_certified',
    'List skills that have been verified and certified by Skvil admins. ' +
      'Certified skills have been manually reviewed and registered for ' +
      'tamper-proof verification. Returns up to 10 most recently certified ' +
      'skills with their level (V1/V2/V3/Gold), reputation score, and ' +
      'certification date.',
    {},
    async () => {
      try {
        const result = await api.certified();

        if (result.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No skills are currently certified. Be the first to get certified!',
              },
            ],
          };
        }

        const lines = ['**Certified skills**\n'];

        for (const skill of result) {
          lines.push(
            `- **${skill.name}** — ${skill.level} | Score: ${formatScore(skill.reputation_score)} | ` +
              `${skill.total_scans} scans | Certified: ${skill.certified_at}\n` +
              `  Hash: \`${skill.composite_hash}\``,
          );
        }

        lines.push(
          '\nAll certifications are registered for tamper-proof, publicly verifiable trust.',
        );

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text', text: formatError('certified', error) }],
          isError: true,
        };
      }
    },
  );

  // ── skvil_catalog ──────────────────────────────────────────────────────────
  server.tool(
    'skvil_catalog',
    'Browse the full catalog of Skvil-certified AI agent skills with detailed ' +
      'metadata: author, version, description, provider, agent platform, file ' +
      'count, and install URL. Returns up to 100 skills. Use this to discover ' +
      'safe skills available for installation.',
    {},
    async () => {
      try {
        const result = await api.catalog();

        if (result.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'The skill catalog is empty. No certified skills available yet.',
              },
            ],
          };
        }

        const lines = [`**Skvil skill catalog** (${result.length} certified skills)\n`];

        for (const skill of result) {
          const parts = [`- **${skill.name}**`];
          parts.push(`  Level: ${skill.level} | Score: ${formatScore(skill.reputation_score)} | ${skill.total_scans} scans`);
          if (skill.author) parts.push(`  Author: ${skill.author}`);
          if (skill.version) parts.push(`  Version: ${skill.version}`);
          if (skill.description) parts.push(`  ${skill.description}`);
          if (skill.provider) parts.push(`  Provider: ${skill.provider}`);
          if (skill.agent) parts.push(`  Agent: ${skill.agent}`);
          parts.push(`  Files: ${skill.file_count} | Certified: ${skill.certified_at}`);
          if (skill.skill_url) parts.push(`  Install: ${skill.skill_url}`);
          parts.push(`  Hash: \`${skill.composite_hash}\``);
          lines.push(parts.join('\n'));
        }

        return { content: [{ type: 'text', text: lines.join('\n\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text', text: formatError('catalog', error) }],
          isError: true,
        };
      }
    },
  );

  // ── skvil_register ────────────────────────────────────────────────────────
  server.tool(
    'skvil_register',
    'Register for a free Skvil API key. The key is automatically cached ' +
      'locally for future use. No sign-up or account required. Other tools ' +
      '(skvil_scan, skvil_report) will use the cached key automatically.',
    {},
    async () => {
      try {
        const existing = getApiKey();
        if (existing) {
          return {
            content: [
              {
                type: 'text',
                text:
                  'An API key is already configured.\n\n' +
                  'To register a new key, unset the `SKVIL_API_KEY` env var and ' +
                  'delete `~/.skvil/mcp-config.json`, then try again.',
              },
            ],
          };
        }

        const result = await api.register();
        return {
          content: [
            {
              type: 'text',
              text:
                '**API key registered successfully!**\n\n' +
                `- **Key prefix:** ${result.key_prefix}...\n` +
                `- **Tier:** ${result.tier}\n\n` +
                'The key has been cached in `~/.skvil/mcp-config.json`.\n' +
                'You can now use `skvil_scan` and `skvil_report`.',
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: formatError('register', error) }],
          isError: true,
        };
      }
    },
  );

  // ── skvil_report ──────────────────────────────────────────────────────────
  server.tool(
    'skvil_report',
    'Report a suspicious or malicious AI agent skill to Skvil admins for review. ' +
      'Requires an API key (use skvil_register first). Reports are reviewed by ' +
      'admins and confirmed findings lead to certification revocation.',
    {
      hash: hashSchema,
      reason: z
        .string()
        .min(10)
        .max(1000)
        .describe('Why this skill is suspicious (10-1000 characters)'),
      details: z
        .string()
        .max(5000)
        .optional()
        .describe('Additional details or evidence (optional, max 5000 characters)'),
    },
    async ({ hash, reason, details }) => {
      try {
        const result = await api.report(hash, reason, details);
        return {
          content: [
            {
              type: 'text',
              text:
                '**Report submitted successfully**\n\n' +
                `- **Report ID:** ${result.report_id}\n` +
                `- **Status:** ${result.status}\n` +
                `- **Skill hash:** ${hash}\n\n` +
                'A Skvil admin will review this report. If confirmed, the skill ' +
                'will be flagged as malicious and any existing certification ' +
                'will be revoked.',
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: formatError('report', error) }], isError: true };
      }
    },
  );

  // ── skvil_scan ────────────────────────────────────────────────────────────
  server.tool(
    'skvil_scan',
    'Submit security scan results for an AI agent skill to the Skvil reputation ' +
      'network. Contributes to the community reputation score (EMA). Requires an ' +
      'API key (use skvil_register first). The server recomputes the score from ' +
      'findings — always provide accurate findings.',
    {
      name: z.string().max(256).describe('Skill name'),
      composite_hash: hashSchema,
      file_count: z.number().int().min(0).max(10000).describe('Number of files in the skill'),
      file_hashes: z
        .record(
          z
            .string()
            .max(500)
            .regex(/^[a-zA-Z0-9_\-./]+$/, 'Invalid file path'),
          z.string().regex(/^[a-f0-9]{64}$/, 'Must be 64 hex characters'),
        )
        .describe('Map of relative file paths to their SHA-256 hex hashes'),
      score: z.number().int().min(0).max(100).describe('Computed security score (0-100)'),
      risk_level: z.enum(['safe', 'caution', 'danger']).describe('Overall risk assessment'),
      findings: z
        .array(
          z.object({
            severity: z.enum(['critical', 'high', 'medium', 'low']),
            category: z.string().max(100),
            description: z.string().max(1000),
            file: z.string().max(500),
            line: z.number().int().optional(),
          }),
        )
        .max(500)
        .default([])
        .describe('Security findings detected in the skill'),
      frontmatter: z
        .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .optional()
        .describe('SKILL.md frontmatter metadata (optional)'),
      skill_url: z
        .string()
        .max(512)
        .regex(
          /^https:\/\/(github\.com|gitlab\.com|clawhub\.ai)\/[^/]+\/[^/].*$/,
          'Must be a GitHub, GitLab, or ClawHub HTTPS URL',
        )
        .describe('Source URL of the skill (e.g. "https://github.com/user/repo")'),
      provider: z
        .enum(['github', 'gitlab', 'clawhub'])
        .describe('Platform hosting the skill'),
      agent: z
        .string()
        .max(50)
        .describe('Agent platform submitting the scan (e.g. "claude", "codex", "openclaw")'),
    },
    async (params) => {
      try {
        const result = await api.scan(params);
        const lines = [
          '**Scan submitted successfully**\n',
          `- **Scan ID:** ${result.scan_id}`,
          `- **Updated reputation:** ${formatScore(result.reputation_score)}`,
          `- **Total community scans:** ${result.total_scans}`,
        ];

        if (result.certification) {
          lines.push(`- **Certification:** ${result.certification}`);
        }

        lines.push(
          '\nYour scan contributes to the community reputation via exponential ' +
            'moving average (EMA). Thank you for helping secure the AI skill ecosystem.',
        );

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        return { content: [{ type: 'text', text: formatError('scan', error) }], isError: true };
      }
    },
  );
}

function formatError(tool: string, error: unknown): string {
  if (error instanceof api.SkvilApiError) {
    if (error.status === 429) {
      return `**Rate limit exceeded** — ${error.detail}\nTry again later.`;
    }
    if (error.status === 401) {
      return (
        `**Authentication required** — ${error.detail}\n` +
        'Use `skvil_register` to get a free API key.'
      );
    }
    const safeDetail = error.detail.slice(0, 500);
    return `**Error in skvil_${tool}** (HTTP ${error.status})\n${safeDetail}`;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return '**Timeout** — the Skvil API did not respond in time. Try again.';
    }
    return `**Error in skvil_${tool}**\n${error.message}`;
  }

  return `**Unexpected error in skvil_${tool}**\n${String(error)}`;
}
