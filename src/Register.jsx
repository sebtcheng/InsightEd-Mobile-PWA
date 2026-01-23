// src/Register.jsx

import React, { useState, useEffect } from 'react';
import logo from './assets/InsightEd1.png';
import { auth, db, googleProvider } from './firebase'; // kept googleProvider just in case they sign in later, but unused for register now
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import PageTransition from './components/PageTransition';
// Removed: import './Register.css'; // Using Tailwind CSS now

// 1. IMPORT YOUR OPTIMIZED JSON FILE
import locationData from './locations.json';
import Papa from 'papaparse';

const getDashboardPath = (role) => {
    const roleMap = {
        'Engineer': '/engineer-dashboard',
        'School Head': '/schoolhead-dashboard',
        'Human Resource': '/hr-dashboard',
        'Admin': '/admin-dashboard',
        'Central Office': '/monitoring-dashboard',
        'Regional Office': '/monitoring-dashboard',
        'School Division Office': '/monitoring-dashboard',
        'Super User': '/super-admin', // Super User
    };
    return roleMap[role] || '/';
};

const Register = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [focusedInput, setFocusedInput] = useState(null);

    // Form Data State
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        schoolId: '', // New Field
        email: '',
        password: '',
        confirmPassword: '', // Added missing field
        role: 'Engineer', // Default
        bureau: '', // Central Office Only
        region: '',
        province: '',
        city: '',
        province: '',
        city: '',
        barangay: '',
        office: '', // Regional Office Only
        position: '', // Regional Office Only
    });

    const [showDuplicateModal, setShowDuplicateModal] = useState(false);

    // --- OTP STATE ---
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [isOtpVerified, setIsOtpVerified] = useState(false);

    const [otpLoading, setOtpLoading] = useState(false);

    // --- TIMER STATE ---
    const [timer, setTimer] = useState(0);
    const [canResend, setCanResend] = useState(true);

    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else {
            setCanResend(true);
        }
        return () => clearInterval(interval);
    }, [timer]);

    // --- LOAD SCHOOL DATA FOR SDO ---
    const [schoolData, setSchoolData] = useState([]);
    useEffect(() => {
        Papa.parse('/schools.csv', {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if(results.data && results.data.length > 0) {
                     setSchoolData(results.data);
                }
            }
        });
    }, []);

    // --- OTP HANDLERS ---
    const handleSendOtp = async () => {
        setIsSubmitting(true); // Set submitting state
        if (!formData.email) {
            alert("Please enter your email first.");
            setIsSubmitting(false);
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            alert("Passwords do not match!");
            setIsSubmitting(false);
            return;
        }



        setOtpLoading(true);
        try {
            const res = await fetch('/api/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email })
            });
            const data = await res.json();
            if (data.success) {
                setIsOtpSent(true);
                // Start Timer
                setCanResend(false);
                setTimer(30);
                alert("Verification code sent to your email!");
            } else {
                alert(data.message || "Failed to send OTP");
            }
        } catch (error) {
            console.error(error);
            alert("Network error sending OTP");
        } finally {
            setOtpLoading(false);
            setIsSubmitting(false); // Reset submitting state
        }
    };

    const handleVerifyOtp = async () => {
        const code = otp.join("");
        if (code.length < 6) return;

        setOtpLoading(true);
        try {
            const res = await fetch('/api/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, code })
            });
            const data = await res.json();
            if (data.success) {
                setIsOtpVerified(true);
                alert("Verified successfully!");
            } else {
                alert(data.message || "Invalid Code");
                setIsOtpVerified(false);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setOtpLoading(false);
        }
    };

    const handleOtpChange = (element, index) => {
        if (isNaN(element.value)) return;
        const newOtp = [...otp];
        newOtp[index] = element.value;
        setOtp(newOtp);

        // Auto-focus next input
        if (element.nextSibling && element.value) {
            element.nextSibling.focus();
        }
    };

    // --- DUPLICATE CHECK ---
    const checkSchoolId = async () => {
        if (formData.role !== 'School Head' || !formData.schoolId) return;

        // Basic Length Check
        if (formData.schoolId.length !== 6) return;

        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("schoolId", "==", formData.schoolId));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                setShowDuplicateModal(true);
                setFormData(prev => ({ ...prev, schoolId: '' }));
            }
        } catch (error) {
            console.error("Error checking ID:", error);
        }
    };

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
        const { name, value } = e.target;

        // SPECIAL LOGIC FOR SCHOOL HEAD
        if (formData.role === 'School Head') {
            if (name === 'schoolId') {
                // RESTRICT: Numbers only, Max 6 chars
                const numericValue = value.replace(/\D/g, '').slice(0, 6);

                // Auto-generate email based on School ID
                setFormData({
                    ...formData,
                    schoolId: numericValue,
                    email: numericValue ? `${numericValue}@deped.gov.ph` : ''
                });
                return;
            }
            // Prevent manual email editing for School Head
            if (name === 'email') return;
        }

        if (name === 'role') {
            // Reset fields when switching roles
            setFormData({
                ...formData,
                role: value,
                schoolId: '',
                email: '',
                firstName: '',
                lastName: '',
                secretKey: '', // Reset secret key when role changes
            });
            return;
        }

        setFormData({ ...formData, [name]: value });
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

    const saveUserToDB = async (user, isGoogle = false) => {
        let firstName = "User";
        let lastName = "";

        // 1. Determine Name
        if (formData.role === 'School Head') {
            // For School Head, use ID as name or generic
            firstName = "School Head";
            lastName = formData.schoolId || "Unknown ID";
        } else {
            firstName = formData.firstName || "User";
            lastName = formData.lastName || "";
        }

        // 2. Determine School ID
        const schoolIdToSave = (formData.role === 'School Head' && formData.schoolId) ? String(formData.schoolId) : null;

        await setDoc(doc(db, "users", user.uid), {
            email: user.email || "",
            role: formData.role || "User",
            firstName: firstName,
            lastName: lastName,
            schoolId: schoolIdToSave,
            region: formData.region || "",
            division: formData.division || "",
            province: formData.province || "",
            city: formData.city || "",
            barangay: formData.barangay || "",
            barangay: formData.barangay || "",
            bureau: formData.bureau || "",
            office: formData.office || "",
            position: formData.position || "",
            authProvider: isGoogle ? "google" : "email",
            createdAt: new Date()
        }, { merge: true });


        // Auto-redirect to dashboard
        navigate(getDashboardPath(formData.role));
    };

    return (
        <PageTransition>
            <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-700 to-slate-200 animate-gradient-xy py-10">
                {/* RICH DYNAMIC BACKGROUND */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-100 animate-gradient-xy"></div>


                {/* DECORATIVE SHAPES */}
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-[100px] animate-blob"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>


                <div className="relative z-10 w-[90%] max-w-md">
                    {/* GLASSMORMISM CARD */}
                    <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl p-6 transform transition-all duration-500 max-h-[80vh] overflow-y-auto overflow-x-hidden custom-scrollbar">

                        <div className="text-center mb-6">
                            <img src={logo} alt="InsightEd Logo" className="h-16 mx-auto mb-4 object-contain drop-shadow-sm" />
                            <h2 className="text-2xl font-bold text-slate-800">Create Account</h2>
                            <p className="text-slate-500 text-sm">Join the InsightEd network</p>
                        </div>

                        <form onSubmit={handleRegister} className="space-y-6">

                            {/* ROLE SELECTION */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">I am registering as a:</label>
                                <div className="relative">
                                    <select
                                        name="role"
                                        onChange={handleChange}
                                        value={formData.role}
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer hover:bg-white"
                                    >
                                        <option value="Engineer">Engineer</option>
                                        <option value="School Head">School Head</option>
                                        <option value="Admin">Admin</option>
                                        {/* <option value="Central Office">Central Office</option> */}
                                        {/* <option value="Super User">Super User</option> */}
                                        <option value="Regional Office">Regional Office</option>
                                        <option value="School Division Office">School Division Office</option>
                                        {/* <option value="Admin">Admin</option> */}

                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                    </div>
                                </div>
                            </div>



                            {/* CONDITIONAL: DIVISION NAME (REMOVED - NOW CASCADING) */}

                            {/* SECTION 1: PERSONAL / DETAILS */}
                            <div className="bg-white/50 rounded-2xl p-4 border border-slate-100">
                                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">1. Personal Details</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {formData.role === 'School Head' ? (
                                        <div className="md:col-span-2">
                                            <input
                                                name="schoolId"
                                                type="text"
                                                placeholder="School ID (e.g. 100001)"
                                                value={formData.schoolId}
                                                onChange={handleChange}
                                                onBlur={checkSchoolId}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                                required
                                                inputMode="numeric"
                                            />
                                            <p className="text-xs text-slate-400 mt-1 ml-1">Your email will be auto-generated.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <input name="firstName" value={formData.firstName} placeholder="First Name" onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" required />
                                            <input name="lastName" value={formData.lastName} placeholder="Last Name" onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" required />
                                        </>
                                    )}
                                    
                                    {/* CENTRAL OFFICE SPECIFIC FIELDS */}
                                    {formData.role === 'Central Office' && (
                                        <>
                                            <input 
                                                name="bureau" 
                                                value={formData.bureau} 
                                                placeholder="Bureau (e.g. BLD, BCD)" 
                                                onChange={handleChange} 
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                                                required 
                                            />
                                            <input 
                                                name="division" 
                                                value={formData.division} 
                                                placeholder="Division / Unit" 
                                                onChange={handleChange} 
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                                                required 
                                            />
                                        </>
                                    )}

                                    {/* REGIONAL OFFICE & SDO SPECIFIC FIELDS */}
                                    {['Regional Office', 'School Division Office'].includes(formData.role) && (
                                        <>
                                            <input 
                                                name="office" 
                                                value={formData.office} 
                                                placeholder="Office (Do not abbreviate)" 
                                                onChange={handleChange} 
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                                                required 
                                            />
                                            <input 
                                                name="position" 
                                                value={formData.position} 
                                                placeholder="Position (Do not abbreviate)" 
                                                onChange={handleChange} 
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                                                required 
                                            />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* SECTION 2: LOCATION - HIDDEN FOR CENTRAL OFFICE */}
                            {formData.role !== 'Central Office' && (
                                <div className="bg-white/50 rounded-2xl p-4 border border-slate-100">
                                    <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">2. Location Assignment</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <select name="region" onChange={handleRegionChange} value={formData.region} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" required>
                                            <option value="">Select Region</option>
                                            {Object.keys(locationData).sort().map((reg) => (
                                                <option key={reg} value={reg}>{reg}</option>
                                            ))}
                                        </select>

                                        {/* SDO DIVISION DROPDOWN */}
                                        {formData.role === 'School Division Office' && (
                                            <select 
                                                name="division" 
                                                onChange={handleChange} 
                                                value={formData.division} 
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50" 
                                                disabled={!formData.region} 
                                                required
                                            >
                                                <option value="">Select Division</option>
                                                {[...new Set(schoolData
                                                    .filter(s => s.region === formData.region)
                                                    .map(s => s.division))]
                                                    .sort()
                                                    .map(div => (
                                                        <option key={div} value={div}>{div}</option>
                                                    ))
                                                }
                                            </select>
                                        )}

                                        {/* HIDE FOR REGIONAL OFFICE AND SDO */}
                                        {!['Regional Office', 'School Division Office'].includes(formData.role) && (
                                            <>
                                                <select name="province" onChange={handleProvinceChange} value={formData.province} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50" disabled={!formData.region} required>
                                                    <option value="">Select Province</option>
                                                    {provinceOptions.map((prov) => (
                                                        <option key={prov} value={prov}>{prov}</option>
                                                    ))}
                                                </select>

                                                <select name="city" onChange={handleCityChange} value={formData.city} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50" disabled={!formData.province} required>
                                                    <option value="">Select City/Mun</option>
                                                    {cityOptions.map((city) => (
                                                        <option key={city} value={city}>{city}</option>
                                                    ))}
                                                </select>

                                                <select name="barangay" onChange={handleChange} value={formData.barangay} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50" disabled={!formData.city} required>
                                                    <option value="">Select Barangay</option>
                                                    {barangayOptions.map((brgy) => (
                                                        <option key={brgy} value={brgy}>{brgy}</option>
                                                    ))}
                                                </select>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* SECTION 3: CREDENTIALS */}
                            <div className="bg-white/50 rounded-2xl p-4 border border-slate-100">
                                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">3. Account Security</label>

                                {/* EMAIL & OTP */}
                                <div className="mb-4 space-y-3">
                                    <div className="flex flex-col gap-3">
                                        <input
                                            name="email"
                                            type="email"
                                            placeholder="Email Address"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className={`w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${formData.role === 'School Head' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                            required
                                            readOnly={formData.role === 'School Head' || isOtpVerified}
                                        />
                                        {!isOtpVerified && (
                                            <button
                                                type="button"
                                                onClick={handleSendOtp}
                                                disabled={otpLoading || !canResend || !formData.email}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/30"
                                            >
                                                {otpLoading ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Sending
                                                    </span>
                                                ) : !canResend ? `Resend Code in ${timer}s` : isOtpSent ? 'Resend Code' : 'Get Verification Code'}
                                            </button>
                                        )}
                                    </div>

                                    {/* OTP INPUTS */}
                                    {isOtpSent && !isOtpVerified && (
                                        <div className="mt-3 bg-blue-50 p-4 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex justify-between items-center mb-3">
                                                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Verification Code</p>
                                                <span className="text-xs text-blue-400">Check your email</span>
                                            </div>
                                            <div className="flex justify-between gap-2 mb-4">
                                                {otp.map((digit, index) => (
                                                    <input
                                                        key={index}
                                                        type="text"
                                                        maxLength="1"
                                                        value={digit}
                                                        onChange={e => handleOtpChange(e.target, index)}
                                                        onFocus={e => e.target.select()}
                                                        className="w-10 h-12 md:w-12 md:h-14 text-center border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-xl font-bold text-blue-800 bg-white"
                                                    />
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleVerifyOtp}
                                                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition"
                                            >
                                                Verify Code
                                            </button>
                                        </div>
                                    )}

                                    {isOtpVerified && (
                                        <div className="mt-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-green-200">
                                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                            Email Verified Successfully
                                        </div>
                                    )}
                                </div>

                                <input name="password" type="password" placeholder="Create Password" onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" required />
                                <input name="confirmPassword" type="password" placeholder="Confirm Password" onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all mt-3" required />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-500/30 transform transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                disabled={loading || !isOtpVerified}
                            >
                                {loading ? 'Creating Account...' : 'Create Account'}
                                {!loading && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>}
                            </button>
                        </form>

                        <div className="mt-8 text-center border-t border-slate-100 pt-6">
                            <p className="text-slate-500 text-sm">
                                Already have an account? <Link to="/" className="text-blue-600 font-bold hover:text-blue-700 transition-colors">Login here</Link>
                            </p>
                        </div>
                    </div>
                </div>

                {/* DUPLICATE MODAL */}
                {showDuplicateModal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center transform scale-100 transition-all border border-red-100">
                            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner">
                                ⚠️
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">School ID Exists</h3>
                            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                                The School ID <b>{formData.schoolId}</b> is already registered. Please check the ID or contact support if you believe this is an error.
                            </p>
                            <button
                                onClick={() => setShowDuplicateModal(false)}
                                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-500/30 transition-all"
                            >
                                Okay, I'll check again
                            </button>
                        </div>
                    </div>
                )}

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
            </div>
        </PageTransition>
    );
};

export default Register;