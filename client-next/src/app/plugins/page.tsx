"use client";

import { useApp } from "@/lib/context";
import { PluginCard } from "@/components/plugin-card";
import { AddPluginDialog } from "@/components/add-plugin-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { deletePlugin } from "@/lib/api";
import { toast } from "sonner";

export default function PluginsPage() {
  const { plugins, loading, refreshData, togglePlugin } = useApp();
  const router = useRouter();

  const handleOpen = (name: string) => {
    router.push(`/editor?type=plugins&name=${encodeURIComponent(name)}`);
  };

  const handleToggle = async (name: string) => {
    try {
      await togglePlugin(name);
      const plugin = plugins.find(p => p.name === name);
      toast.success(`${name} ${plugin?.enabled ? "disabled" : "enabled"}`);
    } catch {
      toast.error("Failed to toggle plugin");
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await deletePlugin(name);
      toast.success(`${name} deleted`);
      refreshData();
    } catch {
      toast.error("Failed to delete plugin");
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
        <AddPluginDialog onSuccess={refreshData} />
      </div>

      {plugins.length === 0 ? (
        <p className="text-muted-foreground italic">No plugins found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.name}
              plugin={plugin}
              onToggle={() => handleToggle(plugin.name)}
              onDelete={() => handleDelete(plugin.name)}
              onClick={() => handleOpen(plugin.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
