"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  ShieldCheck, 
  Server, 
  Key, 
  Settings, 
  FileText, 
  Activity,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { getProxyStatus, type ProxyStatus } from "@/lib/api";

import { OverviewTab } from "./tabs/overview";
import { PoolsTab } from "./tabs/pools";
import { ProxyAuthTab } from "./tabs/proxy-auth";
import { ConfigTab } from "./tabs/config";
import { LogsTab } from "./tabs/logs";
import { UsageTab } from "./tabs/usage";

 export default function AuthPage() {
   const [status, setStatus] = useState<ProxyStatus | null>(null);
   const [loading, setLoading] = useState(true);
   const [activeTab, setActiveTab] = useState("overview");

  const loadStatus = async () => {
    try {
      const s = await getProxyStatus();
      setStatus(s);
    } catch (e) {
      console.error("Failed to load status", e);
      toast.error("Failed to connect to proxy service");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (status && !status.installed) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <h3 className="font-semibold text-lg text-amber-700 dark:text-amber-400">Setup Required</h3>
                <p className="text-muted-foreground text-sm">
                  CLIProxyAPI is required. Please install it to continue.
                </p>
              </div>
              <Button onClick={() => window.open('https://github.com/router-for-me/CLIProxyAPI', '_blank')}>
                View Installation Guide
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6 animate-fade-in pb-20">
      <header className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            Authentication Proxy
            {status?.running ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-600 text-sm font-medium border border-green-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Online
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-sm font-medium border">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                Offline
              </div>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your local proxy, account pools, and access keys.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStatus}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </header>

       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto">
          <TabsTrigger value="overview" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="pools" className="gap-2">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">Pools</span>
          </TabsTrigger>
          <TabsTrigger value="auth" className="gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Access Keys</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
          <TabsTrigger value="usage" className="gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Usage</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview">
            <OverviewTab status={status} onRefresh={loadStatus} />
          </TabsContent>
          
          <TabsContent value="pools">
            <PoolsTab />
          </TabsContent>
          
          <TabsContent value="auth">
            <ProxyAuthTab />
          </TabsContent>
          
          <TabsContent value="config">
            <ConfigTab />
          </TabsContent>
          
          <TabsContent value="logs">
            <LogsTab />
          </TabsContent>
          
          <TabsContent value="usage">
            <UsageTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
