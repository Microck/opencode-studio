"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2, Pause, Play, Download, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { getManagementLogs, clearManagementLogs, getFileLogging, setFileLogging } from "@/lib/api";
import { cn } from "@/lib/utils";

export function LogsTab() {
  const [logs, setLogs] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [loggingEnabled, setLoggingEnabled] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    if (paused) return;
    try {
      const res = await getManagementLogs(lastTimestamp);
      if (res.lines.length > 0) {
        setLogs(prev => [...prev, ...res.lines].slice(-1000)); // Keep last 1000 lines
        setLastTimestamp(res["latest-timestamp"]);
        // Auto-scroll if near bottom
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }
    } catch (e) {
      // Silent fail for logs
    }
  };

  const checkLoggingStatus = async () => {
    try {
      const res = await getFileLogging();
      setLoggingEnabled(res["logging-to-file"]);
    } catch (e) {}
  };

  useEffect(() => {
    checkLoggingStatus();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [paused, lastTimestamp]);

  const handleClear = async () => {
    try {
      await clearManagementLogs();
      setLogs([]);
      setLastTimestamp(0);
      toast.success("Logs cleared");
    } catch (e) {
      toast.error("Failed to clear logs");
    }
  };

  const toggleLogging = async (enabled: boolean) => {
    try {
      await setFileLogging(enabled);
      setLoggingEnabled(enabled);
      toast.success(`File logging ${enabled ? "enabled" : "disabled"}`);
    } catch (e) {
      toast.error("Failed to toggle logging");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proxy-logs-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="h-[700px] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle>Live Logs</CardTitle>
            <CardDescription>Real-time stream from the proxy server.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-4 bg-muted/50 p-1.5 rounded-lg border">
                <Settings2 className="h-4 w-4 text-muted-foreground ml-1" />
                <span className="text-xs font-medium mr-2">File Logging</span>
                <Switch checked={loggingEnabled} onCheckedChange={toggleLogging} className="h-4 w-8" />
            </div>

            <Button variant="outline" size="icon" onClick={() => setPaused(!paused)} title={paused ? "Resume" : "Pause"}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={handleDownload} title="Download">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleClear} title="Clear">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-0">
          <div className="bg-black text-green-400 font-mono text-xs h-full overflow-auto p-4 rounded-b-lg">
            {logs.length === 0 ? (
              <div className="text-gray-500 italic text-center mt-20">Waiting for logs...</div>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all border-b border-white/5 py-0.5 hover:bg-white/5">
                  {line}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
