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

    // --- SCHOOL HEAD SPECIFIC STATE ---
    const [csvData, setCsvData] = useState([]);
    const [isCsvLoaded, setIsCsvLoaded] = useState(false);

    // Cascading Selections (5-Step Hierarchy)
    const [selectedRegion, setSelectedRegion] = useState('');
    const [selectedDivision, setSelectedDivision] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedMunicipality, setSelectedMunicipality] = useState('');
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [curricularOffering, setCurricularOffering] = useState('');

    // Map Marker Ref
    const markerRef = useRef(null);


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
        setFormData({ ...formData, role: e.target.value });
        // Reset school selection if moving away
        setSelectedSchool(null);
        setCurricularOffering('');
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
                console.log("SENDING REGISTRATION DATA:", {
                    ...selectedSchool,
                    curricularOffering
                });

                // selectedSchool now contains the updated latitude/longitude from the map drag
                const regRes = await fetch('/api/register-school', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uid: user.uid,
                        email: formData.email,
                        schoolData: {
                            ...selectedSchool,
                            curricularOffering // Pass this new field
                        }
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



                                    {/* OFFERING SELECTION */}
                                    <div className="bg-white p-5 rounded-2xl border-l-4 border-l-purple-500 shadow-sm border border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <span className="bg-purple-100 text-purple-600 w-6 h-6 flex items-center justify-center rounded-full text-xs">2</span>
                                            Curricular Offering
                                        </h3>
                                        <select
                                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                            value={curricularOffering}
                                            onChange={(e) => setCurricularOffering(e.target.value)}
                                            required
                                        >
                                            <option value="">Select Offering...</option>
                                            <option value="Purely Elementary">Purely Elementary</option>
                                            <option value="Elementary School and Junior High School (K-10)">Elementary School and Junior High School (K-10)</option>
                                            <option value="All Offering (K-12)">All Offering (K-12)</option>
                                            <option value="Junior and Senior High">Junior and Senior High</option>
                                            <option value="Purely Junior High School">Purely Junior High School</option>
                                            <option value="Purely Senior High School">Purely Senior High School</option>
                                        </select>
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
                                    <div className="grid grid-cols-2 gap-3">
                                        <input name="firstName" placeholder="First Name" onChange={handleChange} className="bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />
                                        <input name="lastName" placeholder="Last Name" onChange={handleChange} className="bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />
                                    </div>
                                    <input name="email" type="email" placeholder="Email Address" onChange={handleChange} className="w-full bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />

                                    {/* Simple Region Field for Non-Heads */}
                                    {['Regional Office', 'School Division Office'].includes(formData.role) && (
                                        <input name="office" placeholder="Office Name" onChange={handleChange} className="w-full bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />
                                    )}
                                </div>
                            )}

                            {/* === PASSWORD (COMMON) === */}
                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Security</label>
                                <div className="space-y-3">
                                    <input name="password" type="password" placeholder="Password" onChange={handleChange} className="w-full bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:border-blue-500" required />
                                    <input name="confirmPassword" type="password" placeholder="Confirm Password" onChange={handleChange} className="w-full bg-white border text-sm rounded-xl px-4 py-3 outline-none focus:border-blue-500" required />
                                </div>
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
            </div>
        </PageTransition>
    );
};

export default Register;