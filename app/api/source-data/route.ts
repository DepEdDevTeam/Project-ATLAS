type Row = Record<string, string | number | boolean | null>;
type Result = { rows: Row[]; columns: string[]; total?: number; nextOffset?: number | null; nextCursor?: string | null; sourceUrl: string; note?: string };

const pageSize = 20;
const text = (value: unknown) => typeof value === "string" ? value : value == null ? "" : String(value);
const number = (value: string | null, fallback = 0) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : fallback);
const asArray = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
const cells = (row: Record<string, unknown>, keys: string[]): Row => Object.fromEntries(keys.map((key) => [key, typeof row[key] === "object" ? JSON.stringify(row[key]) : row[key] ?? null])) as Row;

async function read(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(18000), next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  return response.json();
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const owner = params.get("owner") || "psa";
  const view = params.get("view") || "catalog";
  const offset = Math.floor(number(params.get("offset")) / pageSize) * pageSize;
  const q = (params.get("q") || "").trim().slice(0, 100);
  let result: Result;

  try {
    if (owner === "psa") {
      if (view === "catalog") {
        const url = new URL("https://statistics.bettergov.ph/api/v1/datasets");
        url.searchParams.set("limit", String(pageSize)); url.searchParams.set("offset", String(offset));
        if (q) url.searchParams.set("q", q);
        const body = await read(url.toString());
        const pagination = body.pagination as Record<string, unknown> | undefined;
        const columns = ["title", "domain", "latestYear", "cells", "availability", "retrieved", "id"];
        result = { rows: asArray(body.data).map((row) => cells(row, columns)), columns, total: Number(pagination?.total || 0), nextOffset: pagination?.nextOffset == null ? null : Number(pagination.nextOffset), sourceUrl: url.toString(), note: "Catalog of PSA OpenSTAT snapshots mirrored by BetterGov. Select a row for one exact sample observation." };
      } else if (view === "sample") {
        const id = params.get("id") || "";
        if (!/^[a-f0-9]{20}$/.test(id)) throw new Error("Invalid PSA dataset ID");
        const metaUrl = `https://statistics.bettergov.ph/api/v1/datasets/${id}`;
        const metadata = (await read(metaUrl)).data as Record<string, unknown>;
        if (!metadata?.sampleQuery) throw new Error("This dataset has no queryable snapshot");
        const queryUrl = `${metaUrl}/query`;
        const body = await read(queryUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metadata.sampleQuery) });
        const data = body.data as Record<string, unknown> | undefined;
        const observations = asArray(data?.rows || body.data);
        const columns = observations.length ? Object.keys(observations[0]) : ["value"];
        result = { rows: observations.map((row) => cells(row, columns)), columns, sourceUrl: text(metadata.source) || metaUrl, note: `Sample only · ${text(metadata.title)} · release ${text(metadata.release)} · ${text(metadata.unit)}` };
      } else if (view === "classifications") {
        const url = "https://statistics.bettergov.ph/api/classification/manifest.json";
        const manifest = await read(url);
        const endpoints = manifest.endpoints as Record<string, Record<string, unknown>>;
        const all = Object.entries(endpoints || {}).map(([path, data]) => ({ path, count: Number(data.count || 0), fetchedAt: text(data.fetchedAt) }));
        result = { rows: all.slice(offset, offset + pageSize), columns: ["path", "count", "fetchedAt"], total: all.length, nextOffset: offset + pageSize < all.length ? offset + pageSize : null, sourceUrl: url, note: "Choose a classification endpoint to browse its records." };
      } else if (view === "classification-rows") {
        const path = params.get("path") || "";
        if (!/^\/api\/classification\/[a-z0-9_-]+\/[A-Za-z0-9_-]+(?:\/[a-z0-9_-]+)?$/.test(path)) throw new Error("Invalid classification path");
        const manifest = await read("https://statistics.bettergov.ph/api/classification/manifest.json");
        if (!(path in (manifest.endpoints as Record<string, unknown>))) throw new Error("Unknown classification endpoint");
        const url = `https://statistics.bettergov.ph${path}?page=${offset / pageSize + 1}&page_size=${pageSize}`;
        const body = await read(url);
        const records = asArray(body.results);
        const columns = records.length ? Object.keys(records[0]).filter((key) => key !== "populations") : [];
        result = { rows: records.map((row) => cells(row, columns)), columns, total: Number(body.count || 0), nextOffset: body.next ? offset + pageSize : null, sourceUrl: url, note: "Saved PSA classification release; original codes retain leading zeros." };
      } else throw new Error("Unknown PSA view");
    } else if (owner === "asean") {
      if (view === "catalog") {
        const url = "https://asean.bettergov.ph/api/v1/datasets";
        const body = await read(url);
        const all = asArray(body.data).filter((row) => !q || text(row.title).toLowerCase().includes(q.toLowerCase()) || text(row.id).includes(q.toLowerCase()));
        const columns = ["title", "row_count", "id", "csv"];
        result = { rows: all.slice(offset, offset + pageSize).map((row) => cells(row, columns)), columns, total: all.length, nextOffset: offset + pageSize < all.length ? offset + pageSize : null, sourceUrl: url, note: "Choose a dataset to browse its observations." };
      } else if (view === "rows") {
        const id = params.get("id") || "";
        if (!/^[a-z0-9_]+$/.test(id)) throw new Error("Invalid ASEAN dataset ID");
        const url = `https://asean.bettergov.ph/api/v1/datasets/${id}/rows?limit=${pageSize}&offset=${offset}`;
        const body = await read(url);
        const rows = asArray(body.data);
        const pagination = body.pagination as Record<string, unknown> | undefined;
        const columns = rows.length ? Object.keys(rows[0]) : [];
        result = { rows: rows.map((row) => cells(row, columns)), columns, total: Number(pagination?.total || 0), nextOffset: pagination?.next_offset == null ? null : Number(pagination.next_offset), sourceUrl: url, note: `ASEAN dataset: ${id}` };
      } else throw new Error("Unknown ASEAN view");
    } else if (owner === "budget") {
      if (view === "catalog" || view === "nep") {
        const url = view === "nep" ? "https://budget.bettergov.ph/api/v1/nep/2027/departments" : "https://budget.bettergov.ph/api/v1/gaa/departments";
        const body = await read(url);
        const all = asArray(body.data).filter((row) => !q || text(row.description || row.name).toLowerCase().includes(q.toLowerCase()));
        const rows = all.map((row) => view === "nep" ? row : { id: row.id, description: row.description, ...Object.fromEntries(Object.entries((row.years || {}) as Record<string, Record<string, unknown>>).map(([year, figures]) => [year, figures.amount])) });
        const columns = view === "nep" ? (rows.length ? Object.keys(rows[0]).filter((key) => typeof rows[0][key] !== "object") : []) : ["id", "description", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];
        result = { rows: rows.slice(offset, offset + pageSize).map((row) => cells(row, columns)), columns, total: rows.length, nextOffset: offset + pageSize < rows.length ? offset + pageSize : null, sourceUrl: url, note: view === "nep" ? "FY2027 NEP is a proposal; FY2026 GAA is enacted law. Amounts are exact pesos." : "GAA enacted appropriations in exact pesos. Choose a department for programs and line items." };
      } else if (view === "programs" || view === "objects") {
        const dept = params.get("dept") || "";
        if (!/^[0-9]{2}$/.test(dept)) throw new Error("Invalid department ID");
        const cursor = params.get("cursor") || "";
        if (cursor.length > 1200 || !/^[A-Za-z0-9_+/=-]*$/.test(cursor)) throw new Error("Invalid cursor");
        const year = params.get("year") || "2026";
        if (!/^202[0-6]$/.test(year)) throw new Error("Invalid year");
        const url = new URL(`https://budget.bettergov.ph/api/v1/gaa/departments/${dept}/${view}`);
        url.searchParams.set("year", year); url.searchParams.set("limit", String(pageSize));
        if (cursor) url.searchParams.set("cursor", cursor);
        if (q) url.searchParams.set("q", q);
        const body = await read(url.toString());
        const rows = asArray(body.data).map((row) => ({ name: row.name || row.description, agency_id: row.agency_id, object_code: row.object_code, amount: ((row.years || {}) as Record<string, Record<string, unknown>>)[year]?.amount, line_items: ((row.years || {}) as Record<string, Record<string, unknown>>)[year]?.count }));
        const columns = ["name", "agency_id", ...(view === "objects" ? ["object_code"] : []), "amount", "line_items"];
        result = { rows: rows.map((row) => cells(row, columns)), columns, total: Number((body.meta as Record<string, unknown>)?.matched || 0), nextCursor: (body.next_cursor as string | null) || null, sourceUrl: url.toString(), note: `FY${year} ${view} for department ${dept}. Amounts are exact pesos.` };
      } else throw new Error("Unknown budget view");
    } else if (owner === "flood") {
      const url = new URL("https://flood-control.bettergov.ph/api/flood-control-projects");
      url.searchParams.set("q", q); url.searchParams.set("limit", "1200");
      const body = await read(url.toString());
      const hit = asArray(body.results)[0] || {};
      const all = asArray(hit.hits);
      const rows = all.slice(offset, offset + pageSize).map((row) => ({ contractId: row.contractId, description: row.description, status: row.status, budget: row.budget, amountPaid: row.amountPaid, progress: row.progress, region: (row.location as Record<string, unknown> | undefined)?.region, province: (row.location as Record<string, unknown> | undefined)?.province, contractor: row.contractor, infraYear: row.infraYear }));
      const columns = ["contractId", "description", "status", "budget", "amountPaid", "progress", "region", "province", "contractor", "infraYear"];
      const estimated = Number(hit.estimatedTotalHits || all.length);
      result = { rows: rows.map((row) => cells(row, columns)), columns, total: all.length, nextOffset: offset + pageSize < all.length ? offset + pageSize : null, sourceUrl: url.toString(), note: `Showing up to 1,200 matching projects from ${estimated.toLocaleString("en-PH")} estimated hits. Search to narrow the full index. These projects are contextual data, not inputs to the Atlas simulation.` };
    } else throw new Error("Unknown data owner");

    return Response.json(result, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Source unavailable" }, { status: 502 });
  }
}
