import { NextResponse } from 'next/server';
import { activeInstructions, agentIds, instructionHistory, saveInstructions, type AgentId } from '@/lib/agents/instruction-store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const agent = new URL(request.url).searchParams.get('agent');
  if (agent && !agentIds.includes(agent as AgentId)) return NextResponse.json({ error: 'Unknown agent.' }, { status: 400 });
  try { return NextResponse.json(agent ? { history: await instructionHistory(agent as AgentId) } : { instructions: await activeInstructions() }); }
  catch { return NextResponse.json({ error: 'Could not read instruction storage.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ version: await saveInstructions(body.agent, body.text, body.expectedVersion) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save instructions.' }, { status: 400 }); }
}
