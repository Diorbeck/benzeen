// Web Push helper (server-only, Node runtime). VAPID keys come from env.
// Graceful degradation: if keys are missing, push is DISABLED (a one-time
// warning is logged) and send calls become no-ops — nothing throws.
import webpush from 'web-push';

import { prisma } from '@/lib/prisma';

let configured = false;
let warned = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey =
    process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@benzeen.uz';

  if (!publicKey || !privateKey) {
    if (!warned) {
      warned = true;
      console.warn(
        '[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — web push is DISABLED.',
      );
    }
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
};

/**
 * Sends a push notification to every stored subscription for a user.
 * Best-effort: prunes subscriptions that the push service reports as gone
 * (404/410). Never throws.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
      } catch (e: unknown) {
        const statusCode =
          typeof e === 'object' && e !== null && 'statusCode' in e
            ? (e as { statusCode?: number }).statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired — remove it.
          await prisma.pushSubscription
            .delete({ where: { endpoint: sub.endpoint } })
            .catch(() => {});
        } else {
          console.error('[push] send failed:', e);
        }
      }
    }),
  );
}
