// src/forms/SchoolProfile.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Papa from 'papaparse';
import { auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import locationData from '../locations.json';
// LoadingScreen import removed 
import { addToOutbox } from '../db';
import PageTransition from '../components/PageTransition';
import LocationPickerMap from '../components/LocationPickerMap';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal'; // NEW // NEW

const SchoolProfile = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isFirstTime = location.state?.isFirstTime || false;
    const isDummy = location.state?.isDummy || false; // NEW: Dummy Mode Check
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const monitorSchoolId = queryParams.get('schoolId');

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [hasSavedData, setHasSavedData] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [showRegisteredModal, setShowRegisteredModal] = useState(false); // New: Registered Modal State
    const [showIernModal, setShowIernModal] = useState(false); // New: IERN Modal
    const [showOfflineModal, setShowOfflineModal] = useState(false); // NEW
    const [showSuccessModal, setShowSuccessModal] = useState(false); // NEW
    const [successMessage, setSuccessMessage] = useState(""); // NEW
    const [generatedIern, setGeneratedIern] = useState(""); // New: Store IERN
    const [ack1, setAck1] = useState(false);
    const [ack2, setAck2] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isLocked, setIsLocked] = useState(false); // New State
    const [schoolNameWarning, setSchoolNameWarning] = useState(""); // Validation Warning

    // Dropdowns
    const [provinceOptions, setProvinceOptions] = useState([]);
    const [cityOptions, setCityOptions] = useState([]);
    const [barangayOptions, setBarangayOptions] = useState([]);
    const [divisionOptions, setDivisionOptions] = useState([]);
    const [districtOptions, setDistrictOptions] = useState([]);
    const [legDistrictOptions, setLegDistrictOptions] = useState([]);

    const [schoolDirectory, setSchoolDirectory] = useState([]);
    const [regionDivMap, setRegionDivMap] = useState({});
    const [divDistMap, setDivDistMap] = useState({});

    const [formData, setFormData] = useState({
        schoolId: '', schoolName: '',
        region: '', province: '', municipality: '', barangay: '',
        division: '', district: '', legDistrict: '',
        motherSchoolId: '', isAnnex: 'No', latitude: '', longitude: '',
        curricularOffering: '', iern: ''
    });

    const [originalData, setOriginalData] = useState(null);
    const goBack = () => {
        if (isDummy) {
            navigate(-1);
        } else if (viewOnly) {
            navigate('/jurisdiction-schools');
        } else {
            navigate('/school-forms');
        }
    };

    // --- 1. HELPER FUNCTIONS ---

    const saveToLocalCache = (data) => {
        try {
            if (!data) return;
            localStorage.setItem('schoolId', data.schoolId || '');

            // ✅ FORCE SAVE: Ensure this specific field is never lost
            if (data.curricularOffering) {
                localStorage.setItem('schoolOffering', data.curricularOffering);
            }

            localStorage.setItem('fullSchoolProfile', JSON.stringify(data));

            // ✅ FORCE COMPLETE: If we have an ID and Name, mark as complete
            if (data.schoolId && String(data.schoolId).length >= 6) {
                console.log("Marking Profile as Complete");
                localStorage.setItem('schoolProfileStatus', 'complete');
            }
        } catch (e) { console.error("Cache Error:", e); }
    };

    // 🛡️ SMART MAPPER: Prioritizes Local Storage if DB value is missing
    const mapDbToForm = (dbData) => {
        const cachedOffering = localStorage.getItem('schoolOffering');

        return {
            schoolId: dbData.school_id || '',
            schoolName: dbData.school_name || '',
            region: dbData.region || '',
            province: dbData.province || '',
            municipality: dbData.municipality || '',
            barangay: dbData.barangay || '',
            division: dbData.division || '',
            district: dbData.district || '',
            legDistrict: dbData.leg_district || '',
            motherSchoolId: dbData.mother_school_id || '',
            latitude: dbData.latitude || '',
            longitude: dbData.longitude || '',
            // 👇 THE FIX: Use DB value, if empty use Cache, if empty use ''
            curricularOffering: dbData.curricular_offering || cachedOffering || '',
            iern: dbData.iern || ''
        };
    };

    const applyDataToState = (data, regDivMap, divDistMap) => {
        if (!data) return;

        if (locationData && data.region && locationData[data.region]) {
            setProvinceOptions(Object.keys(locationData[data.region]).sort());
            if (data.province && locationData[data.region][data.province]) {
                setCityOptions(Object.keys(locationData[data.region][data.province]).sort());
                if (data.municipality && locationData[data.region][data.province][data.municipality]) {
                    setBarangayOptions(locationData[data.region][data.province][data.municipality].sort());
                }
            }
        }

        if (data.region && regDivMap) setDivisionOptions(regDivMap[data.region] || []);
        if (data.division && divDistMap) setDistrictOptions(divDistMap[data.division] || []);

        setFormData(data);
        setOriginalData(data);

        // Auto-lock if data exists and it's not a first-time setup
        if (data.schoolId && !isFirstTime) {
            setIsLocked(true);
        }

        // Run validation on loaded name
        if (data.schoolName) checkSchoolName(data.schoolName);
    };

    // --- NETWORK LISTENER ---
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // --- 2. INITIALIZATION EFFECT ---
    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            let processedRegDiv = {};
            let processedDivDist = {};
            let tempLegs = [];

            // A. CSV Fetch
            try {
                const csvResponse = await fetch('/schools.csv');
                if (csvResponse.ok) {
                    const contentType = csvResponse.headers.get("content-type");
                    if (contentType && contentType.includes("html")) {
                        // Check for SPA fallback returning index.html instead of CSV
                        throw new Error("CSV file not found (HTML returned)");
                    }

                    const csvText = await csvResponse.text();
                    const parsedData = await new Promise((resolve) => {
                        Papa.parse(csvText, {
                            header: true, skipEmptyLines: true,
                            complete: (results) => resolve(results.data),
                            error: () => resolve([])
                        });
                    });

                    if (isMounted && Array.isArray(parsedData) && parsedData.length > 0) {
                        setSchoolDirectory(parsedData);
                        const tempRegDivSet = {}; const tempDivDistSet = {}; const tempLegsSet = new Set();
                        const clean = (str) => str ? String(str).toLowerCase().replace(/[^a-z0-9]/g, '') : '';

                        parsedData.forEach(row => {
                            if (!row) return; // Defensive check
                            const keys = Object.keys(row);
                            if (keys.length === 0) return;

                            const reg = row[keys.find(k => clean(k) === 'region')]?.trim();
                            const div = row[keys.find(k => clean(k) === 'division')]?.trim();
                            const dist = row[keys.find(k => clean(k) === 'district')]?.trim();
                            const leg = row[keys.find(k => clean(k).includes('legislative') || clean(k) === 'legdistrict')]?.trim();

                            if (reg && div) { if (!tempRegDivSet[reg]) tempRegDivSet[reg] = new Set(); tempRegDivSet[reg].add(div); }
                            if (div && dist) { if (!tempDivDistSet[div]) tempDivDistSet[div] = new Set(); tempDivDistSet[div].add(dist); }
                            if (leg) tempLegsSet.add(leg);
                        });

                        Object.keys(tempRegDivSet).forEach(k => processedRegDiv[k] = Array.from(tempRegDivSet[k]).sort());
                        Object.keys(tempDivDistSet).forEach(k => processedDivDist[k] = Array.from(tempDivDistSet[k]).sort());
                        tempLegs = Array.from(tempLegsSet).sort();

                        setRegionDivMap(processedRegDiv);
                        setDivDistMap(processedDivDist);
                        setLegDistrictOptions(tempLegs);
                    }
                }
            } catch (err) {
                console.warn("⚠️ Offline Mode or CSV Error:", err);
            }

            // B. User Profile Load
            onAuthStateChanged(auth, async (user) => {
                if (!isMounted) return;

                if (!user) {
                    navigate('/'); // Redirect if not logged in
                    return;
                }

                let profileLoaded = false;

                // 1. MONITOR VIEW or NORMAL FLOW
                try {
                    const fetchUrl = viewOnly && monitorSchoolId
                        ? `/api/monitoring/school-detail/${monitorSchoolId}`
                        : `/api/school-by-user/${user.uid}`;

                    const response = await fetch(fetchUrl);
                    if (!response.ok) throw new Error("Network error");

                    const result = await response.json();

                    // Monitoring detail returns the flat row, normal fetch returns { exists, data }
                    const dbData = (viewOnly && monitorSchoolId) ? result : result.data;

                    if (dbData) {
                        const loadedData = mapDbToForm(dbData);
                        applyDataToState(loadedData, processedRegDiv, processedDivDist);
                        setLastUpdated(dbData.submitted_at);
                        setHasSavedData(true);
                        if (!viewOnly) saveToLocalCache(loadedData);
                        profileLoaded = true;
                    }
                } catch (error) {
                    console.log("⚠️ Fetch error:", error.message);
                }

                // 2. Offline Fallback
                if (!profileLoaded) {
                    const cachedProfile = localStorage.getItem('fullSchoolProfile');
                    if (cachedProfile) {
                        try {
                            const localData = JSON.parse(cachedProfile);

                            // Restore Offering from sticky note if missing
                            if (!localData.curricularOffering) {
                                localData.curricularOffering = localStorage.getItem('schoolOffering') || '';
                            }

                            console.log("✅ Loaded from Cache:", localData);
                            applyDataToState(localData, regionDivMap, divDistMap);
                            setHasSavedData(true);

                            // 👇 THIS FIXES THE "PENDING" ISSUE IN OFFLINE MODE
                            if (localData.schoolId) {
                                localStorage.setItem('schoolProfileStatus', 'complete');
                            }

                        } catch (parseErr) { console.error("Cache Parse Error:", parseErr); }
                    }
                }

                if (isMounted) setLoading(false);
            });
        };

        initialize();
        return () => { isMounted = false; };
    }, []);

    // --- OTHER HELPERS ---
    const formatTimestamp = (isoString) => {
        if (!isoString) return '';
        return new Date(isoString).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    };

    const getChanges = () => {
        if (!originalData) return [];
        const changes = [];
        Object.keys(formData).forEach(key => {
            if (formData[key] !== originalData[key]) {
                changes.push({ field: key, oldVal: originalData[key], newVal: formData[key] });
            }
        });
        return changes;
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) return alert("Geolocation not supported.");
        if (!confirm("Use device GPS?")) return;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormData(prev => ({ ...prev, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
                alert("Location updated!");
            },
            (err) => alert("GPS Error: " + err.message),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // --- AUTOFILL ---
    const handleIdBlur = async () => {
        const targetId = String(formData.schoolId).trim();
        if (targetId.length < 6) return;
        setLoading(true);

        if (navigator.onLine) {
            try {
                const response = await fetch(`/api/check-school/${targetId}`);
                if (response.ok) {
                    const res = await response.json();
                    if (res.exists) {
                        setShowRegisteredModal(true);
                        setFormData(prev => ({ ...prev, schoolId: '' }));
                        setLoading(false);
                        return;
                    }
                }
            } catch (e) { console.warn("DB Check skipped"); }
        }

        // CSV Local Lookup
        const clean = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        const idKey = Object.keys(schoolDirectory[0] || {}).find(k => clean(k) === 'schoolid');

        if (idKey) {
            const school = schoolDirectory.find(s => String(s[idKey]).trim().split('.')[0] === targetId);
            if (school) {
                const getVal = (target) => {
                    const k = Object.keys(school).find(key => clean(key).includes(clean(target)));
                    return k ? String(school[k]).trim() : '';
                };

                const findMatch = (options, value) => options.find(opt => clean(opt) === clean(value)) || value;

                const rawRegion = getVal('region');
                const matchedRegion = findMatch(Object.keys(locationData), rawRegion);

                const newDivisions = regionDivMap[matchedRegion] || [];
                setDivisionOptions(newDivisions);

                const matchedDiv = findMatch(newDivisions, getVal('division'));
                const newDistricts = divDistMap[matchedDiv] || [];
                setDistrictOptions(newDistricts);

                let provOpts = [], matchedProv = getVal('province');
                if (locationData[matchedRegion]) {
                    provOpts = Object.keys(locationData[matchedRegion]).sort();
                    matchedProv = findMatch(provOpts, matchedProv);
                }
                setProvinceOptions(provOpts);

                let cityOpts = [], matchedMun = getVal('municipality');
                if (locationData[matchedRegion]?.[matchedProv]) {
                    cityOpts = Object.keys(locationData[matchedRegion][matchedProv]).sort();
                    matchedMun = findMatch(cityOpts, matchedMun);
                }
                setCityOptions(cityOpts);

                let brgyOpts = [], matchedBrgy = getVal('barangay');
                if (locationData[matchedRegion]?.[matchedProv]?.[matchedMun]) {
                    brgyOpts = locationData[matchedRegion][matchedProv][matchedMun].sort();
                    matchedBrgy = findMatch(brgyOpts, matchedBrgy);
                }
                setBarangayOptions(brgyOpts);

                setFormData(prev => ({
                    ...prev,
                    schoolName: getVal('schoolname'),
                    region: matchedRegion, province: matchedProv, municipality: matchedMun, barangay: matchedBrgy,
                    division: matchedDiv, district: getVal('district'), legDistrict: getVal('legdistrict') || getVal('legislative'),
                    motherSchoolId: getVal('motherschool') || '', latitude: getVal('latitude'), longitude: getVal('longitude'),
                    curricularOffering: getVal('offering') || ''
                }));
                // Run validation on autofilled name
                checkSchoolName(getVal('schoolname'));
                checkSchoolName(getVal('schoolname'));
            } else {
                setShowErrorModal(true);
                setFormData(prev => ({ ...prev, schoolId: '' })); // Clear invalid ID
            }
        }
        setLoading(false);
    };

    const checkSchoolName = (name) => {
        // Expanded list of prohibited abbreviations and acronyms
        const prohibited = /\b(ES|CS|PS|HS|IS|NHS|SHS|JHS|CES|PE|MES|NES|Elem\.?|Sch\.?|Nat\.?|Nat'l|Agri\.?|Tech\.?|Voc\.?|Mem\.?)\b/i;

        if (prohibited.test(name)) {
            setSchoolNameWarning("Please input the WHOLE NAME (e.g. 'Elementary School', 'National High School') without abbreviations or acronyms as prescribed by DepEd Manual of Style.");
        } else {
            setSchoolNameWarning("");
        }
    };

    // --- FORM HANDLERS ---
    const handleChange = (e) => {
        const { name, value } = e.target;

        // Special Logic for Annex
        if (name === 'isAnnex') {
            setFormData(prev => ({
                ...prev,
                [name]: value,
                motherSchoolId: value === 'No' ? '' : prev.motherSchoolId
            }));
            return;
        }

        const val = name === 'schoolName' ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: val }));

        if (name === 'schoolName') {
            checkSchoolName(value);
        }
    };

    // Cascading Dropdowns
    const handleRegionChange = (e) => {
        const val = e.target.value;
        setDivisionOptions(regionDivMap[val] || []);
        setFormData(prev => ({ ...prev, region: val, province: '', municipality: '', barangay: '', division: '', district: '' }));
        setProvinceOptions(val && locationData[val] ? Object.keys(locationData[val]).sort() : []);
        setCityOptions([]); setBarangayOptions([]); setDistrictOptions([]);
    };

    const handleProvinceChange = (e) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, province: val, municipality: '', barangay: '' }));
        setCityOptions(val && formData.region ? Object.keys(locationData[formData.region][val]).sort() : []);
        setBarangayOptions([]);
    };

    const handleCityChange = (e) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, municipality: val, barangay: '' }));
        setBarangayOptions(val && formData.province ? locationData[formData.region][formData.province][val].sort() : []);
    };

    const handleDivisionChange = (e) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, division: val, district: '' }));
        setDistrictOptions(divDistMap[val] || []);
    };

    // --- SAVE ---
    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);
        const payload = { ...formData, submittedBy: auth.currentUser.uid };

        const finalize = (newIern) => {
            const updated = { ...formData };
            if (newIern) updated.iern = newIern;

            saveToLocalCache(updated);
            setLastUpdated(new Date().toISOString());
            setOriginalData({ ...updated });
            setFormData(updated);
            setHasSavedData(true);
        };

        if (!navigator.onLine) {
            try {
                await addToOutbox({
                    type: 'SCHOOL_PROFILE',
                    label: 'School Profile',
                    url: '/api/save-school',
                    payload: payload
                });
                setShowOfflineModal(true); // USE MODAL
                finalize();
            } catch (e) { console.error(e); alert("Offline save failed."); }
            finally { setIsSaving(false); }
            return;
        }

        console.log("SENDING SCHOOL PROFILE:", payload); // DEBUG LOG

        try {
            const response = await fetch('/api/save-school', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            if (response.ok) {
                const resData = await response.json();

                // Only show IERN Modal for NEW profiles
                if (resData.iern && !hasSavedData) {
                    setGeneratedIern(resData.iern);
                    setShowIernModal(true);
                    finalize(resData.iern);
                } else {
                    // For updates, just show success message
                    setSuccessMessage(hasSavedData ? 'Changes Saved Successfully!' : 'Profile Created Successfully!');
                    setShowSuccessModal(true); // USE MODAL
                    finalize(resData.iern); // Update IERN in state if returned, but silent
                    if (isFirstTime) navigate('/schoolhead-dashboard');
                }
            } else {
                const err = await response.json();
                alert('Error: ' + err.message);
            }
        } catch (e) { alert("Network Error."); }
        finally { setIsSaving(false); }
    };

    // LoadingScreen check removed

    const inputClass = `w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#004A99] dark:focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 font-semibold text-[14px] shadow-sm disabled:bg-gray-100 dark:disabled:bg-slate-900 disabled:text-gray-500 transition-all`;
    const labelClass = "block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1 ml-1";
    const sectionClass = "bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mb-6";

    return (
        <>
            <PageTransition>
                <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-32 relative">

                    {/* DUMMY MODE BANNER */}
                    {isDummy && (
                        <div className="bg-amber-100 border-b border-amber-200 px-6 py-3 sticky top-0 z-50 flex items-center justify-center gap-2 shadow-sm">
                            <span className="font-bold text-amber-800 text-sm uppercase tracking-wide">⚠️ Sample Mode: Read-Only Preview</span>
                        </div>
                    )}

                    {/* HEADER */}
                    <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        <div className="relative z-10 flex items-center gap-4">
                            {!isFirstTime && (
                                <button onClick={goBack} className="text-white/80 hover:text-white text-2xl transition">&larr;</button>
                            )}
                            <div>
                                <h1 className="text-2xl font-bold text-white">School Profile</h1>
                                <p className="text-blue-200 text-xs mt-1">
                                    {isFirstTime ? "Welcome! Please setup your profile." : (lastUpdated ? `Last Updated: ${formatTimestamp(lastUpdated)}` : 'Create your school profile')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* FORM */}
                    <div className="px-5 -mt-12 relative z-20">
                        {isOffline && (
                            <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 mb-4 rounded shadow-md relative z-30" role="alert">
                                <p className="font-bold">You are offline</p>
                                <p className="text-sm">School Profile is in read-only mode. Connect to the internet to make changes.</p>
                            </div>
                        )}

                        {formData.iern && (
                            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/50 mb-6 flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#004A99] rounded-xl flex items-center justify-center text-white font-bold">🆔</div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">InsightEd ID (IERN)</p>
                                        <p className="text-lg font-black text-[#004A99] dark:text-blue-400 tracking-tighter">{formData.iern}</p>
                                    </div>
                                </div>
                                <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    Active
                                </div>
                            </div>
                        )}
                        <form onSubmit={(e) => { e.preventDefault(); setAck1(false); setAck2(false); setShowSaveModal(true); }}>
                            <fieldset disabled={isOffline || viewOnly || isLocked || isDummy} className="disabled:opacity-95">

                                {/* 1. IDENTITY */}
                                <div className={sectionClass}>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2"><span className="text-xl">🏫</span> Identity</h2>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className={labelClass}>School ID (6-Digit)</label>
                                            <div className="flex gap-2">
                                                <input type="text" name="schoolId" value={formData.schoolId} onChange={handleChange} onBlur={handleIdBlur} placeholder="100001" maxLength="6" className={`${inputClass} text-center text-xl tracking-widest font-bold ${hasSavedData ? 'bg-gray-200 cursor-not-allowed' : ''}`} required disabled={hasSavedData || isDummy} />
                                                <button type="button" onClick={handleIdBlur} disabled={hasSavedData || isDummy} className="bg-blue-600 text-white px-4 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm">
                                                    Validate
                                                </button>
                                            </div>
                                            {hasSavedData && <p className="text-[10px] text-gray-400 mt-1 text-center">Permanently linked.</p>}
                                        </div>
                                        <div>
                                            <label className={labelClass}>School Name</label>
                                            <input type="text" name="schoolName" value={formData.schoolName} onChange={handleChange} className={`${inputClass} ${schoolNameWarning ? 'border-amber-400 focus:ring-amber-400' : ''}`} style={{ textTransform: 'uppercase' }} required disabled={isDummy} />
                                            {schoolNameWarning && (
                                                <p className="text-xs text-amber-600 font-bold mt-1 flex items-center gap-1 animate-pulse">
                                                    <span>⚠️</span> {schoolNameWarning}
                                                </p>
                                            )}
                                        </div>

                                        {/* ANNEX SCHOOL TOGGLE */}
                                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Is this an Annex School?</label>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="isAnnex"
                                                        value="Yes"
                                                        checked={formData.isAnnex === 'Yes'}
                                                        onChange={handleChange}
                                                        disabled={isDummy}
                                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm font-bold text-slate-700">Yes</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="isAnnex"
                                                        value="No"
                                                        checked={formData.isAnnex === 'No'}
                                                        onChange={handleChange}
                                                        disabled={isDummy}
                                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm font-bold text-slate-700">No</span>
                                                </label>
                                            </div>
                                        </div>

                                        {formData.isAnnex === 'Yes' && (
                                            <div className="animate-in fade-in slide-in-from-top-2">
                                                <label className={labelClass}>Mother School ID <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    name="motherSchoolId"
                                                    value={formData.motherSchoolId}
                                                    onChange={handleChange}
                                                    className={inputClass}
                                                    placeholder="Enter Mother School ID"
                                                    required
                                                    disabled={isDummy}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 2. CLASSIFICATION */}
                                <div className={sectionClass}>
                                    <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2"><span className="text-xl">📊</span> Classification</h2>
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                                        <p className="text-xs text-blue-800 italic">This setting determines which fields appear in other Forms.</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Curricular Offering</label>
                                        {isOffline ? (
                                            <input type="text" value={formData.curricularOffering} className={inputClass} disabled />
                                        ) : (
                                            <select name="curricularOffering" value={formData.curricularOffering} onChange={handleChange} className={inputClass} required disabled={isDummy}>
                                                <option value="">-- Select Offering --</option>
                                                <option>Purely Elementary</option>
                                                <option>Elementary School and Junior High School (K-10)</option>
                                                <option>All Offering (K-12)</option>
                                                <option>Junior and Senior High</option>
                                                <option>Purely Junior High School</option>
                                                <option>Purely Senior High School</option>
                                            </select>
                                        )}
                                    </div>
                                </div>

                                {/* 3. LOCATION */}
                                <div className={sectionClass}>
                                    <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2 mb-4"><span className="text-xl">📍</span> Location</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Region</label>{isOffline ? <input type="text" value={formData.region} className={inputClass} disabled /> : <select name="region" value={formData.region} onChange={handleRegionChange} className={inputClass} required disabled={isDummy}><option value="">Select Region</option>{Object.keys(locationData).sort().map(r => <option key={r} value={r}>{r}</option>)}</select>}</div>
                                        <div><label className={labelClass}>Province</label>{isOffline ? <input type="text" value={formData.province} className={inputClass} disabled /> : <select name="province" value={formData.province} onChange={handleProvinceChange} className={inputClass} disabled={!formData.region || isDummy} required><option value="">Select Province</option>{provinceOptions.map(p => <option key={p} value={p}>{p}</option>)}</select>}</div>
                                        <div><label className={labelClass}>Municipality</label>{isOffline ? <input type="text" value={formData.municipality} className={inputClass} disabled /> : <select name="municipality" value={formData.municipality} onChange={handleCityChange} className={inputClass} disabled={!formData.province || isDummy} required><option value="">Select City/Mun</option>{cityOptions.map(c => <option key={c} value={c}>{c}</option>)}</select>}</div>
                                        <div><label className={labelClass}>Barangay</label>{isOffline ? <input type="text" value={formData.barangay} className={inputClass} disabled /> : <select name="barangay" value={formData.barangay} onChange={handleChange} className={inputClass} disabled={!formData.municipality || isDummy} required><option value="">Select Barangay</option>{barangayOptions.map(b => <option key={b} value={b}>{b}</option>)}</select>}</div>
                                    </div>
                                </div>

                                {/* 4. HIERARCHY */}
                                <div className={sectionClass}>
                                    <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2 mb-4"><span className="text-xl">🏛️</span> Administration</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Division</label>{isOffline ? <input type="text" value={formData.division} className={inputClass} disabled /> : <select name="division" value={formData.division} onChange={handleDivisionChange} className={inputClass} disabled={!formData.region || isDummy} required><option value="">Select Division</option>{divisionOptions.map(d => <option key={d} value={d}>{d}</option>)}</select>}</div>
                                        <div><label className={labelClass}>District</label>{isOffline ? <input type="text" value={formData.district} className={inputClass} disabled /> : <select name="district" value={formData.district} onChange={handleChange} className={inputClass} disabled={!formData.division || isDummy} required><option value="">Select District</option>{districtOptions.map(d => <option key={d} value={d}>{d}</option>)}</select>}</div>
                                        <div className="md:col-span-2"><label className={labelClass}>Legislative District</label>{isOffline ? <input type="text" value={formData.legDistrict} className={inputClass} disabled /> : <select name="legDistrict" value={formData.legDistrict} onChange={handleChange} className={inputClass} required disabled={isDummy}><option value="">Select District</option>{legDistrictOptions.map(l => <option key={l} value={l}>{l}</option>)}</select>}</div>
                                    </div>
                                </div>

                                {/* 5. COORDINATES */}
                                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-6">
                                    <div className="mb-4">
                                        <h2 className="text-blue-800 font-bold text-sm uppercase tracking-wide mb-2">🌐 Geo-Tagging</h2>
                                        <p className="text-xs text-blue-600 mb-4">Drag the pin to set your school's exact location.</p>

                                        {/* INTERACTIVE MAP */}
                                        <LocationPickerMap
                                            latitude={formData.latitude}
                                            longitude={formData.longitude}
                                            onLocationSelect={(lat, lng) => setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }))}
                                            disabled={isDummy || viewOnly || isLocked || isOffline}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div>
                                            <label className={labelClass}>Latitude</label>
                                            <input type="text" name="latitude" value={formData.latitude} onChange={handleChange} className={inputClass} placeholder="14.5995" disabled={viewOnly || isDummy} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Longitude</label>
                                            <input type="text" name="longitude" value={formData.longitude} onChange={handleChange} className={inputClass} placeholder="120.9842" disabled={viewOnly || isDummy} />
                                        </div>
                                    </div>
                                    {formData.latitude && formData.longitude && (
                                        <div className="mt-4 flex gap-2 justify-end">
                                            <a href={`geo:${formData.latitude},${formData.longitude}?q=${formData.latitude},${formData.longitude}`} className={`flex items-center gap-2 text-[#004A99] hover:text-white hover:bg-[#004A99] text-xs font-bold bg-white px-3 py-2 rounded-lg border border-blue-100 shadow-sm transition-all no-underline ${isDummy ? 'pointer-events-none opacity-50' : ''}`}><span>📱</span> Open App</a>
                                        </div>
                                    )}
                                </div>
                            </fieldset>

                            {!viewOnly && !isDummy && (
                                <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 pb-8 z-50 flex gap-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                                    {isOffline ? (
                                        <button type="button" disabled className="w-full bg-gray-400 text-white font-bold py-4 rounded-xl shadow-none cursor-not-allowed flex items-center justify-center gap-2">
                                            <span>📵</span> Offline - Read Only
                                        </button>
                                    ) : isLocked ? (
                                        <button type="button" onClick={() => setShowEditModal(true)} className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-amber-600 flex items-center justify-center gap-2" disabled={isDummy}>
                                            <span>✏️</span> Unlock to Edit
                                        </button>
                                    ) : (
                                        <>
                                            {hasSavedData && <button type="button" onClick={() => { setFormData(originalData); setIsLocked(true); }} className="flex-1 bg-gray-100 text-gray-600 font-bold py-4 rounded-xl hover:bg-gray-200">Cancel</button>}
                                            <button type="submit" disabled={isSaving || isDummy} className={`flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-[#A30000] flex items-center justify-center gap-2 ${isSaving || isDummy ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                                {isSaving ? "Saving..." : (hasSavedData ? "Update Changes" : "Save Profile")}
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {(viewOnly || isDummy) && (
                                <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 pb-8 z-50 flex gap-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                                    <button
                                        type="button"
                                        onClick={() => navigate(-1)}
                                        className="w-full bg-[#004A99] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-800 active:scale-[0.98] transition flex items-center justify-center gap-2"
                                    >
                                        ← Back
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>

                        {(viewOnly || isDummy) && (
                            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 pb-8 z-50 flex gap-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                                <button
                                    type="button"
                                    onClick={() => navigate('/jurisdiction-schools')}
                                    className="w-full bg-[#004A99] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-800 active:scale-[0.98] transition flex items-center justify-center gap-2"
                                >
                                    ← Back to School List
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </PageTransition >

            {/* MODALS - MOVED OUTSIDE TRANSITION TO FIX FIXED POSITIONING */}
            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message={successMessage} />

            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
                        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4"><span className="text-2xl">⚠️</span></div>
                        <h3 className="font-bold text-lg">Edit Profile?</h3>
                        <p className="text-sm text-gray-500 mt-2 mb-6">Editing identifying information (School ID, Name) requires re-validation.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-600">Cancel</button>
                            <button onClick={() => { setIsLocked(false); setShowEditModal(false); }} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold shadow-md hover:bg-amber-600">Unlock</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ERROR MODAL */}
            {showErrorModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">🚫</span>
                        </div>
                        <h3 className="font-bold text-xl text-gray-900 mb-2">School ID Not Found</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            We could not find this ID in our directory. Please contact the <b>Planning Officer</b> to verify your School ID.
                        </p>
                        <button
                            onClick={handleUpdateClick}
                            className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                        >
                            <span>✏️</span> UNLOCK EDIT
                        </button>
                    </div>
                </div>
            )}

            {/* REGISTERED MODAL */}
            {showRegisteredModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">ℹ️</span>
                        </div>
                        <h3 className="font-bold text-xl text-gray-900 mb-2">School Already Registered</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            This School ID is already registered in our system. You cannot create a duplicate profile.
                        </p>
                        <button
                            onClick={() => setShowRegisteredModal(false)}
                            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-[0.98] transition"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* IERN MODAL */}
            {showIernModal && (
                <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-6 backdrop-blur-sm animate-in zoom-in-95 duration-300">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] w-full max-w-sm text-center shadow-2xl border border-blue-100 dark:border-slate-700">
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">🆔</span>
                        </div>
                        <h3 className="font-black text-2xl text-blue-900 dark:text-blue-100 mb-2">InsightEd ID (IERN)</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 px-4">
                            This is your unique <b>Control Number</b>. Please keep this as your login or unique identifier for the system.
                        </p>

                        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-800 mb-8 select-all">
                            <span className="text-3xl font-black text-[#004A99] dark:text-blue-400 tracking-tighter">
                                {generatedIern}
                            </span>
                        </div>

                        <button
                            onClick={() => {
                                setShowIernModal(false);
                                if (isFirstTime) navigate('/schoolhead-dashboard');
                            }}
                            className="w-full py-4 bg-[#004A99] text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 hover:bg-blue-900 active:scale-[0.98] transition-all uppercase tracking-widest text-xs"
                        >
                            Got it, I'll Save it
                        </button>
                    </div>
                </div>
            )}

            {/* SAVE MODAL */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
                        <h3 className="font-bold text-lg">{hasSavedData ? "Review Changes" : "Confirm Submission"}</h3>
                        {hasSavedData && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 my-4 text-xs max-h-32 overflow-y-auto">
                                {getChanges().length > 0 ? getChanges().map((c, i) => (
                                    <div key={i} className="flex justify-between border-b pb-1 mb-1 last:border-0"><span className="font-bold text-gray-500">{c.field}</span><span className="text-gray-800">{c.newVal}</span></div>
                                )) : <p className="text-gray-400 italic">No changes detected.</p>}
                            </div>
                        )}
                        {!hasSavedData && (
                            <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                                <label className="flex items-start gap-3 cursor-pointer group select-none"><input type="checkbox" checked={ack1} onChange={(e) => setAck1(e.target.checked)} className="mt-0.5 w-4 h-4 text-blue-600 rounded focus:ring-blue-600 cursor-pointer" /><span className="text-[11px] font-medium text-gray-700 group-hover:text-gray-900 leading-tight">I confirm that I am the <b>SCHOOL HEAD</b> and that all information I provide is TRUE and ACCURATE.</span></label>
                                <label className="flex items-start gap-3 cursor-pointer group select-none"><input type="checkbox" checked={ack2} onChange={(e) => setAck2(e.target.checked)} className="mt-0.5 w-4 h-4 text-blue-600 rounded focus:ring-blue-600 cursor-pointer" /><span className="text-[11px] font-medium text-gray-700 group-hover:text-gray-900 leading-tight">I acknowledge that I have read and understood the information above.</span></label>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-600">Cancel</button>
                            <button onClick={confirmSave} disabled={!hasSavedData && (!ack1 || !ack2)} className={`flex-1 py-3 text-white rounded-xl font-bold transition-all shadow-md ${(!hasSavedData && (!ack1 || !ack2)) ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-[#CC0000] hover:bg-[#A30000]'}`}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SchoolProfile;