"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Power, 
  PowerOff, 
  Terminal, 
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Copy
} from "lucide-react";
import { 
  getProxyStatus, 
  startProxy, 
  stopProxy, 
  runProxyLogin, 
  type ProxyStatus 
} from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function Metric({ label, value, sub }: { label: string, value: string, sub?: string }) {
  return (
    <div className="bg-muted/30 p-3 rounded-lg border">
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div className="text-lg font-bold font-mono mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1 truncate" title={sub}>{sub}</div>}
    </div>
  );
}

export default function AuthPage() {
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const s = await getProxyStatus();
      setStatus(s);
    } catch (e) {
      toast.error("Failed to load proxy status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    try {
      setActionLoading(true);
      const res = await startProxy();
      if (res.success) {
        toast.success("Proxy started");
        loadStatus();
      } else {
        toast.error(`Failed to start: ${res.error}`);
      }
    } catch (e) {
      toast.error("Error starting proxy");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setActionLoading(true);
      const res = await stopProxy();
      if (res.success) {
        toast.success("Proxy stopped");
        loadStatus();
      } else {
        toast.error(`Failed to stop: ${res.error}`);
      }
    } catch (e) {
      toast.error("Error stopping proxy");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogin = async (provider: string) => {
    try {
      const res = await runProxyLogin(provider);
      if (res.success) {
        toast.success("Login terminal launched!");
        toast.info(res.message);
      } else {
        toast.error(`Login failed: ${res.error || 'Unknown error'}`);
      }
    } catch (e) {
      toast.error("Error launching login");
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      <header className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            Authentication Proxy
            {status?.running ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-600 text-sm font-medium border border-green-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Active
              </div>
            ) : (
              <Badge variant="secondary">Stopped</Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your CLIProxyAPI instance for automatic account rotation and rate-limit handling.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadStatus()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </header>

      {!status?.installed && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <h3 className="font-semibold text-lg text-amber-700 dark:text-amber-400">Setup Required</h3>
                <p className="text-muted-foreground text-sm">
                  CLIProxyAPI is required for this feature. Please install it using one of the commands below.
                </p>
              </div>
              
              <Tabs defaultValue="windows" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                  <TabsTrigger value="windows">Windows</TabsTrigger>
                  <TabsTrigger value="unix">Mac / Linux</TabsTrigger>
                </TabsList>
                <TabsContent value="windows" className="mt-3 space-y-3">
                   <div className="bg-background border rounded-md p-3 font-mono text-xs flex items-center justify-between gap-2">
                     <code className="truncate">winget install -e --id LuisPater.CLIProxyAPI</code>
                     <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => {
                       navigator.clipboard.writeText("winget install -e --id LuisPater.CLIProxyAPI");
                       toast.success("Command copied");
                     }}>
                       <Copy className="h-3 w-3" />
                     </Button>
                   </div>
                   
                   <div className="flex items-center gap-2 text-xs text-muted-foreground">
                     <span className="h-px bg-border flex-1" />
                     <span>OR</span>
                     <span className="h-px bg-border flex-1" />
                   </div>

                   <Button variant="secondary" className="w-full justify-between" onClick={() => window.open('https://github.com/router-for-me/CLIProxyAPI/releases/latest', '_blank')}>
                     <span>Download from Releases</span>
                     <ExternalLink className="h-4 w-4" />
                   </Button>
                   <p className="text-[10px] text-muted-foreground text-center">
                     After downloading, ensure the binary is in your PATH.
                   </p>
                </TabsContent>
                <TabsContent value="unix" className="mt-3">
                   <div className="bg-background border rounded-md p-3 font-mono text-xs flex items-center justify-between gap-2">
                     <code className="truncate" title="curl -fsSL https://raw.githubusercontent.com/brokechubb/cliproxyapi-installer/refs/heads/master/cliproxyapi-installer | bash">
                       curl -fsSL .../cliproxyapi-installer | bash
                     </code>
                     <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => {
                       navigator.clipboard.writeText("curl -fsSL https://raw.githubusercontent.com/brokechubb/cliproxyapi-installer/refs/heads/master/cliproxyapi-installer | bash");
                       toast.success("Command copied");
                     }}>
                       <Copy className="h-3 w-3" />
                     </Button>
                   </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Proxy Status
            </CardTitle>
            <CardDescription>Control the local proxy server process.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <Metric label="Port" value={String(status?.port || 8317)} />
              <Metric label="PID" value={String(status?.pid || '-')} />
              <Metric label="Config File" value={status?.configFile ? "Loaded" : "Missing"} sub={status?.configFile} />
              <Metric label="Status" value={status?.running ? "Online" : "Offline"} />
            </div>

            <div className="flex gap-3 pt-2">
              {!status?.running ? (
                <Button onClick={handleStart} disabled={!status?.installed || actionLoading} className="flex-1">
                  <Power className="h-4 w-4 mr-2" />
                  Start Proxy
                </Button>
              ) : (
                <Button onClick={handleStop} disabled={actionLoading} variant="destructive" className="flex-1">
                  <PowerOff className="h-4 w-4 mr-2" />
                  Stop Proxy
                </Button>
              )}
              {status?.running && (
                 <Button variant="secondary" className="flex-1" onClick={() => window.open(`http://localhost:${status.port}/management.html`, '_blank')}>
                   <ExternalLink className="h-4 w-4 mr-2" />
                   Dashboard
                 </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Add Accounts
            </CardTitle>
            <CardDescription>Login to providers to add them to the proxy pool.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 flex-1">
            <Button variant="outline" className="w-full justify-start h-12" onClick={() => handleLogin('antigravity')}>
              <div className="bg-background border p-2 rounded mr-3 flex items-center justify-center w-9 h-9">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div className="text-left">
                <div className="font-medium">Antigravity (Google)</div>
                <div className="text-[10px] text-muted-foreground">Login via Gemini OAuth</div>
              </div>
            </Button>
            
            <Button variant="outline" className="w-full justify-start h-12" onClick={() => handleLogin('codex')}>
              <div className="bg-background border p-2 rounded mr-3 flex items-center justify-center w-9 h-9">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-foreground">
                  <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0843 7.6148-4.4156a.0315.0315 0 0 0 .0178-.0424L15.986 12.875l-3.0824 1.7771-5.7216 3.2985a.0245.0245 0 0 0-.0093.0309 4.4803 4.4803 0 0 1 1.8322 3.5573 4.4851 4.4851 0 0 1-1.3205 3.2186zm6.3912-2.3879a.024.024 0 0 0-.0228.0068 4.456 4.456 0 0 1-3.4726 1.0964l.1144-.165 3.0829-4.4446a.0356.0356 0 0 0-.0058-.0434l-2.1487-2.1487-2.1487 3.7317-3.989 6.9234a.0245.0245 0 0 0 .0127.0329 4.496 4.496 0 0 1 3.5606 1.8396 4.4851 4.4851 0 0 1 1.9482 2.9232zm-2.2023-11.2356a4.4755 4.4755 0 0 1 1.7717 2.684l-.165-.0273-8.7909-1.4651a.0356.0356 0 0 0-.0379.0182l-1.0833 3.0829 3.0829 1.0833 7.8227 1.3038a.0245.0245 0 0 0 .0343-.0127 4.4803 4.4803 0 0 1 2.9232-1.9482 4.4851 4.4851 0 0 1 3.2186 1.3205zm-11.8596 1.3205a4.4755 4.4755 0 0 1 .5366-3.1816l.0505.157 3.0829 9.6069a.0356.0356 0 0 0 .0434.0228l2.1487-.6909-2.1487-.6909-7.8227-2.5132a.0245.0245 0 0 0-.0329.0127 4.496 4.496 0 0 1-1.8396 3.5606 4.4851 4.4851 0 0 1-2.9232 1.9482zM6.9242 7.0242a.0356.0356 0 0 0-.0434-.0058l-2.1487 1.2405 2.1487 1.2405 6.9234 3.9977a.0245.0245 0 0 0 .0329-.0127 4.4803 4.4803 0 0 1 3.5606-1.8396 4.4851 4.4851 0 0 1 1.9482-2.9232z" fill="currentColor"/></svg>
              </div>
              <div className="text-left">
                <div className="font-medium">OpenAI Codex</div>
                <div className="text-[10px] text-muted-foreground">Login via OpenAI</div>
              </div>
            </Button>

            <Button variant="outline" className="w-full justify-start h-12" onClick={() => handleLogin('anthropic')}>
              <div className="bg-background border p-2 rounded mr-3 flex items-center justify-center w-9 h-9">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-foreground">
                  <path d="M17.43 19.37H19L12 4.5 5 19.37h1.57l1.7-4h7.46l1.7 4zm-7-5.55L12 10.5l1.57 3.32h-3.14z" fill="currentColor"/>
                </svg>
              </div>
              <div className="text-left">
                <div className="font-medium">Anthropic</div>
                <div className="text-[10px] text-muted-foreground">Login via Anthropic</div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}