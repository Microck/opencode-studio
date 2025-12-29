"use client";

import { useApp } from "@/lib/context";
import { FileCard } from "@/components/file-card";
import { AddPluginDialog } from "@/components/add-plugin-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PluginsPage() {
  const { plugins, loading, refreshData } = useApp();
  const router = useRouter();

  const handleOpen = (name: string) => {
    router.push(`/editor?type=plugins&name=${encodeURIComponent(name)}`);
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
            <FileCard
              key={plugin}
              name={plugin}
              icon={<Settings className="h-5 w-5 text-purple-500" />}
              onClick={() => handleOpen(plugin)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
