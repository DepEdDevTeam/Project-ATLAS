import type { Calculation, DomainResult, PlanningConfiguration } from './planning-contract';

export type Infrastructure = {
  geography: string; period: string; sourceId: string;
  usableRooms: number | null; devices: number | null;
  schoolOfferings: number | null; connectedOfferings: number | null;
  hazardExposedOfferings: number | null; maintenanceNeedPhp: number | null;
  instructionalRooms?: number | null; buildingsNeedingRepair?: number | null;
  walkingAccessOfferings?: number | null; floodMarkerOfferings?: number | null;
  operatingAllocationPhp?: number | null; operatingSourceId?: string; operatingPeriod?: string;
};
export function calculateOtherDomains(c: PlanningConfiguration, social: DomainResult, infrastructure: Infrastructure | null): DomainResult[] {
  const matched = infrastructure?.geography === c.geography ? infrastructure : null;
  const demand = social.calculations.find(x => x.id === 'learner-demand')?.value ?? null;
  const result = (domain: DomainResult['domain'], calculations: Calculation[], limitations: string[], dependencies: DomainResult['dependencies']): DomainResult => ({ domain, geography: c.geography, year: c.targetYear, calculations, limitations, dependencies });
  const metric = (id: string, label: string, value: number | null, unit: string, formula: string, inputs: Calculation['inputs'], assumptions: string[], observed = false): Calculation => ({ id, label, value, unit, formula, inputs, assumptions, sourceIds: [...(['policy-active', 'eligible-budget', 'exposed-offerings', 'disrupted-offering-days', 'connectivity-gap'].includes(id) ? [] : social.calculations.find(x => x.id === 'learner-demand')!.sourceIds), ...(observed && matched ? [matched.sourceId] : [])], status: value === null ? 'unavailable' : 'conditional' });
  const assumptions = ['Scenario targets and costs are user assumptions, not observed allocations or official standards.'];
  const requiredDevices = demand === null ? null : Math.ceil(demand / c.learnersPerDevice);
  const deviceGap = requiredDevices === null || matched?.devices == null ? null : Math.max(0, requiredDevices - matched.devices);
  const requiredRooms = demand === null ? null : Math.ceil(demand / c.learnersPerRoom);
  const roomGap = requiredRooms === null || matched?.usableRooms == null ? null : Math.max(0, requiredRooms - matched.usableRooms);
  const active = c.targetYear >= c.policy.startYear && c.targetYear <= c.policy.endYear;
  const eligibleBudget = active ? Math.min(c.budgetPhp, c.policy.fundingCapPhp) * c.policy.eligiblePct / 100 : 0;
  const maintenance = Math.min(eligibleBudget, c.maintenancePhp);
  const available = Math.max(0, eligibleBudget - maintenance);
  const need = roomGap === null || deviceGap === null ? null : roomGap * c.roomCostPhp + deviceGap * c.deviceCostPhp;
  // Explicit priority: maintenance, classroom gap, then device gap.
  const rooms = roomGap === null ? null : Math.min(roomGap, Math.floor(available / c.roomCostPhp));
  const devices = rooms === null || deviceGap === null ? null : Math.min(deviceGap, Math.floor((available - rooms * c.roomCostPhp) / c.deviceCostPhp));
  const spent = rooms === null || devices === null ? null : maintenance + rooms * c.roomCostPhp + devices * c.deviceCostPhp;
  const connectivity = matched?.schoolOfferings == null || matched?.connectedOfferings == null ? null : Math.max(0, Math.ceil(matched.schoolOfferings * c.connectivityTargetPct / 100) - matched.connectedOfferings);
  const exposed = matched?.schoolOfferings == null ? null : Math.round(matched.schoolOfferings * c.hazardExposurePct / 100);
  const unavailable = ['Missing inventory remains unavailable. A school-offering count cannot be treated as a unique-school count.', ...(matched ? [`Infrastructure reference period ${matched.period} is held fixed to target year ${c.targetYear}.`] : ['No geographically matched infrastructure evidence is available.'])];
  return [
    result('technology', [
      metric('devices-required', 'Devices required', requiredDevices, 'devices', 'ceil(learnerDemand / learnersPerDevice)', { learnerDemand: demand, learnersPerDevice: c.learnersPerDevice }, assumptions),
      metric('device-gap', 'Additional devices needed', deviceGap, 'devices', 'max(0, requiredDevices - observedDevices)', { requiredDevices, observedDevices: matched?.devices ?? null }, assumptions, true),
      metric('connectivity-gap', 'Additional connected offerings needed', connectivity, 'school offerings', 'max(0, ceil(offerings × targetPct / 100) - connectedOfferings)', { offerings: matched?.schoolOfferings ?? null, targetPct: c.connectivityTargetPct, connectedOfferings: matched?.connectedOfferings ?? null }, assumptions, true),
    ], unavailable, ['social']),
    result('economic', [
      { id: 'observed.mooe', label: `Observed operating allocation (${matched?.operatingPeriod || 'period unavailable'})`, value: matched?.operatingAllocationPhp ?? null, unit: 'PHP', formula: 'source operating allocation; not a capital budget', inputs: { observation: matched?.operatingAllocationPhp ?? null }, sourceIds: matched?.operatingSourceId ? [matched.operatingSourceId] : [], assumptions: ['MOOE is an observed operating allocation, separate from user-assumed capital investment funds.'], status: matched?.operatingAllocationPhp == null ? 'unavailable' : 'supported' },
      metric('room-gap', 'Additional usable rooms needed', roomGap, 'rooms', 'max(0, ceil(learnerDemand / learnersPerRoom) - usableRooms)', { learnerDemand: demand, learnersPerRoom: c.learnersPerRoom, usableRooms: matched?.usableRooms ?? null }, assumptions, true),
      metric('investment-need', 'Capital investment needed', need, 'PHP', 'roomGap × roomCostPhp + deviceGap × deviceCostPhp', { roomGap, roomCostPhp: c.roomCostPhp, deviceGap, deviceCostPhp: c.deviceCostPhp }, assumptions, true),
      metric('funded-rooms', 'Funded rooms', rooms, 'rooms', 'min(roomGap, floor((eligibleBudget - maintenance) / roomCostPhp))', { roomGap, eligibleBudget, maintenance, roomCostPhp: c.roomCostPhp }, [...assumptions, 'Maintenance first, classrooms second, devices third.'], true),
      metric('funded-devices', 'Funded devices', devices, 'devices', 'min(deviceGap, floor((eligibleBudget - maintenance - fundedRooms × roomCostPhp) / deviceCostPhp))', { deviceGap, eligibleBudget, maintenance, fundedRooms: rooms, roomCostPhp: c.roomCostPhp, deviceCostPhp: c.deviceCostPhp }, assumptions, true),
      metric('annual-spend', 'Total funded investment', spent, 'PHP', 'maintenance + fundedRooms × roomCostPhp + fundedDevices × deviceCostPhp', { maintenance, fundedRooms: rooms, roomCostPhp: c.roomCostPhp, fundedDevices: devices, deviceCostPhp: c.deviceCostPhp }, assumptions, true),
      metric('unfunded-need', 'Unfunded capital need', need === null || spent === null ? null : Math.max(0, need - (spent - maintenance)), 'PHP', 'max(0, capitalNeed - (annualSpend - maintenance))', { capitalNeed: need, annualSpend: spent, maintenance }, assumptions, true),
    ], [...unavailable, 'MOOE operating allocations are not treated as capital appropriations.'], ['social', 'technology', 'policy']),
    result('environment', [
      { id: 'observed.instructional-rooms', label: 'Observed instructional rooms', value: matched?.instructionalRooms ?? null, unit: 'rooms', formula: 'sum(ES, JHS, SHS instructional-room records)', inputs: { observation: matched?.instructionalRooms ?? null }, sourceIds: matched ? [matched.sourceId] : [], assumptions: ['Instructional classification does not establish room condition or usable capacity.'], status: matched?.instructionalRooms == null ? 'unavailable' : 'supported' },
      { id: 'observed.repair-buildings', label: 'Observed buildings needing repair', value: matched?.buildingsNeedingRepair ?? null, unit: 'buildings', formula: 'source building-condition count', inputs: { observation: matched?.buildingsNeedingRepair ?? null }, sourceIds: matched ? [matched.sourceId] : [], assumptions: ['Building counts cannot be converted to rooms without a building-to-room inventory.'], status: matched?.buildingsNeedingRepair == null ? 'unavailable' : 'supported' },
      { id: 'observed.walking-access', label: 'Offerings recording walking or hiking access', value: matched?.walkingAccessOfferings ?? null, unit: 'school offerings', formula: 'sum(ES, HS walking/hiking-access records)', inputs: { observation: matched?.walkingAccessOfferings ?? null }, sourceIds: matched ? [matched.sourceId] : [], assumptions: ['Access modes can overlap. Walking/hiking records do not establish a last-mile-school classification.'], status: matched?.walkingAccessOfferings == null ? 'unavailable' : 'supported' },
      { id: 'observed.flood-markers', label: 'Offerings with recorded flood markers', value: matched?.floodMarkerOfferings ?? null, unit: 'school offerings', formula: 'sum(ES, HS flood-marker records)', inputs: { observation: matched?.floodMarkerOfferings ?? null }, sourceIds: matched ? [matched.sourceId] : [], assumptions: ['A flood marker is a contextual indicator and is not verified hazard exposure.'], status: matched?.floodMarkerOfferings == null ? 'unavailable' : 'supported' },
      metric('exposed-offerings', 'Scenario exposed offerings', exposed, 'school offerings', 'round(offerings × hazardExposurePct / 100)', { offerings: matched?.schoolOfferings ?? null, hazardExposurePct: c.hazardExposurePct }, [...assumptions, 'Exposure is a user sensitivity parameter; flood markers do not establish hazard exposure.'], true),
      metric('disrupted-offering-days', 'Scenario disrupted offering days', exposed === null ? null : exposed * c.disruptionDays, 'offering-days', 'exposedOfferings × disruptionDays', { exposedOfferings: exposed, disruptionDays: c.disruptionDays }, assumptions, true),
    ], [...unavailable, 'No hazard polygon overlay, facility condition, or last-mile classification is inferred from incomplete indicators.'], ['social']),
    result('policy', [
      metric('policy-active', 'Policy timing check', active ? 1 : 0, 'boolean', 'startYear <= targetYear <= endYear', { startYear: c.policy.startYear, targetYear: c.targetYear, endYear: c.policy.endYear }, ['User supplied policy rules require review against the original policy.']),
      metric('eligible-budget', 'Policy-constrained available budget', eligibleBudget, 'PHP', 'active × min(budgetPhp, fundingCapPhp) × eligiblePct / 100', { active: active ? 1 : 0, budgetPhp: c.budgetPhp, fundingCapPhp: c.policy.fundingCapPhp, eligiblePct: c.policy.eligiblePct }, ['Eligibility percentage is a user supplied planning constraint; it does not establish school eligibility.']),
    ], ['Only explicit structured rules are evaluated. Policy text must not silently become a binding rule.'], []),
  ];
}
