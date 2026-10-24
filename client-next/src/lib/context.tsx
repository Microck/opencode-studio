"use client";

import axios from "axios";
import { changeMcp, mcpServers, mcpEnabled, nativeMcp } from "@/lib/mcp-config";
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getConfig, saveConfig as apiSaveConfig, getSkills, getPlugins, toggleSkill as apiToggleSkill, togglePlugin as apiTogglePlugin, checkHealth, checkVersion, getPendingAction, clearPendingAction, syncAuto, syncPush, getSyncStatus, type PendingAction, type VersionCheck } from '@/lib/api';
import type { OpencodeConfig, MCPConfig, SkillInfo, PluginInfo } from '@/types';
import { UpdateRequiredModal } from '@/components/update-required-modal';

interface AppContextType {
  config: OpencodeConfig | null;
  skills: SkillInfo[];
  plugins: PluginInfo[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  pendingAction: PendingAction | null;
  serverVersion: string | null;
  refreshData: () => Promise<void>;
  saveConfig: (config: OpencodeConfig) => Promise<void>;
  toggleMCP: (key: string) => Promise<void>;
  deleteMCP: (key: string) => Promise<void>;
  addMCP: (key: string, mcpConfig: MCPConfig) => Promise<void>;
  updateMCP: (key: string, mcpConfig: MCPConfig) => Promise<void>;
  toggleSkill: (name: string) => Promise<void>;
  togglePlugin: (name: string) => Promise<void>;
  dismissPendingAction: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function sanitizeMCPConfig(config: MCPConfig): MCPConfig {
  const newConfig = { ...config };
  
  // Merge args into command if present
  if (newConfig.args && newConfig.args.length > 0) {
    if (!newConfig.command) newConfig.command = [];
    if (Array.isArray(newConfig.command)) {
      newConfig.command = [...newConfig.command, ...newConfig.args];
    }
    delete newConfig.args;
  }
  
  // Rename env to environment
  if (newConfig.env) {
    newConfig.environment = { ...newConfig.environment, ...newConfig.env };
    delete newConfig.env;
  }
  
  return newConfig;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<OpencodeConfig | null>(null);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [versionInfo, setVersionInfo] = useState<VersionCheck | null>(null);
  const connectedRef = useRef(false);
  const updateConnection = useCallback((value: boolean) => {
    connectedRef.current = value;
    setConnected(value);
  }, []);
  const refreshGenerationRef = useRef(0);
  const checkedPendingRef = useRef(false);
  const versionCheckedRef = useRef(false);
  const autoSyncCheckedRef = useRef(false);

  const fetchData = useCallback(() => {
    // Newer refreshes (especially profile switches) own the resulting state.
    const generation = ++refreshGenerationRef.current;
    return Promise.all([
        getConfig(),
        getSkills(),
        getPlugins(),
      ]).then(([configData, skillsData, pluginsData]) => {
      if (generation !== refreshGenerationRef.current) return;
      setError(null);
      setConfig(configData);
      setSkills(skillsData);
      setPlugins(pluginsData);
      // We are connected because the requests succeeded
      updateConnection(true);
    }).catch((err: unknown) => {
      if (generation !== refreshGenerationRef.current) return;
      let errorMessage = 'Failed to load data from backend';
      
      const httpError = axios.isAxiosError<{ error?: string; message?: string }>(err) ? err : null;
      if (httpError?.code === 'ERR_NETWORK') {
        errorMessage = 'Backend server is unreachable. Ensure "npm start" is running.';
      } else if (httpError?.response) {
        const status = httpError.response.status;
        const data = httpError.response.data;
        
        if (status === 404) {
          errorMessage = 'OpenCode configuration not found. Please run "opencode --version" in your terminal to initialize it.';
          setConfig(null);
          setSkills([]);
          setPlugins([]);
          updateConnection(true);
        } else if (status === 500) {
          errorMessage = `Server Error (500): ${data?.error || data?.message || 'Check backend logs'}`;
        } else if (status === 403) {
          errorMessage = 'Access Denied (403): Check backend CORS or permission settings.';
        } else {
          errorMessage = `HTTP Error ${status}: ${data?.error || data?.message || 'Unknown server error'}`;
        }
      } else if (err instanceof Error) {
        errorMessage = `Error: ${err.message}`;
      }

      setError(errorMessage);
      updateConnection(Boolean(httpError?.response));
      console.error(err);
    }).finally(() => {
      if (generation === refreshGenerationRef.current) setLoading(false);
    });
  }, [updateConnection]);

  const refreshData = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchData();
  }, [fetchData]);

