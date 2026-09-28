// Server-only local data access. Raw CSV files never enter client bundles.
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { statSync } from "node:fs";
import type { AreaOption, Breakdown, EnrollmentData, EnrollmentYear, Level, Scope } from "./enrollment-types";

const columns: Record<Level, string[]> = { national: [], region: ["region"], division: ["region", "division"], province: ["region", "province"], municipality: ["region", "province", "municipality"], barangay: ["region", "province", "municipality", "barangay"], school: ["school_id"] };
function databasePath() { return process.env.ATLAS_ENROLLMENT_DB || path.join(process.cwd(), "data", "enrollment.sqlite"); }
function open() { return new DatabaseSync(databasePath(), { readOnly: true }); }
const cache = new Map<string, EnrollmentData>();
let revision = "";
function filter(scope: Scope) {
  const values: string[] = scope.level === "national" ? [] : JSON.parse(scope.key);
  if (!Array.isArray(values) || values.length !== columns[scope.level].length || values.some(v => typeof v !== "string" || v.length > 200)) throw new Error("Invalid area key");
  const where = columns[scope.level].map(c => `${c} = ?`);
  if (scope.sector !== "All") { where.push("sector = ?"); values.push(scope.sector); }
  return { where: where.length ? where.join(" AND ") : "1=1", values };
}
export function areas(level: Level, query: string, sector: string): AreaOption[] {
  if (level === "national") return [{ key: "[]", label: "All supplied records (includes PSO)" }];
  const db = open();
  try {
    const cols = columns[level];
    const label = level === "school" ? "school_id || ' · ' || MAX(school_name) || ' · ' || MAX(municipality)" : cols.join(" || ' / ' || ");
    const conditions = sector === "All" ? "1=1" : "sector = ?";
    // Search the whole qualified geography; LIKE wildcards are escaped.
    const search = "%" + query.replace(/[\\%_]/g, "\\$&") + "%";
    const rows = db.prepare(`SELECT json_array(${cols.join(",")}) AS key, ${label} AS label FROM enrollment WHERE ${conditions} GROUP BY ${cols.join(",")} HAVING label LIKE ? ESCAPE '\\' ORDER BY label LIMIT 60`).all(...(sector === "All" ? [] : [sector]), search);
    return rows as unknown as AreaOption[];
  } finally { db.close(); }
}
export function enrollmentData(scope: Scope, requestedYear?: number): EnrollmentData {
  const stamp = `${databasePath()}:${statSync(databasePath()).mtimeMs}`;
  if (revision !== stamp) { cache.clear(); revision = stamp; }
  const cacheKey = JSON.stringify([scope, requestedYear]);
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const db = open();
  try {
    const { where, values } = filter(scope);
    const metadata = db.prepare("SELECT value FROM metadata WHERE key='manifest'").get() as { value: string };
    const manifest = JSON.parse(metadata.value);
    const history = db.prepare(`SELECT year, SUM(total) enrollment, SUM(male) male, SUM(female) female, COUNT(*) schools, COUNT(total) reporting, SUM(known_cells) knownCells, SUM(source_cells) sourceCells FROM enrollment WHERE ${where} GROUP BY year ORDER BY year`).all(...values) as unknown as EnrollmentYear[];
    const matches = db.prepare(`WITH scoped AS (SELECT school_id,year,total FROM enrollment WHERE ${where}) SELECT a.year, COUNT(*) matched, SUM(a.total) matchedCurrent, SUM(b.total) matchedPrevious FROM scoped a JOIN scoped b ON a.school_id=b.school_id AND a.year=b.year+1 WHERE a.total IS NOT NULL AND b.total IS NOT NULL GROUP BY a.year`).all(...values) as unknown as Partial<EnrollmentYear>[];
    for (const h of history) Object.assign(h, { matched: 0, matchedCurrent: null, matchedPrevious: null }, matches.find(m => m.year === h.year));
    const breakdownYear = requestedYear ?? history.at(-1)?.year ?? null;
    const cells = db.prepare(`SELECT j.key name,SUM(j.value) value,COUNT(j.value) reports FROM enrollment e, json_each(e.breakdown) j WHERE ${where} AND year=? GROUP BY j.key`).all(...values, breakdownYear) as unknown as { name: string; value: number | null; reports: number }[];
    const grouped = new Map<string, Breakdown>();
    const countColumns: string[] = manifest.files.find((f: { year: number })=>f.year===breakdownYear)?.countColumns || [];
    for (const c of cells) {
      const column = countColumns[Number(c.name)];
      if (!column) throw new Error("Invalid normalized count column");
      const name = column.replace(/_(male|female)$/, "");
      const item = grouped.get(name) || { name, male: null, female: null, reports: 0 };
      item[column.endsWith("_female") ? "female" : "male"] = c.value; item.reports += c.reports; grouped.set(name, item);
    }
    const curriculum = db.prepare(`SELECT COALESCE(curriculum,'Not supplied') name, COUNT(*) schools FROM enrollment WHERE ${where} AND year=? GROUP BY curriculum`).all(...values, breakdownYear) as unknown as EnrollmentData["curriculum"];
    const regional = db.prepare(`SELECT region name,year,SUM(total) enrollment,COUNT(*) schools FROM enrollment WHERE ${scope.sector === "All" ? "1=1" : "sector=?"} GROUP BY region,year`).all(...(scope.sector === "All" ? [] : [scope.sector])) as unknown as EnrollmentData["signals"];
    const signals = regional.map(row => { const previous = regional.find(p => p.name === row.name && p.year === row.year - 1)?.enrollment ?? null; return { ...row, previous, growth: previous && row.enrollment !== null ? (row.enrollment / previous - 1) * 100 : null }; });
    const result = { history, breakdown: [...grouped.values()], curriculum, signals, manifest, scope, breakdownYear };
    if (cache.size >= 24) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, result);
    return result;
  } finally { db.close(); }
}
