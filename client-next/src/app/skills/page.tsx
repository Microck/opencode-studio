"use client";

import { useState, useMemo, useEffect } from "react";
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
import { deleteSkill, getSkills } from "@/lib/api";
import { toast } from "sonner";
import { Search } from "@nsmr/pixelart-react";
import { PageHelp } from "@/components/page-help";
import { PresetsManager } from "@/components/presets-manager";

export default function SkillsPage() {
  const t = useTranslations('skills');
  const { skills, refreshData, toggleSkill } = useApp();
  const [skillsData, setSkillsData] = useState(skills);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ name: string } | null>(null);

  useEffect(() => {
    setSkillsData(skills);
  }, [skills]);

  useEffect(() => {
    const loadSkills = async () => {
      try {
        if (skillsData.length === 0) setLoading(true);
        const data = await getSkills();
        setSkillsData(data);
      } finally {
        setLoading(false);
      }
    };
    loadSkills();
  }, []);

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return skillsData;
    const q = search.toLowerCase();
    return skillsData.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.description?.toLowerCase().includes(q))
    );
  }, [skillsData, search]);

  const reloadSkills = async () => {
    const data = await getSkills();
    setSkillsData(data);
  };

  const handleOpen = (name: string) => {
    router.push(`/editor?type=skills&name=${encodeURIComponent(name)}`);
  };

  const handleToggle = async (name: string) => {
    try {
      await toggleSkill(name);
      const skill = skillsData.find(s => s.name === name);
      toast.success(skill?.enabled ? t('toggleDisabled', { name }) : t('toggleEnabled', { name }));
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || t('unknownError');
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
      await reloadSkills();
      refreshData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || t('unknownError');
      toast.error(t('deleteFailed', { error: msg }));
    }
  };

  if (loading && skillsData.length === 0) {
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
            existingNames={skillsData.map(s => s.name)} 
            onSuccess={async () => { await reloadSkills(); refreshData(); }} 
          />
          <AddSkillDialog onSuccess={async () => { await reloadSkills(); refreshData(); }} />
        </div>
      </div>

      {skillsData.length > 0 && (
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

      {skillsData.length === 0 ? (
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
