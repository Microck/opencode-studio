# CLIProxyAPI Integration Examples

## Overview

This guide provides practical examples for integrating CLIProxyAPI with various tools and applications.

## Table of Contents

1. [Native CLI Tools](#native-cli-tools)
2. [AI Coding Platforms](#ai-coding-platforms)
3. [Custom Applications](#custom-applications)
4. [Popular Integrations](#popular-integrations)
5. [SDK Embedding](#sdk-embedding)

## Native CLI Tools

### Claude Code

Configure `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8317",
    "ANTHROPIC_AUTH_TOKEN": "your-api-key"
  }
}
```

**Multi-account setup:**

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8317",
    "ANTHROPIC_AUTH_TOKEN": "personal-key"
  }
}
```

Then use the `claude` command normally with your Anthropic subscription.

### OpenAI Codex

Edit `~/.codex/config.toml`:

```toml
[openai]
api_base_url = "http://127.0.0.1:8317"
api_key = "your-api-key"

[openai.headers]
X-Custom-Header = "value"
```

### Gemini CLI

Gemini CLI uses OAuth through CLIProxyAPI. Authenticate first:

```bash
cliproxyapi --login
```

Then use `gemini` command normally.

## AI Coding Platforms

### Factory Droid

Configure `~/.factory/settings.json`:

```json
{
  "customModels": [{
    "name": "CLIProxy",
    "baseUrl": "http://127.0.0.1:8317"
  }]
}
```

### Amp CLI

Configure via environment or CLI:

```bash
export ANTCODE_API_BASE_URL="http://127.0.0.1:8317"
export ANTCODE_API_KEY="your-api-key"
```

Or use Amp's configuration file.

### Cursor IDE

**Method 1: Settings.json**

Create `~/.cursor/settings.json`:

```json
{
  "customApiBaseUrl": "http://127.0.0.1:8317",
  "customApiKey": "your-api-key"
}
```

**Method 2: Environment variables**

```bash
export OPENAI_BASE_URL="http://127.0.0.1:8317"
export OPENAI_API_KEY="your-api-key"
```

Then configure Cursor to use these variables.

### Continue Dev

**For VSCode Extension:**

1. Open Continue settings
2. Set "API Base URL" to `http://127.0.0.1:8317`
3. Set "API Key" to your configured key

### Cline

**For VSCode Extension:**

1. Open Cline settings
2. Set "API Provider" to "Anthropic" or "OpenAI Compatible"
3. Set "Base URL" to `http://127.0.0.1:8317`
4. Set "API Key" to your configured key

## Custom Applications

### Python (OpenAI SDK)

```python
import os
from openai import OpenAI

# Initialize with CLIProxyAPI endpoint
client = OpenAI(
    api_key=os.getenv("API_KEY", "your-api-key"),
    base_url="http://127.0.0.1:8317",
)

# Chat completion
response = client.chat.completions.create(
    model="claude-sonnet-4-5",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"},
    ],
    temperature=0.7,
    max_tokens=1024,
)

print(response.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="gemini-2.5-flash",
    messages=[{"role": "user", "content": "Tell me a joke"}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

### Python (Anthropic SDK)

```python
import os
from anthropic import Anthropic

# Initialize with CLIProxyAPI endpoint
client = Anthropic(
    api_key=os.getenv("API_KEY", "your-api-key"),
    base_url="http://127.0.0.1:8317",
)

# Messages API
message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Explain quantum computing."}
    ],
)

print(message.content[0].text)

# Streaming
with client.messages.stream(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Count to 10"}],
    stream=True,
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

### Node.js (OpenAI SDK)

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.API_KEY || 'your-api-key',
  baseURL: 'http://127.0.0.1:8317',
});

// Chat completion
const completion = await openai.chat.completions.create({
  model: 'claude-sonnet-4-5',
  messages: [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'Write a hello world function in Python.' },
  ],
  temperature: 0.7,
});

console.log(completion.choices[0].message.content);

// Streaming
const stream = await openai.chat.completions.create({
  model: 'gemini-2.5-flash',
  messages: [{ role: 'user', content: 'What is AI?' }],
  stream: true,
});

for await (const chunk of stream) {
  if (chunk.choices[0]?.delta?.content) {
    process.stdout.write(chunk.choices[0].delta.content);
  }
}
```

### Node.js (Anthropic SDK)

```javascript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.API_KEY || 'your-api-key',
  baseURL: 'http://127.0.0.1:8317',
});

// Messages API
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-5',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Explain recursion.' },
  ],
});

