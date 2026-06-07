import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, follower } = body;

    if (!follower || !email) {
      return NextResponse.json(
        { error: 'Email and follower address are required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    const followerLower = follower.toLowerCase();
    const emailLower = email.trim().toLowerCase();

    // Uniqueness: this email must not already be registered to a different wallet
    const existing = await prisma.followerProfile.findFirst({
      where: { email: { equals: emailLower, mode: 'insensitive' } },
    });
    if (existing && existing.follower !== followerLower) {
      return NextResponse.json(
        { error: 'This email is already registered to another wallet' },
        { status: 409 }
      );
    }

    // 1. Upsert database follower profile
    await prisma.followerProfile.upsert({
      where: { follower: followerLower },
      create: {
        follower: followerLower,
        email: email.trim(),
        notifications: true,
      },
      update: {
        email: email.trim(),
        notifications: true,
      },
    });

    // 2. Dispatch onboarding welcome email via Resend
    const sent = await sendWelcomeEmail(email.trim(), followerLower);

    return NextResponse.json({
      success: true,
      emailSent: sent,
    });
  } catch (err: any) {
    console.error('[subscribe API] Onboarding subscription error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal Server Error' },
      { status: 500 }
    );
  }
}
