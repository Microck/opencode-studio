"use client";

import { errorMessage } from "@/lib/error-message.mjs";

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
import { Plus, Alert as AlertIcon, Link, Loader } from "@nsmr/pixelart-react";
import { savePlugin, fetchUrl, addPluginsToConfig } from "@/lib/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

function tryParsePluginConfig(text: string): string[] | null {
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed && Array.isArray(parsed.plugin) && parsed.plugin.every((p: unknown) => typeof p === 'string')) {
      return parsed.plugin;
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

function isNpmAddBoxName(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.includes(' ') || trimmed.includes('\n')) return false;
  // Match: package-name, @scope/package, package@version, @scope/package@version
  return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[^\s]+)?$/i.test(trimmed);
}

interface AddPluginDialogProps {
  onSuccess: () => void;
}

const PLUGIN_TEMPLATES = {
  basic: {
    name: "Basic Plugin",
    description: "Minimal plugin with session.idle event",
    js: `export const MyPlugin = async ({ project, client, $, directory, worktree }) => {
  console.log("Plugin initialized!")

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        console.log("Session completed!")
      }
    },
  }
}
`,
    ts: `import type { Plugin } from "@opencode-ai/plugin"

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
`,
  },
  toolExecute: {
    name: "Tool Execution Hook",
    description: "Run code before/after tool execution",
    js: `export const ToolHookPlugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "tool.execute.before") {
        console.log("Before tool:", event.tool.name, event.tool.input)
        // Modify or validate tool input
        // return { abort: true } to cancel execution
      }
      if (event.type === "tool.execute.after") {
        console.log("After tool:", event.tool.name, event.tool.output)
        // Process or log tool results
      }
    },
  }
}
`,
    ts: `import type { Plugin } from "@opencode-ai/plugin"

export const ToolHookPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "tool.execute.before") {
        console.log("Before tool:", event.tool.name, event.tool.input)
        // Modify or validate tool input
        // return { abort: true } to cancel execution
      }
      if (event.type === "tool.execute.after") {
        console.log("After tool:", event.tool.name, event.tool.output)
        // Process or log tool results
      }
    },
  }
}
`,
  },
  fileWatcher: {
    name: "File Watcher",
    description: "React to file changes",
    js: `export const FileWatcherPlugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "file.edited") {
        console.log("File edited:", event.path)
        // Run linters, formatters, or tests
      }
      if (event.type === "file.created") {
        console.log("File created:", event.path)
      }
      if (event.type === "file.deleted") {
        console.log("File deleted:", event.path)
      }
    },
  }
}
`,
    ts: `import type { Plugin } from "@opencode-ai/plugin"

export const FileWatcherPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "file.edited") {
        console.log("File edited:", event.path)
        // Run linters, formatters, or tests
      }
      if (event.type === "file.created") {
        console.log("File created:", event.path)
      }
      if (event.type === "file.deleted") {
        console.log("File deleted:", event.path)
      }
    },
  }
}
`,
  },
  messageHook: {
    name: "Message Hook",
    description: "Process user/assistant messages",
    js: `export const MessagePlugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "message.user") {
        console.log("User message:", event.content)
        // Preprocess user input
      }
      if (event.type === "message.assistant") {
        console.log("Assistant response:", event.content)
        // Post-process responses
      }
    },
  }
}
`,
    ts: `import type { Plugin } from "@opencode-ai/plugin"

export const MessagePlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "message.user") {
        console.log("User message:", event.content)
        // Preprocess user input
      }
      if (event.type === "message.assistant") {
        console.log("Assistant response:", event.content)
        // Post-process responses
      }
    },
  }
}
`,
  },
  sessionLifecycle: {
    name: "Session Lifecycle",
    description: "Track session start/end events",
    js: `export const SessionPlugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.start") {
        console.log("Session started:", event.sessionId)
        // Initialize resources, start timers
      }
      if (event.type === "session.idle") {
        console.log("Session idle, cleaning up...")
        // Cleanup, save state
      }
      if (event.type === "session.end") {
        console.log("Session ended")
        // Final cleanup
      }
    },
  }
}
`,
    ts: `import type { Plugin } from "@opencode-ai/plugin"

export const SessionPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.start") {
        console.log("Session started:", event.sessionId)
        // Initialize resources, start timers
      }
      if (event.type === "session.idle") {
        console.log("Session idle, cleaning up...")
        // Cleanup, save state
      }
      if (event.type === "session.end") {
        console.log("Session ended")
        // Final cleanup
      }
    },
  }
}
`,
  },
  gitHook: {
    name: "Git Hook",
    description: "React to git operations",
    js: `export const GitPlugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "git.commit.before") {
        console.log("Before commit:", event.message)
        // Run pre-commit checks
        // return { abort: true, reason: "..." } to prevent commit
      }
      if (event.type === "git.commit.after") {
        console.log("Committed:", event.hash)
        // Post-commit actions (e.g., update changelog)
      }
      if (event.type === "git.push.before") {
        console.log("Before push to:", event.remote)
        // Verify before push
      }
    },
  }
}
`,
    ts: `import type { Plugin } from "@opencode-ai/plugin"

export const GitPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "git.commit.before") {
        console.log("Before commit:", event.message)
        // Run pre-commit checks
        // return { abort: true, reason: "..." } to prevent commit
      }
      if (event.type === "git.commit.after") {
        console.log("Committed:", event.hash)
        // Post-commit actions (e.g., update changelog)
      }
      if (event.type === "git.push.before") {
        console.log("Before push to:", event.remote)
        // Verify before push
      }
    },
  }
}
`,
  },
};

