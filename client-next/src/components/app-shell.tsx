"use client";

import { useApp } from "@/lib/context";
import { Sidebar } from "@/components/sidebar";
import { PROTOCOL_URL } from "@/lib/api";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Play, ExternalLink, Loader2 } from "lucide-react";

function DisconnectedLanding() {
  const handleLaunch = () => {
    window.location.href = PROTOCOL_URL;
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="animate-logo-entrance">
          <Logo className="w-24 h-24" />
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-8 max-w-md text-center px-4 mt-48 animate-content-appear">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight landing-delay-1">OpenCode Studio</h1>
          <p className="text-muted-foreground text-lg landing-delay-2">
            Manage your OpenCode configuration with a visual interface
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <div className="landing-delay-3">
            <Button size="lg" className="w-full gap-2" onClick={handleLaunch}>
              <Play className="h-5 w-5" />
              Launch Backend
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground landing-delay-4">
            Don&apos;t have it installed?
          </p>
          
          <code className="text-xs bg-muted px-3 py-2 rounded-md font-mono landing-delay-4">
            npm install -g opencode-studio-server
          </code>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground landing-delay-5">
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

      <div className="absolute bottom-4 text-xs text-muted-foreground landing-delay-6">
        Waiting for backend connection...
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background overflow-hidden">
      <div className="animate-logo-entrance">
        <Logo className="w-24 h-24" />
      </div>
      <div className="absolute bottom-1/3 opacity-0 animate-connecting-text text-muted-foreground text-sm">
        Connecting...
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { connected, loading } = useApp();

  if (loading && !connected) {
    return <LoadingState />;
  }

  if (!connected) {
    return <DisconnectedLanding />;
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
