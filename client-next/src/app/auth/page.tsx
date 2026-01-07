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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  CloudLightning,
  Stars,
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
} from "@/lib/api";
import type { AuthCredential, AuthProfilesInfo } from "@/types";

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

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [authInfo, profilesData] = await Promise.all([
        getAuthInfo(),
        getAuthProfiles(),
      ]);
      setCredentials(authInfo.credentials);
      setAuthFile(authInfo.authFile);
      setInstalledGooglePlugins(authInfo.installedGooglePlugins || []);
      setActiveGooglePluginState(authInfo.activeGooglePlugin || null);
      setProfiles(profilesData || {});
    } catch {
      if (!silent) toast.error("Failed to load auth info");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Poll for changes every 3 seconds to detect terminal login
    const interval = setInterval(() => loadData(true), 3000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (providerId: string = "") => {
    try {
      setLoginLoading(true);
      // If it's google, we don't pass it so the user can pick the plugin in the terminal
      const pid = providerId === 'google' ? "" : providerId;
      const result = await authLogin(pid);
      toast.success(result.message);
      toast.info(result.note, { duration: 10000 });
    } catch {
      toast.error("Failed to open terminal");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!logoutTarget) return;

    try {
      await authLogout(logoutTarget.id);
      loadData();
    } catch {
      toast.error("Failed to logout");
    } finally {
      setLogoutTarget(null);
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
    } catch {
      toast.error("Failed to add plugin");
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
    } catch {
      toast.error("Failed to switch plugin");
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
    } catch {
      toast.error("Failed to save profile");
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
    } catch {
      toast.error("Failed to switch profile");
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
    } catch {
      toast.error("Failed to delete profile");
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
    } catch {
      toast.error("Failed to rename profile");
    } finally {
      setRenameTarget(null);
      setNewName("");
    }
  };

  const toggleProfileExpansion = (provider: string) => {
    setExpandedProfiles(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  if (loading) {
    return (
    <div className="space-y-6 pb-12 animate-fade-in">
        <h1 className="text-2xl font-bold">Authentication</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const hasBothPlugins = installedGooglePlugins.includes('gemini') && installedGooglePlugins.includes('antigravity');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Authentication</h1>
        <Button variant="outline" size="sm" onClick={() => loadData()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card className="hover-lift">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Provider
          </CardTitle>
          <CardDescription>
            Opens a terminal to authenticate with OpenCode
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => handleLogin()} disabled={loginLoading}>
            {loginLoading ? "Opening..." : "Open Terminal"}
            <Terminal className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {hasBothPlugins && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Google Auth Plugin Toggle
            </CardTitle>
            <CardDescription>
              Switch between separate profiles for Gemini and Antigravity plugins
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant={activeGooglePlugin === 'gemini' ? 'default' : 'outline'}
                disabled={switchingPlugin}
                className={`justify-between h-[100px] py-4 px-4 border-2 transition-all group ${
                  activeGooglePlugin === 'gemini' ? 'border-primary' : 'border-transparent hover:border-primary/20'
                }`}
                onClick={() => handleSetGooglePlugin('gemini')}
              >
                <div className="text-left flex flex-col justify-center h-full">
                  <div className="font-bold flex items-center gap-2 text-base">
                    {activeGooglePlugin === 'gemini' && <Check className="h-4 w-4" />}
                    Gemini Auth
                  </div>
                  <div className="text-[11px] opacity-80 font-normal mt-1 leading-tight">
                    Use Gemini CLI quota & models
                  </div>
                  <div className="h-4" />
                </div>
                <GeminiLogo className={`h-10 w-10 ml-4 opacity-20 group-hover:opacity-40 transition-opacity ${activeGooglePlugin === 'gemini' ? 'opacity-100 text-primary-foreground' : ''}`} />
              </Button>
              <Button
                variant={activeGooglePlugin === 'antigravity' ? 'default' : 'outline'}
                disabled={switchingPlugin}
                className={`justify-between h-[100px] py-4 px-4 border-2 transition-all group relative overflow-hidden ${
                  activeGooglePlugin === 'antigravity' ? 'border-primary' : 'border-transparent hover:border-primary/20'
                }`}
                onClick={() => handleSetGooglePlugin('antigravity')}
              >
                {activeGooglePlugin !== 'antigravity' && (
                  <AntigravityLogo className="absolute inset-0 opacity-10 pointer-events-none" />
                )}
                <div className="text-left flex flex-col justify-center h-full relative z-10">
                  <div className="font-bold flex items-center gap-2 text-base">
                    {activeGooglePlugin === 'antigravity' && <Check className="h-4 w-4" />}
                    Antigravity
                  </div>
                  <div className="text-[10px] text-primary-foreground/80 mt-1 font-medium italic">
                    Supports up to 10 accounts!
                  </div>
                </div>
                <AntigravityLogo className={`h-10 w-10 ml-4 transition-opacity ${activeGooglePlugin === 'antigravity' ? 'text-primary-foreground' : 'opacity-20 group-hover:opacity-40'}`} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {installedGooglePlugins.length < 2 && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-dashed">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Want separate Google profiles?</p>
              <p className="text-xs text-muted-foreground">
                Install both <b>gemini-auth</b> and <b>antigravity-auth</b> to enable the toggle.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!installedGooglePlugins.includes('gemini') && (
              <Button onClick={() => handleAddPlugin(GEMINI_AUTH_PLUGIN)} disabled={!!addingPlugin} variant="outline" size="sm">
                {addingPlugin === GEMINI_AUTH_PLUGIN ? "Adding..." : "Add Gemini"}
              </Button>
            )}
            {!installedGooglePlugins.includes('antigravity') && (
              <Button onClick={() => handleAddPlugin(ANTIGRAVITY_AUTH_PLUGIN)} disabled={!!addingPlugin} variant="outline" size="sm">
                {addingPlugin === ANTIGRAVITY_AUTH_PLUGIN ? "Adding..." : "Add Antigravity"}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Connected</h2>
        
        {credentials?.length === 0 ? (
          <p className="text-muted-foreground text-sm">No providers connected yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(credentials || []).map((cred) => {
              const providerProfiles = profiles[cred.id] || { 
                profiles: cred.profiles || [], 
                active: cred.active || null, 
                hasCurrentAuth: cred.hasCurrentAuth ?? true 
              };
              const profileList = providerProfiles.profiles || [];
              const hasProfiles = profileList.length > 0;
              const isExpanded = expandedProfiles[cred.id];
              
              const isGoogleAndToggled = cred.id === 'google' && activeGooglePlugin;
              const titlePrefix = isGoogleAndToggled ? (activeGooglePlugin === 'gemini' ? '[Gemini] ' : '[Antigravity] ') : '';
              const isConnected = providerProfiles.hasCurrentAuth || hasProfiles;
              
              return (
                <Card key={cred.id} className={`hover-lift ${isGoogleAndToggled ? 'border-primary/30' : ''} ${!isConnected ? 'opacity-80 grayscale-[0.5]' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Key className={`h-4 w-4 ${isConnected ? 'text-primary' : 'text-muted-foreground'}`} />
                        {titlePrefix}{cred.name}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Badge variant={cred.type === "oauth" ? "default" : "secondary"}>
                          {cred.type}
                        </Badge>
                        {hasProfiles && (
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {profileList.length}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center h-8">
                      {!isConnected ? (
                        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-dashed">Disconnected</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 dark:border-green-900/30">Connected</Badge>
                      )}
                      
                      {isConnected && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLogoutTarget(cred)}
                          className="h-8 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <LogOut className="h-3 w-3 mr-1" />
                          Logout
                        </Button>
                      )}
                    </div>

                    {providerProfiles.active && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-1.5 rounded-md">
                        <Check className="h-3 w-3 text-primary" />
                        <span>Active:</span>
                        <Badge variant="secondary" className="text-[10px] h-4">
                          {providerProfiles.active}
                        </Badge>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {!isConnected ? (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full h-8"
                          onClick={() => handleLogin(cred.id)}
                          disabled={loginLoading}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Connect
                        </Button>
                      ) : (
                        <>
                          {!providerProfiles.active && providerProfiles.hasCurrentAuth && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-8 text-xs"
                              onClick={() => handleSaveProfile(cred.id)}
                              disabled={savingProfile === cred.id}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              {savingProfile === cred.id ? "Saving..." : "Save Profile"}
                            </Button>
                          )}
                          
                          {hasProfiles && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 h-8 text-xs"
                              onClick={() => toggleProfileExpansion(cred.id)}
                            >
                              <Users className="h-3 w-3 mr-1" />
                              Profiles ({profileList.length})
                              <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </Button>
                          )}
                        </>
                      )}
                    </div>

                    {hasProfiles && isExpanded && (
                      <div className="space-y-2 pt-2 border-t animate-scale-in">
                        {profileList.map((profileName: string) => {
                          const isActive = providerProfiles.active === profileName;
                          const isActivating = activatingProfile === `${cred.id}-${profileName}`;
                          
                          return (
                            <div
                              key={profileName}
                              className={`flex items-center justify-between p-2 rounded-md transition-colors group ${
                                isActive ? "bg-primary/10" : "bg-muted/50 hover:bg-muted cursor-pointer"
                              }`}
                              onClick={() => !isActive && !isActivating && handleActivateProfile(cred.id, profileName)}
                            >
                              <div className="flex items-center gap-2">
                                {isActive && <Check className="h-3 w-3 text-primary" />}
                                {isActivating && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
                                <span className="text-sm font-medium">{profileName}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity data-[state=open]:opacity-100"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setRenameTarget({ provider: cred.id, name: profileName });
                                        setNewName(profileName);
                                      }}
                                    >
                                      <Edit2 className="h-3 w-3 mr-2" />
                                      Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setDeleteTarget({ provider: cred.id, name: profileName })}
                                    >
                                      <Trash2 className="h-3 w-3 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          );
                        })}
                        
                        {providerProfiles.hasCurrentAuth && !profileList.includes(providerProfiles.active || "") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => handleSaveProfile(cred.id)}
                            disabled={savingProfile === cred.id}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            {savingProfile === cred.id ? "Saving..." : "Save Current"}
                          </Button>
                        )}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleLogin()}
                          disabled={loginLoading}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Account
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {authFile && (
        <p className="text-xs text-muted-foreground">
          Auth file: {authFile}
        </p>
      )}

      <AlertDialog open={!!logoutTarget} onOpenChange={(o) => !o && setLogoutTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logout from {logoutTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will logout your credentials for this provider. You&apos;ll need to login again to use their models.
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
            <AlertDialogTitle>Delete profile &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this saved profile. This action cannot be undone.
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
            <AlertDialogDescription>
              Enter a new name for this profile.
            </AlertDialogDescription>
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
      
      <div className="h-12" />
    </div>
  );
}
