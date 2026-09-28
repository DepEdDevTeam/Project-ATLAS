export type Strategy = "Growth-led" | "Equity-led" | "Capacity-led" | "Resilience-led" | "Balanced";
export type Levers = {
  enrollmentGrowth: number; progression: number; access: number; equityShare: number;
  ictShare: number; ictCost: number; budget: number; maintenanceCost: number;
  newRooms: number; rehabRooms: number; expansionRooms: number; annexes: number; resilienceRooms: number;
  newCost: number; rehabCost: number; expansionCost: number; annexCost: number; resilienceCost: number;
  inventoryKnown: boolean; inventoryRooms: number; unusableRooms: number; exposedRooms: number;
  pupilsPerRoom: number; roomsPerAnnex: number; eligibility: number; fundingCycle: number;
};
export type Intervention = "new" | "rehab" | "expansion" | "annex" | "resilience";
export type Allocation = { kind: Intervention; requested: number; funded: number; cost: number; share: number; unitCost: number };
export type Outcomes = { enrollment: number; requiredRooms: number; availableRooms: number | null; remainingGap: number | null; addedRooms: number; restoredRooms: number; upgradedRooms: number; remainingExposure: number; investment: number; annualSpend: number; maintenance: number; availableBudget: number; unspent: number; equityReserve: number; allocations: Allocation[] };
export type YearState = { year: number; outcomes: Outcomes };
