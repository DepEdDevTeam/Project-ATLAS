import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { readPolicyDocument, savePolicyDocument, saveReviewedPolicy } from '@/lib/agents/policy-store';
import { defaultConfiguration, validateConfiguration } from '@/lib/agents/planning-contract';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { return NextResponse.json(await readPolicyDocument(new URL(request.url).searchParams.get('id') || '')); }
  catch { return NextResponse.json({ error: 'Policy document not found.' }, { status: 404 }); }
}
export async function POST(request: Request) {
  let temporary = '';
  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json();
      validateConfiguration({ ...defaultConfiguration, policy: body.rules });
      return NextResponse.json(await saveReviewedPolicy(body.documentId, body.rules, body.citations));
    }
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !/\.(pdf|txt)$/i.test(file.name) || file.size < 1 || file.size > 12 * 1024 * 1024) throw new Error('Upload a PDF or UTF-8 text policy, up to 12 MB.');
    const bytes = Buffer.from(await file.arrayBuffer());
    let pages;
    if (/\.txt$/i.test(file.name)) pages = [{ page: 1, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }];
    else {
      if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Invalid PDF file.');
      temporary = await mkdtemp(path.join(os.tmpdir(), 'atlas-planning-policy-'));
      const filePath = path.join(temporary, 'policy.pdf');
      await writeFile(filePath, bytes);
      await promisify(execFile)(process.env.PYTHON_BIN || 'python', [path.join(process.cwd(), 'scripts/process-research-pdfs.py'), filePath, '--max-pages', '250', '--max-chars', '1800', '--overlap', '0'], { timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
      const parsed = JSON.parse(await readFile(path.join(temporary, 'policy-chunks.json'), 'utf8'));
      const grouped = new Map<number, string>();
      for (const chunk of parsed.chunks) grouped.set(chunk.pdf_page, `${grouped.get(chunk.pdf_page) || ''}\n${chunk.text}`);
      pages = [...grouped].map(([page, text]) => ({ page, text }));
    }
    const source = form.get('sourceUrl');
    return NextResponse.json(await savePolicyDocument(bytes, file.name, pages, typeof source === 'string' ? source : ''));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Policy processing failed.' }, { status: 400 }); }
  finally { if (temporary && path.dirname(temporary) === os.tmpdir() && path.basename(temporary).startsWith('atlas-planning-policy-')) await rm(temporary, { recursive: true, force: true }).catch(() => undefined); }
}
