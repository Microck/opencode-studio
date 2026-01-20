# CLIProxyAPI Configuration Reference

## Quick Reference

Complete configuration file structure for `config.yaml`.

## Core Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `host` | string | `""` | Bind address. `""` = all interfaces (IPv4 + IPv6). Use `"127.0.0.1"` to restrict to localhost only. |
| `port` | integer | `8317` | Server port. |
| `tls.enable` | boolean | `false` | Enable HTTPS. |
| `tls.cert` | string | `""` | TLS certificate path. |
| `tls.key` | string | `""` | TLS private key path. |
| `auth-dir` | string | `"~/.cli-proxy-api"` | Credential storage directory. `~` supported. |
| `api-keys` | string[] | `[]` | Built-in API keys for proxy authentication. |
| `debug` | boolean | `false` | Verbose logging. |
| `commercial-mode` | boolean | `false` | Disable high-overhead middleware to reduce memory under high concurrency. |
| `logging-to-file` | boolean | `false` | Write rotating log files instead of stdout. |
| `logs-max-total-size-mb` | integer | `0` | Log directory size cap in MB. `0` = no limit. Oldest files deleted when exceeded. |
| `usage-statistics-enabled` | boolean | `false` | Enable in-memory usage aggregation. |
| `proxy-url` | string | `""` | Global proxy URL (socks5/http/https). Example: `socks5://user:pass@192.168.1.1:1080/`. |
| `force-model-prefix` | boolean | `false` | Unprefixed model requests use credentials without prefix (except when prefix == model name). |
| `request-retry` | integer | `3` | Retry requests on HTTP 403, 408, 500, 502, 503, 504. |
| `max-retry-interval` | integer | `30` | Maximum wait time in seconds for a cooled-down credential before triggering retry. |
| `routing.strategy` | string | `"round-robin"` | Routing strategy: `round-robin` or `fill-first`. |
| `ws-auth` | boolean | `false` | Enable authentication for WebSocket API (`/v1/ws`). |
| `nonstream-keepalive-interval` | integer | `0` | Emit blank lines every N seconds for non-streaming responses (prevent idle timeouts). `0` = disabled. |

## Management API

```yaml
remote-management:
  allow-remote: false    # Enable remote (non-localhost) management access
  secret-key: ""         # Management key. Plaintext hashed on startup. Empty = disabled.
  disable-control-panel: false
  panel-github-repository: "https://github.com/router-for-me/Cli-Proxy-API-Management-Center"
```

**Security Notes:**
- All management requests require `secret-key` (even from localhost)
- Remote access requires both `allow-remote: true` AND a non-empty `secret-key`
- 5 consecutive auth failures trigger ~30 minute ban for remote IPs
- Set `MANAGEMENT_PASSWORD` env var for additional ephemeral secret

## OAuth Providers

OAuth providers authenticate via browser popup on first run. Tokens are cached in `~/.cli-proxy-api/auth/` and auto-refreshed.

### Gemini CLI

```yaml
gemini-api-key:
  - api-key: "AIzaSy...01"
    prefix: "test"  # Optional: require "test/gemini-3-pro" to target this credential
    base-url: "https://generativelanguage.googleapis.com"
    headers:
      X-Custom-Header: "custom-value"
    proxy-url: "socks5://proxy.example.com:1080"
    models:
      - name: "gemini-2.5-flash"
        alias: "gemini-flash"
    excluded-models:
      - "gemini-1.5-pro"       # Exclude specific models
      - "gemini-2.5-*"         # Wildcard prefix
      - "*-preview"            # Wildcard suffix
      - "*flash*"               # Wildcard substring
  - api-key: "AIzaSy...02"
    base-url: "https://custom-gemini.com"
```

### Antigravity

Uses same structure as `gemini-api-key`.

### Claude Code

```yaml
claude-api-key:
  - api-key: "sk-ant-..."   # Official Claude API key
    prefix: "prod"
    base-url: ""  # Empty = official Anthropic endpoint
    proxy-url: "socks5://proxy.example.com:1080"
    headers:
      X-Workspace: "team-a"
    models:
      - name: "claude-sonnet-4-5-20250929"
        alias: "claude-sonnet-latest"
    excluded-models:
      - "claude-3-opus"
      - "*-thinking"
      - "*haiku*"
```

