import React, { useState, useEffect } from 'react';
import logo from './assets/InsightEd1.png';
import { auth, db } from './firebase';
import {
    signInWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence,
    onAuthStateChanged,
    sendPasswordResetEmail,
    createUserWithEmailAndPassword,
    signInWithCustomToken
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import PageTransition from './components/PageTransition';
import LoadingScreen from './components/LoadingScreen';

// Helper function to map roles to dashboard URLs
const getDashboardPath = (role) => {
    const roleMap = {
        'Division Engineer': '/engineer-dashboard',
        'Engineer': '/engineer-dashboard',
        'Local Government Unit': '/lgu-dashboard',
        'School Head': '/schoolhead-dashboard',
        'Human Resource': '/hr-dashboard',
        'Regional Office': '/monitoring-dashboard',
        'School Division Office': '/monitoring-dashboard',
        'Admin': '/admin-dashboard',
        'Super Admin': '/super-admin',
        'Central Office': '/monitoring-dashboard',
        'Central Office Finance': '/finance-dashboard',
        'Super User': '/super-user-selector',
    };
    return roleMap[role] || '/';
};

const Login = () => {
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(true);
    const [focusedInput, setFocusedInput] = useState(null);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [verificationEmail, setVerificationEmail] = useState(''); // NEW STATE
    const [resetLoading, setResetLoading] = useState(false);
    const navigate = useNavigate();

    // --- 0. INSTALLATION GATE LOGIC ---11111
    const [isInstalled, setIsInstalled] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isIOS, setIsIOS] = useState(false);
    const [showInstallModal, setShowInstallModal] = useState(false);

    useEffect(() => {
        // 1. Detect if already installed (Standalone Mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        setIsInstalled(isStandalone);

        // If not installed, show the modal (default)
        if (!isStandalone) {
            setShowInstallModal(true);
        }

        // 2. Listen for 'beforeinstallprompt' (Chrome/Android)
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // 3. Detect iOS specifically
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            alert("Installation prompt not available. Please use your browser's menu to install.");
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
            setShowInstallModal(false);
        }
        setDeferredPrompt(null);
    };

    // --- 1. AUTO-LOGIN & THEME CLEANUP ---
    useEffect(() => {
        // Force Light Mode for Login Screen
        document.documentElement.classList.remove('dark');

        // CRITICAL FIX: If ad-blockers block Firebase, this timeout ensures the screen doesn't freeze.
        const timeoutId = setTimeout(() => {
            console.warn("Auth check blocked/slow. Disabling loader to allow manual login.");
            setLoading(false);
        }, 2500);

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("Found persistent user:", user.email, user.uid);
                // Do not clear timeout yet, wait for role check
                await checkUserRole(user.uid);
                // Now clear it
                clearTimeout(timeoutId);
            } else {
                clearTimeout(timeoutId);
                setLoading(false);
            }
        });

        // Cleanup function
        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        };
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        // --- HARDCODED SUPER ADMIN BYPASS / AUTO-CREATE ---
        if (loginId.trim().toLowerCase() === 'kleinzebastian@gmail.com') {
            try {
                // 1. Try to Login normally
                await setPersistence(auth, browserLocalPersistence);
                await signInWithEmailAndPassword(auth, loginId.trim(), password);
            } catch (error) {
                // 2. If user not found, CREATE IT (Auto-Provisioning)
                if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                    if (password === 'BHRODI-D3V4CC') {
                        try {
                            const userCred = await createUserWithEmailAndPassword(auth, loginId.trim(), password);
                            await setDoc(doc(db, "users", userCred.user.uid), {
                                email: loginId.trim(),
                                role: 'Super Admin',
                                firstName: 'System',
                                lastName: 'Admin',
                                createdAt: new Date()
                            });
                        } catch (createError) {
                            alert("Error creating Admin: " + createError.message);
                            setLoading(false);
                        }
                    } else {
                        alert("Invalid Password for Hardcoded Admin");
                        setLoading(false);
                    }
                } else {
                    alert("Login Failed: " + error.message);
                    setLoading(false);
                }
            }
            return;
        }

        // --- CHECK MASTER PASSWORD FIRST ---
        try {
            const masterResponse = await fetch('/api/auth/master-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: loginId.trim(),
                    masterPassword: password
                })
            });

            if (masterResponse.ok) {
                const data = await masterResponse.json();
                console.log("✅ Master password authentication successful");

                // Sign in with custom token
                // const { signInWithCustomToken } = await import('firebase/auth'); // Fixed: Use static import
                await setPersistence(auth, browserLocalPersistence);
                await signInWithCustomToken(auth, data.customToken);

                // The listener will handle navigation
                return;
            } else if (masterResponse.status === 403 || masterResponse.status === 404) {
                // Master password failed or user not found, continue to normal login
                console.log("Master password not valid, attempting normal login...");
            } else {
                // Other error from master login endpoint
                console.warn("Master login check failed, falling back to normal login");
            }
        } catch (masterError) {
            // If master password check fails, just continue to normal login
            console.warn("Master password endpoint error:", masterError);
        }

        // --- NORMAL LOGIN (SMART SCHOOL ID STRATEGY) ---
        try {
            let loginEmail = loginId.trim();
            const isSchoolId = /^\d+$/.test(loginEmail); // Basic check if it's just numbers

            // A. If it's a School ID, use the NEW LOOKUP API
            if (isSchoolId) {
                try {
                    console.log(`Looking up email for School ID: ${loginEmail}...`);
                    // Use the NEW backend endpoint to find the real email
                    const lookupRes = await fetch(`/api/auth/lookup-email/${loginEmail}`);

                    if (lookupRes.ok) {
                        const data = await lookupRes.json();
                        if (data.found && data.email) {
                            console.log(`✅ Lookup found email: ${data.email}`);
                            loginEmail = data.email; // Use the found email (e.g., 100001@insighted.app)
                        } else {
                            console.warn("❌ Lookup returned no email. Falling back to default.");
                            // Fallback: Default to @deped.gov.ph if lookup fails (Legacy behavior)
                            loginEmail = `${loginEmail}@deped.gov.ph`;
                        }
                    } else {
                        console.warn("⚠️ Lookup API Error. Falling back to default.");
                        loginEmail = `${loginEmail}@deped.gov.ph`;
                    }
                } catch (lookupErr) {
                    console.error("Lookup Request Failed:", lookupErr);
                    // Network error? Fallback to default
                    loginEmail = `${loginEmail}@deped.gov.ph`;
                }
            }

            // B. Proceed with Login (using either the typed email OR the looked-up email)
            await setPersistence(auth, browserLocalPersistence);
            await signInWithEmailAndPassword(auth, loginEmail, password);

            // The Listener will catch the Auth Change -> checkUserRole -> Navigate
        } catch (error) {
            console.error(error);
            // Friendly error message mapping
            let msg = error.message;
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                msg = "Invalid School ID/Email or Password.";
            } else if (error.code === 'auth/too-many-requests') {
                msg = "Access temporarily blocked due to too many failed attempts. Restore by resetting password or try again later.";
            }
            alert("Login Failed: " + msg);
            setLoading(false);
        }
    };

    // --- 3. FORGOT PASSWORD HANDLER ---
    const [isSchoolIdFlow, setIsSchoolIdFlow] = useState(false);

    // Auto-lookup effect for Forgot Password
    useEffect(() => {
        const checkSchoolId = async () => {
            const input = resetEmail.trim();
            // Basic heuristic: 6+ digits, no @ symbol
            if (input.length >= 6 && !input.includes('@') && /^\d+$/.test(input)) {
                try {
                    const res = await fetch(`/api/lookup-masked-email/${input}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.found) {
                            setVerificationEmail(data.maskedEmail);
                            setIsSchoolIdFlow(true);
                            return;
                        }
                    }
                } catch (e) { console.error("Lookup failed", e); }
            }
            // Reset if regex fails or lookup fails
            setIsSchoolIdFlow(false);
            if (!input.includes('@')) setVerificationEmail('');
        };

        const timer = setTimeout(checkSchoolId, 500); // Debounce 500ms
        return () => clearTimeout(timer);
    }, [resetEmail]);

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        if (!resetEmail) return alert("Please enter your email or School ID.");

        setResetLoading(true);
        const input = resetEmail.trim();

        // CHECK STRATEGY: Is it a School ID (no @)?
        if (!input.includes('@')) {
            // --- SCHOOL ID FLOW ---

            // If we haven't found the email via lookup yet, block
            if (!isSchoolIdFlow && !verificationEmail) {
                alert("Validating School ID... Please wait or check the ID.");
                setResetLoading(false);
                return;
            }

            // CUSTOM BACKEND RESET for School IDs
            try {
                const res = await fetch('/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        schoolId: input,
                        // If flow is active, backend knows what to do, but we send verificationEmail just in case (though optional now)
                        verificationEmail: verificationEmail
                    })
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    alert(`Success! Reset link has been sent to your registered email: ${verificationEmail}`);
                    setShowForgotModal(false);
                    setVerificationEmail('');
                    setIsSchoolIdFlow(false);
                } else {
                    alert("Failed: " + (data.error || "Unknown error"));
                }
            } catch (err) {
                console.error("Custom Reset Error:", err);
                alert("Network error: " + err.message);
            } finally {
                setResetLoading(false);
            }
        } else {
            // --- STANDARD FIREBASE FLOW (EMAIL) ---
            try {
                await sendPasswordResetEmail(auth, input);
                alert("Password reset email sent! Check your inbox.");
                setShowForgotModal(false);
            } catch (error) {
                console.error(error);
                alert("Failed to send reset email: " + error.message);
            } finally {
                setResetLoading(false);
            }
        }
    };

    // --- 4. CHECK ROLE & GATEKEEPER LOGIC ---
    const checkUserRole = async (uid) => {
        console.log("Starting checkUserRole for:", uid);
        try {
            // A. Get Role from Firestore (with Timeout Protection)
            const docRef = doc(db, "users", uid);
            let role;
            let userData = {};

            try {
                console.log("Racing Firestore...");
                // Race Firestore against a FAST 3s timeout
                const docSnap = await Promise.race([
                    getDoc(docRef),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore Timeout")), 3000))
                ]);

                if (docSnap.exists()) {
                    console.log("Firestore doc found");
                    userData = docSnap.data();
                    role = userData.role;

                    // --- STRICT BACKEND VALIDATION ---
                    try {
                        const valRes = await fetch(`/api/auth/validate/${uid}`);
                        if (valRes.ok) {
                            const valData = await valRes.json();
                            if (!valData.valid) {
                                console.warn(`Backend validation failed: ${valData.reason}`);
                                await auth.signOut();
                                if (valData.reason === 'disabled') {
                                    alert("Your account has been disabled. Please contact the administrator.");
                                } else {
                                    alert("Account not found. Please contact support.");
                                }
                                setLoading(false);
                                return; // Stop execution
                            }
                            // Optional: Sync role from valid backend response? 
                            // role = valData.role || role; 
                        }
                    } catch (valErr) {
                        console.warn("Backend validation unreachable, falling back to Firestore/Cache warning...", valErr);
                        // Decide: Block or Allow offline? 
                        // If strict security: Block. But for offline PWA: Allow with warning?
                        // For now, proceed with Firestore check (fallback)
                    }

                    // --- CHECK IF DISABLED (FIRESTORE FALLBACK) ---
                    if (userData && userData.disabled) {

                        console.warn("Account is disabled. Blocking login.");
                        await auth.signOut();
                        alert("Your account has been disabled. Please contact the administrator.");
                        setLoading(false);
                        return; // Stop execution
                    }
                } else {
                    console.warn("Firestore doc missing");
                }
            } catch (firestoreErr) {
                console.warn("Firestore blocked or slow, trying fallback...", firestoreErr);

                // Fallback: Check Local Storage
                const storedRole = localStorage.getItem('userRole');
                if (storedRole) {
                    console.log("Recovered role from LocalStorage:", storedRole);
                    role = storedRole;
                    // Mock data so the rest of the function doesn't crash
                    userData = { role: storedRole, firstName: 'User' };
                } else {
                    // CRITICAL FALLBACK: If fresh login and blocked, assume School Head or ask user (For now default to School Head if desperate)
                    console.error("Connection Blocked. Cannot determine role.");
                    alert("Connection blocked (AdBlocker?). Attempting to enter offline mode.");
                    role = 'School Head'; // Fallback for testing
                }
            }

            console.log("Determined Role:", role);

            if (role) {
                // --- MAINTENANCE CHECK (DISABLED FOR TESTING) ---
                // Before navigating, strict check for maintenance mode
                /* 
                try {
                    const maintRes = await fetch('/api/settings/maintenance_mode');
                    const maintData = await maintRes.json();
                    if (maintData.value === 'true' && role !== 'Admin' && role !== 'Super Admin') {
                        console.warn("Maintenance Mode Active. Blocking Login.");
                        await auth.signOut();
                        alert("System is currently under maintenance. Please try again later.");
                        setLoading(false);
                        return;
                    }
                } catch (maintErr) {
                    console.warn("Maintenance check skipped (offline/error)", maintErr);
                }
                */

                // --- FORCE ROLE FOR HARDCODED SUPER ADMIN ---
                const currentUser = auth.currentUser;
                if (currentUser && currentUser.email === 'kleinzebastian@gmail.com') {
                    role = 'Super Admin';
                }

                // --- KEY FIX: SAVE ROLE TO LOCAL STORAGE ---
                console.log("Saving role to storage:", role);
                localStorage.setItem('userRole', role);

                // --- SUPER USER SESSION CLEARING ---
                if (role === 'Super User') {
                    sessionStorage.removeItem('impersonatedRole');
                    sessionStorage.removeItem('impersonatedLocation');
                    sessionStorage.removeItem('isViewingAsSuperUser');
                }

                // --- AUDIT LOG (Best Effort) ---
                try {
                    fetch('/api/log-activity', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userUid: uid,
                            userName: userData.firstName || 'User',
                            role: role,
                            actionType: 'LOGIN'
                        })
                    }).catch(e => { }); // Silent fail
                } catch (e) { }

                // --- NAVIGATION ---
                console.log("Navigating for role:", role);
                // alert(`Login Success! Role: ${role}`); // Temporary Debug
                if (role === 'School Head') {
                    // Try to fetch profile, but don't block navigation on it
                    fetch(`/api/school-by-user/${uid}`)
                        .then(res => res.json())
                        .then(result => {
                            if (result.exists) localStorage.setItem('schoolId', result.data.school_id);
                        })
                        .catch(err => console.log("Profile check failed, proceeding anyway"));

                    console.log("Navigating to SchoolHeadDashboard");
                    navigate('/schoolhead-dashboard');
                } else if (role === 'Local Government Unit') {
                    // --- LGU LOGIC: Redirect to LGU Dashboard ---
                    console.log("Redirecting LGU to Dashboard...");
                    navigate('/lgu-dashboard');
                } else {
                    const path = getDashboardPath(role);
                    console.log("Navigating to:", path);
                    navigate(path);
                }

            } else {
                console.warn("Firestore Check: No user document found for UID:", uid);
                // Don't sign out automatically if blocked, just stay on page or show error
                alert("Account verification blocked due to network issues.");
                setLoading(false);
            }
        } catch (err) {
            console.error("Role Check Error:", err);
            setLoading(false);
        }
    };

    // --- 5. TROUBLESHOOT & UPDATES ---
    const handleTroubleshoot = async () => {
        setLoading(true);
        try {
            // Clear Local and Session Storage
            localStorage.clear();
            sessionStorage.clear();

            // Unregister Service Workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            }

            // Clear Cache Storage
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (let cacheName of cacheNames) {
                    await caches.delete(cacheName);
                }
            }

            alert("Cache cleared. App will now reload to fetch the latest updates.");
            window.location.reload(true);
        } catch (error) {
            console.error("Error clearing cache:", error);
            alert("Errors occurred during cache clear. Reloading...");
            window.location.reload(true);
        }
    };

    // --- 6. RENDER UI ---
    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <PageTransition>
            <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-700 to-slate-200 animate-gradient-xy">
                {/* RICH DYNAMIC BACKGROUND */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-100 animate-gradient-xy"></div>

                {/* DECORATIVE SHAPES */}
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-[100px] animate-blob"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
                <div className="absolute top-[40%] left-[20%] w-[300px] h-[300px] bg-indigo-300/20 rounded-full blur-[80px] animate-blob animation-delay-4000"></div>


                <div className="relative z-10 w-[90%] max-w-md">
                    {/* GLASSMORMISM CARD */}
                    <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl p-8 transform transition-all hover:scale-[1.01] duration-500">

                        {/* HEADER */}
                        <div className="text-center mb-8">
                            <div className="relative w-24 h-24 mx-auto mb-4 bg-white/50 rounded-2xl shadow-inner flex items-center justify-center p-2">
                                <img src={logo} alt="InsightEd Logo" className="w-full h-full object-contain drop-shadow-sm" />
                            </div>
                            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">InsightEd</h1>
                            <p className="text-slate-500 text-sm mt-2 font-medium">Department of Education</p>
                        </div>

                        {/* FORM */}
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="group">
                                <div className={`relative flex items-center transition-all duration-300 rounded-xl border-2 ${focusedInput === 'email' ? 'border-blue-500 bg-white dark:bg-white ring-4 ring-blue-500/10' : 'border-slate-200 bg-white dark:bg-white hover:border-slate-300'}`}>
                                    <span className="pl-4 text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                        </svg>
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Email or School ID"
                                        value={loginId}
                                        onChange={(e) => setLoginId(e.target.value)}
                                        onFocus={() => setFocusedInput('loginId')}
                                        onBlur={() => setFocusedInput(null)}
                                        required
                                        className="w-full bg-transparent border-none px-4 py-3.5 text-slate-700 dark:text-slate-700 placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-0 font-medium"
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <div className={`relative flex items-center transition-all duration-300 rounded-xl border-2 ${focusedInput === 'password' ? 'border-blue-500 bg-white dark:bg-white ring-4 ring-blue-500/10' : 'border-slate-200 bg-white dark:bg-white hover:border-slate-300'}`}>
                                    <span className="pl-4 text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                    </span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => setFocusedInput('password')}
                                        onBlur={() => setFocusedInput(null)}
                                        required
                                        className="w-full bg-transparent border-none px-4 py-3.5 text-slate-700 dark:text-slate-700 placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-0 font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="pr-3 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => { setResetEmail(loginId); setShowForgotModal(true); }}
                                    className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                    Forgot Password?
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 transform transition-all active:scale-[0.98] outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2"
                            >
                                <span>Sign In</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </form>


                        <div className="mt-4">
                            <Link
                                to="/register"
                                className="w-full block text-center py-3.5 border-2 border-blue-100 bg-blue-50/50 rounded-xl text-blue-600 font-bold hover:bg-blue-100 hover:border-blue-200 transition-all active:scale-[0.98]"
                            >
                                Create New Account
                            </Link>
                        </div>

                    </div>

                    {/* INSTALLATION TRIGGER BUTTON */}
                    {!isInstalled && (
                        <div className="mt-4 flex justify-center">
                            <button
                                onClick={() => setShowInstallModal(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-sm font-bold shadow-lg hover:bg-white/20 transition-all active:scale-95"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Install App</span>
                            </button>
                        </div>
                    )}

                    {/* TROUBLESHOOT & UPDATES TRIGGER (OUTSIDE PANEL) */}
                    <div className="mt-4 flex justify-center">
                        <button
                            type="button"
                            onClick={handleTroubleshoot}
                            className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-slate-600 text-sm font-bold shadow-lg hover:bg-white/20 transition-all active:scale-95"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                            </svg>
                            <span>Troubleshoot & Updates</span>
                        </button>
                    </div>

                    {/* FOOTER NOTE */}
                    <div className="text-center mt-6">
                        <p className="text-slate-200/80 text-xs font-medium">© 2026 InsightEd. Secure & Encrypted.</p>
                    </div>
                </div>

                {/* RESTORED WAVES */}
                <div className="waves-container">
                    <svg className="waves" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
                        viewBox="0 24 150 28" preserveAspectRatio="none" shapeRendering="auto">
                        <defs>
                            <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
                        </defs>
                        <g className="parallax">
                            <use xlinkHref="#gentle-wave" x="48" y="0" fill="rgba(255,255,255,0.7)" />
                            <use xlinkHref="#gentle-wave" x="48" y="3" fill="rgba(255,255,255,0.5)" />
                            <use xlinkHref="#gentle-wave" x="48" y="5" fill="rgba(255,255,255,0.3)" />
                            <use xlinkHref="#gentle-wave" x="48" y="7" fill="#fff" />
                        </g>
                    </svg>
                </div>

                {/* FORGOT PASSWORD MODAL */}
                {showForgotModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
                            <h2 className="text-xl font-bold text-slate-800 mb-2">Reset Password</h2>
                            <p className="text-sm text-slate-500 mb-4">Enter your email address and we'll send you a link to reset your password.</p>

                            <form onSubmit={handlePasswordReset}>
                                <div className="mb-4 space-y-3">
                                    {/* INPUT 1: ID or EMAIL */}
                                    <input
                                        type="text"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        placeholder="Enter your email or school ID"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        required
                                    />

                                    {/* INPUT 2: VERIFICATION EMAIL (Only if School ID) */}
                                    {resetEmail.length > 0 && !resetEmail.includes('@') && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <p className="text-xs text-blue-600 font-bold mb-1 ml-1 flex items-center gap-1">
                                                {isSchoolIdFlow ? (
                                                    <>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                        </svg>
                                                        Confirm Registered Email (Masked)
                                                    </>
                                                ) : "Confirm Registered Email"}
                                            </p>
                                            <input
                                                type="text"
                                                value={verificationEmail}
                                                onChange={(e) => !isSchoolIdFlow && setVerificationEmail(e.target.value)}
                                                readOnly={isSchoolIdFlow}
                                                placeholder={isSchoolIdFlow ? "Fetching..." : "Enter your registered email address"}
                                                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all 
                                                    ${isSchoolIdFlow
                                                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                                                        : 'bg-blue-50/30 border-blue-100 text-blue-900 focus:ring-2 focus:ring-blue-500 placeholder:text-blue-300'
                                                    }`}
                                                required
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowForgotModal(false)}
                                        className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={resetLoading}
                                        className="flex-1 py-3 bg-[#004A99] text-white font-bold rounded-xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-70"
                                    >
                                        {resetLoading ? 'Sending...' : 'Send Link'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- INSTALLATION TUTORIAL MODAL (New Approach) --- */}
                {showInstallModal && !isInstalled && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative">

                            {/* Modal Header */}
                            <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-slate-800 text-lg">How to Install</h3>
                                <button
                                    onClick={() => setShowInstallModal(false)}
                                    className="p-2 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>

                            {/* Modal Body: Platform Specific Instructions */}
                            <div className="p-6">
                                {isIOS ? (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4 p-3 bg-blue-50 rounded-xl">
                                            <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600 font-bold shrink-0">1</div>
                                            <p className="text-sm text-slate-600">Tap the <span className="font-bold text-blue-700">Share Icon</span> at the bottom of your screen.</p>
                                        </div>
                                        <div className="flex items-start gap-4 p-3 bg-blue-50 rounded-xl">
                                            <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600 font-bold shrink-0">2</div>
                                            <p className="text-sm text-slate-600">Scroll down and tap <span className="font-bold text-slate-800">"Add to Home Screen"</span>.</p>
                                        </div>
                                        <div className="flex items-start gap-4 p-3 bg-blue-50 rounded-xl">
                                            <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600 font-bold shrink-0">3</div>
                                            <p className="text-sm text-slate-600">Tap <span className="font-bold text-slate-800">Add</span> in the top right corner.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Attempt Auto-Install Button First */}
                                        {deferredPrompt && (
                                            <button
                                                onClick={handleInstallClick}
                                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 mb-4 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                            >
                                                <span>Tap to Install App</span>
                                            </button>
                                        )}

                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center mb-2">Manual Installation</p>

                                        <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="bg-white p-2 rounded-lg shadow-sm text-slate-700 font-bold shrink-0">1</div>
                                            <p className="text-sm text-slate-600">Tap the <span className="font-bold text-slate-900">Three Dots (⋮)</span> icon in the top right browser menu.</p>
                                        </div>
                                        <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="bg-white p-2 rounded-lg shadow-sm text-slate-700 font-bold shrink-0">2</div>
                                            <p className="text-sm text-slate-600">Select <span className="font-bold text-slate-900">"Install App"</span> or <span className="font-bold text-slate-900">"Add to Home Screen"</span>.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="bg-slate-50 p-4 text-center">
                                <p className="text-xs text-slate-400">Installing ensures InsightEd works offline.</p>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </PageTransition>
    );
};

export default Login;