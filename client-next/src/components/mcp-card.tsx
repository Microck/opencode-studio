"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash, Edit, Server, Alert as AlertIcon } from "@nsmr/pixelart-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { MCPConfig } from "@/types";

interface MCPCardProps {
  name: string;
  config: MCPConfig;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (config: MCPConfig) => Promise<void>;
}

export function MCPCard({ name, config, onToggle, onDelete, onEdit }: MCPCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [configJson, setConfigJson] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fullCommand = [
    ...(Array.isArray(config.command) ? config.command : config.command ? [config.command] : []),
    ...(config.args || [])
  ].join(" ") || config.url || "";

  const handleOpenEdit = () => {
    setConfigJson(JSON.stringify(config, null, 2));
    setError("");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    setError("");

    let newConfig: MCPConfig;
    try {
      newConfig = JSON.parse(configJson);
      if (typeof newConfig !== "object" || Array.isArray(newConfig)) {
        setError("Config must be a JSON object");
        return;
      }
    } catch {
      setError("Invalid JSON");
      return;
    }

    try {
      setLoading(true);
      await onEdit(newConfig);
      setEditOpen(false);
    } catch {
      setError("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className={config.enabled ? "border-primary/50" : "opacity-60"}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Server className="h-5 w-5 text-blue-500 shrink-0" />
              <span className="font-mono text-sm truncate">{name}</span>
              <Badge variant={config.type === "local" ? "default" : "secondary"} className="text-[10px]">
                {config.type}
              </Badge>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEdit();
                }}
                className="h-8 w-8 text-muted-foreground"
              >
                <Edit className="h-4 w-4" />
              </Button>
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
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1 font-mono">
            {fullCommand}
          </p>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {name}</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <Alert className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editConfigJson">Config (JSON)</Label>
              <Textarea
                id="editConfigJson"
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                className="font-mono text-sm min-h-[300px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
