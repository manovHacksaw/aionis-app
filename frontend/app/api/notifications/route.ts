import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';

const PAGE_SIZE = 30;

// GET /api/notifications?address=0x...
// Recent notifications for a wallet, newest first, plus the unread count
// (used to badge the navbar bell).
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'address query param required' }, { status: 400 });
  }

  const recipient = address.toLowerCase();

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where:   { recipient },
      orderBy: { createdAt: 'desc' },
      take:    PAGE_SIZE,
    }),
    prisma.notification.count({ where: { recipient, read: false } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
