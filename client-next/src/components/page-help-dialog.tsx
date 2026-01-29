import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoBox } from "@nsmr/pixelart-react";
import type { PageHelpDialogProps } from "@/components/page-help";

const helpContent: Record<string, { title: string; description: string; usage: string; tips?: string[] }> = {
  agents: {
    title: "Agents",
    description: "Create and manage custom AI agents that can perform specific tasks with defined tools and permissions.",
    usage: "Use the Agent Builder to configure identity, behavior, and capabilities. Toggle agents on/off as needed.",
    tips: ["Agents run as subagents or primary modes", "Define tool permissions for security", "Write markdown-based agents for reusability"]
  },
  mcp: {
    title: "MCP Servers",
    description: "Model Context Protocol (MCP) servers extend AI capabilities with external tools and data sources.",
    usage: "Toggle servers on/off, add new ones by pasting npx commands, delete unused configs.",
    tips: ["MCP servers provide file system access, web browsing, and more", "Only enabled servers are active in AI sessions"]
  },
  skills: {
    title: "Skills",
    description: "Reusable prompt templates that guide AI behavior for specific tasks or domains.",
    usage: "Browse existing skills, create new ones from templates, or bulk import from GitHub URLs.",
    tips: ["Skills are stored as markdown files in ~/.config/opencode/skill/", "Use descriptive titles for better agent selection"]
  },
  plugins: {
    title: "Plugins",
    description: "JavaScript/TypeScript extensions that add custom tools, watchers, and lifecycle hooks to OpenCode.",
    usage: "Create plugins from templates or import existing ones. Plugins can modify files, run commands, and monitor changes.",
    tips: ["Plugins run in Node.js with full filesystem access", "Use lifecycle hooks to respond to events"]
  },
  commands: {
    title: "Commands",
    description: "Custom slash commands that create reusable prompt templates with argument placeholders.",
    usage: "Create commands with $ARGUMENTS placeholder. Use /your-command in OpenCode CLI.",
    tips: ["Commands are perfect for repetitive tasks", "Use clear, concise prompt templates"]
  },
  auth: {
    title: "Authentication",
    description: "Manage API credentials for cloud providers like Anthropic, OpenAI, Google, and GitHub.",
    usage: "Login to providers via OAuth or API keys. Save profiles to switch between accounts easily.",
    tips: ["Profiles isolate credentials per account", "OAuth tokens auto-refresh for supported providers"]
  },
  settings: {
    title: "Settings",
    description: "Configure global OpenCode behavior, model aliases, permissions, and system prompts.",
    usage: "Expand sections to modify configuration. Changes apply immediately to AI sessions.",
    tips: ["System prompt affects all agent conversations", "Permission patterns control tool access"]
  },
  profiles: {
    title: "Profiles",
    description: "Isolated OpenCode environments with separate configs, history, and session memory.",
    usage: "Create new profiles for different projects or contexts. Switch instantly to change entire configuration.",
    tips: ["Each profile has its own opencode.json", "Useful for separating work/personal projects"]
  },
  quickstart: {
    title: "Quickstart",
    description: "Interactive setup wizard to configure OpenCode for first-time users.",
    usage: "Follow step-by-step setup to configure auth, MCP, skills, and essential settings.",
    tips: ["Recommended for new OpenCode installations", "Creates basic configuration automatically"]
  },
  usage: {
    title: "Token Usage",
    description: "Dashboard showing token consumption, costs, and model breakdown across your AI sessions.",
    usage: "View charts and tables to track spending. Filter by date range, project, or model.",
    tips: ["Costs estimated based on model pricing", "Export logs for detailed analysis"]
  },
  logs: {
    title: "Live Logs",
    description: "Real-time viewer for OpenCode debug logs with filtering capabilities.",
    usage: "Stream logs live, pause/resume, filter by type (MCP, Agent, Error). Useful for debugging.",
    tips: ["Errors highlighted in red", "Use filters to focus on specific events"]
  },
  rules: {
    title: "Project Rules",
    description: "Configure AI behavior with project-specific instructions stored in AGENTS.md or CLAUDE.md.",
    usage: "Edit rules files directly or use templates. Rules apply to all AI agents in the project.",
    tips: ["AGENTS.md is recommended for project documentation", "Rules override default agent behavior"]
  },
  config: {
    title: "Raw Config",
    description: "Direct editor for opencode.json - the core OpenCode configuration file.",
    usage: "Edit JSON directly. Validated before saving. Use for advanced configuration not available in UI.",
    tips: ["JSON syntax errors prevent saving", "Use Format button to prettify JSON"]
  },
  editor: {
    title: "Editor",
    description: "Shared editor for creating and modifying skills, plugins, and commands.",
    usage: "Use Monaco editor with syntax highlighting. Save creates or updates the file.",
    tips: ["Skills require descriptions", "Plugins can use hooks and watchers", "Commands use $ARGUMENTS placeholder"]
  }
};

export function PageHelpDialog({ open, onOpenChange, page }: PageHelpDialogProps) {
  const content = helpContent[page] || {
    title: page,
    description: "No help content available.",
    usage: "",
    tips: []
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <InfoBox className="h-5 w-5 text-primary" />
            {content.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">What is this?</h3>
            <p className="text-sm text-muted-foreground">{content.description}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">How to use</h3>
            <p className="text-sm text-muted-foreground">{content.usage}</p>
          </div>

          {content.tips && content.tips.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Tips</h3>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                {content.tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="pt-2 border-t">
            <a 
              href={`https://opencode.ai/docs/${page.toLowerCase().replace(/\s+/g, '-')}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View full documentation →
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
