'use client';
import { useState } from 'react';
import type { PlanningConfiguration } from '@/lib/agents/planning-contract';
import type { HazardSnapshot } from '@/lib/agents/hazard-connector';
export default function HazardEvidenceUpload({ configuration, onChange }: { configuration: PlanningConfiguration; onChange: (value: PlanningConfiguration) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [snapshot, setSnapshot] = useState<HazardSnapshot | null>(null);
  async function upload(file: File) {
    setBusy(true); setMessage('');
    try {
      if (file.size > 12000000) throw new Error('Hazard JSON must be below 12 MB.');
      const payload = JSON.parse(await file.text());
      if (payload.geography !== configuration.geography) throw new Error('Select the same geography as the assessment before importing.');
      const response = await fetch('/api/agents/hazards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setSnapshot(data); onChange({ ...configuration, hazardSnapshotId: data.id }); setMessage('Assessment snapshot imported. Source classifications and partial coverage will be disclosed in the run.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Hazard import failed.'); } finally { setBusy(false); }
  }
  return <details><summary>Hazard assessment evidence</summary><p>Import school-level assessment JSON from a documented source. ATLAS preserves the source classification and does not certify it. Unknown exposure must be null; duplicate school IDs are rejected.</p><label>Assessment JSON<input type="file" accept=".json,application/json" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }}/></label><details><summary>Required schema (illustrative, not assessment data)</summary><pre>{JSON.stringify({ schemaVersion: 1, title: 'Assessment title', sourceUrl: 'https://source.example/assessment', release: 'Source release identifier', geography: configuration.geography, period: 'Assessment reference period', hazard: 'Source hazard definition', expectedSchoolCount: 1, definition: 'How the provider classified exposure and selected the school inventory', schools: [{ schoolId: 'Source school identifier', exposed: null }] }, null, 2)}</pre></details>{snapshot && <p>{snapshot.title} · {snapshot.period}<br/>{snapshot.schools.length} supplied schools of {snapshot.expectedSchoolCount} expected<br/>SHA-256: {snapshot.hash}</p>}{configuration.hazardSnapshotId && <p>Selected snapshot: {configuration.hazardSnapshotId}<br/><button onClick={() => { onChange({ ...configuration, hazardSnapshotId: undefined }); setSnapshot(null); }}>Clear selected assessment</button></p>}<p role="status">{message}</p></details>;
}
