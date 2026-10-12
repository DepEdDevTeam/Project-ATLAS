const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const original = process.cwd();
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-storage-test-'));
(async () => {
  try {
    for (const name of ['planning-contract', 'policy-store', 'instruction-store', 'hazard-connector']) {
      fs.writeFileSync(path.join(temporary, `${name}.js`), ts.transpileModule(fs.readFileSync(path.join(original, 'lib/agents', `${name}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText);
    }
    process.chdir(temporary);
    const store = require(path.join(temporary, 'policy-store.js'));
    const instructions = require(path.join(temporary, 'instruction-store.js'));
    const hazards = require(path.join(temporary, 'hazard-connector.js'));
    const { defaultConfiguration } = require(path.join(temporary, 'planning-contract.js'));
    const text = 'All eligible schools may use the allocation from 2026 through 2030, up to one billion pesos.';
    const document = await store.savePolicyDocument(Buffer.from(text), 'policy.txt', [{ page: 1, text }], 'https://example.org/policy');
    const citations = ['eligiblePct', 'startYear', 'endYear', 'fundingCapPhp'].map(field => ({ field, page: 1, quote: text, rationale: 'Manual review of the stated scope and constraints.' }));
    const review = await store.saveReviewedPolicy(document.id, defaultConfiguration.policy, citations);
    const hazardSnapshot = await hazards.importHazardAssessment({ schemaVersion: 1, title: 'Synthetic storage test', sourceUrl: 'https://example.org/test-hazard', release: 'test-only', geography: 'NCR', period: '2026', hazard: 'test', definition: 'Synthetic test fixture, not real exposure data', expectedSchoolCount: 1, schools: [{ schoolId: 'test-school', exposed: true }] });
    assert.equal((await hazards.readHazardSnapshot(hazardSnapshot.id)).hash, hazardSnapshot.hash);
    assert.equal(review.documentHash, document.hash);
    assert.equal((await store.readPolicyDocument(document.id)).pages[0].text, text);
    const initial = (await instructions.instructionHistory('social')).at(-1);
    const concurrent = await Promise.allSettled([
      instructions.saveInstructions('social', 'First version.', initial.id),
      instructions.saveInstructions('social', 'Stale concurrent version.', initial.id),
    ]);
    assert.equal(concurrent.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(concurrent.filter(x => x.status === 'rejected').length, 1);
    assert.equal((await instructions.instructionHistory('social')).length, 2);
    const child = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict');
      (async () => {
        const policy = require('./policy-store.js');
        const instructions = require('./instruction-store.js');
        const hazards = require('./hazard-connector.js');
        const review = await policy.readReviewedPolicy(${JSON.stringify(review.id)});
        assert.equal(review.documentHash, ${JSON.stringify(document.hash)});
        assert.equal((await instructions.instructionHistory('social')).length, 2);
        assert.equal((await instructions.activeInstructions()).social.text, 'First version.');
        assert.equal((await hazards.readHazardSnapshot(${JSON.stringify(hazardSnapshot.id)})).hash, ${JSON.stringify(hazardSnapshot.hash)});
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `], { cwd: temporary, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    console.log('Planning storage checks passed: policy and hazard source hashes, quoted rule review, concurrent instruction conflict and persistence across process restart.');
  } finally { process.chdir(original); fs.rmSync(temporary, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
