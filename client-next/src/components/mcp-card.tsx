"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, Server } from "lucide-react";
import type { MCPConfig } from "@/types";

interface MCPCardProps {
  name: string;
  config: MCPConfig;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export function MCPCard({ name, config, onToggle, onDelete, onEdit }: MCPCardProps) {
  const fullCommand = [
    ...(Array.isArray(config.command) ? config.command : config.command ? [config.command] : []),
    ...(config.args || [])
  ].join(" ") || config.url || "";

  return (
    <Card className={config.enabled ? "border-primary/50" : "opacity-60"}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-80"
            onClick={onEdit}
          >
            <Server className="h-5 w-5 text-blue-500 shrink-0" />
            <span className="font-mono text-sm truncate">{name}</span>
            <Badge variant={config.type === "local" ? "default" : "secondary"} className="text-[10px]">
              {config.type}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={config.enabled}
              onCheckedChange={onToggle}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Toggle ${name}`}
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
        <p className="text-xs text-muted-foreground mt-1 pl-7 line-clamp-1 font-mono">
          {fullCommand}
        </p>
      </CardContent>
    </Card>
  );
}
