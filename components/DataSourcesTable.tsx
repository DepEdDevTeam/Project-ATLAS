"use client";

import { useEffect, useState } from "react";
import { SourceTableSkeleton } from "./Skeleton";

type Owner = "psa" | "asean" | "budget" | "flood";
type Cell = string | number | boolean | null;
type DataPage = { rows: Record<string, Cell>[]; columns: string[]; total?: number; nextOffset?: number | null; nextCursor?: string | null; sourceUrl: string; note?: string };
const owners: { id: Owner; label: string; description: string }[] = [
  { id: "psa", label: "PSA", description: "OpenSTAT datasets and classifications, mirrored by BetterGov" },
  { id: "asean", label: "ASEAN", description: "Regional economic and social indicator datasets" },
  { id: "budget", label: "BetterGov Budget", description: "GAA and NEP appropriations" },
  { id: "flood", label: "BetterGov Flood", description: "DPWH flood-control project index" },
];
const ownerTabs = ["PSA", "ASEAN", "BetterGov"] as const;
const moneyColumns = new Set(["budget", "amountPaid", "amount", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]);
const format = (value: Cell, column: string) => {
  if (value === null || value === "") return "—";
  if (typeof value === "number") return moneyColumns.has(column) ? `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}` : value.toLocaleString("en-PH");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
};

