"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Power, PowerOff, ExternalLink, RefreshCw, Terminal } from "lucide-react";
import { toast } from "sonner";
import { startProxy, stopProxy, runProxyLogin, type ProxyStatus } from "@/lib/api";

function Metric({ label, value, sub }: { label: string, value: string, sub?: string }) {
  return (
    <div className="bg-muted/30 p-3 rounded-lg border">
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div className="text-lg font-bold font-mono mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1 truncate" title={sub}>{sub}</div>}
    </div>
  );
}

export function OverviewTab({ status, onRefresh }: { status: ProxyStatus | null, onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    try {
      setLoading(true);
      const res = await startProxy();
      if (res.success) {
        toast.success("Proxy started");
        onRefresh();
      } else {
        toast.error(`Failed to start: ${res.error}`);
      }
    } catch (e) {
      toast.error("Error starting proxy");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setLoading(true);
      const res = await stopProxy();
      if (res.success) {
        toast.success("Proxy stopped");
        onRefresh();
      } else {
        toast.error(`Failed to stop: ${res.error}`);
      }
    } catch (e) {
      toast.error("Error stopping proxy");
    } finally {
      setLoading(false);
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5 text-primary" />
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
              <Button onClick={handleStart} disabled={!status?.installed || loading} className="flex-1">
                <Power className="h-4 w-4 mr-2" />
                Start Proxy
              </Button>
            ) : (
              <Button onClick={handleStop} disabled={loading} variant="destructive" className="flex-1">
                <PowerOff className="h-4 w-4 mr-2" />
                Stop Proxy
              </Button>
            )}
            {status?.running && (
               <Button variant="secondary" className="flex-1" onClick={() => window.open(`http://localhost:${status.port}/management.html`, '_blank')}>
                 <ExternalLink className="h-4 w-4 mr-2" />
                 Legacy Dashboard
               </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Quick Add Accounts
          </CardTitle>
          <CardDescription>Launch login terminals to add accounts to your pool.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 flex-1">
          <Button variant="outline" className="w-full justify-start h-12" onClick={() => handleLogin('antigravity')}>
            <div className="bg-background border p-2 rounded mr-3 flex items-center justify-center w-9 h-9">
              <span className="font-bold text-blue-500">G</span>
            </div>
            <div className="text-left">
              <div className="font-medium">Antigravity (Google)</div>
              <div className="text-[10px] text-muted-foreground">Login via Gemini OAuth</div>
            </div>
          </Button>
          
          <Button variant="outline" className="w-full justify-start h-12" onClick={() => handleLogin('codex')}>
            <div className="bg-background border p-2 rounded mr-3 flex items-center justify-center w-9 h-9">
              <span className="font-bold text-foreground">O</span>
            </div>
            <div className="text-left">
              <div className="font-medium">OpenAI Codex</div>
              <div className="text-[10px] text-muted-foreground">Login via OpenAI</div>
            </div>
          </Button>

          <Button variant="outline" className="w-full justify-start h-12" onClick={() => handleLogin('anthropic')}>
            <div className="bg-background border p-2 rounded mr-3 flex items-center justify-center w-9 h-9">
              <span className="font-bold text-amber-600">A</span>
            </div>
            <div className="text-left">
              <div className="font-medium">Anthropic</div>
              <div className="text-[10px] text-muted-foreground">Login via Anthropic</div>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
