import type { Calculation, DomainResult, Evidence } from './planning-contract';
export type CalculationCheck = { id: string; status: 'passed' | 'failed' | 'unavailable'; arithmetic: boolean; dependenciesConsistent: boolean; sourcesResolved: boolean; assumptionsDisclosed: boolean; reason: string };
// Independent arithmetic implementation using the recorded operands rather than invoking modules again.
function expected(x: Calculation): number | null {
  const i = x.inputs;
  if (Object.values(i).some(n => n === null)) return null;
  const n = i as Record<string, number>;
  if (x.id.startsWith('observed.') || x.id.endsWith('.rate')) return n.observation;
  if (x.id.endsWith('.cohort')) {
    let persons = 0;
    for (const key of Object.keys(n).filter(k => k.endsWith(' thousand persons'))) {
      persons += n[key] * 1000 * n[key.replace(' thousand persons', ' allocated fraction')];
    }
    return persons * (1 + n.populationChangePct / 100);
  }
  if (x.id.endsWith('.enrollment')) return Math.round(n.cohort * Math.max(0, Math.min(100, n.netEnrollmentRate + n.accessChangePp)) * n.progressionPct / 10000);
  switch (x.id) {
    case 'learner-demand': return Object.values(n).reduce((a, b) => a + b, 0);
    case 'devices-required': return Math.ceil(n.learnerDemand / n.learnersPerDevice);
    case 'device-gap': return Math.max(0, n.requiredDevices - n.observedDevices);
    case 'connectivity-gap': return Math.max(0, Math.ceil(n.offerings * n.targetPct / 100) - n.connectedOfferings);
    case 'room-gap': return Math.max(0, Math.ceil(n.learnerDemand / n.learnersPerRoom) - n.usableRooms);
    case 'investment-need': return n.roomGap * n.roomCostPhp + n.deviceGap * n.deviceCostPhp;
    case 'funded-rooms': return Math.min(n.roomGap, Math.floor((n.eligibleBudget - n.maintenance) / n.roomCostPhp));
    case 'funded-devices': return Math.min(n.deviceGap, Math.floor((n.eligibleBudget - n.maintenance - n.fundedRooms * n.roomCostPhp) / n.deviceCostPhp));
    case 'annual-spend': return n.maintenance + n.fundedRooms * n.roomCostPhp + n.fundedDevices * n.deviceCostPhp;
    case 'unfunded-need': return Math.max(0, n.capitalNeed - n.annualSpend + n.maintenance);
    case 'exposed-offerings': return Math.round(n.offerings * n.hazardExposurePct / 100);
    case 'disrupted-offering-days': return n.exposedOfferings * n.disruptionDays;
    case 'policy-active': return n.startYear <= n.targetYear && n.targetYear <= n.endYear ? 1 : 0;
    case 'eligible-budget': return n.active * Math.min(n.budgetPhp, n.fundingCapPhp) * n.eligiblePct / 100;
    default: return NaN;
  }
}
export function validateCalculations(results: DomainResult[], sources: Evidence[]): CalculationCheck[] {
  const ids = new Set(sources.map(x => x.id));
  const seen = new Set<string>();
  const values = new Map(results.flatMap(domain => domain.calculations.map(x => [x.id, x.value] as const)));
  const dependencyInputs: Record<string, Record<string, string>> = {
    'devices-required': { learnerDemand: 'learner-demand' },
    'device-gap': { requiredDevices: 'devices-required' },
    'room-gap': { learnerDemand: 'learner-demand' },
    'investment-need': { roomGap: 'room-gap', deviceGap: 'device-gap' },
    'funded-rooms': { roomGap: 'room-gap', eligibleBudget: 'eligible-budget' },
    'funded-devices': { deviceGap: 'device-gap', eligibleBudget: 'eligible-budget', fundedRooms: 'funded-rooms' },
    'annual-spend': { fundedRooms: 'funded-rooms', fundedDevices: 'funded-devices' },
    'unfunded-need': { capitalNeed: 'investment-need', annualSpend: 'annual-spend' },
    'disrupted-offering-days': { exposedOfferings: 'exposed-offerings' },
    'eligible-budget': { active: 'policy-active' },
  };
  return results.flatMap(domain => domain.calculations.map(x => {
    const target = expected(x);
    const arithmetic = x.value === null ? target === null || x.status === 'unavailable' : target !== null && Number.isFinite(x.value) && x.value >= 0 && Math.abs(x.value - target) <= Math.max(1e-6, Math.abs(target) * 1e-12);
    const sourcesResolved = x.sourceIds.every(id => ids.has(id));
    const assumptionsDisclosed = x.assumptions.length > 0;
    const duplicate = seen.has(x.id); seen.add(x.id);
    const references = x.id.endsWith('.enrollment') ? { cohort: x.id.replace('.enrollment', '.cohort'), netEnrollmentRate: x.id.replace('.enrollment', '.rate') } : x.id === 'learner-demand' ? Object.fromEntries(['kindergarten', 'elementary', 'jhs', 'shs'].map(stage => [`${stage}.enrollment`, `${stage}.enrollment`])) : dependencyInputs[x.id] || {};
    const dependenciesConsistent = Object.entries(references).every(([input, calculationId]) => values.has(calculationId) && x.inputs[input] === values.get(calculationId));
    const status = !arithmetic || !dependenciesConsistent || !sourcesResolved || !assumptionsDisclosed || duplicate ? 'failed' : x.value === null ? 'unavailable' : 'passed';
    return { id: x.id, status, arithmetic, dependenciesConsistent, sourcesResolved, assumptionsDisclosed, reason: duplicate ? 'Duplicate calculation ID.' : !arithmetic ? 'Recorded output disagrees with operands.' : !dependenciesConsistent ? 'Recorded operands disagree with upstream calculation results.' : !sourcesResolved ? 'Unresolved evidence reference.' : !assumptionsDisclosed ? 'Missing assumptions.' : x.value === null ? 'Inputs or aligned evidence unavailable.' : 'Independent arithmetic, dependency and provenance checks passed.' };
  }));
}
