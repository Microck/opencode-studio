import axios from 'axios';
import type { OpencodeConfig, SkillFile, PluginFile, SkillInfo, PluginInfo, AuthInfo, AuthProvider, AuthProfilesInfo, Preset, PresetConfig, AgentConfig, AgentInfo, AgentsResponse, SystemToolInfo, RulesResponse, MCPConfig, OhMyPreferences, OhMyConfigResponse, GitHubBackupStatus, GitHubBackupResult, GitHubBackupConfig, ConfigProviderId, ConfigProviderCreatePayload, ConfigProviderCreateProfilePayload, ConfigProviderCreateProfileResult, ConfigProviderCreateResult, ConfigProviderDetail, ConfigProviderExportResult, ConfigProviderImportPayload, ConfigProviderImportResult, ConfigProviderProfilesResult, ConfigProviderSavePayload, ConfigProviderSaveResult, ConfigProviderSummary, ConfigProviderSwitchProfilePayload, ConfigProviderSwitchProfileResult, ConfigProviderValidationPayload, ConfigProviderValidationResult } from '@/types';

const BACKEND_BASE_PORT = 1920;
const MAX_PORT_TRIES = 10;

let cachedApiUrl: string | null = null;
let resolvingApiUrl: Promise<string> | null = null;

type LocalNetworkFetchInit = RequestInit & { targetAddressSpace?: 'local' };

function normalizeHostname(hostname: string): string {
    return hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
}

function isLoopbackHost(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

function isLocalNetworkHost(hostname: string): boolean {
    if (hostname.endsWith('.local')) return true;

    const ipv4Parts = hostname.split('.');
    if (ipv4Parts.length === 4) {
        const octets = ipv4Parts.map((part) => Number(part));
        if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
            return false;
        }

        const [first, second] = octets;
        return first === 10 ||
            (first === 172 && second >= 16 && second <= 31) ||
            (first === 192 && second === 168) ||
            (first === 169 && second === 254);
    }

    return hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:');
}

function getTargetAddressSpace(url: string): 'local' | undefined {
    if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
        return undefined;
    }

    try {
        const hostname = normalizeHostname(new URL(url).hostname);
        if (isLoopbackHost(hostname)) {
            return 'local';
        }
        if (isLocalNetworkHost(hostname)) {
            return 'local';
        }
    } catch {}

    return undefined;
}

async function fetchWithTimeout(url: string, timeout: number, init: LocalNetworkFetchInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const targetAddressSpace = getTargetAddressSpace(url);

    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
            ...(targetAddressSpace ? { targetAddressSpace } : {}),
        } as LocalNetworkFetchInit);
    } finally {
        clearTimeout(timeoutId);
    }
}

async function probeBackendUrl(url: string): Promise<string | null> {
    try {
        const response = await fetchWithTimeout(`${url}/health`, 500, {
            cache: 'no-store',
            mode: 'cors',
        });
        return response.ok ? url : null;
    } catch {
        return null;
    }
}

async function discoverBackendPort(): Promise<string> {
    if (cachedApiUrl) return cachedApiUrl;
    if (resolvingApiUrl) return resolvingApiUrl;

    resolvingApiUrl = (async () => {
        const preferred = [envApiUrl, DEFAULT_API_URL].filter(Boolean) as string[];
        for (const candidate of preferred) {
            const ok = await probeBackendUrl(candidate);
            if (ok) {
                cachedApiUrl = ok;
                return ok;
            }
        }

        for (let i = 0; i < MAX_PORT_TRIES; i++) {
            const port = BACKEND_BASE_PORT + i;
            const testUrl = `http://127.0.0.1:${port}/api`;
            const ok = await probeBackendUrl(testUrl);
            if (ok) {
                cachedApiUrl = ok;
                return ok;
            }
        }

        throw new Error(`Cannot find backend server on ports ${BACKEND_BASE_PORT}-${BACKEND_BASE_PORT + MAX_PORT_TRIES - 1}`);
    })();

    try {
        return await resolvingApiUrl;
    } finally {
        resolvingApiUrl = null;
    }
}

const envApiUrl = process.env.NEXT_PUBLIC_API_URL;

const CLIENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.17.0';

const DEFAULT_API_URL = 'http://127.0.0.1:1920/api';

const api = axios.create({
  baseURL: envApiUrl || DEFAULT_API_URL,
  adapter: 'fetch',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Version': CLIENT_VERSION,
  },
});

api.interceptors.request.use(async (config) => {
  try {
    const url = await discoverBackendPort();
    config.baseURL = url;
  } catch {
    config.baseURL = config.baseURL || envApiUrl || DEFAULT_API_URL;
  }

  const requestUrl = new URL(config.url ?? '', config.baseURL).toString();
  const targetAddressSpace = getTargetAddressSpace(requestUrl);
  if (targetAddressSpace) {
    config.fetchOptions = {
      ...(config.fetchOptions ?? {}),
      targetAddressSpace,
    };
  }

  return config;
});

export const PROTOCOL_URL = 'opencodestudio://launch';

export const MIN_SERVER_VERSION = '2.4.2';

export async function getApiBaseUrl(): Promise<string> {
  try {
    const url = await discoverBackendPort();
    api.defaults.baseURL = url;
    return url;
  } catch {
    return api.defaults.baseURL || envApiUrl || 'http://127.0.0.1:1920/api';
  }
}

function compareVersions(current: string, minimum: string): boolean {
  const c = current.split('.').map(Number);
  const m = minimum.split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, m.length); i++) {
    const cv = c[i] || 0;
    const mv = m[i] || 0;
    if (cv > mv) return true;
    if (cv < mv) return false;
  }
  return true;
}

export interface HealthResponse {
  status: string;
  version?: string;
}

