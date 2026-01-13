# antigravity auth implementation plan

**status:** planning
**target:** auth tab rework for multi-account orchestration
**based on:** antigravity repository analysis report

---

## executive summary

the antigravity report describes a sophisticated ecosystem for managing multiple google accounts to bypass rate limits ("quota arbitrage"). the key concepts applicable to opencode studio's auth tab are:

1. **multi-account rotation** - aggregate multiple google accounts into a pool
2. **automatic account switching** - seamless failover when hitting rate limits
3. **profile persistence** - encrypted/secure storage of credentials
4. **real-time quota monitoring** - status bar / dashboard visibility
5. **separate namespaces** - isolate gemini vs antigravity credentials

---

## current state analysis

### what exists now

| component | location | functionality |
|-----------|----------|---------------|
| auth page | `client-next/src/app/auth/page.tsx` | basic provider cards, google oauth, plugin toggle |
| api client | `client-next/src/lib/api.ts` | profile CRUD, google oauth start/status |
| backend | `server/index.js` | auth.json management, profile storage, oauth flow |
| types | `client-next/src/types/index.ts` | AuthCredential, AuthInfo, AuthProfilesInfo |

### current limitations

1. **single active profile per provider** - can save profiles but only one active at a time
2. **no rotation logic** - user must manually switch accounts
3. **no quota visibility** - no indication of rate limits or remaining quota
4. **no 429 handling** - client just fails on rate limit
5. **primitive ui** - basic cards, no account pool management
6. **no account health tracking** - no cooldown state, no usage metrics

---

## proposed architecture

### tier 1: account pool manager (high priority)

implement an "account pool" concept that aggregates multiple google accounts.

```
Account Pool
├── Profile 1 (work@gmail.com) - Active
│   ├── status: active | cooldown | expired
│   ├── last_used: timestamp
│   ├── usage_count: number
│   └── cooldown_until: timestamp | null
├── Profile 2 (personal@gmail.com) - Ready
└── Profile 3 (alt@gmail.com) - Cooldown (45 min remaining)
```

#### backend changes (server/index.js)

1. **new data structure**: extend profile storage with metadata
```javascript
// ~/.config/opencode-studio/auth-profiles/google.antigravity/work@gmail.json
{
  "credentials": { /* oauth tokens */ },
  "metadata": {
    "email": "work@gmail.com",
    "status": "active", // active | cooldown | expired
    "last_used": 1705123456789,
    "usage_count": 42,
    "cooldown_until": null,
    "created_at": 1705000000000
  }
}
```

2. **new endpoints**:
```
GET    /api/auth/pool                    - get all accounts with status
POST   /api/auth/pool/rotate             - trigger manual rotation
PUT    /api/auth/pool/:name/cooldown     - mark account as cooldown
DELETE /api/auth/pool/:name              - remove from pool
GET    /api/auth/pool/stats              - usage stats per account
```

3. **rotation dispatcher logic**:
```javascript
function getNextActiveAccount() {
  const pool = loadAccountPool();
  const now = Date.now();
  
  // filter available accounts
  const available = pool.filter(acc => 
    acc.status !== 'expired' &&
    (!acc.cooldown_until || acc.cooldown_until < now)
  );
  
  if (available.length === 0) {
    throw new Error('No available accounts in pool');
  }
  
  // round-robin or least-recently-used
  return available.sort((a, b) => a.last_used - b.last_used)[0];
}
```

#### frontend changes (client-next/src/app/auth/page.tsx)

1. **account pool visualization**:
   - replace flat profile list with pool status cards
   - show status badges: active (green), ready (blue), cooldown (yellow), expired (red)
   - countdown timer for cooldown accounts
   - usage sparklines per account

2. **pool management ui**:
   - drag-drop reorder priority
   - bulk add accounts (batch oauth flow)
   - pool health summary card at top

### tier 2: quota monitoring (medium priority)

implement real-time quota visibility inspired by AntigravityQuotaWatcher.

#### approach a: api polling (simpler)

since we can't sniff LSP like the vscode extension, poll a quota endpoint.

```javascript
// new endpoint
GET /api/quota/google
{
  "daily_limit": 1000,
  "remaining": 847,
  "reset_at": "2025-01-14T00:00:00Z",
  "by_account": [
    { "email": "work@gmail.com", "used": 100, "limit": 500 },
    { "email": "personal@gmail.com", "used": 53, "limit": 500 }
  ]
}
```

**note:** actual quota APIs may not be publicly available for antigravity. fallback: track usage locally based on requests we proxy.

#### frontend: quota status bar

add to sidebar or header:
```
[====------] 84.7% quota remaining (reset in 4h 23m)
```

