<div align="center">

# skvil-mcp

**MCP server for the Skvil security scanner**

Verify, scan, and check on-chain certifications for AI agent skills — directly from your AI assistant.

[![npm version](https://img.shields.io/npm/v/@skvil/mcp-server)](https://www.npmjs.com/package/@skvil/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-8B5CF6)](https://modelcontextprotocol.io)

</div>

---

## Why skvil-mcp?

AI agents install skills from the internet — but how do you know a skill is safe?

Skvil is a community-powered security scanner that analyzes AI agent skills for malicious patterns, builds reputation scores through crowdsourced scans, and issues **on-chain certifications** that are tamper-proof and publicly verifiable.

This MCP server gives your AI agent native tools to interact with the Skvil network. No HTTP knowledge required — just ask your agent to verify a skill.

### On-chain certification

Skvil's certification pipeline is what sets it apart — the entire process is **fully automated with zero human intervention**:

1. **Community scanning** — multiple independent agents scan the same skill
2. **Reputation building** — scores aggregate via exponential moving average (EMA)
3. **Crucible analysis** — automated static analysis scans 32+ pattern categories, then an AI triage phase (embeddings + LLM) validates findings and filters false positives
4. **On-chain registration** — skills scoring ≥ 80 are automatically anchored on Solana via SPL Memo transactions, creating a tamper-proof trust anchor that no single party can forge or revoke silently

Certification is algorithmic: score ≥ 50 passes, score < 50 fails and revokes any existing certificate. A periodic re-certification scheduler re-analyzes certified skills and revokes those that no longer pass.

When you run `skvil_verify`, you're not just checking a database — you're verifying against an immutable on-chain record.

---

## Quick start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "skvil": {
      "command": "npx",
      "args": ["-y", "@skvil/mcp-server"]
    }
  }
}
```

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "skvil": {
      "command": "npx",
      "args": ["-y", "@skvil/mcp-server"]
    }
  }
}
```

### VS Code / Cursor

Add to your settings (JSON):

```json
{
  "mcp.servers": {
    "skvil": {
      "command": "npx",
      "args": ["-y", "@skvil/mcp-server"]
    }
  }
}
```

That's it. The server auto-registers a free API key on first use. Zero config.

---

## Tools

| Tool | Auth | Description |
|------|------|-------------|
| `skvil_verify` | No | Check if a skill is safe by its SHA-256 hash. Returns reputation score, risk level, on-chain certification status, and Crucible behavioral analysis. |
| `skvil_stats` | No | Community statistics: total skills scanned, trusted, critical, and on-chain certified counts. |
| `skvil_certified` | No | List skills with active on-chain certifications (V1/V2/V3/Gold). Up to 10 most recent. |
| `skvil_catalog` | No | Browse the full catalog of certified skills with metadata, install URLs, and provider info. Up to 100 skills. |
| `skvil_register` | No | Get a free API key (500 scans/day). Auto-cached locally for future use. |
| `skvil_scan` | Key | Submit security scan results to the community reputation network. Requires full skill identification (see below). |
| `skvil_report` | Key | Report a suspicious skill. Confirmed reports trigger automatic on-chain revocation. |

### skvil_scan — required fields

Every scan submission requires full identification so the Crucible behavioral analysis pipeline can fire:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Skill name (max 256 chars) |
| `composite_hash` | string | `sha256:{64 hex}` — deterministic hash of all skill files |
| `file_count` | number | Number of files in the skill |
| `file_hashes` | object | Map of `"relative/path"` → `"sha256 hex hash"` |
| `score` | number | Computed security score 0-100 (server recomputes from findings) |
| `risk_level` | string | `"safe"` \| `"caution"` \| `"danger"` |
| `skill_url` | string | **Required.** Source URL — must be `https://github.com/...`, `https://gitlab.com/...`, or `https://clawhub.ai/...` |
| `provider` | string | **Required.** `"github"` \| `"gitlab"` \| `"clawhub"` |
| `agent` | string | **Required.** Agent platform submitting the scan (e.g. `"claude"`, `"codex"`, `"openclaw"`) |
| `findings` | array | Security findings (severity, category, description, file, line) |
| `frontmatter` | object | Optional SKILL.md metadata |

Without `skill_url`, the backend skips Crucible forwarding and the skill can never be certified.

### Certification levels

| Level | Meaning |
|-------|---------|
| **V1** | Basic verification — scanned by community, passed automated static analysis (32+ pattern categories + AI triage) |
| **V2** | Enhanced verification — V1 + passed Crucible behavioral analysis in sandboxed environment |
| **V3** | Full verification — V2 + passed periodic re-certification cycles |
| **Gold** | Highest trust — V3 + continuous monitoring, reserved for critical infrastructure skills |

All levels are registered on-chain. The entire certification process is automated — no human review is involved at any level. Higher levels require progressively more rigorous automated verification.

---

## Configuration

### API key

The server automatically registers a free API key on first use and caches it in `~/.skvil/mcp-config.json`.

To use an existing key:

```json
{
  "mcpServers": {
    "skvil": {
      "command": "npx",
      "args": ["-y", "@skvil/mcp-server"],
      "env": {
        "SKVIL_API_KEY": "sk_your_key_here"
      }
    }
  }
}
```

### Custom API URL

For self-hosted or development instances:

```json
{
  "env": {
    "SKVIL_API_URL": "http://localhost:8000"
  }
}
```

### Key resolution order

1. `SKVIL_API_KEY` environment variable
2. Cached key in `~/.skvil/mcp-config.json`
3. Legacy Python client key in `~/.skvil/config`

---

## Examples

### "Is this skill safe to install?"

```
User: Check if sha256:4a2f...c81e is safe

Agent calls skvil_verify → gets reputation, certification, findings

Agent: This skill has a reputation score of 91.2 (safe) and is
       on-chain certified at V2 level. 15 community scans with
       no critical findings. Safe to install.
```

### "What skills are certified?"

```
User: Show me certified skills

Agent calls skvil_certified → gets list of on-chain certified skills

Agent: There are 7 on-chain certified skills:
       1. web-scraper — V2, score 91.2, certified Feb 18
       2. data-pipeline — V1, score 85.0, certified Feb 15
       ...
```

### "Report this suspicious skill"

```
User: Report sha256:dead...beef — it's sending data to an unknown server

Agent calls skvil_report → submits report

Agent: Report #42 submitted. The skill will be re-analyzed
       automatically. If the report is confirmed, the skill
       will be flagged and any on-chain certification will
       be revoked.
```

---

## How it works

```
┌─────────────┐     stdio      ┌────────────┐     HTTPS     ┌──────────────────┐
│  AI Agent   │ ◄────────────► │  skvil-mcp │ ────────────► │  api.skvil.com   │
│  (Claude,   │    MCP tools   │  (local)   │   REST API    │  (reputation DB  │
│   GPT, etc) │                │            │               │   + on-chain)    │
└─────────────┘                └────────────┘               └──────────────────┘
```

The MCP server runs locally as a subprocess of your AI client. It translates MCP tool calls into HTTPS requests to the Skvil API. No data is stored remotely except scan results and reports — and certifications are anchored on-chain for public verification.

---

## Development

```bash
git clone https://github.com/Skvil-IA/skvil-mcp.git
cd skvil-mcp
npm install
npm run build
```

### Run locally

```bash
# Point to local API for development
SKVIL_API_URL=http://localhost:8000 node dist/index.js
```

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Lint & format

```bash
npm run lint
npm run format
npm run typecheck
```

---

## License

[MIT](LICENSE) — Skvil 2026
