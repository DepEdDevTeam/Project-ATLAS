'use client';
import { useEffect, useState } from 'react';
import type { AgentId, InstructionVersion } from '@/lib/agents/instruction-store';
import styles from './planning.module.css';
const agents: AgentId[] = ['social', 'technology', 'economic', 'environment', 'policy', 'synthesis', 'validator', 'reporter'];
export default function InstructionEditor() {
  const [agent, setAgent] = useState<AgentId>('social');
  const [history, setHistory] = useState<InstructionVersion[]>([]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setMessage('');
    fetch(`/api/agents/instructions?agent=${agent}`).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (active) { setHistory(data.history); setDraft(data.history.at(-1).text); } }).catch(error => { if (active) { setHistory([]); setMessage(error.message); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [agent]);
  async function save() {
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/agents/instructions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent, text: draft, expectedVersion: history.at(-1)?.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setHistory(current => [...current, data.version]); setDraft(data.version.text); setMessage('Saved. New runs will record and use this version.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); } finally { setSaving(false); }
  }
  return <section className={`${styles.workspace} ${styles.panel}`}><label>Agent<select value={agent} disabled={saving} onChange={e => setAgent(e.target.value as AgentId)}>{agents.map(id => <option key={id}>{id}</option>)}</select></label><p>Current version: {history.at(-1)?.id || 'Loading…'}</p><label>Instructions<textarea rows={12} value={draft} disabled={loading || saving} onChange={e => setDraft(e.target.value)}/></label><button onClick={save} disabled={loading || saving || !history.length || !draft.trim()}>{saving ? 'Saving…' : 'Save new version'}</button><p role="status">{message}</p><h2>Version history</h2>{history.slice().reverse().map(version => <details key={version.id}><summary>{version.id} · {new Date(version.createdAt).toLocaleString()}</summary><pre>{version.text}</pre></details>)}</section>;
}
