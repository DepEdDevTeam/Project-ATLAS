const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../lib/agents/planning-contract.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject });
const origin = process.env.ATLAS_VERIFY_ORIGIN || 'http://localhost:3002';
async function json(url, options) {
  const response = await fetch(`${origin}${url}`, { ...options, signal: AbortSignal.timeout(600000) });
  const value = await response.json(); assert.ok(response.ok, JSON.stringify(value)); return value;
}
(async () => {
  const invalid = await fetch(`${origin}/api/agents/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(invalid.status, 400);
  const instructions = await json('/api/agents/instructions');
  assert.equal(Object.keys(instructions.instructions).length, 8);
  const summaries = [];
  for (const populationChangePct of [0, 10]) {
    console.log(`Running complete workflow with population adjustment ${populationChangePct}%.`);
    const run = await json('/api/agents/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...exportsObject.defaultConfiguration, populationChangePct }) });
    assert.equal(run.schemaVersion, 2);
    assert.equal(run.results.length, 5);
    assert.equal(run.timeline.length, 5);
    assert.equal(run.alternatives.length, 3);
    assert.equal(Object.keys(run.instructionVersions).length, 8);
    assert.equal(run.interpretations.length, 6);
    for (const agent of ['social', 'technology', 'economic', 'environment', 'policy']) {
      const specialist = run.interpretations.find(item => item.agent === agent);
      assert.equal(specialist?.mode, 'model', specialist?.error || `${agent} specialist did not run`);
      assert.equal(specialist.instructionVersion, run.instructionVersions[agent].id);
    }
    assert.equal(run.synthesis.mode, 'model', run.synthesis.error);
    assert.equal(run.validator.mode, 'model', run.validator.error);
    assert.equal(run.initialReview.status, 'reviewed', run.initialReview.error);
    if (run.revision) {
      assert.equal(run.revision.mode, 'model', run.revision.error);
      assert.equal(run.revisionReview.status, 'reviewed', run.revisionReview.error);
    }
    assert.equal(run.reporter.mode, 'model', run.reporter.error);
    assert.equal(run.reporterReview.status, 'reviewed', run.reporterReview.error);
    assert.ok(run.report.claims.length, 'The complete workflow must produce at least one reviewed executive finding.');
    assert.ok(run.validation.calculationChecks.every(x => x.status !== 'failed'), JSON.stringify(run.validation.calculationChecks));
    assert.equal(run.validation.timelineValidation.length, run.timeline.length);
    assert.equal(run.validation.alternativeValidation.length, run.alternatives.length);
    for (const scope of [...run.validation.timelineValidation, ...run.validation.alternativeValidation]) {
      assert.notEqual(scope.status, 'failed');
      assert.ok(scope.calculationChecks.every(check => check.status !== 'failed'));
      assert.ok(scope.coverage.every(item => item.status !== 'invalid'));
    }
    assert.ok(run.report.claims.every(x => x.status !== 'unsupported' && !x.reviewRequired));
    assert.ok(!run.report.claims.length || run.reporterReview.status === 'reviewed');
    const loaded = await json(`/api/agents/runs?id=${run.id}`);
    assert.deepEqual(loaded, run, 'saved report must retain the actual run exactly');
    const html = await fetch(`${origin}/api/agents/runs?id=${run.id}&format=html`);
    assert.equal(html.status, 200);
    assert.ok(html.headers.get('content-disposition').includes(`${run.id}.html`));
    const text = await html.text();
    for (const required of ['Evidence register', 'Instruction versions', 'Calculation validation', 'Year-by-year learner demand', 'Yearly and alternative calculation register', run.id]) assert.ok(text.includes(required));
    const demand = run.results[0].calculations.find(x => x.id === 'learner-demand').value;
    summaries.push({ id: run.id, populationChangePct, demand, validation: run.validation.status, review: run.reporterReview.status, reportClaims: run.report.claims.length });
    console.log(JSON.stringify(summaries.at(-1)));
  }
  assert.ok(summaries[1].demand > summaries[0].demand);
  const list = await json('/api/agents/runs');
  assert.ok(summaries.every(run => list.runs.some(saved => saved.id === run.id)));
  console.log('API workflow verification passed: changed configuration, five domains, timelines, alternatives, review gate, exact saved-run reload and executive HTML export.');
})().catch(error => { console.error(error); process.exitCode = 1; });
