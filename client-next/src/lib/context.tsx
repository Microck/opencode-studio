"use client";

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
  const healthCheckRef = useRef<NodeJS.Timeout | null>(null);
  const loadingRef = useRef(false);
  const checkedPendingRef = useRef(false);
  const versionCheckedRef = useRef(false);
  const autoSyncCheckedRef = useRef(false);

  const refreshData = useCallback(async () => {
    // Prevent multiple simultaneous refreshes
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
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
      // We are connected because the requests succeeded
      setConnected(true);
    } catch (err: any) {
      let errorMessage = 'Failed to load data from backend';
      
      if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Backend server is unreachable. Ensure "npm start" is running.';
      } else if (err.response) {
        const status = err.response.status;
        const data = err.response.data;
        
        if (status === 404) {
          errorMessage = 'OpenCode configuration not found. Please run "opencode --version" in your terminal to initialize it.';
          setConfig(null);
          setConnected(true);
        } else if (status === 500) {
          errorMessage = `Server Error (500): ${data?.error || data?.message || 'Check backend logs'}`;
        } else if (status === 403) {
          errorMessage = 'Access Denied (403): Check backend CORS or permission settings.';
        } else {
          errorMessage = `HTTP Error ${status}: ${data?.error || data?.message || 'Unknown server error'}`;
        }
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }

      setError(errorMessage);
      setConnected(err.response ? true : false);
      console.error(err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

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
          if (!connected) {
            setConnected(true);
            checkServerVersion();
            checkAutoSync();
            refreshData();
            checkForPendingAction();
          }
        } else {
          if (connected) {
            setConnected(false);
            setError('Backend disconnected. Attempting to reconnect...');
            checkedPendingRef.current = false;
          }
        }
      } catch {
        if (connected) {
          setConnected(false);
          setError('Backend connection lost. Check if the server is still running.');
        }
      }
    };

    checkServerVersion();
    checkAutoSync();
    refreshData();

    const interval = setInterval(pollHealth, 3000);
    return () => clearInterval(interval);
  }, [refreshData, connected, checkForPendingAction]);

  const dismissPendingAction = useCallback(async () => {
    await clearPendingAction();
    setPendingAction(null);
  }, []);

  const triggerAutoSync = useCallback(async () => {
    try {
      const status = await getSyncStatus();
      if (status.configured && status.autoSync) {
        await syncPush();
        console.log('[AutoSync] Pushed config to cloud');
      }
    } catch {}
  }, []);

  const saveConfigHandler = useCallback(async (newConfig: OpencodeConfig) => {
    await apiSaveConfig(newConfig);
    setConfig(newConfig);
    triggerAutoSync();
  }, [triggerAutoSync]);

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
    const sanitizedConfig = sanitizeMCPConfig(mcpConfig);
    const newConfig = {
      ...config,
      mcp: {
        ...config.mcp,
        [key]: sanitizedConfig,
      },
    };
    await saveConfigHandler(newConfig);
  }, [config, saveConfigHandler]);

  const updateMCP = useCallback(async (key: string, mcpConfig: MCPConfig) => {
    if (!config) return;
    const sanitizedConfig = sanitizeMCPConfig(mcpConfig);
    const newConfig = {
      ...config,
      mcp: {
        ...config.mcp,
        [key]: sanitizedConfig,
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
