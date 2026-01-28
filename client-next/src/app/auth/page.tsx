"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Login, Logout, CheckDouble, User, ChevronRight, Reload } from "@nsmr/pixelart-react"
import { getAuthInfo, getAuthProviders, authLogin, authLogout, getAuthProfiles, saveAuthProfile, activateAuthProfile, deleteAuthProfile } from "@/lib/api";
import type { AuthCredential, AuthProfilesInfo, AuthInfo, AuthProvider } from "@/types";
import { PageHelp } from "@/components/page-help";

export default function AuthPage() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);
  const [profiles, setProfiles] = useState<AuthProfilesInfo>({});
  const [loginLoading, setLoginLoading] = useState<Record<string, boolean>>({});

  const loadAuthData = async () => {
    try {
      const [providersData, authData, profilesData] = await Promise.all([
        getAuthProviders(),
        getAuthInfo(),
        getAuthProfiles()
      ]);

      setProviders(providersData);
      setAuthInfo(authData);
      setProfiles(profilesData);
    } catch (e) {
      console.error("Failed to load auth data", e);
      toast.error("Failed to load auth information");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuthData();
  }, []);

  const handleLogin = async (provider: string) => {
    setLoginLoading(prev => ({ ...prev, [provider]: true }));
    try {
      const result = await authLogin(provider);
      if (result.success) {
        toast.success(result.message || "Login terminal opened");
        await loadAuthData();
      } else {
        toast.error(result.message || "Login failed");
      }
    } catch (e) {
      console.error("Login failed", e);
      toast.error("Failed to start login process");
    } finally {
      setLoginLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleLogout = async (provider: string) => {
    if (!confirm(`Logout from ${provider}?`)) return;
    try {
      await authLogout(provider);
      toast.success(`Logged out from ${provider}`);
      await loadAuthData();
    } catch (e) {
      console.error("Logout failed", e);
      toast.error("Failed to logout");
    }
  };

  const handleSaveProfile = async (provider: string) => {
    try {
      const result = await saveAuthProfile(provider);
      toast.success(`Saved profile: ${result.name}`);
      await loadAuthData();
    } catch (e) {
      console.error("Save profile failed", e);
      toast.error("Failed to save profile");
    }
  };

  const handleActivateProfile = async (provider: string, name: string) => {
    try {
      await activateAuthProfile(provider, name);
      toast.success(`Activated profile: ${name}`);
      await loadAuthData();
    } catch (e) {
      console.error("Activate profile failed", e);
      toast.error("Failed to activate profile");
    }
  };

  const handleDeleteProfile = async (provider: string, name: string) => {
    if (!confirm(`Delete profile "${name}"?`)) return;
    try {
      await deleteAuthProfile(provider, name);
      toast.success(`Deleted profile: ${name}`);
      await loadAuthData();
    } catch (e) {
      console.error("Delete profile failed", e);
      toast.error("Failed to delete profile");
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <header className="flex justify-between items-start border-b pb-4">
        <div>
          <PageHelp
            title="Authentication"
            docUrl="https://opencode.ai/docs/auth"
            docTitle="Authentication Documentation"
          />
          <p className="text-muted-foreground mt-1">
            Manage your API credentials and switch between accounts.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAuthData}>
          <Reload className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => {
          const providerAuth = authInfo?.credentials.find(c => c.id === provider.id);
          const providerProfiles = profiles[provider.id];
          const isLoggedIn = providerAuth?.hasCurrentAuth;

          return (
            <Card key={provider.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {provider.name}
                      {isLoggedIn && <CheckDouble className="h-4 w-4 text-green-500" />}
                    </CardTitle>
                    <CardDescription>{provider.type === 'oauth' ? 'OAuth Login' : 'API Key'}</CardDescription>
                  </div>
                  <Badge variant={isLoggedIn ? "default" : "secondary"}>
                    {isLoggedIn ? "Logged In" : "Not Logged In"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-1">
                <div className="flex gap-2">
                  {isLoggedIn ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleSaveProfile(provider.id)}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Save Profile
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleLogout(provider.id)}
                      >
                        <Logout className="h-4 w-4 mr-2" />
                        Logout
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleLogin(provider.id)}
                      disabled={loginLoading[provider.id]}
                    >
                      {loginLoading[provider.id] ? (
                        <>Loading...</>
                      ) : (
                        <>
                          <Login className="h-4 w-4 mr-2" />
                          Login
                        </>
                      )}
                    </Button>
                  )}
                </div>

                  {providerProfiles && providerProfiles.profiles && providerProfiles.profiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">
                        Saved Profiles ({providerProfiles.profiles.length})
                      </div>
                      <div className="space-y-2">
                        {providerProfiles.profiles.map((profile: string) => (
                          <div
                            key={profile}
                            className={`flex items-center justify-between p-3 border rounded-md ${
                              providerProfiles.active === profile
                                ? "bg-primary/10 border-primary"
                                : "bg-muted/20"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate text-sm">{profile}</span>
                              {providerProfiles.active === profile && (
                                <Badge variant="default" className="text-[10px]">Active</Badge>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {providerProfiles.active !== profile && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleActivateProfile(provider.id, profile)}
                                  title="Switch to this profile"
                                >
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteProfile(provider.id, profile)}
                                title="Delete profile"
                              >
                                <Logout className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!providerProfiles?.profiles || providerProfiles.profiles.length === 0) && !isLoggedIn && (
                    <Alert>
                      <AlertDescription className="text-sm">
                        No saved profiles. Login to save your credentials for easy switching.
                      </AlertDescription>
                    </Alert>
                  )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