type TemplateLock = keyof typeof PLUGIN_TEMPLATES;

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
  const t = useTranslations('dialogs');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fileType, setFileType] = useState<"js" | "ts">("ts");
  const [template, setTemplate] = useState<TemplateLock>("basic");
  const [content, setContent] = useState(PLUGIN_TEMPLATES.basic.ts);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [configImporting, setConfigImporting] = useState(false);

  const resetForm = () => {
    setName("");
    setFileType("ts");
    setTemplate("basic");
    setContent(PLUGIN_TEMPLATES.basic.ts);
    setError("");
    setUrlInput("");
  };

  const handleTypeChange = (type: "js" | "ts") => {
    setFileType(type);
    setContent(PLUGIN_TEMPLATES[template][type]);
  };

  const handleTemplateChange = (newTemplate: TemplateLock) => {
    setTemplate(newTemplate);
    setContent(PLUGIN_TEMPLATES[newTemplate][fileType]);
  };

  const handleConfigPaste = async (plugins: string[]) => {
    try {
      setConfigImporting(true);
      setError("");
      const result = await addPluginsToConfig(plugins);
      
      if (result.added.length > 0) {
        toast.success(t('addPlugin.addedToast', { count: result.added.length }));
      }
      if (result.skipped.length > 0) {
        toast.info(t('addPlugin.skippedToast', { count: result.skipped.length }));
      }
      
      resetForm();
      setOpen(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('addPlugin.errors.addToConfigFailed'));
    } finally {
      setConfigImporting(false);
    }
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    
    const configPlugins = tryParsePluginConfig(urlInput);
    if (configPlugins && configPlugins.length > 0) {
      await handleConfigPaste(configPlugins);
      return;
    }
    
    if (isNpmAddBoxName(urlInput)) {
      await handleConfigPaste([urlInput.trim()]);
      return;
    }
    
    if (!isUrl(urlInput)) {
      setError(t('addPlugin.errors.invalidInput'));
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
      
      toast.success(t('fetchedToast'));
      setUrlInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t('fetchFailed'));
    } finally {
      setFetching(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    
    const configPlugins = tryParsePluginConfig(pastedText);
    if (configPlugins && configPlugins.length > 0) {
      e.preventDefault();
      await handleConfigPaste(configPlugins);
      return;
    }
    
    if (isNpmAddBoxName(pastedText)) {
      e.preventDefault();
      await handleConfigPaste([pastedText.trim()]);
      return;
    }
    
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
        
        toast.success(t('fetchedToast'));
        setUrlInput("");
      } catch (err) {
        setUrlInput(pastedText);
        setError(err instanceof Error ? err.message : t('fetchFailed'));
      } finally {
        setFetching(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError(t('addPlugin.errors.nameRequired'));
      return;
    }

    const ext = `.${fileType}`;
    const fileName = name.endsWith(ext) ? name : `${name}${ext}`;

    if (!/^[a-zA-Z0-9_-]+\.(js|ts)$/.test(fileName)) {
      setError(t('addPlugin.errors.nameFormat'));
      return;
    }

    try {
      setLoading(true);
      await savePlugin(fileName, content);
      toast.success(t('addPlugin.createdToast', { name: fileName }));
      resetForm();
      setOpen(false);
      onSuccess();
    } catch (err: unknown) {
      const msg = errorMessage(err, t('addPlugin.errors.createFailed'));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const computedFileName = name ? (name.endsWith(`.${fileType}`) ? name : `${name}.${fileType}`) : `plugin-name.${fileType}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t('addPlugin.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('addPlugin.title')}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <Alert className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 p-3 rounded-lg border border-dashed">
            <Label className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              {t('importLabel')}
            </Label>
            <div className="flex gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onPaste={handlePaste}
                placeholder={t('addPlugin.importPlaceholder')}
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleFetchUrl}
                disabled={fetching || !urlInput.trim()}
              >
                {fetching ? <Loader className="h-4 w-4 animate-spin" /> : t('fetch')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('addPlugin.importHint')}
            </p>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="plugin-name">{t('addPlugin.nameLabel')}</Label>
              <Input
                id="plugin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('addPlugin.namePlaceholder')}
              />
            </div>
            <div className="w-32 space-y-2">
              <Label>{t('addPlugin.typeLabel')}</Label>
              <Select value={fileType} onValueChange={(v) => handleTypeChange(v as "js" | "ts")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ts">{t('addPlugin.typeScript')}</SelectItem>
                  <SelectItem value="js">{t('addPlugin.javaScript')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('addPlugin.saveAsHint', { fileName: computedFileName })}
          </p>

          <div className="space-y-2">
            <Label>{t('addPlugin.templateLabel')}</Label>
            <Select value={template} onValueChange={(v) => handleTemplateChange(v as TemplateLock)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLUGIN_TEMPLATES).map(([key]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col items-start">
                      <span>{t(`addPlugin.templates.${key}.name`)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t(`addPlugin.templates.${template}.description`)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plugin-content">{t('addPlugin.contentLabel')}</Label>
            <Textarea
              id="plugin-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('addPlugin.creating') : t('addPlugin.createPlugin')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
