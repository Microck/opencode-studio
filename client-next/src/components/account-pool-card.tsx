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
  Settings,
} from "lucide-react";

import type { AccountPool, AccountPoolEntry, QuotaInfo } from "@/types";

import { savePoolLimit, type CooldownRule } from "@/lib/api";

interface AccountPoolCardProps {
  pool: AccountPool;
  cooldownRules?: CooldownRule[];
  onRotate: () => Promise<void>;
  onActivate: (name: string) => Promise<void>;
  onCooldown: (name: string, rule?: string) => Promise<void>;
  onClearCooldown: (name: string) => Promise<void>;
  onRemove: (name: string) => Promise<void>;
  onClearAll?: () => Promise<void>;
  onRename?: (name: string, newName: string) => Promise<void>;
  onEditMetadata?: (name: string, metadata: { projectId?: string; tier?: string }) => Promise<void>;
  onAddAccount: () => void;
  onAddCooldownRule?: (name: string, duration: number) => Promise<void>;
  onDeleteCooldownRule?: (name: string) => Promise<void>;
  rotating: boolean;
  isAdding: boolean;
  providerName?: string;
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
  onRotate,
  onActivate,
  onCooldown,
  onClearCooldown,
  onRemove,
  onClearAll,
  onRename,
  onEditMetadata,
  onAddAccount,
  onAddCooldownRule,
  onDeleteCooldownRule,
  rotating,
  isAdding,
  providerName = "Google",
  cooldownRules = [],
}: AccountPoolCardProps) {
  const [cooldownTimers, setCooldownTimers] = useState<Record<string, string>>({});
  const [renameOpen, setRenameOpen] = useState(false);
  const [cooldownOpen, setCooldownOpen] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [cooldownTarget, setCooldownTarget] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{name: string, current: string} | null>(null);
  const [metadataTarget, setMetadataTarget] = useState<AccountPoolEntry | null>(null);
  const [newName, setNewName] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editTier, setEditTier] = useState("");
  
  const [addingRule, setAddingRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleDuration, setNewRuleDuration] = useState("1");
  const [newRuleUnit, setNewRuleUnit] = useState("h");

  const handleCooldownClick = (name: string) => {
    setCooldownTarget(name);
    setCooldownOpen(true);
    setAddingRule(false);
  };

  const handleRenameClick = (name: string) => {
    setRenameTarget({ name, current: name });
    setNewName(name);
    setRenameOpen(true);
  };

  const handleEditMetadataClick = (account: AccountPoolEntry) => {
    setMetadataTarget(account);
    setEditProjectId(account.projectId || "");
    setEditTier(account.tier || "");
    setMetadataOpen(true);
  };

  const handleMetadataSubmit = async () => {
    if (!metadataTarget || !onEditMetadata) return;
    await onEditMetadata(metadataTarget.name, { projectId: editProjectId, tier: editTier });
    setMetadataOpen(false);
  };

  const handleAddRule = async () => {
     if (!newRuleName || !newRuleDuration || !onAddCooldownRule) return;
     
     let ms = parseFloat(newRuleDuration);
     if (newRuleUnit === 'm') ms *= 60000;
     else if (newRuleUnit === 'h') ms *= 3600000;
     else if (newRuleUnit === 'd') ms *= 86400000;
     
     await onAddCooldownRule(newRuleName, ms);
     setAddingRule(false);
     setNewRuleName("");
     setNewRuleDuration("1");
  };

  const handleCooldownSubmit = async (rule?: string) => {
    if (!cooldownTarget) return;
    await onCooldown(cooldownTarget, rule);
    setCooldownOpen(false);
    setCooldownTarget(null);
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
      <div className="border rounded-lg bg-background shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-md text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-medium leading-none tracking-tight">{providerName} Pool</h3>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {pool.availableAccounts} / {pool.totalAccounts} available
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onClearAll && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" 
                onClick={() => setClearAllOpen(true)}
                title="Clear All"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <div className="h-4 w-px bg-border mx-1" />
            <Button variant="outline" size="sm" onClick={onAddAccount} disabled={isAdding} className="h-8 text-xs font-medium">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add
            </Button>
            <Button variant="outline" size="sm" onClick={onRotate} disabled={rotating} className="h-8 text-xs font-medium">
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${rotating ? "animate-spin" : ""}`} />
              Next
            </Button>
          </div>
        </div>

        <div className="divide-y">
          {pool.accounts.map((account) => (
            <div key={account.name} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${
                  account.status === 'active' ? 'bg-green-500 ring-2 ring-green-500/20' : 
                  account.status === 'cooldown' ? 'bg-amber-500 ring-2 ring-amber-500/20' : 'bg-slate-300 dark:bg-slate-700'
                }`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate text-foreground">{account.email || account.name}</span>
                    {account.status === 'active' && <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium bg-green-500/10 text-green-700 hover:bg-green-500/20 border-0">Active</Badge>}
                    {account.status === 'cooldown' && <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-0">Cooldown</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                        <span className="font-semibold text-foreground/80">{account.usageCount}</span> reqs
                    </span>
                    {account.status === 'cooldown' && cooldownTimers[account.name] && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500 font-medium">
                          <Clock className="h-3 w-3" />
                          {cooldownTimers[account.name]} left
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {account.status !== 'active' && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 px-3 text-xs font-medium opacity-0 group-hover:opacity-100 transition-all data-[state=open]:opacity-100 bg-primary/5 hover:bg-primary/10 text-primary" 
                    onClick={() => onActivate(account.name)}
                  >
                    Switch
                  </Button>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all data-[state=open]:opacity-100">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {account.status !== "active" && (
                      <DropdownMenuItem onClick={() => onActivate(account.name)}>
                        <Check className="h-4 w-4 mr-2" />
                        Set Active
                      </DropdownMenuItem>
                    )}
                    {account.status === "cooldown" ? (
                      <DropdownMenuItem onClick={() => onClearCooldown(account.name)}>
                        <Play className="h-4 w-4 mr-2" />
                        Clear Cooldown
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleCooldownClick(account.name)}>
                        <Snowflake className="h-4 w-4 mr-2" />
                        Mark Cooldown
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onRemove(account.name)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Account
                    </DropdownMenuItem>
                    {onRename && (
                      <DropdownMenuItem onClick={() => handleRenameClick(account.name)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                    )}
                    {onEditMetadata && (
                      <DropdownMenuItem onClick={() => handleEditMetadataClick(account)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Edit Metadata
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </div>

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

      <Dialog open={metadataOpen} onOpenChange={setMetadataOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Metadata</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Project ID</Label>
              <Input 
                value={editProjectId} 
                onChange={(e) => setEditProjectId(e.target.value)} 
                placeholder="e.g. my-project-123"
              />
            </div>
            <div className="grid gap-2">
              <Label>Tier</Label>
              <Input 
                value={editTier} 
                onChange={(e) => setEditTier(e.target.value)} 
                placeholder="e.g. free, paid"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetadataOpen(false)}>Cancel</Button>
            <Button onClick={handleMetadataSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cooldownOpen} onOpenChange={setCooldownOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Cooldown</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            {cooldownRules
              .sort((a, b) => {
                const aIsAg = a.name.includes("Antigravity");
                const bIsAg = b.name.includes("Antigravity");
                if (aIsAg && !bIsAg) return -1;
                if (!aIsAg && bIsAg) return 1;
                return a.name.localeCompare(b.name);
              })
              .map(rule => (
                <div key={rule.name} className="flex items-center gap-2">
                  <Button 
                    onClick={() => handleCooldownSubmit(rule.name)}
                    className={`flex-1 justify-between ${rule.name.includes("Antigravity") ? "border-primary/50 bg-primary/5 hover:bg-primary/10" : ""}`}
                    variant="outline"
                  >
                    <span className="flex items-center gap-2">
                      {rule.name.includes("Antigravity") && <Snowflake className="h-3 w-3 text-primary" />}
                      {rule.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{Math.round(rule.duration / 360000) / 10}h</span>
                  </Button>
                  {onDeleteCooldownRule && !rule.name.includes("Antigravity") && (
                  <Button variant="ghost" size="icon" onClick={() => onDeleteCooldownRule(rule.name)} className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" onClick={() => handleCooldownSubmit()} className="justify-between w-full">
              <span>Default</span>
              <span className="text-xs text-muted-foreground">1h</span>
            </Button>

            {onAddCooldownRule && (
              <div className="mt-2 pt-2 border-t">
                {!addingRule ? (
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setAddingRule(true)}>
                      <Plus className="h-3 w-3 mr-2" /> Add Preset
                    </Button>
                ) : (
                    <div className="space-y-2 p-2 bg-muted/30 rounded-md border">
                      <Input 
                        placeholder="Name (e.g. Rate Limit)" 
                        value={newRuleName} 
                        onChange={e => setNewRuleName(e.target.value)} 
                        className="h-8 text-xs" 
                      />
                      <div className="flex gap-2">
                          <Input 
                            type="number" 
                            placeholder="Duration" 
                            value={newRuleDuration} 
                            onChange={e => setNewRuleDuration(e.target.value)} 
                            className="h-8 text-xs flex-1" 
                          />
                          <select 
                            className="h-8 text-xs border rounded bg-background px-2 w-20" 
                            value={newRuleUnit} 
                            onChange={e => setNewRuleUnit(e.target.value)}
                          >
                            <option value="m">min</option>
                            <option value="h">hour</option>
                            <option value="d">day</option>
                          </select>
                      </div>
                      <div className="flex gap-2">
                          <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => setAddingRule(false)}>Cancel</Button>
                          <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleAddRule} disabled={!newRuleName || !newRuleDuration}>Save</Button>
                      </div>
                    </div>
                )}
              </div>
            )}
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
