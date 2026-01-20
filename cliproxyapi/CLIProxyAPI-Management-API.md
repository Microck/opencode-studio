# CLIProxyAPI Management API Reference

## Overview

The Management API provides comprehensive control over CLIProxyAPI's runtime configuration and authentication files. All changes are persisted to the YAML config file and hot-reloaded by the service.

**Base URL:** `http://localhost:8317/v0/management`

## Authentication

All requests require a valid management key:

```bash
# Method 1: Authorization header
Authorization: Bearer <MANAGEMENT_KEY>

# Method 2: X-Management-Key header
X-Management-Key: <MANAGEMENT_KEY>
```

### Remote Access

To enable remote (non-localhost) management:

```yaml
# In config.yaml
remote-management:
  allow-remote: true
  secret-key: "your-key"
```

### Security Notes

- **Localhost restriction:** When `allow-remote: false`, only `127.0.0.1`/`::1` can access management endpoints
- **Failure ban:** 5 consecutive authentication failures trigger ~30 minute temporary ban for remote IPs
- **Password env var:** Setting `MANAGEMENT_PASSWORD` env var registers an additional plaintext management secret and forces remote management enabled
- **Auto-hashing:** Plaintext keys are automatically bcrypt-hashed on startup

### Configuration Restrictions

These options CANNOT be modified via API and must be set in config file:

- `allow-remote-management`
- `remote-management.secret-key`

## Request/Response Conventions

- **Content-Type:** `application/json` (unless otherwise noted)
- **Boolean/int/string updates:** `{ "value": <type> }`
- **Array PUT:** Raw array `["a", "b"]` or `{ "items": [...] }`
- **Array PATCH:**
  - By old/new: `{ "old": "k1", "new": "k2" }`
  - By index: `{ "index": 0, "value": "k2" }`
- **Object-array PATCH:** Match by index or key field (specified per endpoint)

## Endpoints

### Usage Statistics

#### GET /usage

Retrieve aggregated in-memory request metrics.

**Response:**
```json
{
  "usage": {
    "total_requests": 24,
    "success_count": 22,
    "failure_count": 2,
    "total_tokens": 13890,
    "requests_by_day": {
      "2024-05-20": 12
    },
    "requests_by_hour": {
      "09": 4,
      "18": 8
    },
    "tokens_by_day": {
      "2024-05-20": 9876
    },
    "tokens_by_hour": {
      "09": 1234,
      "18": 865
    },
    "apis": {
      "POST /v1/chat/completions": {
        "total_requests": 12,
        "total_tokens": 9021,
        "models": {
          "gpt-4o-mini": {
            "total_requests": 8,
            "total_tokens": 7123,
            "details": [
              {
                "timestamp": "2024-05-20T09:15:04.123456Z",
                "source": "openai",
                "auth_index": "a1b2c3d4e5f67890",
                "tokens": {
                  "input_tokens": 523,
                  "output_tokens": 308,
                  "reasoning_tokens": 0,
                  "cached_tokens": 0,
                  "total_tokens": 831
                },
                "failed": false
              }
            ]
          }
        }
      }
    },
    "failed_requests": 2
  }
}
```

**Notes:**
- Statistics are recalculated for every request that reports token usage
- Data resets when server restarts
- Hourly counters fold all days into same hour bucket (`00`–`23`)
- Top-level `failed_requests` repeats `usage.failure_count` for convenience

#### GET /usage/export

Export a complete usage snapshot for backup/migration.

**Response:**
```json
{
  "version": 1,
  "exported_at": "2025-12-26T03:49:51Z",
  "usage": {
    "total_requests": 24,
    "success_count": 22,
    "failure_count": 2,
    "total_tokens": 13890,
    "requests_by_day": {},
    "tokens_by_day": {},
    "requests_by_hour": {},
    "tokens_by_hour": {},
    "apis": {}
  }
}
```

**Notes:**
- `exported_at` is UTC time (RFC 3339)
- The `usage` object uses the same schema as `GET /usage`'s `usage` field

#### POST /usage/import

Import and merge a usage snapshot into memory.

**Request:**
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  --data-binary @usage-export.json \
  http://localhost:8317/v0/management/usage/import
