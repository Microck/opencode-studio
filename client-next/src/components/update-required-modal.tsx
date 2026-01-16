"use client";

import { AlertTriangle, Terminal, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface UpdateRequiredModalProps {
  currentVersion: string | null;
  minVersion: string;
}

export function UpdateRequiredModal({ currentVersion, minVersion }: UpdateRequiredModalProps) {
  const [copied, setCopied] = useState(false);
  const updateCommand = "npm update -g opencode-studio-server";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(updateCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 p-8 rounded-xl border bg-card shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="p-4 rounded-full bg-destructive/10 mb-6">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          
          <h1 className="text-2xl font-bold mb-2">Update Required</h1>
          
          <p className="text-muted-foreground mb-6">
            Your backend server is outdated and incompatible with this version of OpenCode Studio.
          </p>

          <div className="w-full p-4 rounded-lg bg-muted/50 mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current version:</span>
              <span className="font-mono text-destructive">{currentVersion || "unknown"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Required version:</span>
              <span className="font-mono text-primary">{minVersion}+</span>
            </div>
          </div>

          <div className="w-full space-y-3">
            <p className="text-sm text-muted-foreground">Run this command to update:</p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-background border font-mono text-sm">
              <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
              <code className="flex-1 text-left truncate">{updateCommand}</code>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            After updating, restart the server and refresh this page.
          </p>
        </div>
      </div>
    </div>
  );
}
