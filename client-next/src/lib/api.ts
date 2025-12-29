import axios from 'axios';
import type { OpencodeConfig, SkillFile, PluginFile } from '@/types';

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

export async function getSkills(): Promise<string[]> {
  const { data } = await api.get<string[]>('/skills');
  return data;
}

export async function getSkill(name: string): Promise<SkillFile> {
  const { data } = await api.get<SkillFile>(`/skills/${name}`);
  return data;
}

export async function saveSkill(name: string, content: string): Promise<void> {
  await api.post(`/skills/${name}`, { content });
}

export async function deleteSkill(name: string): Promise<void> {
  await api.delete(`/skills/${name}`);
}

export async function getPlugins(): Promise<string[]> {
  const { data } = await api.get<string[]>('/plugins');
  return data;
}

export async function getPlugin(name: string): Promise<PluginFile> {
  const { data } = await api.get<PluginFile>(`/plugins/${name}`);
  return data;
}

export async function savePlugin(name: string, content: string): Promise<void> {
  await api.post(`/plugins/${name}`, { content });
}

export default api;
