// src/forms/SchoolInformation.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
// LoadingScreen import removed 
import { addToOutbox, getOutbox } from '../db';
import Papa from 'papaparse'; //
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';
import { FiArrowLeft, FiUser, FiMapPin, FiBriefcase, FiHash, FiSearch, FiCheckCircle, FiSave, FiAlertCircle } from 'react-icons/fi';

const SchoolInformation = ({ embedded = false }) => {
    const navigate = useNavigate();

    // --- STATE MANAGEMENT ---
    const location = useLocation();
    const isDummy = location.state?.isDummy || false; // NEW: Dummy Mode Check

    // Super User / Audit Context
    const isSuperUser = localStorage.getItem('userRole') === 'Super User';
    const auditTargetId = sessionStorage.getItem('targetSchoolId');
    const isAuditMode = isSuperUser && !!auditTargetId;

    const [isReadOnly, setIsReadOnly] = useState(isDummy || isAuditMode);
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const [isLocked, setIsLocked] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const [showSaveModal, setShowSaveModal] = useState(false);
    const [isChecked, setIsChecked] = useState(false);
    const [editAgreement, setEditAgreement] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);


    const [formData, setFormData] = useState({
        lastName: '', firstName: '', middleName: '',
        itemNumber: '', positionTitle: '', dateHired: ''
    });

    const [originalData, setOriginalData] = useState(null);

    const positionOptions = [
        "Teacher I", "Teacher II", "Teacher III", "Master Teacher I", "Master Teacher II",
        "Master Teacher III", "Master Teacher IV", "SPED Teacher I", "SPED Teacher II",
        "SPED Teacher III", "SPED Teacher IV", "SPED Teacher V", "Special Science Teacher I",
        "Special Science Teacher II", "Head Teacher I", "Head Teacher II", "Head Teacher III",
        "Head Teacher IV", "Head Teacher V", "Head Teacher VI", "Assistant School Principal I",
        "Assistant School Principal II", "School Principal I", "School Principal II",
        "School Principal III", "School Principal IV", "Special School Principal I",
        "Special School Principal II", "Vocational School Administrator I",
        "Vocational School Administrator II", "Vocational School Administrator III",
        "Public School District Supervisor"
    ];

    const goBack = () => {
        if (isDummy) {
            navigate('/dummy-forms', { state: { type: 'school' } });
        } else {
            navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');
        }
    };

    // --- 1. CSV LOOKUP LOGIC ---
    // --- 1. CSV LOOKUP LOGIC ---
    // This function matches PSI_CD from Oct2025-GMIS-Filled_RAW.csv
    const handlePsiLookup = (psiCd) => {
        const cleanPsi = String(psiCd).trim();
        console.log("Lookup triggered for:", cleanPsi); // DEBUG
        if (cleanPsi.length < 5) return;

        setIsSearching(true);
        console.log("Starting CSV parse..."); // DEBUG
        Papa.parse("/Oct2025-GMIS-Filled_RAW.csv", {
            download: true,
            header: true,
            skipEmptyLines: true,
            step: (row, parser) => {
                // Streaming: Checked row by row
                // console.log("Checking row:", row.data.PSI_CD); // Too verbose, uncomment if desperate
                if (row.data.PSI_CD && String(row.data.PSI_CD).trim() === cleanPsi) {
                    console.log("Match found!", row.data); // DEBUG
                    const match = row.data;
                    setFormData(prev => ({
                        ...prev,
                        lastName: match.LAST_NAME || '',
                        firstName: match.FIRST_NAME || '',
                        middleName: match.MID_NAME || '',
                        positionTitle: match.POS_DSC || ''
                    }));
                    parser.abort(); // Stop parsing once found
                    setIsSearching(false);
                }
            },
            complete: () => {
                console.log("CSV Parse Complete (or Aborted)"); // DEBUG
                setIsSearching(false);
            },
            error: (err) => {
                console.error("CSV Parse Error:", err);
                setIsSearching(false);
            }
        });
    };

    // --- 2. LOAD DATA ---
    // --- 2. LOAD DATA (Strict Sync Cache Strategy) ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Check Role for Read-Only
                try {
                    const role = localStorage.getItem('userRole');
                    if (role === 'Central Office' || isDummy) {
                        setIsReadOnly(true);
                    }
                } catch (e) { }

                // STEP 1: IMMEDIATE CACHE LOAD
                let loadedFromCache = false;
                const CACHE_KEY = `CACHE_SCHOOL_INFO_${user.uid}`;
                const cachedData = localStorage.getItem(CACHE_KEY);

                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        setFormData(parsed);
                        setOriginalData(parsed);
                        // setLastUpdated(parsed.lastUpdated || null); // Optional restoration
                        setIsLocked(true);
                        setLoading(false); // CRITICAL: Instant Load
                        loadedFromCache = true;
                        console.log("Loaded cached School Info (Instant Load)");
                    } catch (e) { console.error("Cache parse error", e); }
                }

                try {
                    // STEP 2: CHECK OUTBOX
                    let restored = false;
                    if (!viewOnly) {
                        try {
                            const drafts = await getOutbox();
                            const draft = drafts.find(d => d.type === 'SCHOOL_HEAD_INFO' && d.payload.uid === user.uid);

                            if (draft) {
                                console.log("Restored draft from Outbox");
                                const draftData = draft.payload;
                                const merged = {
                                    lastName: draftData.lastName || '',
                                    firstName: draftData.firstName || '',
                                    middleName: draftData.middleName || '',
                                    itemNumber: draftData.itemNumber || '',
                                    positionTitle: draftData.positionTitle || '',
                                    dateHired: draftData.dateHired || ''
                                };
                                setFormData(merged);
                                setIsLocked(false);
                                restored = true;
                                setLoading(false);
                            }
                        } catch (e) { console.error("Outbox check failed:", e); }
                    }

                    // STEP 3: BACKGROUND FETCH
                    if (!restored) {
                        let fetchUrl = `/api/school-head/${user.uid}`;
                        const role = localStorage.getItem('userRole');

                        if (isAuditMode) {
                            fetchUrl = `/api/monitoring/school-detail/${auditTargetId}`;
                        } else if ((viewOnly || role === 'Central Office' || isDummy) && schoolIdParam) {
                            fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                        }

                        // Only show loading if we didn't load from cache
                        if (!loadedFromCache) setLoading(true);

                        const response = await fetch(fetchUrl);
                        if (response.ok) {
                            const result = await response.json();
                            // For Audit Mode, we treat it like viewOnly/param-based fetch
                            const data = (isAuditMode || (viewOnly && schoolIdParam)) ? result : (result.exists ? result.data : null);

                            if (data) {
                                const loadedData = {
                                    lastName: data.head_last_name || data.last_name || '',
                                    firstName: data.head_first_name || data.first_name || '',
                                    middleName: data.head_middle_name || data.middle_name || '',
                                    itemNumber: data.head_item_number || data.item_number || '',
                                    positionTitle: data.head_position_title || data.position_title || '',
                                    dateHired: (data.date_hired || data.head_date_hired) ? (data.date_hired || data.head_date_hired).split('T')[0] : ''
                                };

                                setFormData(loadedData);
                                setOriginalData(loadedData);
                                setLastUpdated(data.updated_at || data.submitted_at);
                                setIsLocked(true);

                                // UPDATE CACHE
                                localStorage.setItem(CACHE_KEY, JSON.stringify(loadedData));
                            }
                        }
                    }
                } catch (error) {
                    console.error("Fetch Error:", error);
                    if (!loadedFromCache) {
                        // Fallback: Retry cache
                        const CACHE_KEY = `CACHE_SCHOOL_INFO_${user.uid}`;
                        const cached = localStorage.getItem(CACHE_KEY);
                        if (cached) {
                            const data = JSON.parse(cached);
                            setFormData(data);
                            setOriginalData(data);
                            setIsLocked(true);
                        }
                    }
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);



    // --- DATE PICKER HELPERS ---
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 1960 + 1 }, (_, i) => currentYear - i);

    const handleDateChange = (part, val) => {
        let y, m, d;
        if (formData.dateHired) {
            const parts = formData.dateHired.split('-');
            y = parseInt(parts[0]);
            m = parseInt(parts[1]) - 1; // 0-indexed for month logic
            d = parseInt(parts[2]);
        } else {
            const now = new Date();
            y = now.getFullYear();
            m = now.getMonth();
            d = now.getDate();
        }

        if (part === 'year') y = parseInt(val);
        if (part === 'month') m = parseInt(val);
        if (part === 'day') d = parseInt(val);

        // Construct YYYY-MM-DD string
        const isoDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        setFormData(prev => ({ ...prev, dateHired: isoDate }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        let finalValue = value;
        if (name === 'itemNumber') {
            // Logic to enforce/suggest prefix
            // If user deletes everything, let them. If they start typing, maybe partial matches?
            // Actually, simplest is just normal input. But user asked "make the first letters are...".
            // Let's auto-prepend on blur or just specific handling? 
            // Better: If they type, just normal. But maybe on Focus, if empty, set it?
            // Or handle it here: If value doesn't start with prefix, maybe warn or correct?
            // Let's try: if value length > 0 and doesn't start with OSEC-DECSB-, prepend it? No that's annoying while typing.
            // Let's just handle it in the input component itself with a specialized handler or just let it be free-text but with a placeholder/default.
            // However, the user request "can we make... first letters are..." suggests forcing it.
            // Let's try this: If the user types, we ensure the prefix stays if it was there?
            // Let's go with a simple approach: if it's itemNumber, we do nothing special HERE, but handle it in the input specific props or useEffect.

            // Actually, let's just do standard update here.
        }
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleItemNumberFocus = () => {
        if (!formData.itemNumber) {
            setFormData(prev => ({ ...prev, itemNumber: 'OSEC-DECSB-' }));
        }
    };

    // Trigger lookup when user finishes typing the Item Number
    const handleItemNumberBlur = () => {
        handlePsiLookup(formData.itemNumber);
    };

    const isFormValid = () => {
        const isValidEntry = (value) => value !== '' && value !== null && value !== undefined;
        const required = ['firstName', 'lastName', 'positionTitle', 'dateHired', 'itemNumber'];
        return required.every(f => isValidEntry(formData[f]));
    };

    // --- 3. SAVE LOGIC ---
    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);
        const user = auth.currentUser;

        // Package all data including the new CSV fields
        const payload = {
            uid: user.uid,
            ...formData // Includes lastName, firstName, middleName, itemNumber, positionTitle, dateHired
        };

        if (!navigator.onLine) {
            try {
                await addToOutbox({
                    type: 'SCHOOL_HEAD_INFO',
                    label: 'School Head Info',
                    url: '/api/save-school-head',
                    payload: payload
                });
                setShowOfflineModal(true);
                setIsLocked(true);
            } finally {
                setIsSaving(false);
            }
            return;
        }

        try {
            const response = await fetch('/api/save-school-head', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setShowSuccessModal(true);
                setOriginalData({ ...formData });
                setIsLocked(true);
            } else {
                const err = await response.json();
                alert('Error: ' + err.error);
            }
        } catch (error) {
            await addToOutbox({
                type: 'SCHOOL_HEAD_INFO',
                label: 'School Head Info',
                url: '/api/save-school-head',
                payload: payload
            });
            setShowOfflineModal(true);
            setIsLocked(true);
        } finally {
            setIsSaving(false);
        }
    };

    // LoadingScreen check removed

    if (loading) return (
        <div className="min-h-screen grid place-items-center bg-slate-50">
            <div className="w-10 h-10 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
        </div>
    );

    const inputClass = "w-full h-12 px-4 font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all hover:border-blue-200 disabled:bg-slate-100 disabled:text-slate-400";
    const labelClass = "text-[9px] font-bold text-slate-400 uppercase mb-1 block ml-1";
    const sectionClass = "bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-5";

    return (
        <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans ${embedded ? 'pb-32 !bg-transparent' : 'pb-40'}`}>
            {/* --- PREMIUM BLUE HEADER - Hide if embedded --- */}
            {!embedded && (
                <div className="bg-[#004A99] min-h-[220px] rounded-b-[2.5rem] relative shadow-lg overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid-pattern.png')] opacity-10"></div>
                    <div className="absolute top-10 right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl"></div>

                    <div className="relative pt-12 px-6 flex items-center justify-between z-10">
                        <button onClick={goBack} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl backdrop-blur-md transition-all text-white border border-white/10 shadow-lg group">
                            <FiArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1 bg-white/10 px-3 py-1 rounded-full border border-white/5">School Form 2</span>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-yellow-400 rounded-lg shadow-lg rotate-3">
                                    <FiBriefcase className="text-yellow-900 text-lg" />
                                </div>
                                <h1 className="text-xl font-bold text-white tracking-tight">School Head</h1>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className={`px-5 relative z-20 max-w-3xl mx-auto space-y-5 ${embedded ? 'pt-4' : '-mt-10'}`}>

                {/* --- PSI_CD LOOKUP SECTION --- */}
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                            <FiHash />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Item Number</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PSI_CD Lookup</p>
                        </div>
                    </div>

                    <div className="relative">
                        <label className={labelClass}>PSI_CD / Item No.</label>
                        <p className="text-[10px] text-slate-400 font-medium mb-1.5">Enter your unique Plantilla Item Number to auto-fill details.</p>
                        <input
                            type="text"
                            name="itemNumber"
                            value={formData.itemNumber}
                            onChange={handleChange}
                            onBlur={handleItemNumberBlur}
                            onFocus={handleItemNumberFocus}
                            placeholder="e.g. OSEC-DECSB-ADA1-27-2004"
                            className={`${inputClass} !border-blue-200 text-blue-700`}
                            disabled={isLocked || viewOnly || isDummy || isReadOnly}
                        />
                        {isSearching && (
                            <div className="absolute right-4 bottom-3 animate-spin text-blue-500">
                                <FiSearch />
                            </div>
                        )}
                    </div>
                    {!isLocked && !viewOnly && !isDummy && !isReadOnly && (
                        <p className="text-[10px] text-blue-400 mt-2 font-medium ml-1">
                            💡 Enter Item Number and tap outside to autofill details.
                        </p>
                    )}
                </div>

                {/* --- PERSONAL DETAILS --- */}
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
                            <FiUser />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Personal Details</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Basic Information</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className={labelClass}>First Name</label>
                            <p className="text-[10px] text-slate-400 font-medium mb-1.5">Given name as it appears on your appointment.</p>
                            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy || isReadOnly} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>Middle Name</label>
                            <p className="text-[10px] text-slate-400 font-medium mb-1.5">Mother's maiden name (Full, not initial).</p>
                            <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy || isReadOnly} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>Last Name</label>
                            <p className="text-[10px] text-slate-400 font-medium mb-1.5">Family name / Surname.</p>
                            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy || isReadOnly} />
                        </div>
                    </div>
                </div>



                {/* --- APPOINTMENT DATA --- */}
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
                            <FiBriefcase />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Appointment</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Position & Hiring Date</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className={labelClass}>Position Title</label>
                            <p className="text-[10px] text-slate-400 font-medium mb-1.5">Select your official designation per appointment.</p>
                            <select name="positionTitle" value={formData.positionTitle} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy || isReadOnly}>
                                <option value="">Select Position...</option>
                                {positionOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>Date of Appointment</label>
                            <p className="text-[10px] text-slate-400 font-medium mb-1.5">Date of latest appointment issuance.</p>
                            <div className="flex gap-2">
                                {/* Month */}
                                <select
                                    value={formData.dateHired ? parseInt(formData.dateHired.split('-')[1]) - 1 : ''}
                                    onChange={(e) => handleDateChange('month', e.target.value)}
                                    className={`${inputClass} flex-[2] min-w-0`}
                                    disabled={isLocked || viewOnly || isDummy || isReadOnly}
                                >
                                    <option value="" disabled>Month</option>
                                    {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                </select>

                                {/* Day */}
                                <select
                                    value={formData.dateHired ? parseInt(formData.dateHired.split('-')[2]) : ''}
                                    onChange={(e) => handleDateChange('day', e.target.value)}
                                    className={`${inputClass} flex-1 min-w-[70px]`}
                                    disabled={isLocked || viewOnly || isDummy || isReadOnly}
                                >
                                    <option value="" disabled>Day</option>
                                    {days.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>

                                {/* Year */}
                                <select
                                    value={formData.dateHired ? parseInt(formData.dateHired.split('-')[0]) : ''}
                                    onChange={(e) => handleDateChange('year', e.target.value)}
                                    className={`${inputClass} flex-[1.5] min-w-[80px]`}
                                    disabled={isLocked || viewOnly || isDummy || isReadOnly}
                                >
                                    <option value="" disabled>Year</option>
                                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions - Hide if embedded */}
            {
                !embedded && (
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
                )
            }

            {/* --- MODALS --- */}
            {
                showSaveModal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-blue-600 text-2xl">
                                <FiCheckCircle />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">Confirm Updates</h3>
                            <p className="text-sm text-slate-500 mt-2 mb-6">Are you sure the information is correct?</p>

                            <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer mb-6 border border-transparent hover:border-slate-100 transition">
                                <input type="checkbox" checked={isChecked} onChange={(e) => setIsChecked(e.target.checked)} className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-600" />
                                <span className="text-xs font-bold text-slate-600 select-none">I certify this information is correct.</span>
                            </label>

                            <div className="flex gap-2">
                                <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancel</button>
                                <button onClick={confirmSave} disabled={!isChecked} className={`flex-1 py-3 rounded-xl text-white font-bold shadow-sm ${isChecked ? 'bg-[#004A99] hover:bg-blue-800' : 'bg-slate-200 cursor-not-allowed'}`}>Save</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Warning Modal for Unlock */}
            {
                showEditModal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4 text-amber-500 text-2xl">
                                <FiAlertCircle />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">Edit Information?</h3>
                            <p className="text-sm text-slate-500 mt-2 mb-6">You are about to modify official school head records. Please confirm to proceed.</p>

                            <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer mb-6 border border-transparent hover:border-slate-100 transition">
                                <input type="checkbox" checked={editAgreement} onChange={(e) => setEditAgreement(e.target.checked)} className="mt-1 w-4 h-4 text-amber-600 rounded focus:ring-amber-600" />
                                <span className="text-xs font-bold text-slate-600 select-none">I understand and wish to proceed.</span>
                            </label>

                            <div className="flex gap-2">
                                <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancel</button>
                                <button onClick={() => { setShowEditModal(false); setIsLocked(false); }} disabled={!editAgreement} className={`flex-1 py-3 rounded-xl text-white font-bold shadow-sm ${editAgreement ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-200 cursor-not-allowed'}`}>Proceed</button>
                            </div>
                        </div>
                    </div>
                )
            }

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="School Head Information saved successfully!" />
        </div >
    );
};

export default SchoolInformation;