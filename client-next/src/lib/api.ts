import axios from 'axios';
import type { OpencodeConfig, SkillFile, PluginFile, SkillInfo, PluginInfo, AuthInfo, AuthProvider, StudioConfig, PluginModelsConfig, AuthProfilesInfo, Preset, PresetConfig } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const PROTOCOL_URL = 'opencodestudio://launch';

export const MIN_SERVER_VERSION = '1.12.8';

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
    await api.get('/health', { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export async function checkVersion(): Promise<VersionCheck> {
  try {
    const { data } = await api.get<HealthResponse>('/health', { timeout: 3000 });
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

export async function getDebugPaths(): Promise<any> {
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
      const { [name]: removed, ...rest } = config.command;
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

export async function getGoogleDriveAuthUrl(redirectUri?: string): Promise<{ url: string }> {
  const params = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
  const { data } = await api.get<{ url: string }>(`/sync/gdrive/auth-url${params}`);
  return data;
}

export async function googleDriveCallback(code: string, state: string): Promise<{ success: boolean; provider: string }> {
  const { data } = await api.post('/sync/gdrive/callback', { code, state });
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

export default api;
