"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  RefreshCw,
  MoreVertical,
  Snowflake,
  Play,
  Star,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  Clock,
  Check,
} from "lucide-react";

import type { AccountPool, AccountPoolEntry, QuotaInfo } from "@/types";

import { savePoolLimit, type CooldownRule } from "@/lib/api";

interface AccountPoolCardProps {
  pool: AccountPool;
  quota: QuotaInfo;
  cooldownRules?: CooldownRule[];
  onRotate: () => Promise<void>;
  onActivate: (name: string) => Promise<void>;
  onCooldown: (name: string, rule?: string) => Promise<void>;
  onClearCooldown: (name: string) => Promise<void>;
  onRemove: (name: string) => Promise<void>;
  onClearAll?: () => Promise<void>;
  onRename?: (name: string, newName: string) => Promise<void>;
  onAddAccount: () => void;
  rotating: boolean;
  isAdding: boolean;
  providerName?: string;
  cooldownRules?: CooldownRule[];
}: AccountPoolCardProps) {
  const [cooldownTimers, setCooldownTimers] = useState<Record<string, string>>({});
  const [renameOpen, setRenameOpen] = useState(false);
  const [cooldownOpen, setCooldownOpen] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [cooldownTarget, setCooldownTarget] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{name: string, current: string} | null>(null);
  const [newName, setNewName] = useState("");

  const handleCooldownClick = (name: string) => {
    setCooldownTarget(name);
    setCooldownOpen(true);
  };

  const handleCooldownSubmit = async (rule?: string) => {
    if (!cooldownTarget) return;
    await onCooldown(cooldownTarget, rule);
    setCooldownOpen(false);
    setCooldownTarget(null);
  };

  const handleRenameClick = (name: string) => {
    setRenameTarget({ name, current: name });
    setNewName(name);
    setRenameOpen(true);
  };

  const handleRenameSubmit = async () => {
    if (!renameTarget || !newName.trim() || !onRename) return;
    try {
      await onRename(renameTarget.name, newName.trim());
      setRenameOpen(false);
      setRenameTarget(null);
    } catch {
      // Error handled by parent
    }
  };

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
            Add {providerName} accounts to enable multi-account rotation
          </p>
          <Button 
            onClick={onAddAccount} 
            disabled={isAdding}
            variant="outline"
            className="mt-4"
          >
            {isAdding ? "Connecting..." : `Add ${providerName} Account`}
          </Button>
        </CardContent>
      </Card>
    );
  }



  return (
    <>
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {providerName} Pool
            </CardTitle>
          <div className="flex items-center gap-2">
            {onClearAll && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 mr-1" 
                onClick={() => setClearAllOpen(true)}
                title="Clear All Accounts"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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
        <div className="space-y-2">
          {pool.accounts.map((account) => (
            <div
              key={account.name}
              className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                account.status === "active"
                  ? "bg-primary/5 border border-primary/20"
                  : account.status === "cooldown"
                  ? "bg-yellow-500/10 border border-yellow-200/60 dark:border-yellow-900/30"
                  : "bg-muted/30 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Badge
                  variant="outline"
                  className={`${getStatusColor(account.status)} flex items-center gap-1 shrink-0`}
                >
                  {getStatusIcon(account.status)}
                  {account.status}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {account.email || account.name}
                    </p>
                    {account.status !== "active" && (
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 px-2 text-xs bg-primary/10 hover:bg-primary/20 text-primary"
                            onClick={() => onActivate(account.name)}
                        >
                            Switch
                        </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{account.usageCount} requests</span>
                    {account.status === "cooldown" && cooldownTimers[account.name] && (
                      <span className="flex items-center gap-1 text-yellow-700 dark:text-yellow-400">
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
                    <DropdownMenuItem onClick={() => handleCooldownClick(account.name)}>
                      <Snowflake className="h-3.5 w-3.5 mr-2" />
                      Mark Cooldown
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onRemove(account.name)} className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Remove Account
                  </DropdownMenuItem>
                  {onRename && (
                    <DropdownMenuItem onClick={() => handleRenameClick(account.name)}>
                      <Edit2 className="h-3.5 w-3.5 mr-2" />
                      Rename
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Profile</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>New Name</Label>
            <Input 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              placeholder={renameTarget?.current}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRenameSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cooldownOpen} onOpenChange={setCooldownOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Cooldown</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            {cooldownRules.map(rule => (
              <Button 
                key={rule.name} 
                onClick={() => handleCooldownSubmit(rule.name)}
                className="justify-between"
                variant="outline"
              >
                <span>{rule.name}</span>
                <span className="text-xs text-muted-foreground">{rule.duration / 3600000}h</span>
              </Button>
            ))}
            <Button variant="outline" onClick={() => handleCooldownSubmit()} className="justify-between">
              <span>Default</span>
              <span className="text-xs text-muted-foreground">1h</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCooldownOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Accounts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {providerName} accounts from the pool. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { onClearAll?.(); setClearAllOpen(false); }} 
              className="bg-destructive hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
