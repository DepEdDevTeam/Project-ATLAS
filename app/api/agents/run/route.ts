import { NextResponse } from 'next/server';
import { validateConfiguration } from '@/lib/agents/planning-contract';
import { runPlanning } from '@/lib/agents/planning-orchestrator';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  let configuration;
  try { configuration = await request.json(); validateConfiguration(configuration); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid configuration.' }, { status: 400 }); }
  try { return NextResponse.json(await runPlanning(configuration), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Planning run failed. Check evidence files and storage access.' }, { status: 503 }); }
}
