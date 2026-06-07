import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/prisma';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const profile = await prisma.followerProfile.findUnique({
    where: { follower: address.toLowerCase() },
    select: { avatarUrl: true },
  });

  return NextResponse.json({ avatarUrl: profile?.avatarUrl ?? null });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const address = formData.get('address');

    if (!(file instanceof File) || typeof address !== 'string' || !address) {
      return NextResponse.json({ error: 'File and address are required' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Image must be smaller than 5MB' }, { status: 400 });
    }

    const followerLower = address.toLowerCase();
    const ext = file.name.split('.').pop() || 'png';

    const blob = await put(`avatars/${followerLower}-${Date.now()}.${ext}`, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    await prisma.followerProfile.upsert({
      where: { follower: followerLower },
      create: { follower: followerLower, email: '', notifications: false, avatarUrl: blob.url },
      update: { avatarUrl: blob.url },
    });

    return NextResponse.json({ avatarUrl: blob.url });
  } catch (err: any) {
    console.error('[avatar API] Upload error:', err);
    return NextResponse.json({ error: err?.message ?? 'Internal Server Error' }, { status: 500 });
  }
}
