
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
import { addToOutbox, getOutbox } from '../db';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';

import { FiArrowLeft, FiSave, FiGrid, FiLayers, FiAlertCircle, FiCheckCircle, FiBarChart2, FiHelpCircle, FiInfo } from 'react-icons/fi';
import { TbSchool } from 'react-icons/tb';

// --- SUB-COMPONENT: Generic Grid Section (Matched from Enrolment.jsx) ---
const GridSection = ({ label, icon, color, children, totalLabel, totalValue }) => (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-4 transition-all hover:border-blue-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-50">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${color} bg-opacity-10 flex items-center justify-center text-xl`}>
                    {icon}
                </div>
                <div>
                    <h2 className="text-base font-bold text-slate-800">{label}</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Per Grade Level</p>
                </div>
            </div>
            {/* Live Total Badge */}
            {totalValue !== undefined && (
                <div className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-100 text-center min-w-[70px]">
                    <span className="block text-[9px] text-blue-400 font-bold uppercase">{totalLabel || 'Total'}</span>
                    <span className="text-sm font-black text-blue-700">{totalValue}</span>
                </div>
            )}
        </div>
        {children}
    </div>
);

const OrganizedClasses = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');
    const isDummy = location.state?.isDummy || false;

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // UI States
    const [isLocked, setIsLocked] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [userRole, setUserRole] = useState("School Head");


    // Data
    const [schoolId, setSchoolId] = useState(null);
    const [offering, setOffering] = useState('');

    // Default values set to 0
    const [formData, setFormData] = useState({
        kinder: '', g1: '', g2: '', g3: '', g4: '', g5: '', g6: '',
        g7: '', g8: '', g9: '', g10: '',
        g11: '', g12: ''
    });

    const [classSizeData, setClassSizeData] = useState({
        cntLessG1: '', cntWithinG1: '', cntAboveG1: '',
        cntLessG2: '', cntWithinG2: '', cntAboveG2: '',
        cntLessG3: '', cntWithinG3: '', cntAboveG3: '',
        cntLessG4: '', cntWithinG4: '', cntAboveG4: '',
        cntLessG5: '', cntWithinG5: '', cntAboveG5: '',
        cntLessG6: '', cntWithinG6: '', cntAboveG6: '',
        cntLessG7: '', cntWithinG7: '', cntAboveG7: '',
        cntLessG8: '', cntWithinG8: '', cntAboveG8: '',
        cntLessG9: '', cntWithinG9: '', cntAboveG9: '',
        cntLessG10: '', cntWithinG10: '', cntAboveG10: '',
        cntLessG11: '', cntWithinG11: '', cntAboveG11: '',
        cntLessG12: '', cntWithinG12: '', cntAboveG12: ''
    });
    const [originalData, setOriginalData] = useState(null);

    const goBack = () => {
        if (isDummy) {
            navigate(-1);
        } else {
            navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');
        }
    };

    // --- FETCH DATA (Strict Sync Cache Strategy) ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // DEFAULT STATE (Prevents Uncontrolled Input Errors)
                const defaultFormData = {
                    kinder: '', g1: '', g2: '', g3: '', g4: '', g5: '', g6: '',
                    g7: '', g8: '', g9: '', g10: '',
                    g11: '', g12: ''
                };
                const defaultClassSize = {
                    cntLessG1: '', cntWithinG1: '', cntAboveG1: '',
                    cntLessG2: '', cntWithinG2: '', cntAboveG2: '',
                    cntLessG3: '', cntWithinG3: '', cntAboveG3: '',
                    cntLessG4: '', cntWithinG4: '', cntAboveG4: '',
                    cntLessG5: '', cntWithinG5: '', cntAboveG5: '',
                    cntLessG6: '', cntWithinG6: '', cntAboveG6: '',
                    cntLessG7: '', cntWithinG7: '', cntAboveG7: '',
                    cntLessG8: '', cntWithinG8: '', cntAboveG8: '',
                    cntLessG9: '', cntWithinG9: '', cntAboveG9: '',
                    cntLessG10: '', cntWithinG10: '', cntAboveG10: '',
                    cntLessG11: '', cntWithinG11: '', cntAboveG11: '',
                    cntLessG12: '', cntWithinG12: '', cntAboveG12: ''
                };

                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');

                if (storedSchoolId) setSchoolId(storedSchoolId);
                if (storedOffering) setOffering(storedOffering);

                // STEP 1: IMMEDIATE CACHE LOAD
                let loadedFromCache = false;
                const CACHE_KEY = `CACHE_ORGANIZED_CLASSES_${user.uid}`;
                const cachedData = localStorage.getItem(CACHE_KEY);

                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);

                        let restoredForm = {};
                        let restoredSize = {};

                        if (parsed.formData) {
                            restoredForm = parsed.formData;
                            restoredSize = parsed.classSizeData || {};
                        } else {
                            // Map FLat DB structure
                            restoredForm = {
                                kinder: parsed.classes_kinder ?? parsed.kinder ?? 0,
                                g1: parsed.classes_grade_1 ?? parsed.grade_1 ?? 0, g2: parsed.classes_grade_2 ?? parsed.grade_2 ?? 0,
                                g3: parsed.classes_grade_3 ?? parsed.grade_3 ?? 0, g4: parsed.classes_grade_4 ?? parsed.grade_4 ?? 0,
                                g5: parsed.classes_grade_5 ?? parsed.grade_5 ?? 0, g6: parsed.classes_grade_6 ?? parsed.grade_6 ?? 0,
                                g7: parsed.classes_grade_7 ?? parsed.grade_7 ?? 0, g8: parsed.classes_grade_8 ?? parsed.grade_8 ?? 0,
                                g9: parsed.classes_grade_9 ?? parsed.grade_9 ?? 0, g10: parsed.classes_grade_10 ?? parsed.grade_10 ?? 0,
                                g11: parsed.classes_grade_11 ?? parsed.grade_11 ?? 0, g12: parsed.classes_grade_12 ?? parsed.grade_12 ?? 0
                            };
                        }

                        // MERGE to ensure no undefineds (Fix Uncontrolled Input)
                        setFormData({ ...defaultFormData, ...restoredForm });
                        setClassSizeData({ ...defaultClassSize, ...restoredSize });

                        setOriginalData(parsed);
                        // Restore Offering from cache if possible
                        const cacheOff = parsed.curricular_offering || parsed.offering || (parsed.formData ? parsed.formData.offering : '') || storedOffering;
                        if (cacheOff) setOffering(cacheOff);

                        setIsLocked(Object.values(restoredForm).reduce((a, b) => a + (parseInt(b) || 0), 0) > 0);
                        setLoading(false); // CRITICAL: Instant Load
                        loadedFromCache = true;
                        console.log("Loaded cached Organized Classes data (Instant Load)");
                    } catch (e) { console.error("Cache parse error", e); }
                }

                try {
                    // STEP 2: CHECK OUTBOX
                    let restored = false;
                    if (!viewOnly) {
                        try {
                            const drafts = await getOutbox();
                            const draft = drafts.find(d => d.type === 'ORGANIZED_CLASSES');

                            if (draft) {
                                console.log("Restored draft from Outbox");
                                const p = draft.payload;

                                if (p.curricular_offering || p.offering) {
                                    setOffering(p.curricular_offering || p.offering);
                                }

                                setFormData({ ...defaultFormData, ...p });
                                setClassSizeData({ ...defaultClassSize, ...p });

                                restored = true;
                                setIsLocked(false); // Unlocks form for draft editing
                                setLoading(false);
                            }
                        } catch (e) { console.error("Outbox check failed:", e); }
                    }

                    // STEP 3: BACKGROUND FETCH
                    if (!restored) {
                        const docRef = doc(db, "users", user.uid);
                        let fetchUrl = `/api/organized-classes/${user.uid}`;
                        if (viewOnly && schoolIdParam) {
                            fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                        }

                        // CRITICAL: Only show loading if NOT loaded from cache
                        if (!loadedFromCache) setLoading(true);

                        const [docSnap, apiResult] = await Promise.all([
                            getDoc(docRef).catch(e => ({ exists: () => false })),
                            fetch(fetchUrl).then(res => res.json()).catch(e => ({ error: e, exists: false }))
                        ]);

                        if (docSnap.exists()) setUserRole(docSnap.data().role);

                        const json = apiResult;

                        if (json.exists || (viewOnly && schoolIdParam)) {
                            setSchoolId(json.school_id || json.schoolId);
                            const newOffering = json.curricular_offering || json.offering || storedOffering || '';
                            setOffering(newOffering);

                            if (!viewOnly && json.schoolId) {
                                localStorage.setItem('schoolId', json.schoolId);
                                localStorage.setItem('schoolOffering', newOffering);
                            }

                            const dbData = (viewOnly && schoolIdParam) ? json : json.data;

                            const newFormData = {
                                kinder: dbData.classes_kinder ?? dbData.kinder ?? 0,
                                g1: dbData.classes_grade_1 ?? dbData.grade_1 ?? 0, g2: dbData.classes_grade_2 ?? dbData.grade_2 ?? 0,
                                g3: dbData.classes_grade_3 ?? dbData.grade_3 ?? 0, g4: dbData.classes_grade_4 ?? dbData.grade_4 ?? 0,
                                g5: dbData.classes_grade_5 ?? dbData.grade_5 ?? 0, g6: dbData.classes_grade_6 ?? dbData.grade_6 ?? 0,
                                g7: dbData.classes_grade_7 ?? dbData.grade_7 ?? 0, g8: dbData.classes_grade_8 ?? dbData.grade_8 ?? 0,
                                g9: dbData.classes_grade_9 ?? dbData.grade_9 ?? 0, g10: dbData.classes_grade_10 ?? dbData.grade_10 ?? 0,
                                g11: dbData.classes_grade_11 ?? dbData.grade_11 ?? 0, g12: dbData.classes_grade_12 ?? dbData.grade_12 ?? 0
                            };

                            const newClassSize = {
                                cntLessG1: dbData.cnt_less_g1 ?? 0, cntWithinG1: dbData.cnt_within_g1 ?? 0, cntAboveG1: dbData.cnt_above_g1 ?? 0,
                                cntLessG2: dbData.cnt_less_g2 ?? 0, cntWithinG2: dbData.cnt_within_g2 ?? 0, cntAboveG2: dbData.cnt_above_g2 ?? 0,
                                cntLessG3: dbData.cnt_less_g3 ?? 0, cntWithinG3: dbData.cnt_within_g3 ?? 0, cntAboveG3: dbData.cnt_above_g3 ?? 0,
                                cntLessG4: dbData.cnt_less_g4 ?? 0, cntWithinG4: dbData.cnt_within_g4 ?? 0, cntAboveG4: dbData.cnt_above_g4 ?? 0,
                                cntLessG5: dbData.cnt_less_g5 ?? 0, cntWithinG5: dbData.cnt_within_g5 ?? 0, cntAboveG5: dbData.cnt_above_g5 ?? 0,
                                cntLessG6: dbData.cnt_less_g6 ?? 0, cntWithinG6: dbData.cnt_within_g6 ?? 0, cntAboveG6: dbData.cnt_above_g6 ?? 0,
                                cntLessG7: dbData.cnt_less_g7 ?? 0, cntWithinG7: dbData.cnt_within_g7 ?? 0, cntAboveG7: dbData.cnt_above_g7 ?? 0,
                                cntLessG8: dbData.cnt_less_g8 ?? 0, cntWithinG8: dbData.cnt_within_g8 ?? 0, cntAboveG8: dbData.cnt_above_g8 ?? 0,
                                cntLessG9: dbData.cnt_less_g9 ?? 0, cntWithinG9: dbData.cnt_within_g9 ?? 0, cntAboveG9: dbData.cnt_above_g9 ?? 0,
                                cntLessG10: dbData.cnt_less_g10 ?? 0, cntWithinG10: dbData.cnt_within_g10 ?? 0, cntAboveG10: dbData.cnt_above_g10 ?? 0,
                                cntLessG11: dbData.cnt_less_g11 ?? 0, cntWithinG11: dbData.cnt_within_g11 ?? 0, cntAboveG11: dbData.cnt_above_g11 ?? 0,
                                cntLessG12: dbData.cnt_less_g12 ?? 0, cntWithinG12: dbData.cnt_within_g12 ?? 0, cntAboveG12: dbData.cnt_above_g12 ?? 0
                            };

                            setFormData(prev => ({ ...prev, ...newFormData }));
                            setClassSizeData(prev => ({ ...prev, ...newClassSize }));

                            // Create Structured Cache
                            const cachePayload = {
                                formData: newFormData,
                                classSizeData: newClassSize,
                                curricular_offering: newOffering,
                                schoolId: json.schoolId
                            };
                            localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
                            setOriginalData(cachePayload);
                            setIsLocked(Object.values(newFormData).reduce((a, b) => a + (parseInt(b) || 0), 0) > 0);
                        }
                    }
                } catch (error) {
                    console.error("Network Error:", error);
                    if (!loadedFromCache) {
                        const CACHE_KEY = `CACHE_ORGANIZED_CLASSES_${user.uid}`;
                        const cached = localStorage.getItem(CACHE_KEY);
                        if (cached) {
                            try {
                                const parsed = JSON.parse(cached);
                                // Simple restore fallback
                                if (parsed.formData) {
                                    setFormData({ ...defaultFormData, ...parsed.formData });
                                    setClassSizeData({ ...defaultClassSize, ...parsed.classSizeData });
                                }
                            } catch (e) { }
                        }
                    }
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- AUTO-SHOW INFO MODAL ---
    useEffect(() => {
        const hasSeenInfo = localStorage.getItem('hasSeenOrganizedClassesInfo');
        if (!hasSeenInfo) {
            setShowInfoModal(true);
            localStorage.setItem('hasSeenOrganizedClassesInfo', 'true');
        }
    }, []);

    // --- SAVE TIMER EFFECTS ---


    // --- HELPERS ---
    const showElem = () => offering.includes("Elementary") || offering.includes("K-12") || offering.includes("K-10");
    const showJHS = () => offering.includes("Junior") || offering.includes("K-12") || offering.includes("K-10");
    const showSHS = () => offering.includes("Senior") || offering.includes("K-12");
    const getTotalClasses = () => Object.values(formData).reduce((a, b) => a + (parseInt(b) || 0), 0);
    const getElemTotal = () => (formData.kinder || 0) + (formData.g1 || 0) + (formData.g2 || 0) + (formData.g3 || 0) + (formData.g4 || 0) + (formData.g5 || 0) + (formData.g6 || 0);
    const getJHSTotal = () => (formData.g7 || 0) + (formData.g8 || 0) + (formData.g9 || 0) + (formData.g10 || 0);
    const getSHSTotal = () => (formData.g11 || 0) + (formData.g12 || 0);

    // --- HANDLER FIXES ---
    const handleChange = (name, value) => {
        const cleanValue = value.replace(/[^0-9]/g, '').slice(0, 3);
        const intValue = cleanValue === '' ? '' : parseInt(cleanValue, 10);
        setFormData(prev => ({ ...prev, [name]: intValue }));
    };

    const handleClassSizeChange = (e) => {
        const { name, value } = e.target;
        const cleanValue = value.replace(/[^0-9]/g, '').slice(0, 3);
        const intValue = cleanValue === '' ? '' : parseInt(cleanValue, 10);
        setClassSizeData(prev => ({ ...prev, [name]: intValue }));
    };

    // --- ACTIONS ---
    const handleConfirmEdit = () => {
        setOriginalData({ ...formData, classSize: { ...classSizeData } });
        setIsLocked(false);
        setShowEditModal(false);
    };

    // --- VALIDATION ---
    const isFormValid = () => {
        const isValidEntry = (value) => value !== '' && value !== null && value !== undefined;
        const grades = [];
        if (showElem()) grades.push('kinder', '1', '2', '3', '4', '5', '6');
        if (showJHS()) grades.push('7', '8', '9', '10');
        if (showSHS()) grades.push('11', '12');

        // Check Grade Enrolment Inputs
        for (const g of grades) {
            const key = g === 'kinder' ? 'kinder' : `g${g}`;
            if (!isValidEntry(formData[key])) return false;
        }

        // Check Class Size Inputs
        const sizeGrades = [];
        if (showElem()) sizeGrades.push('Kinder', '1', '2', '3', '4', '5', '6');
        if (showJHS()) sizeGrades.push('7', '8', '9', '10');
        if (showSHS()) sizeGrades.push('11', '12');

        for (const g of sizeGrades) {
            if (!isValidEntry(classSizeData[`cntLessG${g}`]) ||
                !isValidEntry(classSizeData[`cntWithinG${g}`]) ||
                !isValidEntry(classSizeData[`cntAboveG${g}`])) return false;
        }

        return true;
    };

    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);

        const payload = {
            schoolId: schoolId || localStorage.getItem('schoolId'),
            kinder: showElem() ? formData.kinder : 0,
            g1: showElem() ? formData.g1 : 0, g2: showElem() ? formData.g2 : 0, g3: showElem() ? formData.g3 : 0,
            g4: showElem() ? formData.g4 : 0, g5: showElem() ? formData.g5 : 0, g6: showElem() ? formData.g6 : 0,
            g7: showJHS() ? formData.g7 : 0, g8: showJHS() ? formData.g8 : 0, g9: showJHS() ? formData.g9 : 0, g10: showJHS() ? formData.g10 : 0,
            g11: showSHS() ? formData.g11 : 0, g12: showSHS() ? formData.g12 : 0,
            ...classSizeData
        };

        if (!navigator.onLine) {
            try {
                await addToOutbox({
                    type: 'ORGANIZED_CLASSES', label: 'Organized Classes', url: '/api/save-organized-classes', payload
                });
                setShowOfflineModal(true);
                setOriginalData({ ...formData });
                setIsLocked(true);
            } catch (e) { alert("Failed to save offline."); }
            finally { setIsSaving(false); }
            return;
        }

        try {
            const res = await fetch('/api/save-organized-classes', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (res.ok) {
                setShowSuccessModal(true);
                setOriginalData({ ...formData, classSize: { ...classSizeData } });
                setIsLocked(true);
            } else { throw new Error("Server Error"); }
        } catch (err) {
            await addToOutbox({
                type: 'ORGANIZED_CLASSES', label: 'Organized Classes', url: '/api/save-organized-classes', payload
            });
            setShowOfflineModal(true);
            setIsLocked(true);
        } finally { setIsSaving(false); }
    };

    if (loading) return <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-900"><div className="w-10 h-10 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div></div>;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-40">
            {/* --- PREMIUM BLUE HEADER (Question Format) --- */}
            <div className="bg-[#004A99] px-6 pt-10 pb-20 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                            <FiArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Organized Classes</h1>
                            <p className="text-blue-100 text-xs font-medium mt-1">Q: How many sections are there per grade level?</p>
                        </div>
                    </div>
                    <button onClick={() => setShowInfoModal(true)} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                        <FiHelpCircle size={24} />
                    </button>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-4xl mx-auto space-y-5">

                {/* TOTAL BANNER MATCHING ENROLMENT */}
                <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Classes</p>
                        <p className="text-[10px] text-slate-400 font-medium">Grand Total (ES + JHS + SHS)</p>
                    </div>
                    <div className="text-5xl font-black text-[#004A99] tracking-tighter">{getTotalClasses()}</div>
                </div>

                <form onSubmit={(e) => e.preventDefault()}>
                    {/* --- ELEMENTARY --- */}
                    {showElem() && (
                        <GridSection label="Elementary" icon={<TbSchool />} color="text-orange-600 bg-orange-500" totalLabel="Sections" totalValue={getElemTotal()}>
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                                {[
                                    { l: 'Kinder', k: 'kinder' },
                                    { l: 'Grade 1', k: 'g1' }, { l: 'Grade 2', k: 'g2' }, { l: 'Grade 3', k: 'g3' },
                                    { l: 'Grade 4', k: 'g4' }, { l: 'Grade 5', k: 'g5' }, { l: 'Grade 6', k: 'g6' }
                                ].map((item) => (
                                    <div key={item.k} className="text-center group">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block group-hover:text-blue-500 transition-colors w-full truncate">{item.l}</label>
                                        <p className="text-[9px] text-slate-400 font-medium mb-1.5 block">Total Sections</p>
                                        <input
                                            type="text" inputMode="numeric" pattern="[0-9]*"
                                            value={formData[item.k] === '' || formData[item.k] === null ? '' : formData[item.k]}
                                            onChange={(e) => handleChange(item.k, e.target.value)}
                                            disabled={isLocked || viewOnly}
                                            className="w-full h-12 text-center font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm hover:border-blue-200"
                                        />
                                    </div>
                                ))}
                            </div>
                        </GridSection>
                    )}

                    {/* --- JHS --- */}
                    {showJHS() && (
                        <GridSection label="Junior High" icon={<FiGrid />} color="text-indigo-600 bg-indigo-500" totalLabel="Sections" totalValue={getJHSTotal()}>
                            <div className="grid grid-cols-4 gap-2 max-w-lg mx-auto">
                                {[
                                    { l: 'Grade 7', k: 'g7' }, { l: 'Grade 8', k: 'g8' },
                                    { l: 'Grade 9', k: 'g9' }, { l: 'Grade 10', k: 'g10' }
                                ].map((item) => (
                                    <div key={item.k} className="text-center group">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block group-hover:text-blue-500 transition-colors w-full truncate">{item.l}</label>
                                        <p className="text-[9px] text-slate-400 font-medium mb-1.5 block">Total Sections</p>
                                        <input
                                            type="text" inputMode="numeric" pattern="[0-9]*"
                                            value={formData[item.k] === '' || formData[item.k] === null ? '' : formData[item.k]}
                                            onChange={(e) => handleChange(item.k, e.target.value)}
                                            disabled={isLocked || viewOnly}
                                            className="w-full h-12 text-center font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm hover:border-blue-200"
                                        />
                                    </div>
                                ))}
                            </div>
                        </GridSection>
                    )}

                    {/* --- SHS --- */}
                    {showSHS() && (
                        <GridSection label="Senior High" icon={<FiLayers />} color="text-purple-600 bg-purple-500" totalLabel="Sections" totalValue={getSHSTotal()}>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-sm mx-auto">
                                {[
                                    { l: 'Grade 11', k: 'g11' }, { l: 'Grade 12', k: 'g12' }
                                ].map((item) => (
                                    <div key={item.k} className="text-center group">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block group-hover:text-blue-500 transition-colors w-full truncate">{item.l}</label>
                                        <p className="text-[9px] text-slate-400 font-medium mb-1.5 block">Total Sections</p>
                                        <input
                                            type="text" inputMode="numeric" pattern="[0-9]*"
                                            value={formData[item.k] === '' || formData[item.k] === null ? '' : formData[item.k]}
                                            onChange={(e) => handleChange(item.k, e.target.value)}
                                            disabled={isLocked || viewOnly}
                                            className="w-full h-12 text-center font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm hover:border-blue-200"
                                        />
                                    </div>
                                ))}
                            </div>
                        </GridSection>
                    )}

                    {!showElem() && !showJHS() && !showSHS() && (
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
                            <p className="text-slate-400 font-bold">No offering details found.</p>
                            <p className="text-xs text-slate-400 mt-2">Please ensure your <b>School Profile</b> is complete.</p>
                        </div>
                    )}

                    {/* --- CLASS SIZE STANDARD TABLE (Restored & Styled) --- */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl">
                                <FiBarChart2 />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-800">Class Size Standards</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Analysis per Category</p>
                                <p className="text-xs text-blue-600 mt-2 bg-blue-50 p-2 rounded-lg border border-blue-100 italic">
                                    How many sections have class size that is less than, within, or above the standard?
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-center border-b border-slate-50">
                                    <tr>
                                        <th className="pb-3 text-left pl-2">Grade Level</th>
                                        <th className="pb-3 text-emerald-600">{"< 50"} <br /> (Less than)</th>
                                        <th className="pb-3 text-blue-600">{"50 - 60"} <br /> (Within)</th>
                                        <th className="pb-3 text-red-600">{"> 60"} <br /> (Above)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {[
                                        ...(showElem() ? [1, 2, 3, 4, 5, 6] : []),
                                        ...(showJHS() ? [7, 8, 9, 10] : []),
                                        ...(showSHS() ? [11, 12] : [])
                                    ].map(g => (
                                        <tr key={g} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="py-2 pl-2 font-bold text-slate-600 text-xs text-left">Grade {g}</td>
                                            <td className="p-1">
                                                <p className="text-[9px] text-slate-400 font-medium mb-1 block text-center">Total Sections</p>
                                                <input
                                                    type="text" inputMode="numeric" pattern="[0-9]*"
                                                    name={`cntLessG${g}`}
                                                    value={classSizeData[`cntLessG${g}`] === '' || classSizeData[`cntLessG${g}`] === null ? '' : classSizeData[`cntLessG${g}`]}
                                                    onChange={handleClassSizeChange}
                                                    disabled={isLocked || viewOnly}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-emerald-700 bg-emerald-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs transition-all hover:border-emerald-200"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <p className="text-[9px] text-slate-400 font-medium mb-1 block text-center">Total Sections</p>
                                                <input
                                                    type="text" inputMode="numeric" pattern="[0-9]*"
                                                    name={`cntWithinG${g}`}
                                                    value={classSizeData[`cntWithinG${g}`] === '' || classSizeData[`cntWithinG${g}`] === null ? '' : classSizeData[`cntWithinG${g}`]}
                                                    onChange={handleClassSizeChange}
                                                    disabled={isLocked || viewOnly}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-blue-700 bg-blue-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs transition-all hover:border-blue-200"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <p className="text-[9px] text-slate-400 font-medium mb-1 block text-center">Total Sections</p>
                                                <input
                                                    type="text" inputMode="numeric" pattern="[0-9]*"
                                                    name={`cntAboveG${g}`}
                                                    value={classSizeData[`cntAboveG${g}`] === '' || classSizeData[`cntAboveG${g}`] === null ? '' : classSizeData[`cntAboveG${g}`]}
                                                    onChange={handleClassSizeChange}
                                                    disabled={isLocked || viewOnly}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-red-700 bg-red-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-xs transition-all hover:border-red-200"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </form>
            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-100 p-4 pb-8 z-40">
                <div className="max-w-lg mx-auto flex gap-3">
                    {viewOnly ? (
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

            {/* MODALS */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4 text-amber-500 text-2xl">
                            <FiAlertCircle />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Edit Class Data?</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6">You are to update organized class data. Proceed carefully.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancel</button>
                            <button onClick={handleConfirmEdit} className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold shadow-sm hover:bg-amber-600">Unlock</button>
                        </div>
                    </div>
                </div>
            )}

            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-blue-600 text-2xl">
                            <FiCheckCircle />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Confirm Save</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6">Are you sure you want to save the organized class data?</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancel</button>
                            <button onClick={confirmSave} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800">Confirm</button>
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
                        <p className="text-sm text-slate-500 mt-2 mb-6 text-center">This form is answering the question: <b>'How many sections are there per grade level?'</b></p>
                        <button onClick={() => setShowInfoModal(false)} className="w-full py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition-transform active:scale-95">Got it</button>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="Organized Classes saved successfully!" />
        </div>
    );
};

export default OrganizedClasses;