color gradient: green > 50%, yellow > 30%, red < 30%

### tier 3: automatic rotation (advanced)

integrate rotation logic into the opencode proxy layer.

**challenge:** opencode studio is a config GUI, not a proxy. the actual requests go through opencode CLI directly.

**solution options:**

1. **config-based rotation**: write active account to auth.json, opencode CLI reads it
   - pros: simple, no proxy needed
   - cons: rotation happens between requests, not mid-request

2. **pre-request hook**: use opencode's experimental hooks feature
   ```json
   {
     "experimental": {
       "hooks": {
         "pre_message": ["opencode-studio-rotate"]
       }
     }
   }
   ```
   - pros: can rotate before each message
   - cons: requires custom plugin, adds latency

3. **external proxy** (like antigravity-manager): full man-in-the-middle
   - pros: transparent rotation, 429 retry
   - cons: massive scope creep, not suitable for a config GUI

**recommendation:** start with option 1 (config-based), consider option 2 later.

---

## implementation phases

### phase 1: account pool foundation (week 1)

**backend:**
- [ ] extend profile storage schema with metadata
- [ ] add `/api/auth/pool` endpoint
- [ ] implement rotation selection logic
- [ ] migrate existing profiles to new format

**frontend:**
- [ ] new `AccountPoolCard` component
- [ ] status badges with cooldown timers
- [ ] usage count display

**types:**
- [ ] add `AccountPoolEntry` interface
- [ ] update `AuthInfo` with pool data

### phase 2: enhanced account management (week 2)

**backend:**
- [ ] batch add accounts flow
- [ ] account health checks (validate tokens)
- [ ] cooldown auto-detection from 429s

**frontend:**
- [ ] pool health summary card
- [ ] priority reordering (drag-drop)
- [ ] account removal confirmation
- [ ] "add another account" quick flow

### phase 3: quota visibility (week 3)

**backend:**
- [ ] local usage tracking (log requests through studio)
- [ ] `/api/quota/google` endpoint
- [ ] daily/weekly reset logic

**frontend:**
- [ ] quota progress bar in sidebar
- [ ] per-account usage breakdown
- [ ] low quota warnings

### phase 4: rotation integration (week 4)

**backend:**
- [ ] rotation endpoint that updates auth.json
- [ ] optional pre-request hook plugin

**frontend:**
- [ ] manual rotation button
- [ ] auto-rotation toggle setting
- [ ] rotation history log

---

## ui/ux mockup

### auth tab layout (proposed)

```
┌─────────────────────────────────────────────────────────────┐
│ Authentication                                    [Refresh] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─ GOOGLE ACCOUNT POOL ─────────────────────────────────┐  │
│ │ [============================------] 78% quota         │  │
│ │ 3 accounts • 2 active • 1 cooldown                     │  │
│ │                                                        │  │
│ │ ┌────────────────────────────────────────────────────┐ │  │
│ │ │ ★ work@gmail.com                          [Active] │ │  │
│ │ │   42 requests today • Last used: 2 min ago         │ │  │
│ │ └────────────────────────────────────────────────────┘ │  │
│ │ ┌────────────────────────────────────────────────────┐ │  │
│ │ │   personal@gmail.com                       [Ready] │ │  │
│ │ │   18 requests today • Last used: 1 hour ago        │ │  │
│ │ └────────────────────────────────────────────────────┘ │  │
│ │ ┌────────────────────────────────────────────────────┐ │  │
│ │ │   alt@gmail.com                         [Cooldown] │ │  │
│ │ │   Rate limited • Ready in 43 min                   │ │  │
│ │ └────────────────────────────────────────────────────┘ │  │
│ │                                                        │  │
│ │ [+ Add Account]  [↻ Rotate Now]                       │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─ PLUGIN TOGGLE ────────────────────────────────────────┐  │
│ │ [Gemini CLI]  ←→  [Antigravity]                        │  │
│ │ Using: Antigravity (supports 10 accounts)              │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─ OTHER PROVIDERS ──────────────────────────────────────┐  │
│ │ Anthropic [Connected]    OpenAI [Disconnected]         │  │
│ │ xAI [Connected]          OpenRouter [Disconnected]     │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## new types (types/index.ts)

```typescript
export interface AccountPoolEntry {
  name: string;           // profile name / email
  email?: string;         // user email from oauth
  status: 'active' | 'ready' | 'cooldown' | 'expired';
  lastUsed: number;       // timestamp
  usageCount: number;     // requests today
  cooldownUntil: number | null;
  createdAt: number;
}

export interface AccountPool {
  provider: string;       // 'google', etc.
  namespace: string;      // 'google.antigravity' or 'google.gemini'
  accounts: AccountPoolEntry[];
  activeAccount: string | null;
}

