"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Puzzle, Trash2 } from "lucide-react";
import type { SkillInfo } from "@/types";

interface SkillCardProps {
  skill: SkillInfo;
  onToggle: () => void;
  onDelete: () => void;
  onClick: () => void;
}

export function SkillCard({ skill, onToggle, onDelete, onClick }: SkillCardProps) {
  return (
    <Card className={skill.enabled ? "border-primary/50" : "opacity-60"}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex-1 min-w-0 cursor-pointer hover:opacity-80"
            onClick={onClick}
          >
            <div className="flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-yellow-500 shrink-0" />
              <span className="font-mono text-sm truncate">{skill.name}</span>
            </div>
            {skill.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 pl-7">
                {skill.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={skill.enabled}
              onCheckedChange={() => onToggle()}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Toggle ${skill.name}`}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
