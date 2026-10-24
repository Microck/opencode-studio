"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/lib/context";
import { SkillCard } from "@/components/skill-card";
import { AddSkillDialog } from "@/components/add-skill-dialog";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import { useRouter } from "next/navigation";
import { deleteSkill } from "@/lib/api";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message.mjs";
import { Search } from "@nsmr/pixelart-react";
import { PageHelp } from "@/components/page-help";
import { PresetsManager } from "@/components/presets-manager";

export default function SkillsPage() {
  const t = useTranslations('skills');
  const { skills, loading, refreshData, toggleSkill } = useApp();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ name: string } | null>(null);

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return skills;
    const q = search.toLowerCase();
    return skills.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.description?.toLowerCase().includes(q))
    );
  }, [skills, search]);

  const handleOpen = (name: string) => {
    router.push(`/editor?type=skills&name=${encodeURIComponent(name)}`);
  };

  const handleToggle = async (name: string) => {
    try {
      await toggleSkill(name);
      const skill = skills.find(s => s.name === name);
      toast.success(skill?.enabled ? t('toggleDisabled', { name }) : t('toggleEnabled', { name }));
    } catch (err: unknown) {
      const msg = errorMessage(err, t('unknownError'));
      toast.error(t('toggleFailed', { error: msg }));
    }
  };

  const handleDelete = (name: string) => {
    setDeleteTarget({ name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSkill(deleteTarget.name);
      toast.success(t('deleted', { name: deleteTarget.name }));
      setDeleteDialogOpen(false);
      refreshData();
    } catch (err: unknown) {
      const msg = errorMessage(err, t('unknownError'));
      toast.error(t('deleteFailed', { error: msg }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
<PageHelp title={t('title')} docUrl="https://opencode.ai/docs/skills" docTitle={t('docTitleFull')} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <PageHelp title={t('title')} docUrl="https://opencode.ai/docs" docTitle={t('docTitle')} />
        <div className="flex gap-2">
          <PresetsManager />
          <BulkImportDialog 
            type="skills"
            existingNames={skills.map(s => s.name)} 
            onSuccess={refreshData} 
          />
          <AddSkillDialog onSuccess={refreshData} />
        </div>
      </div>

      {skills.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
          />
        </div>
      )}

      {skills.length === 0 ? (
        <p className="text-muted-foreground italic">{t('noSkills')}</p>
      ) : filteredSkills.length === 0 ? (
        <p className="text-muted-foreground italic">{t('noMatch', { search })}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.name}
              skill={skill}
              onToggle={() => handleToggle(skill.name)}
              onDelete={() => handleDelete(skill.name)}
              onClick={() => handleOpen(skill.name)}
            />
          ))}
        </div>
      )}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm', { name: deleteTarget?.name || '' })}
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
