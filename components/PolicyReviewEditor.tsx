'use client';
import { useState } from 'react';
import type { PlanningConfiguration } from '@/lib/agents/planning-contract';
import type { PolicyDocument, RuleCitation, ReviewedPolicy } from '@/lib/agents/policy-store';
const fields: RuleCitation['field'][] = ['eligiblePct', 'startYear', 'endYear', 'fundingCapPhp'];
export default function PolicyReviewEditor({ configuration, onChange }: { configuration: PlanningConfiguration; onChange: (value: PlanningConfiguration) => void }) {
  const [document, setDocument] = useState<PolicyDocument | null>(null);
  const [citations, setCitations] = useState<RuleCitation[]>(fields.map(field => ({ field, page: 1, quote: '', rationale: '' })));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function upload(file: File) {
    setBusy(true); setMessage('');
    try {
      const form = new FormData(); form.set('file', file); form.set('sourceUrl', configuration.policy.sourceUrl);
      const response = await fetch('/api/agents/policy', { method: 'POST', body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setDocument(data); setCitations(fields.map(field => ({ field, page: 1, quote: '', rationale: '' })));
      onChange({ ...configuration, reviewedPolicyId: undefined }); setMessage('Source stored. Review each rule against a page passage before applying it.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload failed.'); } finally { setBusy(false); }
  }
  async function review() {
    if (!document) return; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/agents/policy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: document.id, rules: configuration.policy, citations }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const reviewed = data as ReviewedPolicy;
      onChange({ ...configuration, policy: reviewed.rules, reviewedPolicyId: reviewed.id }); setMessage('Reviewed policy applied. Runs will retain the source hash, passages and rule version.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Review failed.'); } finally { setBusy(false); }
  }
  function update(index: number, patch: Partial<RuleCitation>) { setCitations(current => current.map((value, i) => i === index ? { ...value, ...patch } : value)); }
  return <details><summary>Upload and review policy</summary><p>Uploaded text provides evidence. Review the numeric rules above and cite their basis; no numeric effect is inferred automatically. If a rule is absent, keep it as a planning assumption rather than applying a reviewed policy.</p><label>Policy PDF or UTF-8 text<input type="file" accept=".pdf,.txt" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); }}/></label>
    {document && <><p>{document.fileName}<br/>SHA-256: {document.hash}</p><details><summary>Extracted source pages</summary>{document.pages.map(page => <div key={page.page}><h4>Page {page.page}</h4><pre>{page.text}</pre></div>)}</details>{citations.map((citation, index) => <fieldset key={citation.field}><legend>{citation.field}: {configuration.policy[citation.field]}</legend><label>Source page<input type="number" min="1" value={citation.page} onChange={e => update(index, { page: Number(e.target.value) })}/></label><label>Exact source passage<textarea value={citation.quote} onChange={e => update(index, { quote: e.target.value })}/></label><label>Why this passage supports the configured value<textarea value={citation.rationale} onChange={e => update(index, { rationale: e.target.value })}/></label></fieldset>)}<button disabled={busy || citations.some(c => c.quote.trim().length < 8 || !c.rationale.trim())} onClick={review}>Apply reviewed rules</button></>}
    {configuration.reviewedPolicyId && <p>Applied review: {configuration.reviewedPolicyId}. Stored rules take precedence when running the scenario.</p>}<p role="status">{message}</p></details>;
}
