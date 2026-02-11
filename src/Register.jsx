// src/Register.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import logo from './assets/InsightEd1.png';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'; // Added signIn for recovery
import { doc, setDoc, getDoc } from 'firebase/firestore'; // Added getDoc for recovery
import { useNavigate, Link } from 'react-router-dom';
import PageTransition from './components/PageTransition';
import Papa from 'papaparse';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- CONSTANTS ---111111
const CSV_PATH = `${import.meta.env.BASE_URL}schools.csv`;
const OFFICES_CSV_PATH = `${import.meta.env.BASE_URL}Personnel Positions by Functional Division at RO and SDO Levels - Sheet1.csv`;

// --- AUTHORIZATION CODES (Secure & Alphanumeric) ---
const AUTHORIZATION_CODES = {
    'Central Office': '8XK2-M9P4',
    'Regional Office': 'H7V3-L5N1',
    'School Division Office': 'Q9D2-R4J6',
    'Division Engineer': 'E5T8-B2W3',
    'Local Government Unit': 'L2G7-X4Z9',
    'Super User': 'SUP3R-US3R', // Added for testing
    // 'Admin' is usually hidden or database-only, but adding for completeness if enabled in dropdown
    'Admin': 'A3M6-Y1K8'
};

import locationData from './locations.json';

const getDashboardPath = (role) => {
    const roleMap = {
        'Division Engineer': '/engineer-dashboard',
        'Local Government Unit': '/lgu-form',
        'School Head': '/schoolhead-dashboard',
        'Human Resource': '/hr-dashboard',
        'Admin': '/admin-dashboard',
        'Central Office': '/monitoring-dashboard',
        'Regional Office': '/monitoring-dashboard',
        'School Division Office': '/monitoring-dashboard',
        'Super User': '/super-admin',
    };
    return roleMap[role] || '/';
};

