import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readPsaEvidence } from './data-evidence.service';
import { sourceEvidence } from './social.module';
import type { Evidence, PlanningConfiguration } from './planning-contract';
import type { Infrastructure } from './steep.modules';
import { mapNationalProfile } from './national-profile';
import { selectBudgetSource } from './budget-source';
export type ResearchChunk = { id: string; source: string; page: number; text: string; hash: string; hashScope?: 'retrieval-index' | 'original-document' };
export async function retrieveResearch(query: string): Promise<ResearchChunk[]> {
  const dir = path.join(process.cwd(), 'data/research');
  const terms = query.toLowerCase().split(/\W+/).filter(x => x.length > 3);
  let files: string[];
  try { files = await readdir(dir); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const chunks: (ResearchChunk & { score: number })[] = [];
  for (const file of files.filter(x => x.endsWith('-chunks.json'))) {
    const bytes = await readFile(path.join(dir, file), 'utf8');
    const document = JSON.parse(bytes);
    for (const chunk of document.chunks || []) {
      if (typeof chunk.text !== 'string' || !Number.isInteger(chunk.pdf_page)) continue;
      const score = terms.reduce((sum, term) => sum + (chunk.text.toLowerCase().includes(term) ? 1 : 0), 0);
      if (score) chunks.push({ id: `${file}:${chunk.id}`, source: document.source_file, page: chunk.pdf_page, text: chunk.text.slice(0, 5000), hash: createHash('sha256').update(bytes).digest('hex'), hashScope: 'retrieval-index', score });
    }
  }
  return chunks.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 8).map(({ score: _score, ...chunk }) => chunk);
}
const numeric = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
export async function infrastructureEvidence(c: PlanningConfiguration): Promise<{ infrastructure: Infrastructure | null; sources: Evidence[]; gaps: string[] }> {
  try {
    const name = 'atlas-planning-evidence';
    const app = getApps().find(x => x.name === name) || initializeApp({ projectId: process.env.DEPED_FIREBASE_PROJECT_ID || 'depedprototype', credential: applicationDefault() }, name);
    const db = getFirestore(app, process.env.DEPED_FIREBASE_DATABASE_ID || 'depedprot');
    const [snapshot, budgetSnapshot, nationalAggregate] = await Promise.all([
      c.geography === 'PHILIPPINES' ? db.collection('national_summaries').doc('philippines').get() : db.collection('regional_profiles').doc(c.geography).get(),
      db.collection('mv_mooe_allocation_by_region').where('region', '==', c.geography).get(),
      c.geography === 'PHILIPPINES' ? db.collection('national_summaries').doc('national_aggregate').get() : Promise.resolve(null),
    ]);
    if (!snapshot.exists) return { infrastructure: null, sources: [], gaps: ['No matched DepEd regional profile.'] };
    const original = snapshot.data()!;
    const aggregate = nationalAggregate?.data() || {};
    const p = c.geography === 'PHILIPPINES' ? mapNationalProfile(original, aggregate) : original;
    const hash = createHash('sha256').update(JSON.stringify(c.geography === 'PHILIPPINES' ? { philippines: original, national_aggregate: aggregate } : original)).digest('hex');
    const sourceId = `deped:${c.geography}:${hash.slice(0, 12)}`;
    const aggregateVersion = nationalAggregate?.updateTime?.toDate().toISOString();
    if (c.geography === 'PHILIPPINES') p.sourceRecordNote = `national_summaries/philippines update ${snapshot.updateTime?.toDate().toISOString() || 'unversioned'}; national_summaries/national_aggregate update ${aggregateVersion || 'unavailable'}; source hash covers both records.`;
    const offeringValues = ['es', 'jhs', 'shs'].map(stage => numeric(p[`schools_with_${stage}_2324`]));
    const connectedValues = ['es', 'jhs', 'shs'].map(stage => numeric(p[`wash_2324_${stage}_has_internet`]));
    const sum = (values: (number | null)[]) => values.some(x => x === null) ? null : values.reduce<number>((a, b) => a + b!, 0);
    const budgetSelection = selectBudgetSource(budgetSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data(), updatedAt: doc.updateTime?.toDate().toISOString() })), c.baseYear);
    const budget = budgetSelection.row;
    const budgetHash = budget ? createHash('sha256').update(JSON.stringify(budget.data)).digest('hex') : '';
    const budgetId = budget ? `deped-mooe:${budget.id}:${budgetHash.slice(0, 12)}` : undefined;
    return {
      infrastructure: { geography: c.geography, period: 'SY 2023-2024', sourceId,
        // A total classroom count is not a verified usable-room inventory.
        usableRooms: numeric(p.usable_classrooms_total_2324), devices: numeric(p.ict_academic_devices_2324),
        schoolOfferings: sum(offeringValues), connectedOfferings: sum(connectedValues),
        hazardExposedOfferings: null, maintenanceNeedPhp: null,
        instructionalRooms: sum(['es', 'jhs', 'shs'].map(stage => numeric(p[`fac_2324_classrooms_instructional_${stage}`]))),
        buildingsNeedingRepair: numeric(p.fac_2324_buildings_needing_repair),
        walkingAccessOfferings: sum(['es', 'hs'].map(stage => numeric(p[`fac_2324_${stage}_accessible_walking_hiking`]))),
        floodMarkerOfferings: sum(['es', 'hs'].map(stage => numeric(p[`fac_2324_${stage}_has_flood_marker`]))),
        operatingAllocationPhp: numeric(budget?.data.school_mooe_total_php), operatingSourceId: budgetId, operatingPeriod: budget ? `FY ${budget.data.fiscal_year}` : undefined },
      sources: [{ id: sourceId, title: c.geography === 'PHILIPPINES' ? 'DepEd stored national summary (national_summaries/philippines)' : 'DepEd regional profile', url: `https://console.firebase.google.com/project/${app.options.projectId}/firestore`, geography: c.geography, period: 'SY 2023-2024', unit: 'mixed; see calculation', release: snapshot.updateTime?.toDate().toISOString() || 'unversioned', hash, retrievedAt: new Date().toISOString() }, ...(budget && budgetId ? [{ id: budgetId, title: String(budget.data.source || 'DepEd MOOE allocation'), url: `https://console.firebase.google.com/project/${app.options.projectId}/firestore`, geography: c.geography, period: `FY ${budget.data.fiscal_year}`, unit: 'PHP', release: budget.updatedAt || 'unversioned', hash: budgetHash, retrievedAt: new Date().toISOString() }] : [])],
      gaps: ['Usable room counts, verified hazard exposure and maintenance needs require dedicated observations; total classrooms and flood markers are not substitutes.', ...(budgetSelection.gap ? [budgetSelection.gap] : []), ...(c.geography === 'PHILIPPINES' ? ['National observations come from stored national summaries, not a fresh regional sum. Sector and reporting completeness must be reviewed before interpreting these as complete national inventories.', String(p.sourceRecordNote)] : [])],
    };
  } catch { return { infrastructure: null, sources: [], gaps: ['DepEd connector unavailable; check credentials and database access.'] }; }
}
export async function planningEvidence(c: PlanningConfiguration) {
  const [psa, infrastructure, research] = await Promise.all([readPsaEvidence(), infrastructureEvidence(c), retrieveResearch('education enrollment migration access technology budget climate hazard policy')]);
  return { psa, infrastructure: infrastructure.infrastructure, sources: [...psa.map(sourceEvidence), ...infrastructure.sources], gaps: infrastructure.gaps, research };
}
