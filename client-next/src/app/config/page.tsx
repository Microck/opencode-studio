"use client";

import { CliConfigEditor } from "@/components/cli-config-editor";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/lib/context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Undo, Alert as AlertIcon, Check } from "@nsmr/pixelart-react";
import { PageHelp } from "@/components/page-help";
import { toast } from "sonner";
import { getConfigProviders } from "@/lib/api";
import type { ConfigProviderSummary, ConfigProviderId } from "@/types";
import { ProviderCard, ProviderCardSkeleton } from "@/components/provider-card";
import { ProviderDetailPanel } from "@/components/provider-detail";

function ProvidersTab() {
  const [providers, setProviders] = useState<ConfigProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<ConfigProviderId | null>(null);

  const loadProviders = useCallback(() => getConfigProviders().then(result => {
    setProviders(result);
    setError("");
  }).catch(() => setError("Failed to load providers"))
    .finally(() => setLoading(false)), []);

  useEffect(() => { void loadProviders(); }, [loadProviders]);

  const handleBack = () => {
    setSelectedProvider(null);
  };

  const handleRefresh = () => {
    setLoading(true);
    void loadProviders();
  };

  if (selectedProvider) {
    return (
      <ProviderDetailPanel
        providerId={selectedProvider}
        onBack={handleBack}
        onRefresh={handleRefresh}
      />
    );
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ProviderCardSkeleton />
        <ProviderCardSkeleton />
        <ProviderCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertIcon className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            onSelect={() => setSelectedProvider(provider.id)}
          />
        ))}
      </div>

      <Alert className="py-3 px-4">
        <AlertIcon className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Each provider manages its own config file. Import and export only work within the same provider.
          OpenAgent keeps legacy oh-my-opencode naming without automatic migration.
          Slim validates tui.json as a companion file.
          Remote shell install and sync are not available.
          <span className="block mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            <a
              href="https://github.com/code-yeongyu/oh-my-openagent"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              OpenAgent upstream
            </a>
            <a
              href="https://github.com/alvinunreal/oh-my-opencode-slim"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              Slim upstream
            </a>
          </span>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default function ConfigPage() {
  const t = useTranslations('config');
  const { config, loading, saveConfig } = useApp();
  const [draft, setDraft] = useState<string | null>(null);
  const content = draft ?? (config ? JSON.stringify(config, null, 2) : "");
  const hasChanges = draft !== null;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const handleChange = (value: string) => {
    setDraft(value);
    setError("");
  };

  const validateJson = (): boolean => {
    try {
      JSON.parse(content);
      return true;
    } catch (e) {
      setError(t('invalidJson', { error: (e as Error).message }));
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateJson()) return;

    try {
      setSaving(true);
      const parsed = JSON.parse(content);
      await saveConfig(parsed);
      toast.success(t('saved'));
      setDraft(current => current === content ? null : current);
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (config) {
      setDraft(null);
      setError("");
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(content);
      setDraft(JSON.stringify(parsed, null, 2));
      setError("");
    } catch (e) {
      setError(t('cannotFormat', { error: (e as Error).message }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHelp title={t('title')} docUrl="https://opencode.ai/docs" docTitle={t('docTitle')} />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHelp title={t('title')} docUrl="https://opencode.ai/docs" docTitle={t('docTitle')} />

      <Tabs defaultValue="providers">
        <TabsList className="w-fit">
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="raw">Raw Config</TabsTrigger>
          <TabsTrigger value="cli">v2 CLI</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="mt-4">
          <ProvidersTab />
        </TabsContent>

        <TabsContent value="cli" className="mt-4"><CliConfigEditor /></TabsContent>

        <TabsContent value="raw" className="mt-4">
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-base">
              {t('fileName')}
              {hasChanges && <span className="text-xs text-orange-500">{t('unsavedChanges')}</span>}
              {!hasChanges && !error && <Check className="h-4 w-4 text-green-500" />}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleFormat}>
                {t('format')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
                <Undo className="h-4 w-4 mr-2" />
                {t('reset')}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
                {saving ? (
                  t('saving')
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('save')}
                  </>
                )}
              </Button>
            </div>
          </div>

          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardDescription>
                {t('description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertIcon className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Textarea
                aria-label={t('fileName')}
                value={content}
                onChange={(e) => handleChange(e.target.value)}
                className="font-mono text-sm min-h-[500px] resize-y"
                spellCheck={false}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
