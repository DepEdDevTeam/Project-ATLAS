import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export async function loadStudies(inputs, directory) {
  const paths = [...inputs];
  if (directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    paths.push(...entries.filter(e => e.isFile() && e.name.endsWith('-chunks.json')).map(e => path.join(directory, e.name)).sort());
  }
  if (!paths.length) throw new Error('No chunks JSON inputs found.');
  const studies = [];
  const seen = new Set();
  for (const input of [...new Set(paths.map(p => path.resolve(p)))]) {
    const raw = await readFile(input, 'utf8');
    const hash = createHash('sha256').update(raw).digest('hex');
    if (seen.has(hash)) continue;
    seen.add(hash);
    const research = JSON.parse(raw);
    if (!Array.isArray(research.chunks) || !research.chunks.length || research.chunks.some(c => typeof c.id !== 'string' || !c.id || typeof c.text !== 'string' || !Number.isInteger(c.pdf_page) || c.pdf_page < 1)) throw new Error(`Invalid chunks JSON: ${input}`);
    if (new Set(research.chunks.map(c => c.id)).size !== research.chunks.length) throw new Error(`Duplicate chunk IDs: ${input}`);
    const sourceFile = research.source_file || research.chunks[0].source_file || path.basename(input);
    const studyId = `${path.basename(input, '.json')}:${hash.slice(0, 12)}`;
    const terms = /school|education|student|learner|reason.{0,30}mov|migration|climate|displac/gi;
    const selected = research.chunks.map(c => ({ ...c, score: (c.text.match(terms) || []).length }))
      .sort((a, b) => b.score - a.score).slice(0, 24)
      .map(({ score, ...c }) => ({ ...c, original_chunk_id: c.id, id: `${studyId}:${c.id}`, study_id: studyId, source_file: sourceFile }));
    studies.push({ studyId, sourceFile, researchPath: input, contentHash: hash, totalChunks: research.chunks.length, selected });
  }
  return studies;
}

export function validateEvidence(evidence, study) {
  if (!Array.isArray(evidence.findings) || !Array.isArray(evidence.data_gaps)) throw new Error(`Invalid evidence structure: ${study.sourceFile}`);
  const findings = [], rejectedFindings = [];
  for (const f of evidence.findings) {
    const chunk = study.selected.find(c => c.id === f.chunk_id);
    if (chunk && chunk.pdf_page === f.pdf_page && typeof f.quote === 'string' && f.quote.trim() && chunk.text.includes(f.quote)) {
      findings.push({ ...f, study_id: study.studyId, source_file: study.sourceFile, original_chunk_id: chunk.original_chunk_id });
    } else rejectedFindings.push(f);
  }
  return { evidence: { findings, data_gaps: evidence.data_gaps }, rejectedFindings };
}
