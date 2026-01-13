# Multi-Account Architecture: Universal Applicability

The architecture implemented for Google Antigravity (Account Pools + Rotation) is a **universal pattern** for quota arbitrage. Here is how it applies to other providers:

## 1. OpenAI API (Platform)
**Verdict:** ✅ Easier than Google

*   **Credential:** API Keys (`sk-...`)
*   **Mechanism:**
    *   Store list of keys in pool.
    *   On request: Pick active key.
    *   On `429 Too Many Requests` or `420` (Legacy): Rotate.
    *   On `402 Payment Required` (Quota Reached): Mark as `expired`.
*   **Advantage:** No OAuth refresh flow needed. Keys are static.

## 2. ChatGPT (Web / Plus)
**Verdict:** ⚠️ Harder (Fragile)

*   **Credential:** Session Cookies or `access_token`
*   **Challenge:** 
    *   **Cloudflare:** Aggressive bot detection.
    *   **Short-lived:** Tokens expire quickly (hours/days).
    *   **Browser Fingerprint:** APIs often check headers/TLS.
*   **Implementation:** Requires "Webview Token Extraction" (opening hidden browser to login) rather than pure API calls.

## 3. GitHub Copilot
**Verdict:** ✅ Very Similar

*   **Credential:** GitHub OAuth Token (`ghu_...`)
*   **Mechanism:**
    *   Authenticate multiple GitHub accounts.
    *   Pool the CoPilot tokens.
    *   Rotate on rate limits.
*   **Note:** This is a common strategy for "Free CoPilot" proxies.

## 4. Anthropic (Claude)
**Verdict:** ✅ Same as OpenAI

*   **Credential:** API Keys (`sk-ant-...`)
*   **Mechanism:** Pool keys, rotate on 429.

---

## The Abstract Pattern

```typescript
interface ResourcePool {
  resources: Credential[];
  
  dispatch(request): Response {
    const cred = this.getNextAvailable();
    try {
      return execute(request, cred);
    } catch (error) {
      if (isRateLimit(error)) {
        this.markCooldown(cred);
        return this.dispatch(request); // Retry with next
      }
      throw error;
    }
  }
}
```
