import type { DomainResult, Evidence } from './planning-contract';
export type PlanningCoverage = { calculationId: string; domain: string; geography: string; year: number; status: 'ready' | 'conditional' | 'missing' | 'invalid'; sourceIds: string[]; reasons: string[] };
export function planningCoverage(results: DomainResult[], sources: Evidence[]): PlanningCoverage[] {
  const index = new Map(sources.map(source => [source.id, source]));
  return results.flatMap(domain => domain.calculations.map(calculation => {
    const reasons: string[] = [];
    let invalid = false;
    for (const id of calculation.sourceIds) {
      const source = index.get(id);
      if (!source) { invalid = true; reasons.push(`Unresolved source ${id}.`); continue; }
      if (!source.hash || !source.release || !source.period || !source.unit || !source.retrievedAt) { invalid = true; reasons.push(`Source ${id} lacks version, unit, time or retrieval metadata.`); }
      if (source.geography === 'national' && domain.geography !== 'PHILIPPINES') { invalid = true; reasons.push('National observations cannot support subnational estimates.'); }
      else if (!['national', 'national-and-regional', domain.geography].includes(source.geography)) { invalid = true; reasons.push(`Source geography ${source.geography} does not match ${domain.geography}.`); }
      reasons.push(`Source ${id}: ${source.period}; unit ${source.unit}; release ${source.release}.`);
    }
    if (calculation.value === null) reasons.push('Required numeric input or matched source is unavailable; missing is not zero.');
    if (!calculation.sourceIds.length) reasons.push('No observational source is used; this result is configuration-only or unavailable.');
    if (calculation.status === 'conditional') reasons.push('Scenario output depends on disclosed assumptions and source-to-target-period alignment.');
    return { calculationId: calculation.id, domain: domain.domain, geography: domain.geography, year: domain.year, status: invalid ? 'invalid' as const : calculation.value === null ? 'missing' as const : calculation.status === 'conditional' ? 'conditional' as const : 'ready' as const, sourceIds: calculation.sourceIds, reasons };
  }));
}
