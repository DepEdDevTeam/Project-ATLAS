export const domains = ['social', 'technology', 'economic', 'environment', 'policy'] as const;
export type Domain = typeof domains[number];
export type Evidence = {
  id: string; title: string; url: string; geography: string; period: string;
  unit: string; release: string; hash: string; retrievedAt: string;
};
export type Calculation = {
  id: string; label: string; value: number | null; unit: string; formula: string;
  inputs: Record<string, number | null>; sourceIds: string[]; assumptions: string[];
  status: 'supported' | 'conditional' | 'unavailable';
};
export type DomainResult = {
  domain: Domain; geography: string; year: number; calculations: Calculation[];
  dependencies: Domain[]; limitations: string[];
};
export type Stage = 'kindergarten' | 'elementary' | 'jhs' | 'shs';
export const stages: Stage[] = ['kindergarten', 'elementary', 'jhs', 'shs'];
export type PlanningConfiguration = {
  geography: string; baseYear: number; targetYear: number;
  populationChangePct: number; progressionPct: number; accessChangePp: number;
  rateYear: number; stageAges: Record<Stage, [number, number]>;
  learnersPerRoom: number; learnersPerDevice: number; connectivityTargetPct: number;
  budgetPhp: number; roomCostPhp: number; deviceCostPhp: number; maintenancePhp: number;
  hazardExposurePct: number; disruptionDays: number;
  reviewedPolicyId?: string;
  hazardSnapshotId?: string;
  policy: { title: string; sourceUrl: string; eligiblePct: number; startYear: number; endYear: number; fundingCapPhp: number };
};
export const defaultConfiguration: PlanningConfiguration = {
  geography: 'PHILIPPINES', baseYear: 2026, targetYear: 2030,
  populationChangePct: 0, progressionPct: 100, accessChangePp: 0, rateYear: 2024,
  stageAges: { kindergarten: [5, 5], elementary: [6, 11], jhs: [12, 15], shs: [16, 17] },
  learnersPerRoom: 40, learnersPerDevice: 10, connectivityTargetPct: 100,
  budgetPhp: 1000000000, roomCostPhp: 2500000, deviceCostPhp: 25000, maintenancePhp: 0,
  hazardExposurePct: 10, disruptionDays: 10,
  policy: { title: 'User planning constraints', sourceUrl: '', eligiblePct: 100, startYear: 2026, endYear: 2030, fundingCapPhp: 1000000000 },
};
export function validateConfiguration(value: unknown): asserts value is PlanningConfiguration {
  if (!value || typeof value !== 'object') throw new Error('Configuration must be an object.');
  const c = value as PlanningConfiguration;
  if (typeof c.geography !== 'string' || !c.geography.trim() || c.geography.length > 120) throw new Error('Choose a geography.');
  const bounds: Record<string, [number, number]> = {
    baseYear: [2020, 2030], targetYear: [2020, 2030], rateYear: [2000, 2026],
    populationChangePct: [-100, 100], progressionPct: [0, 100], accessChangePp: [-100, 100],
    learnersPerRoom: [1, 100], learnersPerDevice: [1, 1000], connectivityTargetPct: [0, 100],
    budgetPhp: [0, 1e13], roomCostPhp: [1, 1e10], deviceCostPhp: [1, 1e8], maintenancePhp: [0, 1e13],
    hazardExposurePct: [0, 100], disruptionDays: [0, 365],
  };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const n = c[key as keyof PlanningConfiguration];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new Error(`Invalid ${key}.`);
  }
  if (![c.baseYear, c.targetYear, c.rateYear].every(Number.isInteger) || c.targetYear < c.baseYear) throw new Error('Invalid planning years.');
  const seen = new Set<number>();
  for (const stage of stages) {
    const age = c.stageAges?.[stage];
    if (!Array.isArray(age) || age.length !== 2 || !age.every(Number.isInteger) || age[0] < 0 || age[1] > 24 || age[1] < age[0]) throw new Error(`Invalid ages for ${stage}.`);
    for (let n = age[0]; n <= age[1]; n++) { if (seen.has(n)) throw new Error('Stage ages must not overlap.'); seen.add(n); }
  }
  const p = c.policy;
  if (c.reviewedPolicyId !== undefined && (typeof c.reviewedPolicyId !== 'string' || !/^[a-f0-9-]{36}$/.test(c.reviewedPolicyId))) throw new Error('Invalid reviewed policy reference.');
  if (c.hazardSnapshotId !== undefined && (typeof c.hazardSnapshotId !== 'string' || !/^[a-f0-9-]{36}$/.test(c.hazardSnapshotId))) throw new Error('Invalid hazard snapshot reference.');
  if (!p || typeof p.title !== 'string' || !p.title.trim() || p.title.length > 500 || typeof p.sourceUrl !== 'string' || p.sourceUrl.length > 2000) throw new Error('Invalid policy metadata.');
  if (p.sourceUrl && !/^https?:\/\//.test(p.sourceUrl)) throw new Error('Policy source must use HTTP or HTTPS.');
  if (![p.eligiblePct, p.startYear, p.endYear, p.fundingCapPhp].every(n => typeof n === 'number' && Number.isFinite(n)) || p.eligiblePct < 0 || p.eligiblePct > 100 || p.startYear > p.endYear || !Number.isInteger(p.startYear) || !Number.isInteger(p.endYear) || p.fundingCapPhp < 0 || p.fundingCapPhp > 1e13) throw new Error('Invalid policy constraints.');
}
