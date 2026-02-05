import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, inMemoryPersistence } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDKbjlnMauvdUZS4S8V6FkNaWAEXFQ1fFs",
  authDomain: "insighted-6ba10.firebaseapp.com",
  projectId: "insighted-6ba10",
  storageBucket: "insighted-6ba10.firebasestorage.app",
  messagingSenderId: "945568231794",
  appId: "1:945568231794:web:5a3c1688c1ddfa8dd7edeb",
  measurementId: "G-YNB5VVV6ZN"
};

// 1. SINGLETON CHECK: Only initialize if no app exists
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// 2. Export Services (Auth with robust persistence)
export const auth = getAuth(app);
// Try local persistence, fallback to memory if IDB is broken
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Local persistence failed (IDB Error?), falling back to memory.", err);
  return setPersistence(auth, inMemoryPersistence);
});

export const googleProvider = new GoogleAuthProvider();

// 3. FIRESTORE WITH ROBUST CACHE
export const db = getFirestore(app);

// Enable Offline Database (With Error Handling)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence enabled in another tab.');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence not supported by this browser.');
  } else {
    console.warn(`Firestore persistence failed: ${err.code}`);
  }
});

export const storage = getStorage(app);