```

**Response:**
```json
{
  "added": 10,
  "skipped": 2,
  "total_requests": 123,
  "failed_requests": 4
}
```

**Notes:**
- This endpoint MERGES (does not overwrite)
- Duplicate request details are skipped and counted in `skipped`
- You may POST the full JSON returned by `GET /usage/export` directly
- `version` currently supports `1` (and also accepts omitted/`0` for compatibility)

### Configuration Management

#### GET /config

Get the full configuration.

**Request:**
```bash
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  http://localhost:8317/v0/management/config
```

**Response:**
```json
{
  "debug": true,
  "proxy-url": "",
  "api-keys": ["1...5", "JS...W"],
  "gemini-api-key": [
    {
      "api-key": "AI...01",
      "base-url": "https://generativelanguage.googleapis.com",
      "headers": {
        "X-Custom-Header": "custom-value"
      },
      "proxy-url": "",
      "excluded-models": [
        "gemini-1.5-pro",
        "gemini-1.5-flash"
      ]
    }
  ],
  "request-log": true,
  "request-retry": 3
}
```

#### GET /config.yaml

Download the persisted YAML file as-is.

**Response Headers:**
- `Content-Type: application/yaml; charset=utf-8`
- `Cache-Control: no-store`

**Response:** Raw YAML stream preserving comments/formatting

#### PUT /config.yaml

Replace the entire config with a YAML document.

**Request:**
```bash
curl -X PUT \
  -H 'Content-Type: application/yaml' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  --data-binary @config.yaml \
  http://localhost:8317/v0/management/config.yaml
```

**Response:**
```json
{ "ok": true, "changed": ["config"] }
```

**Notes:**
- Server validates YAML by loading it before persisting
- Invalid configs return `422` with `{ "error": "invalid_config", "message": "..." }`
- Write failures return `500` with `{ "error": "write_failed", "message": "..." }`

### API Keys (Proxy Service Auth)

These endpoints update the inline `config-api-key` provider inside the `auth.providers` section.

#### GET /api-keys

Return the full list of API keys.

**Response:**
```json
{ "api-keys": ["k1", "k2", "k3"] }
```

#### PUT /api-keys

Replace the full list.

**Request:**
```bash
curl -X PUT \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '["k1", "k2", "k3"]' \
  http://localhost:8317/v0/management/api-keys
```

**Response:**
```json
{ "status": "ok" }
```

#### PATCH /api-keys

Modify one API key entry.

**By old/new:**
```bash
curl -X PATCH \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"old":"k2","new":"k2b"}' \
  http://localhost:8317/v0/management/api-keys
```

**By index:**
```bash
curl -X PATCH \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"index":0,"value":"k1b"}' \
  http://localhost:8317/v0/management/api-keys
```

**Response:**
```json
{ "status": "ok" }
```

#### DELETE /api-keys

Delete one API key.

**By value:**
```bash
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -X DELETE 'http://localhost:8317/v0/management/api-keys?value=k1'
```

**By index:**
```bash
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -X DELETE 'http://localhost:8317/v0/management/api-keys?index=0'
```

**Response:**
```json
{ "status": "ok" }
```

### Provider-Specific Endpoints

#### Gemini API Keys

**GET /gemini-api-key**
```bash
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  http://localhost:8317/v0/management/gemini-api-key
```

**PUT /gemini-api-key**
```bash
curl -X PUT \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '[{"api-key":"AIzaSy-1","headers":{"X-Custom-Header":"vendor-value"},"excluded-models":["gemini-1.5-flash"]},{"api-key":"AIzaSy-2","base-url":"https://custom.example.com","excluded-models":["gemini-pro-vision"]}]' \
  http://localhost:8317/v0/management/gemini-api-key
```

**PATCH /gemini-api-key**
```bash
# By index
curl -X PATCH \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"index":0,"value":{"api-key":"AIzaSy-1","base-url":"https://custom.example.com","headers":{"X-Custom-Header":"custom-value"},"proxy-url":"socks5://proxy.example.com:1080","excluded-models":["gemini-1.5-pro","gemini-pro-vision"]}}' \
  http://localhost:8317/v0/management/gemini-api-key
```

**DELETE /gemini-api-key**
```bash
# By api-key
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -X DELETE 'http://localhost:8317/v0/management/gemini-api-key?api-key=AIzaSy-1'

# By index
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -X DELETE 'http://localhost:8317/v0/management/gemini-api-key?index=0'
```

**Notes:**
- `excluded-models` is optional
- Server lowercases, trims, deduplicates, and drops blank entries before saving

Similar structure applies to:
- `/codex-api-key`
- `/claude-api-key`
- `/qwen-api-key`
- `/iflow-api-key`

### Debug & Logging

#### GET /debug

Get current debug state.

**Response:**
```json
{ "debug": false }
```

#### PUT/PATCH /debug

Set debug mode.

**Request:**
```bash
curl -X PUT \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"value":true}' \
  http://localhost:8317/v0/management/debug
```

**Response:**
```json
{ "status": "ok" }
```

#### GET /logging-to-file

Check whether file logging is enabled.

**Response:**
```json
{ "logging-to-file": true }
```

#### PUT/PATCH /logging-to-file

Enable or disable file logging.

**Request:**
```bash
curl -X PATCH \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"value":false}' \
  http://localhost:8317/v0/management/logging-to-file