export default function DataSourcesTable({ initialOwner = "psa" }: { initialOwner?: Owner }) {
  const [owner, setOwner] = useState<Owner>(initialOwner);
  const [view, setView] = useState("catalog");
  const [id, setId] = useState("");
  const [path, setPath] = useState("");
  const [dept, setDept] = useState("");
  const [year, setYear] = useState("2026");
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [cursor, setCursor] = useState("");
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [data, setData] = useState<DataPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ owner, view, offset: String(offset) });
    if (query) params.set("q", query);
    if (id) params.set("id", id);
    if (path) params.set("path", path);
    if (dept) params.set("dept", dept);
    if (year) params.set("year", year);
    if (cursor) params.set("cursor", cursor);
    setLoading(true); setError(""); setData(null);
    fetch(`/api/source-data?${params}`, { signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Source unavailable"); return body as DataPage; })
      .then((body) => { setData(body); setLoading(false); })
      .catch((cause) => { if (controller.signal.aborted) return; setError(cause instanceof Error ? cause.message : "Source unavailable"); setLoading(false); });
    return () => controller.abort();
  }, [owner, view, id, path, dept, year, query, offset, cursor, reloadKey]);

  const resetPage = () => { setOffset(0); setCursor(""); setCursorHistory([]); setData(null); };
  const changeOwner = (next: Owner) => { setOwner(next); setView("catalog"); setId(""); setPath(""); setDept(""); setQuery(""); setDraftQuery(""); resetPage(); };
  const changeView = (next: string) => { setView(next); setQuery(""); setDraftQuery(""); resetPage(); };
  const openRow = (row: Record<string, Cell>) => {
    if (owner === "psa" && view === "catalog") { setId(String(row.id)); changeView("sample"); }
    else if (owner === "psa" && view === "classifications") { setPath(String(row.path)); changeView("classification-rows"); }
    else if (owner === "asean" && view === "catalog") { setId(String(row.id)); changeView("rows"); }
    else if (owner === "budget" && view === "catalog") { setDept(String(row.id)); changeView("programs"); }
  };
  const clickable = (owner === "psa" && ["catalog", "classifications"].includes(view)) || (owner === "asean" && view === "catalog") || (owner === "budget" && view === "catalog");
  const activeTab = owner === "budget" || owner === "flood" ? "BetterGov" : owner === "psa" ? "PSA" : "ASEAN";
  const cursorBased = owner === "budget" && ["programs", "objects"].includes(view);
  const previousDisabled = cursorBased ? cursorHistory.length === 0 : offset === 0;
  const nextDisabled = !data || (cursorBased ? !data.nextCursor : data.nextOffset == null);
  const previous = () => { setData(null); if (cursorBased) { const history = [...cursorHistory]; setCursor(history.pop() || ""); setCursorHistory(history); } else setOffset(Math.max(0, offset - 20)); };
  const next = () => { if (!data) return; const current=data; setData(null); if (cursorBased) { setCursorHistory((history) => [...history, cursor]); setCursor(current.nextCursor || ""); } else setOffset(current.nextOffset || 0); };
  const exportPage = () => {
    if (!data?.rows.length) return;
    const quote = (value: Cell) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [data.columns.map(quote).join(","), ...data.rows.map(row => data.columns.map(column => quote(row[column])).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `atlas-${owner}-${view}-page.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <section className="source-data" aria-labelledby="source-data-heading" aria-busy={loading} data-loading-region>
    <div className="source-data-heading"><div><h2 id="source-data-heading">Source data</h2><p>Browse records by data owner. Select a row to inspect a dataset or department.</p></div></div>
    <div className="source-tabs" role="tablist" aria-label="Data owner">{ownerTabs.map((label) => <button key={label} type="button" role="tab" id={`source-tab-${label}`} aria-controls="source-panel" aria-selected={activeTab === label} className={activeTab === label ? "active" : ""} onClick={() => changeOwner(label === "BetterGov" ? "budget" : label.toLowerCase() as Owner)}>{label}</button>)}</div>
    <div id="source-panel" role="tabpanel" aria-labelledby={`source-tab-${activeTab}`} className="source-panel">
      <p className="source-description">{owners.find((item) => item.id === owner)?.description}. These records are available for profiles, comparison and dataset-building. Scenario Lab uses them only when a validated template defines compatible inputs; flood-control projects do not by themselves measure hazard exposure.</p>
      <div className="source-toolbar">
        {(owner === "budget" || owner === "flood") && <div className="source-view-switch"><button type="button" className={owner === "budget" ? "active" : ""} onClick={() => changeOwner("budget")}>National budget</button><button type="button" className={owner === "flood" ? "active" : ""} onClick={() => changeOwner("flood")}>Flood-control projects</button></div>}
        {owner === "psa" && <div className="source-view-switch"><button type="button" className={view === "catalog" || view === "sample" ? "active" : ""} onClick={() => changeView("catalog")}>Statistics</button><button type="button" className={view.startsWith("classification") ? "active" : ""} onClick={() => changeView("classifications")}>Classifications</button></div>}
        {owner === "asean" && view === "rows" && <button type="button" className="source-back" onClick={() => changeView("catalog")}>← All datasets</button>}
        {owner === "psa" && view === "sample" && <button type="button" className="source-back" onClick={() => changeView("catalog")}>← All datasets</button>}
        {owner === "psa" && view === "classification-rows" && <button type="button" className="source-back" onClick={() => changeView("classifications")}>← Classification list</button>}
        {owner === "budget" && <div className="source-view-switch"><button type="button" className={view === "catalog" ? "active" : ""} onClick={() => changeView("catalog")}>GAA departments</button><button type="button" className={view === "nep" ? "active" : ""} onClick={() => changeView("nep")}>NEP 2027</button>{dept && <><button type="button" className={view === "programs" ? "active" : ""} onClick={() => changeView("programs")}>Programs</button><button type="button" className={view === "objects" ? "active" : ""} onClick={() => changeView("objects")}>Line items</button></>}</div>}
        {owner === "budget" && (view === "programs" || view === "objects") && <label className="source-year">Fiscal year <select value={year} onChange={(event) => { setYear(event.target.value); resetPage(); }}>{Array.from({ length: 7 }, (_, index) => String(2026 - index)).map((value) => <option key={value}>{value}</option>)}</select></label>}
        {((owner === "psa" && view === "catalog") || (owner === "asean" && view === "catalog") || (owner === "budget" && ["catalog", "nep", "programs", "objects"].includes(view)) || owner === "flood") && <form className="source-search" onSubmit={(event) => { event.preventDefault(); setQuery(draftQuery.trim()); resetPage(); }}><label htmlFor="source-query">Search</label><input id="source-query" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder={owner === "flood" ? "Project or location" : "Search this source"} /><button type="submit">Search</button></form>}
      </div>
      {error && <div className="source-error" role="alert">Could not load this source: {error}. <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Retry</button></div>}
      <div className="source-badges"><span>Source observation</span><span>{owner === "psa" ? "PSA mirror" : owner === "asean" ? "ASEAN dataset" : "BetterGov record"}</span><span>Retrieved on demand</span></div>
      <div className="source-meta"><span>{loading ? "Loading records…" : data?.total !== undefined ? `${data.total.toLocaleString("en-PH")} records available` : `${data?.rows.length || 0} record(s)`}</span><span className="source-meta-actions">{data?.rows.length ? <button type="button" onClick={exportPage}>Export current page (.csv)</button> : null}{data && <a href={data.sourceUrl} target="_blank" rel="noreferrer">View API source ↗</a>}</span></div>
      <div className="source-table-wrap">{loading?<SourceTableSkeleton/>:<><table><thead><tr>{(data?.columns || []).map((column) => <th key={column} scope="col">{column.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}</th>)}</tr></thead><tbody>{data?.rows.map((row, index) => <tr key={index}>{data.columns.map((column, cellIndex) => <td key={column}>{cellIndex === 0 && clickable ? <button type="button" className="source-row-link" onClick={() => openRow(row)} title="Open record">{format(row[column], column)}</button> : <span title={String(row[column] ?? "")}>{format(row[column], column)}</span>}</td>)}</tr>)}</tbody></table>{data?.rows.length === 0 && !error && <div className="source-empty">No records found. Try another search or dataset.</div>}</>}</div>
      {data?.note && <p className="source-note">{data.note}</p>}
      <div className="source-pagination"><button type="button" disabled={previousDisabled || loading} onClick={previous}>Previous</button><span>Page {cursorBased ? cursorHistory.length + 1 : Math.floor(offset / 20) + 1}</span><button type="button" disabled={nextDisabled || loading} onClick={next}>Next</button></div>
    </div>
  </section>;
}