console.log(message.content[0].text);

// Streaming
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-5',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Say hello' }],
  stream: true,
});

for await (const textEvent of stream) {
  if (textEvent.type === 'content_block_delta' && textEvent.delta?.text) {
    process.stdout.write(textEvent.delta.text);
  }
}
```

### Go (OpenAI-compatible)

```go
package main

import (
    "context"
    "fmt"
    "os"

    "github.com/sashabaranov/go-openai"
)

func main() {
    apiKey := os.Getenv("API_KEY")
    if apiKey == "" {
        apiKey = "your-api-key"
    }

    config := openai.DefaultConfig(
        openai.WithAPIKey(apiKey),
        openai.WithBaseURL("http://127.0.0.1:8317"),
    )

    client := openai.NewClient(config)

    ctx := context.Background()

    resp, err := client.CreateChatCompletion(
        ctx,
        openai.ChatCompletionRequest{
            Model:     openai.F("claude-sonnet-4-5"),
            Messages:  []openai.ChatCompletionMessage{
                { Role: "user", Content: "Hello, world!" },
            },
        },
    },
    )

    if err != nil {
        panic(err)
    }

    fmt.Println(resp.Choices[0].Message.Content)
}
```

### cURL

**OpenAI-compatible:**

```bash
curl -X POST http://127.0.0.1:8317/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

**Anthropic-compatible:**

```bash
curl -X POST http://127.0.0.1:8317/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "model": "claude-sonnet-4-5",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## Popular Integrations

### CCS (Claude Code Switch)

CCS is a CLI wrapper for managing multiple Claude accounts and switching between providers.

**Installation:**
```bash
npm install -g @kaitranntt/ccs
```

**Usage:**
```bash
# Default Claude session
ccs

# Use Gemini (OAuth)
ccs gemini

# Use Codex (OAuth)
ccs codex

# Multi-account Claude
ccs work "implement feature"
ccs personal "review code"

# API profiles
ccs glm
ccs kimi
ccs openrouter
```

### ProxyPilot

Windows-native fork with TUI, system tray, and multi-provider OAuth.

**Features:**
- 10 Auth Providers (Claude, Codex, Gemini, Kiro, Qwen, etc.)
- Universal API translation
- Tool calling repair
- System tray app
- Auto-updates

**Configuration:**
Use the included GUI or edit `config.yaml` manually.

### VibeProxy

Native macOS menu bar app for using Claude, Codex, and Gemini subscriptions.

**Setup:**
1. Download VibeProxy
2. Configure providers via UI
3. Connect to AI coding tools

### ProxyPal

macOS GUI for managing CLIProxyAPI configuration.

**Features:**
- Visual dashboard for provider management
- Model mapping configuration
- OAuth authentication flows

## SDK Embedding

Embed CLIProxyAPI as a library in your Go application.

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
    // Load or build your config
    cfg := &config.Config{
        Port: 8318,  // Different port to avoid conflict
        AuthDir: "~/.myapp-cliproxy",
        APIKeys: []string{"my-internal-key"},
    }

    // Create service
    svc, err := cliproxy.NewBuilder().
        WithConfig(cfg).
        Build()
    if err != nil {
        log.Fatalf("Failed to create service: %v", err)
    }

    // Run in background goroutine
    ctx, cancel := context.WithCancel(context.Background())
    go func() {
        if err := svc.Run(ctx); err != nil {
            log.Printf("Service error: %v", err)
        }
    }()

    // Your app logic here
    // ...
}
```

### With Custom Middleware

```go
svc, _ := cliproxy.NewBuilder().
    WithConfig(cfg).
    WithServerOptions(
        // Add authentication middleware
        cliproxy.WithMiddleware(func(c *gin.Context) {
            token := c.GetHeader("Authorization")
            if !validateToken(token) {
                c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
                return
            }
            c.Next()
        }),
        // Add custom routes
        cliproxy.WithRouterConfigurator(func(e *gin.Engine, _ *handlers.BaseAPIHandler, _ *config.Config) {
            e.GET("/api/health", func(c *gin.Context) {
                c.JSON(200, gin.H{"status": "ok"})
            })
            e.POST("/api/custom", customHandler)
        }),
    ).
    Build()
```

### Using the Embedded Service Programmatically

