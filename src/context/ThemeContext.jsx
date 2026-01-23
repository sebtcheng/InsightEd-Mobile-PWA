import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Default to light mode or local storage if no user
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark';
        }
        return false;
    });

    // loading state to prevent flash of wrong theme
    const [loading, setLoading] = useState(true);

    // 1. Listen for Auth Changes & Sync with Firestore (READ ONLY usually)
    useEffect(() => {
        let authListenerHasFired = false;

        // SAFETY TIMEOUT: Force app to load if Auth hangs (e.g. Blocked)
        const safetyTimeout = setTimeout(() => {
             if (!authListenerHasFired) {
                 console.warn("Auth Listener Timed Out (Likely Blocked). Forcing App Load.");
                 setLoading(false);
             }
        }, 2000);

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            authListenerHasFired = true;
            clearTimeout(safetyTimeout); // Clear safety if auth works

            if (user) {
                // User Logged In: Fetch preference from Firestore
                try {
                    const docRef = doc(db, "users", user.uid);
                    
                    // Race Firestore against a fast 3s timeout for theme (theme isn't critical)
                    const docSnap = await Promise.race([
                        getDoc(docRef),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Theme Sync Timeout")), 3000))
                    ]);
                    
                    if (docSnap.exists() && docSnap.data().theme) {
                        // Trust DB if it has a value
                        const firestoreTheme = docSnap.data().theme;
                        setIsDarkMode(firestoreTheme === 'dark');
                    } else {
                        // No DB value? Sync local preference UP to DB once.
                        const currentLocal = localStorage.getItem('theme') || 'light';
                        await setDoc(docRef, { theme: currentLocal }, { merge: true }).catch(err => {
                            // If blocked, just ignore.
                            console.warn("Could not sync initial theme to DB (likely blocked):", err.code || err);
                        });
                    }
                } catch (error) {
                    // Handle "Blocked by Client" or Timeout gracefully
                    console.warn("Theme sync skipped (blocked/timeout). Using local preference.", error);
                    // Ensure we stick to local storage if DB fails
                    const localTheme = localStorage.getItem('theme') === 'dark';
                    setIsDarkMode(localTheme);
                }
            } else {
                // User Logged Out: Revert to local preference
                const localTheme = localStorage.getItem('theme') === 'dark';
                setIsDarkMode(localTheme);
            }
            setLoading(false);
        });

        return () => {
            unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, []);

    // 2. Apply Theme to HTML (Local Only)
    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    // 3. User Explicitly Toggles Theme (Write to DB)
    const toggleTheme = async () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        
        // Persist to Firestore if logged in
        const user = auth.currentUser;
        if (user) {
            try {
                const docRef = doc(db, "users", user.uid);
                await setDoc(docRef, { theme: newMode ? 'dark' : 'light' }, { merge: true });
            } catch (error) {
                 console.warn("Failed to save theme preference (likely blocked):", error);
            }
        }
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
            {!loading && children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