### Codex (OpenAI)

```yaml
codex-api-key:
  - api-key: "sk-atSM..."
    prefix: "test"
    base-url: "https://api.openai.com/v1"  # Or custom endpoint
    proxy-url: ""
    headers:
      X-Team: "cli"
    models:
      - name: "gpt-5-codex"
        alias: "codex-latest"
    excluded-models:
      - "gpt-4o-mini"
      - "*-mini"
      - "*codex*"
```

### Qwen Code

Uses same structure as `claude-api-key`.

### iFlow

Uses same structure as `claude-api-key`.

## OpenAI Compatibility Providers

For services like OpenRouter, Kimi, GLM, DeepSeek that expose OpenAI-compatible endpoints:

```yaml
openai-compatibility:
  - name: "openrouter"           # Provider name (used in user agent, etc.)
    prefix: "router"             # Require "router/model-name" to use this provider
    base-url: "https://openrouter.ai/api/v1"
    headers:
      X-Provider: "openrouter"
    api-key-entries:
      - api-key: "sk-or-v1...b780"
        proxy-url: "socks5://proxy.example.com:1080"
      - api-key: "sk-or-v1...b781"
        proxy-url: ""
    models:
      - name: "moonshotai/kimi-k2:free"
        alias: "kimi-k2"
      - name: "deepseek/deepseek-chat"
        alias: "deepseek"
```

## Vertex API Keys

For Vertex-compatible endpoints (API key + base URL):

```yaml
vertex-api-key:
  - api-key: "vk-123..."           # x-goog-api-key header
    prefix: "test"
    base-url: "https://zenmux.ai/api"
    proxy-url: "socks5://proxy.example.com:1080"
    headers:
      X-Custom: "value"
    models:
      - name: "gemini-2.5-flash"
        alias: "vertex-flash"
```

## Amp CLI Integration

```yaml
ampcode:
  upstream-url: "https://ampcode.com"
  upstream-api-key: ""                        # Optional: override Amp upstream key
  upstream-api-keys:                           # Map client API keys to Amp upstream keys
    - upstream-api-key: "amp_key_team_a"
      api-keys:
        - "your-api-key-1"
        - "your-api-key-2"
    - upstream-api-key: "amp_key_team_b"
      api-keys:
        - "your-api-key-3"
  restrict-management-to-localhost: false
  force-model-mappings: false
  model-mappings:
    - from: "claude-opus-4-5-20251101"     # Model requested by Amp CLI
      to: "gemini-claude-opus-4-5-thinking"  # Route to this available model
    - from: "claude-sonnet-4-5-20250929"
      to: "gemini-2.5-flash"
    - from: "claude-haiku-4-5-20251001"
      to: "gemini-2.5-flash"
```

## OAuth Model Aliases

Global model name aliases per channel. Renames model IDs for both model listing and request routing.

**Supported channels:** `gemini-cli`, `vertex`, `aistudio`, `antigravity`, `claude`, `codex`, `qwen`, `iflow`

**NOTE:** Aliases do NOT apply to `gemini-api-key`, `codex-api-key`, `claude-api-key`, `openai-compatibility`, `vertex-api-key`, or `ampcode`.

```yaml
oauth-model-alias:
  antigravity:
    - name: "rev19-uic3-1p"
      alias: "gemini-2.5-computer-use-preview-10-2025"
    - name: "gemini-3-pro-image"
      alias: "gemini-3-pro-image-preview"
  gemini-cli:
    - name: "gemini-2.5-pro"
      alias: "g2.5p"
      fork: true            # Keep original + add alias (default: false)
  vertex:
    - name: "gemini-2.5-pro"
      alias: "g2.5p"
  aistudio:
    - name: "gemini-2.5-pro"
      alias: "g2.5p"
  claude:
    - name: "claude-sonnet-4-5"
      alias: "cs4.5"
  codex:
    - name: "gpt-5"
      alias: "g5"
  qwen:
    - name: "qwen3-coder-plus"
      alias: "qwen-plus"
  iflow:
    - name: "glm-4.7"
      alias: "glm-god"
```

