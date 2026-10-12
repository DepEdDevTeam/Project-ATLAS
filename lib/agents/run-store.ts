import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { runPlanning } from './planning-orchestrator';
export type PlanningRun = Awaited<ReturnType<typeof runPlanning>>;
export async function readPlanningRun(id: string): Promise<PlanningRun> {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid run ID.');
  const run = JSON.parse(await readFile(path.join(process.cwd(), 'data/planning-runs', `${id}.json`), 'utf8'));
  if (run.schemaVersion !== 2 || run.id !== id || !run.report || !run.validation || !Array.isArray(run.results)) throw new Error('This run uses an earlier schema. Run the configuration again to use the current report viewer.');
  return run;
}
export async function listPlanningRuns() {
  let files: string[];
  try { files = await readdir(path.join(process.cwd(), 'data/planning-runs')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const runs = await Promise.all(files.filter(file => /^[a-f0-9-]{36}\.json$/.test(file)).map(async file => {
    try { const run = await readPlanningRun(file.slice(0, -5)); return { id: run.id, completedAt: run.completedAt, geography: run.configuration.geography, year: run.configuration.targetYear, validation: run.validation.status }; }
    catch { return null; }
  }));
  return runs.filter((run): run is NonNullable<typeof run> => run !== null).sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 100);
}
