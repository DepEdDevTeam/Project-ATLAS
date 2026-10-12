import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Complete, release-pinned snapshots; never treat sample queries as datasets.
const datasets = [
  { id: '7721a9fbb98bc87084b2', indicator: 'population-projection', unit: 'thousand-persons', unitSource: 'https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__1A__PO/0021A3BPOP1.px/', geography: 'national' },
  { id: '648cb6a9c8b4a5c54b27', indicator: 'net-enrollment-rate', unit: 'percent', unitSource: 'https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__3I__G01/0193I3C14S3.px/', geography: 'national-and-regional', geographyCodes: ['0000000000','1300000000','1400000000','0100000000','0200000000','0300000000','0400000000','1700000000','0500000000','0600000000','1800000000','0700000000','0800000000','0900000000','1000000000','1100000000','1200000000','1600000000','1900000000'] },
];
async function read(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`PSA mirror returned HTTP ${response.status}`);
  const body = await response.json();
  if (!body.data) throw new Error('Missing source payload');
  return body.data;
}
const output = path.resolve('data/psa');
const snapshots = [];
for (const config of datasets) {
  const url = `https://statistics.bettergov.ph/api/v1/datasets/${config.id}`;
  const metadata = await read(url);
  if (!metadata.ready || metadata.schema !== 'complete' || !metadata.release) throw new Error(`Incomplete source: ${config.id}`);
  const selection = Object.fromEntries(metadata.dimensions.map(d => {
    if (!Number.isInteger(d.count) || d.count < 1) throw new Error('Invalid dimension count');
    const values = d.code === 'Geolocation' ? config.geographyCodes : Array.from({ length: d.count }, (_, i) => String(i));
    if (!values || values.length !== d.count) throw new Error('Source geography codes changed; review the release before importing');
    return [d.code, values];
  }));
  const query = { release: metadata.release, selection };
  const parts = [];
  // Query one year at a time to respect the mirror's 5,000-cell limit.
  for (const year of selection.Year) {
    const part = await read(`${url}/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...query, selection: { ...selection, Year: [year] } }) });
    if (part.release !== metadata.release) throw new Error('Source release changed during import');
    parts.push(part);
  }
  const data = { ...parts[0], rows: parts.flatMap(part => part.rows), selection };
  const expected = metadata.dimensions.reduce((n, d) => n * d.count, 1);
  if (data.release !== metadata.release || data.rows?.length !== expected) throw new Error(`Truncated or mismatched snapshot: ${config.id}`);
  const keys = new Set();
  for (const row of data.rows) {
    const key = JSON.stringify(row.codes);
    if (keys.has(key) || row.labels?.length !== metadata.dimensions.length || row.codes?.length !== metadata.dimensions.length) throw new Error('Invalid observation identity');
    keys.add(key);
    if (row.value !== null && (typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value < 0)) throw new Error('Invalid numeric value');
  }
  snapshots.push({ schemaVersion: 1, ...config, importedAt: new Date().toISOString(), transport: 'bettergov-mirror', mirrorUrl: url, originalSourceUrl: metadata.source, release: metadata.release, sourceUpdated: metadata.sourceUpdated, mirrorRetrieved: metadata.retrieved, contentHash: createHash('sha256').update(JSON.stringify(data)).digest('hex'), payload: data, query, metadata, dimensions: data.dimensions, rows: data.rows });
}
// Publish one bundle atomically only after both datasets have passed validation.
await mkdir(output, { recursive: true });
const target = path.join(output, 'bundle.json');
const archives = path.join(output, 'snapshots');
await mkdir(archives, { recursive: true });
let previous = [];
try { previous = JSON.parse(await readFile(target, 'utf8')).datasets; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const snapshot of [...previous, ...snapshots]) {
  if (!/^[a-f0-9]{64}$/.test(snapshot.contentHash)) throw new Error('Invalid archive identity');
  const archive = path.join(archives, `${snapshot.contentHash}.json`);
  if (snapshot.payload !== undefined) {
    const rawArchive = path.join(archives, `${snapshot.contentHash}.payload.json`);
    const rawBytes = JSON.stringify(snapshot.payload);
    if (createHash('sha256').update(rawBytes).digest('hex') !== snapshot.contentHash) throw new Error('PSA payload archive integrity mismatch');
    try { await writeFile(rawArchive, rawBytes, { flag: 'wx' }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (createHash('sha256').update(await readFile(rawArchive)).digest('hex') !== snapshot.contentHash) throw new Error('PSA retained payload archive conflict');
    }
  }
  try { await writeFile(archive, JSON.stringify(snapshot, null, 2), { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const retained = JSON.parse(await readFile(archive, 'utf8'));
    if (retained.contentHash !== snapshot.contentHash || JSON.stringify(retained.rows) !== JSON.stringify(snapshot.rows) || JSON.stringify(retained.dimensions) !== JSON.stringify(snapshot.dimensions)) throw new Error('PSA archive conflict; existing evidence was preserved');
  }
}
const temp = path.join(output, `bundle-${process.pid}.tmp`);
await writeFile(temp, JSON.stringify({ schemaVersion: 1, datasets: snapshots }, null, 2), { flag: 'wx' });
await rename(temp, target);
for (const item of snapshots) console.log(`${item.indicator}: ${item.rows.length} cells, release ${item.release}`);
