"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings, Trash2 } from "lucide-react";
import type { PluginInfo } from "@/types";

interface PluginCardProps {
  plugin: PluginInfo;
  onToggle: () => void;
  onDelete: () => void;
  onClick: () => void;
}

export function PluginCard({ plugin, onToggle, onDelete, onClick }: PluginCardProps) {
  return (
    <Card className={plugin.enabled ? "border-primary/50" : "opacity-60"}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-80"
            onClick={onClick}
          >
            <Settings className="h-5 w-5 text-purple-500 shrink-0" />
            <span className="font-mono text-sm truncate">{plugin.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={plugin.enabled}
              onCheckedChange={() => onToggle()}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Toggle ${plugin.name}`}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
