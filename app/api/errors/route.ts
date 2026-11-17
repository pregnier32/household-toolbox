import { NextResponse } from 'next/server';
import { pageErrorReport, recordPageError } from '@/lib/error-report';

export const runtime = 'nodejs';

const MAX_BODY = 2_000;

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: 'Report is too large.' }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid report.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid report.' }, { status: 400 });
  }
  const fields = body as { digest?: unknown; message?: unknown; path?: unknown };
  const report = pageErrorReport(fields);
  if (!report) return NextResponse.json({ error: 'Invalid report.' }, { status: 400 });
  recordPageError(report);
  return new NextResponse(null, { status: 204 });
}
