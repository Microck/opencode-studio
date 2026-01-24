"use client";

import { useState, useMemo, useEffect } from "react";
import { useApp } from "@/lib/context";
import { PluginCard } from "@/components/plugin-card";
import { AddPluginDialog } from "@/components/add-plugin-dialog";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { deletePlugin, deletePluginFromConfig, getActiveGooglePlugin } from "@/lib/api";
import { toast } from "sonner";
import { Search } from "@nsmr/pixelart-react";
import { PresetsManager } from "@/components/presets-manager";

export default function PluginsPage() {
  const { plugins, loading, refreshData, togglePlugin } = useApp();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeGPlugin, setActiveGPlugin] = useState<string | null>(null);

  useEffect(() => {
    getActiveGooglePlugin().then(res => setActiveGPlugin(res.activePlugin)).catch(() => {});
  }, []);

  const filteredPlugins = useMemo(() => {
    if (!search.trim()) return plugins;
    const q = search.toLowerCase();
    return plugins.filter(p => p.name.toLowerCase().includes(q));
  }, [plugins, search]);

  const handleOpen = (name: string, type: 'file' | 'npm') => {
    if (type === 'npm') return;
    router.push(`/editor?type=plugins&name=${encodeURIComponent(name)}`);
  };

  const handleToggle = async (name: string) => {
    try {
      await togglePlugin(name);
      const plugin = plugins.find(p => p.name === name);
      toast.success(`${name} ${plugin?.enabled ? "disabled" : "enabled"}`);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to toggle plugin: ${msg}`);
    }
  };

  const handleDelete = async (name: string, type: 'file' | 'npm') => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      if (type === 'npm') {
        await deletePluginFromConfig(name);
      } else {
        await deletePlugin(name);
      }
      toast.success(`${name} deleted`);
      refreshData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to delete plugin: ${msg}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Plugins</h1>
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
        <h1 className="text-2xl font-bold">Plugins</h1>
        <div className="flex gap-2">
          <PresetsManager />
          <BulkImportDialog 
            type="plugins"
            existingNames={plugins.map(p => p.name)} 
            onSuccess={refreshData} 
          />
          <AddPluginDialog onSuccess={refreshData} />
        </div>
      </div>

      {plugins.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plugins..."
            className="pl-9"
          />
        </div>
      )}

      {plugins.length === 0 ? (
        <p className="text-muted-foreground italic">No plugins found.</p>
      ) : filteredPlugins.length === 0 ? (
        <p className="text-muted-foreground italic">No plugins match "{search}"</p>
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
    </div>
  );
}
