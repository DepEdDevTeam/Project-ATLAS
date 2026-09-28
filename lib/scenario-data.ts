import type { Intervention, Levers, Strategy } from "./scenario-types";
export const TARGET_YEAR = 2032;
export const STRATEGIES: Strategy[] = ["Growth-led", "Equity-led", "Capacity-led", "Resilience-led", "Balanced"];
// Normative budget shares, not evidence-derived rankings or optimized allocations.
export const SHARES: Record<Strategy, number[]> = {
  "Growth-led": [50,10,25,10,5], "Equity-led": [15,15,20,40,10],
  "Capacity-led": [40,25,25,5,5], "Resilience-led": [10,20,5,5,60], "Balanced": [20,20,20,20,20],
};
export const INTERVENTIONS: { kind: Intervention; label: string; demand: keyof Levers; cost: keyof Levers }[] = [
  { kind: "new", label: "New classrooms", demand: "newRooms", cost: "newCost" },
  { kind: "rehab", label: "Rehabilitation", demand: "rehabRooms", cost: "rehabCost" },
  { kind: "expansion", label: "School expansion rooms", demand: "expansionRooms", cost: "expansionCost" },
  { kind: "annex", label: "Annex / new-school packages", demand: "annexes", cost: "annexCost" },
  { kind: "resilience", label: "Resilience upgrades", demand: "resilienceRooms", cost: "resilienceCost" },
];
export const BASE_LEVERS: Levers = {
  enrollmentGrowth: 0, progression: 0, access: 0, equityShare: 0,
  ictShare: 0, ictCost: .1, budget: 100, maintenanceCost: .02,
  newRooms: 0, rehabRooms: 0, expansionRooms: 0, annexes: 0, resilienceRooms: 0,
  newCost: 2.5, rehabCost: 1, expansionCost: 2.5, annexCost: 20, resilienceCost: .5,
  inventoryKnown: false, inventoryRooms: 0, unusableRooms: 0, exposedRooms: 0,
  pupilsPerRoom: 40, roomsPerAnnex: 6, eligibility: 100, fundingCycle: 1,
};
