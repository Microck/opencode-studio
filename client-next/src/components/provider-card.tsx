"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert as AlertIcon, Check, File, Shield, Sliders } from "@nsmr/pixelart-react";
import type { ConfigProviderSummary, ConfigProviderDetail, ConfigProviderId, ConfigProviderDiagnostic } from "@/types";

interface ProviderCardProps {
  provider: ConfigProviderSummary | ConfigProviderDetail;
  onSelect?: () => void;
}

const PROVIDER_ICONS: Record<ConfigProviderId, typeof File> = {
  opencode: File,
  "oh-my-openagent": Shield,
  "oh-my-opencode-slim": Sliders,
};

const PROVIDER_DESCRIPTIONS: Record<ConfigProviderId, string> = {
  opencode: "Standard OpenCode configuration file",
  "oh-my-openagent": "OpenAgent plugin config. Legacy oh-my-opencode names are preserved and not auto-migrated.",
  "oh-my-opencode-slim": "Slim configuration. Validates tui.json as a companion file.",
};

function severityVariant(severity: ConfigProviderDiagnostic["severity"]): "destructive" | "secondary" | "default" {
  switch (severity) {
    case "error":
      return "destructive";
    case "warning":
      return "secondary";
    case "info":
    default:
      return "default";
  }
}

function collectPaths(diagnostic: ConfigProviderDiagnostic): string[] {
  const paths: string[] = [];
  if (diagnostic.path) paths.push(diagnostic.path);
  const details = typeof diagnostic.details === "object" && diagnostic.details !== null ? diagnostic.details : null;
  if (details?.path) paths.push(details.path);
  if (Array.isArray(details?.paths)) paths.push(...details.paths);
  if (Array.isArray(details?.expectedPaths)) paths.push(...details.expectedPaths);
  return [...new Set(paths)];
}

function DiagnosticItem({ diagnostic }: { diagnostic: ConfigProviderDiagnostic }) {
  const paths = collectPaths(diagnostic);
  return (
    <Alert variant={diagnostic.severity === "error" ? "destructive" : undefined} className="py-2 px-3">
      <AlertIcon className="h-3 w-3" />
      <AlertDescription className="text-xs">
        <Badge variant={severityVariant(diagnostic.severity)} className="mr-2 text-[10px]">
          {diagnostic.severity}
        </Badge>
        {diagnostic.message}
        {paths.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {paths.map((p, i) => (
              <code key={i} className="block text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded truncate">{p}</code>
            ))}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

function CapabilityBadge({ label, available }: { label: string; available: boolean }) {
  return (
    <Badge variant={available ? "outline" : "secondary"} className="text-[10px]">
      {available ? <Check className="h-3 w-3 mr-1" /> : null}
      {label}
    </Badge>
  );
}

export function ProviderCard({ provider, onSelect }: ProviderCardProps) {
  const isSlim = provider.id === "oh-my-opencode-slim";
  const Icon = PROVIDER_ICONS[provider.id] ?? File;
  const diagnostics = provider.diagnostics ?? [];
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
  const caps = provider.capabilities;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onSelect && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <Card
      data-testid={`provider-card-${provider.id}`}
      className={[
        provider.exists ? "border-primary/30" : "opacity-70",
        onSelect && "cursor-pointer transition-colors hover:bg-accent/50 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      ].filter(Boolean).join(" ")}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">{provider.displayName}</CardTitle>
              <CardDescription>{PROVIDER_DESCRIPTIONS[provider.id]}</CardDescription>
            </div>
          </div>
          <Badge variant={provider.exists ? "default" : "secondary"}>
            {provider.exists ? "detected" : "not found"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Active path</span>
          {provider.activePath ? (
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3 text-green-500" />
              <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{provider.activePath}</code>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No active configuration file</span>
          )}
        </div>

        {diagnostics.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Diagnostics</span>
              {errorCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">{errorCount} error{errorCount > 1 ? "s" : ""}</Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">{warningCount} warning{warningCount > 1 ? "" : ""}</Badge>
              )}
            </div>
            <div className="space-y-1">
              {diagnostics.map((d, i) => (
                <DiagnosticItem key={i} diagnostic={d} />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Capabilities</span>
          <div className="flex flex-wrap gap-1">
            <CapabilityBadge label="detect" available={caps.canDetect} />
            <CapabilityBadge label="load" available={caps.canLoad} />
            <CapabilityBadge label="validate" available={caps.canValidate} />
            <CapabilityBadge label="save" available={caps.canSave} />
            <CapabilityBadge label="create" available={caps.canCreate} />
            <CapabilityBadge label="import" available={caps.canImportConfig} />
            <CapabilityBadge label="export" available={caps.canExportConfig} />
          </div>
        </div>

        {isSlim && (
          <Alert className="py-2 px-3">
            <File className="h-3 w-3" />
            <AlertDescription className="text-xs">
              Live runtime preset orchestration is not supported for Slim. Configuration is file-only. Slim validates tui.json as a companion file.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export function ProviderCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <div className="flex gap-1">
            <Skeleton className="h-5 w-14 rounded" />
            <Skeleton className="h-5 w-14 rounded" />
            <Skeleton className="h-5 w-14 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