export interface QuotaInfo {
  dailyLimit: number;
  remaining: number;
  resetAt: string;        // ISO timestamp
  byAccount: {
    email: string;
    used: number;
    limit: number;
  }[];
}

export interface AuthInfoExtended extends AuthInfo {
  pool?: AccountPool;
  quota?: QuotaInfo;
}
```

---

## new api endpoints (api.ts)

```typescript
// account pool
export async function getAccountPool(): Promise<AccountPool>;
export async function rotateAccount(): Promise<{ newActive: string }>;
export async function markAccountCooldown(name: string, duration?: number): Promise<void>;
export async function removeFromPool(name: string): Promise<void>;
export async function getPoolStats(): Promise<AccountPoolEntry[]>;

// quota
export async function getQuotaInfo(): Promise<QuotaInfo>;
```

---

## new backend routes (server/index.js)

```javascript
// Account pool management
app.get('/api/auth/pool', (req, res) => { /* ... */ });
app.post('/api/auth/pool/rotate', (req, res) => { /* ... */ });
app.put('/api/auth/pool/:name/cooldown', (req, res) => { /* ... */ });
app.delete('/api/auth/pool/:name', (req, res) => { /* ... */ });
app.get('/api/auth/pool/stats', (req, res) => { /* ... */ });

// Quota tracking
app.get('/api/quota/google', (req, res) => { /* ... */ });
app.post('/api/quota/log', (req, res) => { /* ... */ }); // for manual logging
```

---

## migration strategy

### backward compatibility

1. existing profiles in `~/.config/opencode-studio/auth-profiles/` remain valid
2. on first load, migrate to new format by adding default metadata
3. old clients can still read/write profiles (metadata is optional)

### migration script (run once)

```javascript
function migrateProfiles() {
  const profileDirs = ['google.gemini', 'google.antigravity'];
  for (const ns of profileDirs) {
    const dir = path.join(AUTH_PROFILES_DIR, ns);
    if (!fs.existsSync(dir)) continue;
    
    for (const file of fs.readdirSync(dir)) {
      const filePath = path.join(dir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // skip if already migrated
      if (data.metadata) continue;
      
      // wrap old format
      const migrated = {
        credentials: data,
        metadata: {
          email: null,
          status: 'ready',
          last_used: Date.now(),
          usage_count: 0,
          cooldown_until: null,
          created_at: fs.statSync(filePath).birthtimeMs
        }
      };
      
      atomicWriteFileSync(filePath, JSON.stringify(migrated, null, 2));
    }
  }
}
```

---

## security considerations

1. **token storage**: continue using filesystem permissions (chmod 600)
2. **no plaintext secrets in logs**: redact tokens in console output
3. **oauth state validation**: verify state param to prevent CSRF
4. **cooldown spoofing**: validate cooldown source (only set from actual 429s)

---

## open questions

1. **quota api availability**: does antigravity/gemini expose a quota endpoint?
   - if not, track usage locally (less accurate but still useful)

2. **rotation trigger**: manual only, or automatic based on usage patterns?
   - start manual, add auto-rotation as opt-in setting later

3. **cross-machine sync**: should profiles sync across devices?
   - out of scope for v1, but encrypted export/import covers this

4. **rate limit detection**: how to detect 429s from opencode CLI?
   - option: parse CLI output via experimental hooks
   - option: user manually marks account as rate-limited

---

## files to modify

| file | changes |
|------|---------|
| `server/index.js` | new pool endpoints, migration logic, quota tracking |
| `client-next/src/app/auth/page.tsx` | complete rewrite with pool UI |
| `client-next/src/lib/api.ts` | new pool/quota API functions |
| `client-next/src/types/index.ts` | new pool/quota interfaces |
| `client-next/src/components/account-pool-card.tsx` | new component |
| `client-next/src/components/quota-bar.tsx` | new component |

---

## success metrics

1. **pool utilization**: >80% of users with multiple accounts use rotation
2. **reduced rate limits**: fewer 429 errors reported
3. **quota visibility**: users can see remaining quota at a glance
4. **time to add account**: <30 seconds to add a new account to pool

---

## timeline estimate

| phase | duration | deliverables |
|-------|----------|--------------|
| phase 1 | 5-7 days | pool foundation, basic UI |
| phase 2 | 3-5 days | enhanced management |
| phase 3 | 3-4 days | quota visibility |
| phase 4 | 3-4 days | rotation integration |
| **total** | **14-20 days** | full implementation |

---

## next steps

1. review this plan, confirm scope
2. start phase 1 implementation
3. iterate based on testing feedback
