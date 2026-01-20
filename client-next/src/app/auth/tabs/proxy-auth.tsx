"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Plus, Trash2, Edit2, Check, X, Key } from "lucide-react";
import { toast } from "sonner";
import { getManagementApiKeys, saveManagementApiKeys, updateManagementApiKey, deleteManagementApiKey } from "@/lib/api";

export function ProxyAuthTab() {
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const loadKeys = async () => {
    try {
      const res = await getManagementApiKeys();
      setKeys(res["api-keys"] || []);
    } catch (e) {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    try {
      const updated = [...keys, newKey.trim()];
      await saveManagementApiKeys(updated);
      setKeys(updated);
      setNewKey("");
      toast.success("API Key added");
    } catch (e) {
      toast.error("Failed to add key");
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm("Delete this API key? Apps using it will lose access immediately.")) return;
    try {
      await deleteManagementApiKey(key);
      setKeys(prev => prev.filter(k => k !== key));
      toast.success("API Key deleted");
    } catch (e) {
      toast.error("Failed to delete key");
    }
  };

  const startEdit = (index: number, val: string) => {
    setEditingIndex(index);
    setEditValue(val);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const saveEdit = async (oldVal: string) => {
    if (!editValue.trim() || editValue === oldVal) {
      cancelEdit();
      return;
    }
    try {
      await updateManagementApiKey(oldVal, editValue.trim());
      const newKeys = [...keys];
      const idx = newKeys.indexOf(oldVal);
      if (idx !== -1) newKeys[idx] = editValue.trim();
      setKeys(newKeys);
      toast.success("API Key updated");
      cancelEdit();
    } catch (e) {
      toast.error("Failed to update key");
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Copied to clipboard");
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Proxy Access Keys</CardTitle>
          <CardDescription>
            These keys allow external applications (like Cursor, VSCode, Claude CLI) to authenticate with your local proxy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2">
            <Input 
              placeholder="Enter new API key (e.g. sk-proxy-my-app-key)" 
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={!newKey.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Key
            </Button>
          </div>

          <div className="space-y-2">
            {keys.length === 0 ? (
              <div className="text-center p-8 border rounded-lg border-dashed text-muted-foreground">
                No API keys configured. The proxy may not accept requests.
              </div>
            ) : (
              keys.map((key, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                  {editingIndex === i ? (
                    <div className="flex items-center gap-2 flex-1 mr-4">
                      <Input 
                        value={editValue} 
                        onChange={(e) => setEditValue(e.target.value)}
                        className="font-mono text-sm h-8"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => saveEdit(key)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 font-mono text-sm overflow-hidden mr-4">
                      <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{key}</span>
                      {key.startsWith("sk-") && <Badge variant="outline" className="text-[10px]">Standard</Badge>}
                    </div>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyKey(key)} title="Copy">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(i, key)} title="Edit">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(key)} title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection Guide</CardTitle>
          <CardDescription>How to connect your tools to this proxy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">OpenAI SDK / Cursor</h4>
              <div className="space-y-2 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Base URL:</span>
                  <code className="bg-muted px-1 rounded">http://127.0.0.1:8317/v1</code>
                </div>
                <div className="flex justify-between">
                  <span>API Key:</span>
                  <span className="italic">Use any key from above</span>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Anthropic SDK / Claude</h4>
              <div className="space-y-2 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Base URL:</span>
                  <code className="bg-muted px-1 rounded">http://127.0.0.1:8317</code>
                </div>
                <div className="flex justify-between">
                  <span>API Key:</span>
                  <span className="italic">Use any key from above</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
