"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal, Puzzle, FileCode, Settings, FileJson, Key, Command, Rocket, Circle, Play, Power, BarChart, Github, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useApp } from "@/lib/context";
import { PROTOCOL_URL, shutdownBackend } from "@/lib/api";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const navItems = [
  { href: "/mcp", label: "MCP Servers", icon: Terminal },
  { href: "/skills", label: "Skills", icon: Puzzle },
  { href: "/plugins", label: "Plugins", icon: FileCode },
  { href: "/commands", label: "Commands", icon: Command },

  { href: "/usage", label: "Usage", icon: BarChart },
  { href: "/auth", label: "Auth", icon: Key },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/config", label: "Raw Config", icon: FileJson },
];

const bottomNavItems = [
  { href: "/quickstart", label: "Quickstart", icon: Rocket },
];

export function Sidebar() {
  const pathname = usePathname();
  const { connected } = useApp();
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const handleLaunchBackend = () => {
    window.location.href = PROTOCOL_URL;
  };

  const handleDisconnect = async () => {
    await shutdownBackend();
    setShowDisconnectDialog(false);
  };

  return (
    <TooltipProvider>
      <div className="w-64 bg-card border-r border-border flex flex-col h-screen">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Logo className="w-6 h-6" />
          <h1 className="text-xl font-bold">Opencode Studio</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3",
                      isActive && "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                    asChild
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div className="p-4 space-y-1">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3",
                      isActive && "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                    asChild
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Circle className={cn("h-2 w-2 fill-current", connected ? "text-green-500" : "text-red-500")} />
            <span className="text-xs text-muted-foreground">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {!connected && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleLaunchBackend}>
                    <Play className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Launch Backend</p>
                </TooltipContent>
              </Tooltip>
            )}
            {connected && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setShowDisconnectDialog(true)}>
                    <Power className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Disconnect Backend</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" asChild>
                  <a href="https://github.com/Microck/opencode-studio" target="_blank" rel="noopener noreferrer">
                    <Github className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>GitHub</p>
              </TooltipContent>
            </Tooltip>
            <ThemeToggle />
          </div>
        </div>

        <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect Backend?</AlertDialogTitle>
              <AlertDialogDescription>
                This will shut down the backend server. You&apos;ll need to relaunch it to make changes to your OpenCode configuration.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
