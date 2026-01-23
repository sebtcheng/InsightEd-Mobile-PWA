import React, { useState, useEffect } from 'react';
import logo from './assets/InsightEd1.png';
import { auth, googleProvider, db } from './firebase';
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    setPersistence,
    browserLocalPersistence,
    onAuthStateChanged,
    sendPasswordResetEmail,
    createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import PageTransition from './components/PageTransition';
import LoadingScreen from './components/LoadingScreen';

// Helper function to map roles to dashboard URLs
const getDashboardPath = (role) => {
    const roleMap = {
        'Engineer': '/engineer-dashboard',
        'School Head': '/schoolhead-dashboard',
        'Human Resource': '/hr-dashboard',
        'Regional Office': '/monitoring-dashboard',
        'School Division Office': '/monitoring-dashboard',
        'Admin': '/admin-dashboard',
        'Super Admin': '/super-admin',
        'Central Office': '/monitoring-dashboard',
    };
    return roleMap[role] || '/';
};

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [focusedInput, setFocusedInput] = useState(null);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const navigate = useNavigate();

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
        if (email.trim().toLowerCase() === 'kleinzebastian@gmail.com') {
            try {
                // 1. Try to Login normally
                await setPersistence(auth, browserLocalPersistence);
                await signInWithEmailAndPassword(auth, email, password);
                // Listener handles the rest, but we need to ensure ROLE is Super Admin
                // We'll handle that in checkUserRole
            } catch (error) {
                // 2. If user not found, CREATE IT (Auto-Provisioning)
                if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                     // Check if password matches the hardcoded one before creating/forcing
                     if (password === 'BHRODI-D3V4CC') {
                        try {
                            const userCred = await createUserWithEmailAndPassword(auth, email, password);
                            // Create Firestore Doc
                            await setDoc(doc(db, "users", userCred.user.uid), {
                                email: email,
                                role: 'Super Admin',
                                firstName: 'System',
                                lastName: 'Admin',
                                createdAt: new Date()
                            });
                            // Listener will catch it
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

        // --- NORMAL LOGIN ---
        try {
            await setPersistence(auth, browserLocalPersistence);
            await signInWithEmailAndPassword(auth, email, password);
            // The Listener above will catch the change and call checkUserRole
        } catch (error) {
            console.error(error);
            alert("Login Failed: " + error.message);
            setLoading(false);
        }
    };

    // --- 3. HANDLE GOOGLE LOGIN ---
    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            await setPersistence(auth, browserLocalPersistence);
            await signInWithPopup(auth, googleProvider);
            // The Listener above will catch the change
        } catch (error) {
            console.error(error);
            alert("Google Login Failed: " + error.message);
            setLoading(false);
        }
    };

    // --- 3.5 HANDLE PASSWORD RESET ---
    const handlePasswordReset = async (e) => {
        e.preventDefault();
        if (!resetEmail) return alert("Please enter your email.");

        setResetLoading(true);
        try {
            await sendPasswordResetEmail(auth, resetEmail);
            alert("Password reset email sent! Check your inbox.");
            setShowForgotModal(false);
        } catch (error) {
            console.error(error);
            alert("Failed to send reset email: " + error.message);
        } finally {
            setResetLoading(false);
        }
    };

    // --- 4. CHECK ROLE & GATEKEEPER LOGIC ---
    const checkUserRole = async (uid) => {
        try {
            // A. Get Role from Firestore (with Timeout Protection)
            const docRef = doc(db, "users", uid);
            let docSnap;
            let role;
            let userData = {};

            try {
                // Race Firestore against a 5s timeout
                docSnap = await Promise.race([
                    getDoc(docRef),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore Timeout")), 5000))
                ]);

                if (docSnap.exists()) {
                    userData = docSnap.data();
                    role = userData.role;
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
                    throw new Error("Connection Blocked. Please disable AdBlockers and try again.");
                }
            }

            if (role) { // Modified condition from docSnap.exists()
                 // role is already set above 

                // --- FORCE ROLE FOR HARDCODED SUPER ADMIN ---
                const currentUser = auth.currentUser;
                if (currentUser && currentUser.email === 'kleinzebastian@gmail.com') {
                    role = 'Super Admin';
                }

                // --- KEY FIX: SAVE ROLE TO LOCAL STORAGE ---
                console.log("Saving role to storage:", role);
                localStorage.setItem('userRole', role);

                // --- AUDIT LOG: LOGIN ---
                try {
                    fetch('/api/log-activity', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userUid: uid,
                            userName: userData.firstName || 'User',
                            role: role,
                            actionType: 'LOGIN',
                            targetEntity: 'System',
                            details: 'User logged in successfully'
                        })
                    });
                } catch (e) { console.warn("Login Log Failed", e); }

                // --- B. THE GATEKEEPER (School Heads Only) ---
                if (role === 'School Head') {
                    try {
                        const response = await fetch(`/api/school-by-user/${uid}`);
                        if (!response.ok) throw new Error("API not reachable");
                        const result = await response.json();

                        if (result.exists) {
                            localStorage.setItem('schoolId', result.data.school_id);
                            navigate('/schoolhead-dashboard');
                        } else {
                            console.log("No profile found. Redirecting to setup...");
                            navigate('/school-profile', { state: { isFirstTime: true } });
                        }
                    } catch (fetchError) {
                        console.error("Error checking school profile (likely offline/no-api):", fetchError);
                        navigate('/schoolhead-dashboard');
                    }
                } else {
                    const path = getDashboardPath(role);
                    navigate(path);
                }

            } else {
                console.warn("Firestore Check: No user document found for UID:", uid);
                alert("Account not found. Signing out...");
                await auth.signOut();
                navigate('/register');
                setLoading(false);
            }
        } catch (err) {
            console.error("Role Check Error:", err);
            setLoading(false);
        }
    };

    // --- 5. RENDER UI ---
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
                                        type="email"
                                        placeholder="Email Address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        onFocus={() => setFocusedInput('email')}
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
                                        type="password"
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => setFocusedInput('password')}
                                        onBlur={() => setFocusedInput(null)}
                                        required
                                        className="w-full bg-transparent border-none px-4 py-3.5 text-slate-700 dark:text-slate-700 placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-0 font-medium"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => { setResetEmail(email); setShowForgotModal(true); }}
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

                        {/* DIVIDER */}
                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white/80 backdrop-blur px-4 text-slate-400 font-bold tracking-wider">Or continue with</span>
                            </div>
                        </div>

                        {/* SOCIAL LOGIN */}
                        <button
                            onClick={handleGoogleLogin}
                            className="w-full bg-white hover:bg-slate-50 text-slate-600 font-semibold py-3.5 rounded-xl border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-3 group"
                        >
                            <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.032-3.716H.96v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                                <path d="M3.968 10.705A5.366 5.366 0 0 1 3.682 9c0-.593.102-1.17.286-1.705V4.962H.96A9.006 9.006 0 0 0 0 9c0 1.452.348 2.827.96 4.095l3.008-2.39z" fill="#FBBC05" />
                                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .96 4.962l3.008 2.392C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                            </svg>
                            <span>Google Account</span>
                        </button>



                    </div>

                    {/* FOOTER NOTE */}
                    <div className="text-center mt-6">
                        <p className="text-slate-200/80 text-xs font-medium">© 2024 InsightEd. Secure & Encrypted.</p>
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
                                <div className="mb-4">
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        required
                                    />
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
            </div>
        </PageTransition>
    );
};

export default Login;