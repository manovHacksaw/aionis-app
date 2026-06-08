import { prisma }    from '@/lib/prisma';
import { Prisma }    from '@prisma/client';

export type NotificationType = 'FOLLOW' | 'TRADE_OPENED';

type CreateNotificationInput = {
  recipient: string;
  type: NotificationType;
  message: string;
  actor?: string | null;
  metadata?: Prisma.InputJsonValue;
  /** Stable key that prevents the same event from being recorded twice
   *  (e.g. an on-chain requestId/positionId rediscovered on a later poll). */
  dedupeKey?: string;
};

// Creates a notification for `recipient`. When `dedupeKey` is given, the
// insert is idempotent — re-detecting the same on-chain event (the activity
// feed has no DB mirror and is reconstructed from logs on every page view)
// upserts onto the existing row instead of producing a duplicate.
export async function createNotification({
  recipient,
  type,
  message,
  actor = null,
  metadata = {},
  dedupeKey,
}: CreateNotificationInput) {
  const data = {
    recipient: recipient.toLowerCase(),
    type,
    message,
    actor: actor ? actor.toLowerCase() : null,
    metadata: metadata as Prisma.InputJsonValue,
  };

  if (dedupeKey) {
    return prisma.notification.upsert({
      where:  { dedupeKey },
      update: {},
      create: { ...data, dedupeKey },
    });
  }

  return prisma.notification.create({ data });
}
