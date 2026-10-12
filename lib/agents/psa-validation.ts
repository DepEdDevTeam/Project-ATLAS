import type { PsaSnapshot } from './data-contract';
import { createHash } from 'node:crypto';

// Validate persisted observations again: importer checks alone do not protect later reads.
export function validatePsaSnapshot(value: unknown): asserts value is PsaSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid PSA snapshot.');
  const s = value as PsaSnapshot;
  if (s.schemaVersion !== 1 || !['population-projection', 'net-enrollment-rate'].includes(s.indicator)) throw new Error('Unsupported PSA indicator.');
  if (s.unit !== (s.indicator === 'population-projection' ? 'thousand-persons' : 'percent')) throw new Error('PSA indicator unit mismatch.');
  for (const key of ['id', 'geography', 'release', 'sourceUpdated', 'importedAt', 'unitSource', 'originalSourceUrl'] as const) {
    if (typeof s[key] !== 'string' || !s[key].trim()) throw new Error(`Missing PSA ${key}.`);
  }
  if (!/^[a-f0-9]{64}$/.test(s.contentHash)) throw new Error('Invalid PSA payload hash.');
  if (s.payload !== undefined && createHash('sha256').update(JSON.stringify(s.payload)).digest('hex') !== s.contentHash) throw new Error('PSA source payload integrity check failed.');
  if (s.payload !== undefined) {
    const payload = s.payload as { rows?: unknown; dimensions?: unknown };
    if (JSON.stringify(payload.rows) !== JSON.stringify(s.rows) || JSON.stringify(payload.dimensions) !== JSON.stringify(s.dimensions)) throw new Error('PSA normalized observations differ from the retained payload.');
  }
  for (const url of [s.unitSource, s.originalSourceUrl]) {
    try { if (new URL(url).protocol !== 'https:') throw new Error(); }
    catch { throw new Error('PSA source URLs must use HTTPS.'); }
  }
  if (!Array.isArray(s.dimensions) || !s.dimensions.length || !Array.isArray(s.rows)) throw new Error('Missing PSA dimensions or observations.');
  const dimensions = new Set<string>();
  for (const dimension of s.dimensions) {
    if (typeof dimension.code !== 'string' || !dimension.code || dimensions.has(dimension.code)) throw new Error('Ambiguous PSA dimension.');
    dimensions.add(dimension.code);
  }
  for (const required of ['Sex', 'Year', s.indicator === 'population-projection' ? 'Age Group' : 'Level of Education']) {
    if (!dimensions.has(required)) throw new Error(`Missing PSA dimension ${required}.`);
  }
  if ((s.geography === 'national-and-regional' || s.indicator === 'net-enrollment-rate') && !dimensions.has('Geolocation')) throw new Error('Missing PSA geographic identity.');
  const identities = new Set<string>();
  for (const row of s.rows) {
    if (!Array.isArray(row.codes) || !Array.isArray(row.labels) || row.codes.length !== s.dimensions.length || row.labels.length !== s.dimensions.length || !row.codes.every(code => typeof code === 'string') || !row.labels.every(label => typeof label === 'string')) throw new Error('Malformed PSA observation.');
    const identity = JSON.stringify(row.codes);
    if (identities.has(identity)) throw new Error('Duplicate PSA observation.');
    identities.add(identity);
    // Preserve published values above 100; suitability is checked for the selected rate by the module.
    if (row.value !== null && (typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value < 0)) throw new Error('Invalid PSA observation value.');
  }
}
