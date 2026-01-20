"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Plus, Trash2, Zap, RotateCcw, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getAccountPool,
  rotateAccount,
  activateAuthProfile,
  deleteAuthProfile,
  clearAllAuthProfiles,
  markAccountCooldown,
  clearAccountCooldown,
  runProxyLogin,
  type AccountPool,
  type QuotaInfo
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface PoolState {
  pool: AccountPool | null;
  quota: QuotaInfo | null;
  loading: boolean;
}

function AccountList({ 
  provider, 
  pool, 
  onRefresh 
}: { 
  provider: string, 
  pool: AccountPool | null, 
  onRefresh: () => void 
}) {
  const [rotating, setRotating] = useState(false);

  const handleRotate = async () => {
    try {
      setRotating(true);
      await rotateAccount(provider);
      toast.success("Rotated successfully");
      onRefresh();
    } catch (e) {
      toast.error("Rotation failed");
    } finally {
      setRotating(false);
    }
  };

  const handleActivate = async (name: string) => {
    try {
      await activateAuthProfile(provider, name);
      toast.success(`Activated ${name}`);
      onRefresh();
    } catch (e) {
      toast.error("Activation failed");
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await deleteAuthProfile(provider, name);
      toast.success("Removed account");
      onRefresh();
    } catch (e) {
      toast.error("Removal failed");
    }
  };

  const handleCooldown = async (name: string) => {
    try {
      await markAccountCooldown(name, provider, 3600000); // 1 hour default
      toast.success("Set 1h cooldown");
      onRefresh();
    } catch (e) {
      toast.error("Cooldown failed");
    }
  };

  const handleClearCooldown = async (name: string) => {
    try {
      await clearAccountCooldown(name, provider);
      toast.success("Cooldown cleared");
      onRefresh();
    } catch (e) {
      toast.error("Clear failed");
    }
  };

  if (!pool || !pool.accounts || pool.accounts.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg border-dashed text-muted-foreground">
        No accounts found in this pool.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-muted-foreground">Active Pool ({pool.totalAccounts})</h3>
        <Button variant="outline" size="sm" onClick={handleRotate} disabled={rotating}>
          <RotateCcw className={cn("h-3 w-3 mr-2", rotating && "animate-spin")} />
          Rotate Active
        </Button>
      </div>

      <div className="grid gap-3">
        {pool.accounts.map((account) => {
          const isActive = account.status === 'active';
          const isCooldown = account.status === 'cooldown';
          return (
          <div 
            key={account.name} 
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border",
              isActive ? "bg-primary/5 border-primary/20" : "bg-card",
              isCooldown ? "opacity-70" : ""
            )}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={cn(
                "w-2 h-2 rounded-full shrink-0",
                isActive ? "bg-green-500" : 
                isCooldown ? "bg-amber-500" : "bg-muted-foreground/30"
              )} />
              
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{account.name}</span>
                  {isActive && <Badge variant="outline" className="text-[10px] h-5 border-green-500/30 text-green-600 bg-green-500/5">Active</Badge>}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                  <span>Usage: {account.usageCount || 0}</span>
                  {account.lastUsed > 0 && (
                    <span>Last used: {new Date(account.lastUsed).toLocaleTimeString()}</span>
                  )}
                  {isCooldown && account.cooldownUntil && (
                    <span className="text-amber-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Cooling down ({Math.ceil((account.cooldownUntil - Date.now()) / 60000)}m)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!isActive && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleActivate(account.name)} title="Activate">
                  <Zap className="h-4 w-4" />
                </Button>
              )}
              
              {isCooldown ? (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => handleClearCooldown(account.name)} title="Clear Cooldown">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleCooldown(account.name)} title="Set Cooldown">
                  <Clock className="h-4 w-4" />
                </Button>
              )}

              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => handleDelete(account.name)} title="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

export function PoolsTab() {
  const [provider, setProvider] = useState("google");
  const [data, setData] = useState<PoolState>({ pool: null, quota: null, loading: true });

  const loadData = async () => {
    try {
      setData(prev => ({ ...prev, loading: true }));
      const res = await getAccountPool(provider);
      setData({ pool: res.pool, quota: res.quota, loading: false });
    } catch (e) {
      toast.error("Failed to load pool data");
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Auto-refresh every 5s
    return () => clearInterval(interval);
  }, [provider]);

  const handleAddAccount = async () => {
    const loginProvider = provider === 'google' ? 'antigravity' : 
                         provider === 'openai' ? 'codex' : 
                         provider; // anthropic maps directly
    
    try {
      const res = await runProxyLogin(loginProvider);
      if (res.success) {
        toast.success("Login terminal launched");
      } else {
        toast.error(`Failed: ${res.error}`);
      }
    } catch (e) {
      toast.error("Error launching login");
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure? This will remove ALL accounts in this pool.")) return;
    try {
      await clearAllAuthProfiles(provider);
      toast.success("Pool cleared");
      loadData();
    } catch (e) {
      toast.error("Clear failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Tabs value={provider} onValueChange={setProvider} className="w-[400px]">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="google">Google</TabsTrigger>
            <TabsTrigger value="openai">OpenAI</TabsTrigger>
            <TabsTrigger value="anthropic">Anthropic</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleClearAll} disabled={!data.pool || Object.keys(data.pool).length === 0}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Pool
          </Button>
          <Button onClick={handleAddAccount}>
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account Pool</CardTitle>
            <CardDescription>Manage active sessions and rotation for {provider}.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.loading && !data.pool ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <AccountList provider={provider} pool={data.pool} onRefresh={loadData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quota Status</CardTitle>
            <CardDescription>Usage limits for this provider.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!data.quota ? (
              <div className="text-sm text-muted-foreground">No quota data available.</div>
            ) : (
              <>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Daily Requests</div>
                  <div className="text-2xl font-bold font-mono">
                    {data.quota.used}/{data.quota.dailyLimit}
                  </div>
                  <div className="h-2 bg-secondary mt-2 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full", 
                        data.quota.remaining <= 0 ? "bg-destructive" : 
                        (data.quota.used / data.quota.dailyLimit > 0.8) ? "bg-amber-500" : "bg-primary"
                      )} 
                      style={{ width: `${Math.min(100, (data.quota.used / data.quota.dailyLimit) * 100)}%` }} 
                    />
                  </div>
                </div>

                {data.quota.remaining <= 0 && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Quota Exhausted</span>
                      <p className="text-xs opacity-90 mt-1">
                        Daily limit reached. Pool is currently locked until reset or manual override.
                      </p>
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  <p>Resets daily at 00:00 UTC.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
