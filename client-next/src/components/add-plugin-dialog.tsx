"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, AlertCircle } from "lucide-react";
import { savePlugin } from "@/lib/api";
import { toast } from "sonner";

interface AddPluginDialogProps {
  onSuccess: () => void;
}

const JS_TEMPLATE = `// OpenCode Plugin
// Export functions to extend OpenCode functionality

export function onMessage(message) {
  // Called when a message is received
  console.log("Message:", message);
}

export function onResponse(response) {
  // Called when a response is generated
  return response;
}
`;

const TS_TEMPLATE = `// OpenCode Plugin (TypeScript)
// Export functions to extend OpenCode functionality

interface Message {
  role: string;
  content: string;
}

export function onMessage(message: Message): void {
  // Called when a message is received
  console.log("Message:", message);
}

export function onResponse(response: string): string {
  // Called when a response is generated
  return response;
}
`;

export function AddPluginDialog({ onSuccess }: AddPluginDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fileType, setFileType] = useState<"js" | "ts">("ts");
  const [content, setContent] = useState(TS_TEMPLATE);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName("");
    setFileType("ts");
    setContent(TS_TEMPLATE);
    setError("");
  };

  const handleTypeChange = (type: "js" | "ts") => {
    setFileType(type);
    setContent(type === "ts" ? TS_TEMPLATE : JS_TEMPLATE);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a plugin name");
      return;
    }

    const ext = `.${fileType}`;
    const fileName = name.endsWith(ext) ? name : `${name}${ext}`;

    if (!/^[a-zA-Z0-9_-]+\.(js|ts)$/.test(fileName)) {
      setError("Name can only contain letters, numbers, hyphens, and underscores");
      return;
    }

    try {
      setLoading(true);
      await savePlugin(fileName, content);
      toast.success(`Created ${fileName}`);
      resetForm();
      setOpen(false);
      onSuccess();
    } catch {
      setError("Failed to create plugin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Plugin
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Plugin</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="plugin-name">Plugin Name</Label>
              <Input
                id="plugin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-plugin"
              />
            </div>
            <div className="w-32 space-y-2">
              <Label>Type</Label>
              <Select value={fileType} onValueChange={(v) => handleTypeChange(v as "js" | "ts")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ts">TypeScript</SelectItem>
                  <SelectItem value="js">JavaScript</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Will be saved as {name ? (name.endsWith(`.${fileType}`) ? name : `${name}.${fileType}`) : `plugin-name.${fileType}`}
          </p>

          <div className="space-y-2">
            <Label htmlFor="plugin-content">Content</Label>
            <Textarea
              id="plugin-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Plugin"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
