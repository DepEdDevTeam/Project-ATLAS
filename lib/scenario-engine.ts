import { INTERVENTIONS, SHARES } from "./scenario-data";
import type { Levers, Outcomes, Strategy, YearState } from "./scenario-types";

export function validateLevers(l: Levers) {
  for (const [key,value] of Object.entries(l)) if (typeof value === "number" && (!Number.isFinite(value) || (value < 0 && !["enrollmentGrowth","progression","access"].includes(key)))) throw new Error(`Invalid assumption: ${key}`);
  if (l.pupilsPerRoom <= 0 || l.fundingCycle < 1 || !Number.isInteger(l.fundingCycle) || l.roomsPerAnnex < 1) throw new Error("Planning ratios and funding cycle must be positive");
  if ([l.eligibility,l.equityShare,l.ictShare].some(v => v > 100)) throw new Error("Shares must be between 0 and 100");
  if (l.inventoryKnown && l.unusableRooms > l.inventoryRooms) throw new Error("Unusable rooms cannot exceed assumed inventory");
  if (l.enrollmentGrowth + l.progression + l.access < -100) throw new Error("Combined enrollment change cannot be below −100%");
  for (const k of ["inventoryRooms","unusableRooms","exposedRooms","newRooms","rehabRooms","expansionRooms","annexes","resilienceRooms","roomsPerAnnex"]) if (!Number.isInteger(l[k as keyof Levers])) throw new Error("Room and project counts must be whole numbers");
  for (const item of INTERVENTIONS) if ((l[item.cost] as number) <= 0) throw new Error("Unit costs must be greater than zero");
}
export function initialOutcomes(enrollment: number, l: Levers): Outcomes {
  validateLevers(l);
  const availableRooms = l.inventoryKnown ? l.inventoryRooms-l.unusableRooms : null;
  const requiredRooms = Math.ceil(enrollment/l.pupilsPerRoom);
  return { enrollment, requiredRooms, availableRooms, remainingGap: availableRooms === null ? null : Math.max(0,requiredRooms-availableRooms), addedRooms:0, restoredRooms:0, upgradedRooms:0, remainingExposure:l.exposedRooms, investment:0, annualSpend:0, maintenance:0, availableBudget:0, unspent:0, equityReserve:0, allocations:[] };
}
export function simulateYear(previous: Outcomes, l: Levers, strategy: Strategy, step = 1): Outcomes {
  validateLevers(l);
  const enrollment = Math.round(previous.enrollment*(1+(l.enrollmentGrowth+l.progression+l.access)/100));
  const availableBudget = (step-1)%l.fundingCycle === 0 ? l.budget*l.eligibility/100 : 0;
  const maintenance = Math.min(availableBudget, (previous.availableRooms ?? previous.addedRooms)*l.maintenanceCost);
  const equityReserve = (availableBudget-maintenance)*l.equityShare/100;
  const envelope = Math.max(0,availableBudget-maintenance-equityReserve);
  const allocations = INTERVENTIONS.map((item,i) => {
    let requested = l[item.demand] as number;
    if (item.kind === "rehab" && l.inventoryKnown) requested = Math.min(requested,Math.max(0,l.unusableRooms-previous.restoredRooms));
    if (item.kind === "resilience") requested = Math.min(requested,previous.remainingExposure);
    const ictRooms = item.kind === "annex" ? l.roomsPerAnnex : ["new","expansion"].includes(item.kind) ? 1 : 0;
    const unitCost = (l[item.cost] as number) + ictRooms*l.ictShare/100*l.ictCost;
    const share = SHARES[strategy][i];
    const funded = Math.min(requested,Math.floor((envelope*share/100+1e-9)/unitCost));
    return { kind:item.kind, requested, funded, cost:funded*unitCost, share, unitCost };
  });
  const units = (kind: string) => allocations.find(a=>a.kind===kind)!.funded;
  const added = units("new")+units("expansion")+units("annex")*l.roomsPerAnnex;
  const restored = l.inventoryKnown ? units("rehab") : 0;
  const availableRooms = previous.availableRooms === null ? null : previous.availableRooms+added+restored;
  const requiredRooms = Math.ceil(enrollment/l.pupilsPerRoom);
  const annualSpend = maintenance+allocations.reduce((sum,a)=>sum+a.cost,0);
  return { enrollment, requiredRooms, availableRooms, remainingGap:availableRooms===null?null:Math.max(0,requiredRooms-availableRooms), addedRooms:previous.addedRooms+added, restoredRooms:previous.restoredRooms+restored, upgradedRooms:previous.upgradedRooms+units("resilience"), remainingExposure:Math.max(0,previous.remainingExposure-units("resilience")), investment:previous.investment+annualSpend, annualSpend, maintenance, availableBudget, unspent:Math.max(0,availableBudget-annualSpend), equityReserve, allocations };
}
export function timeline(enrollment: number, baseYear: number, endYear: number, l: Levers, strategy: Strategy): YearState[] {
  const result=[{ year:baseYear,outcomes:initialOutcomes(enrollment,l) }];
  for(let year=baseYear+1;year<=endYear;year++) result.push({year,outcomes:simulateYear(result.at(-1)!.outcomes,l,strategy,year-baseYear)});
  return result;
}
