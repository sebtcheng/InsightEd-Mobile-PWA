// src/firebase.js
import { initializeApp, getApps } from "firebase/app"; // 👈 Added getApps
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

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

// 2. Export Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// 3. ENABLE OFFLINE DATABASE (With Error Handling)
// We wrap this in a catch block so it doesn't crash your app during reloads
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Error: Multiple tabs open. Persistence can only be enabled in one tab at a time.
    console.warn('Firestore persistence enabled in another tab.');
  } else if (err.code === 'unimplemented') {
    // Error: The current browser does not support all of the features required.
    console.warn('Firestore persistence not supported by this browser.');
  } else {
    // This ignores the "already started" error during hot-reloads
    console.log('Firestore persistence already active.');
  }
});