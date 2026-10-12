export type BudgetRow = { id: string; data: Record<string, unknown>; updatedAt?: string };

/** Select one unambiguous latest fiscal year, without coercing absent years to zero. */
export function selectBudgetSource(rows: BudgetRow[], baseYear: number): { row: BudgetRow | null; gap?: string } {
  const valid = rows.flatMap(row => {
    const raw = row.data.fiscal_year;
    const year = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d{4}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
    return Number.isInteger(year) && year >= 1900 && year <= baseYear ? [{ row, year }] : [];
  });
  if (!valid.length) return { row: null, gap: 'No valid MOOE fiscal-year observation at or before the scenario base year.' };
  const latest = Math.max(...valid.map(item => item.year));
  const candidates = valid.filter(item => item.year === latest);
  if (candidates.length !== 1) return { row: null, gap: `Multiple MOOE observations for FY ${latest}; allocation is unavailable until the source ambiguity is resolved.` };
  return { row: candidates[0].row };
}