## OAuth Excluded Models

Exclude specific models from OAuth channels. Uses same wildcard patterns as per-key `excluded-models`.

```yaml
oauth-excluded-models:
  gemini-cli:
    - "gemini-2.5-pro"     # Exact match
    - "gemini-2.5-*"       # Prefix wildcard
    - "*-preview"          # Suffix wildcard
    - "*flash*"            # Substring wildcard
  vertex:
    - "gemini-3-pro-preview"
  aistudio:
    - "gemini-3-pro-preview"
  antigravity:
    - "gemini-3-pro-preview"
  claude:
    - "claude-3-5-haiku-20241022"
  codex:
    - "gpt-5-codex-mini"
  qwen:
    - "vision-model"
  iflow:
    - "tstars2.0"
```

## Payload Configuration

Control default parameters sent with requests.

### Default Rules

Only set parameters when missing in payload.

```yaml
payload:
  default:
    - models:
        - name: "gemini-*"      # Supports wildcards
          protocol: "gemini"    # Restrict to specific protocol
      params:
        generationConfig.thinkingConfig.thinkingBudget: 32768
```

### Default Raw

Set parameters using raw JSON (strings used as-is).

```yaml
payload:
  default-raw:
    - models:
        - name: "gpt-*"
          protocol: "codex"
      params:
        response_format: '{"type":"json_schema","json_schema":{"name":"answer","schema":{"type":"object"}}'
```

### Override

Always set parameters, overwriting any existing values.

```yaml
payload:
  override:
    - models:
        - name: "gemini-2.5-pro"
          protocol: "gemini"
      params:
        generationConfig.responseJsonSchema: '{"type":"object","properties":{"answer":{"type":"string"}}'
```

### Override Raw

Always set using raw JSON.

```yaml
payload:
  override-raw:
    - models:
        - name: "gpt-*"
          protocol: "codex"
      params:
        response_format: '{"type":"json_object"}'
```

## Streaming Behavior

```yaml
streaming:
  keepalive-seconds: 15    # SSE keep-alives (default: 0 = disabled)
  bootstrap-retries: 1     # Retries before first byte (default: 0 = disabled)
```

## Codex Instructions

```yaml
codex-instructions-enabled: false  # Enable official Codex instructions injection
```

When `false` (default), `CodexInstructionsForModel` returns immediately without modification.

## Model Exclusion Patterns

All `excluded-models` arrays support these patterns:

- **Exact match:** `"gemini-2.5-pro"` - Block this specific model
- **Prefix wildcard:** `"gemini-2.5-*"` - Block all models starting with `gemini-2.5-`
- **Suffix wildcard:** `"*-preview"` - Block all models ending with `-preview`
- **Substring wildcard:** `"*flash*"` - Block all models containing `flash` anywhere

Examples:
```yaml
excluded-models:
  - "gemini-1.5-pro"           # Only this model
  - "gemini-2.5-*"             # gemini-2.5-pro, gemini-2.5-flash, etc.
  - "*-preview"                # gemini-3-pro-preview, claude-opus-4.5-preview
  - "*flash*"                   # gemini-2.5-flash-lite, gemini-2.5-flash-image
  - "*codex*"                  # gpt-5-codex, gpt-5-codex-mini
```

## Routing Strategies

### Round-Robin

Distributes requests across all available accounts evenly. Best for maximizing total quota utilization.

```yaml
routing:
  strategy: "round-robin"
```

### Fill-First

Uses the first available account until quota is exceeded, then switches to the next. Best for maintaining session consistency.

```yaml
routing:
  strategy: "fill-first"
```

## Hot Reloading

The configuration file supports hot reloading. Modifications to `config.yaml` and files in `auths/` directory are picked up automatically without restarting the program.

**What triggers hot reload:**
- Changes to `config.yaml`
- Changes to files in `auth-dir/`
- OAuth token refreshes
- Management API writes

