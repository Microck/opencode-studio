"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { toast } from "sonner";
import { Plus, Trash, Check, User, CardStack, Play } from "@nsmr/pixelart-react"
import { getProfiles, createProfile, deleteProfile, activateProfile, type ProfileList } from "@/lib/api";
import { PageHelp } from "@/components/page-help";

export default function ProfilesPage() {
  const t = useTranslations('profiles');
  const [data, setData] = useState<ProfileList | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const getErrorMessage = (err: unknown) => {
    if (axios.isAxiosError(err)) return err.response?.data?.error || err.message;
    if (err instanceof Error) return err.message;
    return null;
  };

  const loadProfiles = async () => {
    try {
      const res = await getProfiles();
      setData(res);
    } catch (e) {
      const msg = getErrorMessage(e);
      toast.error(msg ? t('loadFailedWithError', { error: msg }) : t('loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleCreate = async () => {
    if (!newProfileName.trim()) return;
    try {
      setCreating(true);
      await createProfile(newProfileName);
      toast.success(t('createSuccess', { name: newProfileName }));
      setCreateOpen(false);
      setNewProfileName("");
      loadProfiles();
    } catch (e) {
      const msg = getErrorMessage(e);
      toast.error(msg ? t('createFailedWithError', { error: msg }) : t('createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProfile(deleteTarget);
      toast.success(t('deleted'));
      loadProfiles();
    } catch (e) {
      const msg = getErrorMessage(e);
      toast.error(msg ? t('deleteFailedWithError', { error: msg }) : t('deleteFailed'));
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleActivate = async (name: string) => {
    try {
      setActivating(name);
      await activateProfile(name);
      toast.success(t('switchSuccess', { name }));
      loadProfiles();
    } catch (e) {
      const msg = getErrorMessage(e);
      toast.error(msg ? t('switchFailedWithError', { error: msg }) : t('switchFailed'));
    } finally {
      setActivating(null);
    }
  };

  if (loading) {
    return <div className="p-8">{t('loading')}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12 p-8">
      <header className="flex justify-between items-end border-b pb-4">
        <div>
          <div className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <PageHelp
              title={t('title')}
              docUrl="https://opencode.ai/docs"
              docTitle={t('docTitle')}
            />
            <Badge variant="outline" className="font-mono text-xs font-normal">
              {data?.active ? t('activeProfile', { name: data.active }) : t('noActiveProfile')}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
               <Plus className="h-4 w-4 mr-2" />
              {t('newProfile')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('createTitle')}</DialogTitle>
              <DialogDescription>
                {t('createDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder={t('namePlaceholder')}
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('cancel')}</Button>
              <Button onClick={handleCreate} disabled={!newProfileName.trim() || creating}>{t('create')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.profiles.map((profile) => {
          const isActive = data.active === profile;
          const isLegacy = data.legacy.includes(profile);
          return (
            <Card key={profile} className={`hover-lift transition-all ${isActive ? 'border-primary shadow-md bg-primary/5' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-md ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <CardStack className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{profile}</CardTitle>
                      {isActive && <Badge className="mt-1">{t('active')}</Badge>}
                      {isLegacy && <Badge variant="secondary" className="mt-1">legacy 环境</Badge>}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mt-4">
                  {isLegacy ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleActivate(profile)}
                      disabled={activating === profile}
                    >
                       <Play className="h-4 w-4 mr-2" />
                      导入并激活
                    </Button>
                  ) : isActive ? (
                    <Button disabled className="w-full" variant="secondary">
                       <Check className="h-4 w-4 mr-2" />
                      {t('current')}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleActivate(profile)}
                      disabled={activating === profile}
                    >
                       <Play className="h-4 w-4 mr-2" />
                      {t('switch')}
                    </Button>
                  )}
                  
                  {!isLegacy && profile !== 'default' && !isActive && (
                    <Button
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(profile)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDescription', { name: deleteTarget ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancelBtn')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {t('deleteBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
