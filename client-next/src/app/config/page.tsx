"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/lib/context";
import { getConfig } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Undo, Alert as AlertIcon, Check } from "@nsmr/pixelart-react";
import { PageHelp } from "@/components/page-help";
import { toast } from "sonner";

export default function ConfigPage() {
  const t = useTranslations('config');
  const { config: contextConfig, saveConfig } = useApp();
  const [config, setConfig] = useState<any | null>(contextConfig);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (contextConfig) setConfig(contextConfig);
  }, [contextConfig]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await getConfig();
        setConfig(cfg);
      } catch {}
      setLoading(false);
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (config) {
      const formatted = JSON.stringify(config, null, 2);
      setContent(formatted);
      setHasChanges(false);
    }
  }, [config]);

  const handleChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
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
      setConfig(parsed);
      toast.success(t('saved'));
      setHasChanges(false);
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (config) {
      setContent(JSON.stringify(config, null, 2));
      setHasChanges(false);
      setError("");
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(content);
      setContent(JSON.stringify(parsed, null, 2));
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
      <div className="flex justify-between items-center">
        <PageHelp title={t('title')} docUrl="https://opencode.ai/docs" docTitle={t('docTitle')} />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t('fileName')}
            {hasChanges && <span className="text-xs text-orange-500">{t('unsavedChanges')}</span>}
            {!hasChanges && !error && <Check className="h-4 w-4 text-green-500" />}
          </CardTitle>
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
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            className="font-mono text-sm min-h-[500px] resize-y"
            spellCheck={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
