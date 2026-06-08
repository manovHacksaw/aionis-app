import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';

// POST /api/notifications/read
// Body: { address, id? } — marks a single notification as read, or every
// unread notification for the wallet when `id` is omitted.
export async function POST(req: Request) {
  try {
    const { address, id } = await req.json();

    if (typeof address !== 'string' || !address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const recipient = address.toLowerCase();

    if (id) {
      await prisma.notification.updateMany({
        where: { id, recipient },
        data:  { read: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { recipient, read: false },
        data:  { read: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[notifications read API] Update error:', err);
    return NextResponse.json({ error: err?.message ?? 'Internal Server Error' }, { status: 500 });
  }
}
