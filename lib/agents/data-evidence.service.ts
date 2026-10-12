import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CoverageItem, PsaSnapshot } from './data-contract';
import { validatePsaSnapshot } from './psa-validation';

export async function readPsaEvidence(): Promise<PsaSnapshot[]> {
  const bundle = JSON.parse(await readFile(path.join(process.cwd(), 'data/psa/bundle.json'), 'utf8')) as { schemaVersion: number; datasets: PsaSnapshot[] };
  if (bundle.schemaVersion !== 1 || !Array.isArray(bundle.datasets)) throw new Error('Unsupported PSA bundle');
  for (const item of bundle.datasets) {
    validatePsaSnapshot(item);
  }
  return bundle.datasets;
}

export async function psaCoverage(): Promise<CoverageItem[]> {
  return (await readPsaEvidence()).map(item => ({
    indicator: item.indicator,
    status: 'needs-mapping',
    reason: item.indicator === 'population-projection'
      ? 'National five-year age bands need explicit stage-age allocation and calendar-to-school-year alignment. Subnational projections are not in this bundle.'
      : 'Rates need reference-year, geography, age-definition and sector alignment. A year listed in the table does not guarantee a numeric observation; net enrollment excludes out-of-age learners.',
    numericCells: item.rows.filter(row => typeof row.value === 'number').length,
    missingCells: item.rows.filter(row => row.value === null).length,
    source: { originalSourceUrl: item.originalSourceUrl, mirrorUrl: item.mirrorUrl, release: item.release, sourceUpdated: item.sourceUpdated, mirrorRetrieved: item.mirrorRetrieved, contentHash: item.contentHash, unit: item.unit, geography: item.geography },
  }));
}
