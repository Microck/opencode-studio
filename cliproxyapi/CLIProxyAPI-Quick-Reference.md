# CLIProxyAPI Quick Reference

## Essential Commands

### CLI Commands

```bash
# Start server (default config)
cliproxyapi

# Start with custom config
cliproxyapi --config /path/to/config.yaml

# Start with specific port
cliproxyapi --port 8318

# Start with debug mode
cliproxyapi --debug

# Start with password (local management only)
cliproxyapi --password your-password

# OAuth Login
cliproxyapi --claude-login          # Claude Code
cliproxyapi --codex-login           # OpenAI/Codex
cliproxyapi --login                 # Gemini
cliproxyapi --qwen-login            # Qwen Code
cliproxyapi --antigravity-login     # Antigravity
cliproxyapi --iflow-login           # iFlow

# Management
cliproxyapi doctor                 # Health check
cliproxyapi list-models            # List available models
```

### Installation Methods

```bash
# macOS
brew install cliproxyapi
brew services start cliproxyapi

# Linux
curl -fsSL https://raw.githubusercontent.com/brokechubb/cliproxyapi-installer/refs/heads/master/cliproxyapi-installer | bash

# Windows (download release)
# Download from: https://github.com/router-for-me/CLIProxyAPI/releases

# Docker
docker run --rm -p 8317:8317 eceasy/cli-proxy-api:latest

# Build from source
go build -o cli-proxy-api ./cmd/server
```

## API Endpoints

### OpenAI Compatible

```
POST /v1/chat/completions     # Chat completions (OpenAI, Claude, Gemini)
POST /v1/responses            # OpenAI Responses API
GET  /v1/models               # List available models
```

### Anthropic Compatible

```
POST /v1/messages             # Anthropic Messages API (Claude)
```

### Management API

```
Base URL: http://localhost:8317/v0/management

GET  /config                   # Get full configuration
GET  /config.yaml             # Download YAML config
PUT  /config.yaml             # Replace config
GET  /usage                   # Get usage statistics
POST /usage/import            # Import usage snapshot
GET  /usage/export            # Export usage snapshot
GET  /api-keys               # List API keys
PUT  /api-keys               # Replace API keys
PATCH /api-keys              # Modify API key
DELETE /api-keys            # Delete API key
GET/PATCH/debug            # Get/Set debug mode
GET/PATCH/logging-to-file    # Enable/disable file logging
GET  /logs                  # Stream recent log lines
DELETE /logs                # Clear logs
GET/PATCH/usage-statistics-enabled  # Enable/disable usage stats
```

## Supported Models

### Gemini
- `gemini-3-pro-preview`
- `gemini-3-pro-image-preview`
- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`
- `gemini-2.5-flash-image`

### OpenAI/Codex
- `gpt-5`
- `gpt-5-codex`

### Claude
- `claude-opus-4-5-20251101`
- `claude-sonnet-4-5-20250929`
- `claude-haiku-4-5-20251001`
- `claude-3-7-sonnet-20250219`
- `claude-3-5-haiku-20241022`

### Qwen
- `qwen3-coder-plus`
- `qwen3-coder-flash`
- `qwen3-max`
- `qwen3-vl-plus`

### Others
- `deepseek-v3.2`
- `deepseek-v3.1`
- `deepseek-r1`
- `deepseek-v3`
- `kimi-k2`
- `glm-4.6`
- `tstars2.0`

## Configuration File Structure

### Core Settings

```yaml
host: ""                    # Bind address ("" = all interfaces)
port: 8317                 # Server port
tls:
  enable: false
  cert: ""
  key: ""

auth-dir: "~/.cli-proxy-api"   # Credential directory
api-keys: []                # Proxy authentication keys

debug: false
logging-to-file: false
logs-max-total-size-mb: 0
usage-statistics-enabled: false

proxy-url: ""               # Global proxy (socks5/http/https)

request-retry: 3
max-retry-interval: 30

routing:
  strategy: "round-robin"   # or "fill-first"

ws-auth: false
```

### Provider Configuration

```yaml
gemini-api-key:
  - api-key: "..."
    prefix: "optional"
    base-url: "..."
    proxy-url: "..."
    headers: {...}
    models:
      - name: "..."
        alias: "..."
    excluded-models: [...]

