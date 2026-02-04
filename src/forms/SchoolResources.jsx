// src/forms/SchoolResources.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiPackage, FiMapPin, FiLayout, FiCheckCircle, FiXCircle, FiMonitor, FiTool, FiDroplet, FiZap, FiHelpCircle, FiInfo, FiSave } from 'react-icons/fi';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
// LoadingScreen import removed
import { addToOutbox, getOutbox } from '../db';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';



// --- EXTRACTED COMPONENTS ---
const InputField = ({ label, name, type = "number", formData, handleChange, isLocked, viewOnly }) => (
    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 group hover:border-blue-100 transition-colors">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider w-2/3 group-hover:text-blue-600 transition-colors">{label}</label>
        <input
            type="text" inputMode="numeric" pattern="[0-9]*" name={name} value={formData[name] ?? 0}
            onChange={handleChange} disabled={isLocked || viewOnly}
            className="w-24 text-center font-bold text-blue-900 bg-white border border-slate-200 rounded-xl py-2.5 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-transparent disabled:border-transparent text-lg shadow-sm"
            onFocus={() => formData[name] === 0 && handleChange({ target: { name, value: '' } })}
            onBlur={() => (formData[name] === '' || formData[name] === null) && handleChange({ target: { name, value: 0 } })}
        />
    </div>
);

