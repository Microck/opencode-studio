"use client";

import { mcpEnabled } from "@/lib/mcp-config";
import { errorMessage } from "@/lib/error-message.mjs";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/lib/context";
import { getMcpServers } from "@/lib/api";
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
import { useErrorTranslation } from "@/lib/error-translate";
import type { MCPConfig } from "@/types";

export default function MCPPage() {
  const t = useTranslations('mcp');
  const translateError = useErrorTranslation();
  const { toggleMCP, deleteMCP, addMCP, updateMCP } = useApp();
  const [mcpData, setMcpData] = useState<Record<string, MCPConfig>>({});
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const mcpEntries = Object.entries(mcpData);

  const fetchMcpServers = async () => {
    try {
      setLoading(true);
      const data = await getMcpServers();
      setMcpData(data);
    } catch (err: unknown) {
      toast.error(t('loadFailed'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getMcpServers().then(data => { if (!cancelled) setMcpData(data); })
      .catch(error => { if (!cancelled) { toast.error(t('loadFailed')); console.error(error); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [t]);
  
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
      toast.success(mcpData[key] && mcpEnabled(mcpData[key]) ? t('toggleDisabled', { name: key }) : t('toggleEnabled', { name: key }));
      await fetchMcpServers();
    } catch (err: unknown) {
      const msg = errorMessage(err, t('unknownError'));
      toast.error(t('toggleFailed', { error: msg }));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMCP(deleteTarget);
      toast.success(t('deleted', { name: deleteTarget }));
      await fetchMcpServers();
    } catch (err: unknown) {
      const msg = errorMessage(err, t('unknownError'));
      toast.error(t('deleteFailed', { error: msg }));
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleAdd = async (name: string, mcpConfig: Parameters<typeof addMCP>[1]) => {
    try {
      await addMCP(name, mcpConfig);
      toast.success(t('added', { name }));
      await fetchMcpServers();
    } catch (err: unknown) {
      const msg = errorMessage(err, t('unknownError'));
      toast.error(t('addFailed', { error: msg }));
    }
  };

  const handleEdit = async (key: string) => {
    const mcpConfig = mcpData[key];
    if (!mcpConfig) return;
    try {
      await updateMCP(key, mcpConfig);
      toast.success(t('updated', { name: key }));
      await fetchMcpServers();
    } catch (err: unknown) {
      const msg = errorMessage(err, t('unknownError'));
      toast.error(t('updateFailed', { error: msg }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHelp title={t('title')} docUrl="https://opencode.ai/docs" docTitle={t('docTitle')} />
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
        <PageHelp title={t('title')} docUrl="https://opencode.ai/docs" docTitle={t('docTitle')} />
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
            placeholder={t('searchPlaceholder')}
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
        <p className="text-muted-foreground italic">{t('noMatch', { search })}</p>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle', { name: deleteTarget ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
