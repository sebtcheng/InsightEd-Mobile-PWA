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

    // 1. Listen for Auth Changes & Sync with Firestore
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User Logged In: Fetch preference
                try {
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists() && docSnap.data().theme) {
                        setIsDarkMode(docSnap.data().theme === 'dark');
                    }
                } catch (error) {
                    console.error("Failed to sync theme:", error);
                }
            } else {
                // User Logged Out: Revert to local preference or default (Light)
                const localTheme = localStorage.getItem('theme') === 'dark';
                setIsDarkMode(localTheme);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Apply Theme to HTML & Update Persistence
    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }

        // If user is logged in, sync to Firestore
        const user = auth.currentUser;
        if (user) {
            const docRef = doc(db, "users", user.uid);
            // Use setDoc with merge to avoid overwriting other fields if document exists
            // We use catch to handle cases where user doc might not exist yet (rare in this flow but possible)
            setDoc(docRef, { theme: isDarkMode ? 'dark' : 'light' }, { merge: true })
                .catch(e => console.error("Error saving theme to DB:", e));
        }

    }, [isDarkMode]);

    const toggleTheme = () => {
        setIsDarkMode(prev => !prev);
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
