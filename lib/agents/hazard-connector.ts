import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { Calculation, DomainResult, Evidence } from './planning-contract';
export type HazardAssessment = {
  schemaVersion: 1; title: string; sourceUrl: string; release: string; geography: string;
  period: string; hazard: string; expectedSchoolCount: number; definition: string;
  schools: { schoolId: string; exposed: boolean | null }[];
};
export type HazardSnapshot = HazardAssessment & { id: string; hash: string; importedAt: string };
export function validateHazardAssessment(value: unknown): asserts value is HazardAssessment {
  if (!value || typeof value !== 'object') throw new Error('Hazard assessment must be an object.');
  const s = value as HazardAssessment;
  if (s.schemaVersion !== 1) throw new Error('Unsupported hazard schema.');
  for (const field of ['title', 'sourceUrl', 'release', 'geography', 'period', 'hazard', 'definition'] as const) {
    if (typeof s[field] !== 'string' || !s[field].trim() || s[field].length > 2000) throw new Error(`Missing or invalid ${field}.`);
  }
  if (!/^https:\/\//.test(s.sourceUrl)) throw new Error('Use the original HTTPS assessment-source URL.');
  if (!Number.isSafeInteger(s.expectedSchoolCount) || s.expectedSchoolCount < 1 || !Array.isArray(s.schools) || s.schools.length > s.expectedSchoolCount || s.schools.length > 100000) throw new Error('Invalid expected coverage or school records.');
  const ids = new Set<string>();
  for (const school of s.schools) {
    if (!school || typeof school.schoolId !== 'string' || !school.schoolId.trim() || school.schoolId.length > 100 || ids.has(school.schoolId) || ![true, false, null].includes(school.exposed)) throw new Error('Invalid or duplicate school assessment.');
    ids.add(school.schoolId);
  }
}
export async function importHazardAssessment(value: unknown): Promise<HazardSnapshot> {
  validateHazardAssessment(value);
  const snapshot = { ...value, id: randomUUID(), hash: createHash('sha256').update(JSON.stringify(value)).digest('hex'), importedAt: new Date().toISOString() };
  const dir = path.join(process.cwd(), 'data/hazard-snapshots');
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `${snapshot.id}.tmp`);
  await writeFile(temp, JSON.stringify(snapshot, null, 2), 'utf8');
  await rename(temp, path.join(dir, `${snapshot.id}.json`));
  return snapshot;
}
export async function readHazardSnapshot(id: string): Promise<HazardSnapshot> {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid hazard snapshot ID.');
  const snapshot = JSON.parse(await readFile(path.join(process.cwd(), 'data/hazard-snapshots', `${id}.json`), 'utf8')) as HazardSnapshot;
  validateHazardAssessment(snapshot);
  const { id: _id, hash, importedAt: _time, ...original } = snapshot;
  if (snapshot.id !== id || createHash('sha256').update(JSON.stringify(original)).digest('hex') !== hash) throw new Error('Hazard snapshot integrity check failed.');
  return snapshot;
}
export function hazardEvidence(snapshot: HazardSnapshot): Evidence {
  return { id: snapshot.id, title: snapshot.title, url: snapshot.sourceUrl, geography: snapshot.geography, period: snapshot.period, unit: 'unique schools', release: snapshot.release, hash: snapshot.hash, retrievedAt: snapshot.importedAt };
}
export function hazardCalculations(snapshot: HazardSnapshot | null, geography: string, year: number): DomainResult {
  const matched = snapshot?.geography === geography ? snapshot : null;
  const assessed = matched ? matched.schools.filter(x => x.exposed !== null).length : null;
  const exposed = matched ? matched.schools.filter(x => x.exposed === true).length : null;
  const complete = !!matched && assessed === matched.expectedSchoolCount;
  const assumptions = ['Imported assessment classifications retain the source definition; ATLAS does not independently certify the provider assessment.', 'Unassessed and missing schools are not counted as unexposed.', 'Unique schools are not interchangeable with education-stage offerings.'];
  const metric = (id: string, label: string, value: number | null, unit: string): Calculation => ({ id, label, value, unit, formula: 'count unique source school IDs under the recorded exposure classification', inputs: { observation: value }, sourceIds: matched ? [matched.id] : [], assumptions, status: value === null ? 'unavailable' : 'conditional' });
  return { domain: 'environment', geography, year, dependencies: [], limitations: matched ? [`Hazard: ${matched.hazard}. Assessment period: ${matched.period}. Definition: ${matched.definition}.`, complete ? 'All expected school records are assessed.' : 'Partial assessment coverage: regional/national exposure totals and rates are unavailable.'] : ['No geographically matched hazard assessment was selected.'], calculations: [
    metric('observed.hazard-assessed-schools', 'Assessed unique schools', assessed, 'schools'),
    metric('observed.hazard-exposed-assessed-schools', 'Exposed schools among assessed records', exposed, 'schools'),
    metric('observed.hazard-total-exposed-schools', 'Scope-wide exposed schools', complete ? exposed : null, 'schools'),
  ] };
}
