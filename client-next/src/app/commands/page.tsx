"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getCommands, saveCommand, deleteCommand } from "@/lib/api";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash, Edit, Command, Logout } from "@nsmr/pixelart-react";
import { PageHelp } from "@/components/page-help";
import { toast } from "sonner";

interface CommandEntry {
  name: string;
  template: string;
}

const COMMANDS_CACHE_KEY = "opencode-studio-commands-cache";

export default function CommandsPage() {
  const t = useTranslations('commands');
  const [commands, setCommands] = useState<CommandEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingCmd, setEditingCmd] = useState<{ originalName: string, name: string, template: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchCommands = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const data = await getCommands();
      const entries = Object.entries(data).map(([name, value]) => ({
        name,
        template: value.template,
      }));
      setCommands(entries);
      sessionStorage.setItem(COMMANDS_CACHE_KEY, JSON.stringify(entries));
    } catch (err: any) {
      toast.error(t('loadFailed'));
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(COMMANDS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as CommandEntry[];
        if (Array.isArray(parsed)) {
          setCommands(parsed);
          setLoading(false);
        }
      }
    } catch {}

    fetchCommands(!sessionStorage.getItem(COMMANDS_CACHE_KEY));
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error(t('nameRequired'));
      return;
    }
    if (!newTemplate.trim()) {
      toast.error(t('templateRequired'));
      return;
    }
    if (commands.some(c => c.name === newName.trim())) {
      toast.error(t('alreadyExists'));
      return;
    }

    try {
      await saveCommand(newName.trim(), newTemplate);
      toast.success(t('createSuccess', { name: newName }));
      setNewName("");
      setNewTemplate("");
      setAddOpen(false);
      fetchCommands(false);
    } catch {
      toast.error(t('createFailed'));
    }
  };



  const handleEditSave = async () => {
    if (!editingCmd) return;
    if (!editingCmd.name.trim()) {
      toast.error(t('nameRequired'));
      return;
    }
    if (!editingCmd.template.trim()) {
      toast.error(t('templateRequired'));
      return;
    }
    
    // Check for duplicate name only if name changed
    if (editingCmd.name !== editingCmd.originalName && commands.some(c => c.name === editingCmd.name.trim())) {
      toast.error(t('alreadyExists'));
      return;
    }

    try {
      if (editingCmd.name !== editingCmd.originalName) {
        await deleteCommand(editingCmd.originalName);
      }
      await saveCommand(editingCmd.name.trim(), editingCmd.template);
      toast.success(t('updateSuccess', { name: editingCmd.name }));
      setEditOpen(false);
      setEditingCmd(null);
      fetchCommands(false);
    } catch {
      toast.error(t('updateFailed'));
    }
  };


  const handleDelete = (name: string) => {
    setDeleteTarget(name);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      await deleteCommand(deleteTarget);
      toast.success(t('deleteSuccess', { name: deleteTarget }));
      setDeleteDialogOpen(false);
      fetchCommands(false);
    } catch {
      toast.error(t('deleteFailed'));
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

  if (loading && commands.length === 0) {
    return (
      <div className="space-y-4">
         <div className="flex justify-between items-center">
           <PageHelp title={t('title')} docUrl="https://opencode.ai/docs/commands" docTitle={t('docTitleFull')} />
        </div>
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <PageHelp title={t('title')} docUrl="https://opencode.ai/docs" docTitle={t('docTitle')} />
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t('newCommand')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('createTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cmd-name">{t('commandName')}</Label>
                <Input
                  id="cmd-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('commandNamePlaceholder')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('commandNameHint', { name: newName || 'my-command' })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cmd-template">{t('template')}</Label>
                <Textarea
                  id="cmd-template"
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  placeholder={t('templatePlaceholder')}
                  className="font-mono text-sm min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  {t('templateHint')}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAddOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleAdd}>{t('create')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('editTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">{t('commandName')}</Label>
                <Input
                  id="edit-name"
                  value={editingCmd?.name || ""}
                  onChange={(e) => setEditingCmd(prev => prev ? { ...prev, name: e.target.value } : null)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('editNameHint', { name: editingCmd?.name || '' })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-template">{t('template')}</Label>
                <Textarea
                  id="edit-template"
                  value={editingCmd?.template || ""}
                  onChange={(e) => setEditingCmd(prev => prev ? { ...prev, template: e.target.value } : null)}
                  className="font-mono text-sm min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  {t('templateHint')}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleEditSave}>{t('saveChanges')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {commands.length === 0 ? (
        <p className="text-muted-foreground italic">{t('noCommands')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {commands.map((cmd) => (
            <Card key={cmd.name}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Command className="h-5 w-5 text-blue-500" />
                    <span className="font-mono">/{cmd.name}</span>
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(cmd)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(cmd.name)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-background p-3 rounded-md max-h-32 overflow-auto">
                  {cmd.template}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm', { name: deleteTarget || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
