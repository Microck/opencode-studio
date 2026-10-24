"use client";

import { useEffect, useState } from 'react';
import { getCliConfig, saveCliConfig, type CliConfigDocument } from '@/lib/api';
import { errorMessage } from '@/lib/error-message.mjs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function CliConfigEditor() {
  const [document, setDocument] = useState<CliConfigDocument | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getCliConfig().then(value => { if (!cancelled) setDocument(value); })
      .catch(reason => { if (!cancelled) setError(errorMessage(reason, 'Could not load cli.json')); });
    return () => { cancelled = true; };
  }, []);
  const save = async () => {
    if (!document || draft === null || saving) return;
    const submitted = draft;
    setSaving(true); setError('');
    try {
      const result = await saveCliConfig({ content: submitted, revision: document.revision });
      setDocument(result);
      setDraft(current => current === submitted ? null : current);
    } catch (reason) { setError(errorMessage(reason, 'Could not save cli.json')); }
    finally { setSaving(false); }
  };
  return <section className="space-y-3">
    <h2 className="text-lg font-semibold">OpenCode v2 terminal settings</h2>
    <p className="text-sm text-muted-foreground">Global cli.json controls the v2 terminal client. This editor does not migrate or overwrite tui.json, and these settings do not apply to OpenCode v1.</p>
    <a className="text-sm underline" href="https://opencode.ai/v2/docs/migrate-v1/#terminal-client-configuration" target="_blank" rel="noopener noreferrer">Official migration guide</a>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!document ? <p>Loading cli.json…</p> : <>
      {!document.exists && <p className="text-sm">No cli.json exists yet. Saving creates it; allow OpenCode’s first launch to migrate your old settings first if needed.</p>}
      <Textarea aria-label="cli.json" className="min-h-80 font-mono" value={draft ?? document.content} onChange={event => setDraft(event.target.value)} />
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving || draft === null}>{saving ? 'Saving…' : 'Save cli.json'}</Button>
        <Button variant="outline" disabled={saving || draft === null} onClick={() => { setDraft(null); setError(''); }}>Reset</Button>
      </div>
    </>}
  </section>;
}