  const checkForPendingAction = useCallback(async () => {
    if (checkedPendingRef.current) return;
    checkedPendingRef.current = true;
    
    try {
      const action = await getPendingAction();
      if (action) {
        setPendingAction(action);
      }
    } catch {
      // Ignore errors here
    }
  }, []);

  useEffect(() => {
    const checkServerVersion = async () => {
      if (versionCheckedRef.current) return;
      const result = await checkVersion();
      setVersionInfo(result);
      if (result.connected) {
        versionCheckedRef.current = true;
      }
    };

    const checkAutoSync = async () => {
      if (autoSyncCheckedRef.current) return;
      autoSyncCheckedRef.current = true;
      try {
        const result = await syncAuto();
        if (result.action === 'pulled') {
          console.log('[AutoSync] Pulled newer config from cloud');
          await refreshData();
        }
      } catch {}
    };

    const pollHealth = async () => {
      try {
        const isHealthy = await checkHealth();
        if (isHealthy) {
          if (!connectedRef.current) {
            updateConnection(true);
            checkServerVersion();
            checkAutoSync();
            refreshData();
            checkForPendingAction();
          }
        } else {
          if (connectedRef.current) {
            updateConnection(false);
            setError('Backend disconnected. Attempting to reconnect...');
            checkedPendingRef.current = false;
          }
        }
      } catch {
        if (connectedRef.current) {
          updateConnection(false);
          setError('Backend connection lost. Check if the server is still running.');
        }
      }
    };

    checkServerVersion();
    checkAutoSync();
    void fetchData();

    const interval = setInterval(pollHealth, 3000);
    return () => clearInterval(interval);
  }, [fetchData, refreshData, updateConnection, checkForPendingAction]);

  const dismissPendingAction = useCallback(async () => {
    await clearPendingAction();
    setPendingAction(null);
  }, []);

  const triggerAutoSync = useCallback(async () => {
    try {
      const status = await getSyncStatus();
      if (status.connected && status.autoSync) {
        await syncPush();
      }
    } catch {}
  }, []);

  const saveConfigHandler = useCallback(async (newConfig: OpencodeConfig) => {
    await apiSaveConfig(newConfig);
    setConfig(newConfig);
    triggerAutoSync();
  }, [triggerAutoSync]);

  const toggleMCP = useCallback(async (key: string) => {
    const latest = await getConfig();
    const server = mcpServers(latest)[key];
    if (!server) return;
    const updated = nativeMcp(latest)
      ? { ...server, disabled: mcpEnabled(server) }
      : { ...server, enabled: !mcpEnabled(server) };
    await saveConfigHandler(changeMcp(latest, key, updated));
  }, [saveConfigHandler]);

  const deleteMCP = useCallback(async (key: string) => {
    const latest = await getConfig();
    await saveConfigHandler(changeMcp(latest, key, null));
  }, [saveConfigHandler]);

  const addMCP = useCallback(async (key: string, mcpConfig: MCPConfig) => {
    const latest = await getConfig();
    await saveConfigHandler(changeMcp(latest, key, sanitizeMCPConfig(mcpConfig)));
  }, [saveConfigHandler]);

  const updateMCP = addMCP;

  const toggleSkill = useCallback(async (name: string) => {
    const result = await apiToggleSkill(name);
    setSkills(prev => prev.map(s => s.name === name ? { ...s, enabled: result.enabled } : s));
  }, []);

  const togglePlugin = useCallback(async (name: string) => {
    const result = await apiTogglePlugin(name);
    setPlugins(prev => prev.map(p => p.name === name ? { ...p, enabled: result.enabled } : p));
  }, []);

  const showUpdateModal = versionInfo?.connected && !versionInfo?.isCompatible;

  return (
    <AppContext.Provider
      value={{
        config,
        skills,
        plugins,
        loading,
        error,
        connected,
        pendingAction,
        serverVersion: versionInfo?.version || null,
        refreshData,
        saveConfig: saveConfigHandler,
        toggleMCP,
        deleteMCP,
        addMCP,
        updateMCP,
        toggleSkill,
        togglePlugin,
        dismissPendingAction,
      }}
    >
      {showUpdateModal && (
        <UpdateRequiredModal
          currentVersion={versionInfo?.version || null}
          minVersion={versionInfo?.minRequired || ''}
        />
      )}
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
