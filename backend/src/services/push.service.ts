import { DeviceToken } from '../models/DeviceToken.model';
import { config } from '../config/env';

let firebaseAdmin: typeof import('firebase-admin') | null = null;

async function getFirebase() {
  if (firebaseAdmin) return firebaseAdmin;
  try {
    firebaseAdmin = await import('firebase-admin');
    if (!firebaseAdmin.apps.length) {
      const serviceAccount = config.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(config.FIREBASE_SERVICE_ACCOUNT)
        : undefined;

      if (serviceAccount) {
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert(serviceAccount),
        });
      } else {
        console.warn('[Push] FIREBASE_SERVICE_ACCOUNT not configured — push notifications disabled');
        firebaseAdmin = null;
      }
    }
    return firebaseAdmin;
  } catch (err) {
    console.error('[Push] Failed to initialize Firebase Admin:', err);
    firebaseAdmin = null;
    return null;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  route?: string;
  data?: Record<string, string>;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  const firebase = await getFirebase();
  if (!firebase) return;

  const devices = await DeviceToken.find({ userId }).lean();
  if (!devices.length) return;

  const tokens = devices.map((d) => d.token);

  const message: import('firebase-admin').messaging.MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      ...(payload.data || {}),
      ...(payload.route ? { route: payload.route } : {}),
    },
    android: {
      priority: 'high' as const,
      notification: {
        channelId: 'artes_default',
        sound: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          badge: 1,
          sound: 'default',
        },
      },
    },
  };

  try {
    const response = await firebase.messaging().sendEachForMulticast(message);

    // Remove invalid tokens
    if (response.failureCount > 0) {
      const tokensToRemove: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (resp.error) {
          const code = resp.error.code;
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            tokensToRemove.push(tokens[idx]);
          }
        }
      });
      if (tokensToRemove.length) {
        await DeviceToken.deleteMany({ token: { $in: tokensToRemove } });
      }
    }
  } catch (err) {
    console.error('[Push] Failed to send push notification:', err);
  }
}

export async function registerDeviceToken(
  userId: string,
  organizationId: string,
  token: string,
  platform: 'android' | 'ios' | 'web',
): Promise<void> {
  await DeviceToken.findOneAndUpdate(
    { token },
    { userId, organizationId, token, platform },
    { upsert: true, new: true },
  );
}

export async function unregisterDeviceToken(userId: string, token?: string): Promise<void> {
  if (token) {
    await DeviceToken.deleteOne({ userId, token });
  } else {
    await DeviceToken.deleteMany({ userId });
  }
}