export interface VersionCheck {
  connected: boolean;
  version: string | null;
  isCompatible: boolean;
  minRequired: string;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const baseUrl = await getApiBaseUrl();
    const response = await fetchWithTimeout(`${baseUrl}/health`, 3000, {
      cache: 'no-store',
      mode: 'cors',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkVersion(): Promise<VersionCheck> {
  try {
    const baseUrl = await getApiBaseUrl();
    const response = await fetchWithTimeout(`${baseUrl}/health`, 3000, {
      cache: 'no-store',
      mode: 'cors',
    });
    if (!response.ok) {
      return { connected: false, version: null, isCompatible: false, minRequired: MIN_SERVER_VERSION };
    }
    const data = await response.json() as HealthResponse;
    const version = data.version || null;
    const isCompatible = version ? compareVersions(version, MIN_SERVER_VERSION) : false;
    return { connected: true, version, isCompatible, minRequired: MIN_SERVER_VERSION };
  } catch {
    return { connected: false, version: null, isCompatible: false, minRequired: MIN_SERVER_VERSION };
  }
}

export function buildProtocolUrl(action: string, params?: Record<string, string>): string {
  let url = `opencodestudio://${action}`;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      searchParams.set(key, value);
    }
    url += `?${searchParams.toString()}`;
  }
  return url;
}

const configProviderRoute = (id: ConfigProviderId, suffix = '') => `/config-providers/${encodeURIComponent(id)}${suffix}`;

export interface PendingAction {
  type: 'install-mcp' | 'import-skill' | 'import-plugin';
  name?: string;
  command?: string;
  url?: string;
  env?: Record<string, string>;
  timestamp: number;
}

export async function getPendingAction(): Promise<PendingAction | null> {
  try {
    const { data } = await api.get<{ action: PendingAction | null }>('/pending-action');
    return data.action;
  } catch {
    return null;
  }
}

export async function clearPendingAction(): Promise<void> {
  try {
    await api.delete('/pending-action');
  } catch {}
}

export async function shutdownBackend(): Promise<void> {
  try {
    await api.post('/shutdown');
  } catch {}
}

export interface PathsInfo {
  detected: string | null;
  manual: string | null;
  current: string | null;
  candidates: string[];
}

export async function getPaths(): Promise<PathsInfo> {
  const { data } = await api.get<PathsInfo>('/paths');
  return data;
}

export async function getDebugInfo() {
  try {
    const paths = await getPaths();
    const auth = await api.get('/debug/auth').then(res => res.data);
    const sync = await getSyncStatus();
    const health = await checkHealth();
    
    return {
      paths,
      auth,
      sync,
      serverHealthy: health,
      clientVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    };
  } catch (error) {
    console.error('Failed to fetch debug info:', error);
    return { error: 'Failed to fetch debug info' };
  }
}

export async function getDebugPaths(): Promise<PathsInfo> {
  const { data } = await api.get('/paths');
  return data;
}

export interface AuthDebugInfo {
  configPath: string | null;
  activeGooglePlugin: string | null;
  activeProfiles: Record<string, string>;
  authLocations: { path: string; exists: boolean; keys: string[] }[];
  profileDirs: Record<string, { path: string; exists: boolean; profiles: string[] }>;
  authProfilesDir: string;
}

export async function getAuthDebug(): Promise<AuthDebugInfo> {
  const { data } = await api.get<AuthDebugInfo>('/debug/auth');
  return data;
}

export async function setConfigPath(configPath: string | null): Promise<{ success: boolean; current: string | null }> {
  const { data } = await api.post('/paths', { configPath });
  return data;
}

export async function getConfig(): Promise<OpencodeConfig> {
  const { data } = await api.get<OpencodeConfig>('/config');
  return data;
}

export async function saveConfig(config: OpencodeConfig): Promise<void> {
  await api.post('/config', config);
}

export async function getAgents(): Promise<AgentInfo[]> {
  const { data } = await api.get<AgentsResponse>('/agents');
  return data.agents;
}

export async function saveAgent(name: string, config: AgentConfig, source: 'json' | 'markdown' | 'builtin' = 'markdown', scope?: 'project' | 'global') {
  const { data } = await api.post('/agents', { name, config, source, scope });
  return data;
}

export async function updateAgent(name: string, config: AgentConfig) {
  const { data } = await api.put(`/agents/${encodeURIComponent(name)}`, { config });
  return data;
}

export async function deleteAgent(name: string) {
  const { data } = await api.delete(`/agents/${encodeURIComponent(name)}`);
  return data;
}

export async function toggleAgent(name: string) {
  const { data } = await api.post(`/agents/${encodeURIComponent(name)}/toggle`);
  return data;
}

export async function getSystemTools(): Promise<SystemToolInfo[]> {
  const { data } = await api.get<SystemToolInfo[]>('/system/tools');
  return data;
}

export async function getProjectRules(): Promise<RulesResponse> {
  const { data } = await api.get<RulesResponse>('/project/rules');
  return data;
}

export async function saveProjectRules(content: string, source: 'AGENTS.md' | 'CLAUDE.md') {
  const { data } = await api.post('/project/rules', { content, source });
  return data;
}

export async function getSkills(): Promise<SkillInfo[]> {
  const { data } = await api.get<SkillInfo[]>('/skills');
  return data;
}

export async function getSkill(name: string): Promise<SkillFile> {
  const { data } = await api.get<SkillFile>(`/skills/${name}`);
  return data;
}

export async function saveSkill(name: string, description: string, content: string): Promise<void> {
  await api.post(`/skills/${name}`, { description, content });
}

export async function deleteSkill(name: string): Promise<void> {
  await api.delete(`/skills/${name}`);
}

export async function toggleSkill(name: string): Promise<{ enabled: boolean }> {
  const { data } = await api.post<{ success: boolean; enabled: boolean }>(`/skills/${name}/toggle`);
  return { enabled: data.enabled };
}

export async function getPlugins(): Promise<PluginInfo[]> {
  const { data } = await api.get<PluginInfo[]>('/plugins');
  return data;
}

export async function getPlugin(name: string): Promise<PluginFile> {
  const { data } = await api.get<PluginFile>(`/plugins/${name}`);
  return data;
}

export async function savePlugin(name: string, content: string): Promise<void> {
  await api.post(`/plugins/${name}`, { content });
}

export async function deletePlugin(name: string): Promise<void> {
  await api.delete(`/plugins/${name}`);
}

export async function togglePlugin(name: string): Promise<{ enabled: boolean }> {
  const { data } = await api.post<{ success: boolean; enabled: boolean }>(`/plugins/${name}/toggle`);
  return { enabled: data.enabled };
}

export async function getMcpServers(): Promise<Record<string, MCPConfig>> {
  const { data } = await api.get<Record<string, MCPConfig>>('/mcp');
  return data;
}

export async function getCommands(): Promise<Record<string, { template: string }>> {
  const { data } = await api.get<Record<string, { template: string }>>('/commands');
  return data;
}

export async function getModels(): Promise<{ providers: unknown[]; models: unknown[] }> {
  const { data } = await api.get<{ providers: unknown[]; models: unknown[] }>('/models');
  return data;
}

export async function getCommand(name: string): Promise<{ template: string }> {
  const config = await getConfig();
  const cmd = config.command?.[name];
  if (!cmd) throw new Error('Command not found');
  return cmd;
}

export async function saveCommand(name: string, template: string): Promise<void> {
  const config = await getConfig();
  const updated = {
    ...config,
    command: {
        ...config.command,
        [name]: { template }
    }
  };
  await saveConfig(updated);
}

export async function deleteCommand(name: string): Promise<void> {
  const config = await getConfig();
  if (config.command) {
      const rest = { ...config.command };
      delete rest[name];
      await saveConfig({ ...config, command: rest });
  }
}

export interface BackupData {
  version: number;
  timestamp: string;
  studioConfig: Record<string, unknown>;
  opencodeConfig: OpencodeConfig | null;
  skills: { name: string; content: string }[];
  plugins: { name: string; content: string }[];
}

export async function getBackup(): Promise<BackupData> {
  const { data } = await api.get<BackupData>('/backup');
  return data;
}

export async function restoreBackup(backup: BackupData): Promise<void> {
  await api.post('/restore', backup);
}

export type SyncProvider = 'dropbox' | 'gdrive' | null;

export interface SyncStatus {
  provider: SyncProvider;
  connected: boolean;
  lastSync: string | null;
  autoSync: boolean;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const { data } = await api.get<SyncStatus>('/sync/status');
  return data;
}

export async function setSyncConfig(config: { autoSync?: boolean }): Promise<{ success: boolean; autoSync: boolean }> {
  const { data } = await api.post('/sync/config', config);
  return data;
}

export async function getDropboxAuthUrl(redirectUri?: string): Promise<{ url: string }> {
  const params = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
  const { data } = await api.get<{ url: string }>(`/sync/dropbox/auth-url${params}`);
  return data;
}

export async function dropboxCallback(code: string, state: string): Promise<{ success: boolean; provider: string }> {
  const { data } = await api.post('/sync/dropbox/callback', { code, state });
  return data;
}

export async function disconnectSync(): Promise<{ success: boolean }> {
  const { data } = await api.post('/sync/disconnect', {});
  return data;
}

export async function syncPush(): Promise<{ success: boolean; timestamp: string }> {
  const { data } = await api.post('/sync/push', {});
  return data;
}

export async function syncPull(): Promise<{ success: boolean; timestamp: string; skills: number; plugins: number }> {
  const { data } = await api.post('/sync/pull', {});
  return data;
}

export async function syncAuto(): Promise<{ action: string; timestamp?: string; reason?: string }> {
  const { data } = await api.post('/sync/auto', {});
  return data;
}

export interface FetchUrlResult {
  content: string;
  filename: string;
  url: string;
}

export async function fetchUrl(url: string): Promise<FetchUrlResult> {
  const { data } = await api.post<FetchUrlResult>('/fetch-url', { url });
  return data;
}

export interface BulkFetchResult {
  url: string;
  success: boolean;
  error?: string;
  content?: string;
  body?: string;
  filename?: string;
  name?: string;
  description?: string;
}

export interface BulkFetchResponse {
  results: BulkFetchResult[];
}

export async function bulkFetchUrls(urls: string[]): Promise<BulkFetchResponse> {
  const { data } = await api.post<BulkFetchResponse>('/bulk-fetch', { urls });
  return data;
}

export async function getConfigProviders(): Promise<ConfigProviderSummary[]> {
  const { data } = await api.get<ConfigProviderSummary[]>('/config-providers');
  return data;
}

export async function getConfigProvider(id: ConfigProviderId): Promise<ConfigProviderDetail> {
  const { data } = await api.get<ConfigProviderDetail>(configProviderRoute(id));
  return data;
}

export async function validateConfigProvider(id: ConfigProviderId, payload: ConfigProviderValidationPayload = {}): Promise<ConfigProviderValidationResult> {
  const { data } = await api.post<ConfigProviderValidationResult>(configProviderRoute(id, '/validate'), payload);
  return data;
}

export async function saveConfigProvider(id: ConfigProviderId, payload: ConfigProviderSavePayload): Promise<ConfigProviderSaveResult> {
  const { data } = await api.post<ConfigProviderSaveResult>(configProviderRoute(id, '/save'), payload);
  return data;
}

export async function createConfigProvider(id: ConfigProviderId, payload: ConfigProviderCreatePayload = {}): Promise<ConfigProviderCreateResult> {
  const { data } = await api.post<ConfigProviderCreateResult>(configProviderRoute(id, '/create'), payload);
  return data;
}

export async function importConfigProvider(id: ConfigProviderId, payload: ConfigProviderImportPayload = {}): Promise<ConfigProviderImportResult> {
  const { data } = await api.post<ConfigProviderImportResult>(configProviderRoute(id, '/import'), payload);
  return data;
}

export async function exportConfigProvider(id: ConfigProviderId): Promise<ConfigProviderExportResult> {
  const { data } = await api.get<ConfigProviderExportResult>(configProviderRoute(id, '/export'));
  return data;
}

export async function getConfigProviderProfiles(id: ConfigProviderId): Promise<ConfigProviderProfilesResult> {
  const { data } = await api.get<ConfigProviderProfilesResult>(configProviderRoute(id, '/profiles'));
  return data;
}

export async function createConfigProviderProfile(id: ConfigProviderId, payload: ConfigProviderCreateProfilePayload): Promise<ConfigProviderCreateProfileResult> {
  const { data } = await api.post<ConfigProviderCreateProfileResult>(configProviderRoute(id, '/profiles'), payload);
  return data;
}

export async function switchConfigProviderProfile(id: ConfigProviderId, payload: ConfigProviderSwitchProfilePayload): Promise<ConfigProviderSwitchProfileResult> {
  const { data } = await api.post<ConfigProviderSwitchProfileResult>(configProviderRoute(id, '/profiles/switch'), payload);
  return data;
}

export async function getAuthInfo(): Promise<AuthInfo> {
  const { data } = await api.get<AuthInfo>('/auth');
  return data;
}

export async function getAuthProviders(): Promise<AuthProvider[]> {
  const { data } = await api.get<AuthProvider[]>('/auth/providers');
  return data;
}

export async function authLogin(provider: string): Promise<{ success: boolean; message: string; note: string; command?: string }> {
  const { data } = await api.post('/auth/login', { provider });
  return data;
}

export async function authLogout(provider: string): Promise<void> {
  await api.delete(`/auth/${provider}`);
}

export async function setActiveGooglePlugin(plugin: 'gemini' | 'antigravity' | null): Promise<{ success: boolean; activePlugin: string }> {
  const { data } = await api.post('/auth/google/plugin', { plugin });
  return data;
}

export async function getActiveGooglePlugin(): Promise<{ activePlugin: string | null }> {
  const { data } = await api.get('/auth/google/plugin');
  return data;
}

export interface AddPluginsToConfigResult {
  added: string[];
  skipped: string[];
}

export async function addPluginsToConfig(plugins: string[]): Promise<AddPluginsToConfigResult> {
  const { data } = await api.post<AddPluginsToConfigResult>('/plugins/config/add', { plugins });
  return data;
}

export async function deletePluginFromConfig(name: string): Promise<void> {
  await api.delete(`/plugins/config/${encodeURIComponent(name)}`);
}

export interface UsageStats {
  totalCost: number;
  totalTokens: number;
  byModel: { name: string; cost: number; tokens: number; inputTokens: number; outputTokens: number }[];
  byDay: { date: string; cost: number; tokens: number; inputTokens: number; outputTokens: number }[];
  byProject: { id: string; name: string; cost: number; tokens: number; inputTokens: number; outputTokens: number }[];
}

export const getUsageStats = async (
  projectId?: string | null,
  granularity: string = 'daily',
  range: string = '30d',
  from?: number,
  to?: number
): Promise<UsageStats> => {
  try {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (granularity) params.set('granularity', granularity);
    if (range) params.set('range', range);
    if (from) params.set('from', String(from));
    if (to) params.set('to', String(to));
    
    const res = await api.get(`/usage?${params.toString()}`);
    return res.data;
  } catch (error) {
    console.error("Failed to fetch usage stats:", error);
    return { totalCost: 0, totalTokens: 0, byModel: [], byDay: [], byProject: [] };
  }
};

export interface ProviderProfileInfo {
  profiles: string[];
  active: string | null;
  hasCurrentAuth: boolean;
}

export async function getAuthProfiles(): Promise<AuthProfilesInfo> {
  const { data } = await api.get<AuthProfilesInfo>('/auth/profiles');
  return data;
}

export async function getProviderProfiles(provider: string): Promise<ProviderProfileInfo> {
  const { data } = await api.get<ProviderProfileInfo>(`/auth/profiles/${provider}`);
  return data;
}

export async function saveAuthProfile(provider: string, name?: string): Promise<{ success: boolean; name: string }> {
  const { data } = await api.post(`/auth/profiles/${provider}`, { name });
  return data;
}

export async function activateAuthProfile(provider: string, name: string): Promise<{ success: boolean }> {
  const { data } = await api.post(`/auth/profiles/${encodeURIComponent(provider)}/${encodeURIComponent(name)}/activate`);
  return data;
}

export async function deleteAuthProfile(provider: string, name: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/auth/profiles/${encodeURIComponent(provider)}/${encodeURIComponent(name)}`);
  return data;
}

export async function clearAllAuthProfiles(provider: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/auth/profiles/${encodeURIComponent(provider)}/all`);
  return data;
}

