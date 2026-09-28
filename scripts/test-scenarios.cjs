const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-tests-'));
for (const name of ['scenario-types','scenario-data','scenario-engine','scenario-explanation','enrollment-types','enrollment-store']) {
  const source = fs.readFileSync(path.join(__dirname,'..','lib',name+'.ts'),'utf8');
  fs.writeFileSync(path.join(dir,name+'.js'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText);
}
const { BASE_LEVERS, STRATEGIES, SHARES } = require(path.join(dir,'scenario-data.js'));
const { initialOutcomes, simulateYear, timeline } = require(path.join(dir,'scenario-engine.js'));
const l={...BASE_LEVERS,budget:100,maintenanceCost:0,newRooms:100,rehabRooms:100,expansionRooms:100,annexes:10,resilienceRooms:100,exposedRooms:100,newCost:2,rehabCost:1,expansionCost:2,annexCost:10,resilienceCost:1,inventoryKnown:true,inventoryRooms:100,unusableRooms:20,pupilsPerRoom:40,roomsPerAnnex:6};
const start=initialOutcomes(4000,l);
assert.equal(start.remainingGap,20);
const y=simulateYear(start,l,'Balanced');
// Each category gets 20M: 10 new + 20 rehab + 10 expansion + 2 annexes + 20 retrofits.
assert.deepEqual(y.allocations.map(a=>a.funded),[10,20,10,2,20]);
assert.equal(y.addedRooms,32);assert.equal(y.availableRooms,132);assert.equal(y.remainingGap,0);
assert.equal(y.annualSpend,100);assert.equal(y.unspent,0);assert.equal(y.remainingExposure,80);
assert.equal(simulateYear(y,l,'Balanced',2).allocations[1].funded,0,'cannot restore the same unusable rooms twice');
assert.equal(simulateYear(start,{...l,budget:0},'Balanced').annualSpend,0);
assert.equal(simulateYear(start,{...l,eligibility:0},'Balanced').addedRooms,0);
assert.equal(simulateYear(start,{...l,fundingCycle:2},'Balanced',2).annualSpend,0);
const unknown=initialOutcomes(4000,{...l,inventoryKnown:false});
const u=simulateYear(unknown,{...l,inventoryKnown:false},'Balanced');
assert.equal(u.remainingGap,null);assert.equal(u.availableRooms,null);assert.equal(u.restoredRooms,0);
assert.equal(simulateYear(start,{...l,enrollmentGrowth:10,progression:1,access:-1},'Balanced').enrollment,4400);
const reserved=simulateYear(start,{...l,equityShare:100},'Balanced');
assert.equal(reserved.annualSpend,0);assert.equal(reserved.unspent,100);assert.equal(reserved.equityReserve,100);
const ict=simulateYear(start,{...l,ictShare:100,ictCost:2},'Balanced');
assert.equal(ict.allocations[0].funded,5);assert.equal(ict.allocations[3].unitCost,22);
for (const strategy of STRATEGIES) {
  assert.equal(SHARES[strategy].reduce((a,b)=>a+b,0),100);
  for(const budget of [0,1,19.99,100,1000]) {
    const run=timeline(4000,2025,2032,{...l,budget},strategy);
    assert.deepEqual(run,timeline(4000,2025,2032,{...l,budget},strategy));
    for(const {outcomes:o} of run) {
      assert.ok(o.annualSpend<=o.availableBudget+1e-8);
      assert.ok(o.unspent>=0&&o.remainingGap>=0&&o.remainingExposure>=0);
      for(const a of o.allocations)assert.ok(Number.isInteger(a.funded)&&a.funded<=a.requested);
    }
  }
}
assert.throws(()=>initialOutcomes(100,{...l,unusableRooms:101}),/Unusable/);
assert.throws(()=>initialOutcomes(100,{...l,newCost:0}),/Unit costs/);
assert.throws(()=>initialOutcomes(100,{...l,enrollmentGrowth:NaN}),/Invalid/);
assert.throws(()=>initialOutcomes(100,{...l,fundingCycle:0}),/positive/);
assert.throws(()=>initialOutcomes(100,{...l,newRooms:1.5}),/whole/);
console.log('Scenario tests passed: exact calculations, missing inventory, zero budget, eligibility, funding cycle, ICT, rehabilitation caps, equity reserve and all strategy budget invariants.');
if(fs.existsSync(path.join(process.cwd(),'data/enrollment.sqlite'))) {
  const {areas,enrollmentData}=require(path.join(dir,'enrollment-store.js'));
  const national=enrollmentData({level:'national',key:'[]',sector:'All'});
  assert.equal(national.history.length,9);assert.equal(national.history.at(-1).enrollment,25935863);
  const school=enrollmentData({level:'school',key:'["100001"]',sector:'All'});
  assert.deepEqual(school.history.map(h=>h.enrollment),[81,76,59,55,54,54,58,59,61]);
  assert.equal(school.breakdown.find(b=>b.name==='kinder').male,9);
  assert.equal(school.breakdown.find(b=>b.name==='g11_sshs_acad').male,null);
  assert.equal(school.curriculum[0].name,'Purely ES');
  const historic=enrollmentData({level:'school',key:'["100001"]',sector:'All'},2017);
  assert.equal(historic.breakdownYear,2017);
  assert.equal(historic.breakdown.reduce((sum,b)=>sum+(b.male??0)+(b.female??0),0),81);
  assert.equal(historic.curriculum[0].name,'Not supplied');
  for(const level of ['region','division','province','municipality','barangay','school']) {
    const opts=areas(level,level==='school'?'100001':'','Public');assert.ok(opts.length>0);
    const result=enrollmentData({level,key:opts[0].key,sector:'Public'});assert.ok(result.history.length>0);
  }
  assert.equal(enrollmentData({level:'school',key:'["does-not-exist"]',sector:'All'}).history.length,0);
  assert.throws(()=>enrollmentData({level:'region',key:'[]',sector:'All'}),/Invalid area/);
  assert.equal(areas('school',"' OR 1=1 --",'All').length,0);
  console.log('Data store tests passed: all seven levels, exact school history, SHS nulls, curricular classification, empty data and parameterized search.');
}

const { explainScenario } = require(path.join(dir,'scenario-explanation.js'));
const explanation = explainScenario(y,start,l);
assert.equal(explanation.places,2080,'new, expansion, annex and restored rooms add places');
assert.equal(explanation.enrollmentChange,0,'funding does not increase enrollment');
assert.equal(explanation.upgraded,20,'resilience does not add places');
assert.equal(explainScenario(u,unknown,{...l,inventoryKnown:false}).places,1280,'unverified rehabilitation adds no capacity');
assert.equal(explainScenario(u,unknown,l).gapChange,null);
const cycle = timeline(4000,2025,2028,{...l,fundingCycle:2},'Balanced');
const off = explainScenario(cycle[2].outcomes,cycle[1].outcomes,l);
assert.equal(off.places,0,'off-cycle year shows annual rather than cumulative capacity');
assert.equal(off.fundingChange,-100);
assert.match(off.reason,/No eligible funding/);
const resumed = explainScenario(cycle[3].outcomes,cycle[2].outcomes,l);
assert.equal(resumed.fundingChange,100);
assert.equal(resumed.restored,0,'restoration cannot be credited twice');
assert.equal(resumed.places,1280);
const growing = simulateYear(start,{...l,budget:0,enrollmentGrowth:10},'Balanced');
assert.equal(explainScenario(growing,start,l).enrollmentChange,400);
assert.match(explainScenario(growing,start,l).reason,/gap widens/);
console.log('Explanation tests passed: annual deltas, funding cycles, inventory, capacity and enrollment separation.');
