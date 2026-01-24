"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  Server,
  MoonStars,
  Zap,
  AddBox,
  ExternalLink,
  Copy,
  Check,
  Forward,
  Alert,
  Undo,
  Circle,
  CheckDouble,
} from "@nsmr/pixelart-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Types ---

interface Step {
  id: string;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  content: React.ReactNode;
}

// --- Helper Components ---

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group mt-2 mb-4 min-w-0">
      <div className="overflow-x-auto">
        <pre className="bg-background border border-border/50 rounded-md p-4 text-sm font-mono whitespace-pre w-fit min-w-full">
          <code>{code}</code>
        </pre>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function ExternalLinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <ExternalLink className="ml-2 h-3 w-3" />
      </a>
    </Button>
  );
}

// --- Main Page Component ---

export default function QuickstartPage() {
  const [mounted, setMounted] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    ohmyopencode: true,
    superpowers: false,
    starterkit: false,
  });
  
  type Provider = "github-copilot" | "anthropic" | "openai" | "google" | "opencode";
  const [providerChoices, setProviderChoices] = useState<{
    claude: Provider;
    gpt: Provider;
    gemini: Provider;
    grok: Provider;
  }>({
    claude: "github-copilot",
    gpt: "github-copilot",
    gemini: "github-copilot",
    grok: "github-copilot",
  });

  const setProvider = (key: keyof typeof providerChoices, value: Provider) => {
    setProviderChoices(prev => ({ ...prev, [key]: value }));
  };

  const ohmyopencodeConfig = useMemo(() => {
    const claudePrefix = providerChoices.claude === "github-copilot" ? "github-copilot/" : "anthropic/";
    const gptPrefix = providerChoices.gpt === "github-copilot" ? "github-copilot/" : "openai/";
    const geminiPrefix = providerChoices.gemini === "github-copilot" ? "github-copilot/" : "google/";
    const grokPrefix = providerChoices.grok === "github-copilot" ? "github-copilot/" : "opencode/";
    
    const geminiModel = providerChoices.gemini === "github-copilot" ? "gemini-3-pro-preview" : "gemini-3-pro-high";
    const geminiFlash = providerChoices.gemini === "github-copilot" ? "gemini-3-flash-preview" : "gemini-3-flash";
    const multimodalModel = providerChoices.gemini === "github-copilot" ? "gemini-3-flash-preview" : "gemini-3-flash";
    const grokModel = providerChoices.grok === "github-copilot" ? "grok-code-fast-1" : "grok-code";
    
    return JSON.stringify({
      agents: {
        "Sisyphus": { model: `${claudePrefix}claude-opus-4.5` },
        "oracle": { model: `${gptPrefix}gpt-5.2` },
        "librarian": { model: `${claudePrefix}claude-sonnet-4.5` },
        "frontend-ui-ux-engineer": { model: `${geminiPrefix}${geminiModel}` },
        "document-writer": { model: `${geminiPrefix}${geminiFlash}` },
        "multimodal-looker": { model: `${geminiPrefix}${multimodalModel}` },
        "explore": { model: `${grokPrefix}${grokModel}` }
      }
    }, null, 2);
  }, [providerChoices]);

  const hasDirectProvider = providerChoices.claude === "anthropic" || 
    providerChoices.gpt === "openai" || 
    providerChoices.gemini === "google" ||
    providerChoices.grok === "opencode";

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("opencode-quickstart-progress");
    if (saved) {
      try {
        setCompletedSteps(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("opencode-quickstart-progress", JSON.stringify(completedSteps));
    }
  }, [completedSteps, mounted]);

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const markStepComplete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (completedSteps.includes(id)) {
      setCompletedSteps(prev => prev.filter(s => s !== id));
      toast.info("Step marked incomplete");
    } else {
      setCompletedSteps(prev => [...prev, id]);
      toast.success("Step completed!");
      // Auto-open next step
      const stepIds = ["ohmyopencode", "superpowers", "starterkit"];
      const idx = stepIds.indexOf(id);
      if (idx < stepIds.length - 1) {
        const nextId = stepIds[idx + 1];
        setOpenSections(prev => ({ ...prev, [id]: false, [nextId]: true }));
      }
    }
  };

  const resetProgress = () => {
    setCompletedSteps([]);
    setOpenSections({ ohmyopencode: true, superpowers: false, starterkit: false });
    localStorage.removeItem("opencode-quickstart-progress");
    toast.success("Progress reset");
  };

  const steps: Step[] = [
    {
      id: "ohmyopencode",
      title: "Oh My OpenCode",
      description: "Enhanced agent framework with personas",
      badge: "Recommended",
      badgeVariant: "secondary",
      content: (
        <div className="space-y-4">
          <ExternalLinkButton href="https://github.com/code-yeongyu/oh-my-opencode">
            GitHub
          </ExternalLinkButton>

          <div>
            <p className="text-sm text-muted-foreground mb-1">
              Paste this in a fresh OpenCode session:
            </p>
            <CodeBlock code="Install and configure by following the instructions here https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/refs/heads/master/README.md" />
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
            <Alert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Don't edit <code className="bg-background px-1 rounded text-xs">opencode.json</code> manually. 
              Use the configs in Step 3.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "superpowers",
      title: "Superpowers",
      description: "Advanced skills and workflows",
      badge: "Recommended",
      badgeVariant: "secondary",
      content: (
        <div className="space-y-4">
          <ExternalLinkButton href="https://github.com/obra/superpowers">
            GitHub
          </ExternalLinkButton>

          <div>
            <p className="text-sm text-muted-foreground mb-1">
              Run inside OpenCode:
            </p>
            <CodeBlock code="Fetch and follow instructions from https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.opencode/INSTALL.md" />
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
            <Alert className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-600 dark:text-blue-400">
              If you see <code className="bg-muted px-1 rounded text-xs">Module not found: lib/skills-core.js</code>,
              the starter configs in Step 3 should fix it.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "starterkit",
      title: "Apply MoonStarter Configs",
      description: "Copy safe pre-configured files",
      badge: "Critical",
      badgeVariant: "destructive",
      content: (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">1. Find your config folder:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-xs">Windows</Badge>
                <code className="bg-muted px-2 py-0.5 rounded text-xs">C:\Users\YOU\.config\opencode\</code>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-xs">Mac/Linux</Badge>
                <code className="bg-muted px-2 py-0.5 rounded text-xs">~/.config/opencode/</code>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">2. Back up existing files</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">3. Create these files:</p>
            
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">opencode.json</p>
                <CodeBlock code={`{
  "plugin": [
    "oh-my-opencode"
  ]
}`} />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">oh-my-opencode.json</p>
                </div>
                
                <div className="space-y-3 mb-3 p-3 bg-background rounded-md border">
                  <p className="text-xs font-medium">Choose provider per model family:</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Claude (Anthropic)</Label>
                      <Select value={providerChoices.claude} onValueChange={(v) => setProvider("claude", v as Provider)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="github-copilot">GitHub Copilot</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">GPT (OpenAI)</Label>
                      <Select value={providerChoices.gpt} onValueChange={(v) => setProvider("gpt", v as Provider)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="github-copilot">GitHub Copilot</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Gemini (Google)</Label>
                      <Select value={providerChoices.gemini} onValueChange={(v) => setProvider("gemini", v as Provider)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="github-copilot">GitHub Copilot</SelectItem>
                          <SelectItem value="google">Google</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Grok (xAI)</Label>
                      <Select value={providerChoices.grok} onValueChange={(v) => setProvider("grok", v as Provider)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="github-copilot">GitHub Copilot</SelectItem>
                          <SelectItem value="opencode">OpenCode (free)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <CodeBlock code={ohmyopencodeConfig} />
                
                {hasDirectProvider && (
                  <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md mt-2">
                    <Alert className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Direct providers require authentication. Run <code className="bg-background px-1 rounded">opencode auth login</code> and select your provider.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">4. Restart OpenCode</p>
          </div>
        </div>
      ),
    },
  ];

  const progressPercentage = Math.round((completedSteps.length / steps.length) * 100);

  if (!mounted) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4 mx-auto" style={{ maxWidth: "727px" }}>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-background to-primary/10 border p-6 md:p-8">
        <Forward className="absolute -right-8 -top-8 h-40 w-40 opacity-5 rotate-12" />
        
        <div className="relative space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Quickstart</h1>
            <Button variant="ghost" size="sm" onClick={resetProgress} className="text-muted-foreground">
              <Undo className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
          <p className="text-muted-foreground">
            Set up OpenCode with enhanced agents and skills.
          </p>
          
          {/* Progress */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500 rounded-full" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="text-sm font-medium tabular-nums">{completedSteps.length}/{steps.length}</span>
          </div>
        </div>
      </div>

      {/* Steps - Using same pattern as CreditCardSettings page */}
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isOpen = openSections[step.id];
        
        return (
          <Collapsible
            key={step.id}
            open={isOpen}
            onOpenChange={() => toggleSection(step.id)}
          >
            <Card className={cn(isCompleted && "border-primary/30 bg-primary/5")}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Step number / completion indicator */}
                      <button
                        onClick={(e) => markStepComplete(step.id, e)}
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
                          isCompleted 
                            ? "bg-primary text-primary-foreground hover:bg-primary/80" 
                            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        )}
                        title={isCompleted ? "Mark incomplete" : "Mark complete"}
                      >
                        {isCompleted ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span className="text-sm font-medium">{index + 1}</span>
                        )}
                      </button>
                      <div className="flex items-center gap-2">
                        <CardTitle className={cn(
                          "text-base",
                          isCompleted && "line-through text-muted-foreground"
                        )}>
                          {step.title}
                        </CardTitle>
                        {step.badge && (
                          <Badge variant={step.badgeVariant} className="text-xs">
                            {step.badge}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      "h-5 w-5 text-muted-foreground transition-transform",
                      isOpen && "rotate-180"
                    )} />
                  </div>
                  <CardDescription className="ml-11">{step.description}</CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0 border-t">
                  <div className="pt-4">
                    {step.content}
                  </div>
                  
                  {/* Mark Complete Button */}
                  <div className="mt-6 pt-4 border-t flex justify-end">
                    <Button
                      variant={isCompleted ? "outline" : "default"}
                      size="sm"
                      onClick={(e) => markStepComplete(step.id, e)}
                    >
                      {isCompleted ? (
                        <>
                          <Circle className="h-4 w-4 mr-2" />
                          Mark Incomplete
                        </>
                      ) : (
                        <>
                          <CheckDouble className="h-4 w-4 mr-2" />
                          Mark Complete
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* What's Included */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            What You Get
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Server className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Stability Fixes</p>
                <p className="text-xs text-muted-foreground">Windows crash & module errors solved</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AddBox className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">MCP Tools</p>
                <p className="text-xs text-muted-foreground">Shadcn, Supabase, web search</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MoonStars className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Specialized Agents</p>
                <p className="text-xs text-muted-foreground">Oracle, Sisyphus, Librarian & more</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Superpowers Skills</p>
                <p className="text-xs text-muted-foreground">TDD, debugging, planning workflows</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
