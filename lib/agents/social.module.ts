import type { PsaSnapshot } from './data-contract';
import { psaGeographyCodes } from './geography';
import { stages, type Calculation, type DomainResult, type Evidence, type PlanningConfiguration } from './planning-contract';

export function sourceEvidence(s: PsaSnapshot): Evidence {
  return { id: s.id, title: s.indicator, url: s.originalSourceUrl, geography: s.geography,
    period: s.sourceUpdated, unit: s.unit, release: s.release, hash: s.contentHash, retrievedAt: s.importedAt };
}

// Selection uses named dimensions, never raw row order or a latest-year fallback.
function observations(s: PsaSnapshot, selected: Record<string, string>) {
  return s.rows.filter(row => Object.entries(selected).every(([dimension, label]) => {
    const index = s.dimensions.findIndex(d => d.code === dimension);
    return index >= 0 && row.labels[index] === label;
  }));
}

export function calculateSocial(c: PlanningConfiguration, snapshots: PsaSnapshot[]): DomainResult {
  const scoped = (snapshot: PsaSnapshot) => snapshot.geography === c.geography ||
    (snapshot.geography === 'national' && c.geography === 'PHILIPPINES') ||
    (snapshot.geography === 'national-and-regional' && snapshot.dimensions.some(d => d.code === 'Geolocation') && !!psaGeographyCodes[c.geography]);
  const select = (indicator: PsaSnapshot['indicator']) => {
    const candidates = snapshots.filter(s => s.indicator === indicator && scoped(s));
    return candidates.length === 1 ? candidates[0] : undefined;
  };
  const population = select('population-projection');
  const rates = select('net-enrollment-rate');
  const limitations = [
    'Five-year population bands are allocated uniformly across single ages; this is a planning assumption.',
    'Calendar-year population is aligned to the school year beginning in that calendar year.',
    "Population adjustment applies to each year's PSA projected cohort; zero adjustment preserves the projection, not the base-year population.",
    'Net enrollment estimates official-age learners, excluding over-age and under-age enrollment.',
    'PSA projections already include migration assumptions; no additional migration increment is applied.',
    'Progression is a scenario retention multiplier, not a measured cohort transition rate.',
    'Rates are held at the explicitly selected reference year; no interpolation or latest-year substitution is used.',
    'A single geographically compatible snapshot is required per indicator; overlapping releases require explicit source selection before use.',
  ];
  const calculations: Calculation[] = [];
  for (const stage of stages) {
    const [minAge, maxAge] = c.stageAges[stage];
    let cohort: number | null = 0;
    const inputs: Record<string, number | null> = {};
    if (!population || population.unit !== 'thousand-persons') cohort = null;
    else {
      const geographyIndex = population.dimensions.findIndex(d => d.code === 'Geolocation');
      const selected = observations(population, { Sex: 'Both Sexes', Year: String(c.targetYear) }).filter(row => geographyIndex < 0 || row.codes[geographyIndex] === psaGeographyCodes[c.geography]);
      for (let band = Math.floor(minAge / 5) * 5; band <= maxAge; band += 5) {
        const ageLabel = `${band}-${band + 4}`;
        const matches = selected.filter(row => row.labels[population.dimensions.findIndex(d => d.code === 'Age Group')] === ageLabel);
        const overlap = Math.max(0, Math.min(maxAge, band + 4) - Math.max(minAge, band) + 1);
        const n = matches.length === 1 ? matches[0].value : null;
        inputs[`${ageLabel} thousand persons`] = n;
        inputs[`${ageLabel} allocated fraction`] = overlap / 5;
        if (n === null || !Number.isFinite(n) || n < 0) cohort = null;
        else if (cohort !== null) cohort += n * 1000 * overlap / 5;
      }
    }
    const rateRows = rates && rates.unit === 'percent' && psaGeographyCodes[c.geography] ? observations(rates, { Sex: 'Both Sexes', Year: String(c.rateYear) }).filter(row => row.codes[rates.dimensions.findIndex(d => d.code === 'Geolocation')] === psaGeographyCodes[c.geography] && row.codes[rates.dimensions.findIndex(d => d.code === 'Level of Education')] === String(stages.indexOf(stage))) : [];
    const rate = rateRows.length === 1 && rateRows[0].value !== null && rateRows[0].value >= 0 && rateRows[0].value <= 100 ? rateRows[0].value : null;
    const adjustedRate = rate === null ? null : Math.min(100, Math.max(0, rate + c.accessChangePp));
    const adjustedCohort = cohort === null ? null : cohort * (1 + c.populationChangePct / 100);
    const alignedPopulationId = population?.id;
    const sourceIds = [alignedPopulationId, rates?.id].filter((id): id is string => !!id);
    calculations.push({ id: `${stage}.rate`, label: `${stage} observed net enrollment rate (${c.rateYear})`, value: rate, unit: 'percent', formula: 'exact stage, both-sexes, geography code and reference-year source selection', inputs: { observation: rate, referenceYear: c.rateYear }, sourceIds: rates ? [rates.id] : [], assumptions: ['Net enrollment covers official-age learners under the source definition, not all enrolled learners.', 'Geographic identity uses explicit source codes, not substring matching.'], status: rate === null ? 'unavailable' : 'supported' });
    calculations.push({ id: `${stage}.cohort`, label: `${stage} official-age population`, value: adjustedCohort, unit: 'persons',
      formula: 'sum(bandThousandPersons × 1000 × ageOverlap / 5) × (1 + populationChangePct / 100)',
      inputs: { ...inputs, populationChangePct: c.populationChangePct }, sourceIds: alignedPopulationId ? [alignedPopulationId] : [], assumptions: limitations.slice(0, 3), status: adjustedCohort === null ? 'unavailable' : 'conditional' });
    calculations.push({ id: `${stage}.enrollment`, label: `${stage} official-age enrollment`,
      value: adjustedCohort === null || adjustedRate === null ? null : Math.round(adjustedCohort * adjustedRate / 100 * c.progressionPct / 100), unit: 'learners',
      formula: 'round(cohort × clamp(netEnrollmentRate + accessChangePp, 0, 100) / 100 × progressionPct / 100)',
      inputs: { cohort: adjustedCohort, netEnrollmentRate: rate, accessChangePp: c.accessChangePp, progressionPct: c.progressionPct }, sourceIds,
      assumptions: limitations.slice(1), status: adjustedCohort === null || adjustedRate === null ? 'unavailable' : 'conditional' });
  }
  const enrolled = calculations.filter(item => item.id.endsWith('.enrollment'));
  const total = enrolled.some(item => item.value === null) ? null : enrolled.reduce((sum, item) => sum + item.value!, 0);
  calculations.push({ id: 'learner-demand', label: 'Total official-age learner demand', value: total, unit: 'learners', formula: 'sum(stage official-age enrollment); unavailable if any stage is unavailable', inputs: Object.fromEntries(enrolled.map(item => [item.id, item.value])), sourceIds: [...new Set(enrolled.flatMap(item => item.sourceIds))], assumptions: limitations, status: total === null ? 'unavailable' : 'conditional' });
  if (c.geography !== 'PHILIPPINES' && !population) limitations.push('National population projections cannot be applied to a regional scope. A single matched regional population source is required.');
  return { domain: 'social', geography: c.geography, year: c.targetYear, calculations, dependencies: [], limitations };
}
