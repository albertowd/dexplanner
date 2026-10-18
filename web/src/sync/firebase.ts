// Firebase adapter for cloud sync. Loaded on demand (dynamic import) so visitors who never sign in
// don't download the Firebase SDK. Uses Firestore Lite: no realtime listeners, much smaller bundle.
import { initializeApp } from 'firebase/app';
import {
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore/lite';
import type { FirebaseConfig } from './config.ts';
import { DocumentMissingError, type SyncBackend } from './engine.ts';
import type { RemoteDoc, SyncPatch } from './patch.ts';

export interface SyncUser {
  uid: string;
  name: string | null;
  email: string | null;
  photoUrl: string | null;
}

const toSyncUser = (u: User): SyncUser => ({ uid: u.uid, name: u.displayName, email: u.email, photoUrl: u.photoURL });

export function createFirebase(config: FirebaseConfig) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();

  function backendFor(uid: string): SyncBackend {
    const ref = doc(db, 'trainers', uid);
    return {
      async load() {
        const snap = await getDoc(ref);
        return snap.exists() ? (snap.data() as Partial<RemoteDoc>) : null;
      },
      async save(remote) {
        await setDoc(ref, { ...remote, updatedAt: serverTimestamp() });
      },
      async patch(patch: SyncPatch) {
        const fields: Record<string, unknown> = { updatedAt: serverTimestamp() };
        for (const [key, add] of Object.entries(patch.registered)) fields[`registered.${key}`] = add ? true : deleteField();
        for (const [key, add] of Object.entries(patch.owned)) fields[`owned.${key}`] = add ? true : deleteField();
        if (patch.showRetro !== undefined) fields.showRetro = patch.showRetro;
        try {
          await updateDoc(ref, fields);
        } catch (error) {
          if ((error as { code?: string }).code === 'not-found') throw new DocumentMissingError();
          throw error;
        }
      },
      async remove() {
        await deleteDoc(ref);
      },
    };
  }

  return {
    onUser(callback: (user: SyncUser | null) => void) {
      return onAuthStateChanged(auth, (u) => callback(u ? toSyncUser(u) : null));
    },
    async signIn() {
      return toSyncUser((await signInWithPopup(auth, provider)).user);
    },
    signOut: () => signOut(auth),
    backendFor,
    /** Deletes the sign-in account itself (the caller deletes the data first). */
    async deleteAccount() {
      const user = auth.currentUser;
      if (!user) return;
      try {
        await deleteUser(user);
      } catch (error) {
        if ((error as { code?: string }).code !== 'auth/requires-recent-login') throw error;
        await reauthenticateWithPopup(user, provider);
        await deleteUser(user);
      }
    },
  };
}

export type FirebaseClient = ReturnType<typeof createFirebase>;
