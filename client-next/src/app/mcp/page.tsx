"use client";

import { useApp } from "@/lib/context";
import { MCPCard } from "@/components/mcp-card";
import { AddMCPDialog } from "@/components/add-mcp-dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useState } from "react";
import { toast } from "sonner";

export default function MCPPage() {
  const { config, loading, toggleMCP, deleteMCP, addMCP } = useApp();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleToggle = async (key: string) => {
    try {
      await toggleMCP(key);
      toast.success(`${key} ${config?.mcp[key]?.enabled ? "disabled" : "enabled"}`);
    } catch {
      toast.error("Failed to toggle server");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMCP(deleteTarget);
      toast.success(`${deleteTarget} deleted`);
    } catch {
      toast.error("Failed to delete server");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleAdd = async (name: string, mcpConfig: Parameters<typeof addMCP>[1]) => {
    await addMCP(name, mcpConfig);
    toast.success(`${name} added`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">MCP Servers</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const mcpEntries = Object.entries(config?.mcp || {});

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">MCP Servers</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mcpEntries.map(([key, mcp]) => (
          <MCPCard
            key={key}
            name={key}
            config={mcp}
            onToggle={() => handleToggle(key)}
            onDelete={() => setDeleteTarget(key)}
          />
        ))}
        <AddMCPDialog onAdd={handleAdd} />
      </div>

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