export async function renameAuthProfile(provider: string, name: string, newName: string): Promise<{ success: boolean; name: string }> {
  const { data } = await api.put(`/auth/profiles/${encodeURIComponent(provider)}/${encodeURIComponent(name)}`, { newName });
  return data;
}

export interface GoogleOAuthStatus {
  status: 'idle' | 'pending' | 'success' | 'error';
  email?: string;
  error?: string;
}

export async function startGoogleOAuth(): Promise<{ success: boolean; authUrl: string; message: string }> {
  const { data } = await api.post('/auth/google/start');
  return data;
}

export async function getGoogleOAuthStatus(): Promise<GoogleOAuthStatus> {
  const { data } = await api.get('/auth/google/status');
  return data;
}

export async function cancelGoogleOAuth(): Promise<{ success: boolean }> {
  const { data } = await api.post('/auth/google/cancel');
  return data;
}

import type { AccountPool, QuotaInfo, PoolRotationResult } from '@/types';

export type { AccountPool, QuotaInfo, PoolRotationResult };

export interface PoolResponse {
  pool: AccountPool;
  quota: QuotaInfo;
}

export async function getAccountPool(provider: string = 'google'): Promise<PoolResponse> {
  const { data } = await api.get<PoolResponse>(`/auth/pool?provider=${provider}`);
  return data;
}