**What does NOT trigger hot reload:**
- Changes to `api-keys` via Management API (these persist immediately but don't trigger full reload)
- Changes to environment variables (restart required)

## Security Best Practices

### Restrict Access

```yaml
host: "127.0.0.1"  # Only allow localhost
```

### Use Strong Management Keys

```yaml
remote-management:
  secret-key: "use-very-long-random-string-with-mixed-case-numbers-special-chars"
```

### Disable Remote Management

```yaml
remote-management:
  allow-remote: false
```

### Use HTTPS

```yaml
tls:
  enable: true
  cert: "/path/to/cert.pem"
  key: "/path/to/key.pem"
```

### Proxy for Outbound Connections

```yaml
# Global proxy (all providers)
proxy-url: "socks5://user:pass@proxy.example.com:1080"

# Per-provider proxy (overrides global)
gemini-api-key:
  - api-key: "AIzaSy..."
    proxy-url: "socks5://user:pass@proxy.example.com:1080"
```

## Performance Tuning

### Commercial Mode

Disable high-overhead HTTP middleware features to reduce per-request memory usage under high concurrency.

```yaml
commercial-mode: true
```

**Disables:**
- Request logging middleware
- Some CORS handling
- User agent tracking
- Other memory-intensive features

### Log Management

```yaml
# Rotate log files
logging-to-file: true

# Limit total log size
logs-max-total-size-mb: 500  # Auto-delete oldest when exceeded
```

### Usage Statistics

Enable in-memory usage aggregation for monitoring and analytics.

```yaml
usage-statistics-enabled: true
```

**Note:** Statistics reset on server restart. Export periodically via Management API `/usage/export`.

## Environment Variables

| Variable | Purpose |
|-----------|---------|
| `MANAGEMENT_PASSWORD` | Additional ephemeral management secret (not persisted, forces remote management enabled) |
| `CLI_PROXY_CONFIG_PATH` | Override default config file path |
| `CLI_PROXY_AUTH_DIR` | Override default auth directory path |

## Example Full Config

```yaml
# Server
host: "127.0.0.1"
port: 8317

# TLS
tls:
  enable: false
  cert: ""
  key: ""

# Management
remote-management:
  allow-remote: false
  secret-key: "your-secret-key-here"

# Auth
auth-dir: "~/.cli-proxy-api"
api-keys:
  - "client-key-1"
  - "client-key-2"

# Debug & Logging
debug: false
logging-to-file: true
logs-max-total-size-mb: 100
usage-statistics-enabled: false

# Proxy
proxy-url: ""

# Retry
request-retry: 3
max-retry-interval: 30

# Routing
routing:
  strategy: "round-robin"

# WebSocket
ws-auth: false

# Keepalive
nonstream-keepalive-interval: 0

# Streaming
streaming:
  keepalive-seconds: 15
  bootstrap-retries: 1

# Codex
codex-instructions-enabled: false

# OAuth Model Aliases
oauth-model-alias:
  gemini-cli:
    - name: "gemini-2.5-pro"
      alias: "g2.5p"

# OAuth Excluded Models
oauth-excluded-models:
  gemini-cli:
    - "gemini-1.5-pro"

# Gemini API Keys
gemini-api-key:
  - api-key: "AIzaSy..."
    base-url: "https://generativelanguage.googleapis.com"
    models:
      - name: "gemini-2.5-pro"
        alias: "g2.5p"

# Codex API Keys
codex-api-key:
  - api-key: "sk-..."
    base-url: "https://api.openai.com/v1"
    models:
      - name: "gpt-5"
        alias: "g5"

# Claude API Keys
claude-api-key:
  - api-key: "sk-ant-..."
    models:
      - name: "claude-sonnet-4-5-20250929"
        alias: "claude-sonnet-latest"

# OpenAI Compatibility
openai-compatibility:
  - name: "openrouter"
    base-url: "https://openrouter.ai/api/v1"
    api-key-entries:
      - api-key: "sk-or-v1..."
    models:
      - name: "deepseek/deepseek-chat"
        alias: "deepseek"
```
