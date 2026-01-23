// src/Register.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import logo from './assets/InsightEd1.png';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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

// --- CONSTANTS ---
const CSV_PATH = '/schools.csv';

import locationData from './locations.json';

const getDashboardPath = (role) => {
    const roleMap = {
        'Engineer': '/engineer-dashboard',
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
        email: '',
        password: '',
        confirmPassword: '',
        role: 'Engineer', // Default
        // Legacy/Other Role Fields
        bureau: '',
        office: '',
        position: '',
        region: '',
        division: '',
        province: '',
        city: '',
        barangay: ''
    });

    // --- OTP STATE ---
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [isOtpVerified, setIsOtpVerified] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [timer, setTimer] = useState(0);
    const [canResend, setCanResend] = useState(true);

    // --- LOCATION DROPDOWN STATE (Generic Roles) ---
    const [provinceOptions, setProvinceOptions] = useState([]);
    const [cityOptions, setCityOptions] = useState([]);
    const [barangayOptions, setBarangayOptions] = useState([]);

    // --- SCHOOL HEAD SPECIFIC STATE ---
    const [csvData, setCsvData] = useState([]);
    const [isCsvLoaded, setIsCsvLoaded] = useState(false);

    // Cascading Selections (5-Step Hierarchy)
    const [selectedRegion, setSelectedRegion] = useState('');
    const [selectedDivision, setSelectedDivision] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedMunicipality, setSelectedMunicipality] = useState('');
    const [selectedSchool, setSelectedSchool] = useState(null);

    // Map Marker Ref
    const markerRef = useRef(null);

    // --- OTP TIMER EFFECT ---
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

    // --- 1. LOAD CSV DATA ---
    useEffect(() => {
        Papa.parse(CSV_PATH, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.data && results.data.length > 0) {
                    setCsvData(results.data);
                    setIsCsvLoaded(true);
                }
            },
            error: (err) => {
                console.error("CSV Load Error:", err);
            }
        });
    }, []);

    // --- 2. CASCADING FILTER LOGIC ---
    // Helper to get unique values based on filters
    const getUniqueValues = (field, filters = {}) => {
        if (!isCsvLoaded) return [];
        let filtered = csvData;

        // Apply existing filters in order
        if (filters.region) filtered = filtered.filter(row => row.region === filters.region);
        if (filters.division) filtered = filtered.filter(row => row.division === filters.division);
        if (filters.district) filtered = filtered.filter(row => row.district === filters.district);
        if (filters.municipality) filtered = filtered.filter(row => row.municipality === filters.municipality);

        // Extract and deduplicate
        return [...new Set(filtered.map(row => row[field]))].sort().filter(Boolean);
    };

    // Derived Options Hierarchy
    const regions = getUniqueValues('region');
    const divisions = selectedRegion ? getUniqueValues('division', { region: selectedRegion }) : [];
    const districts = selectedDivision ? getUniqueValues('district', { region: selectedRegion, division: selectedDivision }) : [];
    const municipalities = selectedDistrict ? getUniqueValues('municipality', { region: selectedRegion, division: selectedDivision, district: selectedDistrict }) : [];

    // Final School List logic (Filtered by Municipality)
    const availableSchools = (selectedMunicipality)
        ? csvData.filter(s =>
            s.region === selectedRegion &&
            s.division === selectedDivision &&
            s.district === selectedDistrict &&
            s.municipality === selectedMunicipality
        ).sort((a, b) => a.school_name.localeCompare(b.school_name))
        : [];

    // --- HANDLERS ---
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRoleChange = (e) => {
        setFormData({
            ...formData,
            role: e.target.value,
            // Reset location fields on role change
            region: '', division: '', province: '', city: '', barangay: '', office: '', position: ''
        });
        // Reset school selection if moving away
        setSelectedSchool(null);
        // Reset OTP state on role change? Maybe keep it if email is same.
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

        // Auto-Generate Email for School Head
        if (school) {
            setFormData(prev => ({
                ...prev,
                email: `${school.school_id}@deped.gov.ph`
            }));
            // NOTE: For School Head, we might NOT be able to verify this email if it doesn't exist yet.
            // But user requested OTP for ALL roles. 
            // If the email is real, they can verify. If not, they are stuck.
        }
    };

    // --- OTP HANDLERS ---
    const handleSendOtp = async () => {
        if (!formData.email) {
            alert("Please enter your email first.");
            return;
        }
        if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
            alert("Passwords do not match!");
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
                setCanResend(false);
                setTimer(30);
                alert(data.message); // Show actual message from server (might contain fallback info)
            } else {
                alert(data.message || "Failed to send OTP");
            }
        } catch (error) {
            console.error(error);
            alert("Network error sending OTP");
        } finally {
            setOtpLoading(false);
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

    // --- LOCATION HANDLERS (Generic Roles) ---
    const handleRegionChange = (e) => {
        const region = e.target.value;
        setFormData({
            ...formData,
            region,
            province: '', city: '', barangay: '', division: ''
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

        // Basic Validations
        if (formData.password !== formData.confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        setLoading(true);

        try {
            // STEP A: Pre-Checks for School Head
            if (formData.role === 'School Head') {
                if (!selectedSchool) throw new Error("Please select a school.");

                // Backend Check
                const checkRes = await fetch('/api/check-existing-school', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ schoolId: selectedSchool.school_id })
                });
                const checkData = await checkRes.json();
                if (checkData.exists) {
                    throw new Error(checkData.message || "School already registered.");
                }
            }

            // STEP B: Firebase Auth Create
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // STEP C: Role-Specific Persistence
            if (formData.role === 'School Head') {
                // CALL NEW ONE-SHOT ENDPOINT
                // CALL NEW ONE-SHOT ENDPOINT
                console.log("SENDING REGISTRATION DATA:", {
                    ...selectedSchool
                });

                // selectedSchool now contains the updated latitude/longitude from the map drag
                // Explicitly construct payload to avoid shadowing
                const finalSchoolData = {
                    ...selectedSchool
                    // curricularOffering removed by user request
                };

                console.log("SENDING FINAL REGISTRATION DATA:", finalSchoolData);

                const regRes = await fetch('/api/register-school', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uid: user.uid,
                        email: formData.email,
                        schoolData: finalSchoolData
                    })
                });

                const regData = await regRes.json();
                if (!regData.success) {
                    throw new Error(regData.error || "Server Registration Failed.");
                }

                // Save to Firestore (Minimal user profile + schoolId link)
                await setDoc(doc(db, "users", user.uid), {
                    email: user.email,
                    role: 'School Head',
                    schoolId: selectedSchool.school_id,
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
                    division: formData.division
                });
            }

            // STEP D: Success
            navigate(getDashboardPath(formData.role));

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

                            {/* Role Selection */}
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                <label className="block text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Registering As</label>
                                <div className="relative">
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleRoleChange}
                                        className="w-full bg-white border border-blue-200 rounded-xl px-4 py-3 text-blue-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="Engineer">Engineer</option>
                                        <option value="School Head">School Head</option>
                                        <option value="Regional Office">Regional Office</option>
                                        <option value="School Division Office">School Division Office</option>
                                        <option value="Admin">Admin</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-blue-500">
                                        <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* === SCHOOL HEAD SPECIFIC FLOW === */}
                            {formData.role === 'School Head' ? (
                                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="bg-white p-5 rounded-2xl border-l-4 border-l-blue-500 shadow-sm border border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-600 w-6 h-6 flex items-center justify-center rounded-full text-xs">1</span>
                                            School Selection
                                        </h3>

                                        {!isCsvLoaded ? (
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
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 opacity-80">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Login Credentials (Auto)</label>
                                        <input
                                            type="text"
                                            value={formData.email}
                                            readOnly
                                            className="w-full bg-slate-200 border-none rounded-lg px-3 py-2 text-slate-500 text-sm font-mono mb-2 cursor-not-allowed"
                                        />
                                        <p className="text-[10px] text-slate-400">Email is locked to School ID</p>
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
                                        Personal & Assignment
                                    </h3>

                                    <div className="grid grid-cols-2 gap-3">
                                        <input name="firstName" value={formData.firstName} placeholder="First Name" onChange={handleChange} className="bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />
                                        <input name="lastName" value={formData.lastName} placeholder="Last Name" onChange={handleChange} className="bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />
                                    </div>

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
                                                {/* Use locationData keys or CSV regions? User snippet used locationData. Let's use generic regions logic if possible or locationData */}
                                                {Object.keys(locationData).sort().map((reg) => (
                                                    <option key={reg} value={reg}>{reg}</option>
                                                ))}
                                            </select>
                                            <input
                                                name="office"
                                                value={formData.office}
                                                placeholder="Office Name (Do not abbreviate)"
                                                onChange={handleChange}
                                                className="w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                                                required
                                            />
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
                                                {Object.keys(locationData).sort().map((reg) => (
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
                                                {/* Filter Divisions based on Region from CSV Data (Rich Source) */}
                                                {[...new Set(csvData
                                                    .filter(s => s.region === formData.region)
                                                    .map(s => s.division))]
                                                    .sort()
                                                    .map(div => (
                                                        <option key={div} value={div}>{div}</option>
                                                    ))
                                                }
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


                                    <input name="email" type="email" placeholder="Email Address" onChange={handleChange} value={formData.email} className="w-full bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required readOnly={isOtpVerified} />

                                    {/* Generic Location Dropdowns (For Engineer, Admin if needed - Optional but good practice) */}
                                    {/* Hiding them for minimal Engineer view unless requested. User snippet had them for Generic. I'll add them if Engineer */}
                                    {['Engineer'].includes(formData.role) && (
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Using locations.json for hierarchy */}
                                            <select name="region" onChange={handleRegionChange} value={formData.region} className="bg-white border text-sm rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500">
                                                <option value="">Region</option>
                                                {Object.keys(locationData).sort().map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                            <select name="province" onChange={handleProvinceChange} value={formData.province} className="bg-white border text-sm rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500" disabled={!formData.region}>
                                                <option value="">Province</option>
                                                {provinceOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                            <select name="city" onChange={handleCityChange} value={formData.city} className="bg-white border text-sm rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500" disabled={!formData.province}>
                                                <option value="">City/Mun</option>
                                                {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <select name="barangay" onChange={handleChange} value={formData.barangay} className="bg-white border text-sm rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500" disabled={!formData.city}>
                                                <option value="">Barangay</option>
                                                {barangayOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* === 3. EMAIL VERIFICATION & SECURITY === */}
                            <div className="pt-2 border-t border-slate-100 animate-in fade-in">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                                    <span className="bg-blue-100 text-blue-600 w-6 h-6 flex items-center justify-center rounded-full text-xs">
                                        {formData.role === 'School Head' ? 2 : 2}
                                    </span>
                                    Account Security
                                </h3>

                                {/* OTP SECTION */}
                                <div className="mb-6 space-y-3">
                                    {/* If School Head, email is readonly. If Generic, it's editable above. */}
                                    {/* We display email here again or just the OTP controls? The generic flow has email field above. The School Head flow has auto-email. */}
                                    {/* Let's show the email input here ONLY if School Head (since it was hidden/auto in their block) OR if we want to confirm it. */}
                                    {/* Actually better to keep email input in the respective sections and just have OTP controls here targeting formData.email */}

                                    {/* OTP CONTROLS */}
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

                                        {/* OTP INPUTS */}
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

                                <div className="space-y-3">
                                    <input name="password" type="password" placeholder="Password" onChange={handleChange} className="w-full bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:border-blue-500" required />
                                    <input name="confirmPassword" type="password" placeholder="Confirm Password" onChange={handleChange} className="w-full bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:border-blue-500" required />
                                </div>
                            </div>

                            {/* SUBMIT BUTTON */}
                            <button
                                type="submit"
                                disabled={loading || !isOtpVerified}
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
            </div>
        </PageTransition>
    );
};

export default Register;