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
      return;
    } catch (err: any) {
      const msg = err?.message || '';
      const code = err?.codeName;
      const isMissing = code === 'IndexNotFound' || /cannot find index|index not found/i.test(msg);
      const isPermDenied = code === 'Unauthorized' || code === 'AtlasError' || /not allowed to do action \[collMod\]/i.test(msg);
      if (!isMissing && !isPermDenied) throw err;
      // Fallback: drop + recreate. Required on MongoDB Atlas where the
      // built-in roles (e.g. atlasAdmin) don't grant the collMod privilege.
      // There's a brief window where the TTL index is absent — MongoDB's TTL
      // monitor runs every 60s, so the worst case is a single missed cleanup
      // pass. Acceptable.
      try { await LoginSession.collection.dropIndex(TTL_INDEX_NAME); } catch { /* not present */ }
      await LoginSession.collection.createIndex(TTL_KEY_PATTERN, {
        name: TTL_INDEX_NAME,
        expireAfterSeconds: seconds,
      });
      console.log(`[LoginSession] TTL index recreated: ${seconds}s (collMod ${isPermDenied ? 'denied — Atlas perms' : 'index missing'})`);
    }
  } catch (err) {
    console.error('[LoginSession] Failed to sync TTL:', err);
  }
}
