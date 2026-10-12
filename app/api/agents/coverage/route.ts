import { psaCoverage } from '@/lib/agents/data-evidence.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json({ schemaVersion: 1, indicators: await psaCoverage(), migration: { configurable: false, status: 'context-only', reason: 'Check evidence for each run. PSA projections already include migration assumptions; do not add a second migration adjustment.' } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'PSA evidence unavailable. Run node scripts/import-psa.mjs.' }, { status: 503 });
  }
}
