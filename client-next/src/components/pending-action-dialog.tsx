"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context";
import { fetchUrl, type PendingAction } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { WarningBox, Server, Gamepad, Code, Loader } from "@nsmr/pixelart-react";
import { toast } from "sonner";

interface PendingActionDialogProps {
  action: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
}

function InstallMCPContent({ action }: { action: PendingAction }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Server className="h-5 w-5 text-primary" />
        <span className="font-medium">{action.name || "MCP Server"}</span>
      </div>
      
      {action.command && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Command:</p>
          <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {action.command}
          </pre>
        </div>
      )}
      
      {action.env && Object.keys(action.env).length > 0 && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Environment Variables:</p>
          <div className="bg-muted p-3 rounded-md space-y-1">
            {Object.entries(action.env).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-xs font-mono">
                <span className="text-primary">{key}</span>
                <span className="text-muted-foreground">=</span>
                <span className="text-foreground break-all">{value || "(to be set)"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
        <WarningBox className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-600 dark:text-amber-400">
          This will add an MCP server to your OpenCode configuration. Only proceed if you trust the source.
        </p>
      </div>
    </div>
  );
}

function ImportSkillContent({ action }: { action: PendingAction }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gamepad className="h-5 w-5 text-primary" />
        <span className="font-medium">{action.name || "Skill"}</span>
      </div>
      
      {action.url && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Source URL:</p>
          <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {action.url}
          </pre>
        </div>
      )}
      
      <p className="text-sm text-muted-foreground">
        This will fetch and import a skill from the URL above.
      </p>
    </div>
  );
}

function ImportPluginContent({ action }: { action: PendingAction }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Code className="h-5 w-5 text-primary" />
        <span className="font-medium">{action.name || "Plugin"}</span>
      </div>
      
      {action.url && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Source URL:</p>
          <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {action.url}
          </pre>
        </div>
      )}
      
      <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
        <WarningBox className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Plugins can execute code. Only import from trusted sources.
        </p>
      </div>
    </div>
  );
}

function PendingActionDialogInner({ action, onConfirm, onCancel }: PendingActionDialogProps) {
  const [loading, setLoading] = useState(false);

  const titles: Record<PendingAction["type"], string> = {
    "install-mcp": "Install MCP Server?",
    "import-skill": "Import Skill?",
    "import-plugin": "Import Plugin?",
  };

  const descriptions: Record<PendingAction["type"], string> = {
    "install-mcp": "An external link is requesting to add an MCP server.",
    "import-skill": "An external link is requesting to import a skill.",
    "import-plugin": "An external link is requesting to import a plugin.",
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={true}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">External Request</Badge>
            {titles[action.type]}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {descriptions[action.type]}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-2">
          {action.type === "install-mcp" && <InstallMCPContent action={action} />}
          {action.type === "import-skill" && <ImportSkillContent action={action} />}
          {action.type === "import-plugin" && <ImportPluginContent action={action} />}
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={loading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              action.type === "install-mcp" ? "Install" : "Import"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PendingActionDialog() {
  const router = useRouter();
  const { pendingAction, dismissPendingAction, addMCP, refreshData } = useApp();

  if (!pendingAction) return null;

  const handleConfirm = async () => {
    try {
      switch (pendingAction.type) {
        case "install-mcp": {
          if (pendingAction.command) {
            const parts = pendingAction.command.trim().split(/\s+/);
            const mcpConfig = {
              command: [parts[0]],
              args: parts.slice(1),
              enabled: true,
              type: 'local' as const,
              env: pendingAction.env,
            };
            const name = pendingAction.name || `mcp-${Date.now()}`;
            await addMCP(name, mcpConfig);
            toast.success(`Added MCP server: ${name}`);
            router.push("/mcp");
          }
          break;
        }
        
        case "import-skill": {
          if (pendingAction.url) {
            const result = await fetchUrl(pendingAction.url);
            const pathParts = new URL(pendingAction.url).pathname.split('/').filter(Boolean);
            let skillName = pendingAction.name;
            if (!skillName) {
              const filenameIdx = pathParts.length - 1;
              if (pathParts[filenameIdx]?.toLowerCase() === 'skill.md' && filenameIdx > 0) {
                skillName = pathParts[filenameIdx - 1];
              } else {
                skillName = result.filename.replace(/\.(md)$/i, '').toLowerCase();
              }
            }
            
            const { saveSkill } = await import("@/lib/api");
            const frontmatterMatch = result.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            let description = "";
            let body = result.content;
            if (frontmatterMatch) {
              const frontmatter = frontmatterMatch[1];
              const descMatch = frontmatter.match(/description:\s*(.+)/);
              if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, '');
              body = result.content.slice(frontmatterMatch[0].length).trim();
            }
            
            await saveSkill(skillName, description, body);
            await refreshData();
            toast.success(`Imported skill: ${skillName}`);
            router.push("/skills");
          }
          break;
        }
        
        case "import-plugin": {
          if (pendingAction.url) {
            const result = await fetchUrl(pendingAction.url);
            const pluginName = pendingAction.name || result.filename;
            
            const { savePlugin } = await import("@/lib/api");
            await savePlugin(pluginName, result.content);
            await refreshData();
            toast.success(`Imported plugin: ${pluginName}`);
            router.push("/plugins");
          }
          break;
        }
      }
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      await dismissPendingAction();
    }
  };

  const handleCancel = async () => {
    await dismissPendingAction();
    toast.info("Action cancelled");
  };

  return (
    <PendingActionDialogInner
      action={pendingAction}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
