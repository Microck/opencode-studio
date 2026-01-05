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
  type AuthProfilesInfo,
} from "@/lib/api";
import type { AuthCredential } from "@/types";

const GEMINI_AUTH_PLUGIN = "opencode-gemini-auth@latest";

export default function AuthPage() {
  const [credentials, setCredentials] = useState<AuthCredential[]>([]);
  const [authFile, setAuthFile] = useState<string | null>(null);
  const [hasGeminiAuthPlugin, setHasGeminiAuthPlugin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoutTarget, setLogoutTarget] = useState<AuthCredential | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [addingGeminiPlugin, setAddingGeminiPlugin] = useState(false);
  
  const [profiles, setProfiles] = useState<AuthProfilesInfo>({});
  const [expandedProfiles, setExpandedProfiles] = useState<Record<string, boolean>>({});
  const [savingProfile, setSavingProfile] = useState<string | null>(null);
  const [activatingProfile, setActivatingProfile] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ provider: string; name: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ provider: string; name: string } | null>(null);
  const [newName, setNewName] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [authInfo, profilesData] = await Promise.all([
        getAuthInfo(),
        getAuthProfiles(),
      ]);
      setCredentials(authInfo.credentials);
      setAuthFile(authInfo.authFile);
      setHasGeminiAuthPlugin(authInfo.hasGeminiAuthPlugin ?? false);
      setProfiles(profilesData);
    } catch {
      toast.error("Failed to load auth info");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogin = async () => {
    try {
      setLoginLoading(true);
      const result = await authLogin("");
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
      toast.success(`Logged out from ${logoutTarget.name}`);
      loadData();
    } catch {
      toast.error("Failed to logout");
    } finally {
      setLogoutTarget(null);
    }
  };

  const handleAddGeminiPlugin = async () => {
    try {
      setAddingGeminiPlugin(true);
      const result = await addPluginsToConfig([GEMINI_AUTH_PLUGIN]);
      if (result.added.length > 0) {
        toast.success("Gemini Auth plugin added! Restart opencode to use it.");
        setHasGeminiAuthPlugin(true);
      } else {
        toast.info("Plugin already in config");
      }
    } catch {
      toast.error("Failed to add plugin");
    } finally {
      setAddingGeminiPlugin(false);
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

  const formatExpiry = (timestamp: number | null) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return "Expired";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    
    const seconds = Math.floor(diff / 1000);
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  };

  const toggleProfileExpansion = (provider: string) => {
    setExpandedProfiles(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold">Authentication</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Authentication</h1>
        <Button variant="outline" size="sm" onClick={loadData}>
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
          <Button onClick={handleLogin} disabled={loginLoading}>
            {loginLoading ? "Opening..." : "Open Terminal"}
            <Terminal className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {!hasGeminiAuthPlugin && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-dashed">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Want free Gemini access?</p>
              <p className="text-xs text-muted-foreground">
                <a 
                  href="https://github.com/jenslys/opencode-gemini-auth" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  opencode-gemini-auth
                </a>
                {" "}lets you use Google OAuth
              </p>
            </div>
          </div>
          <Button onClick={handleAddGeminiPlugin} disabled={addingGeminiPlugin} variant="outline" size="sm">
            {addingGeminiPlugin ? "Adding..." : "Add Plugin"}
          </Button>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Connected</h2>
        
        {credentials.length === 0 ? (
          <p className="text-muted-foreground text-sm">No providers connected yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {credentials.map((cred) => {
              const providerProfiles = profiles[cred.id] || { profiles: [], active: null, hasCurrentAuth: true };
              const hasProfiles = providerProfiles.profiles.length > 0;
              const isExpanded = expandedProfiles[cred.id];
              
              return (
                <Card key={cred.id} className="hover-lift">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        {cred.name}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Badge variant={cred.type === "oauth" ? "default" : "secondary"}>
                          {cred.type}
                        </Badge>
                        {hasProfiles && (
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {providerProfiles.profiles.length}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLogoutTarget(cred)}
                      >
                        <LogOut className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>

                    {providerProfiles.active && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Active:</span>
                        <Badge variant="secondary" className="text-xs">
                          {providerProfiles.active}
                        </Badge>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {!providerProfiles.active && providerProfiles.hasCurrentAuth && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSaveProfile(cred.id)}
                          disabled={savingProfile === cred.id}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          {savingProfile === cred.id ? "Saving..." : "Save as Profile"}
                        </Button>
                      )}
                      
                      {hasProfiles && (
                        <Collapsible open={isExpanded} onOpenChange={() => toggleProfileExpansion(cred.id)}>
                          <CollapsibleTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1">
                              <Users className="h-3 w-3 mr-1" />
                              Profiles
                              <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </Button>
                          </CollapsibleTrigger>
                        </Collapsible>
                      )}
                    </div>

                    {hasProfiles && (
                      <Collapsible open={isExpanded}>
                        <CollapsibleContent className="animate-scale-in">
                          <div className="space-y-2 pt-2 border-t">
                            {providerProfiles.profiles.map((profileName) => {
                              const isActive = providerProfiles.active === profileName;
                              const isActivating = activatingProfile === `${cred.id}-${profileName}`;
                              
                              return (
                                <div
                                  key={profileName}
                                  className={`flex items-center justify-between p-2 rounded-md ${
                                    isActive ? "bg-primary/10" : "bg-muted/50"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    {isActive && <Check className="h-3 w-3 text-primary" />}
                                    <span className="text-sm">{profileName}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {!isActive && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => handleActivateProfile(cred.id, profileName)}
                                        disabled={isActivating}
                                      >
                                        {isActivating ? "..." : "Use"}
                                      </Button>
                                    )}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
                            
                            {providerProfiles.hasCurrentAuth && !providerProfiles.profiles.includes(providerProfiles.active || "") && (
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
                              onClick={handleLogin}
                              disabled={loginLoading}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Account
                            </Button>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
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
            <AlertDialogTitle>Remove {logoutTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your credentials for this provider. You&apos;ll need to login again to use their models.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
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
    </div>
  );
}