export async function rotateAccount(provider: string = 'google'): Promise<PoolRotationResult> {
  const { data } = await api.post<PoolRotationResult>('/auth/pool/rotate', { provider });
  return data;
}

export interface CooldownRule {
  name: string;
  duration: number;
}

export async function getCooldownRules(): Promise<CooldownRule[]> {
  const { data } = await api.get<CooldownRule[]>('/cooldowns');
  return data;
}

export async function addCooldownRule(name: string, duration: number): Promise<CooldownRule[]> {
  const { data } = await api.post<CooldownRule[]>('/cooldowns', { name, duration });
  return data;
}

export async function deleteCooldownRule(name: string): Promise<CooldownRule[]> {
  const { data } = await api.delete<CooldownRule[]>(`/cooldowns/${encodeURIComponent(name)}`);
  return data;
}

export async function markAccountCooldown(name: string, provider: string = 'google', duration?: number, rule?: string): Promise<{ success: boolean; cooldownUntil: number }> {
  const { data } = await api.put(`/auth/pool/${encodeURIComponent(name)}/cooldown`, { provider, duration, rule });
  return data;
}

export async function clearAccountCooldown(name: string, provider: string = 'google'): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/auth/pool/${encodeURIComponent(name)}/cooldown?provider=${provider}`);
  return data;
}

export async function incrementAccountUsage(name: string, provider: string = 'google'): Promise<{ success: boolean; usageCount: number }> {
  const { data } = await api.post(`/auth/pool/${encodeURIComponent(name)}/usage`, { provider });
  return data;
}

export async function updateAccountMetadata(name: string, provider: string = 'google', email?: string, projectId?: string, tier?: string): Promise<{ success: boolean }> {
  const { data } = await api.put(`/auth/pool/${encodeURIComponent(name)}/metadata`, { provider, email, projectId, tier });
  return data;
}

export async function getQuotaInfo(provider: string = 'google'): Promise<QuotaInfo> {
  const { data } = await api.get<QuotaInfo>(`/auth/pool/quota?provider=${provider}`);
  return data;
}

export async function setQuotaLimit(limit: number, provider: string = 'google'): Promise<{ success: boolean; dailyLimit: number }> {
  const { data } = await api.post('/auth/pool/quota/limit', { provider, limit });
  return data;
}

export async function savePoolLimit(provider: string, limit: number): Promise<{ success: boolean; limit: number }> {
  const { data } = await api.post('/auth/pool/limit', { provider, limit });
  return data;
}

export async function getPresets(): Promise<Preset[]> {
  const { data } = await api.get<Preset[]>('/presets');
  return data;
}

export async function savePreset(name: string, description: string, config: PresetConfig): Promise<Preset> {
  const { data } = await api.post<Preset>('/presets', { name, description, config });
  return data;
}

export async function updatePreset(id: string, name: string, description: string, config: PresetConfig): Promise<Preset> {
  const { data } = await api.put<Preset>(`/presets/${id}`, { name, description, config });
  return data;
}

export async function deletePreset(id: string): Promise<void> {
  await api.delete(`/presets/${id}`);
}

export async function applyPreset(id: string, mode: 'exclusive' | 'additive'): Promise<void> {
  await api.post(`/presets/${id}/apply`, { mode });
}

export interface ProfileList {
  profiles: string[];
  active: string | null;
}

export async function getProfiles(): Promise<ProfileList> {
  const { data } = await api.get<ProfileList>('/profiles');
  return data;
}

export async function createProfile(name: string): Promise<{ success: boolean }> {
  const { data } = await api.post('/profiles', { name });
  return data;
}

export async function deleteProfile(name: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/profiles/${encodeURIComponent(name)}`);
  return data;
}

