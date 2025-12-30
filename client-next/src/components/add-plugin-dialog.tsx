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
import { Plus, AlertCircle, Link, Loader2 } from "lucide-react";
import { savePlugin, fetchUrl } from "@/lib/api";
import { toast } from "sonner";

interface AddPluginDialogProps {
  onSuccess: () => void;
}

const JS_TEMPLATE = `export const MyPlugin = async ({ project, client, $, directory, worktree }) => {
  console.log("Plugin initialized!")

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        console.log("Session completed!")
      }
    },
  }
}
`;

const TS_TEMPLATE = `import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  console.log("Plugin initialized!")

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        console.log("Session completed!")
      }
    },
  }
}
`;

function isUrl(str: string): boolean {
  try {
    const url = new URL(str.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractNameAndTypeFromUrl(url: string): { name: string; type: "js" | "ts" | null } {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const filename = pathname.split('/').pop() || '';
    
    if (filename.endsWith('.ts')) {
      return { name: filename.replace(/\.ts$/, ''), type: 'ts' };
    } else if (filename.endsWith('.js')) {
      return { name: filename.replace(/\.js$/, ''), type: 'js' };
    }
    return { name: filename, type: null };
  } catch {
    return { name: '', type: null };
  }
}

export function AddPluginDialog({ onSuccess }: AddPluginDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fileType, setFileType] = useState<"js" | "ts">("ts");
  const [content, setContent] = useState(TS_TEMPLATE);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const resetForm = () => {
    setName("");
    setFileType("ts");
    setContent(TS_TEMPLATE);
    setError("");
    setUrlInput("");
  };

  const handleTypeChange = (type: "js" | "ts") => {
    setFileType(type);
    setContent(type === "ts" ? TS_TEMPLATE : JS_TEMPLATE);
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    
    if (!isUrl(urlInput)) {
      setError("Please enter a valid URL (http:// or https://)");
      return;
    }

    try {
      setFetching(true);
      setError("");
      const result = await fetchUrl(urlInput.trim());
      setContent(result.content);
      
      if (!name) {
        const extracted = extractNameAndTypeFromUrl(urlInput);
        if (extracted.name) {
          setName(extracted.name);
        }
        if (extracted.type) {
          setFileType(extracted.type);
        }
      }
      
      toast.success("Fetched content from URL");
      setUrlInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch URL");
    } finally {
      setFetching(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (isUrl(pastedText)) {
      e.preventDefault();
      setUrlInput(pastedText);
      try {
        setFetching(true);
        setError("");
        const result = await fetchUrl(pastedText.trim());
        setContent(result.content);
        
        if (!name) {
          const extracted = extractNameAndTypeFromUrl(pastedText);
          if (extracted.name) {
            setName(extracted.name);
          }
          if (extracted.type) {
            setFileType(extracted.type);
          }
        }
        
        toast.success("Fetched content from URL");
        setUrlInput("");
      } catch (err) {
        setUrlInput(pastedText);
        setError(err instanceof Error ? err.message : "Failed to fetch URL");
      } finally {
        setFetching(false);
      }
    }
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
          <div className="space-y-2 p-3 rounded-lg border border-dashed">
            <Label className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Import from URL
            </Label>
            <div className="flex gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onPaste={handlePaste}
                placeholder="Paste URL to a .js or .ts file..."
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleFetchUrl}
                disabled={fetching || !urlInput.trim()}
              >
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a URL to automatically fetch plugin content (e.g., raw GitHub URL)
            </p>
          </div>

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
