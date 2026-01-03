"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { MCPConfig } from "@/types";

interface MCPCardProps {
  name: string;
  config: MCPConfig;
  onToggle: () => void;
  onDelete: () => void;
}

export function MCPCard({ name, config, onToggle, onDelete }: MCPCardProps) {
  const fullCommand = [
    ...(config.command || []),
    ...(config.args || [])
  ].join(" ") || config.url || "";

  return (
    <Card className={config.enabled ? "border-primary/50" : "opacity-60"}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{name}</CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              checked={config.enabled}
              onCheckedChange={onToggle}
              aria-label={`Toggle ${name}`}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <code className="block text-xs bg-background p-2 rounded overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground font-mono">
          {fullCommand}
        </code>
        <Badge variant={config.type === "local" ? "default" : "secondary"}>
          {config.type}
        </Badge>
      </CardContent>
    </Card>
  );
}
