import type { DomainResult, PlanningConfiguration } from './planning-contract';
import type { CalculationCheck } from './calculation-validator';
export type ScenarioComparison = { id: string; label: string; metric: string; unit: string; geography: string; year: number; selectedValue: number; alternativeValue: number; delta: number; calculationIds: string[] };

export function scenarioComparisons(results: DomainResult[], alternatives: { id: string; label: string; results: DomainResult[] }[]): ScenarioComparison[] {
  const metrics = ['learner-demand', 'devices-required', 'eligible-budget', 'unfunded-need', 'disrupted-offering-days', 'connectivity-gap'];
  return alternatives.filter(scenario => scenario.id !== 'selected').flatMap(scenario => results.flatMap(domain => domain.calculations.flatMap(calculation => {
    const otherDomain = scenario.results.find(other => other.domain === domain.domain && other.geography === domain.geography && other.year === domain.year);
    const other = otherDomain?.calculations.find(other => other.id === calculation.id);
    if (!metrics.includes(calculation.id) || calculation.value === null || other?.value == null || other.unit !== calculation.unit) return [];
    return [{ id: `${scenario.id}:${calculation.id}`, label: `${scenario.label} versus selected configuration`, metric: calculation.label, unit: calculation.unit, geography: domain.geography, year: domain.year, selectedValue: calculation.value, alternativeValue: other.value, delta: other.value - calculation.value, calculationIds: [calculation.id, `alternative:${scenario.id}:${calculation.id}`] }];
  }))).sort((a, b) => Number(b.delta !== 0) - Number(a.delta !== 0));
}

export function attachComparison(selection: { comparisonId: string; text: string; researchIds: string[] }, choices: ScenarioComparison[]) {
  const choice = choices.find(choice => choice.id === selection.comparisonId);
  if (!choice) throw new Error('Unknown scenario comparison.');
  return { ...selection, calculationIds: choice.calculationIds, status: 'unsupported' as const };
}

export function scenarioEvidence(
  results: DomainResult[],
  timeline: { year: number; results: DomainResult[] }[],
  alternatives: { id: string; label: string; configuration: PlanningConfiguration; results: DomainResult[] }[],
): DomainResult[] {
  const scoped = (domains: DomainResult[], prefix: string, description: string) => domains.map(domain => ({
    ...domain,
    calculations: domain.calculations.map(calculation => ({ ...calculation, id: `${prefix}:${calculation.id}`, assumptions: [...calculation.assumptions, description] })),
  }));
  return [
    ...results,
    ...timeline.flatMap(point => scoped(point.results, `year:${point.year}`, `Year ${point.year} under the selected configuration.`)),
    ...alternatives.flatMap(scenario => scoped(scenario.results, `alternative:${scenario.id}`, `${scenario.label}; population adjustment ${scenario.configuration.populationChangePct}%; budget PHP ${scenario.configuration.budgetPhp}; target year ${scenario.configuration.targetYear}.`)),
  ];
}

// Evidence review needs the cited operands and scope, rather than unrelated scenario tables.
export function citedScenarioEvidence(domains: DomainResult[], claims: { calculationIds: string[] }[]): DomainResult[] {
  const ids = new Set(claims.flatMap(claim => claim.calculationIds));
  return domains.map(domain => ({ ...domain, calculations: domain.calculations.filter(calculation => ids.has(calculation.id)) })).filter(domain => domain.calculations.length);
}

export function calculationCitationRegister(run: {
  results: DomainResult[]; claimCalculationEvidence?: DomainResult[];
  validation: { calculationChecks: CalculationCheck[]; timelineValidation?: { year: number; calculationChecks: CalculationCheck[] }[]; alternativeValidation?: { id: string; calculationChecks: CalculationCheck[] }[] };
}, claims: { calculationIds: string[] }[]) {
  return [...new Set(claims.flatMap(claim => claim.calculationIds))].map(id => {
    const year = /^year:(\d{4}):(.+)$/.exec(id);
    const alternative = /^alternative:([^:]+):(.+)$/.exec(id);
    const calculationId = year?.[2] ?? alternative?.[2] ?? id;
    const checks = year ? run.validation.timelineValidation?.find(point => point.year === Number(year[1]))?.calculationChecks : alternative ? run.validation.alternativeValidation?.find(scenario => scenario.id === alternative[1])?.calculationChecks : run.validation.calculationChecks;
    const domain = (run.claimCalculationEvidence ?? run.results).find(result => result.calculations.some(calculation => calculation.id === id));
    const calculation = domain?.calculations.find(calculation => calculation.id === id);
    return { id, scope: year ? `year ${year[1]}` : alternative ? `alternative ${alternative[1]}` : 'selected target-year scenario', geography: domain?.geography, year: domain?.year, calculation: calculation ?? null, validation: checks?.find(check => check.id === calculationId) ?? null };
  });
}
