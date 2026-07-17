import { Timestamp } from 'firebase-admin/firestore';

import { COLLECTIONS } from '../lib/collections.js';
import { getDb, initFirestore } from '../lib/firestore.js';
import { logger } from '../lib/logger.js';
import type { AuthUser } from '../types/domain.js';
import type { UserDocument } from '../types/firestore.js';

/**
 * Upsert `users/{uid}` on login.
 * Sets createdAt once; always updates lastLoginAt. Fail-open.
 */
export async function upsertOnLogin(user: AuthUser): Promise<void> {
  try {
    initFirestore();
    const ref = getDb().collection(COLLECTIONS.USERS).doc(user.uid);
    const snap = await ref.get();
    const now = Timestamp.now();

    if (!snap.exists) {
      const doc: UserDocument = {
        uid: user.uid,
        email: user.email,
        name: user.name,
        picture: user.picture,
        createdAt: now,
        lastLoginAt: now,
      };
      await ref.set(doc);
      return;
    }

    await ref.set(
      {
        email: user.email,
        name: user.name,
        picture: user.picture,
        lastLoginAt: now,
      },
      { merge: true },
    );
  } catch (err) {
    logger.warn({ err, uid: user.uid }, 'user upsertOnLogin failed (fail-open)');
  }
}

export async function getUserById(uid: string): Promise<AuthUser | null> {
  try {
    initFirestore();
    const snap = await getDb().collection(COLLECTIONS.USERS).doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() as UserDocument;
    return {
      uid: data.uid,
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  } catch (err) {
    logger.warn({ err, uid }, 'getUserById failed');
    return null;
  }
}
