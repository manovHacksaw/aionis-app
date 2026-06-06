import { NextResponse } from 'next/server';

// Superseded by /api/vaults (POST) and /api/vaults/[address] (GET).
export async function POST() {
  return NextResponse.json({ error: 'Use POST /api/vaults instead.' }, { status: 410 });
}

export async function GET() {
  return NextResponse.json({ error: 'Use GET /api/vaults/[address] instead.' }, { status: 410 });
}