const SelectField = ({ label, name, options, formData, handleChange, isLocked, viewOnly }) => (
    <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 group hover:border-blue-100 transition-colors">
        {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">{label}</label>}
        <select
            name={name} value={formData[name] || ''} onChange={handleChange} disabled={isLocked || viewOnly}
            className="w-full font-bold text-slate-900 bg-white border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-800 disabled:border-transparent shadow-sm text-sm"
        >
            <option value="" disabled hidden>-- Select --</option>
            {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
    </div>
);

const SeatRow = ({ label, enrollment, seatKey, formData, handleChange, isLocked, viewOnly }) => {
    const seats = formData[seatKey] || 0;
    const shortage = enrollment - seats;
    const isShortage = shortage > 0;

    return (
        <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
            <td className="py-4 px-4 text-xs font-bold text-slate-600 group-hover:text-blue-600 transition-colors">{label}</td>
            <td className="py-4 px-4 text-center">
                <span className="bg-blue-50 text-blue-700 text-[10px] px-2.5 py-1 rounded-lg font-bold">
                    {enrollment}
                </span>
            </td>
            <td className="py-4 px-4">
                <div className="flex justify-center flex-col items-center">
                    <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Total (All Sections)</p>
                    <input
                        type="text" inputMode="numeric" pattern="[0-9]*"
                        name={seatKey}
                        onChange={handleChange}
                        disabled={isLocked || viewOnly}
                        className="w-20 text-center font-bold text-slate-900 bg-white border border-slate-200 rounded-lg py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-transparent disabled:border-transparent shadow-sm"
                        value={seats ?? 0}
                        onFocus={() => seats === 0 && handleChange({ target: { name: seatKey, value: '' } })}
                        onBlur={() => (seats === '' || seats === null) && handleChange({ target: { name: seatKey, value: 0 } })}
                    />
                </div>
            </td>
            <td className="py-4 px-4 text-center">
                {isShortage ? (
                    <span className="text-red-600 bg-red-50 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border border-red-100 inline-flex items-center gap-1">
                        <FiXCircle className="inline" /> -{shortage}
                    </span>
                ) : (
                    <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-emerald-100 inline-flex items-center gap-1">
                        <FiCheckCircle className="inline" /> OK
                    </span>
                )}
            </td>
        </tr>
    );
};

const ResourceAuditRow = ({ label, funcName, nonFuncName, formData, handleChange, isLocked, viewOnly }) => (
    <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
        <td className="py-4 px-4 text-xs font-bold text-slate-600 uppercase tracking-wide group-hover:text-blue-600 transition-colors">{label}</td>
        <td className="py-3 px-2">
            <div className="relative">
                <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Total Count</p>
                <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    name={funcName}
                    value={formData[funcName] ?? 0}
                    onChange={handleChange}
                    disabled={isLocked || viewOnly}
                    className="w-full text-center font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-transparent disabled:border-transparent"
                    onFocus={() => formData[funcName] === 0 && handleChange({ target: { name: funcName, value: '' } })}
                    onBlur={() => (formData[funcName] === '' || formData[funcName] === null) && handleChange({ target: { name: funcName, value: 0 } })}
                />
            </div>
        </td>
        <td className="py-3 px-2">
            <div className="relative">
                <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Total Count</p>
                <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    name={nonFuncName}
                    value={formData[nonFuncName] ?? 0}
                    onChange={handleChange}
                    disabled={isLocked || viewOnly}
                    className="w-full text-center font-bold text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none disabled:bg-transparent disabled:border-transparent"
                    onFocus={() => formData[nonFuncName] === 0 && handleChange({ target: { name: nonFuncName, value: '' } })}
                    onBlur={() => (formData[nonFuncName] === '' || formData[nonFuncName] === null) && handleChange({ target: { name: nonFuncName, value: 0 } })}
                />
            </div>
        </td>
    </tr>
);

const LabRow = ({ label, name, formData, handleChange, isLocked, viewOnly }) => (
    <div className="flex justify-between items-center p-4 border-b border-slate-50 last:border-0 bg-slate-50/50 rounded-2xl mb-2 hover:bg-white hover:shadow-sm hover:border-slate-100 transition-all">
        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">{label}</label>
        <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            name={name}
            value={formData[name] ?? 0}
            onChange={handleChange}
            disabled={isLocked || viewOnly}
            className="w-20 text-center font-bold text-blue-900 bg-white border border-slate-200 rounded-xl py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-transparent shadow-sm"
            onFocus={() => formData[name] === 0 && handleChange({ target: { name, value: '' } })}
            onBlur={() => (formData[name] === '' || formData[name] === null) && handleChange({ target: { name, value: 0 } })}
        />
    </div>
);

const SchoolResources = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');
    const isDummy = location.state?.isDummy || false;
    const [isReadOnly, setIsReadOnly] = useState(isDummy);

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);


    // --- AUTO-SHOW INFO MODAL ---
    useEffect(() => {
        const hasSeenInfo = localStorage.getItem('hasSeenResourcesInfo');
        if (!hasSeenInfo) {
            setShowInfoModal(true);
            localStorage.setItem('hasSeenResourcesInfo', 'true');
        }
    }, []);

    // --- SAVE TIMER EFFECTS ---

    const [userRole, setUserRole] = useState("School Head");
    const [crType, setCrType] = useState('Segmented'); // 'Segmented' or 'Shared'

    const [schoolId, setSchoolId] = useState(null);
    const [formData, setFormData] = useState({});
    // const isDummy = location.state?.isDummy || false; // Moved up
    const [originalData, setOriginalData] = useState(null);

    const goBack = () => {
        if (isDummy) {
            navigate(-1);
        } else {
            navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');
        }
    };

    // --- NEON SCHEMA MAPPING ---
    const initialFields = {
        res_internet_type: '',
        res_toilets_male: 0,
        res_toilets_female: 0,
        res_toilets_common: 0, // [NEW] Common CR
        res_toilets_pwd: 0,
        res_water_source: '',
        res_tvl_workshops: 0,
        res_faucets: 0,
        res_electricity_source: '',
        res_buildable_space: '',
        sha_category: '', // [NEW] SHA Category

        // LABS
        res_sci_labs: 0, res_com_labs: 0,

        // FUNCTIONAL / NON-FUNCTIONAL
        res_ecart_func: 0, res_ecart_nonfunc: 0,
        res_laptop_func: 0, res_laptop_nonfunc: 0,
        res_tv_func: 0, res_tv_nonfunc: 0,
        res_printer_func: 0, res_printer_nonfunc: 0,
        res_desk_func: 0, res_desk_nonfunc: 0,
        res_armchair_func: 0, res_armchair_nonfunc: 0,
        res_toilet_func: 0, res_toilet_nonfunc: 0,
        res_handwash_func: 0, res_handwash_nonfunc: 0,

        // SEATS
        seats_kinder: 0, seats_grade_1: 0, seats_grade_2: 0, seats_grade_3: 0,
        seats_grade_4: 0, seats_grade_5: 0, seats_grade_6: 0,
        seats_grade_7: 0, seats_grade_8: 0, seats_grade_9: 0, seats_grade_10: 0,
        seats_grade_11: 0, seats_grade_12: 0
    };

    // --- FETCH DATA (Strict Sync Cache Strategy) ---
    const [enrollmentData, setEnrollmentData] = useState({});
    const [curricularOffering, setCurricularOffering] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // DEFAULT STATE
                const defaultFormData = initialFields;

                // Check Role for Read-Only and Fetch Logic
                let isCORole = false;
                try {
                    const role = localStorage.getItem('userRole');
                    if (role === 'Central Office' || isDummy) {
                        setIsReadOnly(true);
                        isCORole = (role === 'Central Office');
                    }
                } catch (e) { }

                // Sync Cache Loading
                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');
                if (storedSchoolId) setSchoolId(storedSchoolId);
                if (storedOffering) setCurricularOffering(storedOffering);

                // Load Profile Cache (Enrollment) - Critical for calculations
                const cachedProfile = localStorage.getItem('fullSchoolProfile');
                if (cachedProfile) {
                    try {
                        const pData = JSON.parse(cachedProfile);
                        // Offering from profile has precedence if valid
                        if (pData.curricular_offering) setCurricularOffering(pData.curricular_offering);

                        // Map Enrollment using cached data
                        setEnrollmentData({
                            gradeKinder: pData.grade_kinder || pData.kinder || 0,
                            grade1: pData.grade_1 || 0, grade2: pData.grade_2 || 0,
                            grade3: pData.grade_3 || 0, grade4: pData.grade_4 || 0,
                            grade5: pData.grade_5 || 0, grade6: pData.grade_6 || 0,
                            grade7: pData.grade_7 || 0, grade8: pData.grade_8 || 0,
                            grade9: pData.grade_9 || 0, grade10: pData.grade_10 || 0,
                            grade11: (pData.abm_11 + pData.stem_11 + pData.humss_11 + pData.gas_11 + pData.tvl_ict_11 + pData.tvl_he_11 + pData.tvl_ia_11 + pData.tvl_afa_11 + pData.arts_11 + pData.sports_11) || 0,
                            grade12: (pData.abm_12 + pData.stem_12 + pData.humss_12 + pData.gas_12 + pData.tvl_ict_12 + pData.tvl_he_12 + pData.tvl_ia_12 + pData.tvl_afa_12 + pData.arts_12 + pData.sports_12) || 0
                        });
                    } catch (e) { console.error("Profile cache error", e); }
                }

                // Load Resources Cache (Main Form)
                let loadedFromCache = false;
                const CACHE_KEY_RES = `CACHE_RESOURCES_${user.uid}`;
                const cachedRes = localStorage.getItem(CACHE_KEY_RES);

                if (cachedRes) {
                    try {
                        const parsed = JSON.parse(cachedRes);
                        setFormData({ ...defaultFormData, ...parsed });
                        setOriginalData({ ...defaultFormData, ...parsed });

                        const hasCachedData = Object.keys(initialFields).some(k => parsed[k]);
                        setIsLocked(hasCachedData);
                        setLoading(false); // CRITICAL: Instant Load
                        loadedFromCache = true;
                        console.log("Loaded cached Resources (Instant Load)");
                    } catch (e) { console.error("Resources cache error", e); }
                }

                try {
                    // 2. CHECK OUTBOX
                    let restored = false;
                    if (!viewOnly) {
                        try {
                            const drafts = await getOutbox();
                            const draft = drafts.find(d => d.type === 'SCHOOL_RESOURCES');
                            if (draft) {
                                console.log("Restored draft from Outbox");
                                setFormData({ ...defaultFormData, ...draft.payload });
                                setIsLocked(false);
                                restored = true;
                                setLoading(false);
                                return; // EXIT EARLY
                            }
                        } catch (e) { console.error("Outbox check failed:", e); }
                    }

                    // 3. BACKGROUND FETCHES
                    if (!restored) {
                        let profileFetchUrl = `/api/school-by-user/${user.uid}`;
                        let resourcesFetchUrl = `/api/school-resources/${user.uid}`;
                        if ((viewOnly || isCORole) && schoolIdParam) {
                            profileFetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                            resourcesFetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                        }

                        // Only show loading if we didn't load from cache
                        if (!loadedFromCache) setLoading(true);

                        // Fetch All in Parallel
                        const [userDoc, profileRes, resourcesRes] = await Promise.all([
                            getDoc(doc(db, "users", user.uid)).catch(() => ({ exists: () => false })),
                            fetch(profileFetchUrl).then(r => r.json()).catch(e => ({ exists: false })),
                            fetch(resourcesFetchUrl).then(r => r.json()).catch(e => ({ exists: false }))
                        ]);

                        // Handle Role
                        if (userDoc.exists()) setUserRole(userDoc.data().role);

                        // Handle Profile (Enrollment updates)
                        if (profileRes.exists || (viewOnly && schoolIdParam)) {
                            const pData = (viewOnly && schoolIdParam) ? profileRes : profileRes.data;
                            setSchoolId(pData.school_id || pData.schoolId);
                            setCurricularOffering(pData.curricular_offering || pData.curricularOffering || storedOffering || '');

                            const newEnrollment = {
                                gradeKinder: pData.grade_kinder || pData.kinder || 0,
                                grade1: pData.grade_1 || 0, grade2: pData.grade_2 || 0,
                                grade3: pData.grade_3 || 0, grade4: pData.grade_4 || 0,
                                grade5: pData.grade_5 || 0, grade6: pData.grade_6 || 0,
                                grade7: pData.grade_7 || 0, grade8: pData.grade_8 || 0,
                                grade9: pData.grade_9 || 0, grade10: pData.grade_10 || 0,
                                grade11: (pData.abm_11 + pData.stem_11 + pData.humss_11 + pData.gas_11 + pData.tvl_ict_11 + pData.tvl_he_11 + pData.tvl_ia_11 + pData.tvl_afa_11 + pData.arts_11 + pData.sports_11) || 0,
                                grade12: (pData.abm_12 + pData.stem_12 + pData.humss_12 + pData.gas_12 + pData.tvl_ict_12 + pData.tvl_he_12 + pData.tvl_ia_12 + pData.tvl_afa_12 + pData.arts_12 + pData.sports_12) || 0
                            };
                            setEnrollmentData(newEnrollment);

                            if (!viewOnly && pData.school_id) {
                                localStorage.setItem('schoolId', pData.school_id);
                            }
                        }

                        // Handle Resources
                        if (resourcesRes.exists || (viewOnly && schoolIdParam)) {
                            const dbData = (viewOnly && schoolIdParam) ? resourcesRes : resourcesRes.data;

                            // Map to State
                            const loaded = {};
                            Object.keys(defaultFormData).forEach(key => {
                                loaded[key] = dbData[key] ?? (typeof defaultFormData[key] === 'string' ? '' : 0);
                            });

                            setFormData(loaded);
                            setOriginalData(loaded);

                            const hasOnlineData = Object.keys(initialFields).some(k => loaded[k]);
                            setIsLocked(hasOnlineData);

                            // Update Cache
                            localStorage.setItem(CACHE_KEY_RES, JSON.stringify(loaded));
                        }
                    }

                } catch (error) {
                    console.error("Fetch Error:", error);
                    if (!loadedFromCache) {
                        const CACHE_KEY_RES = `CACHE_RESOURCES_${user.uid}`;
                        const cached = localStorage.getItem(CACHE_KEY_RES);
                        if (cached) {
                            try {
                                const data = JSON.parse(cached);
                                setFormData(data);
                                setOriginalData(data);
                                const hasOfflineData = Object.keys(initialFields).some(k => data[k]);
                                setIsLocked(hasOfflineData);
                            } catch (e) { }
                        }
                    }
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);


    const handleChange = (e) => {
        const { name, value, type } = e.target;

        // Check if one of the known non-numeric fields
        const isStringField = ['res_internet_type', 'res_water_source', 'res_electricity_source', 'res_ownership_type', 'res_buildable_space', 'sha_category'].includes(name);

        if (isStringField) {
            setFormData(prev => ({ ...prev, [name]: value }));
            return;
        }

        // 1. Strip non-numeric characters
        const cleanValue = value.replace(/[^0-9]/g, '');
        // 2. Parse integer to remove leading zeros (or default to 0 if empty)
        // 2. Parse integer to remove leading zeros (or default to 0 if empty)
        // Allow empty string '' temporarily, otherwise parse Int
        const intValue = cleanValue === '' ? '' : parseInt(cleanValue, 10);

        setFormData(prev => ({ ...prev, [name]: intValue }));
    };

    useEffect(() => {
        // Debugging: Log formData to check if res_buildable_space is populated
        console.log("FormData Snapshot:", formData);
    }, [formData]);

    // --- SAVE LOGIC ---
    // --- VALIDATION ---
    const isFormValid = () => {
        const isValidEntry = (value) => value !== '' && value !== null && value !== undefined;
        // 1. Check Generic Inputs (Labs + Dropdowns)
        const genericFields = [
            // Labs (Numeric)
            'res_sci_labs', 'res_com_labs', 'res_tvl_workshops',
            // Dropdowns (Strict Check)
            'res_water_source', 'res_electricity_source', 'res_buildable_space', 'sha_category'
        ];

        for (const f of genericFields) {
            // Strict check: must not be empty string (for dropdowns) or null/undefined
            if (!isValidEntry(formData[f])) return false;
        }

        // 2. Check Toilets (Removed legacy validation)

        // 3. Check Seats (Conditional)
        if (showElem()) {
            if (!isValidEntry(formData.seats_kinder) || !isValidEntry(formData.seats_grade_1) || !isValidEntry(formData.seats_grade_2) ||
                !isValidEntry(formData.seats_grade_3) || !isValidEntry(formData.seats_grade_4) || !isValidEntry(formData.seats_grade_5) ||
                !isValidEntry(formData.seats_grade_6)) return false;
        }
        if (showJHS()) {
            if (!isValidEntry(formData.seats_grade_7) || !isValidEntry(formData.seats_grade_8) || !isValidEntry(formData.seats_grade_9) ||
                !isValidEntry(formData.seats_grade_10)) return false;
        }
        if (showSHS()) {
            if (!isValidEntry(formData.seats_grade_11) || !isValidEntry(formData.seats_grade_12)) return false;
        }

        return true;
    };

    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);

        const rawPayload = {
            schoolId: schoolId || localStorage.getItem('schoolId'),
            uid: auth.currentUser.uid,
            ...formData
        };

        // Sanitize Payload: Convert empty strings to 0 for numeric fields
        // Define fields that are ALLOWED to be strings (nullable in DB or handled by valueOrNull)
        const stringFields = [
            'res_internet_type', 'res_water_source', 'res_electricity_source',
            'res_ownership_type', 'res_buildable_space', 'sha_category',
            'schoolId', 'uid'
        ];

        const payload = {};
        Object.keys(rawPayload).forEach(key => {
            if (stringFields.includes(key)) {
                payload[key] = rawPayload[key];
            } else {
                // Numeric fields: Convert '' -> 0
                const val = rawPayload[key];
                payload[key] = (val === '' || val === null || val === undefined) ? 0 : val;
            }
        });

        if (!payload.schoolId) {
            alert("Error: School ID is missing. Please ensure your profile is loaded.");
            setIsSaving(false);
            return;
        }

        if (!navigator.onLine) {
            await handleOffline(payload);
            return;
        }

        try {
            const res = await fetch('/api/save-school-resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setShowSuccessModal(true);
                setOriginalData({ ...formData });
                setIsLocked(true);
            } else {
                const errorData = await res.json();
                alert(`Server Error: ${errorData.error || errorData.message || "Update failed"}`);
                // Do not fallback to offline for server logic errors
            }
        } catch (e) {
            console.error(e);
            // Only fallback to offline for network errors
            await handleOffline(payload);
        } finally {
            setIsSaving(false);
        }
    };

    const handleOffline = async (payload) => {
        await addToOutbox({
            type: 'SCHOOL_RESOURCES',
            label: 'School Resources',
            url: '/api/save-school-resources',
            payload: payload
        });
        setShowOfflineModal(true);
        setOriginalData({ ...formData });
        setIsLocked(true);
        setIsSaving(false);
    };

    // --- COMPONENTS EXTRACTED ABOVE ---

    // VISIBILITY Helpers
    const showElem = () => !curricularOffering || curricularOffering.includes("Elementary") || curricularOffering.includes("K-12") || curricularOffering.includes("K-10");
    const showJHS = () => !curricularOffering || curricularOffering.includes("Junior") || curricularOffering.includes("K-12") || curricularOffering.includes("K-10");
    const showSHS = () => !curricularOffering || curricularOffering.includes("Senior") || curricularOffering.includes("K-12");

    // LoadingScreen check removed

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-32 relative">
            {/* Header */}
            <div className="bg-[#004A99] px-6 pt-10 pb-20 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                            <FiArrowLeft size={24} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-white tracking-tight">School Resources</h1>
                            </div>
                            <p className="text-blue-100 text-xs font-medium mt-1">
                                Q: What is the current inventory status of school facilities, equipment, and utilities?
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setShowInfoModal(true)} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                        <FiHelpCircle size={24} />
                    </button>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-4xl mx-auto space-y-6">

                {/* EQUIPMENT & INVENTORY */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <FiPackage size={20} />
                        </div>
                        <div>
                            <h2 className="text-slate-800 font-bold text-lg">Equipment & Inventory</h2>
                            <p className="text-xs text-slate-400 font-medium">Assets status audit</p>
                        </div>
                    </div>

                    {/* Functional / Non-Functional Table */}
                    <div className="overflow-hidden rounded-2xl border border-slate-100 mb-6 shadow-sm">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="py-4 px-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-1/3">Item</th>
                                    <th className="py-4 px-2 text-center text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Functional</th>
                                    <th className="py-4 px-2 text-center text-[10px] font-bold text-rose-500 uppercase tracking-wider">Non-Functional</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 bg-white">
                                <ResourceAuditRow label="E-Cart" funcName="res_ecart_func" nonFuncName="res_ecart_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                <ResourceAuditRow label="Laptop" funcName="res_laptop_func" nonFuncName="res_laptop_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                <ResourceAuditRow label="TV / Smart TV" funcName="res_tv_func" nonFuncName="res_tv_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                <ResourceAuditRow label="Printers" funcName="res_printer_func" nonFuncName="res_printer_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                <ResourceAuditRow label="Desks" funcName="res_desk_func" nonFuncName="res_desk_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                <ResourceAuditRow label="Arm Chairs" funcName="res_armchair_func" nonFuncName="res_armchair_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                <ResourceAuditRow label="Toilets" funcName="res_toilet_func" nonFuncName="res_toilet_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                <ResourceAuditRow label="Hand Washing Stn" funcName="res_handwash_func" nonFuncName="res_handwash_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                            </tbody>
                        </table>
                    </div>

                    {/* Labs Section */}
                    <div className="space-y-2 pt-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">Specialized Rooms</p>
                        <LabRow label="Science Laboratory" name="res_sci_labs" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                        <LabRow label="Computer Laboratory" name="res_com_labs" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                        <LabRow label="TVL/TLE Workshop Lab" name="res_tvl_workshops" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                    </div>
                </div>

                {/* SITE & UTILITIES */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                            <FiMapPin size={20} />
                        </div>
                        <div>
                            <h2 className="text-slate-800 font-bold text-lg">Site & Utilities</h2>
                            <p className="text-xs text-slate-400 font-medium">Property and basics</p>
                        </div>
                    </div>

                    <div className="grid gap-4">

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <SelectField
                                label="Electricity Source"
                                name="res_electricity_source"
                                options={["For Verification", "GRID AND OFF-GRID SUPPLY", "GRID SUPPLY", "OFF-GRID SUPPLY", "NO ELECTRICITY"]}
                                formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly}
                            />
                            <SelectField
                                label="Water Source"
                                name="res_water_source"
                                options={["For Verification", "Natural Resources", "Piped line from Local Service Provider", "No Water Source"]}
                                formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly}
                            />
                        </div>
                        <SelectField
                            label="Is there Buildable Space?"
                            name="res_buildable_space"
                            options={["Yes", "No"]}
                            formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly}
                        />
                        <SelectField
                            label="SHA (Special Hardship Allowance) Category"
                            name="sha_category"
                            options={[
                                "NOT INCLUDED",
                                "HARDSHIP POST",
                                "PURE MULTIGRADE SCHOOL",
                                "HARDSHIP POST AND PURE MULTIGRADE SCHOOL"
                            ]}
                            formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly}
                        />
                    </div>
                </div>

                {/* SEAT ANALYSIS */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                            <FiLayout size={20} />
                        </div>
                        <div>
                            <h2 className="text-slate-800 font-bold text-lg">Furniture Analysis</h2>
                            <p className="text-xs text-slate-400 font-medium">Seat availability vs enrollment</p>
                        </div>
                    </div>

                    {/* Seat Shortage Table */}
                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="py-4 px-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grade</th>
                                    <th className="py-4 px-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enrollment</th>
                                    <th className="py-4 px-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seats</th>
                                    <th className="py-4 px-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shortage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 bg-white">
                                {showElem() && (
                                    <>
                                        <>
                                            <SeatRow label="Kinder" enrollment={enrollmentData.gradeKinder || 0} seatKey="seats_kinder" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 1" enrollment={enrollmentData.grade1 || 0} seatKey="seats_grade_1" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 2" enrollment={enrollmentData.grade2 || 0} seatKey="seats_grade_2" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 3" enrollment={enrollmentData.grade3 || 0} seatKey="seats_grade_3" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 4" enrollment={enrollmentData.grade4 || 0} seatKey="seats_grade_4" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 5" enrollment={enrollmentData.grade5 || 0} seatKey="seats_grade_5" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 6" enrollment={enrollmentData.grade6 || 0} seatKey="seats_grade_6" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                        </>
                                    </>
                                )}
                                {showJHS() && (
                                    <>
                                        <>
                                            <SeatRow label="Grade 7" enrollment={enrollmentData.grade7 || 0} seatKey="seats_grade_7" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 8" enrollment={enrollmentData.grade8 || 0} seatKey="seats_grade_8" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 9" enrollment={enrollmentData.grade9 || 0} seatKey="seats_grade_9" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 10" enrollment={enrollmentData.grade10 || 0} seatKey="seats_grade_10" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                        </>
                                    </>
                                )}
                                {showSHS() && (
                                    <>
                                        <>
                                            <SeatRow label="Grade 11" enrollment={enrollmentData.grade11 || 0} seatKey="seats_grade_11" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 12" enrollment={enrollmentData.grade12 || 0} seatKey="seats_grade_12" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                        </>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                                <FiDroplet size={20} />
                            </div>
                            <div>
                                <h2 className="text-slate-800 font-bold text-lg">Comfort Rooms</h2>
                                <p className="text-xs text-slate-400 font-medium">Sanitation facilities</p>
                            </div>
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => !viewOnly && !isLocked && !isDummy && !isReadOnly && setCrType('Segmented')}
                                className={`px-4 py-2 text-[10px] font-bold rounded-lg transition-all ${crType === 'Segmented' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Male/Female
                            </button>
                            <button
                                onClick={() => !viewOnly && !isLocked && !isDummy && !isReadOnly && setCrType('Shared')}
                                className={`px-4 py-2 text-[10px] font-bold rounded-lg transition-all ${crType === 'Shared' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Common/Shared
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {crType === 'Segmented' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Male Toilets" name="res_toilets_male" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                <InputField label="Female Toilets" name="res_toilets_female" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                            </div>
                        ) : (
                            <InputField label="Common/Shared Toilets" name="res_toilets_common" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                        )}
                        <InputField label="PWD Toilets" name="res_toilets_pwd" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-100 p-4 pb-8 z-40">
                <div className="max-w-lg mx-auto flex gap-3">
                    {(viewOnly || isReadOnly) ? (
                        <div className="w-full text-center p-3 text-slate-400 font-bold bg-slate-100 rounded-2xl text-sm">Read-Only Mode</div>
                    ) : isLocked ? (
                        <button onClick={() => setIsLocked(false)} className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-colors">
                            🔓 Unlock to Edit Data
                        </button>
                    ) : (
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-1 bg-[#004A99] text-white font-bold py-4 rounded-2xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <><FiSave /> Save Changes</>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Modals for Edit/Save */}
            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
                        <h3 className="font-bold text-xl text-slate-800 mb-2">Enable Editing?</h3>
                        <p className="text-slate-500 text-sm mb-6">This allows you to modify the school resources data.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={() => { setIsLocked(false); setShowEditModal(false); }} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-colors">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <FiCheckCircle size={24} />
                        </div>
                        <h3 className="font-bold text-xl text-slate-800 text-center mb-2">Save Changes?</h3>
                        <p className="text-slate-500 text-center text-sm mb-6">You are about to update the school resources record.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={confirmSave} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-colors">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {showInfoModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-blue-600 text-2xl">
                            <FiInfo />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 text-center">Form Guide</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6 text-center">This form is answering the question: <b>'What is the current inventory status of school facilities, equipment, and utilities?'</b></p>
                        <button onClick={() => setShowInfoModal(false)} className="w-full py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition-transform active:scale-95">Got it</button>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="School Resources updated successfully!" />


        </div>
    );
};

export default SchoolResources;