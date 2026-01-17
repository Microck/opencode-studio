"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Key, 
  LogOut, 
  Plus, 
  RefreshCw, 
  Sparkles, 
  Check, 
  ChevronDown,
  Users,
  Save,
  Trash2,
  Edit2,
  MoreVertical,
  Terminal,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { 
  getAuthInfo, 
  authLogin, 
  authLogout, 
  addPluginsToConfig,
  getAuthProfiles,
  saveAuthProfile,
  activateAuthProfile,
  deleteAuthProfile,
  renameAuthProfile,
  setActiveGooglePlugin,
  startGoogleOAuth,
  getGoogleOAuthStatus,
  getAccountPool,
  rotateAccount,
  markAccountCooldown,
  clearAccountCooldown,
  clearAllAuthProfiles,
  getCooldownRules,
  type CooldownRule,
} from "@/lib/api";
import type { AuthCredential, AuthProfilesInfo, AccountPool, QuotaInfo } from "@/types";
import { AccountPoolCard } from "@/components/account-pool-card";

const GEMINI_AUTH_PLUGIN = "opencode-gemini-auth@latest";
const ANTIGRAVITY_AUTH_PLUGIN = "opencode-google-antigravity-auth";

const GeminiLogo = ({ className }: { className?: string }) => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2C12 2 12.5 7.5 15 9.5C17.5 11.5 22 12 22 12C22 12 17.5 12.5 15 14.5C12.5 16.5 12 22 12 22C12 22 11.5 16.5 9 14.5C6.5 12.5 2 12 2 12C2 12 6.5 11.5 9 9.5C11.5 7.5 12 2 12 2Z" fill="currentColor"/>
  </svg>
);

const AntigravityLogo = ({ className }: { className?: string }) => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 3L2 21H22L12 3Z" fill="currentColor" fillOpacity="0.2"/>
    <path d="M12 3L7 21H17L12 3Z" fill="currentColor"/>
    <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.5"/>
  </svg>
);

function profilesToPool(provider: string, profiles: AuthProfilesInfo[string]): AccountPool {
  const profileList = profiles?.profiles || [];
  const active = profiles?.active;
  
  return {
    provider,
    namespace: provider,
    totalAccounts: profileList.length,
    availableAccounts: profileList.length,
    activeAccount: active || null,
    accounts: profileList.map(name => ({
      name,
      email: name,
      status: active === name ? 'active' : 'ready',
      lastUsed: 0,
      usageCount: 0,
      cooldownUntil: null,
      createdAt: 0
    }))
  };
}

