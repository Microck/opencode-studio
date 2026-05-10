"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert as AlertIcon, Check, ArrowLeft, Download, Upload, Plus, Reload } from "@nsmr/pixelart-react";
import { toast } from "sonner";
import type {
  ConfigProviderDetail as ProviderDetail,
  ConfigProviderId,
  ConfigProviderDiagnostic,
  ConfigProviderProfile,
} from "@/types";
import {
  getConfigProvider,
  validateConfigProvider,
  saveConfigProvider,
  createConfigProvider,
  importConfigProvider,
  exportConfigProvider,
  getConfigProviderProfiles,
  createConfigProviderProfile,
  switchConfigProviderProfile,
} from "@/lib/api";

function severityVariant(severity: ConfigProviderDiagnostic["severity"]): "destructive" | "secondary" | "default" {
  switch (severity) {
    case "error": return "destructive";
    case "warning": return "secondary";
    default: return "default";
  }
}

function DiagnosticItem({ diagnostic }: { diagnostic: ConfigProviderDiagnostic }) {
  const paths: string[] = [];
  if (diagnostic.path) paths.push(diagnostic.path);
  const details = typeof diagnostic.details === "object" && diagnostic.details !== null ? diagnostic.details as Record<string, unknown> : null;
  if (details?.path) paths.push(details.path as string);
  if (Array.isArray(details?.paths)) paths.push(...(details.paths as string[]));
  if (Array.isArray(details?.expectedPaths)) paths.push(...(details.expectedPaths as string[]));

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

interface ProviderDetailPanelProps {
  providerId: ConfigProviderId;
  onBack: () => void;
  onRefresh: () => void;
}

export function ProviderDetailPanel({ providerId, onBack, onRefresh }: ProviderDetailPanelProps) {
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rawText, setRawText] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ConfigProviderDiagnostic[]>([]);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staleWriteWarning, setStaleWriteWarning] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [createRawText, setCreateRawText] = useState("");

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importDiagnostics, setImportDiagnostics] = useState<ConfigProviderDiagnostic[]>([]);

  const [exporting, setExporting] = useState(false);
  const [profiles, setProfiles] = useState<ConfigProviderProfile[]>([]);
  const [profileDir, setProfileDir] = useState<string | null>(null);
  const [selectedProfilePath, setSelectedProfilePath] = useState("");
  const [switchingProfile, setSwitchingProfile] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileName, setProfileName] = useState("");

  const isOpenAgent = providerId === "oh-my-openagent";

  const loadProfiles = useCallback(async () => {
    if (!isOpenAgent) {
      setProfiles([]);
      setProfileDir(null);
      setSelectedProfilePath("");
      return;
    }

    const result = await getConfigProviderProfiles(providerId);
    setProfiles(result.profiles ?? []);
    setProfileDir(result.profileDir ?? null);
    const activeProfile = result.profiles?.find((profile) => profile.active);
    setSelectedProfilePath(activeProfile?.path ?? result.profiles?.[0]?.path ?? "");
  }, [isOpenAgent, providerId]);

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setStaleWriteWarning(false);
      const result = await getConfigProvider(providerId);
      setDetail(result);
      setRawText(result.raw ?? "");
      setDiagnostics(result.diagnostics ?? []);
      setHasChanges(false);
      await loadProfiles();
    } catch {
      setError("Failed to load provider detail");
    } finally {
      setLoading(false);
    }
  }, [loadProfiles, providerId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleRawChange = (value: string) => {
    setRawText(value);
    setHasChanges(true);
    setStaleWriteWarning(false);
  };

  const hasErrors = diagnostics.some((d) => d.severity === "error");

  const handleValidate = async () => {
    try {
      setValidating(true);
      setDiagnostics([]);
      const result = await validateConfigProvider(providerId, { raw: rawText });
      setDiagnostics(result.diagnostics ?? []);
      if (result.valid) {
        toast.success("Provider config is valid");
      } else {
        toast.error("Provider config has issues");
      }
    } catch (err) {
      const axiosErr = err as { response?: { data?: { diagnostics?: ConfigProviderDiagnostic[]; message?: string } } };
      const backendDiagnostics = axiosErr.response?.data?.diagnostics;
      if (backendDiagnostics) {
        setDiagnostics(backendDiagnostics);
      } else {
        const message = axiosErr.response?.data?.message ?? (err instanceof Error ? err.message : "Validation failed");
        setDiagnostics([{
          severity: "error",
          code: "VALIDATION_ERROR",
          message,
        }]);
      }
      toast.error("Validation failed");
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (hasErrors) return;
    try {
      setSaving(true);
      const result = await saveConfigProvider(providerId, {
        raw: rawText,
        expectedRevision: detail?.revision?.hash ?? undefined,
      });
      setDiagnostics(result.diagnostics ?? []);
      setHasChanges(false);
      setStaleWriteWarning(false);
      toast.success("Provider config saved");
      await loadDetail();
      onRefresh();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { status?: number; data?: unknown } };
        if (axiosErr.response?.status === 409) {
          setStaleWriteWarning(true);
          toast.error("Configuration was modified externally. Reload before retrying.");
          return;
        }
      }
      toast.error("Failed to save provider config");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedPath) {
      toast.error("Select a path before creating");
      return;
    }
    try {
      setSaving(true);
      const result = await createConfigProvider(providerId, { path: selectedPath, raw: createRawText || undefined });
      setDiagnostics(result.diagnostics ?? []);
      setShowCreateDialog(false);
      setCreateRawText("");
      toast.success("Provider config created");
      await loadDetail();
      onRefresh();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 409) {
          setStaleWriteWarning(true);
          toast.error("Configuration was modified externally. Reload before retrying.");
          return;
        }
      }
      toast.error("Failed to create provider config");
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      setImportDiagnostics([]);

      let payload: Record<string, unknown> = { raw: importText };
      try {
        const parsed = JSON.parse(importText);
        if (typeof parsed === "object" && parsed !== null) {
          const p = parsed as Record<string, unknown>;
          const isExportPayload =
            (typeof p.raw === "string" || typeof p.config !== "undefined") &&
            (typeof p.id === "string" || typeof p.providerId === "string") &&
            ("exists" in p || "diagnostics" in p || "revision" in p);
          if (isExportPayload) {
            payload = {};
            if (typeof p.raw === "string") payload.raw = p.raw;
            if (typeof p.id === "string") payload.id = p.id;
            if (typeof p.providerId === "string") payload.providerId = p.providerId;
            if (typeof p.provider === "string") payload.provider = p.provider;
            if (!payload.raw && typeof p.config !== "undefined") {
              payload.raw = JSON.stringify(p.config, null, 2);
            }
          }
        }
      } catch {}

      if (!detail?.exists && !payload.path) {
        payload.path = selectedPath || null;
      }

      const result = await importConfigProvider(providerId, payload as Parameters<typeof importConfigProvider>[1]);
      setImportDiagnostics(result.diagnostics ?? []);
      if (result.success) {
        toast.success("Provider config imported");
        setShowImportDialog(false);
        setImportText("");
        await loadDetail();
        onRefresh();
      } else {
        toast.error("Import completed with issues");
      }
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { status?: number; data?: { diagnostics?: ConfigProviderDiagnostic[] } } };
        if (axiosErr.response?.status === 409) {
          setStaleWriteWarning(true);
          toast.error("Configuration was modified externally. Reload before retrying.");
          return;
        }
        if (axiosErr.response?.data?.diagnostics) {
          setImportDiagnostics(axiosErr.response.data.diagnostics);
          toast.error("Import failed with diagnostics");
          return;
        }
      }
      toast.error("Failed to import provider config");
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const result = await exportConfigProvider(providerId);
      const exportContent = JSON.stringify(result, null, 2);
      const blob = new Blob([exportContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${providerId}-config.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Provider config exported");
    } catch {
      toast.error("Failed to export provider config");
    } finally {
      setExporting(false);
    }
  };

  const handleCreateProfile = async () => {
    try {
      setSaving(true);
      const result = await createConfigProviderProfile(providerId, {
        name: profileName,
        raw: rawText || "{}\n",
      });
      setProfiles(result.profiles ?? []);
      setSelectedProfilePath(result.profile.path);
      setShowProfileDialog(false);
      setProfileName("");
      toast.success("OpenAgent config profile created");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { diagnostics?: ConfigProviderDiagnostic[]; message?: string } } };
      const backendDiagnostics = axiosErr.response?.data?.diagnostics;
      if (backendDiagnostics) setDiagnostics(backendDiagnostics);
      toast.error(axiosErr.response?.data?.message ?? "Failed to create OpenAgent config profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchProfile = async () => {
    if (!selectedProfilePath || hasChanges) return;
    try {
      setSwitchingProfile(true);
      const result = await switchConfigProviderProfile(providerId, { path: selectedProfilePath });
      setProfiles(result.profiles ?? []);
      setDiagnostics(result.diagnostics ?? []);
      toast.success("OpenAgent config switched");
      await loadDetail();
      onRefresh();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { diagnostics?: ConfigProviderDiagnostic[]; message?: string } } };
      const backendDiagnostics = axiosErr.response?.data?.diagnostics;
      if (backendDiagnostics) setDiagnostics(backendDiagnostics);
      toast.error(axiosErr.response?.data?.message ?? "Failed to switch OpenAgent config");
    } finally {
      setSwitchingProfile(false);
    }
  };

  const handleReload = async () => {
    setStaleWriteWarning(false);
    await loadDetail();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" disabled>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="space-y-1">
              <div className="h-5 w-40 bg-muted rounded animate-pulse" />
              <div className="h-3 w-56 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertIcon className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!detail) return null;

  const allDiagnostics = [...diagnostics, ...importDiagnostics];
  const errorCount = allDiagnostics.filter((d) => d.severity === "error").length;
  const warningCount = allDiagnostics.filter((d) => d.severity === "warning").length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack} data-testid="provider-back">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div>
                <CardTitle className="text-base">{detail.displayName}</CardTitle>
                <CardDescription>
                  {detail.activePath ?? "No active configuration"}
                  {detail.revision && ` · revision: ${detail.revision.hash?.slice(0, 8) ?? "none"}`}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exporting || !detail.exists}
                data-testid="provider-export-detail"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowImportDialog(true); setImportDiagnostics([]); }}
                disabled={importing}
                data-testid="provider-import-detail"
              >
                <Upload className="h-4 w-4 mr-1" />
                Import
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {staleWriteWarning && (
            <Alert variant="destructive" data-testid="stale-write-warning">
              <AlertIcon className="h-4 w-4" />
              <AlertDescription>
                This configuration was modified externally. Please reload before retrying.
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleReload}
                  data-testid="stale-write-reload"
                >
                  <Reload className="h-3 w-3 mr-1" />
                  Reload
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {allDiagnostics.length > 0 && (
            <div data-testid="provider-diagnostics" className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">Diagnostics</span>
                {errorCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">{errorCount} error{errorCount > 1 ? "s" : ""}</Badge>
                )}
                {warningCount > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{warningCount} warning{warningCount > 1 ? "s" : ""}</Badge>
                )}
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {allDiagnostics.map((d, i) => (
                  <DiagnosticItem key={i} diagnostic={d} />
                ))}
              </div>
            </div>
          )}

          {isOpenAgent && (
            <div className="space-y-2 rounded-md border border-border p-3" data-testid="openagent-profile-switcher">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">OpenAgent Config Profiles</Label>
                  <p className="text-xs text-muted-foreground">
                    Save named OpenAgent config files and switch the active plugin config by copying one into place.
                    {profileDir && <code className="ml-1 rounded bg-muted px-1 py-0.5 font-mono">{profileDir}</code>}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowProfileDialog(true); setProfileName(""); }}
                  data-testid="openagent-profile-create"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Save as Profile
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={selectedProfilePath} onValueChange={setSelectedProfilePath} disabled={profiles.length === 0}>
                  <SelectTrigger data-testid="openagent-profile-select">
                    <SelectValue placeholder="No saved profiles" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.path} value={profile.path}>
                        {profile.name}{profile.active ? " (active)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={handleSwitchProfile}
                  disabled={!selectedProfilePath || hasChanges || switchingProfile}
                  data-testid="openagent-profile-switch"
                >
                  {switchingProfile ? "Switching..." : "Switch Active Config"}
                </Button>
              </div>
              {hasChanges && (
                <p className="text-xs text-muted-foreground">Save or reload the current edits before switching profiles.</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Raw Configuration</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleValidate}
                  disabled={validating}
                  data-testid="provider-validate"
                >
                  {validating ? "Validating..." : "Validate"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !hasChanges || hasErrors || staleWriteWarning}
                  data-testid="provider-save"
                >
                  {saving ? "Saving..." : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
            <Textarea
              value={rawText}
              onChange={(e) => handleRawChange(e.target.value)}
              className="font-mono text-sm min-h-[300px] resize-y"
              spellCheck={false}
              data-testid="provider-editor"
              placeholder="{}"
            />
          </div>

          {!detail.exists && detail.capabilities.canCreate && (
            <Alert>
              <AlertIcon className="h-4 w-4" />
              <AlertDescription className="text-sm">
                No configuration file exists yet.
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => { setShowCreateDialog(true); setSelectedPath(""); setCreateRawText(""); }}
                  data-testid="provider-create-from-detail"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create Configuration
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create {detail.displayName} Configuration</DialogTitle>
            <DialogDescription>
              Choose a path for the new configuration file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Configuration Path</Label>
              <Select value={selectedPath} onValueChange={setSelectedPath}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a path" />
                </SelectTrigger>
                <SelectContent>
                  {detail.paths.map((path) => (
                    <SelectItem key={path} value={path}>
                      {path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Initial Content (optional)</Label>
              <Textarea
                value={createRawText}
                onChange={(e) => setCreateRawText(e.target.value)}
                className="font-mono text-sm min-h-[150px] resize-y"
                spellCheck={false}
                placeholder="{}"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!selectedPath || saving}
              data-testid="provider-create-confirm"
            >
              {saving ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import {detail.displayName} Configuration</DialogTitle>
            <DialogDescription>
              Paste the JSON configuration to import. Imports are same-provider only. You cannot import an export from a different provider into this one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!detail.exists && (
              <div className="space-y-2">
                <Label>Target Path (required when no active config exists)</Label>
                <Select value={selectedPath} onValueChange={setSelectedPath} data-testid="import-path-select">
                  <SelectTrigger>
                    <SelectValue placeholder="Select a path" />
                  </SelectTrigger>
                  <SelectContent>
                    {detail.paths.map((path) => (
                      <SelectItem key={path} value={path}>
                        {path}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Textarea
              value={importText}
              onChange={(e) => { setImportText(e.target.value); setImportDiagnostics([]); }}
              className="font-mono text-sm min-h-[200px] resize-y"
              spellCheck={false}
              placeholder='{"key": "value"}'
              data-testid="import-editor"
            />
            {importDiagnostics.length > 0 && (
              <div data-testid="import-diagnostics" className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Import Diagnostics</span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {importDiagnostics.map((d, i) => (
                    <DiagnosticItem key={i} diagnostic={d} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importText.trim() || importing || (!detail.exists && !selectedPath)}
              data-testid="provider-import-confirm"
            >
              {importing ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save OpenAgent Config Profile</DialogTitle>
            <DialogDescription>
              Create a named copy from the current editor content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Profile Name</Label>
            <Input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              placeholder="work, personal, experimental"
              data-testid="openagent-profile-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProfile}
              disabled={!profileName.trim() || saving}
              data-testid="openagent-profile-create-confirm"
            >
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
