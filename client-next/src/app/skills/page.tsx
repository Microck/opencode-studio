"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/lib/context";
import { SkillCard } from "@/components/skill-card";
import { AddSkillDialog } from "@/components/add-skill-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { deleteSkill } from "@/lib/api";
import { toast } from "sonner";
import { Search } from "lucide-react";

export default function SkillsPage() {
  const { skills, loading, refreshData, toggleSkill } = useApp();
  const router = useRouter();
  const [search, setSearch] = useState("");

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
      toast.success(`${name} ${skill?.enabled ? "disabled" : "enabled"}`);
    } catch {
      toast.error("Failed to toggle skill");
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await deleteSkill(name);
      toast.success(`${name} deleted`);
      refreshData();
    } catch {
      toast.error("Failed to delete skill");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Skills</h1>
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
        <h1 className="text-2xl font-bold">Skills</h1>
        <AddSkillDialog onSuccess={refreshData} />
      </div>

      {skills.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="pl-9"
          />
        </div>
      )}

      {skills.length === 0 ? (
        <p className="text-muted-foreground italic">No skills found.</p>
      ) : filteredSkills.length === 0 ? (
        <p className="text-muted-foreground italic">No skills match "{search}"</p>
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
    </div>
  );
}
