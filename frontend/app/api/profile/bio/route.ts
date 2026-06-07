import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';

const MAX_BIO_LENGTH = 280;

export async function POST(req: Request) {
  try {
    const { address, bio } = await req.json();

    if (typeof address !== 'string' || !address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }
    if (typeof bio !== 'string') {
      return NextResponse.json({ error: 'Bio must be a string' }, { status: 400 });
    }
    const trimmed = bio.trim();
    if (trimmed.length > MAX_BIO_LENGTH) {
      return NextResponse.json({ error: `Bio must be ${MAX_BIO_LENGTH} characters or fewer` }, { status: 400 });
    }

    const followerLower = address.toLowerCase();
    const value = trimmed.length > 0 ? trimmed : null;

    await prisma.followerProfile.upsert({
      where:  { follower: followerLower },
      create: { follower: followerLower, email: '', notifications: false, bio: value },
      update: { bio: value },
    });

    return NextResponse.json({ bio: value });
  } catch (err: any) {
    console.error('[profile bio API] Update error:', err);
    return NextResponse.json({ error: err?.message ?? 'Internal Server Error' }, { status: 500 });
  }
}
