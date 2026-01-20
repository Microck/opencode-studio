"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Save, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getManagementConfigYaml, saveManagementConfigYaml } from "@/lib/api";

export function ConfigTab() {
  const [yaml, setYaml] = useState("");
  const [originalYaml, setOriginalYaml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getManagementConfigYaml();
      setYaml(data);
      setOriginalYaml(data);
    } catch (e) {
      toast.error("Failed to load config");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await saveManagementConfigYaml(yaml);
      if (res.ok) {
        toast.success("Configuration saved");
        setOriginalYaml(yaml);
      } else {
        toast.error("Failed to save configuration");
      }
    } catch (e) {
      toast.error("Error saving config");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = yaml !== originalYaml;

  if (loading) return <Skeleton className="h-[500px] w-full" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle>Advanced Configuration</CardTitle>
            <CardDescription>
              Directly edit the `config.yaml` file for CLIProxyAPI.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button variant="outline" size="sm" onClick={() => setYaml(originalYaml)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-4 rounded-md mb-4 flex gap-3 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>
              Warning: Incorrect configuration can break the proxy. Changes are applied immediately but some settings may require a restart.
            </p>
          </div>
          
          <Textarea 
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            className="font-mono text-sm min-h-[500px] bg-muted/30"
            spellCheck={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
