import { NextResponse } from 'next/server';
import { listPlanningRuns, readPlanningRun } from '@/lib/agents/run-store';
import { renderExecutiveReport } from '@/lib/agents/report-renderer';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    if (!params.has('id')) return NextResponse.json({ runs: await listPlanningRuns() }, { headers: { 'Cache-Control': 'no-store' } });
    const run = await readPlanningRun(params.get('id') || '');
    if (params.get('format') === 'html') return new Response(renderExecutiveReport(run), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="atlas-${run.id}.html"`, 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } });
    return NextResponse.json(run, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Run unavailable.' }, { status: 404 }); }
}
