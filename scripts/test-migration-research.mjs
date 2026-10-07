import assert from 'node:assert/strict';
import { loadStudies, validateEvidence } from './migration-research.mjs';
import { regionalScenario } from './run-migration-agents.mjs';

const studies = await loadStudies([], 'data/research');
assert.ok(studies.length >= 2);
const ids = studies.flatMap(s => s.selected.map(c => c.id));
assert.equal(new Set(ids).size, ids.length);
const [study, other] = studies;
const chunk = study.selected.find(c => c.text.trim());
const finding = { chunk_id: chunk.id, pdf_page: chunk.pdf_page, quote: chunk.text.slice(0, 40) };
assert.equal(validateEvidence({ findings: [finding], data_gaps: [] }, study).evidence.findings.length, 1);
assert.equal(validateEvidence({ findings: [finding], data_gaps: [] }, other).rejectedFindings.length, 1);
assert.equal(validateEvidence({ findings: [{ ...finding, quote: 'NOT A VERBATIM QUOTE' }], data_gaps: [] }, study).rejectedFindings.length, 1);
assert.equal(validateEvidence({ findings: [{ ...finding, pdf_page: -1 }], data_gaps: [] }, study).rejectedFindings.length, 1);
assert.equal((await loadStudies([study.researchPath, study.researchPath])).length, 1);
await assert.rejects(loadStudies([], 'scripts'), /No chunks/);
const rows = regionalScenario([-0.5, 0, 0.5], 3822536, 25910491);
assert.equal(rows.at(-1).lowLearners, 3653922);
assert.equal(rows.at(-1).highLearners, 3998031);
for (const row of rows) {
  assert.equal(row.lowLearners + row.otherDomesticLow, 25910491);
  assert.equal(row.highLearners + row.otherDomesticHigh, 25910491);
}
console.log(`Passed: ${studies.length} studies, unique provenance, quote/page validation, deduplication and conservation.`);
