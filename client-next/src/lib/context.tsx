"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getConfig, saveConfig as apiSaveConfig, getSkills, getPlugins, toggleSkill as apiToggleSkill, togglePlugin as apiTogglePlugin } from '@/lib/api';
import type { OpencodeConfig, MCPConfig, SkillInfo, PluginInfo } from '@/types';

interface AppContextType {
  config: OpencodeConfig | null;
  skills: SkillInfo[];
  plugins: PluginInfo[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  saveConfig: (config: OpencodeConfig) => Promise<void>;
  toggleMCP: (key: string) => Promise<void>;
  deleteMCP: (key: string) => Promise<void>;
  addMCP: (key: string, mcpConfig: MCPConfig) => Promise<void>;
  toggleSkill: (name: string) => Promise<void>;
  togglePlugin: (name: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<OpencodeConfig | null>(null);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [configData, skillsData, pluginsData] = await Promise.all([
        getConfig(),
        getSkills(),
        getPlugins(),
      ]);
      setConfig(configData);
      setSkills(skillsData);
      setPlugins(pluginsData);
    } catch (err) {
      setError('Failed to connect to backend');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const saveConfigHandler = useCallback(async (newConfig: OpencodeConfig) => {
    await apiSaveConfig(newConfig);
    setConfig(newConfig);
  }, []);

  const toggleMCP = useCallback(async (key: string) => {
    if (!config?.mcp?.[key]) return;
    const newConfig = {
      ...config,
      mcp: {
        ...config.mcp,
        [key]: {
          ...config.mcp[key],
          enabled: !config.mcp[key].enabled,
        },
      },
    };
    await saveConfigHandler(newConfig);
  }, [config, saveConfigHandler]);

  const deleteMCP = useCallback(async (key: string) => {
    if (!config) return;
    const rest = { ...config.mcp };
    delete rest[key];
    const newConfig = { ...config, mcp: rest };
    await saveConfigHandler(newConfig);
  }, [config, saveConfigHandler]);

  const addMCP = useCallback(async (key: string, mcpConfig: MCPConfig) => {
    if (!config) return;
    const newConfig = {
      ...config,
      mcp: {
        ...config.mcp,
        [key]: mcpConfig,
      },
    };
    await saveConfigHandler(newConfig);
  }, [config, saveConfigHandler]);

  const toggleSkill = useCallback(async (name: string) => {
    const result = await apiToggleSkill(name);
    setSkills(prev => prev.map(s => s.name === name ? { ...s, enabled: result.enabled } : s));
  }, []);

  const togglePlugin = useCallback(async (name: string) => {
    const result = await apiTogglePlugin(name);
    setPlugins(prev => prev.map(p => p.name === name ? { ...p, enabled: result.enabled } : p));
  }, []);

  return (
    <AppContext.Provider
      value={{
        config,
        skills,
        plugins,
        loading,
        error,
        refreshData,
        saveConfig: saveConfigHandler,
        toggleMCP,
        deleteMCP,
        addMCP,
        toggleSkill,
        togglePlugin,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
