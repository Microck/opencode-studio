"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal, Puzzle, FileCode, Settings, FileJson, Key, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { href: "/mcp", label: "MCP Servers", icon: Terminal },
  { href: "/skills", label: "Skills", icon: Puzzle },
  { href: "/plugins", label: "Plugins", icon: FileCode },
  { href: "/commands", label: "Commands", icon: Command },
  { href: "/auth", label: "Auth", icon: Key },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/config", label: "Raw Config", icon: FileJson },
];

export function Sidebar() {
  const pathname = usePathname();

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

        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">v1.0</span>
          <ThemeToggle />
        </div>
      </div>
    </TooltipProvider>
  );
}