const Register = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // --- BASIC FORM STATE ---
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '', // Generic roles auth email
        schoolEmail: '', // School Head: actual school email (used as Firebase auth email)
        contactNumber: '', // School Head: 11-digit contact number
        password: '',
        confirmPassword: '',
        role: 'Regional Office', // Default
        // Legacy/Other Role Fields
        bureau: '',
        office: '',
        position: '',
        region: '',
        division: '',
        province: '',
        city: '',
        barangay: '',
        authCode: '',
        // New Fields for Division Engineer
        altEmail: ''
    });

    // --- OTP STATE --- (REMOVED)




    // --- LOCATION DROPDOWN STATE (Generic Roles) ---
    const [provinceOptions, setProvinceOptions] = useState([]);
    const [cityOptions, setCityOptions] = useState([]);
    const [barangayOptions, setBarangayOptions] = useState([]);

    // --- SCHOOL HEAD CASCADING OPTIONS STATE ---
    const [regions, setRegions] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [municipalities, setMunicipalities] = useState([]);
    const [availableSchools, setAvailableSchools] = useState([]);

    // --- OFFICE DATA STATE ---
    const [officeData, setOfficeData] = useState([]);
    const [isOfficeCsvLoaded, setIsOfficeCsvLoaded] = useState(false);

    // Cascading Selections (5-Step Hierarchy)
    const [selectedRegion, setSelectedRegion] = useState('');
    const [selectedDivision, setSelectedDivision] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedMunicipality, setSelectedMunicipality] = useState('');
    const [selectedSchool, setSelectedSchool] = useState(null);

    // Map Marker Ref
    const markerRef = useRef(null);

    // --- REGISTRATION SUCCESS STATE ---
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [registeredIern, setRegisteredIern] = useState('');


    // --- 1. LOAD INITIAL DATA (Regions + Office CSV) ---
    useEffect(() => {
        // Load Regions from API
        fetch('/api/locations/regions')
            .then(res => res.json())
            .then(data => setRegions(data || []))
            .catch(err => console.error("Failed to load regions:", err));

        // Load Offices CSV
        Papa.parse(OFFICES_CSV_PATH, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.data && results.data.length > 0) {
                    setOfficeData(results.data);
                    setIsOfficeCsvLoaded(true);
                }
            },
            error: (err) => {
                console.error("Office CSV Load Error:", err);
            }
        });
    }, []);

    // --- 2. CASCADING EFFECTS ---

    // Load Divisions when Region changes
    useEffect(() => {
        setDivisions([]);
        // Note: Downstream selections (division, district...) should be cleared by the change handler
        if (selectedRegion) {
            fetch(`/api/locations/divisions?region=${encodeURIComponent(selectedRegion)}`)
                .then(res => res.json())
                .then(data => setDivisions(data || []))
                .catch(console.error);
        }
    }, [selectedRegion]);

    // Load Districts when Division changes
    useEffect(() => {
        setDistricts([]);
        if (selectedRegion && selectedDivision) {
            fetch(`/api/locations/districts?region=${encodeURIComponent(selectedRegion)}&division=${encodeURIComponent(selectedDivision)}`)
                .then(res => res.json())
                .then(data => setDistricts(data || []))
                .catch(console.error);
        }
    }, [selectedRegion, selectedDivision]);

    // Load Municipalities when District changes
    useEffect(() => {
        setMunicipalities([]);
        if (selectedRegion && selectedDivision && selectedDistrict) {
            fetch(`/api/locations/municipalities?region=${encodeURIComponent(selectedRegion)}&division=${encodeURIComponent(selectedDivision)}&district=${encodeURIComponent(selectedDistrict)}`)
                .then(res => res.json())
                .then(data => setMunicipalities(data || []))
                .catch(console.error);
        }
    }, [selectedRegion, selectedDivision, selectedDistrict]);

    // Load Schools when Municipality changes
    useEffect(() => {
        setAvailableSchools([]);
        if (selectedRegion && selectedDivision && selectedDistrict && selectedMunicipality) {
            fetch(`/api/locations/schools?region=${encodeURIComponent(selectedRegion)}&division=${encodeURIComponent(selectedDivision)}&district=${encodeURIComponent(selectedDistrict)}&municipality=${encodeURIComponent(selectedMunicipality)}`)
                .then(res => res.json())
                .then(data => setAvailableSchools(data || []))
                .catch(console.error);
        }
    }, [selectedRegion, selectedDivision, selectedDistrict, selectedMunicipality]);



    // --- OFFICE DROPDOWN LOGIC ---
    const regionalOffices = useMemo(() => {
        if (!isOfficeCsvLoaded) return [];
        return [...new Set(officeData
            .filter(row => row['Governance Level'] && row['Governance Level'].includes('Regional Office'))
            .map(row => row['Functional Division'])
            .filter(Boolean)
        )].sort();
    }, [officeData, isOfficeCsvLoaded]);

    const divisionOffices = useMemo(() => {
        if (!isOfficeCsvLoaded) return [];
        return [...new Set(officeData
            .filter(row => row['Governance Level'] && row['Governance Level'].includes('Schools Division Office'))
            .map(row => row['Functional Division'])
            .filter(Boolean)
        )].sort();
    }, [officeData, isOfficeCsvLoaded]);

    const centralOfficeBureaus = useMemo(() => {
        if (!isOfficeCsvLoaded) return [];
        return [...new Set(officeData
            .filter(row => row['Governance Level'] && row['Governance Level'].includes('Central Office'))
            .map(row => row['Functional Division'])
            .filter(Boolean)
        )].sort();
    }, [officeData, isOfficeCsvLoaded]);

    // --- HANDLERS ---
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRoleChange = (e) => {
        setFormData({
            ...formData,
            role: e.target.value,
            // Reset location fields on role change
            region: '', division: '', province: '', city: '', barangay: '', office: '', position: '',
            // Reset role-specific fields
            schoolEmail: '', contactNumber: ''
        });
        // Reset school selection if moving away
        setSelectedSchool(null);
    };

    const handleSchoolSelect = (e) => {
        const schoolId = e.target.value;
        if (!schoolId) {
            setSelectedSchool(null);
            return;
        }

        const school = availableSchools.find(s => s.school_id === schoolId);
        // Create a copy so we can modify latitude/longitude without affecting the source data
        setSelectedSchool({ ...school });
    };

    // --- OTP HANDLERS ---


    // --- LOCATION HANDLERS (Generic Roles) ---
    const handleRegionChange = (e) => {
        const region = e.target.value;
        setFormData({
            ...formData,
            region,
            province: '', city: '', barangay: '', division: ''
        });

        // Trigger Cascading Load (Database)
        setSelectedRegion(region);

        // Legacy Location Data (for LGU Province/City/Barangay)
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

    // --- 3. DRAGGABLE MARKER LOGIC ---
    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (marker != null) {
                    const { lat, lng } = marker.getLatLng();
                    setSelectedSchool(prev => ({
                        ...prev,
                        latitude: lat,
                        longitude: lng
                    }));
                }
            },
        }),
        [],
    );

    // --- 4. REGISTRATION SUBMISSION ---
    const handleRegister = async (e) => {
        e.preventDefault();

        // FAKE EMAIL STRATEGY:
        // If School Head, Auth Email is [SchoolID]@insighted.app
        // The "Real" email is stored in formData.schoolEmail and sent to backend
        const authEmail = (formData.role === 'School Head')
            ? `${selectedSchool.school_id}@insighted.app`
            : (formData.email || '').trim();

        const contactEmail = (formData.role === 'School Head')
            ? (formData.schoolEmail || '').trim()
            : authEmail; // For others, auth email is contact email

        const contactDigits = (formData.contactNumber || '').replace(/\D/g, '');

        // Basic Validations
        if (formData.password !== formData.confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        // --- AUTHORIZATION CODE CHECK (For Non-School Heads and Non-Super Users) ---
        if (formData.role !== 'School Head' && formData.role !== 'Super User') {
            const requiredCode = AUTHORIZATION_CODES[formData.role];
            if (requiredCode && formData.authCode !== requiredCode) {
                alert(`Invalid Authorization Code for ${formData.role}. Please send an email to support.stride@deped.gov.ph to obtain the secure code.`);
                return;
            }
        }

        if (formData.role === 'School Head') {
            if (!selectedSchool) {
                alert("Please select a school.");
                return;
            }
            if (!authEmail) {
                alert("Please enter your school email address.");
                return;
            }

            // --- STRICT DEPED EMAIL VALIDATION ---
            const lowerEmail = contactEmail.toLowerCase();
            if (!lowerEmail.endsWith('@deped.gov.ph')) {
                alert("Restricted Access: Please use your official DepEd email address (@deped.gov.ph).");
                return;
            }

            // Basic email format check (redundant but safe)
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
                alert("Please enter a valid school email address.");
                return;
            }

            if (!contactDigits || contactDigits.length !== 11 || !contactDigits.startsWith('09')) {
                alert("Please enter a valid 11-digit mobile number starting with 09.");
                return;
            }
        }



        // STRICT EMAIL VALIDATION (Global Check)
        if (formData.role !== 'Local Government Unit' && !contactEmail.toLowerCase().endsWith('@deped.gov.ph')) {
            alert("Registration is restricted to official DepEd accounts (@deped.gov.ph).");
            return;
        }

        // Division Engineer Specific Validations
        if (formData.role === 'Division Engineer') {
            if (formData.contactNumber.length !== 11) {
                alert("Please enter a valid 11-digit mobile number.");
                return;
            }
        }

        // Local Government Unit Specific Validations
        if (formData.role === 'Local Government Unit') {
            if (formData.contactNumber.length !== 11) {
                alert("Please enter a valid 11-digit mobile number.");
                return;
            }
            if (!formData.region || !formData.province || !formData.city) {
                alert("Please complete the Assignment details (Region, Province, Municipality).");
                return;
            }
        }

        // STRICT OTP ENFORCEMENT (User requested REMOVAL)
        // if (!isOtpVerified) {
        //     alert("Please verify your email via OTP before registering.");
        //     return;
        // }

        setLoading(true);

        try {
            let regData = null;

            // STEP A: Pre-Checks for School Head
            if (formData.role === 'School Head') {
                if (!selectedSchool) throw new Error("Please select a school.");

                // Backend Check
                console.log("Step A: Checking existing school...");
                const checkRes = await fetch('/api/check-existing-school', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ schoolId: selectedSchool.school_id })
                });
                console.log("Step A: Check response received", checkRes.status);
                const checkData = await checkRes.json();
                if (checkData.exists) {
                    throw new Error(checkData.message || "School already registered.");
                }
            }

            // STEP B: Firebase Auth Create (WITH ZOMBIE RECOVERY)
            let user;
            try {
                console.log("Step B: Creating Firebase Auth user...", authEmail);
                const userCredential = await createUserWithEmailAndPassword(auth, authEmail, formData.password);
                user = userCredential.user;
                console.log("Step B: Auth User Created:", user.uid);
            } catch (authError) {
                if (authError.code === 'auth/email-already-in-use') {
                    // ATTEMPT RECOVERY: Try logging in to see if it's a "Zombie" account (No Firestore Data)
                    // If they entered the CORRECT password for the existing email, we can proceed to check if it's a zombie.

                    try {
                        const userCredential = await signInWithEmailAndPassword(auth, authEmail, formData.password);
                        user = userCredential.user;
                    } catch (loginError) {
                        // If login fails, we cannot proceed with Zombie recovery.
                        if (loginError.code === 'auth/wrong-password') {
                            throw new Error("Account already exists with a different password. Please log in or reset your password.");
                        } else if (loginError.code === 'auth/too-many-requests') {
                            throw new Error("Access temporarily disabled due to many failed attempts. Reset your password or try again later.");
                        } else {
                            // Network error or other auth issue
                            console.error("Recovery Login Error:", loginError);
                            throw new Error("Email already in use. Please log in.");
                        }
                    }

                    // If we get here, Auth Login was SUCCESSFUL (User knows password).
                    // Now check if they have a profile (Real User) or not (Zombie).
                    try {
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists()) {
                            alert("This email is already registered. Please use the Login page to access your account.");
                            // navigate(getDashboardPath(formData.role)); // REMOVED per user request
                            return;
                        } else {
                            // ZOMBIE DETECTED: Auth exists, Firestore missing.
                            // Allow code to proceed to Step C to "repair"/complete registration.
                            console.log("Resuming registration for orphaned Auth account...");
                        }
                    } catch (firestoreError) {
                        console.error("Firestore Check Error:", firestoreError);
                        // If we can't check Firestore (e.g. offline), we shouldn't overwrite blindly, 
                        // but usually if we are offline, we wouldn't have gotten past Auth.
                        // We will assume if Auth works, we should be able to check Profile.
                        throw new Error("Connection error checking existing account profile.");
                    }

                } else {
                    throw authError; // Genuine other error (e.g. weak-password)
                }
            }

            // STEP C: Role-Specific Persistence
            if (formData.role === 'School Head') {
                // CALL NEW ONE-SHOT ENDPOINT
                console.log("SENDING REGISTRATION DATA:", {
                    ...selectedSchool
                });

                // selectedSchool now contains the updated latitude/longitude from the map drag
                // Explicitly construct payload to avoid shadowing
                const finalSchoolData = {
                    ...selectedSchool,
                    // Explicitly map keys if needed, though spread usually handles it
                    // ensuring curricular offering is included
                    curricularOffering: selectedSchool.curricular_offering
                };

                console.log("SENDING FINAL REGISTRATION DATA:", finalSchoolData);

                const regRes = await fetch('/api/register-school', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uid: user.uid,
                        email: contactEmail, // <--- SAVE REAL EMAIL HERE
                        contactNumber: contactDigits,
                        schoolData: finalSchoolData
                    })
                });

                regData = await regRes.json();
                if (!regData.success) {
                    throw new Error(regData.error || "Server Registration Failed.");
                }

                // Save to Firestore (Minimal user profile + schoolId link)
                await setDoc(doc(db, "users", user.uid), {
                    email: user.email,
                    role: 'School Head',
                    schoolId: selectedSchool.school_id,
                    loginId: selectedSchool.school_id,
                    contactNumber: contactDigits,
                    firstName: "School Head",
                    lastName: selectedSchool.school_id,
                    iern: regData.iern, // From Backend
                    authProvider: "email",
                    createdAt: new Date()
                });

            } else {
                // GENERIC REGISTRATION (Engineer, etc.)
                await setDoc(doc(db, "users", user.uid), {
                    email: user.email,
                    role: formData.role,
                    firstName: formData.firstName || "User",
                    lastName: formData.lastName || "",
                    authProvider: "email",
                    createdAt: new Date(),
                    // Save other fields if needed
                    region: formData.region,
                    division: formData.division,
                    office: formData.office,
                    position: formData.position,
                    contactNumber: formData.contactNumber,
                    altEmail: formData.altEmail
                });

                // SYNC TO NEONSQL (Tabular Data)
                try {
                    console.log("Syncing to NeonSQL...", user.uid);
                    await fetch('/api/register-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            uid: user.uid,
                            email: user.email,
                            role: formData.role,
                            firstName: formData.firstName,
                            lastName: formData.lastName,
                            region: formData.region,
                            division: formData.division,
                            province: formData.province,
                            city: formData.city,
                            barangay: formData.barangay,
                            office: formData.office,
                            position: formData.position,
                            contactNumber: formData.contactNumber,
                            altEmail: formData.altEmail
                        })
                    });
                } catch (neonErr) {
                    console.error("Neon Sync Failed (Non-Fatal):", neonErr);
                    // We don't block registration if Neon fails, but we log it.
                }
            }

            // STEP D: Success
            if (formData.role === 'School Head' && regData?.iern) {
                setRegisteredIern(regData.iern);
                setShowSuccessModal(true);
            } else {
                navigate(getDashboardPath(formData.role));
            }

        } catch (error) {
            console.error("Registration Error:", error);
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageTransition>
            <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-700 to-slate-200 animate-gradient-xy py-10">
                {/* Background Blobs */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-100 animate-gradient-xy"></div>
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-[100px] animate-blob"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>

                <div className="relative z-10 w-[90%] max-w-xl">
                    <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl p-6 md:p-8 transform transition-all duration-500 max-h-[85vh] overflow-y-auto custom-scrollbar">

                        {/* Header */}
                        <div className="text-center mb-8">
                            <img src={logo} alt="InsightEd Ratio" className="h-20 mx-auto mb-4 object-contain drop-shadow-sm" />
                            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Create Account</h2>
                            <p className="text-slate-500 font-medium">Join the InsightEd network</p>
                        </div>

                        <form onSubmit={handleRegister} className="space-y-6">

                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                <label className="block text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Registering As</label>
                                <div className="relative">
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleRoleChange}
                                        className="w-full bg-white border border-blue-200 rounded-xl px-4 py-3 text-blue-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="Central Office">Central Office</option>
                                        <option value="Regional Office">Regional Office</option>
                                        <option value="School Division Office">School Division Office</option>
                                        <option value="School Head">School Head</option>
                                        <option value="Division Engineer">Division Engineer</option>
                                        <option value="Local Government Unit">Local Government Unit</option>
                                        <option value="Super User">Super User</option>
                                        {/* {<option value="Admin">Admin</option>} */}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-blue-500">
                                        <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* AUTHORIZATION CODE INPUT (For Non-School Heads and Non-Super Users) */}
                            {formData.role !== 'School Head' && formData.role !== 'Super User' && (
                                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 animate-fade-in">
                                    <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                        </svg>
                                        Authorization Code (Required)
                                    </label>
                                    <input
                                        type="text"
                                        name="authCode"
                                        value={formData.authCode}
                                        onChange={handleChange}
                                        placeholder="Enter Secure Code"
                                        className="w-full bg-white border border-amber-300 rounded-xl px-4 py-3 text-amber-900 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-amber-300 placeholder:font-sans placeholder:tracking-normal"
                                        required
                                    />
                                    <p className="text-[10px] text-amber-600 mt-2 ml-1">
                                        Please send an email to <span className="font-bold select-all">support.stride@deped.gov.ph</span> to obtain the secure code for <strong>{formData.role}</strong> registration.
                                    </p>
                                </div>
                            )}

                            {/* === SCHOOL HEAD SPECIFIC FLOW === */}
                            {formData.role === 'School Head' ? (
                                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="bg-white p-5 rounded-2xl border-l-4 border-l-blue-500 shadow-sm border border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-600 w-6 h-6 flex items-center justify-center rounded-full text-xs">1</span>
                                            School Selection
                                        </h3>

                                        {regions.length === 0 ? (
                                            <div className="text-center py-4 text-slate-400 text-sm animate-pulse">Loading School Database...</div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3">
                                                {/* 1. Region */}
                                                <select
                                                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={selectedRegion}
                                                    onChange={(e) => {
                                                        setSelectedRegion(e.target.value);
                                                        setSelectedDivision('');
                                                        setSelectedDistrict('');
                                                        setSelectedMunicipality('');
                                                        setSelectedSchool(null);
                                                    }}
                                                >
                                                    <option value="">Select Region</option>
                                                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                                </select>

                                                {/* 2. Division */}
                                                <select
                                                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                                                    value={selectedDivision}
                                                    disabled={!selectedRegion}
                                                    onChange={(e) => {
                                                        setSelectedDivision(e.target.value);
                                                        setSelectedDistrict('');
                                                        setSelectedMunicipality('');
                                                        setSelectedSchool(null);
                                                    }}
                                                >
                                                    <option value="">Select Division</option>
                                                    {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>

                                                {/* 3. District */}
                                                <select
                                                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                                                    value={selectedDistrict}
                                                    disabled={!selectedDivision}
                                                    onChange={(e) => {
                                                        setSelectedDistrict(e.target.value);
                                                        setSelectedMunicipality('');
                                                        setSelectedSchool(null);
                                                    }}
                                                >
                                                    <option value="">Select District</option>
                                                    {districts.map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>

                                                {/* 4. Municipality */}
                                                <select
                                                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                                                    value={selectedMunicipality}
                                                    disabled={!selectedDistrict}
                                                    onChange={(e) => {
                                                        setSelectedMunicipality(e.target.value);
                                                        setSelectedSchool(null);
                                                    }}
                                                >
                                                    <option value="">Select Municipality</option>
                                                    {municipalities.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>

                                                {/* 5. School (Final Step) */}
                                                <select
                                                    className="w-full p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm font-semibold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                                                    value={selectedSchool?.school_id || ''}
                                                    disabled={!selectedMunicipality}
                                                    onChange={handleSchoolSelect}
                                                >
                                                    <option value="">Select School</option>
                                                    {availableSchools.map(s => <option key={s.school_id} value={s.school_id}>{s.school_name} - {s.school_id}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>





                                    {/* AUTO-GENERATED CREDENTIALS */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Your Username (School ID)</label>
                                        <input
                                            type="text"
                                            value={selectedSchool?.school_id || ''}
                                            readOnly
                                            className="w-full bg-slate-200 border-none rounded-lg px-3 py-2 text-slate-800 text-lg font-mono font-bold mb-2 cursor-not-allowed text-center tracking-widest"
                                        />
                                        <p className="text-[10px] text-slate-500 text-center">You will use this ID to log in.</p>
                                    </div>

                                    {/* SCHOOL CONTACT DETAILS */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-600 w-6 h-6 flex items-center justify-center rounded-full text-xs">2</span>
                                            Account Recovery & Contact Info
                                        </h3>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1 ml-1">Official School Email</label>
                                                <div className="flex items-center w-full max-w-full">
                                                    <input
                                                        type="text"
                                                        value={formData.schoolEmail ? formData.schoolEmail.split('@')[0] : ''}
                                                        onChange={(e) => {
                                                            const username = e.target.value.replace(/[^a-zA-Z0-9._-]/g, '');
                                                            setFormData(prev => ({ ...prev, schoolEmail: username + '@deped.gov.ph' }));
                                                        }}
                                                        placeholder="username"
                                                        className="flex-1 min-w-0 bg-white border border-r-0 border-slate-200 text-sm rounded-l-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500 overflow-hidden text-ellipsis"
                                                        required
                                                    />
                                                    <span className="bg-slate-100 border border-l-0 border-slate-200 text-slate-500 text-xs sm:text-sm font-bold px-2 sm:px-3 py-3 rounded-r-xl select-none whitespace-nowrap">
                                                        @deped.gov.ph
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-1 ml-1">Used for password resets and notifications.</p>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1 ml-1">Mobile Number</label>
                                                <input
                                                    name="contactNumber"
                                                    inputMode="numeric"
                                                    value={formData.contactNumber}
                                                    onFocus={() => {
                                                        if (!formData.contactNumber) setFormData(prev => ({ ...prev, contactNumber: '09' }));
                                                    }}
                                                    onChange={(e) => {
                                                        let val = e.target.value.replace(/\D/g, '');
                                                        // STRICT ENFORCEMENT: Must start with 09
                                                        if (!val.startsWith('09')) {
                                                            if (val.startsWith('9')) val = '0' + val; // Auto-fix 9...
                                                            else if (val.length < 2) val = '09'; // Prevent deleting 09
                                                            else val = '09' + val.substring(2); // Re-attach if messed up middle?? No, safe default. 
                                                        }
                                                        // Ensure length limit
                                                        val = val.slice(0, 11);
                                                        setFormData(prev => ({ ...prev, contactNumber: val }));
                                                    }}
                                                    placeholder="0912 345 6789"
                                                    className="w-full bg-white border border-slate-200 text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                                                    maxLength={11}
                                                    required
                                                />
                                                <p className="text-[10px] text-slate-400 mt-1 ml-1">Must be exactly 11 digits.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* MAP & LOCATION CONFIRMATION */}
                                    {selectedSchool && selectedSchool.latitude && selectedSchool.longitude && (
                                        <div className="animate-in fade-in slide-in-from-top-2 space-y-4">

                                            {/* MAP */}
                                            <div className="w-full h-[250px] rounded-xl overflow-hidden border border-slate-200 relative z-0 shadow-inner">
                                                <MapContainer
                                                    center={[parseFloat(selectedSchool.latitude), parseFloat(selectedSchool.longitude)]}
                                                    zoom={17}
                                                    style={{ height: '100%', width: '100%' }}
                                                    dragging={true}
                                                    scrollWheelZoom={true}
                                                >
                                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                    <Marker
                                                        position={[parseFloat(selectedSchool.latitude), parseFloat(selectedSchool.longitude)]}
                                                        draggable={true}
                                                        eventHandlers={eventHandlers}
                                                        ref={markerRef}
                                                    >
                                                        <Popup>Target: {selectedSchool.school_name}<br />Drag to adjust.</Popup>
                                                    </Marker>
                                                </MapContainer>
                                            </div>

                                            {/* CONFIRMATION UI */}
                                            <div className="p-4 rounded-xl border-2 bg-blue-50 border-blue-200">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-bold text-blue-900 text-sm uppercase">Confirm Location</h4>
                                                </div>

                                                <p className="text-xs text-blue-700 mb-2">
                                                    Drag the pin on the map to precise location of your school if needed.
                                                </p>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-white p-2 rounded border border-blue-100">
                                                        <div className="text-[10px] uppercase text-slate-400 font-bold">Latitude</div>
                                                        <div className="text-xs font-mono font-bold text-slate-700">{parseFloat(selectedSchool.latitude).toFixed(6)}</div>
                                                    </div>
                                                    <div className="bg-white p-2 rounded border border-blue-100">
                                                        <div className="text-[10px] uppercase text-slate-400 font-bold">Longitude</div>
                                                        <div className="text-xs font-mono font-bold text-slate-700">{parseFloat(selectedSchool.longitude).toFixed(6)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                            ) : (
                                /* === GENERIC / OTHER ROLE FLOW === */
                                <div className="space-y-4 animate-in fade-in">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <span className="bg-blue-100 text-blue-600 w-6 h-6 flex items-center justify-center rounded-full text-xs">1</span>
                                        Personal Information
                                    </h3>

                                    <div className="grid grid-cols-2 gap-3">
                                        <input name="firstName" value={formData.firstName} placeholder="First Name" onChange={handleChange} className="bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />
                                        <input name="lastName" value={formData.lastName} placeholder="Last Name" onChange={handleChange} className="bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />
                                    </div>


                                    <input name="email" type="email" placeholder={formData.role === 'Local Government Unit' ? "Email Address" : "DepEd Email Address"} onChange={handleChange} value={formData.email} className="w-full bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />

                                    {/* CENTRAL OFFICE FIELDS */}
                                    {formData.role === 'Central Office' && (
                                        <div className="space-y-3 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                                            <label className="text-xs font-bold text-yellow-700 uppercase">Bureau Assignment</label>
                                            <div className="space-y-3">
                                                <select
                                                    name="office"
                                                    value={formData.office} // Mapping Bureau to office
                                                    onChange={handleChange}
                                                    className="w-full bg-white border border-yellow-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-yellow-500"
                                                    required
                                                >
                                                    <option value="">Select Bureau / Service</option>
                                                    {centralOfficeBureaus.map((bureau) => (
                                                        <option key={bureau} value={bureau}>{bureau}</option>
                                                    ))}
                                                </select>

                                                <input
                                                    name="division"
                                                    value={formData.division} // Mapping Division to division
                                                    placeholder="Division"
                                                    onChange={handleChange}
                                                    className="w-full bg-white border border-yellow-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-500"
                                                    required
                                                />

                                                <input
                                                    name="position"
                                                    value={formData.position}
                                                    placeholder="Position"
                                                    onChange={handleChange}
                                                    className="w-full bg-white border border-yellow-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-500"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* REGIONAL OFFICE FIELDS */}
                                    {formData.role === 'Regional Office' && (
                                        <div className="space-y-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                                            <label className="text-xs font-bold text-purple-700 uppercase">Region Assignment</label>
                                            <select
                                                name="region"
                                                onChange={handleChange}
                                                value={formData.region}
                                                className="w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-purple-500"
                                                required
                                            >
                                                <option value="">Select Region</option>
                                                {regions.map((reg) => (
                                                    <option key={reg} value={reg}>{reg}</option>
                                                ))}
                                            </select>
                                            <select
                                                name="office"
                                                value={formData.office}
                                                onChange={handleChange}
                                                className="w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-purple-500"
                                                required
                                            >
                                                <option value="">Select Office</option>
                                                {regionalOffices.map((office) => (
                                                    <option key={office} value={office}>{office}</option>
                                                ))}
                                            </select>


                                            <input
                                                name="position"
                                                value={formData.position}
                                                placeholder="Position"
                                                onChange={handleChange}
                                                className="w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                                                required
                                            />
                                        </div>
                                    )}

                                    {/* SCHOOL DIVISION OFFICE FIELDS */}
                                    {formData.role === 'School Division Office' && (
                                        <div className="space-y-3 p-4 bg-orange-50 rounded-xl border border-orange-100">
                                            <label className="text-xs font-bold text-orange-700 uppercase">Division Assignment</label>
                                            <select
                                                name="region"
                                                onChange={handleRegionChange}
                                                value={formData.region}
                                                className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
                                                required
                                            >
                                                <option value="">Select Region</option>
                                                {regions.map((reg) => (
                                                    <option key={reg} value={reg}>{reg}</option>
                                                ))}
                                            </select>

                                            <select
                                                name="division"
                                                onChange={handleChange}
                                                value={formData.division}
                                                className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                                                disabled={!formData.region}
                                                required
                                            >
                                                <option value="">Select Division</option>
                                                {divisions.map(div => (
                                                    <option key={div} value={div}>{div}</option>
                                                ))}
                                            </select>

                                            <select
                                                name="office"
                                                value={formData.office}
                                                onChange={handleChange}
                                                className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
                                                required
                                            >
                                                <option value="">Select Office</option>
                                                {divisionOffices.map((office) => (
                                                    <option key={office} value={office}>{office}</option>
                                                ))}
                                            </select>

                                            <input
                                                name="position"
                                                value={formData.position}
                                                placeholder="Position"
                                                onChange={handleChange}
                                                className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                required
                                            />
                                        </div>
                                    )}

                                    {/* DIVISION ENGINEER FIELDS */}
                                    {formData.role === 'Division Engineer' && (
                                        <div className="space-y-4 p-4 bg-teal-50 rounded-xl border border-teal-100">
                                            <h3 className="text-sm font-bold text-teal-800 uppercase flex items-center gap-2">
                                                <span className="bg-teal-100 text-teal-600 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">2</span>
                                                Assignment & Contact
                                            </h3>

                                            {/* ASSIGNMENT */}
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-teal-700 uppercase">Assignment</label>
                                                <select
                                                    name="region"
                                                    onChange={handleRegionChange}
                                                    value={formData.region}
                                                    className="w-full bg-white border border-teal-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                                                    required
                                                >
                                                    <option value="">Select Region</option>
                                                    {regions.map((reg) => (
                                                        <option key={reg} value={reg}>{reg}</option>
                                                    ))}
                                                </select>

                                                <select
                                                    name="division"
                                                    onChange={handleChange}
                                                    value={formData.division}
                                                    className="w-full bg-white border border-teal-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                                                    disabled={!formData.region}
                                                    required
                                                >
                                                    <option value="">Select Division</option>
                                                    {divisions.map(div => (
                                                        <option key={div} value={div}>{div}</option>
                                                    ))}
                                                </select>

                                                <select
                                                    name="position"
                                                    value={formData.position}
                                                    onChange={handleChange}
                                                    className="w-full bg-white border border-teal-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                                                    required
                                                >
                                                    <option value="">Select Position</option>
                                                    <option value="Engineer II">Engineer II</option>
                                                    <option value="Engineer III">Engineer III</option>
                                                    <option value="Engineer IV">Engineer IV</option>
                                                    <option value="Engineer V">Engineer V</option>
                                                    <option value="Technical Assistant I (COS)">Technical Assistant I (COS)</option>
                                                    <option value="Technical Assistant II (COS)">Technical Assistant II (COS)</option>
                                                    <option value="Technical Assistant III (COS)">Technical Assistant III (COS)</option>
                                                    <option value="Technical Assistant IV (COS)">Technical Assistant IV (COS)</option>
                                                    <option value="Technical Assistant V (COS)">Technical Assistant V (COS)</option>
                                                </select>
                                            </div>

                                            {/* CONTACT INFO */}
                                            <div className="space-y-3 pt-3 border-t border-teal-200/50">
                                                <label className="text-xs font-bold text-teal-700 uppercase">Contact Information</label>

                                                {/* MOBILE */}
                                                <div>
                                                    <input
                                                        name="contactNumber"
                                                        inputMode="numeric"
                                                        value={formData.contactNumber}
                                                        onFocus={() => {
                                                            if (!formData.contactNumber) setFormData(prev => ({ ...prev, contactNumber: '09' }));
                                                        }}
                                                        onChange={(e) => {
                                                            let val = e.target.value.replace(/\D/g, '');
                                                            if (!val.startsWith('09')) {
                                                                if (val.startsWith('9')) val = '0' + val;
                                                                else if (val.length < 2) val = '09';
                                                                else val = '09' + val.substring(2);
                                                            }
                                                            val = val.slice(0, 11);
                                                            setFormData(prev => ({ ...prev, contactNumber: val }));
                                                        }}
                                                        placeholder="Mobile No. (09xx xxx xxxx)"
                                                        className="w-full bg-white border border-teal-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                                                        maxLength={11}
                                                        required
                                                    />
                                                    <p className="text-[10px] text-teal-600 mt-1 ml-1">Must be 11 digits.</p>
                                                </div>

                                                {/* ALT EMAIL */}
                                                <input
                                                    name="altEmail"
                                                    type="email"
                                                    value={formData.altEmail}
                                                    onChange={handleChange}
                                                    placeholder="Alternative Email Address (Optional)"
                                                    className="w-full bg-white border border-teal-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                                                />
                                                <p className="text-[10px] text-teal-600 ml-1">Backup email for account recovery.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* LOCAL GOVERNMENT UNIT FIELDS */}
                                    {formData.role === 'Local Government Unit' && (
                                        <div className="space-y-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
                                            <h3 className="text-sm font-bold text-orange-800 uppercase flex items-center gap-2">
                                                <span className="bg-orange-100 text-orange-600 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">2</span>
                                                LGU Assignment & Contact
                                            </h3>

                                            {/* ASSIGNMENT */}
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-orange-700 uppercase">Jurisdiction</label>

                                                {/* REGION */}
                                                <select
                                                    name="region"
                                                    onChange={handleRegionChange}
                                                    value={formData.region}
                                                    className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
                                                    required
                                                >
                                                    <option value="">Select Region</option>
                                                    {regions.map((reg) => (
                                                        <option key={reg} value={reg}>{reg}</option>
                                                    ))}
                                                </select>

                                                {/* PROVINCE */}
                                                <select
                                                    name="province"
                                                    onChange={handleProvinceChange}
                                                    value={formData.province}
                                                    className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                                                    disabled={!formData.region}
                                                    required
                                                >
                                                    <option value="">Select Province</option>
                                                    {provinceOptions.map((prov) => (
                                                        <option key={prov} value={prov}>{prov}</option>
                                                    ))}
                                                </select>

                                                {/* MUNICIPALITY */}
                                                <select
                                                    name="city"
                                                    onChange={handleCityChange}
                                                    value={formData.city}
                                                    className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                                                    disabled={!formData.province}
                                                    required
                                                >
                                                    <option value="">Select Municipality/City</option>
                                                    {cityOptions.map((city) => (
                                                        <option key={city} value={city}>{city}</option>
                                                    ))}
                                                </select>

                                                <input
                                                    name="position"
                                                    value={formData.position}
                                                    placeholder="Position / Designation"
                                                    onChange={handleChange}
                                                    className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                    required
                                                />
                                            </div>

                                            {/* CONTACT INFO */}
                                            <div className="space-y-3 pt-3 border-t border-orange-200/50">
                                                <label className="text-xs font-bold text-orange-700 uppercase">Contact Information</label>

                                                {/* MOBILE */}
                                                <div>
                                                    <input
                                                        name="contactNumber"
                                                        inputMode="numeric"
                                                        value={formData.contactNumber}
                                                        onFocus={() => {
                                                            if (!formData.contactNumber) setFormData(prev => ({ ...prev, contactNumber: '09' }));
                                                        }}
                                                        onChange={(e) => {
                                                            let val = e.target.value.replace(/\D/g, '');
                                                            if (!val.startsWith('09')) {
                                                                if (val.startsWith('9')) val = '0' + val;
                                                                else if (val.length < 2) val = '09';
                                                                else val = '09' + val.substring(2);
                                                            }
                                                            val = val.slice(0, 11);
                                                            setFormData(prev => ({ ...prev, contactNumber: val }));
                                                        }}
                                                        placeholder="Mobile No. (09xx xxx xxxx)"
                                                        className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                        maxLength={11}
                                                        required
                                                    />
                                                    <p className="text-[10px] text-orange-600 mt-1 ml-1">Must be 11 digits.</p>
                                                </div>

                                                {/* ALT EMAIL */}
                                                <input
                                                    name="altEmail"
                                                    type="email"
                                                    value={formData.altEmail}
                                                    onChange={handleChange}
                                                    placeholder="Alternative Email Address (Optional)"
                                                    className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                            </div>
                                        </div>
                                    )}



                                </div>
                            )}

                            {/* === 3. EMAIL VERIFICATION & SECURITY (COMMENTED OUT FOR TESTING) === */}
                            {/* <div className="pt-2 border-t border-slate-100 animate-in fade-in">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                                    <span className="bg-blue-100 text-blue-600 w-6 h-6 flex items-center justify-center rounded-full text-xs">
                                        {formData.role === 'School Head' ? 2 : (['Engineer'].includes(formData.role) ? 3 : 2)}
                                    </span>
                                    Account Security
                                </h3>

                                <div className="mb-6 space-y-3">

                                    
                                    
                                    <div className="flex flex-col gap-3">
                                        <p className="text-xs text-slate-500">
                                            Verifying: <span className="font-bold text-slate-700">{formData.email || "No email entered"}</span>
                                        </p>

                                        {!isOtpVerified && (
                                            <button
                                                type="button"
                                                onClick={handleSendOtp}
                                                disabled={otpLoading || !canResend || !formData.email}
                                                className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 py-3 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {otpLoading ? 'Sending Code...' : !canResend ? `Resend in ${timer}s` : isOtpSent ? 'Resend Verification Code' : 'Send Verification Code'}
                                            </button>
                                        )}

                                        {isOtpSent && !isOtpVerified && (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Enter Code</label>
                                                <div className="flex justify-between gap-2 mb-3">
                                                    {otp.map((digit, index) => (
                                                        <input
                                                            key={index}
                                                            type="text"
                                                            maxLength="1"
                                                            value={digit}
                                                            onChange={e => handleOtpChange(e.target, index)}
                                                            className="w-10 h-12 text-center border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none text-lg font-bold bg-white"
                                                        />
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleVerifyOtp}
                                                    className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700"
                                                >
                                                    Verify Code
                                                </button>
                                            </div>
                                        )}

                                        {isOtpVerified && (
                                            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-green-200">
                                                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                Email Verified Successfully
                                            </div>
                                        )}
                                    </div> 
                                    
                                </div>
                            </div> */}



                            {/* MOVED PASSWORD FIELDS OUT OF COMMENTED BLOCK */}
                            <div className="space-y-3 pt-4 border-t border-slate-100">
                                <h3 className="text-sm font-bold text-slate-800 mb-2">Create Password</h3>
                                <input name="password" type="password" placeholder="Password" onChange={handleChange} className="w-full bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:border-blue-500" required />
                                <input name="confirmPassword" type="password" placeholder="Confirm Password" onChange={handleChange} className="w-full bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:border-blue-500" required />
                            </div>

                            {/* SUBMIT BUTTON */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-500/30 transform transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {loading ? 'Processing...' : 'Complete Registration'}
                                {!loading && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>}
                            </button>

                        </form>

                        <div className="mt-8 text-center pt-6 border-t border-slate-100">
                            <Link to="/" className="text-sm font-semibold text-blue-600 hover:text-blue-800">Back to Login</Link>
                        </div>
                    </div>
                </div>

                {/* SUCCESS MODAL */}
                {showSuccessModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-blue-500"></div>

                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 text-3xl">
                                ✅
                            </div>

                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Registration Successful!</h2>
                            <p className="text-slate-500 mb-6">Welcome to InsightEd. Your account has been created.</p>

                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-6">
                                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Your School IERN</p>
                                <h3 className="text-3xl font-black text-blue-900 tracking-tight font-mono">{registeredIern}</h3>
                                <p className="text-[10px] text-blue-400 mt-2">Please save this reference number.</p>
                            </div>

                            <button
                                onClick={() => navigate(getDashboardPath(formData.role))}
                                className="w-full py-4 rounded-xl bg-[#004A99] text-white font-bold text-lg shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition transform active:scale-[0.98]"
                            >
                                Continue to Dashboard
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default Register;
