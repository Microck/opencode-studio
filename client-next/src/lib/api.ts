import axios from 'axios';
import type { OpencodeConfig, SkillFile, PluginFile, SkillInfo, PluginInfo, AuthInfo, AuthProvider } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export default api;
