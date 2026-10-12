import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { PlanningConfiguration } from './planning-contract';
export type PolicyDocument = { id: string; fileName: string; hash: string; uploadedAt: string; pages: { page: number; text: string }[]; sourceUrl: string };
export type RuleCitation = { field: 'eligiblePct' | 'startYear' | 'endYear' | 'fundingCapPhp'; page: number; quote: string; rationale: string };
export type ReviewedPolicy = { id: string; documentId: string; documentHash: string; reviewedAt: string; rules: PlanningConfiguration['policy']; citations: RuleCitation[] };
const directory = () => path.join(process.cwd(), 'data/planning-policies');
function identifier(id: string) { if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid policy ID.'); return id; }
async function store(prefix: string, id: string, content: unknown) {
  await mkdir(directory(), { recursive: true });
  const temp = path.join(directory(), `${prefix}-${id}.tmp`);
  await writeFile(temp, JSON.stringify(content, null, 2), 'utf8');
  await rename(temp, path.join(directory(), `${prefix}-${id}.json`));
}
export async function savePolicyDocument(bytes: Uint8Array, fileName: string, pages: PolicyDocument['pages'], sourceUrl: string): Promise<PolicyDocument> {
  if (!pages.length || pages.some(p => !Number.isInteger(p.page) || p.page < 1 || typeof p.text !== 'string') || new Set(pages.map(p => p.page)).size !== pages.length) throw new Error('Invalid extracted policy pages.');
  if (pages.reduce((sum, p) => sum + p.text.length, 0) > 160000 || !pages.some(p => p.text.trim())) throw new Error('Policy text is empty or too long.');
  if (sourceUrl && !/^https?:\/\//.test(sourceUrl)) throw new Error('Invalid policy source URL.');
  const document = { id: randomUUID(), fileName: path.basename(fileName).slice(0, 180), hash: createHash('sha256').update(bytes).digest('hex'), uploadedAt: new Date().toISOString(), pages, sourceUrl };
  await store('document', document.id, document);
  await writeFile(path.join(directory(), `original-${document.id}.bin`), bytes, { flag: 'wx' });
  return document;
}
export async function readPolicyDocument(id: string): Promise<PolicyDocument> { return JSON.parse(await readFile(path.join(directory(), `document-${identifier(id)}.json`), 'utf8')); }
export function verifyRuleCitations(document: PolicyDocument, citations: RuleCitation[]) {
  const fields = ['eligiblePct', 'startYear', 'endYear', 'fundingCapPhp'];
  if (!Array.isArray(citations) || citations.length !== fields.length || new Set(citations.map(c => c.field)).size !== fields.length) throw new Error('Cite each of the four policy constraints exactly once.');
  for (const citation of citations) {
    const page = document.pages.find(p => p.page === citation.page);
    if (!fields.includes(citation.field) || !page || typeof citation.quote !== 'string' || citation.quote.trim().length < 8 || !page.text.includes(citation.quote) || typeof citation.rationale !== 'string' || !citation.rationale.trim() || citation.rationale.length > 2000) throw new Error(`Invalid source passage or review rationale for ${citation.field}.`);
  }
}
export async function saveReviewedPolicy(documentId: string, rules: PlanningConfiguration['policy'], citations: RuleCitation[]): Promise<ReviewedPolicy> {
  const document = await readPolicyDocument(documentId);
  verifyRuleCitations(document, citations);
  const reviewed = { id: randomUUID(), documentId, documentHash: document.hash, reviewedAt: new Date().toISOString(), rules: { ...rules, sourceUrl: document.sourceUrl }, citations };
  await store('review', reviewed.id, reviewed);
  return reviewed;
}
export async function readReviewedPolicy(id: string): Promise<ReviewedPolicy> { return JSON.parse(await readFile(path.join(directory(), `review-${identifier(id)}.json`), 'utf8')); }
