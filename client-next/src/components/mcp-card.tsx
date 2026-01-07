"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Pencil, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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
      <Card className={cn("hover-lift", config.enabled ? "border-primary/50" : "opacity-60")}>
        <CardHeader className="p-3 pb-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold truncate max-w-[120px]">{name}</CardTitle>
            <div className="flex items-center gap-1">
              <Switch
                checked={config.enabled}
                onCheckedChange={onToggle}
                aria-label={`Toggle ${name}`}
                className="scale-75"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenEdit}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-1.5">
          <code className="block text-[10px] bg-background/50 p-1.5 rounded overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground font-mono border border-border/20">
            {fullCommand}
          </code>
          <div className="flex items-center gap-2">
            <Badge variant={config.type === "local" ? "default" : "secondary"} className="text-[9px] px-1.5 py-0 h-4">
              {config.type}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {name}</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
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
