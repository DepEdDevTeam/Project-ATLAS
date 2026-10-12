import { NextResponse } from 'next/server';
import { importHazardAssessment, readHazardSnapshot } from '@/lib/agents/hazard-connector';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { return NextResponse.json(await readHazardSnapshot(new URL(request.url).searchParams.get('id') || ''), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Hazard snapshot unavailable.' }, { status: 404 }); }
}
export async function POST(request: Request) {
  try { const text = await request.text(); if (text.length > 12000000) throw new Error('Hazard JSON exceeds the 12 MB limit.'); return NextResponse.json(await importHazardAssessment(JSON.parse(text))); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Hazard import failed.' }, { status: 400 }); }
}