```go
// Execute a non-streaming request
req := map[string]interface{}{
    "model": "claude-sonnet-4-5",
    "messages": []interface{}{
        map[string]interface{}{
            "role":    "user",
            "content": "Hello from embedded app!",
        },
    },
}

resp, err := svc.Execute(ctx, []string{"claude"}, req)
if err != nil {
    return err
}

// Execute a streaming request
chunks, err := svc.ExecuteStream(ctx, []string{"gemini"}, req)
if err != nil {
    return err
}

for chunk := range chunks {
    // Process streaming chunks
    if chunk.Choices[0].Delta.Content != "" {
        fmt.Print(chunk.Choices[0].Delta.Content)
    }
}
```

### Custom Token Provider

Load credentials from your own storage:

```go
type myTokenProvider struct{}

func (p *myTokenProvider) Load(
    ctx context.Context,
    cfg *config.Config,
) (*cliproxy.TokenClientResult, error) {
    // Load from database, secret store, etc.
    tokens, err := loadFromDatabase()
    if err != nil {
        return nil, err
    }

    return &cliproxy.TokenClientResult{
        Gemini:    tokens.Gemini,
        Codex:     tokens.Codex,
        Claude:     tokens.Claude,
        Qwen:      tokens.Qwen,
        Antigravity: tokens.Antigravity,
    }, nil
}

func (p *myTokenProvider) Save(
    ctx context.Context,
    cfg *config.Config,
    result *cliproxy.TokenClientResult,
) error {
    // Save to your storage
    return saveToDatabase(result)
}

svc, _ := cliproxy.NewBuilder().
    WithConfig(cfg).
    WithTokenClientProvider(&myTokenProvider{}).
    Build()
```

## Advanced Patterns

### Load Balancing Configuration

```yaml
# Round-robin: Distributes requests evenly
routing:
  strategy: "round-robin"

# Fill-first: Uses first account until quota exhausted
routing:
  strategy: "fill-first"
```

### Model Aliases

Use friendly model names in your requests:

```yaml
oauth-model-alias:
  claude:
    - name: "claude-sonnet-4-5"
      alias: "cs"  # Use "cs" in requests
```

Then in your application:

```python
response = client.chat.completions.create(
    model="cs",  # Uses the alias
    messages=[...]
)
```

### Custom Headers

Add per-request headers:

```python
response = client.chat.completions.create(
    model="claude-sonnet-4-5",
    messages=[...],
    extra_headers={
        "X-Custom-Header": "value",
        "X-Request-ID": "12345",
    }
)
```

### Quota Management

Monitor and handle quota exceeded scenarios:

```python
try:
    response = client.chat.completions.create(model="gpt-5", messages=[...])
except requests.exceptions.HTTPError as e:
    if e.response.status_code == 429:
        # Quota exceeded - CLIProxyAPI will switch accounts
        print("Quota exceeded, retrying...")
        time.sleep(5)
        # Retry with same request
        response = client.chat.completions.create(model="gpt-5", messages=[...])
```

## Testing Your Integration

### Health Check

```bash
curl http://127.0.0.1:8317/healthz
```

### List Available Models

```bash
curl -H "Authorization: Bearer your-api-key" \
  http://127.0.0.1:8317/v1/models
```

### Test Request

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"model":"claude-sonnet-4-5","messages":[{"role":"user","content":"Hello!"}]}' \
  http://127.0.0.1:8317/v1/chat/completions
```

## Troubleshooting Integrations

### Port Conflicts

If your application needs a different port:

```yaml
port: 8318
```

Or embed CLIProxyAPI with SDK and use a different port.

### CORS Issues

Ensure your configured `api-keys` in CLIProxyAPI match what you're sending from your application.

### Authentication Failures

1. Verify API key is correct
2. Check `api-keys` array in config.yaml
3. For Management API: Verify `remote-management.secret-key` is set
4. Enable debug mode: `debug: true`

### Model Not Found

1. List available models: `GET /v1/models`
2. Check `excluded-models` configuration
3. Verify model name spelling and case

## Best Practices

1. **Use separate API keys per application** for better tracking
2. **Implement retry logic** with exponential backoff
3. **Monitor usage statistics** via Management API
4. **Handle quota exceeded** gracefully with automatic retries
5. **Use streaming** for long responses to improve UX
6. **Cache model lists** to reduce API calls
7. **Validate requests** before sending to avoid errors
8. **Use structured logging** for debugging production issues

## Additional Resources

- [CLIProxyAPI GitHub](https://github.com/router-for-me/CLIProxyAPI)
- [CCS Documentation](https://docs.ccs.kaitran.ca)
- [Official Documentation](https://help.router-for.me/)
- [Community Projects](https://github.com/router-for-me/CLIProxyAPI#who-is-with-us)
