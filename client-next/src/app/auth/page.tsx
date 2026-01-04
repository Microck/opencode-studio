"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Key, LogOut, Plus, RefreshCw, ExternalLink, Sparkles, Check } from "lucide-react";
import { getAuthInfo, getAuthProviders, authLogin, authLogout, addPluginsToConfig } from "@/lib/api";
import type { AuthCredential, AuthProvider } from "@/types";

const GEMINI_AUTH_PLUGIN = "opencode-gemini-auth@latest";

export default function AuthPage() {
  const [credentials, setCredentials] = useState<AuthCredential[]>([]);
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [authFile, setAuthFile] = useState<string | null>(null);
  const [hasGeminiAuthPlugin, setHasGeminiAuthPlugin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoutTarget, setLogoutTarget] = useState<AuthCredential | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [addingGeminiPlugin, setAddingGeminiPlugin] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [authInfo, providerList] = await Promise.all([
        getAuthInfo(),
        getAuthProviders(),
      ]);
      setCredentials(authInfo.credentials);
      setAuthFile(authInfo.authFile);
      setHasGeminiAuthPlugin(authInfo.hasGeminiAuthPlugin ?? false);
      setProviders(providerList);
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
    if (!selectedProvider) {
      toast.error("Please select a provider");
      return;
    }

    try {
      setLoginLoading(true);
      const result = await authLogin(selectedProvider);
      toast.success(result.message);
      toast.info(result.note, { duration: 10000 });
    } catch {
      toast.error("Failed to start login");
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

  const formatExpiry = (timestamp: number | null) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return "Expired";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}d`;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `${hours}h`;
    
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Authentication</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const availableProviders = providers.filter(
    (p) => !credentials.some((c) => c.id === p.id || c.id === `github-${p.id}`)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Authentication</h1>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Provider
          </CardTitle>
          <CardDescription>
            Login to a new AI provider to use their models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select provider..." />
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    <div className="flex items-center gap-2">
                      <span>{provider.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {provider.type}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleLogin} disabled={loginLoading || !selectedProvider}>
              {loginLoading ? "Opening..." : "Login"}
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            This will open your browser to complete authentication
          </p>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gemini OAuth Plugin
          </CardTitle>
          <CardDescription>
            Use your Google account to access Gemini models (free tier included)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {hasGeminiAuthPlugin ? (
                <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  Plugin installed
                </span>
              ) : (
                <span>Add the plugin, then run <code className="bg-muted px-1 rounded">opencode auth login</code> and select Google OAuth</span>
              )}
            </div>
            {!hasGeminiAuthPlugin && (
              <Button onClick={handleAddGeminiPlugin} disabled={addingGeminiPlugin} variant="outline">
                {addingGeminiPlugin ? "Adding..." : "Add Plugin"}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            <a 
              href="https://github.com/jenslys/opencode-gemini-auth" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Learn more about opencode-gemini-auth
            </a>
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Connected Providers</h2>
        
        {credentials.length === 0 ? (
          <p className="text-muted-foreground italic">No providers configured.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {credentials.map((cred) => (
              <Card key={cred.id} className={cred.isExpired ? "border-destructive/50" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      {cred.name}
                    </CardTitle>
                    <Badge variant={cred.type === "oauth" ? "default" : "secondary"}>
                      {cred.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      {cred.isExpired ? (
                        <span className="text-destructive">Expired</span>
                      ) : cred.expiresAt ? (
                        <span>Expires in {formatExpiry(cred.expiresAt)}</span>
                      ) : (
                        <span>API Key</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogoutTarget(cred)}
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
    </div>
  );
}
