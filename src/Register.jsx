// src/Register.jsx

import React, { useState } from 'react';
import logo from './assets/InsightEd1.png'; 
import { auth, db, googleProvider } from './firebase';
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore'; 
import { useNavigate, Link } from 'react-router-dom';
import './Register.css';

// 1. IMPORT YOUR OPTIMIZED JSON FILE
import locationData from './locations.json'; 

const getDashboardPath = (role) => {
    const roleMap = {
        'Engineer': '/engineer-dashboard',
        'School Head': '/schoolhead-dashboard',
        'Human Resource': '/hr-dashboard',
        'Admin': '/admin-dashboard',
    };
    return roleMap[role] || '/'; 
};

const Register = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    
    // Form Data State
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'Engineer', // Default
        region: '',
        province: '',
        city: '',
        barangay: '',
    });

    // 2. DROPDOWN OPTIONS STATE
    const [provinceOptions, setProvinceOptions] = useState([]);
    const [cityOptions, setCityOptions] = useState([]);
    const [barangayOptions, setBarangayOptions] = useState([]);

    // --- HANDLERS FOR CASCADING DROPDOWNS ---

    const handleRegionChange = (e) => {
        const region = e.target.value;
        setFormData({ 
            ...formData, 
            region, 
            province: '', city: '', barangay: '' 
        });

        if (region && locationData[region]) {
            setProvinceOptions(Object.keys(locationData[region]).sort());
        } else {
            setProvinceOptions([]);
        }
        setCityOptions([]);
        setBarangayOptions([]);
    };

    const handleProvinceChange = (e) => {
        const province = e.target.value;
        setFormData({ 
            ...formData, 
            province, 
            city: '', barangay: '' 
        });

        if (province && formData.region) {
            setCityOptions(Object.keys(locationData[formData.region][province]).sort());
        } else {
            setCityOptions([]);
        }
        setBarangayOptions([]);
    };

    const handleCityChange = (e) => {
        const city = e.target.value;
        setFormData({ 
            ...formData, 
            city, 
            barangay: '' 
        });

        if (city && formData.province && formData.region) {
            const brgys = locationData[formData.region][formData.province][city];
            setBarangayOptions(brgys.sort());
        } else {
            setBarangayOptions([]);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // --- REGISTRATION LOGIC ---

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            await saveUserToDB(userCredential.user);
        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleRegister = async () => {
        if (!formData.region || !formData.province || !formData.city) {
            alert("Please complete your Address details (Region to City) before continuing.");
            return;
        }
        try {
            const result = await signInWithPopup(auth, googleProvider);
            await saveUserToDB(result.user, true);
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    };

    const saveUserToDB = async (user, isGoogle = false) => {
        const [firstName, ...lastNameParts] = user.displayName ? user.displayName.split(" ") : [formData.firstName, formData.lastName];
        
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            role: formData.role,
            firstName: isGoogle ? firstName : formData.firstName,
            lastName: isGoogle ? lastNameParts.join(" ") : formData.lastName,
            region: formData.region,
            province: formData.province,
            city: formData.city,
            barangay: formData.barangay,
            authProvider: isGoogle ? "google" : "email",
            createdAt: new Date()
        }, { merge: true });
        
        // --- AUDIT LOG: REGISTER ---
        try {
            fetch('/api/log-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userUid: user.uid,
                    userName: isGoogle ? firstName : formData.firstName,
                    role: formData.role,
                    actionType: 'REGISTER',
                    targetEntity: 'System',
                    details: 'New user registered via ' + (isGoogle ? 'Google' : 'Email')
                })
            });
        } catch (e) { console.warn("Register Log Failed", e); }

        // --- 🚀 NEW REDIRECT LOGIC ---
        if (formData.role === 'School Head') {
            // Force School Heads to create a School Profile immediately
            console.log("New School Head Registered. Redirecting to Profile Setup...");
            navigate('/school-profile', { state: { isFirstTime: true } });
        } else {
            // Other roles go to their dashboards normally
            const path = getDashboardPath(formData.role);
            navigate(path);
        }
    };

    return (
        <div className="register-container" style={{ color: '#1a202c' }}>
            <div className="register-card">
                <div className="register-header">
                    <img src={logo} alt="InsightEd Logo" className="app-logo" />
                    <h2>Create Account</h2>
                    <p>Join the InsightEd network</p>
                </div>

                <div className="input-group">
                    <label className="section-label">1. Profile & Location</label>
                    
                    <select name="role" onChange={handleChange} value={formData.role} className="custom-select">
                        <option value="Engineer">Engineer</option>
                        <option value="School Head">School Head</option>
                        <option value="Human Resource">Human Resource</option>
                        <option value="Admin">Admin</option>
                    </select>

                    <div className="form-grid">
                        {/* REGION */}
                        <select name="region" onChange={handleRegionChange} value={formData.region} className="custom-select" required>
                            <option value="">Select Region</option>
                            {Object.keys(locationData).sort().map((reg) => (
                                <option key={reg} value={reg}>{reg}</option>
                            ))}
                        </select>

                        {/* PROVINCE */}
                        <select name="province" onChange={handleProvinceChange} value={formData.province} className="custom-select" disabled={!formData.region} required>
                            <option value="">Select Province</option>
                            {provinceOptions.map((prov) => (
                                <option key={prov} value={prov}>{prov}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-grid">
                        {/* CITY / MUNICIPALITY */}
                        <select name="city" onChange={handleCityChange} value={formData.city} className="custom-select" disabled={!formData.province} required>
                            <option value="">Select City/Mun</option>
                            {cityOptions.map((city) => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>

                        {/* BARANGAY */}
                        <select name="barangay" onChange={handleChange} value={formData.barangay} className="custom-select" disabled={!formData.city} required>
                            <option value="">Select Barangay</option>
                            {barangayOptions.map((brgy) => (
                                <option key={brgy} value={brgy}>{brgy}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="divider"><span>QUICK REGISTER</span></div>
                
                <button onClick={handleGoogleRegister} className="btn btn-google">
                    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.032-3.716H.96v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                        <path d="M3.968 10.705A5.366 5.366 0 0 1 3.682 9c0-.593.102-1.17.286-1.705V4.962H.96A9.006 9.006 0 0 0 0 9c0 1.452.348 2.827.96 4.095l3.008-2.39z" fill="#FBBC05"/>
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .96 4.962l3.008 2.392C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                </button>

                <div className="divider"><span>OR WITH EMAIL</span></div>

                <form onSubmit={handleRegister} className="input-group">
                    <div className="form-grid">
                        <input name="firstName" placeholder="First Name" onChange={handleChange} className="custom-input" required />
                        <input name="lastName" placeholder="Last Name" onChange={handleChange} className="custom-input" required />
                    </div>
                    <input name="email" type="email" placeholder="Email Address" onChange={handleChange} className="custom-input" required />
                    <input name="password" type="password" placeholder="Password" onChange={handleChange} className="custom-input" required />

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div className="login-link">
                    Already have an account? <Link to="/" className="link-text">Login here</Link>
                </div>
            </div>

             <div className="waves-container">
                 <svg className="waves" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
                viewBox="0 24 150 28" preserveAspectRatio="none" shapeRendering="auto">
                    <defs>
                        <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
                    </defs>
                    <g className="parallax">
                        <use xlinkHref="#gentle-wave" x="48" y="0" fill="rgba(255,255,255,0.9)" />
                        <use xlinkHref="#gentle-wave" x="48" y="3" fill="rgba(255,255,255,0.7)" />
                        <use xlinkHref="#gentle-wave" x="48" y="5" fill="rgba(255,255,255,0.5)" />
                        <use xlinkHref="#gentle-wave" x="48" y="7" fill="#fff" />
                    </g>
                </svg>
            </div>
        </div>
    );
};

export default Register;