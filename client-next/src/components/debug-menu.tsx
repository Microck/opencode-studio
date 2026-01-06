"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, RefreshCcw } from "lucide-react";
import { getDebugPaths } from "@/lib/api";
import { cn } from "@/lib/utils";

export function DebugMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDebugInfo();
    }
  }, [isOpen]);

  const fetchDebugInfo = async () => {
    setLoading(true);
    try {
      const info = await getDebugPaths();
      setDebugInfo({
        ...info,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to fetch debug info", err);
      setDebugInfo({ error: "Failed to fetch debug info from backend" });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4 bg-muted/50">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            Debug Menu
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">System Information</h3>
              <div className="text-[10px] font-mono opacity-50">{new Date().toLocaleTimeString()}</div>
            </div>
            
            <div className="bg-black/90 p-4 rounded-lg border border-border/50 shadow-inner">
              <pre className="text-green-400 text-xs font-mono overflow-auto leading-relaxed">
                {loading ? "Fetching latest data..." : JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={fetchDebugInfo} 
                variant="outline" 
                size="sm" 
                className="gap-2"
                disabled={loading}
              >
                <RefreshCcw className={cn("h-3 w-3", loading && "animate-spin")} />
                Refresh Data
              </Button>
              <Button onClick={() => window.location.reload()} variant="secondary" size="sm">
                Hard Reload Page
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-border/50">
            <p className="text-[10px] text-center text-muted-foreground italic">
              Press F2 again to close this menu.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