```

**Response:**
```json
{ "status": "ok" }
```

#### GET /logs

Stream recent log lines.

**Query params:**
- `after` (optional): Unix timestamp; only lines newer than this are returned

**Response:**
```json
{
  "lines": [
    "2024-05-20 12:00:00 info request accepted"
  ],
  "line-count": 125,
  "latest-timestamp": 1716206400
}
```

**Notes:**
- Requires file logging to be enabled; otherwise returns `{ "error": "logging to file disabled" }` with `400`
- When no log file exists yet, response contains empty `lines` and `line-count: 0`
- `latest-timestamp` is the largest parsed timestamp from this batch
- `line-count` reflects total number of lines scanned

#### DELETE /logs

Remove rotated log files and truncate active log.

**Response:**
```json
{ "success": true, "message": "Logs cleared successfully", "removed": 3 }
```

### Quota Management

#### GET /quota-exceeded/switch-project

```bash
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  http://localhost:8317/v0/management/quota-exceeded/switch-project
```

**Response:**
```json
{ "switch-project": true }
```

#### PUT/PATCH /quota-exceeded/switch-project

```bash
curl -X PUT \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"value":false}' \
  http://localhost:8317/v0/management/quota-exceeded/switch-project
```

**Similar structure for:**
- `/quota-exceeded/switch-preview-model`

### Proxy Configuration

#### GET /proxy-url

Get the proxy URL string.

**Response:**
```json
{ "proxy-url": "socks5://user:pass@proxy.com:1080/" }
```

#### PUT/PATCH /proxy-url

Set the proxy URL string.

**Request:**
```bash
curl -X PUT \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"value":"socks5://user:pass@proxy.com:1080/"}' \
  http://localhost:8317/v0/management/proxy-url
```

**Response:**
```json
{ "status": "ok" }
```

#### DELETE /proxy-url

Clear the proxy URL.

**Response:**
```json
{ "status": "ok" }
```

### WebSocket Authentication

#### GET /ws-auth

Check whether WebSocket gateway enforces authentication.

**Response:**
```json
{ "ws-auth": true }
```

#### PUT/PATCH /ws-auth

Enable or disable authentication for `/ws/*` endpoints.

**Request:**
```bash
curl -X PATCH \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"value":false}' \
  http://localhost:8317/v0/management/ws-auth
```

**Response:**
```json
{ "status": "ok" }
```

**Notes:**
- When toggled from `false` → `true`, server terminates any existing WebSocket sessions so that reconnections must supply valid API credentials
- Disabling authentication leaves current sessions untouched

### Request Retry Configuration

#### GET /request-retry

Get the retry count integer.

**Response:**
```json
{ "request-retry": 3 }
```

#### PUT/PATCH /request-retry

Set the retry count.

**Request:**
```bash
curl -X PATCH \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"value":5}' \
  http://localhost:8317/v0/management/request-retry
```

**Response:**
```json
{ "status": "ok" }
```

#### GET /max-retry-interval

Get maximum retry interval in seconds.

**Response:**
```json
{ "max-retry-interval": 30 }
```

#### PUT/PATCH /max-retry-interval

Set maximum retry interval in seconds.

**Request:**
```bash
curl -X PATCH \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"value":60}' \
  http://localhost:8317/v0/management/max-retry-interval
```

**Response:**
```json
{ "status": "ok" }
```

### Usage Statistics Toggle

#### GET /usage-statistics-enabled

Check whether telemetry collection is active.

**Response:**
```json
{ "usage-statistics-enabled": true }
```

#### PUT/PATCH /usage-statistics-enabled

Enable or disable collection.

**Request:**
```bash
curl -X PUT \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"value":true}' \
  http://localhost:8317/v0/management/usage-statistics-enabled
```

**Response:**
```json
{ "status": "ok" }
```

## Error Handling

### HTTP Status Codes

- `200 OK` - Success
- `400 Bad Request` - Invalid parameters or operation not allowed
- `404 Not Found` - Endpoint not found (happens when management key not configured)
- `422 Unprocessable Entity` - Invalid config/data format
- `500 Internal Server Error` - Write failure or other server error

### Common Error Responses

**Missing management key:**
```json
{ "error": "missing_management_key" }
```

**Invalid config:**
```json
{
  "error": "invalid_config",
  "message": "Invalid YAML: ..."
}
```

**Write failed:**
```json
{
  "error": "write_failed",
  "message": "Failed to write config file: ..."
}
```

## Best Practices

1. **Use HTTPS for remote access** to prevent credential interception
2. **Set strong management keys** with sufficient entropy
3. **Regularly export usage data** for backup and analysis
4. **Monitor logs** for authentication failures and unusual activity
5. **Test config changes** in staging before production
6. **Use PATCH for atomic updates** instead of full PUT when possible
7. **Implement retry logic** in clients for transient network failures
8. **Cache API responses** to reduce load on management endpoints
