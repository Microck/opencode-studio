"use client";

import { WarningBox, Server, Copy, Check, Reload, Power } from "@nsmr/pixelart-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { shutdownBackend } from "@/lib/api";
import { useTranslations } from "next-intl";

interface UpdateRequiredModalProps {
  currentVersion: string | null;
  minVersion: string;
}

export function UpdateRequiredModal({ currentVersion, minVersion }: UpdateRequiredModalProps) {
  const t = useTranslations('dialogs');
  const [copied, setCopied] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const [serverStopped, setServerStopped] = useState(false);
  const updateCommand = "npm install -g opencode-studio-server@2.4.2";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(updateCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShutdown = async () => {
    setShuttingDown(true);
    await shutdownBackend();
    setServerStopped(true);
    setShuttingDown(false);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 p-8 rounded-xl border bg-card shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="p-4 rounded-full bg-destructive/10 mb-6">
            <WarningBox className="h-12 w-12 text-destructive" />
          </div>
          
          <h1 className="text-2xl font-bold mb-2">{t('updateRequired.title')}</h1>
          
          <p className="text-muted-foreground mb-6">
            {t('updateRequired.description')}
          </p>

          <div className="w-full p-4 rounded-lg bg-muted/50 mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('updateRequired.currentVersionLabel')}</span>
              <span className="font-mono text-destructive">{currentVersion || t('updateRequired.unknown')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('updateRequired.requiredVersionLabel')}</span>
              <span className="font-mono text-primary">{minVersion}+</span>
            </div>
          </div>

          <div className="w-full space-y-3">
            <p className="text-sm text-muted-foreground">{t('updateRequired.updateCommandLabel')}</p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-background border font-mono text-sm">
              <Server className="h-4 w-4 text-muted-foreground shrink-0" />
              <code className="flex-1 text-left truncate">{updateCommand}</code>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="w-full flex gap-3 mt-6">
            {!serverStopped ? (
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={handleShutdown}
                disabled={shuttingDown}
              >
                <Power className="h-4 w-4 mr-2" />
                {shuttingDown ? t('updateRequired.stopping') : t('updateRequired.stopServer')}
              </Button>
            ) : (
              <div className="flex-1 text-sm text-muted-foreground flex items-center justify-center">
                {t('updateRequired.serverStopped')}
              </div>
            )}
            <Button className="flex-1" onClick={handleRefresh}>
              <Reload className="h-4 w-4 mr-2" />
              {t('updateRequired.checkAgain')}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            {t('updateRequired.stepsHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
