"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  RefreshCw,
  Clock,
  Check,
  AlertCircle,
  MoreVertical,
  Snowflake,
  Play,
  Star,
  Plus,
} from "lucide-react";
import type { AccountPool, AccountPoolEntry, QuotaInfo } from "@/types";

interface AccountPoolCardProps {
  pool: AccountPool;
  quota: QuotaInfo;
  onRotate: () => Promise<void>;
  onActivate: (name: string) => Promise<void>;
  onCooldown: (name: string) => Promise<void>;
  onClearCooldown: (name: string) => Promise<void>;
  onAddAccount: () => void;
  rotating: boolean;
  isAdding: boolean;
}

function formatTimeRemaining(until: number | null): string {
  if (!until) return "";
  const diff = until - Date.now();
  if (diff <= 0) return "Ready";
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

function getStatusColor(status: AccountPoolEntry["status"]): string {
  switch (status) {
    case "active":
      return "bg-primary/10 text-primary border-primary/20";
    case "ready":
      return "bg-muted text-muted-foreground border-border";
    case "cooldown":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-900/30";
    case "expired":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "";
  }
}

function getStatusIcon(status: AccountPoolEntry["status"]) {
  switch (status) {
    case "active":
      return <Star className="h-3 w-3" />;
    case "ready":
      return <Play className="h-3 w-3" />;
    case "cooldown":
      return <Snowflake className="h-3 w-3" />;
    case "expired":
      return <AlertCircle className="h-3 w-3" />;
    default:
      return null;
  }
}

export function AccountPoolCard({
  pool,
  quota,
  onRotate,
  onActivate,
  onCooldown,
  onClearCooldown,
  onAddAccount,
  rotating,
  isAdding,
}: AccountPoolCardProps) {
  const [cooldownTimers, setCooldownTimers] = useState<Record<string, string>>({});

  useEffect(() => {
    const updateTimers = () => {
      const timers: Record<string, string> = {};
      pool.accounts.forEach((acc) => {
        if (acc.status === "cooldown" && acc.cooldownUntil) {
          timers[acc.name] = formatTimeRemaining(acc.cooldownUntil);
        }
      });
      setCooldownTimers(timers);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 30000);
    return () => clearInterval(interval);
  }, [pool.accounts]);

  if (pool.totalAccounts === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No accounts in pool</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add Google accounts to enable multi-account rotation
          </p>
          <Button 
            onClick={onAddAccount} 
            disabled={isAdding}
            variant="outline"
            className="mt-4"
          >
            {isAdding ? "Connecting..." : "Add Google Account"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Account Pool
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onAddAccount}
              disabled={isAdding}
              className="h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Account
            </Button>
            <Badge variant="outline" className="text-xs">
              {pool.availableAccounts}/{pool.totalAccounts} available
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onRotate}
              disabled={rotating || pool.availableAccounts <= 1}
              className="h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${rotating ? "animate-spin" : ""}`} />
              Rotate
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Daily Quota</span>
            <span>{quota.percentage}% remaining</span>
          </div>
          <Progress value={quota.percentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{quota.used} used</span>
            <span>{quota.remaining} left</span>
          </div>
        </div>

        <div className="space-y-2">
          {pool.accounts.map((account) => (
            <div
              key={account.name}
              className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                account.status === "active"
                  ? "bg-primary/5 border border-primary/20"
                  : "bg-muted/30 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge
                  variant="outline"
                  className={`${getStatusColor(account.status)} flex items-center gap-1`}
                >
                  {getStatusIcon(account.status)}
                  {account.status}
                </Badge>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {account.email || account.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{account.usageCount} requests</span>
                    {account.status === "cooldown" && cooldownTimers[account.name] && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {cooldownTimers[account.name]}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {account.status !== "active" && (
                    <DropdownMenuItem onClick={() => onActivate(account.name)}>
                      <Check className="h-3.5 w-3.5 mr-2" />
                      Set Active
                    </DropdownMenuItem>
                  )}
                  {account.status === "cooldown" ? (
                    <DropdownMenuItem onClick={() => onClearCooldown(account.name)}>
                      <Play className="h-3.5 w-3.5 mr-2" />
                      Clear Cooldown
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => onCooldown(account.name)}>
                      <Snowflake className="h-3.5 w-3.5 mr-2" />
                      Mark Cooldown
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
