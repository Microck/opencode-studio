"use client";

import { useApp } from "@/lib/context";
import { Sidebar } from "@/components/sidebar";
import { DebugMenu } from "@/components/debug-menu";
import { PROTOCOL_URL } from "@/lib/api";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Play, ExternalLink, Loader, Alert } from "@nsmr/pixelart-react";
import { useEffect, useState } from "react";

const FIRST_LOAD_KEY = "opencode-studio-loaded";
const LAUNCH_ATTEMPT_KEY = "opencode-studio-launch-attempt";

function CrimeSceneTape() {
  const tapeContent = "WORK IN PROGRESS • REPORT ISSUES ON GITHUB • WORK IN PROGRESS • REPORT ISSUES ON GITHUB • ";
  const repeatedContent = tapeContent.repeat(8);
  
  return (
    <a
      href="https://github.com/Microck/opencode-studio/issues"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-6 -left-20 z-50 rotate-[-35deg] origin-center cursor-pointer hover:opacity-90 transition-opacity"
      style={{ width: '400px' }}
    >
      <div className="bg-yellow-400 dark:bg-yellow-500 border-y-2 border-black py-2 overflow-hidden shadow-lg">
        <div 
          className="whitespace-nowrap font-extrabold text-xs uppercase tracking-widest text-black"
          style={{
            animation: 'crime-tape-scroll 8s linear infinite',
          }}
        >
          {repeatedContent}
        </div>
      </div>
    </a>
  );
}

function useIsFirstLoad() {
  const [isFirst, setIsFirst] = useState(true);

  useEffect(() => {
    const hasLoaded = sessionStorage.getItem(FIRST_LOAD_KEY);
    if (hasLoaded) {
      setIsFirst(false);
    } else {
      sessionStorage.setItem(FIRST_LOAD_KEY, "1");
    }
  }, []);

  return isFirst;
}

function useLaunchAttempt() {
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    const attempted = localStorage.getItem(LAUNCH_ATTEMPT_KEY) === "1";
    setHasAttempted(attempted);
  }, []);

  return {
    hasAttempted,
    markAttempt: () => localStorage.setItem(LAUNCH_ATTEMPT_KEY, "1"),
    clearAttempt: () => localStorage.removeItem(LAUNCH_ATTEMPT_KEY),
  };
}

function DisconnectedLanding({ isFirstLoad }: { isFirstLoad: boolean }) {
  const [showUpdateHint, setShowUpdateHint] = useState(false);
  const { hasAttempted, markAttempt } = useLaunchAttempt();

  useEffect(() => {
    const timer = setTimeout(() => setShowUpdateHint(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  const handleLaunch = () => {
    markAttempt();
    window.location.href = PROTOCOL_URL;
  };

  const animClass = isFirstLoad ? "animate-logo-entrance" : "animate-logo-entrance-fast";
  const contentClass = isFirstLoad ? "animate-content-appear" : "animate-content-appear-fast";

return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background overflow-hidden">
      <CrimeSceneTape />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`${animClass} mt-[-20px]`}>
          <Logo className="w-24 h-24" />
        </div>
      </div>
      
      <div className={`flex flex-col items-center gap-8 max-w-md text-center px-4 mt-48 ${contentClass}`}>
        <div className="space-y-2">
          <img src="/OpencodeStudioText1line.png" alt="" className={`h-auto w-64 ${isFirstLoad ? "landing-delay-1" : "landing-delay-fast-1"}`} />
          <p className={`text-muted-foreground text-lg ${isFirstLoad ? "landing-delay-2" : "landing-delay-fast-2"}`}>
            Manage your OpenCode configuration with a visual interface
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-md">
          <div className={isFirstLoad ? "landing-delay-3" : "landing-delay-fast-3"}>
            <Button size="lg" className="w-full gap-2" onClick={handleLaunch}>
              <Play className="h-5 w-5" />
              Launch Backend
            </Button>
          </div>
          
          <div className={`space-y-4 mt-2 ${isFirstLoad ? "landing-delay-4" : "landing-delay-fast-4"}`}>
            <div className="space-y-2 text-left bg-muted/30 p-4 rounded-xl border border-border/50 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Setup Required</p>
              
              <div className="space-y-1">
                <p className="text-xs font-medium">1. Install OpenCode AI</p>
                <code className="text-[11px] block bg-background border border-border p-2 rounded font-mono break-all">
                  npm install -g opencode-ai
                </code>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium">2. Install Studio Server</p>
                <code className="text-[11px] block bg-background border border-border p-2 rounded font-mono break-all">
                  npm install -g opencode-studio-server
                </code>
              </div>

            <div className="pt-2 border-t border-border/30">
                <p className="text-[10px] text-primary/70 font-semibold italic">
                  Important: Run <code className="bg-background px-1 rounded not-italic">opencode --version</code> once after install to initialize your configuration.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={`flex items-center gap-4 text-sm text-muted-foreground ${isFirstLoad ? "landing-delay-5" : "landing-delay-fast-5"}`}>
          <a 
            href="https://github.com/Microck/opencode-studio" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
          <span>•</span>
          <a 
            href="https://www.npmjs.com/package/opencode-studio-server" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            npm
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className={`absolute bottom-4 text-xs text-muted-foreground ${isFirstLoad ? "landing-delay-6" : "landing-delay-fast-6"}`}>
        {showUpdateHint ? (
          <span className="animate-fade-in">
            Not connecting? Try: <code className="bg-muted px-1.5 py-0.5 rounded">npm install -g opencode-studio-server@latest</code>
          </span>
        ) : (
          "Waiting for backend connection..."
        )}
      </div>
    </div>
  );
}

function LoadingState({ isFirstLoad }: { isFirstLoad: boolean }) {
  const scale = isFirstLoad ? "scale-[1.8]" : "scale-[1.5]";
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background overflow-hidden">
      <div className={scale}>
        <Logo className="w-24 h-24" />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { connected, loading } = useApp();
  const isFirstLoad = useIsFirstLoad();

  if (loading && !connected) {
    return <LoadingState isFirstLoad={isFirstLoad} />;
  }

  if (!connected) {
    return <DisconnectedLanding isFirstLoad={isFirstLoad} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main id="main-content" className="flex-1 overflow-auto p-6 pb-8">
        <div className="hover-lift-container h-full">
          {children}
        </div>
      </main>
      <DebugMenu />
    </div>
  );
}
