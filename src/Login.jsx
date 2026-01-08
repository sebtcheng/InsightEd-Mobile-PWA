// src/Login.jsx
import React, { useState, useEffect } from 'react';
import logo from './assets/InsightEd1.png';
import { auth, googleProvider, db } from './firebase'; 
import { 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    setPersistence, 
    browserLocalPersistence,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

// Helper function to map roles to dashboard URLs
const getDashboardPath = (role) => {
    const roleMap = {
        'Engineer': '/engineer-dashboard',
        'School Head': '/school-head-dashboard',
        'Human Resource': '/hr-dashboard',
        'Admin': '/admin-dashboard',
    };
    return roleMap[role] || '/';
};

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true); 
    const navigate = useNavigate();

    // --- 1. AUTO-LOGIN LISTENER ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("Found persistent user:", user.uid);
                await checkUserRole(user.uid);
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe(); 
    }, []);

    // --- 2. HANDLE EMAIL LOGIN ---
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
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

    // --- 4. CHECK ROLE & GATEKEEPER LOGIC ---
    const checkUserRole = async (uid) => {
        try {
            // A. Get Role from Firestore
            const docRef = doc(db, "users", uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                const role = userData.role || 'School Head'; // Default to School Head if missing

                // --- KEY FIX: SAVE ROLE TO LOCAL STORAGE ---
                // This allows BottomNav to remember your role on refresh/navigation
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
                        // Check if this user has a School Profile linked
                        // NOTE: Ensure this API endpoint exists or replace with Firestore query if needed
                        const response = await fetch(`/api/school-by-user/${uid}`); 
                        
                        // Handle non-200 responses if using fetch directly on client
                        if (!response.ok) throw new Error("API not reachable");

                        const result = await response.json();

                        if (result.exists) {
                            // ✅ SUCCESS: Profile Exists
                            // Save ID to "Sticky Note" (Local Storage) for offline use
                            localStorage.setItem('schoolId', result.data.school_id);
                            
                            // Let them in
                            navigate('/schoolhead-dashboard');
                        } else {
                            // ⛔ BLOCKED: No Profile Found
                            console.log("No profile found. Redirecting to setup...");
                            navigate('/school-profile', { state: { isFirstTime: true } });
                        }
                    } catch (fetchError) {
                        console.error("Error checking school profile (likely offline/no-api):", fetchError);
                        // Fallback: If we can't check (offline), let them in 
                        navigate('/schoolhead-dashboard');
                    }
                } else {
                    // C. Other Roles (Engineer, Admin, etc.) - Just go to dashboard
                    const path = getDashboardPath(role);
                    navigate(path);
                }

            } else {
                alert("Account not found. Redirecting to registration...");
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
        return (
            <div className="login-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ color: 'white', fontWeight: 'bold' }}>Restoring Session...</div>
            </div>
        );
    }

    return (
        <div className="login-container" style={{ color: '#1a202c' }}>
            <div className="login-card" style={{ zIndex: 10 }}>
                <div className="login-header">
                    <img src={logo} alt="InsightEd Logo" className="app-logo" />
                    <p>Log in to access your dashboard</p>
                </div>

                <form onSubmit={handleLogin} className="form-group">
                    <div className="input-wrapper">
                        <input 
                            type="email" 
                            className="custom-input"
                            placeholder="Email Address" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-wrapper">
                        <input 
                            type="password" 
                            className="custom-input"
                            placeholder="Password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)} 
                            required
                        />
                    </div>
                    
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        Sign In
                    </button>
                </form>
                
                <div className="divider">
                    <span>OR</span>
                </div>
                
                <button onClick={handleGoogleLogin} className="btn btn-google" disabled={loading}>
                    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.032-3.716H.96v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                        <path d="M3.968 10.705A5.366 5.366 0 0 1 3.682 9c0-.593.102-1.17.286-1.705V4.962H.96A9.006 9.006 0 0 0 0 9c0 1.452.348 2.827.96 4.095l3.008-2.39z" fill="#FBBC05"/>
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .96 4.962l3.008 2.392C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                </button>
                
                <div className="login-footer">
                    Don't have an account? <Link to="/register" className="link-text">Register here</Link>
                </div>
            </div>

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
        </div>
    );
};

export default Login;