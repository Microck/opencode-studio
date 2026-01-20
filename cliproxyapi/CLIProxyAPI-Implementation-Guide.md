# CLIProxyAPI - Complete Implementation Guide

## Overview

**CLIProxyAPI** is a proxy server that provides OpenAI/Gemini/Claude/Codex compatible API interfaces for CLI tools. It wraps OAuth-based CLI tools (Gemini, OpenAI Codex, Claude Code, Qwen Code, iFlow, Antigravity) and exposes them as standard APIs.

### Key Benefits

- Use your existing subscriptions instead of separate API billing
- Connect any tool that supports custom API endpoints
- Run locally with full control
- Multi-account load balancing for higher quotas

## Quick Start

### Installation

#### macOS
```bash
brew install cliproxyapi
brew services start cliproxyapi
```

#### Linux
```bash
curl -fsSL https://raw.githubusercontent.com/brokechubb/cliproxyapi-installer/refs/heads/master/cliproxyapi-installer | bash
```

#### Windows
Download the latest release from [GitHub Releases](https://github.com/router-for-me/CLIProxyAPI/releases) or use the desktop GUI app.

#### Docker
```bash
docker run --rm -p 8317:8317 \
  -v /path/to/your/config.yaml:/CLIProxyAPI/config.yaml \
  -v /path/to/your/auth-dir:/root/.cli-proxy-api \
  eceasy/cli-proxy-api:latest
```

#### Build from Source
```bash
git clone https://github.com/router-for-me/CLIProxyAPI.git
cd CLIProxyAPI
go build -o cli-proxy-api ./cmd/server
./cli-proxy-api
```

### First Run

1. Copy example config: `cp config.example.yaml config.yaml`
2. Run server: `./cli-proxy-api` (or `cliproxyapi` if installed via brew)
3. Server starts on `http://localhost:8317`

## Authentication Methods

### OAuth Providers

Authenticate via browser popup on first run. Tokens are cached locally and auto-refreshed.

```bash
# Claude (Claude Code CLI)
cliproxyapi --claude-login

# OpenAI/Codex
cliproxyapi --codex-login

# Gemini
cliproxyapi --login

# Qwen
cliproxyapi --qwen-login

# Antigravity
cliproxyapi --antigravity-login
```

### API Key Providers

Use API keys for services that don't support OAuth (OpenRouter, GLM, Kimi, etc.) - configured in `config.yaml`.

## Configuration

### Basic Config (`config.yaml`)

```yaml
# Server settings
host: ""        # "" = all interfaces, "127.0.0.1" = localhost only
port: 8317

# TLS (optional)
tls:
  enable: false
  cert: ""
  key: ""

# Management API
remote-management:
  allow-remote: false   # Enable remote management access
  secret-key: "your-key"  # Management API authentication key

# Auth directory (supports ~)
auth-dir: "~/.cli-proxy-api"

# API keys for proxy authentication
api-keys:
  - "your-api-key-1"
  - "your-api-key-2"

# Debug & logging
debug: false
logging-to-file: false
logs-max-total-size-mb: 0  # 0 = no limit

# Performance
commercial-mode: false  # Disable high-overhead middleware
usage-statistics-enabled: false

# Global proxy
proxy-url: ""

# Request handling
request-retry: 3
max-retry-interval: 30

# Quota handling
quota-exceeded:
  switch-project: true
  switch-preview-model: true

# Routing
routing:
  strategy: "round-robin"  # or "fill-first"

# WebSocket auth
ws-auth: false
```

### Provider Configuration

#### Gemini API Keys

```yaml
gemini-api-key:
  - api-key: "AIzaSy..."
    prefix: "test"  # Require "test/gemini-3-pro" to use this key
    base-url: "https://generativelanguage.googleapis.com"
    proxy-url: "socks5://user:pass@proxy.com:1080"
    headers:
      X-Custom-Header: "value"
    models:
      - name: "gemini-2.5-pro"
        alias: "g2.5p"
    excluded-models:
      - "gemini-1.5-pro"
      - "*-preview"
      - "*flash*"
```

#### Codex (OpenAI) API Keys

```yaml
codex-api-key:
  - api-key: "sk-..."
    prefix: "prod"
    base-url: "https://api.openai.com/v1"
    proxy-url: ""
    headers:
      X-Team: "cli"
    models:
      - name: "gpt-5"
        alias: "g5"
    excluded-models:
      - "*-mini"
      - "*codex*"
```

#### Claude API Keys

```yaml
claude-api-key:
  - api-key: "sk-ant-..."
    base-url: ""
    proxy-url: ""
    models:
      - name: "claude-sonnet-4-5-20250929"
        alias: "claude-sonnet-latest"
    excluded-models:
      - "*-thinking"
      - "*haiku*"
```

#### OpenAI Compatibility (OpenRouter, etc.)

```yaml
openai-compatibility:
  - name: "openrouter"
    prefix: "router"
    base-url: "https://openrouter.ai/api/v1"
    api-key-entries:
      - api-key: "sk-or-v1..."
        proxy-url: ""
    models:
      - name: "moonshotai/kimi-k2:free"
        alias: "kimi-k2"
```

### OAuth Model Aliases

```yaml
oauth-model-alias:
  antigravity:
    - name: "gemini-3-pro-image"
      alias: "gemini-3-pro-image-preview"
  gemini-cli:
    - name: "gemini-2.5-pro"
      alias: "g2.5p"
  claude:
    - name: "claude-sonnet-4-5"
      alias: "cs4.5"
```

### Payload Configuration

```yaml
payload:
  default:
    - models:
        - name: "gemini-*"
          protocol: "gemini"
      params:
        generationConfig.thinkingConfig.thinkingBudget: 32768
  default-raw:
    - models:
        - name: "gpt-*"
          protocol: "codex"
      params:
        response_format: '{"type":"json_schema","json_schema":{"name":"answer","schema":{"type":"object"}}'
  override:
    - models:
        - name: "gemini-2.5-pro"
          protocol: "gemini"
      params:
        generationConfig.responseJsonSchema: '{"type":"object","properties":{"answer":{"type":"string"}}'
```

## API Endpoints

### OpenAI Compatible

```
POST /v1/chat/completions  # Chat completions
POST /v1/responses         # OpenAI Responses API
GET  /v1/models               # List available models
```

### Anthropic Compatible

```
POST /v1/messages             # Anthropic Messages API
```

### Gemini Compatible

```
POST /v1/generate             # Gemini generate endpoint
```

### Management API

Base URL: `http://localhost:8317/v0/management`

**Authentication:**
```bash
# All requests require management key
Authorization: Bearer <MANAGEMENT_KEY>
# or
X-Management-Key: <MANAGEMENT_KEY>
```

#### Key Endpoints

- `GET /config` - Get full config
- `GET /config.yaml` - Download YAML config
- `PUT /config.yaml` - Replace config
- `GET /usage` - Get usage statistics
- `POST /usage/import` - Import usage snapshot
- `GET /usage/export` - Export usage snapshot
- `GET /api-keys` - List API keys
- `PUT /api-keys` - Replace API keys
- `PATCH /api-keys` - Modify API key
- `DELETE /api-keys` - Delete API key

## Supported Models

### Gemini
- gemini-3-pro-preview
- gemini-3-pro-image-preview
- gemini-2.5-pro
- gemini-2.5-flash
- gemini-2.5-flash-lite
- gemini-2.5-flash-image
- gemini-2.5-flash-image-preview

### OpenAI/Codex
- gpt-5
- gpt-5-codex

### Claude
- claude-opus-4-5-20251101
- claude-sonnet-4-5-20250929
- claude-haiku-4-5-20251001
- claude-3-7-sonnet-20250219
- claude-3-5-haiku-20241022

### Qwen
- qwen3-coder-plus
- qwen3-coder-flash
- qwen3-max
- qwen3-vl-plus

### Others
- deepseek-v3.2
- deepseek-v3.1
- deepseek-r1
- deepseek-v3
- kimi-k2
- glm-4.6
- tstars2.0

## SDK Integration

### Installation

```bash
go get github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy
```

### Basic Embedding

```go
package main

import (
    "context"
    "log"
    "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy"
)

func main() {
    cfg, err := config.LoadConfig("config.yaml")
    if err != nil {
        panic(err)
    }

    svc, err := cliproxy.NewBuilder().
        WithConfig(cfg).
        WithConfigPath("config.yaml").
        Build()
    if err != nil {
        panic(err)
    }

    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    if err := svc.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
        panic(err)
    }
}
```

### With Custom Options

```go
svc, _ := cliproxy.NewBuilder().
    WithConfig(cfg).
    WithConfigPath("config.yaml").
    WithServerOptions(
        cliproxy.WithMiddleware(func(c *gin.Context) {
            c.Header("X-Embed", "1")
            c.Next()
        }),
        cliproxy.WithEngineConfigurator(func(e *gin.Engine) {
            e.ForwardedByClientIP = true
        }),
        cliproxy.WithRouterConfigurator(func(e *gin.Engine, _ *handlers.BaseAPIHandler, _ *config.Config) {
            e.GET("/healthz", func(c *gin.Context) {
                c.String(200, "ok")
            })
        }),
    ).
    Build()
```

## Integration Examples

### Claude Code CLI

Create `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8317",
    "ANTHROPIC_AUTH_TOKEN": "your-api-key"
  }
}
```

### Codex CLI

Edit `~/.codex/config.toml`:

```toml
[openai]
api_base_url = "http://127.0.0.1:8317"
api_key = "your-api-key"
```

### Custom Application (Python)

```python
import openai

client = openai.OpenAI(
    api_key="your-api-key",
    base_url="http://127.0.0.1:8317",
)

response = client.chat.completions.create(
    model="claude-sonnet-4-5",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

### Custom Application (Node.js)

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'your-api-key',
  baseURL: 'http://127.0.0.1:8317',
});

const completion = await openai.chat.completions.create({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(completion.choices[0].message.content);
```

## Advanced Features

### Multi-Account Load Balancing

**Round-Robin:** Distributes requests across all available accounts evenly.

**Fill-First:** Uses the first available account until quota is exceeded, then switches.

Configure in `config.yaml`:

```yaml
routing:
  strategy: "round-robin"  # or "fill-first"
```

### Model Exclusion Patterns

- Exact match: `"gemini-2.5-pro"`
- Prefix wildcard: `"gemini-2.5-*"`
- Suffix wildcard: `"*-preview"`
- Substring wildcard: `"*flash*"`

### Quota Auto-Switch

When quota is exceeded:

```yaml
quota-exceeded:
  switch-project: true          # Switch to another project
  switch-preview-model: true   # Switch to preview model
```

### Custom Headers

Add custom HTTP headers per API key:

```yaml
gemini-api-key:
  - api-key: "AIzaSy..."
    headers:
      X-Custom-Header: "value"
      Another-Header: "another"
```

## Troubleshooting

### Common Issues

**1. Port already in use:**
```bash
# Check what's using port 8317
lsof -i :8317  # macOS/Linux
netstat -ano | findstr :8317  # Windows

# Change port in config.yaml
port: 8318
```

**2. Authentication failures:**
- Verify `api-keys` in config match what you're sending
- Check management key for Management API calls
- For OAuth: Re-run login command: `cliproxyapi --claude-login`

**3. CORS errors:**
- Ensure `api-keys` are correctly configured
- Check client is sending correct base URL

**4. Model not found:**
- Verify model name in request matches available models
- Check `excluded-models` configuration
- Try listing models: `curl http://localhost:8317/v1/models`

### Debug Mode

Enable verbose logging:

```yaml
debug: true
logging-to-file: true
```

View logs in real-time:

```bash
tail -f logs/cli-proxy-api.log
```

## Security Best Practices

1. **Restrict access:**
   ```yaml
   host: "127.0.0.1"  # Only allow localhost
   ```

2. **Use strong management keys:**
   ```yaml
   remote-management:
     secret-key: "your-very-strong-random-key"
   ```

3. **Disable remote management:**
   ```yaml
   remote-management:
     allow-remote: false
   ```

4. **Use HTTPS:**
   ```yaml
   tls:
     enable: true
     cert: "/path/to/cert.pem"
     key: "/path/to/key.pem"
   ```

## Community Projects Using CLIProxyAPI

- [CCS](https://github.com/kaitranntt/ccs) - CLI wrapper for account switching
- [ProxyPilot](https://github.com/Finesssee/ProxyPilot) - Windows fork with TUI
- [VibeProxy](https://github.com/automazeio/vibeproxy) - macOS menu bar app
- [ProxyPal](https://github.com/heyhuynhgiabuu/proxypal) - macOS GUI for management
- [ZeroLimit](https://github.com/0xtbug/zero-limit) - Windows quota monitoring app

## Additional Resources

- [Official Documentation](https://help.router-for.me/)
- [GitHub Repository](https://github.com/router-for-me/CLIProxyAPI)
- [Issues](https://github.com/router-for-me/CLIProxyAPI/issues)
- [Management Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center)

## License

MIT License - see [LICENSE](https://github.com/router-for-me/CLIProxyAPI/blob/main/LICENSE)
