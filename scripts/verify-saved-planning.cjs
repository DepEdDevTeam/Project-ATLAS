const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-saved-verification-'));
try {
  const source = fs.readFileSync(path.join(__dirname, '../lib/agents/calculation-validator.ts'), 'utf8');
  const modulePath = path.join(temporary, 'validator.cjs');
  fs.writeFileSync(modulePath, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
  const { validateCalculations } = require(modulePath);
  fs.writeFileSync(path.join(temporary, 'scenario-evidence.js'), ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/agents/scenario-evidence.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
  const reportPath = path.join(temporary, 'report.cjs');
  fs.writeFileSync(reportPath, ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/agents/report-renderer.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
  const { renderExecutiveReport, escapeHtml } = require(reportPath);
  const ids = process.argv.slice(2);
  assert.ok(ids.length, 'Provide the saved run IDs to verify.');
  for (const id of ids) {
    assert.match(id, /^[a-f0-9-]{36}$/);
    const run = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/planning-runs', `${id}.json`), 'utf8'));
    const scopes = [{ label: 'selected', results: run.results }, ...run.timeline.map(point => ({ label: `year ${point.year}`, results: point.results })), ...run.alternatives.map(scenario => ({ label: scenario.id, results: scenario.results }))];
    let checked = 0;
    for (const scope of scopes) {
      const checks = validateCalculations(scope.results, run.sources);
      assert.deepEqual(checks.filter(check => check.status === 'failed'), [], `${id}, ${scope.label}`);
      assert.ok(checks.every(check => check.dependenciesConsistent));
      checked += checks.length;
    }
    const html = renderExecutiveReport(run);
    assert.ok(html.includes('Yearly and alternative calculation register'));
    for (const point of run.timeline) {
      for (const calculation of point.results.flatMap(domain => domain.calculations)) {
        assert.ok(html.includes(escapeHtml(`year:${point.year}:${calculation.id}`)) && html.includes(escapeHtml(calculation.formula)), 'every yearly outcome must preserve its scoped calculation evidence in the export');
      }
    }
    for (const scenario of run.alternatives) {
      for (const calculation of scenario.results.flatMap(domain => domain.calculations)) {
        assert.ok(html.includes(escapeHtml(`alternative:${scenario.id}:${calculation.id}`)) && html.includes(escapeHtml(calculation.formula)), 'every alternative outcome must preserve its scoped calculation evidence in the export');
      }
    }
    assert.ok(html.includes('Research and policy passage register'));
    for (const chunk of run.research) {
      assert.ok(html.includes(escapeHtml(chunk.id)) && html.includes(escapeHtml(chunk.hash)), 'each retained research passage must be traceable in the export');
      assert.ok(html.includes(escapeHtml(chunk.text)), 'exports must preserve the actual retained excerpt');
    }
    assert.ok(!/<script\b/i.test(html), 'executive export must not contain executable scripts');
    console.log(`${id}: ${scopes.length} saved scopes, ${checked} arithmetic/dependency/provenance checks passed or explicitly unavailable.`);
  }
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
