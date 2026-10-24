"use client";

import { errorMessage } from "@/lib/error-message.mjs";

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
import { Plus, Alert as AlertIcon, Link, Loader } from "@nsmr/pixelart-react";
import { saveSkill, fetchUrl } from "@/lib/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface AddSkillDialogProps {
  onSuccess: () => void;
}

const SKILL_TEMPLATE = `## When to Use
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

function isUrl(str: string): boolean {
  try {
    const url = new URL(str.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const parts = pathname.split('/').filter(Boolean);
    const filename = parts.pop() || '';
    if (filename === 'SKILL.md' && parts.length > 0) {
      return parts.pop() || '';
    }
    return filename.replace(/\.md$/, '').toLowerCase();
  } catch {
    return '';
  }
}

function parseFrontmatter(content: string): { name: string; description: string; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { name: '', description: '', body: content };
  }
  
  const frontmatter = match[1];
  const body = content.slice(match[0].length).trim();
  
  let name = '';
  let description = '';
  
  for (const line of frontmatter.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key === 'name') name = value;
      if (key === 'description') description = value;
    }
  }
  
  return { name, description, body };
}

export function AddSkillDialog({ onSuccess }: AddSkillDialogProps) {
  const t = useTranslations('dialogs');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState(SKILL_TEMPLATE);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setContent(SKILL_TEMPLATE);
    setError("");
    setUrlInput("");
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    
    if (!isUrl(urlInput)) {
      setError(t('addSkill.errors.invalidUrl'));
      return;
    }

    try {
      setFetching(true);
      setError("");
      const result = await fetchUrl(urlInput.trim());
      
      const parsed = parseFrontmatter(result.content);
      if (parsed.name || parsed.description) {
        if (!name && parsed.name) setName(parsed.name);
        if (!description && parsed.description) setDescription(parsed.description);
        setContent(parsed.body);
      } else {
        setContent(result.content);
        if (!name) {
          const extractedName = extractNameFromUrl(urlInput);
          if (extractedName) setName(extractedName);
        }
      }
      
      toast.success(t('fetchedToast'));
      setUrlInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t('fetchFailed'));
    } finally {
      setFetching(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (isUrl(pastedText)) {
      e.preventDefault();
      setUrlInput(pastedText);
      try {
        setFetching(true);
        setError("");
        const result = await fetchUrl(pastedText.trim());
        
        const parsed = parseFrontmatter(result.content);
        if (parsed.name || parsed.description) {
          if (!name && parsed.name) setName(parsed.name);
          if (!description && parsed.description) setDescription(parsed.description);
          setContent(parsed.body);
        } else {
          setContent(result.content);
          if (!name) {
            const extractedName = extractNameFromUrl(pastedText);
            if (extractedName) setName(extractedName);
          }
        }
        
        toast.success(t('fetchedToast'));
        setUrlInput("");
      } catch (err) {
        setUrlInput(pastedText);
        setError(err instanceof Error ? err.message : t('fetchFailed'));
      } finally {
        setFetching(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError(t('addSkill.errors.nameRequired'));
      return;
    }

    if (!description.trim()) {
      setError(t('addSkill.errors.descriptionRequired'));
      return;
    }

    const skillName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(skillName)) {
      setError(t('addSkill.errors.nameFormat'));
      return;
    }

    if (skillName.length > 64) {
      setError(t('addSkill.errors.nameTooLong'));
      return;
    }

    if (description.length > 1024) {
      setError(t('addSkill.errors.descriptionTooLong'));
      return;
    }

    try {
      setLoading(true);
      await saveSkill(skillName, description, content);
      toast.success(t('addSkill.createdToast', { name: skillName }));
      resetForm();
      setOpen(false);
      onSuccess();
    } catch (err: unknown) {
      const msg = errorMessage(err, t('addSkill.errors.createFailed'));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t('addSkill.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('addSkill.title')}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <Alert className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 p-3 rounded-lg border border-dashed">
            <Label className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              {t('importLabel')}
            </Label>
            <div className="flex gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onPaste={handlePaste}
                placeholder={t('addSkill.importPlaceholder')}
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleFetchUrl}
                disabled={fetching || !urlInput.trim()}
              >
                {fetching ? <Loader className="h-4 w-4 animate-spin" /> : t('fetch')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('addSkill.importHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-name">{t('addSkill.nameLabel')}</Label>
            <Input
              id="skill-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('addSkill.namePlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('addSkill.nameHint', { name: name || 'my-skill' })}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-description">{t('addSkill.descriptionLabel')}</Label>
            <Input
              id="skill-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('addSkill.descriptionPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('addSkill.descriptionHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-content">{t('addSkill.contentLabel')}</Label>
            <Textarea
              id="skill-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-sm min-h-[250px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('addSkill.creating') : t('addSkill.createSkill')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
