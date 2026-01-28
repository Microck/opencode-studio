"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash, Edit, Command } from "@nsmr/pixelart-react";
import { PageHelp } from "@/components/page-help";
import { PageHelpDialog } from "@/components/page-help-dialog";
import { toast } from "sonner";

interface CommandEntry {
  name: string;
  template: string;
}

export default function CommandsPage() {
  const { config, loading, saveConfig, refreshData } = useApp();
  const router = useRouter();
  const [commands, setCommands] = useState<CommandEntry[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingCmd, setEditingCmd] = useState<{ originalName: string, name: string, template: string } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (config?.command) {
      const entries = Object.entries(config.command).map(([name, value]) => ({
        name,
        template: value.template,
      }));
      setCommands(entries);
    } else {
      setCommands([]);
    }
  }, [config]);

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error("Command name is required");
      return;
    }
    if (!newTemplate.trim()) {
      toast.error("Template is required");
      return;
    }
    if (commands.some(c => c.name === newName.trim())) {
      toast.error("Command already exists");
      return;
    }

    const updatedConfig = {
      ...config,
      command: {
        ...config?.command,
        [newName.trim()]: { template: newTemplate },
      },
    };

    try {
      await saveConfig(updatedConfig);
      toast.success(`Command "${newName}" created`);
      setNewName("");
      setNewTemplate("");
      setAddOpen(false);
      refreshData();
    } catch {
      toast.error("Failed to create command");
    }
  };

  const handleEditSave = async () => {
    if (!editingCmd) return;
    if (!editingCmd.name.trim()) {
      toast.error("Command name is required");
      return;
    }
    if (!editingCmd.template.trim()) {
      toast.error("Template is required");
      return;
    }

    const newCommands = { ...config?.command };

    if (editingCmd.name !== editingCmd.originalName) {
      delete newCommands[editingCmd.originalName];
    }

    newCommands[editingCmd.name.trim()] = { template: editingCmd.template };

    const updatedConfig = {
      ...config,
      command: newCommands,
    };

    try {
      await saveConfig(updatedConfig);
      toast.success(`Command "${editingCmd.name}" updated`);
      setEditOpen(false);
      setEditingCmd(null);
      refreshData();
    } catch {
      toast.error("Failed to update command");
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete command "${name}"?`)) return;

    const newCommands = { ...config?.command };
    delete newCommands[name];

    const updatedConfig = {
      ...config,
      command: newCommands,
    };

    try {
      await saveConfig(updatedConfig);
      toast.success(`Command "${name}" deleted`);
      refreshData();
    } catch {
      toast.error("Failed to delete command");
    }
  };

  const openEdit = (cmd: CommandEntry) => {
    setEditingCmd({
      originalName: cmd.name,
      name: cmd.name,
      template: cmd.template
    });
    setEditOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <PageHelp title="Commands" docUrl="https://opencode.ai/docs/commands" docTitle="Commands" />
          <Button variant="outline" size="icon" onClick={() => setHelpOpen(true)} aria-label="Page help">
            ?
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
          </div>
        </div>
      )}
    </div>

    <PageHelpDialog open={helpOpen} onOpenChange={setHelpOpen} page="commands" />
  );
}

export default function CommandsPage() {
  return <EditorContent />;
}

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <PageHelp title="Commands" docUrl="https://opencode.ai/docs/commands" docTitle="Commands" />
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Command
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Command</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cmd-name">Command Name</Label>
                  <Input
                    id="cmd-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="my-command"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use with /my-command in opencode
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cmd-template">Template</Label>
                  <Textarea
                    id="cmd-template"
                    value={newTemplate}
                    onChange={(e) => setNewTemplate(e.target.value)}
                    placeholder="Your prompt template here. Use $ARGUMENTS for user input."
                    className="font-mono text-sm min-h-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use $ARGUMENTS to include user-provided arguments
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAdd}>Create</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Command</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Command Name</Label>
                  <Input
                    id="edit-name"
                    value={editingCmd?.name || ""}
                    onChange={(e) => setEditingCmd(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use with /{editingCmd?.name} in opencode
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-template">Template</Label>
                  <Textarea
                    id="edit-template"
                    value={editingCmd?.template || ""}
                    onChange={(e) => setEditingCmd(prev => prev ? { ...prev, template: e.target.value } : null)}
                    className="font-mono text-sm min-h-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use $ARGUMENTS to include user-provided arguments
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleEditSave}>Save Changes</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {commands.length === 0 ? (
        <p className="text-muted-foreground italic">No commands configured.</p>
        ) : (
      </div>
      )}
    </div>

    <PageHelpDialog open={helpOpen} onOpenChange={setHelpOpen} page="commands" />
  );
}

export default function CommandsPage() {
  return <EditorContent />;
}
