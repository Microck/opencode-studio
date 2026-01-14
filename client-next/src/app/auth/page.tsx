"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  const [renameTarget, setRenameTarget] = useState<{ provider: string; name: string } | null>(null);
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
      const [authInfo, profilesData, poolData, openaiPoolData] = await Promise.all([
        getAuthInfo(),
        getAuthProfiles(),
        getAccountPool('google').catch(() => null),
        getAccountPool('openai').catch(() => null),
      ]);
      setCredentials(authInfo.credentials);
      setAuthFile(authInfo.authFile);
      setInstalledGooglePlugins(authInfo.installedGooglePlugins || []);
      setActiveGooglePluginState(authInfo.activeGooglePlugin || null);
      setProfiles(profilesData || {});
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
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogin = async (providerId: string = "") => {
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
      toast.error("Failed to open terminal");
    } finally {
      setLoginLoading(false);
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
        }
      }, 2000);
      
      setTimeout(() => {
        clearInterval(pollInterval);
        if (googleOAuthLoading) {
          setGoogleOAuthLoading(false);
          toast.error("Login timed out");
        }
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

  const handleRenameProfile = async () => {
    if (!renameTarget || !newName.trim()) return;
    try {
      const result = await renameAuthProfile(renameTarget.provider, renameTarget.name, newName.trim());
      toast.success(`Renamed to ${result.name}`);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to rename profile: ${msg}`);
    } finally {
      setRenameTarget(null);
      setNewName("");
    }
  };

  const toggleProfileExpansion = (provider: string) => {
    setExpandedProfiles(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handlePoolRotate = async () => {
    try {
      setRotating(true);
      const result = await rotateAccount('google');
      toast.success(`Switched from ${result.previousAccount || 'none'} to ${result.newAccount}`);
      await loadData(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "No available accounts";
      toast.error(`Failed to rotate: ${msg}`);
    } finally {
      setRotating(false);
    }
  };

  const handlePoolActivate = async (name: string) => {
    try {
      await activateAuthProfile('google', name);
      toast.success(`Activated ${name}`);
      await loadData(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to activate: ${msg}`);
    }
  };

  const handlePoolCooldown = async (name: string) => {
    try {
      await markAccountCooldown(name, 'google', 3600000);
      toast.success(`${name} marked as cooldown for 1 hour`);
      await loadData(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to set cooldown: ${msg}`);
    }
  };

  const handlePoolClearCooldown = async (name: string) => {
    try {
      await clearAccountCooldown(name, 'google');
      toast.success(`${name} cooldown cleared`);
      await loadData(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to clear cooldown: ${msg}`);
    }
  };

  const handleOpenaiPoolRotate = async () => {
    try {
      setOpenaiRotating(true);
      const result = await rotateAccount('openai');
      toast.success(`Switched from ${result.previousAccount || 'none'} to ${result.newAccount}`);
      await loadData(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "No available accounts";
      toast.error(`Failed to rotate: ${msg}`);
    } finally {
      setOpenaiRotating(false);
    }
  };
  
  const handleOpenaiPoolActivate = async (name: string) => {
    try {
      await activateAuthProfile('openai', name);
      toast.success(`Activated ${name}`);
      await loadData(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to activate: ${msg}`);
    }
  };
  
  const handleOpenaiPoolCooldown = async (name: string) => {
    try {
      await markAccountCooldown(name, 'openai', 3600000);
      toast.success(`${name} marked as cooldown for 1 hour`);
      await loadData(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to set cooldown: ${msg}`);
    }
  };
  
  const handleOpenaiPoolClearCooldown = async (name: string) => {
    try {
      await clearAccountCooldown(name, 'openai');
      toast.success(`${name} cooldown cleared`);
      await loadData(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to clear cooldown: ${msg}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-12 animate-fade-in">
        <h1 className="text-2xl font-bold">Authentication</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 md:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const hasBothPlugins = installedGooglePlugins.includes('gemini') && installedGooglePlugins.includes('antigravity');
  const otherCredentials = credentials.filter(c => c.id !== 'google');

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Authentication</h1>
          {authFile && (
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground hidden sm:flex">
              {authFile}
            </Badge>
          )}
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Column: Google Auth & Pool */}
        <div className="xl:col-span-2 space-y-6">
          
          {hasBothPlugins && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Google Auth Plugin
                </CardTitle>
                <CardDescription>
                  Choose between Gemini (standard) and Antigravity (multi-account)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant={activeGooglePlugin === 'gemini' ? 'default' : 'outline'}
                    disabled={switchingPlugin}
                    className={`justify-between h-[80px] px-4 border-2 transition-all group ${
                      activeGooglePlugin === 'gemini' ? 'border-primary' : 'border-transparent hover:border-primary/20'
                    }`}
                    onClick={() => handleSetGooglePlugin('gemini')}
                  >
                    <div className="text-left">
                      <div className="font-bold flex items-center gap-2">
                        {activeGooglePlugin === 'gemini' && <Check className="h-4 w-4" />}
                        Gemini Auth
                      </div>
                      <div className="text-xs opacity-70 mt-1">Standard single-account access</div>
                    </div>
                    <GeminiLogo className={`h-8 w-8 opacity-50 group-hover:opacity-100 transition-opacity ${activeGooglePlugin === 'gemini' ? 'opacity-100 text-primary-foreground' : ''}`} />
                  </Button>
                  <Button
                    variant={activeGooglePlugin === 'antigravity' ? 'default' : 'outline'}
                    disabled={switchingPlugin}
                    className={`justify-between h-[80px] px-4 border-2 transition-all group ${
                      activeGooglePlugin === 'antigravity' ? 'border-primary' : 'border-transparent hover:border-primary/20'
                    }`}
                    onClick={() => handleSetGooglePlugin('antigravity')}
                  >
                    <div className="text-left">
                      <div className="font-bold flex items-center gap-2">
                        {activeGooglePlugin === 'antigravity' && <Check className="h-4 w-4" />}
                        Antigravity
                      </div>
                      <div className="text-xs opacity-70 mt-1">Manage multiple accounts with rotation</div>
                    </div>
                    <AntigravityLogo className={`h-8 w-8 opacity-50 group-hover:opacity-100 transition-opacity ${activeGooglePlugin === 'antigravity' ? 'text-primary-foreground' : ''}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {pool && quota ? (
            <AccountPoolCard
              pool={pool}
              quota={quota}
              onAddAccount={handleGoogleLogin}
              isAdding={googleOAuthLoading}
              onRotate={handlePoolRotate}
              onActivate={handlePoolActivate}
              onCooldown={handlePoolCooldown}
              onClearCooldown={handlePoolClearCooldown}
              rotating={rotating}
              providerName="Google"
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Key className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-2">Connect Google Account</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md">
                  Connect your Google account to access Gemini models. 
                  Install <b>antigravity-auth</b> to enable multi-account pooling.
                </p>
                <Button onClick={handleGoogleLogin} disabled={googleOAuthLoading} variant="outline">
                  {googleOAuthLoading ? "Connecting..." : "Login with Google"}
                </Button>
              </CardContent>
            </Card>
          )}

          {openaiPool && openaiQuota && (openaiPool.accounts.length > 0) && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">OpenAI Pool</h3>
              <AccountPoolCard
                pool={openaiPool}
                quota={openaiQuota}
                onAddAccount={() => handleLogin('openai')}
                isAdding={loginLoading}
                onRotate={handleOpenaiPoolRotate}
                onActivate={handleOpenaiPoolActivate}
                onCooldown={handleOpenaiPoolCooldown}
                onClearCooldown={handleOpenaiPoolClearCooldown}
                rotating={openaiRotating}
                providerName="OpenAI"
              />
            </div>
          )}

          {installedGooglePlugins.length < 2 && (
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-3 mb-3 sm:mb-0">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Enhanced Google Auth</p>
                  <p className="text-xs text-muted-foreground">
                    Install plugins to enable specific auth modes.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!installedGooglePlugins.includes('gemini') && (
                  <Button onClick={() => handleAddPlugin(GEMINI_AUTH_PLUGIN)} disabled={!!addingPlugin} variant="outline" size="sm">
                    Add Gemini
                  </Button>
                )}
                {!installedGooglePlugins.includes('antigravity') && (
                  <Button onClick={() => handleAddPlugin(ANTIGRAVITY_AUTH_PLUGIN)} disabled={!!addingPlugin} variant="outline" size="sm">
                    Add Antigravity
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Side Column: Other Providers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Other Providers</h2>
            <Button variant="ghost" size="sm" onClick={() => handleLogin()} className="h-7 text-xs" disabled={loginLoading}>
              <Terminal className="h-3 w-3 mr-1" />
              Terminal Login
            </Button>
          </div>

          <div className="space-y-3">
            {otherCredentials.map((cred) => {
              const providerProfiles = profiles[cred.id] || { 
                profiles: cred.profiles || [], 
                active: cred.active || null, 
                hasCurrentAuth: cred.hasCurrentAuth ?? true 
              };
              const profileList = providerProfiles.profiles || [];
              const hasProfiles = profileList.length > 0;
              const isExpanded = expandedProfiles[cred.id];
              const isConnected = providerProfiles.hasCurrentAuth || hasProfiles;
              
              return (
                <Card key={cred.id} className={`transition-all hover:border-primary/50 ${!isConnected ? 'opacity-70' : ''}`}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${isConnected ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Key className={`h-4 w-4 ${isConnected ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-medium">{cred.name}</CardTitle>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="text-[10px] text-muted-foreground">{isConnected ? 'Connected' : 'Disconnected'}</span>
                          </div>
                        </div>
                      </div>
                      
                      {isConnected && !hasProfiles && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setLogoutTarget(cred)}
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        >
                          <LogOut className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-4 pt-2">
                    {isConnected ? (
                      <div className="space-y-2">
                        {providerProfiles.active && (
                          <div className="flex items-center gap-2 text-xs bg-muted/50 p-1.5 rounded px-2">
                            <Check className="h-3 w-3 text-primary" />
                            <span className="truncate flex-1 font-mono">{providerProfiles.active}</span>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          {hasProfiles ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full h-7 text-xs"
                              onClick={() => toggleProfileExpansion(cred.id)}
                            >
                              <Users className="h-3 w-3 mr-1.5" />
                              Profiles ({profileList.length})
                              <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-7 text-xs"
                              onClick={() => handleSaveProfile(cred.id)}
                              disabled={savingProfile === cred.id}
                            >
                              <Save className="h-3 w-3 mr-1.5" />
                              Save Profile
                            </Button>
                          )}
                        </div>

                        {hasProfiles && isExpanded && (
                          <div className="space-y-1 pt-1 animate-scale-in">
                            {profileList.map((profileName: string) => (
                              <div
                                key={profileName}
                                className={`flex items-center justify-between p-1.5 rounded text-xs transition-colors group ${
                                  providerProfiles.active === profileName ? "bg-primary/5 text-primary font-medium" : "hover:bg-muted cursor-pointer"
                                }`}
                                onClick={() => providerProfiles.active !== profileName && handleActivateProfile(cred.id, profileName)}
                              >
                                <span className="truncate">{profileName}</span>
                                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); handleLogoutProfile(cred.id, profileName); }}>
                                    <LogOut className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full h-6 text-[10px] text-muted-foreground"
                              onClick={() => handleLogin(cred.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Another
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8"
                        onClick={() => handleLogin(cred.id)}
                        disabled={loginLoading}
                      >
                        Connect
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

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

      <AlertDialog open={!!renameTarget} onOpenChange={(o) => { if (!o) { setRenameTarget(null); setNewName(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename profile</AlertDialogTitle>
          </AlertDialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New profile name"
            className="my-4"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenameProfile} disabled={!newName.trim() || newName === renameTarget?.name}>
              Rename
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <Key className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Google Auth Plugins</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <b>Gemini</b> = standard single-account. <b>Antigravity</b> = multi-account with rotation. 
                  Switch between them anytime if both are installed.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 items-start">
              <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Account Pool</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add multiple Google accounts and rotate between them. Useful when you hit rate limits - 
                  just click Rotate or mark an account as "cooldown".
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 items-start">
              <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                <Save className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Saved Profiles</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  For other providers (Anthropic, OpenRouter, etc.), save credentials as named profiles 
                  to quickly switch between API keys or accounts.
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
                  Click "Terminal Login" or the provider's Connect button to open an interactive terminal 
                  for OAuth or API key entry.
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
