"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCardSettings, Trash, AddBox, Alert as AlertIcon, Edit, Lock } from "@nsmr/pixelart-react";
import type { PluginInfoAddBox} from "@/types";

interface PluginCardProps {
  plugin: PluginInfoAddBox
  onToggle: () => void;
  onDelete: () => void;
  onClick?: () => void;
  locked?: boolean;
}

export function PluginCard({ plugin, onToggle, onDelete, onClick, locked }: PluginCardProps) {
  const isNpm = plugin.type === 'npm';
  const Icon = isNpm ? AddBox : CreditCardSettings;
  const isIncompatible = plugin.name.includes('opencode-skills');
  
  return (
    <Card className={plugin.enabled ? "border-primary/50" : "opacity-60"}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div
            className={`flex items-center gap-2 flex-1 min-w-0 ${onClick && !locked ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={!locked ? onClick : undefined}
          >
            <Icon className={`h-5 w-5 shrink-0 ${isNpm ? 'text-orange-500' : 'text-purple-500'}`} />
            <span className="font-mono text-sm truncate">{plugin.name}</span>
            {isNpm && <Badge variant="secondary" className="text-xs">npm</Badge>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {locked ? (
                <Lock className="h-4 w-4 text-muted-foreground" />
            ) : (
                <Switch
                  checked={plugin.enabled}
                  onCheckedChange={() => onToggle()}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Toggle ${plugin.name}`}
                />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {isIncompatible && (
          <div className="mt-2 text-[10px] text-destructive flex items-center gap-1 font-medium bg-destructive/10 p-1 rounded">
            <Alert className="h-3 w-3" />
            Incompatible with Antigravity. Use openskills instead.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