export async function activateProfile(name: string): Promise<{ success: boolean }> {
  const { data } = await api.post(`/profiles/${encodeURIComponent(name)}/activate`);
  return data;
}

export async function getOhMyConfig(): Promise<OhMyConfigResponse> {
  const { data } = await api.get<OhMyConfigResponse>('/ohmyopencode');
  return data;
}

export async function saveOhMyConfig(preferences: OhMyPreferences): Promise<OhMyConfigResponse> {
  const { data } = await api.post<OhMyConfigResponse>('/ohmyopencode', { preferences });
  return data;
}

export async function getGitHubBackupStatus(): Promise<GitHubBackupStatus> {
  const { data } = await api.get<GitHubBackupStatus>('/github/backup/status');
  return data;
}

export async function backupToGitHub(config: GitHubBackupConfig): Promise<GitHubBackupResult> {
  const { data } = await api.post<GitHubBackupResult>('/github/backup', config);
  return data;
}

export async function restoreFromGitHub(config: GitHubBackupConfig): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post<{ success: boolean; message: string }>('/github/restore', config);
  return data;
}

export async function setGitHubAutoSync(enabled: boolean): Promise<{ success: boolean; enabled: boolean }> {
  const { data } = await api.post<{ success: boolean; enabled: boolean }>('/github/autosync', { enabled });
  return data;
}

export default api;
