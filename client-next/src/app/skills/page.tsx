"use client";

import { useApp } from "@/lib/context";
import { FileCard } from "@/components/file-card";
import { AddSkillDialog } from "@/components/add-skill-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Puzzle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SkillsPage() {
  const { skills, loading, refreshData } = useApp();
  const router = useRouter();

  const handleOpen = (name: string) => {
    router.push(`/editor?type=skills&name=${encodeURIComponent(name)}`);
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

      {skills.length === 0 ? (
        <p className="text-muted-foreground italic">No skills found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {skills.map((skill) => (
            <FileCard
              key={skill}
              name={skill}
              icon={<Puzzle className="h-5 w-5 text-yellow-500" />}
              onClick={() => handleOpen(skill)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
