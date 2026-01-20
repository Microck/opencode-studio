# CLIProxyAPI Implementation Plan

## Overview

This document provides a no-error plan for implementing CLIProxyAPI into your application. It covers everything you need to know from installation to production deployment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Options](#installation-options)
3. [Initial Configuration](#initial-configuration)
4. [Provider Setup](#provider-setup)
5. [Integration](#integration)
6. [Testing & Verification](#testing--verification)
7. [Production Deployment](#production-deployment)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Requirements

- **OS:** macOS, Linux, Windows
- **Go:** 1.24+ (for building from source)
- **Network:** Internet access for OAuth authentication
- **CLI Tools (optional):** Claude Code, Codex, Gemini CLI for OAuth setup

### What You'll Need

1. Existing subscriptions to AI services (Claude, Gemini, OpenAI/Codex, etc.)
2. API keys for non-OAuth services (OpenRouter, GLM, Kimi, etc.)
3. Configuration management approach (file, env var, Management API)
4. Application architecture decision (standalone proxy vs embedded SDK)

## Installation Options

### Option 1: Package Manager (Recommended for Development)

#### macOS (Homebrew)
```bash
brew install cliproxyapi
brew services start cliproxyapi
```

**Pros:**
- Easy installation
- Auto-updates via brew
- Service management

**Cons:**
- Fixed location
- Harder to customize

#### Linux (Installer Script)
```bash
curl -fsSL https://raw.githubusercontent.com/brokechubb/cliproxyapi-installer/refs/heads/master/cliproxyapi-installer | bash
```

**Pros:**
- One-line install
- Configures systemd service
- Sets up user permissions

**Cons:**
- Requires internet during install
- Less customizable

### Option 2: Pre-built Binary (Production)

```bash
# Download latest release
wget https://github.com/router-for-me/CLIProxyAPI/releases/latest/download/cliproxyapi-linux-amd64

# Or use Windows installer
cliproxyapi-setup.exe

# Or macOS
curl -L https://github.com/router-for-me/CLIProxyAPI/releases/latest/download/cliproxyapi-darwin-amd64 -o cliproxyapi
chmod +x cliproxyapi
```

**Pros:**
- Version control
- Can use custom ports/configs
- Easy to rollback

**Cons:**
- Manual updates
- Need to manage services manually

### Option 3: Docker (Recommended for Production)

```bash
docker run --rm -p 8317:8317 \
  -v /path/to/config.yaml:/CLIProxyAPI/config.yaml \
  -v /path/to/auth-dir:/root/.cli-proxy-api \
  eceasy/cli-proxy-api:latest
```

**Pros:**
- Isolated environment
- Easy deployment
- Consistent runtime

**Cons:**
- Network overhead
- File permission management

**Docker Compose:**
```yaml
version: '3.8'
services:
  cliproxy:
    image: eceasy/cli-proxy-api:latest
    ports:
      - "8317:8317"
    volumes:
      - ./config.yaml:/CLIProxyAPI/config.yaml
      - ./auth:/root/.cli-proxy-api
      - ./logs:/CLIProxyAPI/logs
    environment:
      - COMMERCIAL_MODE=true
      - DEBUG=false
    restart: unless-stopped
```

### Option 4: Build from Source (Customization)

```bash
# Clone repository
git clone https://github.com/router-for-me/CLIProxyAPI.git
cd CLIProxyAPI

# Build
go build -o cli-proxy-api ./cmd/server

# Run
./cli-proxy-api
```

**Pros:**
- Full control
- Can modify source
- Latest features

**Cons:**
- Requires Go environment
- Manual dependency management

### Option 5: Embed SDK (Go Applications)

```bash
go get github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy
```

See [Integration Examples.md](CLIProxyAPI-Integration-Examples.md#sdk-embedding) for details.

## Initial Configuration

### Step 1: Create Config File

Copy example config:

```bash
cp config.example.yaml config.yaml
```

### Step 2: Configure Server Settings

Edit `config.yaml`:

```yaml
# Bind to localhost only (recommended)
host: "127.0.0.1"
port: 8317

# Enable file logging for production
logging-to-file: true
logs-max-total-size-mb: 500

# Enable usage statistics
usage-statistics-enabled: true

# Commercial mode for high traffic
commercial-mode: false

# Request retry settings
request-retry: 3
max-retry-interval: 30
```

### Step 3: Configure Management API

```yaml
remote-management:
  allow-remote: false   # Start false for security
  secret-key: "your-very-strong-random-key-here"
  disable-control-panel: false
```

**Security:**
- Use strong, randomly generated key (32+ chars)
- Store securely (env var, secret manager)
- Enable remote only when needed

### Step 4: Configure Proxy Authentication

```yaml
api-keys:
  - "your-client-api-key-1"      # For client application
  - "your-client-api-key-2"
```

**Notes:**
- Generate separate keys for each application
- Rotate keys periodically
- Never commit keys to version control

## Provider Setup

### Option A: OAuth Providers (No API Keys Required)

These providers use browser-based OAuth:

#### Claude Code

```bash
# Run once to authenticate
cliproxyapi --claude-login

# Configure Claude CLI to use proxy
# Edit ~/.claude/settings.json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8317",
    "ANTHROPIC_AUTH_TOKEN": "your-api-key"
  }
}
```

#### OpenAI Codex

```bash
# Authenticate
cliproxyapi --codex-login

# Configure Codex CLI
# Edit ~/.codex/config.toml
[openai]
api_base_url = "http://127.0.0.1:8317"
api_key = "your-api-key"
```

#### Gemini

```bash
# Authenticate
cliproxyapi --login

# Use normally - no additional config needed
```

#### Qwen, Antigravity, iFlow

Similar pattern - run login command, then use CLI tools normally.

### Option B: API Key Providers

Configure in `config.yaml`:

#### OpenAI Compatibility (OpenRouter, etc.)

```yaml
openai-compatibility:
  - name: "openrouter"
    base-url: "https://openrouter.ai/api/v1"
    api-key-entries:
      - api-key: "sk-or-v1..."
    models:
      - name: "deepseek/deepseek-chat"
        alias: "deepseek"
      - name: "kimi-k2:free"
        alias: "kimi"
```

#### Gemini API Key (Direct)

```yaml
gemini-api-key:
  - api-key: "AIzaSy..."
    base-url: "https://generativelanguage.googleapis.com"
    models:
      - name: "gemini-2.5-pro"
        alias: "g2.5p"
```

#### Claude API Key (Direct)

```yaml
claude-api-key:
  - api-key: "sk-ant-..."
    models:
      - name: "claude-sonnet-4-5-20250929"
        alias: "claude-sonnet-latest"
```

### Multi-Account Setup

For multiple accounts of the same provider:

```yaml
claude-api-key:
  - api-key: "sk-...account1"
    models:
      - name: "claude-sonnet-4-5-20250929"
        alias: "claude-personal"
  - api-key: "sk-...account2"
    models:
      - name: "claude-sonnet-4-5-20250929"
        alias: "claude-work"
```

**Load balancing:**
```yaml
routing:
  strategy: "round-robin"  # Distribute across accounts
  # or "fill-first"  # Use first until quota exceeded
```

### Model Mapping & Aliases

Create friendly model names:

```yaml
oauth-model-alias:
  claude:
    - name: "claude-sonnet-4-5"
      alias: "cs"  # Use "cs" in requests
```

### Excluding Models

Block specific models:

```yaml
claude-api-key:
  - excluded-models:
      - "*-thinking"    # Block thinking models
      - "claude-3-opus"  # Block expensive models
```

## Integration

### For Native CLI Tools

#### Claude Code

```json
// ~/.claude/settings.json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8317",
    "ANTHROPIC_AUTH_TOKEN": "your-api-key"
  }
}
```

#### Factory Droid

```json
// ~/.factory/settings.json
{
  "customModels": [{
    "name": "CLIProxy",
    "baseUrl": "http://127.0.0.1:8317"
  }]
}
```

#### Amp CLI

```bash
export ANTCODE_API_BASE_URL="http://127.0.0.1:8317"
export ANTCODE_API_KEY="your-api-key"
```

### For Custom Applications

#### Python Application

```python
# requirements.txt
openai>=1.0.0
# or
anthropic>=0.40.0

# main.py
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("API_KEY"),
    base_url="http://127.0.0.1:8317",
)

response = client.chat.completions.create(
    model="claude-sonnet-4-5",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

#### Node.js Application

```javascript
// package.json
{
  "dependencies": {
    "openai": "^4.0.0"
    // or
    "@anthropic-ai/sdk": "^0.40.0"
  }
}

// app.js
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.API_KEY,
  baseURL: 'http://127.0.0.1:8317',
});
```

#### Go Application (SDK)

```bash
# Get SDK
go get github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy
```

```go
package main

import (
    "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy"
)

func main() {
    svc, _ := cliproxy.NewBuilder().
        WithConfig(cfg).
        Build()

    ctx := context.Background()
    svc.Run(ctx)
}
```

### For AI Coding Tools

#### Cursor

```json
// ~/.cursor/settings.json
{
  "customApiBaseUrl": "http://127.0.0.1:8317",
  "customApiKey": "your-api-key"
}
```

#### Continue (VSCode)

1. Open Settings
2. Set "API Base URL" to `http://127.0.0.1:8317`
3. Set "API Key" to your configured key

## Testing & Verification

### Step 1: Start Server

```bash
./cli-proxy-api
```

Verify:
```bash
curl http://127.0.0.1:8317/healthz
# Should return: ok
```

### Step 2: Test Authentication

```bash
# Health check with API key
curl -H "Authorization: Bearer your-api-key" \
  http://127.0.0.1:8317/v1/models

# Management API
curl -H "Authorization: Bearer your-management-key" \
  http://127.0.0.1:8317/v0/management/config
```

### Step 3: Test Model Access

```bash
# Test with Claude
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"model":"claude-sonnet-4-5","messages":[{"role":"user","content":"Hello from CLIProxyAPI!"}]}' \
  http://127.0.0.1:8317/v1/chat/completions

# Test with Gemini
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Test"}]}' \
  http://127.0.0.1:8317/v1/chat/completions
```

### Step 4: Verify OAuth (if using)

```bash
# Check auth files exist
ls -la ~/.cli-proxy-api/auth/

# Each provider should have token files
# Gemini: gemini_cli_token.json
# Claude: claude_token.json
# etc.
```

### Step 5: Test Load Balancing

```bash
# Send multiple requests to verify round-robin
for i in {1..10}; do
  curl -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your-api-key" \
    -d '{"model":"claude-sonnet-4-5","messages":[{"role":"user","content":"Request '$i'"}]}' \
    http://127.0.0.1:8317/v1/chat/completions &
done

wait
```

Verify requests are distributed across multiple accounts (check logs).

## Production Deployment

### Security Hardening

1. **Restrict access:**
   ```yaml
   host: "127.0.0.1"
   ```

2. **Use strong management key:**
   ```yaml
   remote-management:
     secret-key: "your-very-long-random-secure-key"
   ```

3. **Enable HTTPS:**
   ```yaml
   tls:
     enable: true
     cert: "/path/to/cert.pem"
     key: "/path/to/key.pem"
   ```

4. **Disable remote management:**
   ```yaml
   remote-management:
     allow-remote: false
   ```

### Process Management

#### Linux (systemd)

```bash
# Create service file
sudo vim /etc/systemd/system/cliproxyapi.service
```

```ini
[Unit]
Description=CLIProxyAPI
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/CLIProxyAPI
ExecStart=/path/to/CLIProxyAPI/cliproxyapi
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable service
sudo systemctl enable cliproxyapi
sudo systemctl start cliproxyapi

# Check status
sudo systemctl status cliproxyapi
```

#### macOS (launchd)

```bash
# Create plist file
vim ~/Library/LaunchAgents/com.cliproxyapi.plist
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>CLIProxyAPI</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/cliproxyapi</string>
        <string>--config</string>
        <string>/path/to/config.yaml</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

```bash
# Load service
launchctl load ~/Library/LaunchAgents/com.cliproxyapi.plist
```

#### Docker

```bash
# Use docker-compose for orchestration
docker-compose up -d

# View logs
docker-compose logs -f cliproxy

# Restart
docker-compose restart cliproxy
```

### Reverse Proxy (Nginx)

```nginx
upstream cliproxy {
    server 127.0.0.1:8317;
}

server {
    listen 443 ssl;
    server_name proxy.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://cliproxy;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Monitoring Setup

#### Health Check Endpoint

```bash
# Add to monitoring system
curl http://127.0.0.1:8317/healthz

# Set up alert on non-200 response
```

#### Log Aggregation

```bash
# Forward logs to log aggregation service
tail -f /path/to/logs/cli-proxy-api.log | logger -t cliproxy &
```

#### Export Usage Periodically

```bash
# Cron job to export daily usage
0 2 * * * curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  http://localhost:8317/v0/management/usage/export \
  > /backups/usage-$(date +\%Y\%m\%d).json
```

## Monitoring & Maintenance

### Key Metrics to Monitor

1. **Server health:**
   ```bash
   curl http://127.0.0.1:8317/healthz
   ```

2. **Usage statistics:**
   ```bash
   curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
     http://127.0.0.1:8317/v0/management/usage
   ```

3. **Error rates:**
   Check logs for increased error frequency

4. **Response times:**
   Monitor latency of requests

5. **Quota utilization:**
   Track per-account usage

### Log Monitoring

```bash
# Real-time log viewing
tail -f logs/cli-proxy-api.log

# Search for errors
grep -i "error" logs/cli-proxy-api.log

# Search for rate limits
grep -i "429\|rate limit" logs/cli-proxy-api.log
```

### Regular Maintenance Tasks

#### Daily
- Export usage data
- Rotate logs if size limit reached
- Check for errors in logs

#### Weekly
- Review usage patterns
- Update providers if needed
- Check for security vulnerabilities

#### Monthly
- Rotate management keys
- Archive old log files
- Review and optimize configuration
- Update CLIProxyAPI version

### Backup Strategy

```bash
# Backup config
cp config.yaml backup/config-$(date +%Y%m%d).yaml

# Backup auth directory
tar -czf backup/auth-$(date +%Y%m%d).tar.gz ~/.cli-proxy-api/

# Export usage
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  http://127.0.0.1:8317/v0/management/usage/export \
  > backup/usage-$(date +%Y%m%d).json
```

### Update Management

```bash
# Check for updates
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  http://127.0.0.1:8317/v0/management/latest-version

# Pull latest release
# Download new binary
# Stop service
# Replace binary
# Start service
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Symptom:** Server fails to start with "address already in use"

**Diagnosis:**
```bash
lsof -i :8317
```

**Solution:**
- Change port in config.yaml
- Stop conflicting process
- Use different port with `--port`

#### 2. Authentication Failures

**Symptom:** 401/403 responses from applications

**Diagnosis:**
```bash
# Verify API key
curl -H "Authorization: Bearer test-key" \
  http://127.0.0.1:8317/v1/models

# Check config
grep api-keys config.yaml
```

**Solution:**
- Verify api-keys array in config
- Check client is sending correct key
- For OAuth: Re-run login command
- Enable debug to see authentication flow

#### 3. OAuth Token Issues

**Symptom:** OAuth provider returns 401 after successful login

**Diagnosis:**
```bash
# Check token files
ls -la ~/.cli-proxy-api/auth/

# Check token expiration
cat ~/.cli-proxy-api/auth/gemini_cli_token.json | grep expires_at
```

**Solution:**
- Re-run OAuth login command
- Check system time is correct
- Verify network connectivity

#### 4. Model Not Found

**Symptom:** 400/404 error with "model not found"

**Diagnosis:**
```bash
# List available models
curl -H "Authorization: Bearer your-api-key" \
  http://127.0.0.1:8317/v1/models

# Check excluded-models config
grep -A 10 excluded-models config.yaml
```

**Solution:**
- Verify model name spelling and case
- Remove from excluded-models if needed
- Check provider supports the model
- Verify OAuth provider has access to model

#### 5. Quota Exceeded

**Symptom:** 429 errors, quota warnings

**Diagnosis:**
```bash
# Check usage
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  http://127.0.0.1:8317/v0/management/usage

# Check account status via provider portal
```

**Solution:**
- Enable auto-switch: `quota-exceeded.switch-project: true`
- Add more accounts for load balancing
- Wait for quota reset
- Switch to lower-tier model

#### 6. CORS Issues

**Symptom:** Browser/JS applications blocked by CORS policy

**Diagnosis:**
```bash
# Check response headers
curl -v -H "Origin: http://localhost:3000" \
  http://127.0.0.1:8317/v1/models
```

**Solution:**
- Verify api-keys include client's key
- Check CORS settings in config
- Ensure same origin is configured

#### 7. High Memory Usage

**Symptom:** Out of memory errors, slow performance

**Diagnosis:**
```bash
# Check memory usage
ps aux | grep cliproxy
# or
top | grep cliproxy
```

**Solution:**
- Enable commercial mode: `commercial-mode: true`
- Reduce concurrent connections
- Increase system memory
- Disable usage statistics if not needed

### Debug Mode

Enable for detailed logging:

```yaml
debug: true
logging-to-file: true
```

View logs:
```bash
tail -f logs/cli-proxy-api.log
```

### Getting Help

1. **Documentation:** https://help.router-for.me/
2. **GitHub Issues:** https://github.com/router-for-me/CLIProxyAPI/issues
3. **Discussions:** https://github.com/router-for-me/CLIProxyAPI/discussions

### Quick Fixes

```yaml
# Reset config
# Use config.example.yaml as template

# Clear all cache
# Delete auth directory
rm -rf ~/.cli-proxy-api/*

# Restart fresh
./cli-proxy-api
```

## Success Criteria

Your implementation is successful when:

- [ ] Server starts without errors
- [ ] Health check returns 200
- [ ] Can list models with API key
- [ ] Can complete chat completion request
- [ ] OAuth providers authenticate successfully
- [ ] Multi-account load balancing works
- [ ] Management API accessible with correct key
- [ ] Logs are writing (if enabled)
- [ ] Usage statistics are collecting
- [ ] Integration with your application works
- [ ] No CORS errors
- [ ] No authentication failures (with correct credentials)

## Next Steps

1. Complete your chosen installation method
2. Configure providers for your use case
3. Integrate with your application
4. Run through testing checklist
5. Deploy to production with security hardening
6. Set up monitoring
7. Document your configuration
8. Train users on common issues

## Additional Resources

- [Implementation Guide](CLIProxyAPI-Implementation-Guide.md)
- [Configuration Reference](CLIProxyAPI-Configuration-Reference.md)
- [Integration Examples](CLIProxyAPI-Integration-Examples.md)
- [Quick Reference](CLIProxyAPI-Quick-Reference.md)
- [Management API](CLIProxyAPI-Management-API.md)
- [Official Documentation](https://help.router-for.me/)
- [GitHub Repository](https://github.com/router-for-me/CLIProxyAPI)
