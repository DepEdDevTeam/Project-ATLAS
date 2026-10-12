const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/agents/planning-contract.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
const origin = process.env.ATLAS_VERIFY_ORIGIN || 'http://localhost:3003';
async function json(route, options) {
  const response = await fetch(`${origin}${route}`, { ...options, signal: AbortSignal.timeout(600000) });
  const value = await response.json();
  assert.ok(response.ok, JSON.stringify(value));
  return value;
}
(async () => {
  if (process.env.ATLAS_VERIFY_PDF_PATH) {
    const pdfForm = new FormData();
    pdfForm.set('file', new File([fs.readFileSync(process.env.ATLAS_VERIFY_PDF_PATH)], 'verification-extraction-fixture.pdf', { type: 'application/pdf' }));
    const pdf = await json('/api/agents/policy', { method: 'POST', body: pdfForm });
    assert.ok(pdf.pages.length && pdf.pages.some(page => page.text.trim()), 'PDF upload must extract nonempty source pages');
    assert.equal(pdf.hash, require('node:crypto').createHash('sha256').update(fs.readFileSync(process.env.ATLAS_VERIFY_PDF_PATH)).digest('hex'));
    console.log(`PDF extraction fixture passed: ${pdf.pages.length} source pages, original bytes hashed.`);
  }
  const text = 'SYNTHETIC VERIFICATION FIXTURE ONLY. This is not an official policy. Eligible proportion: 75 percent. Effective from 2026 through 2028. Funding cap: PHP 500000000.';
  const form = new FormData();
  form.set('file', new File([text], 'synthetic-verification-policy.txt', { type: 'text/plain' }));
  const document = await json('/api/agents/policy', { method: 'POST', body: form });
  assert.equal(document.pages[0].text, text);
  assert.deepEqual(await json(`/api/agents/policy?id=${document.id}`), document);
  const rules = { ...exportsObject.defaultConfiguration.policy, title: 'Synthetic verification rules — not official policy', eligiblePct: 75, startYear: 2026, endYear: 2028, fundingCapPhp: 500000000 };
  const citations = ['eligiblePct', 'startYear', 'endYear', 'fundingCapPhp'].map(field => ({ field, page: 1, quote: text, rationale: 'Synthetic end-to-end verification of manually reviewed constraints only.' }));
  const invalid = await fetch(`${origin}/api/agents/policy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: document.id, rules, citations: citations.slice(1) }) });
  assert.equal(invalid.status, 400);
  const review = await json('/api/agents/policy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: document.id, rules, citations }) });
  console.log('Policy upload, exact text retrieval, invalid review rejection and reviewed version passed; running the full policy scenario.');
  const run = await json('/api/agents/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...exportsObject.defaultConfiguration, targetYear: 2028, reviewedPolicyId: review.id }) });
  assert.deepEqual(run.configuration.policy, rules, 'stored reviewed constraints must override conflicting client rules');
  assert.equal(run.policyDocument.hash, document.hash);
  assert.equal(run.policyReview.id, review.id);
  assert.equal(run.results.find(domain => domain.domain === 'policy').calculations.find(c => c.id === 'eligible-budget').value, 375000000);
  const policyResearch = run.research.filter(chunk => chunk.hash === document.hash);
  assert.equal(policyResearch.length, 4);
  assert.ok(policyResearch.every(chunk => chunk.page === 1 && chunk.text === text));
  for (const results of [run.results, ...run.timeline.map(p => p.results), ...run.alternatives.map(s => s.results)]) {
    assert.ok(results.find(d => d.domain === 'policy').calculations.every(c => c.sourceIds.includes(document.id)));
  }
  assert.ok(run.validation.calculationChecks.every(c => c.status !== 'failed'));
  assert.equal(run.reporterReview.status, 'reviewed', run.reporterReview.error);
  assert.equal(run.reporter.mode, 'model', run.reporter.error);
  for (const agent of ['social', 'technology', 'economic', 'environment', 'policy', 'synthesis']) {
    assert.equal(run.interpretations.find(item => item.agent === agent)?.mode, 'model', `${agent} output is required for the full workflow`);
  }
  assert.equal(run.validator.mode, 'model', run.validator.error);
  assert.equal(run.initialReview.status, 'reviewed', run.initialReview.error);
  if (run.revision) {
    assert.equal(run.revision.mode, 'model', run.revision.error);
    assert.equal(run.revisionReview.status, 'reviewed', run.revisionReview.error);
  }
  assert.deepEqual(await json(`/api/agents/runs?id=${run.id}`), run);
  const html = await fetch(`${origin}/api/agents/runs?id=${run.id}&format=html`);
  assert.equal(html.status, 200);
  const exported = await html.text();
  assert.ok(exported.includes('Research and policy passage register'));
  assert.ok(exported.includes(document.hash));
  assert.ok(exported.includes(text));
  console.log(JSON.stringify({ runId: run.id, policyId: document.id, reviewedPolicyId: review.id, policyResearchPassages: policyResearch.length, eligibleBudgetPhp: 375000000, reportClaims: run.report.claims.length }));
  console.log('Policy API-to-agent-to-reviewed-report verification passed using a clearly labelled synthetic fixture.');
})().catch(error => { console.error(error); process.exitCode = 1; });
