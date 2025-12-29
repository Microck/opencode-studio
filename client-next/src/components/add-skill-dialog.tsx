"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, AlertCircle } from "lucide-react";
import { saveSkill } from "@/lib/api";
import { toast } from "sonner";

interface AddSkillDialogProps {
  onSuccess: () => void;
}

const SKILL_TEMPLATE = `# Skill Name

## Description
Brief description of what this skill does.

## When to Use
- Scenario 1
- Scenario 2

## Instructions
1. Step one
2. Step two
3. Step three

## Examples
\`\`\`
Example usage here
\`\`\`
`;

export function AddSkillDialog({ onSuccess }: AddSkillDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState(SKILL_TEMPLATE);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName("");
    setContent(SKILL_TEMPLATE);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a skill name");
      return;
    }

    const fileName = name.endsWith(".md") ? name : `${name}.md`;

    if (!/^[a-zA-Z0-9_-]+\.md$/.test(fileName)) {
      setError("Name can only contain letters, numbers, hyphens, and underscores");
      return;
    }

    try {
      setLoading(true);
      await saveSkill(fileName, content);
      toast.success(`Created ${fileName}`);
      resetForm();
      setOpen(false);
      onSuccess();
    } catch {
      setError("Failed to create skill");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Skill
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Skill</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skill-name">Skill Name</Label>
            <Input
              id="skill-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-skill"
            />
            <p className="text-xs text-muted-foreground">
              Will be saved as {name ? (name.endsWith(".md") ? name : `${name}.md`) : "skill-name.md"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-content">Content (Markdown)</Label>
            <Textarea
              id="skill-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Skill"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
