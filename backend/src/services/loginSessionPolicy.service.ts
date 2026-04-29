import mongoose from 'mongoose';
import { LoginSession } from '../models/LoginSession.model';
import { AppSettings } from '../models/AppSettings.model';

// When sessionPolicy.autoLogoutMinutes is 0 ("disabled"), TTL still needs a
// finite value or the collection grows unbounded. Cap at 24h.
const DISABLED_FALLBACK_SECONDS = 24 * 60 * 60;

const TTL_INDEX_NAME = 'lastActiveAt_1';
const TTL_KEY_PATTERN = { lastActiveAt: 1 };

/**
 * Sync the LoginSession TTL index to AppSettings.sessionPolicy.autoLogoutMinutes.
 * Uses collMod to modify the existing index in place. Falls back to creating
 * the index if it doesn't exist yet (fresh install / brand-new collection).
 */
export async function syncLoginSessionTTL(): Promise<void> {
  try {
    const settings = await AppSettings.findOne().select('sessionPolicy').lean();
    const minutes = settings?.sessionPolicy?.autoLogoutMinutes ?? 30;
    const seconds = minutes > 0 ? minutes * 60 : DISABLED_FALLBACK_SECONDS;

    const db = mongoose.connection.db;
    if (!db) {
      console.warn('[LoginSession] No mongoose connection — skipping TTL sync');
      return;
    }
    const collectionName = LoginSession.collection.collectionName;

    try {
      await db.command({
        collMod: collectionName,
        index: { keyPattern: TTL_KEY_PATTERN, expireAfterSeconds: seconds },
      });
      console.log(`[LoginSession] TTL synced in place: ${seconds}s (autoLogoutMinutes=${minutes})`);
    } catch (err: any) {
      const msg = err?.message || '';
      const code = err?.codeName;
      if (code === 'IndexNotFound' || /cannot find index|index not found/i.test(msg)) {
        await LoginSession.collection.createIndex(TTL_KEY_PATTERN, {
          name: TTL_INDEX_NAME,
          expireAfterSeconds: seconds,
        });
        console.log(`[LoginSession] TTL index created: ${seconds}s`);
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('[LoginSession] Failed to sync TTL:', err);
  }
}
