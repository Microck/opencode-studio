"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/lib/context";
import { PluginCard } from "@/components/plugin-card";
import { AddPluginDialog } from "@/components/add-plugin-dialog";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { deletePlugin, deletePluginFromConfig, getActiveGooglePlugin, getPlugins } from "@/lib/api";
import { toast } from "sonner";
import { Search } from "@nsmr/pixelart-react";
import { Button } from "@/components/ui/button";
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
import { PageHelp } from "@/components/page-help";
import { PageHelpDialog } from "@/components/page-help-dialog";
import { PresetsManager } from "@/components/presets-manager";

export default function PluginsPage() {
  const t = useTranslations('plugins');
  const { plugins, refreshData, togglePlugin } = useApp();
  const [pluginsData, setPluginsData] = useState(plugins);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeGPlugin, setActiveGPlugin] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ name: string, type: 'file' | 'npm' } | null>(null);

  useEffect(() => {
    getActiveGooglePlugin().then(res => setActiveGPlugin(res.activePlugin)).catch(() => {});
  }, []);

  useEffect(() => {
    setPluginsData(plugins);
  }, [plugins]);

  useEffect(() => {
    const loadPlugins = async () => {
      try {
        if (pluginsData.length === 0) setLoading(true);
        const data = await getPlugins();
        setPluginsData(data);
      } finally {
        setLoading(false);
      }
    };
    loadPlugins();
  }, []);

  const filteredPlugins = useMemo(() => {
    if (!search.trim()) return pluginsData;
    const q = search.toLowerCase();
    return pluginsData.filter(p => p.name.toLowerCase().includes(q));
  }, [pluginsData, search]);

  const handleOpen = (name: string, type: 'file' | 'npm') => {
    if (type === 'npm') return;
    router.push(`/editor?type=plugins&name=${encodeURIComponent(name)}`);
  };

  const handleToggle = async (name: string) => {
    try {
      await togglePlugin(name);
      const plugin = pluginsData.find(p => p.name === name);
      toast.success(plugin?.enabled ? t('toggleDisabled', { name }) : t('toggleEnabled', { name }));
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || t('unknownError');
      toast.error(t('toggleFailed', { error: msg }));
    }
  };

  const handleDelete = (name: string, type: 'file' | 'npm') => {
    setDeleteTarget({ name, type });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'npm') {
        await deletePluginFromConfig(deleteTarget.name);
      } else {
        await deletePlugin(deleteTarget.name);
      }
      toast.success(t('deleted', { name: deleteTarget.name }));
      setDeleteDialogOpen(false);
      await reloadPlugins();
      refreshData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || t('unknownError');
      toast.error(t('deleteFailed', { error: msg }));
    }
  };

  const reloadPlugins = async () => {
    const data = await getPlugins();
    setPluginsData(data);
  };

if (loading && pluginsData.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <PageHelp title={t('title')} docUrl="https://opencode.ai/docs/plugins" docTitle={t('docTitleFull')} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16" />
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
          <BulkImportDialog 
            type="plugins"
            existingNames={pluginsData.map(p => p.name)} 
            onSuccess={async () => { await reloadPlugins(); refreshData(); }} 
          />
          <AddPluginDialog onSuccess={async () => { await reloadPlugins(); refreshData(); }} />
        </div>
      </div>

      {pluginsData.length > 0 && (
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

      {pluginsData.length === 0 ? (
        <p className="text-muted-foreground italic">{t('noPlugins')}</p>
      ) : filteredPlugins.length === 0 ? (
        <p className="text-muted-foreground italic">{t('noMatch', { search })}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredPlugins.map((plugin) => {
            const isGemini = plugin.name.includes('gemini-auth');
            const isAntigravity = plugin.name.includes('antigravity-auth');
            const locked = (isGemini && activeGPlugin === 'antigravity') || (isAntigravity && activeGPlugin === 'gemini');
            
            const displayPlugin = locked ? { ...plugin, enabled: false } : plugin;
            
            return (
              <PluginCard
                key={plugin.name}
                plugin={displayPlugin}
                locked={locked}
                onToggle={() => handleToggle(plugin.name)}
                onDelete={() => handleDelete(plugin.name, plugin.type)}
                onClick={plugin.type === 'file' ? () => handleOpen(plugin.name, plugin.type) : undefined}
              />
            );
          })}
        </div>
      )}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm', { name: deleteTarget?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
