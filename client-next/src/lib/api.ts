import axios from 'axios';
import type { OpencodeConfig, SkillFile, PluginFile, SkillInfo, PluginInfo, AuthInfo, AuthProvider } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const PROTOCOL_URL = 'opencodestudio://launch';

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

export async function checkHealth(): Promise<boolean> {
  try {
    await api.get('/health', { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
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
  const { data } = await api.get('/debug/paths');
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

export async function authLogin(provider: string): Promise<{ success: boolean; message: string; note: string }> {
  const { data } = await api.post('/auth/login', { provider });
  return data;
}

export async function authLogout(provider: string): Promise<void> {
  await api.delete(`/auth/${provider}`);
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

export const getUsageStats = async (projectId?: string | null, granularity: string = 'daily'): Promise<UsageStats> => {
  try {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (granularity) params.set('granularity', granularity);
    
    const res = await api.get(`/usage?${params.toString()}`);
    return res.data;
  } catch (error) {
    console.error("Failed to fetch usage stats:", error);
    return { totalCost: 0, totalTokens: 0, byModel: [], byDay: [], byProject: [] };
  }
};

export interface AuthProfilesInfo {
  [provider: string]: {
    profiles: string[];
    active: string | null;
    hasCurrentAuth: boolean;
  };
}

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
  const { data } = await api.post(`/auth/profiles/${provider}/${name}/activate`);
  return data;
}

export async function deleteAuthProfile(provider: string, name: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/auth/profiles/${provider}/${name}`);
  return data;
}

export async function renameAuthProfile(provider: string, name: string, newName: string): Promise<{ success: boolean; name: string }> {
  const { data } = await api.put(`/auth/profiles/${provider}/${name}`, { newName });
  return data;
}

export default api;
