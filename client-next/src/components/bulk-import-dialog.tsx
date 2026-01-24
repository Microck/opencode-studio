"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Download,
  Alert as AlertIcon,
  Loader,
  Check,
  Close,
  WarningBox,
} from "@nsmr/pixelart-react";
import { bulkFetchUrls, saveSkill, savePlugin, type BulkFetchResult } from "@/lib/api";
import { toast } from "sonner";

interface BulkImportDialogProps {
  type: "skills" | "plugins";
  existingNames: string[];
  onSuccess: () => void;
}

type FetchStatus = "pending" | "fetching" | "success" | "error";

interface FetchItem {
  url: string;
  status: FetchStatus;
  error?: string;
  result?: BulkFetchResult;
  selected: boolean;
  isExisting: boolean;
}

function extractNameFromUrl(url: string, type: "skills" | "plugins"): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const filename = parts[parts.length - 1] || "";

    if (type === "skills" && filename.toLowerCase() === "skill.md" && parts.length > 1) {
      return parts[parts.length - 2];
    }
    return filename.replace(/\.(md|js|ts)$/i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function BulkImportDialog({ type, existingNames, onSuccess }: BulkImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [items, setItems] = useState<FetchItem[]>([]);
  const [phase, setPhase] = useState<"input" | "fetching" | "preview" | "importing">("input");
  const [error, setError] = useState("");
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const resetForm = useCallback(() => {
    setUrlInput("");
    setItems([]);
    setPhase("input");
    setError("");
    setImportProgress({ current: 0, total: 0 });
  }, []);

  const parseUrls = (text: string): string[] => {
    return text
      .split(/[\n\r]+/)
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false;
        try {
          const url = new URL(line);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      });
  };

  const handleFetch = async () => {
    const urls = parseUrls(urlInput);
    if (urls.length === 0) {
      setError("No valid URLs found. Enter one URL per line.");
      return;
    }

    if (urls.length > 50) {
      setError("Maximum 50 URLs allowed per import.");
      return;
    }

    setError("");
    setPhase("fetching");

    const initialItems: FetchItem[] = urls.map((url) => ({
      url,
      status: "pending",
      selected: true,
      isExisting: false,
    }));
    setItems(initialItems);

    try {
      const response = await bulkFetchUrls(urls);

      const updatedItems: FetchItem[] = response.results.map((result) => {
        const name = result.name || extractNameFromUrl(result.url, type);
        const normalizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        const isExisting = existingNames.some(
          (n) => n.toLowerCase() === normalizedName
        );

        return {
          url: result.url,
          status: result.success ? "success" : "error",
          error: result.error,
          result: { ...result, name: normalizedName },
          selected: result.success && !isExisting,
          isExisting,
        };
      });

      setItems(updatedItems);
      setPhase("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch URLs");
      setPhase("input");
    }
  };

  const handleToggleItem = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleToggleAll = (selected: boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.status === "success" ? { ...item, selected } : item
      )
    );
  };

  const handleImport = async () => {
    const toImport = items.filter((item) => item.selected && item.status === "success");
    if (toImport.length === 0) {
      setError("No items selected for import.");
      return;
    }

    setPhase("importing");
    setImportProgress({ current: 0, total: toImport.length });
    setError("");

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < toImport.length; i++) {
      const item = toImport[i];
      setImportProgress({ current: i + 1, total: toImport.length });

      try {
        if (type === "skills") {
          await saveSkill(
            item.result!.name!,
            item.result!.description || "",
            item.result!.body || item.result!.content || ""
          );
        } else {
          const pluginName = item.result!.name!.endsWith(".js") || item.result!.name!.endsWith(".ts")
            ? item.result!.name!
            : `${item.result!.name}.js`;
          await savePlugin(pluginName, item.result!.content || "");
        }
        successCount++;
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message || "Unknown error";
        console.error(`Failed to import ${item.result?.name}:`, msg);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Imported ${successCount}/${toImport.length} ${type}`);
      onSuccess();
    }
    if (failCount > 0) {
      toast.error(`Failed to import ${failCount} ${type}`);
    }

    resetForm();
    setOpen(false);
  };

  const successItems = items.filter((item) => item.status === "success");
  const selectedCount = items.filter((item) => item.selected && item.status === "success").length;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Bulk Import {type === "skills" ? "Skills" : "Plugins"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertIcon className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {phase === "input" && (
          <div className="space-y-4">
            <Textarea
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={`Paste URLs here (one per line)\n\nExample:\nhttps://raw.githubusercontent.com/.../SKILL.md\nhttps://raw.githubusercontent.com/.../another/SKILL.md`}
              className="font-mono text-sm min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Paste raw URLs to {type === "skills" ? "SKILL.md" : "plugin"} files. One URL per line.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleFetch} disabled={!urlInput.trim()}>
                Fetch URLs
              </Button>
            </div>
          </div>
        )}

        {phase === "fetching" && (
          <div className="space-y-4 py-8">
            <div className="flex items-center justify-center gap-3">
              <Loader className="h-6 w-6 animate-spin" />
              <span>Fetching {items.length} URLs...</span>
            </div>
          </div>
        )}

        {phase === "preview" && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {successItems.length} fetched successfully, {selectedCount} selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleToggleAll(true)}>
                  Select All
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleToggleAll(false)}>
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="w-8 p-2"></th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={item.url}
                      className={`border-b last:border-0 ${
                        item.status === "error" ? "opacity-50" : ""
                      }`}
                    >
                      <td className="p-2">
                        {item.status === "success" && (
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleItem(index)}
                            className="rounded"
                          />
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {item.result?.name || extractNameFromUrl(item.url, type)}
                          </span>
                          {item.result?.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {item.result.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        {item.status === "success" && !item.isExisting && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Check className="h-4 w-4" /> Ready
                          </span>
                        )}
                        {item.status === "success" && item.isExisting && (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <WarningBox className="h-4 w-4" /> Exists
                          </span>
                        )}
                        {item.status === "error" && (
                          <span className="flex items-center gap-1 text-red-600">
                            <Close className="h-4 w-4" /> {item.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { resetForm(); }}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                Import {selectedCount} {type}
              </Button>
            </div>
          </div>
        )}

        {phase === "importing" && (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center justify-center gap-3">
              <Loader className="h-6 w-6 animate-spin" />
              <span>
                Importing {importProgress.current}/{importProgress.total}...
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
