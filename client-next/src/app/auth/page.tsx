"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [logoutProvider, setLogoutProvider] = useState("");
  const [deleteProfileDialogOpen, setDeleteProfileDialogOpen] = useState(false);
  const [deleteProfileTarget, setDeleteProfileTarget] = useState<{ provider: string; name: string } | null>(null);
  const t = useTranslations('auth');

  const loadAuthData = useCallback(() => Promise.all([
    getAuthProviders(), getAuthInfo(), getAuthProfiles(),
  ]).then(([providersData, authData, profilesData]) => {
    setProviders(providersData);
    setAuthInfo(authData);
    setProfiles(profilesData);
  }).catch(error => {
    console.error("Failed to load auth data", error);
    toast.error(t('failedToLoad'));
  }).finally(() => setLoading(false)), [t]);

  useEffect(() => { void loadAuthData(); }, [loadAuthData]);

  const handleLogin = async (provider: string) => {
    setLoginLoading(prev => ({ ...prev, [provider]: true }));
    try {
      const result = await authLogin(provider);
      if (result.success) {
        toast.success(result.message || t('loginTerminalOpened'));
        await loadAuthData();
      } else {
        toast.error(result.message || t('loginFailed'));
      }
    } catch (e) {
      console.error("Login failed", e);
      toast.error(t('failedToStartLogin'));
    } finally {
      setLoginLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleLogout = async (provider: string) => {
    setLogoutProvider(provider);
    setLogoutDialogOpen(true);
  };

  const confirmLogout = async () => {
    try {
      await authLogout(logoutProvider);
      toast.success(t('loggedOut', { provider: logoutProvider }));
      await loadAuthData();
    } catch (e) {
      console.error("Logout failed", e);
      toast.error(t('failedToLogout'));
    }
    setLogoutDialogOpen(false);
  };

  const handleSaveProfile = async (provider: string) => {
    try {
      const result = await saveAuthProfile(provider);
      toast.success(t('savedProfile', { name: result.name }));
      await loadAuthData();
    } catch (e) {
      console.error("Save profile failed", e);
      toast.error(t('failedToSaveProfile'));
    }
  };

  const handleActivateProfile = async (provider: string, name: string) => {
    try {
      await activateAuthProfile(provider, name);
      toast.success(t('activatedProfile', { name }));
      await loadAuthData();
    } catch (e) {
      console.error("Activate profile failed", e);
      toast.error(t('failedToActivateProfile'));
    }
  };

  const handleDeleteProfile = async (provider: string, name: string) => {
    setDeleteProfileTarget({ provider, name });
    setDeleteProfileDialogOpen(true);
  };

  const confirmDeleteProfile = async () => {
    if (!deleteProfileTarget) return;
    try {
      await deleteAuthProfile(deleteProfileTarget.provider, deleteProfileTarget.name);
      toast.success(t('deletedProfile', { name: deleteProfileTarget.name }));
      await loadAuthData();
    } catch (e) {
      console.error("Delete profile failed", e);
      toast.error(t('failedToDeleteProfile'));
    }
    setDeleteProfileDialogOpen(false);
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

  if (authInfo?.readOnly) return (
    <div className="max-w-4xl mx-auto space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{t('pageTitle')}</h1>
      <p role="status">{authInfo.message}</p>
      <ul className="space-y-2">
        {authInfo.nativeCredentials?.map(credential => <li key={credential.id} className="rounded border p-3">
          {credential.label} · {credential.integrationID || 'Unassigned'}{credential.active ? ' · Active' : ''}
        </li>)}
      </ul>
      <Button variant="outline" onClick={loadAuthData}>{t('refresh')}</Button>
      <a className="block underline" href="https://opencode.ai/v2/docs/providers/" target="_blank" rel="noopener noreferrer">OpenCode v2 authentication documentation</a>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <header className="flex justify-between items-start border-b pb-4">
        <div>
          <PageHelp
            title={t('pageTitle')}
            docUrl="https://opencode.ai/docs/auth"
            docTitle={t('pageDocTitle')}
          />
          <p className="text-muted-foreground mt-1">
            {t('pageDescription')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAuthData}>
          <Reload className="h-4 w-4 mr-2" />
          {t('refresh')}
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
                    <CardDescription>{provider.type === 'oauth' ? t('oauthLogin') : t('apiKey')}</CardDescription>
                  </div>
                  <Badge variant={isLoggedIn ? "default" : "secondary"}>
                    {isLoggedIn ? t('loggedIn') : t('notLoggedIn')}
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
                        {t('saveProfile')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleLogout(provider.id)}
                      >
                        <Logout className="h-4 w-4 mr-2" />
                        {t('logout')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleLogin(provider.id)}
                      disabled={loginLoading[provider.id]}
                    >
                      {loginLoading[provider.id] ? (
                        <>{t('loading')}</>
                      ) : (
                        <>
                          <Login className="h-4 w-4 mr-2" />
                          {t('login')}
                        </>
                      )}
                    </Button>
                  )}
                </div>

                  {providerProfiles && providerProfiles.profiles && providerProfiles.profiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">
                        {t('savedProfiles', { count: providerProfiles.profiles.length })}
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
                                <Badge variant="default" className="text-[10px]">{t('active')}</Badge>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {providerProfiles.active !== profile && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleActivateProfile(provider.id, profile)}
                                  title={t('switchToProfile')}
                                >
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteProfile(provider.id, profile)}
                                title={t('deleteProfileTitle')}
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
                        {t('noSavedProfiles')}
                      </AlertDescription>
                    </Alert>
                  )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('logoutTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('logoutConfirm', { provider: logoutProvider })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('logout')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLogout}>{t('logout')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteProfileDialogOpen} onOpenChange={setDeleteProfileDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteProfileTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteProfileConfirm', { name: deleteProfileTarget?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('logout')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProfile}>{t('deleteProfileTitle')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
