export const LEVELS = ["national", "region", "division", "province", "municipality", "barangay", "school"] as const;
export type Level = typeof LEVELS[number];
export type Scope = { level: Level; key: string; sector: string };
export type EnrollmentYear = { year: number; enrollment: number | null; male: number | null; female: number | null; schools: number; reporting: number; knownCells: number; sourceCells: number; matched: number; matchedPrevious: number | null; matchedCurrent: number | null };
export type Breakdown = { name: string; male: number | null; female: number | null; reports: number };
export type RegionSignal = { name: string; year: number; enrollment: number | null; schools: number; previous: number | null; growth: number | null };
export type EnrollmentData = { history: EnrollmentYear[]; breakdown: Breakdown[]; curriculum: { name: string; schools: number }[]; signals: RegionSignal[]; manifest: { schemaVersion: number; generatedAt: string; source: string; files: { file: string; schoolYear: string; year: number; rows: number; enrollment: number; encoding: string; sha256: string }[] }; scope: Scope; breakdownYear: number | null };
export type AreaOption = { key: string; label: string };
export const schoolYear = (year: number) => `${year}–${String(year + 1).slice(-2)}`;