claude-api-key:           # Same structure
codex-api-key:            # Same structure
qwen-api-key:             # Same structure
iflow-api-key:            # Same structure
```

### OpenAI Compatibility

```yaml
openai-compatibility:
  - name: "provider-name"
    prefix: "optional"
    base-url: "..."
    api-key-entries:
      - api-key: "..."
        proxy-url: "..."
    models:
      - name: "..."
        alias: "..."
```

### OAuth Aliases

```yaml
oauth-model-alias:
  gemini-cli:
    - name: "gemini-2.5-pro"
      alias: "friendly-name"
  claude:
    - name: "claude-sonnet-4-5"
      alias: "cs"
  # ... other channels
```

## Common Tasks

### Start Server

```bash
# Default
./cli-proxy-api

# With options
./cli-proxy-api --port 8318 --debug
```

### Add API Key

```bash
# Via Management API
curl -X PATCH \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"value":"new-key"}' \
  http://localhost:8317/v0/management/api-keys
```

### Test Connection

```bash
# Health check
curl http://127.0.0.1:8317/healthz

# List models
curl -H "Authorization: Bearer your-api-key" \
  http://127.0.0.1:8317/v1/models

# Test request
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"model":"claude-sonnet-4-5","messages":[{"role":"user","content":"test"}]}' \
  http://127.0.0.1:8317/v1/chat/completions
```

### View Logs

```bash
# If file logging enabled
tail -f logs/cli-proxy-api.log

# Via Management API
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  http://localhost:8317/v0/management/logs
```

### Export Usage

```bash
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  http://localhost:8317/v0/management/usage/export > usage-export.json
```

## Environment Variables

| Variable | Description |
|-----------|-------------|
| `MANAGEMENT_PASSWORD` | Ephemeral management secret (not persisted) |
| `CLI_PROXY_CONFIG_PATH` | Override config file path |
| `CLI_PROXY_AUTH_DIR` | Override auth directory path |

## Error Codes

| Code | Description |
|-------|-------------|
| 200 | Success |
| 400 | Bad request / Invalid parameters |
| 401 | Unauthorized (missing/invalid API key) |
| 403 | Forbidden / Quota exceeded |
| 404 | Not found / Management key not configured |
| 422 | Unprocessable entity / Invalid config |
| 429 | Rate limited / Quota exceeded |
| 500 | Internal server error |
| 502-504 | Upstream errors (retry triggered) |

## Troubleshooting

### Port Already in Use

```bash
# macOS/Linux
lsof -i :8317

# Windows
netstat -ano | findstr :8317
```

**Solution:** Change port in config or stop conflicting process.

### Authentication Failed

1. Verify `api-keys` configuration
2. Check Management API key
3. Re-run OAuth login: `cliproxyapi --claude-login`
4. Enable debug: `debug: true`

### Model Not Found

1. List models: `GET /v1/models`
2. Check `excluded-models` config
3. Verify model name spelling

### CORS Issues

1. Verify `api-keys` match between client and server
2. Check client base URL
3. Ensure `api-keys` includes client's key

## SDK Quick Start

```bash
go get github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy
```

```go
import "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy"

svc, err := cliproxy.NewBuilder().
    WithConfig(cfg).
    Build()

ctx := context.Background()
svc.Run(ctx)
```

## Key Files Locations

| File | Location | Purpose |
|-------|-----------|---------|
| `config.yaml` | Project root / specified via `--config` | Server configuration |
| `~/.cli-proxy-api/auth/` | Home directory | OAuth tokens |
| `logs/` | Project root / config dir | Log files (if enabled) |
| `auths/` | Project root / config dir | Additional auth files |

## Best Practices

1. **Always use config file** (don't rely on defaults)
2. **Set strong management keys** with high entropy
3. **Enable file logging** in production
4. **Monitor usage statistics** regularly
5. **Use round-robin** for better quota utilization
6. **Test configuration** before production deployment
7. **Keep backups** of config.yaml
8. **Use HTTPS** for remote management access
9. **Implement retry logic** in clients
10. **Handle quota exceeded** gracefully

## Resources

- [Official Docs](https://help.router-for.me/)
- [GitHub](https://github.com/router-for-me/CLIProxyAPI)
- [Issues](https://github.com/router-for-me/CLIProxyAPI/issues)
- [Releases](https://github.com/router-for-me/CLIProxyAPI/releases)
