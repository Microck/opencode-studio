"use client";

import { useApp } from "@/lib/context";
import { Sidebar } from "@/components/sidebar";
import { PROTOCOL_URL } from "@/lib/api";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Play, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const FIRST_LOAD_KEY = "opencode-studio-loaded";

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

function DisconnectedLanding({ isFirstLoad }: { isFirstLoad: boolean }) {
  const [showUpdateHint, setShowUpdateHint] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowUpdateHint(true), 10000);
    return () => clearTimeout(timer);
  }, []);
  
  const handleLaunch = () => {
    window.location.href = PROTOCOL_URL;
  };

  const animClass = isFirstLoad ? "animate-logo-entrance" : "animate-logo-entrance-fast";
  const contentClass = isFirstLoad ? "animate-content-appear" : "animate-content-appear-fast";

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={animClass}>
          <Logo className="w-24 h-24" />
        </div>
      </div>
      
      <div className={`flex flex-col items-center gap-8 max-w-md text-center px-4 mt-48 ${contentClass}`}>
        <div className="space-y-2">
          <h1 className={`text-4xl font-bold tracking-tight ${isFirstLoad ? "landing-delay-1" : "landing-delay-fast-1"}`}>OpenCode Studio</h1>
          <p className={`text-muted-foreground text-lg ${isFirstLoad ? "landing-delay-2" : "landing-delay-fast-2"}`}>
            Manage your OpenCode configuration with a visual interface
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <div className={isFirstLoad ? "landing-delay-3" : "landing-delay-fast-3"}>
            <Button size="lg" className="w-full gap-2" onClick={handleLaunch}>
              <Play className="h-5 w-5" />
              Launch Backend
            </Button>
          </div>
          
          <p className={`text-xs text-muted-foreground ${isFirstLoad ? "landing-delay-4" : "landing-delay-fast-4"}`}>
            Don&apos;t have it installed?
          </p>
          
          <code className={`text-xs bg-muted px-3 py-2 rounded-md font-mono ${isFirstLoad ? "landing-delay-4" : "landing-delay-fast-4"}`}>
            npm install -g opencode-studio-server
          </code>
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
  const scale = isFirstLoad ? "scale-[1.8]" : "scale-150";
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background overflow-hidden">
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
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 pb-8">
        <div className="hover-lift-container">
          {children}
        </div>
      </main>
    </div>
  );
}