export default function AuthPage() {
  const [credentials, setCredentials] = useState<AuthCredential[]>([]);
  const [authFile, setAuthFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutTarget, setLogoutTarget] = useState<AuthCredential | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [addingPlugin, setAddingPlugin] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  
  const [profiles, setProfiles] = useState<AuthProfilesInfo>({});
  const [expandedProfiles, setExpandedProfiles] = useState<Record<string, boolean>>({});
  const [savingProfile, setSavingProfile] = useState<string | null>(null);
  const [activatingProfile, setActivatingProfile] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ provider: string; name: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ provider: string; name: string; current: string } | null>(null);
  const [newName, setNewName] = useState("");

  const [installedGooglePlugins, setInstalledGooglePlugins] = useState<('gemini' | 'antigravity')[]>([]);
  const [activeGooglePlugin, setActiveGooglePluginState] = useState<'gemini' | 'antigravity' | null>(null);
  const [switchingPlugin, setSwitchingPlugin] = useState(false);
  const [googleOAuthLoading, setGoogleOAuthLoading] = useState(false);

  const [pool, setPool] = useState<AccountPool | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [rotating, setRotating] = useState(false);
  
  const [openaiPool, setOpenaiPool] = useState<AccountPool | null>(null);
  const [openaiQuota, setOpenaiQuota] = useState<QuotaInfo | null>(null);
  const [openaiRotating, setOpenaiRotating] = useState(false);
  const [cooldownRules, setCooldownRules] = useState<CooldownRule[]>([]);

  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('auth-tutorial-seen');
    if (!seen) {
      setShowTutorial(true);
    }
  }, []);

  const dismissTutorial = () => {
    localStorage.setItem('auth-tutorial-seen', 'true');
    setShowTutorial(false);
  };

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [authInfo, profilesData, poolData, openaiPoolData, rules] = await Promise.all([
        getAuthInfo(),
        getAuthProfiles(),
        getAccountPool('google').catch(() => null),
        getAccountPool('openai').catch(() => null),
        getCooldownRules().catch(() => []),
      ]);
      setCredentials(authInfo.credentials);
      setAuthFile(authInfo.authFile);
      setInstalledGooglePlugins(authInfo.installedGooglePlugins || []);
      setActiveGooglePluginState(authInfo.activeGooglePlugin || null);
      setProfiles(profilesData || {});
      setCooldownRules(rules || []);
      if (poolData) {
        setPool(poolData.pool);
        setQuota(poolData.quota);
      }
      if (openaiPoolData) {
        setOpenaiPool(openaiPoolData.pool);
        setOpenaiQuota(openaiPoolData.quota);
      }
    } catch {
      if (!silent) toast.error("Failed to load auth info");
    } finally {
      if (!silent) setLoading(false);
      if (activeGooglePlugin === 'antigravity') {
        setTimeout(() => loadData(true), 120000);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogin = async (providerId: string = "") => {
    // Start polling immediately (in case user runs manual command or auto-launch fails)
    const startTime = Date.now();
    const pollInterval = setInterval(async () => {
      if (Date.now() - startTime > 120000) {
        clearInterval(pollInterval);
        setLoginLoading(false);
        return;
      }
      await loadData(true);
    }, 3000);

    try {
      setLoginLoading(true);
      const pid = providerId === 'google' ? "" : providerId;
      const result = await authLogin(pid);
      toast.success(result.message);
      toast.info(result.note, { duration: 10000 });
      if (result.command) {
        toast.info(`Command: ${result.command}`, { duration: 30000 });
      }
    } catch {
      const cmd = `opencode auth login ${providerId === 'google' ? '' : providerId}`.trim();
      toast.error("Automatic terminal launch failed. Run manually:", {
        description: cmd,
        action: {
          label: "Copy",
          onClick: () => navigator.clipboard.writeText(cmd),
        },
        duration: 30000,
      });
      // Do not stop polling
    }
  };

  const handleVerifyLogin = async () => {
    try {
      setVerifying(true);
      await loadData(true);
      toast.success("Auth status refreshed");
    } catch {
      toast.error("Failed to verify login");
    } finally {
      setVerifying(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (activeGooglePlugin === 'antigravity') {
      await handleLogin('google');
      return;
    }

    try {
      setGoogleOAuthLoading(true);
      await startGoogleOAuth();
      toast.info("Browser opened for Google login...", { duration: 5000 });

      const pollInterval = setInterval(async () => {
        try {
          const status = await getGoogleOAuthStatus();
          if (status.status === 'success') {
            clearInterval(pollInterval);
            setGoogleOAuthLoading(false);
            toast.success(`Logged in as ${status.email || 'Google User'}`);
            await loadData();
          } else if (status.status === 'error') {
            clearInterval(pollInterval);
            setGoogleOAuthLoading(false);
            toast.error(status.error || 'Login failed');
          }
        } catch {
          clearInterval(pollInterval);
          setGoogleOAuthLoading(false);
          toast.error('Login check failed');
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        setGoogleOAuthLoading(false);
        toast.error("Login timed out");
      }, 120000);

    } catch {
      setGoogleOAuthLoading(false);
      toast.error("Failed to start Google login");
    }
  };

  const handleLogout = async () => {
    if (!logoutTarget) return;
    try {
      await authLogout(logoutTarget.id);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to logout: ${msg}`);
    } finally {
      setLogoutTarget(null);
    }
  };

  const handleLogoutProfile = async (providerId: string, profileName: string) => {
    try {
      await deleteAuthProfile(providerId, profileName);
      toast.success(`Logged out from ${profileName}`);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to logout from profile: ${msg}`);
    }
  };

  const handleClearAllProfiles = async (provider: string) => {
    if (!confirm(`Are you sure you want to delete ALL profiles for ${provider}? This cannot be undone.`)) return;
    try {
      await clearAllAuthProfiles(provider);
      toast.success(`Cleared all profiles for ${provider}`);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to clear profiles: ${msg}`);
    }
  };

  const handleAddPlugin = async (name: string) => {
    try {
      setAddingPlugin(name);
      const result = await addPluginsToConfig([name]);
      if (result.added.length > 0) {
        toast.success(`${name} added! Restart opencode to use it.`);
        loadData();
      } else {
        toast.info("Plugin already in config");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to add plugin: ${msg}`);
    } finally {
      setAddingPlugin(null);
    }
  };

  const handleSetGooglePlugin = async (plugin: 'gemini' | 'antigravity') => {
    try {
      setSwitchingPlugin(true);
      await setActiveGooglePlugin(plugin);
      setActiveGooglePluginState(plugin);
      toast.success(`Switched to ${plugin === 'gemini' ? 'Gemini Auth' : 'Antigravity Auth'}`);
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to switch plugin: ${msg}`);
    } finally {
      setSwitchingPlugin(false);
    }
  };

  const handleRenameProfile = async (provider: string, name: string, newName: string) => {
    try {
      await renameAuthProfile(provider, name, newName);
      toast.success(`Renamed to ${newName}`);
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to rename: ${msg}`);
      throw err;
    }
  };

  const handleSaveProfile = async (provider: string) => {
    try {
      setSavingProfile(provider);
      const result = await saveAuthProfile(provider);
      toast.success(`Saved as ${result.name}`);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to save profile: ${msg}`);
    } finally {
      setSavingProfile(null);
    }
  };

  const handleActivateProfile = async (provider: string, name: string) => {
    try {
      setActivatingProfile(`${provider}-${name}`);
      await activateAuthProfile(provider, name);
      toast.success(`Switched to ${name}`);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to switch profile: ${msg}`);
    } finally {
      setActivatingProfile(null);
    }
  };

  const handleDeleteProfile = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAuthProfile(deleteTarget.provider, deleteTarget.name);
      toast.success(`Deleted ${deleteTarget.name}`);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to delete profile: ${msg}`);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleRenameSubmit = async () => {
    if (!renameTarget || !newName.trim()) return;
    try {
      await handleRenameProfile(renameTarget.provider, renameTarget.name, newName.trim());
      setRenameTarget(null);
      setNewName("");
    } catch {
      // Error already handled
    }
  };

  const toggleProfileExpansion = (provider: string) => {
    setExpandedProfiles(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleRotate = async (provider: string) => {
    try {
      if (provider === 'google') setRotating(true);
      else if (provider === 'openai') setOpenaiRotating(true);
      
      const result = await rotateAccount(provider);
      toast.success(`Switched from ${result.previousAccount || 'none'} to ${result.newAccount}`);
      await loadData(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "No available accounts";
      toast.error(`Failed to rotate: ${msg}`);
    } finally {
      if (provider === 'google') setRotating(false);
      else if (provider === 'openai') setOpenaiRotating(false);
    }
  };

  const handleActivate = async (provider: string, name: string) => {
    try {
      await activateAuthProfile(provider, name);
      toast.success(`Activated ${name}`);
      await loadData(true);
    } catch (err: any) {
      toast.error(`Failed to activate: ${err.message}`);
    }
  };

  const handleRemove = async (provider: string, name: string) => {
    try {
      await deleteAuthProfile(provider, name);
      toast.success(`Removed ${name}`);
      await loadData(true);
    } catch (err: any) {
      toast.error(`Failed to remove: ${err.message}`);
    }
  };

  const handleCooldown = async (provider: string, name: string, rule?: string) => {
    try {
      await markAccountCooldown(name, provider, undefined, rule);
      const ruleText = rule ? ` (${rule})` : ' for 1 hour';
      toast.success(`${name} marked as cooldown${ruleText}`);
      await loadData(true);
    } catch (err: any) {
      toast.error(`Failed to set cooldown: ${err.message}`);
    }
  };

  const handleClearCooldown = async (provider: string, name: string) => {
    try {
      await clearAccountCooldown(name, provider);
      toast.success(`${name} cooldown cleared`);
      await loadData(true);
    } catch (err: any) {
      toast.error(`Failed to clear cooldown: ${err.message}`);
    }
  };

  const handleClearAll = async (provider: string) => {
    try {
      await clearAllAuthProfiles(provider);
      toast.success(`All ${provider} accounts removed`);
      await loadData(true);
    } catch (err: any) {
      toast.error(`Failed to clear accounts: ${err.message}`);
    }
  };

  const hasBothPlugins = installedGooglePlugins.includes('gemini') && installedGooglePlugins.includes('antigravity');
  
  // Logic: Providers with pools or special handling go to main column
  const mainProviders = credentials.filter(c => {
     if (c.id === 'google') return true;
     // OpenAI or others: if they have multiple profiles, treat as pool
     return (profiles[c.id]?.profiles?.length || 0) > 0;
  }).sort((a, b) => {
     // Google first, then OpenAI, then A-Z
     if (a.id === 'google') return -1;
     if (b.id === 'google') return 1;
     if (a.id === 'openai') return -1;
     if (b.id === 'openai') return 1;
     return a.name.localeCompare(b.name);
  });

  const sidebarProviders = credentials.filter(c => !mainProviders.find(p => p.id === c.id));

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      <header className="flex justify-between items-end border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Authentication</h1>
            {authFile && (
              <Badge variant="outline" className="text-xs font-mono font-normal text-muted-foreground hidden sm:flex">
                {authFile}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Manage AI provider connections and account pools.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowTutorial(true)} title="Show help">
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column: Pools */}
        <div className="lg:col-span-2 space-y-8">
          
          {mainProviders.map(cred => {
              // Determine if we have a real pool or synthetic one
              let currentPool: AccountPool | null = null;
              
              if (cred.id === 'google' && pool) {
                 currentPool = pool;
              } else if (cred.id === 'openai' && openaiPool) {
                currentPool = openaiPool;
             } else if (profiles[cred.id]?.profiles?.length > 0) {
                currentPool = profilesToPool(cred.id, profiles[cred.id]);
             }

             // Special Google Header
             const isGoogle = cred.id === 'google';
             
             return (
               <section key={cred.id} className="space-y-4">
                 <div className="flex items-center justify-between">
                   <h2 className="text-lg font-semibold tracking-tight">{cred.name}</h2>
                   {isGoogle && hasBothPlugins && (
                    <div className="bg-muted p-1 rounded-lg inline-flex items-center">
                      <button
                        onClick={() => handleSetGooglePlugin('gemini')}
                        disabled={switchingPlugin}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                          activeGooglePlugin === 'gemini' 
                            ? "bg-background shadow-sm text-foreground" 
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <GeminiLogo className="h-3 w-3" />
                        Gemini
                      </button>
                      <button
                        onClick={() => handleSetGooglePlugin('antigravity')}
                        disabled={switchingPlugin}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                          activeGooglePlugin === 'antigravity' 
                            ? "bg-background shadow-sm text-foreground" 
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <AntigravityLogo className="h-3 w-3" />
                        Antigravity
                      </button>
                    </div>
                   )}
                 </div>

                 {currentPool ? (
                    <AccountPoolCard
                      pool={currentPool}
                      cooldownRules={cooldownRules}
                      onAddAccount={isGoogle ? handleGoogleLogin : () => handleLogin(cred.id)}
                      isAdding={isGoogle ? googleOAuthLoading : loginLoading}
                      onRotate={() => handleRotate(cred.id)}
                      onActivate={(name) => handleActivate(cred.id, name)}
                      onCooldown={(name, rule) => handleCooldown(cred.id, name, rule)}
                      onClearCooldown={(name) => handleClearCooldown(cred.id, name)}
                      onClearAll={() => handleClearAll(cred.id)}
                      onRemove={(name) => handleRemove(cred.id, name)}
                      onRename={(name, newName) => handleRenameProfile(cred.id, name, newName)}
                      rotating={cred.id === 'openai' ? openaiRotating : (isGoogle ? rotating : false)}
                      providerName={cred.name}
                    />
                 ) : (
                    <div className="border border-dashed rounded-lg p-8 flex flex-col items-center text-center bg-muted/10">
                      <div className="bg-primary/10 p-3 rounded-full mb-4">
                        <Key className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-base font-medium mb-1">Connect {cred.name}</h3>
                      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                        {isGoogle 
                          ? "Connect your Google account to access Gemini models. Install antigravity-auth to enable multi-account pooling." 
                          : `Authenticate with ${cred.name} to access models.`}
                      </p>
                      <Button onClick={isGoogle ? handleGoogleLogin : () => handleLogin(cred.id)} disabled={isGoogle ? googleOAuthLoading : loginLoading} className="min-w-[140px]">
                        {isGoogle && googleOAuthLoading ? "Connecting..." : `Connect ${cred.name}`}
                      </Button>
                    </div>
                 )}
               </section>
             );
          })}

          {installedGooglePlugins.length < 2 && (
            <div className="border rounded-lg p-4 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Enhance Google Auth</p>
                  <p className="text-xs text-muted-foreground">Install plugins for specific auth modes.</p>
                </div>
              </div>
              <div className="flex gap-2">
                {!installedGooglePlugins.includes('gemini') && (
                  <Button onClick={() => handleAddPlugin(GEMINI_AUTH_PLUGIN)} disabled={!!addingPlugin} variant="outline" size="sm" className="h-8 text-xs">
                    Add Gemini
                  </Button>
                )}
                {!installedGooglePlugins.includes('antigravity') && (
                  <Button onClick={() => handleAddPlugin(ANTIGRAVITY_AUTH_PLUGIN)} disabled={!!addingPlugin} variant="outline" size="sm" className="h-8 text-xs">
                    Add Antigravity
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Other Providers */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Other Providers</h2>
            <Select
              value=""
              onValueChange={(value) => {
                if (value) handleLogin(value);
              }}
            >
              <SelectTrigger className="h-8 text-xs w-auto min-w-[100px]">
                <SelectValue placeholder="Connect..." />
              </SelectTrigger>
              <SelectContent>
                {sidebarProviders
                  .filter((cred) => {
                    const providerProfiles = profiles[cred.id] || { 
                      profiles: cred.profiles || [], 
                      active: cred.active || null, 
                      hasCurrentAuth: cred.hasCurrentAuth ?? true 
                    };
                    return !providerProfiles.hasCurrentAuth && providerProfiles.profiles?.length === 0;
                  })
                  .map((cred) => (
                    <SelectItem key={cred.id} value={cred.id}>
                      {cred.name}
                    </SelectItem>
                  ))}
                {sidebarProviders.filter((cred) => {
                  const providerProfiles = profiles[cred.id] || { 
                    profiles: cred.profiles || [], 
                    active: cred.active || null, 
                    hasCurrentAuth: cred.hasCurrentAuth ?? true 
                  };
                  return !providerProfiles.hasCurrentAuth && providerProfiles.profiles?.length === 0;
                }).length === 0 && (
                  <SelectItem value="" disabled>
                    All connected
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {sidebarProviders.map((cred) => {
              const providerProfiles = profiles[cred.id] || { 
                profiles: cred.profiles || [], 
                active: cred.active || null, 
                hasCurrentAuth: cred.hasCurrentAuth ?? true 
              };
              const isConnected = providerProfiles.hasCurrentAuth || providerProfiles.profiles?.length > 0;
              
              return (
                <div key={cred.id} className="border rounded-lg bg-card overflow-hidden">
                  <div className="p-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-md ${isConnected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        <Key className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{cred.name}</div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-[10px] text-muted-foreground">{isConnected ? 'Connected' : 'Disconnected'}</span>
                        </div>
                      </div>
                    </div>
                    {isConnected && (
                      <Button variant="ghost" size="icon" onClick={() => setLogoutTarget(cred)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <LogOut className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  
                  {!isConnected && (
                      <div className="px-3 pb-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8 text-xs"
                            onClick={() => handleLogin(cred.id)}
                            disabled={loginLoading}
                        >
                            Connect
                        </Button>
                      </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Dialogs */}
      <AlertDialog open={!!logoutTarget} onOpenChange={(o) => !o && setLogoutTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logout from {logoutTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will logout your credentials for this provider.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProfile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!renameTarget} onOpenChange={(o) => { if (!o) { setRenameTarget(null); setNewName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename profile</DialogTitle>
            <DialogDescription>
              Enter a new name for {renameTarget?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>New Name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={renameTarget?.current || "New profile name"}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRenameSubmit} disabled={!newName.trim() || newName === renameTarget?.name}>
              Rename
            </Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTutorial} onOpenChange={(o) => !o && dismissTutorial()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Welcome to Authentication
            </DialogTitle>
            <DialogDescription>
              Manage your AI provider connections in one place.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex gap-3 items-start">
              <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Account Pools</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Any provider with multiple accounts automatically becomes a pool. 
                  Switch between accounts instantly or mark them for cooldown.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 items-start">
              <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                <Terminal className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Terminal Login</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click "Connect" or "Add Account" to launch the login terminal. 
                  If it fails to open, copy the command and run it manually.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={dismissTutorial} className="w-full sm:w-auto">
              Got it
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
  }