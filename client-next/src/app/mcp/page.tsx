"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/lib/context";
import { MCPCard } from "@/components/mcp-card";
import { AddMCPDialog } from "@/components/add-mcp-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { Search } from "@nsmr/pixelart-react";
import { PageHelp } from "@/components/page-help";
import { PresetsManager } from "@/components/presets-manager";
import type { MCPConfig } from "@/types";

export default function MCPPage() {
  const { config, loading, toggleMCP, deleteMCP, addMCP, updateMCP } = useApp();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const mcpEntries = Object.entries(config?.mcp || {});
  
  const filteredMCPs = useMemo(() => {
    if (!search.trim()) return mcpEntries;
    const q = search.toLowerCase();
    return mcpEntries.filter(([key, mcp]) => 
      key.toLowerCase().includes(q) || 
      mcp.command?.some((c: string) => c.toLowerCase().includes(q)) ||
      mcp.args?.some((arg: string) => arg.toLowerCase().includes(q))
    );
  }, [mcpEntries, search]);

  const handleToggle = async (key: string) => {
    try {
      await toggleMCP(key);
      toast.success(`${key} ${config?.mcp?.[key]?.enabled ? "disabled" : "enabled"}`);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to toggle server: ${msg}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMCP(deleteTarget);
      toast.success(`${deleteTarget} deleted`);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to delete server: ${msg}`);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleAdd = async (name: string, mcpConfig: Parameters<typeof addMCP>[1]) => {
    try {
      await addMCP(name, mcpConfig);
      toast.success(`${name} added`);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to add server: ${msg}`);
    }
  };

  const handleEdit = async (key: string) => {
    const mcpConfig = config?.mcp?.[key];
    if (!mcpConfig) return;
    try {
      await updateMCP(key, mcpConfig);
      toast.success(`${key} updated`);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to update server: ${msg}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHelp title="MCP Servers" docUrl="https://opencode.ai/docs" docTitle="MCP Servers" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
        <PageHelp title="MCP Servers" docUrl="https://opencode.ai/docs/mcp" docTitle="MCP Servers" />
        <div className="flex gap-2">
          <PresetsManager />
          <AddMCPDialog onAdd={handleAdd} />
        </div>
      </div>

      {mcpEntries.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search MCP servers..."
            className="pl-9"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMCPs.map(([key, mcp]) => (
          <MCPCard
            key={key}
            name={key}
            config={mcp}
            onToggle={() => handleToggle(key)}
            onDelete={() => setDeleteTarget(key)}
            onEdit={() => handleEdit(key)}
          />
        ))}
      </div>

      {search && filteredMCPs.length === 0 && (
        <p className="text-muted-foreground italic">No MCP servers match &quot;{search}&quot;</p>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the MCP server configuration. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
