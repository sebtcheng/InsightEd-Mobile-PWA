
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { addToOutbox, getOutbox } from '../db';
import { FiArrowLeft, FiSave, FiGrid, FiLayers, FiAlertCircle, FiCheckCircle, FiHelpCircle, FiInfo } from 'react-icons/fi';
import { TbSchool } from 'react-icons/tb';
import SuccessModal from '../components/SuccessModal';
import OfflineSuccessModal from '../components/OfflineSuccessModal';

import { normalizeOffering } from '../utils/dataNormalization';
import useReadOnly from '../hooks/useReadOnly'; // Import Hook

// --- SUB-COMPONENT: Generic Grid Section (Adapted from LearnerStatistics) ---
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

const Enrolment = ({ embedded = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');
    const isDummy = location.state?.isDummy || false;
    const isSuperUserReadOnly = useReadOnly(); // Use Hook

    // Super User / Audit Context
    const isSuperUser = localStorage.getItem('userRole') === 'Super User';
    const auditTargetId = sessionStorage.getItem('targetSchoolId');
    const isAuditMode = isSuperUser && !!auditTargetId;

    const [isReadOnly, setIsReadOnly] = useState(isDummy || isSuperUserReadOnly || isAuditMode);

    // Sync state if hook changes
    useEffect(() => {
        if (isSuperUserReadOnly) setIsReadOnly(true);
    }, [isSuperUserReadOnly]);

    // State
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);


    // --- AUTO-SHOW INFO MODAL ---
    useEffect(() => {
        const hasSeenInfo = localStorage.getItem('hasSeenEnrolmentInfo');
        if (!hasSeenInfo) {
            setShowInfoModal(true);
            localStorage.setItem('hasSeenEnrolmentInfo', 'true');
        }
    }, []);

    // --- SAVE TIMER EFFECTS ---


    // Core Data
    const [schoolId, setSchoolId] = useState(null);
    const [curricularOffering, setCurricularOffering] = useState('');

    // Form Data (Snake Case)
    const initialFields = {
        // Elementary
        grade_kinder: '', grade_1: '', grade_2: '', grade_3: '',
        grade_4: '', grade_5: '', grade_6: '',
        // JHS
        grade_7: '', grade_8: '', grade_9: '', grade_10: '',
        // SHS Strands 11
        abm_11: '', stem_11: '', humss_11: '', gas_11: '',
        tvl_ict_11: '', tvl_he_11: '', tvl_ia_11: '', tvl_afa_11: '',
        arts_11: '', sports_11: '',
        // SHS Strands 12
        abm_12: '', stem_12: '', humss_12: '', gas_12: '',
        tvl_ict_12: '', tvl_he_12: '', tvl_ia_12: '', tvl_afa_12: '',
        arts_12: '', sports_12: '',

        // ARAL Data
        aral_math_g1: '', aral_read_g1: '', aral_sci_g1: '',
        aral_math_g2: '', aral_read_g2: '', aral_sci_g2: '',
        aral_math_g3: '', aral_read_g3: '', aral_sci_g3: '',
        aral_math_g4: '', aral_read_g4: '', aral_sci_g4: '',
        aral_math_g5: '', aral_read_g5: '', aral_sci_g5: '',
        aral_math_g6: '', aral_read_g6: '', aral_sci_g6: '',

        // Inclusive Education
        sned_learners: '', non_graded_learners: '',

        // Totals (Computed)
        es_enrollment: 0, jhs_enrollment: 0, shs_enrollment: 0, total_enrollment: 0,
        aral_total: 0, grade_11: 0, grade_12: 0
    };

    const [formData, setFormData] = useState(initialFields);
    const [originalData, setOriginalData] = useState(initialFields);

    const goBack = () => {
        if (isDummy) {
            navigate('/dummy-forms', { state: { type: 'school' } });
        } else {
            navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');
        }
    };

    // --- VISIBILITY HELPERS (Case Insensitive) ---
    const offeringLower = curricularOffering?.toLowerCase() || '';
    const isPermissive = () => !offeringLower || offeringLower.includes('no curricular');
    const showElem = () => offeringLower.includes("elementary") || offeringLower.includes("k-12") || offeringLower.includes("k-10") || isPermissive();
    const showJHS = () => offeringLower.includes("junior") || offeringLower.includes("secondary") || offeringLower.includes("k-12") || offeringLower.includes("k-10") || isPermissive();
    const showSHS = () => offeringLower.includes("senior") || offeringLower.includes("secondary") || offeringLower.includes("k-12") || isPermissive();

    // --- INSTANT LOAD STRATEGY ---
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

                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');
                if (storedSchoolId) setSchoolId(storedSchoolId);
                if (storedOffering) setCurricularOffering(storedOffering);

                // 1. SYNC CACHE LOADING
                const CACHE_KEY = `CACHE_ENROLMENT_${user.uid}`;
                const cachedData = localStorage.getItem(CACHE_KEY);

                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        const cleaned = {};
                        Object.keys(initialFields).forEach(key => {
                            if (parsed[key] !== undefined) cleaned[key] = parsed[key];
                            // Legacy mapping just in case
                            if (key === 'grade_kinder' && parsed.gradeKinder !== undefined) cleaned[key] = parsed.gradeKinder;
                            if (key === 'grade_1' && parsed.grade1 !== undefined) cleaned[key] = parsed.grade1;
                        });

                        const merged = { ...initialFields, ...parsed, ...cleaned };
                        setFormData(merged);
                        setOriginalData(merged);
                        if (parsed.curricular_offering) setCurricularOffering(parsed.curricular_offering);

                        setIsLocked((merged.total_enrollment || 0) > 0);
                        setLoading(false); // CRITICAL: Instant Load
                        console.log("Loaded cached Enrolment (Instant Load)");
                    } catch (e) { console.error("Cache error", e); }
                }

                // 2. ASYNC CHECKS
                const performAsyncChecks = async () => {
                    let restored = false;
                    if (!viewOnly) {
                        try {
                            const drafts = await getOutbox();
                            const draft = drafts.find(d => d.type === 'ENROLMENT');
                            if (draft) {
                                console.log("Restored draft from Outbox");
                                setFormData({ ...initialFields, ...draft.payload });
                                setSchoolId(draft.payload.school_id);
                                setCurricularOffering(draft.payload.curricular_offering);
                                setIsLocked(false);
                                restored = true;
                                setLoading(false);
                                return;
                            }
                        } catch (e) { console.error("Outbox check failed", e); }
                    }

                    if (!restored) {
                        let fetchUrl = `/api/enrolment/${user.uid}`;
                        const role = localStorage.getItem('userRole');

                        if (isAuditMode) {
                            fetchUrl = `/api/monitoring/school-detail/${auditTargetId}`;
                        } else if ((viewOnly || role === 'Central Office' || isDummy) && schoolIdParam) {
                            fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                        }

                        if (!cachedData) setLoading(true);

                        try {
                            const res = await fetch(fetchUrl);
                            if (res.ok) {
                                const json = await res.json();
                                // For Audit Mode, we treat it like viewOnly with schoolIdParam
                                const data = (isAuditMode || (viewOnly && schoolIdParam)) ? json : (json.exists ? json.data : null);

                                if (data) {
                                    setSchoolId(data.school_id);
                                    const normOffering = normalizeOffering(data.curricular_offering || storedOffering);
                                    setCurricularOffering(normOffering);
                                    if (!viewOnly) {
                                        localStorage.setItem('schoolId', data.school_id);
                                        if (data.curricular_offering) localStorage.setItem('schoolOffering', normOffering);
                                    }

                                    const loaded = {};
                                    Object.keys(initialFields).forEach(key => {
                                        loaded[key] = data[key] ?? 0;
                                    });

                                    setFormData(loaded);
                                    setOriginalData(loaded);
                                    setIsLocked((loaded.total_enrollment || 0) > 0);
                                    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
                                }
                            }
                        } catch (e) { console.error("Fetch Error", e); }
                        finally { setLoading(false); }
                    }
                };
                performAsyncChecks();
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- AUTO-CALCULATE TOTALS ---
    useEffect(() => {
        setFormData(prev => {
            const es = (prev.grade_kinder || 0) + (prev.grade_1 || 0) + (prev.grade_2 || 0) + (prev.grade_3 || 0) +
                (prev.grade_4 || 0) + (prev.grade_5 || 0) + (prev.grade_6 || 0);

            const jhs = (prev.grade_7 || 0) + (prev.grade_8 || 0) + (prev.grade_9 || 0) + (prev.grade_10 || 0);

            const g11 = (prev.abm_11 || 0) + (prev.stem_11 || 0) + (prev.humss_11 || 0) + (prev.gas_11 || 0) +
                (prev.tvl_ict_11 || 0) + (prev.tvl_he_11 || 0) + (prev.tvl_ia_11 || 0) + (prev.tvl_afa_11 || 0) +
                (prev.arts_11 || 0) + (prev.sports_11 || 0);

            const g12 = (prev.abm_12 || 0) + (prev.stem_12 || 0) + (prev.humss_12 || 0) + (prev.gas_12 || 0) +
                (prev.tvl_ict_12 || 0) + (prev.tvl_he_12 || 0) + (prev.tvl_ia_12 || 0) + (prev.tvl_afa_12 || 0) +
                (prev.arts_12 || 0) + (prev.sports_12 || 0);

            const shs = g11 + g12;
            const inclusive = (prev.sned_learners || 0) + (prev.non_graded_learners || 0);
            const grand = es + jhs + shs + inclusive;

            const aral = Object.keys(prev)
                .filter(k => k.startsWith('aral_') && k !== 'aral_total')
                .reduce((sum, key) => sum + (prev[key] || 0), 0);

            if (prev.es_enrollment !== es || prev.total_enrollment !== grand || prev.aral_total !== aral) {
                return {
                    ...prev,
                    es_enrollment: es, jhs_enrollment: jhs, shs_enrollment: shs,
                    total_enrollment: grand,
                    grade_11: g11, grade_12: g12,
                    aral_total: aral
                };
            }
            return prev;
        });
    }, [formData]);

    const handleChange = (name, value) => {
        const cleanValue = value.replace(/[^0-9]/g, '').slice(0, 5);
        const intValue = cleanValue === '' ? '' : parseInt(cleanValue, 10);
        setFormData(prev => ({ ...prev, [name]: intValue }));
    };

    // --- VALIDATION ---
    const isFormValid = () => {
        const isValidEntry = (value) => value !== '' && value !== null && value !== undefined;
        // Elementary
        if (showElem()) {
            const elemFields = ['grade_kinder', 'grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6'];
            // Also ARAL fields
            const aralFields = [];
            [1, 2, 3, 4, 5, 6].forEach(g => {
                aralFields.push(`aral_math_g${g}`, `aral_read_g${g}`, `aral_sci_g${g}`);
            });

            for (const f of [...elemFields, ...aralFields]) {
                if (!isValidEntry(formData[f])) return false;
            }
        }

        // JHS
        if (showJHS()) {
            const jhsFields = ['grade_7', 'grade_8', 'grade_9', 'grade_10'];
            for (const f of jhsFields) {
                if (!isValidEntry(formData[f])) return false;
            }
        }

        // SHS
        if (showSHS()) {
            const shsFields = [
                'abm_11', 'stem_11', 'humss_11', 'gas_11', 'tvl_ict_11', 'tvl_he_11', 'tvl_ia_11', 'tvl_afa_11', 'arts_11', 'sports_11',
                'abm_12', 'stem_12', 'humss_12', 'gas_12', 'tvl_ict_12', 'tvl_he_12', 'tvl_ia_12', 'tvl_afa_12', 'arts_12', 'sports_12'
            ];
            for (const f of shsFields) {
                if (!isValidEntry(formData[f])) return false;
            }
        }
        return true;
    };

    const confirmSave = async () => {
        console.log("Saving Enrolment...");
        setShowSaveModal(false);
        setIsSaving(true);

        const payload = {
            schoolId: schoolId || localStorage.getItem('schoolId'),
            submittedBy: auth.currentUser.uid,
            curricularOffering: curricularOffering,
            school_id: schoolId,
            curricular_offering: curricularOffering,
            ...formData,
            es_total: formData.es_enrollment,
            jhs_total: formData.jhs_enrollment,
            shs_total: formData.shs_enrollment,
            grand_total: formData.total_enrollment
            // Aliases can be added here if needed, but we try to stick to snake_case now
        };

        // Compatibility Aliases for old API
        payload.esTotal = formData.es_enrollment;
        payload.jhsTotal = formData.jhs_enrollment;
        payload.shsTotal = formData.shs_enrollment;
        payload.grandTotal = formData.total_enrollment;

        console.log("Payload:", payload);

        try {
            if (!navigator.onLine) {
                console.log("Offline detected");
                throw new Error("Offline");
            }
            const res = await fetch('/api/save-enrolment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log("Fetch response:", res.status, res.statusText);
            if (res.ok) {
                console.log("Save success!");
                setShowSuccessModal(true);
                setOriginalData({ ...formData });
                setIsLocked(true);
                localStorage.setItem(`CACHE_ENROLMENT_${auth.currentUser.uid}`, JSON.stringify(formData));
            } else {
                const txt = await res.text();
                console.error("Save failed response:", txt);
                throw new Error("Save failed");
            }
        } catch (e) {
            console.error("Save error caught:", e);
            try {
                await addToOutbox({
                    type: 'ENROLMENT', label: 'Enrolment Data', url: '/api/save-enrolment', payload
                });
                console.log("Added to outbox");
                setShowOfflineModal(true);
                setIsLocked(true);
                localStorage.setItem(`CACHE_ENROLMENT_${auth.currentUser.uid}`, JSON.stringify(formData));
            } catch (outboxErr) {
                console.error("Outbox failed:", outboxErr);
                alert("Critical Error: Could not save to outbox. " + outboxErr.message);
            }
        } finally { setIsSaving(false); }
    };

    if (loading) return <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-900"><div className="w-10 h-10 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div></div>;

    return (
        <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans ${embedded ? 'pb-32 !bg-transparent' : 'pb-40'}`}>
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
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1 bg-white/10 px-3 py-1 rounded-full border border-white/5">School Form 4</span>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-yellow-400 rounded-lg shadow-lg rotate-3">
                                    <FiLayers className="text-yellow-900 text-lg" />
                                </div>
                                <h1 className="text-xl font-bold text-white tracking-tight">Enrolment</h1>
                            </div>
                        </div>
                    </div>
                    {/* Header Stats */}
                    <div className="px-6 mt-8 flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                        <div className="flex-shrink-0 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 min-w-[120px]">
                            <span className="block text-[10px] text-blue-200 font-bold uppercase mb-1">Total Learners</span>
                            <span className="text-2xl font-black text-white">{formData.total_enrollment.toLocaleString()}</span>
                        </div>
                        {formData.aral_total > 0 && (
                            <div className="flex-shrink-0 bg-amber-500/20 backdrop-blur-md border border-amber-500/30 rounded-2xl p-3 min-w-[120px]">
                                <span className="block text-[10px] text-amber-200 font-bold uppercase mb-1">ARAL Learners</span>
                                <span className="text-2xl font-black text-amber-100">{formData.aral_total.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className={`px-5 relative z-20 max-w-3xl mx-auto space-y-4 ${embedded ? 'pt-4' : '-mt-10'}`}>

                {/* Grand Total Cards - Compact */}
                <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Enrolment</p>
                        <p className="text-[10px] text-slate-400 font-medium">Grand Total (ES + JHS + SHS)</p>
                    </div>
                    <div className="text-5xl font-black text-[#004A99] tracking-tighter">{formData.total_enrollment}</div>
                </div>

                {/* --- ELEMENTARY --- */}
                {showElem() && (
                    <GridSection label="Elementary" icon={<TbSchool />} color="text-orange-600 bg-orange-500" totalLabel="ES Total" totalValue={formData.es_enrollment}>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                            {[
                                { l: 'Kinder', k: 'grade_kinder' },
                                { l: 'Grade 1', k: 'grade_1' }, { l: 'Grade 2', k: 'grade_2' }, { l: 'Grade 3', k: 'grade_3' },
                                { l: 'Grade 4', k: 'grade_4' }, { l: 'Grade 5', k: 'grade_5' }, { l: 'Grade 6', k: 'grade_6' }
                            ].map((item) => (
                                <div key={item.k} className="text-center group">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block group-hover:text-blue-500 transition-colors w-full truncate">{item.l}</label>
                                    <p className="text-[9px] text-slate-400 font-medium mb-1.5 block">Total (All Sections)</p>
                                    <input
                                        type="text" inputMode="numeric" pattern="[0-9]*"
                                        value={formData[item.k] === '' || formData[item.k] === null ? '' : formData[item.k]}
                                        onChange={(e) => handleChange(item.k, e.target.value)}
                                        disabled={isLocked || viewOnly || isDummy || isReadOnly}
                                        className="w-full h-12 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm hover:border-blue-200"
                                        onFocus={() => formData[item.k] === 0 && handleChange(item.k, '')}
                                        onBlur={() => (formData[item.k] === '' || formData[item.k] === null) && handleChange(item.k, 0)}
                                    />
                                </div>
                            ))}
                        </div>
                    </GridSection>
                )}

                {/* --- JHS --- */}
                {showJHS() && (
                    <GridSection label="Junior High" icon={<FiGrid />} color="text-indigo-600 bg-indigo-500" totalLabel="JHS Total" totalValue={formData.jhs_enrollment}>
                        <div className="grid grid-cols-4 gap-2 max-w-lg mx-auto">
                            {[
                                { l: 'Grade 7', k: 'grade_7' }, { l: 'Grade 8', k: 'grade_8' },
                                { l: 'Grade 9', k: 'grade_9' }, { l: 'Grade 10', k: 'grade_10' }
                            ].map((item) => (
                                <div key={item.k} className="text-center group">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block group-hover:text-blue-500 transition-colors w-full truncate">{item.l}</label>
                                    <p className="text-[9px] text-slate-400 font-medium mb-1.5 block">Total (All Sections)</p>
                                    <input
                                        type="text" inputMode="numeric" pattern="[0-9]*"
                                        value={formData[item.k] === '' || formData[item.k] === null ? '' : formData[item.k]}
                                        onChange={(e) => handleChange(item.k, e.target.value)}
                                        disabled={isLocked || viewOnly || isDummy || isReadOnly}
                                        className="w-full h-12 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm hover:border-blue-200"
                                        onFocus={() => formData[item.k] === 0 && handleChange(item.k, '')}
                                        onBlur={() => (formData[item.k] === '' || formData[item.k] === null) && handleChange(item.k, 0)}
                                    />
                                </div>
                            ))}
                        </div>
                    </GridSection>
                )}

                {/* --- SHS --- */}
                {showSHS() && (
                    <GridSection label="Senior High" icon={<FiLayers />} color="text-purple-600 bg-purple-500" totalLabel="SHS Total" totalValue={formData.shs_enrollment}>
                        <div className="overflow-x-auto -mx-2 px-2">
                            <table className="w-full text-sm min-w-[300px]">
                                <thead className="text-[9px] uppercase font-bold text-slate-400 tracking-wider text-center border-b border-slate-50">
                                    <tr>
                                        <th className="pb-3 text-left pl-2">Strand</th>
                                        <th className="pb-3 w-24">Grade 11</th>
                                        <th className="pb-3 w-24">Grade 12</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {[
                                        { l: 'ABM', k11: 'abm_11', k12: 'abm_12' },
                                        { l: 'STEM', k11: 'stem_11', k12: 'stem_12' },
                                        { l: 'HUMSS', k11: 'humss_11', k12: 'humss_12' },
                                        { l: 'GAS', k11: 'gas_11', k12: 'gas_12' },
                                        { l: 'TVL - ICT', k11: 'tvl_ict_11', k12: 'tvl_ict_12' },
                                        { l: 'TVL - HE', k11: 'tvl_he_11', k12: 'tvl_he_12' },
                                        { l: 'TVL - IA', k11: 'tvl_ia_11', k12: 'tvl_ia_12' },
                                        { l: 'TVL - Agri', k11: 'tvl_afa_11', k12: 'tvl_afa_12' },
                                        { l: 'Arts', k11: 'arts_11', k12: 'arts_12' },
                                        { l: 'Sports', k11: 'sports_11', k12: 'sports_12' }
                                    ].map(row => (
                                        <tr key={row.l} className="group hover:bg-slate-50/50">
                                            <td className="py-2 pl-2 font-bold text-slate-600 text-xs">{row.l}</td>
                                            <td className="p-1 align-top">
                                                <p className="text-[9px] text-slate-400 font-medium mb-1">Total (All Sections)</p>
                                                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData[row.k11] === '' || formData[row.k11] === null ? '' : formData[row.k11]} onChange={(e) => handleChange(row.k11, e.target.value)} disabled={isLocked || viewOnly || isDummy || isReadOnly} className="w-full h-10 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none text-sm hover:bg-white transition-all" onFocus={() => formData[row.k11] === 0 && handleChange(row.k11, '')} onBlur={() => (formData[row.k11] === '' || formData[row.k11] === null) && handleChange(row.k11, 0)} />
                                            </td>
                                            <td className="p-1 align-top">
                                                <p className="text-[9px] text-slate-400 font-medium mb-1">Total (All Sections)</p>
                                                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData[row.k12] === '' || formData[row.k12] === null ? '' : formData[row.k12]} onChange={(e) => handleChange(row.k12, e.target.value)} disabled={isLocked || viewOnly || isDummy || isReadOnly} className="w-full h-10 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none text-sm hover:bg-white transition-all" onFocus={() => formData[row.k12] === 0 && handleChange(row.k12, '')} onBlur={() => (formData[row.k12] === '' || formData[row.k12] === null) && handleChange(row.k12, 0)} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </GridSection>
                )}

                {/* --- INCLUSIVE EDUCATION --- */}
                <GridSection label="Inclusive Education (Optional)" icon={<TbSchool />} color="text-emerald-600 bg-emerald-500">
                    <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                        <div className="text-center group">
                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block group-hover:text-emerald-500 transition-colors w-full truncate">SNED Learners</label>
                            <input
                                type="text" inputMode="numeric" pattern="[0-9]*"
                                value={formData.sned_learners === '' || formData.sned_learners === null ? '' : formData.sned_learners}
                                onChange={(e) => handleChange('sned_learners', e.target.value)}
                                disabled={isLocked || viewOnly || isDummy || isReadOnly}
                                className="w-full h-12 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm hover:border-emerald-200"
                                onFocus={() => formData.sned_learners === 0 && handleChange('sned_learners', '')}
                                onBlur={() => (formData.sned_learners === '' || formData.sned_learners === null) && handleChange('sned_learners', 0)}
                            />
                        </div>
                        <div className="text-center group">
                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block group-hover:text-emerald-500 transition-colors w-full truncate">Non-Graded Learners</label>
                            <input
                                type="text" inputMode="numeric" pattern="[0-9]*"
                                value={formData.non_graded_learners === '' || formData.non_graded_learners === null ? '' : formData.non_graded_learners}
                                onChange={(e) => handleChange('non_graded_learners', e.target.value)}
                                disabled={isLocked || viewOnly || isDummy || isReadOnly}
                                className="w-full h-12 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm hover:border-emerald-200"
                                onFocus={() => formData.non_graded_learners === 0 && handleChange('non_graded_learners', '')}
                                onBlur={() => (formData.non_graded_learners === '' || formData.non_graded_learners === null) && handleChange('non_graded_learners', 0)}
                            />
                        </div>
                    </div>
                </GridSection>

                {/* --- ARAL --- */}
                {showElem() && (
                    <GridSection label="Learning Recovery (ARAL)" icon={<FiAlertCircle />} color="text-amber-600 bg-amber-500" totalLabel="ARAL Total" totalValue={formData.aral_total}>
                        <div className="overflow-x-auto -mx-2 px-2">
                            <table className="w-full text-sm min-w-[300px]">
                                <thead className="text-[9px] uppercase font-bold text-amber-400 tracking-wider text-center border-b border-amber-50">
                                    <tr>
                                        <th className="pb-3 text-left pl-2">Level</th>
                                        <th className="pb-3 text-indigo-500">Math</th>
                                        <th className="pb-3 text-pink-500">Reading</th>
                                        <th className="pb-3 text-teal-500">Science</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {[1, 2, 3, 4, 5, 6].map(g => (
                                        <tr key={g} className="group hover:bg-slate-50/50">
                                            <td className="py-2 pl-2 font-bold text-slate-600 text-xs">Grade {g}</td>
                                            <td className="p-1 align-top">
                                                <p className="text-[9px] text-slate-400 font-medium mb-1">Total (All Sections)</p>
                                                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData[`aral_math_g${g}`] ?? ''} onChange={(e) => handleChange(`aral_math_g${g}`, e.target.value)} disabled={isLocked || viewOnly || isDummy || isReadOnly} className="w-full h-10 text-center font-bold text-indigo-700 bg-indigo-50/30 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-200 outline-none text-sm hover:bg-white transition-all" onFocus={() => formData[`aral_math_g${g}`] === 0 && handleChange(`aral_math_g${g}`, '')} onBlur={() => (formData[`aral_math_g${g}`] === '' || formData[`aral_math_g${g}`] === null) && handleChange(`aral_math_g${g}`, 0)} />
                                            </td>
                                            <td className="p-1 align-top">
                                                <p className="text-[9px] text-slate-400 font-medium mb-1">Total (All Sections)</p>
                                                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData[`aral_read_g${g}`] ?? ''} onChange={(e) => handleChange(`aral_read_g${g}`, e.target.value)} disabled={isLocked || viewOnly || isDummy || isReadOnly} className="w-full h-10 text-center font-bold text-pink-700 bg-pink-50/30 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-200 outline-none text-sm hover:bg-white transition-all" onFocus={() => formData[`aral_read_g${g}`] === 0 && handleChange(`aral_read_g${g}`, '')} onBlur={() => (formData[`aral_read_g${g}`] === '' || formData[`aral_read_g${g}`] === null) && handleChange(`aral_read_g${g}`, 0)} />
                                            </td>
                                            <td className="p-1 align-top">
                                                <p className="text-[9px] text-slate-400 font-medium mb-1">Total (All Sections)</p>
                                                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData[`aral_sci_g${g}`] ?? ''} onChange={(e) => handleChange(`aral_sci_g${g}`, e.target.value)} disabled={isLocked || viewOnly || isDummy || isReadOnly} className="w-full h-10 text-center font-bold text-teal-700 bg-teal-50/30 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-200 outline-none text-sm hover:bg-white transition-all" onFocus={() => formData[`aral_sci_g${g}`] === 0 && handleChange(`aral_sci_g${g}`, '')} onBlur={() => (formData[`aral_sci_g${g}`] === '' || formData[`aral_sci_g${g}`] === null) && handleChange(`aral_sci_g${g}`, 0)} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </GridSection>
                )}

            </div>

            {/* Footer Actions - Hide if embedded (read-only implies hidden usually, but embedded specifically might want to hide entirely to rely on parent) */}
            {!embedded && (
                <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-100 p-4 pb-8 z-40">
                    <div className="max-w-lg mx-auto flex gap-3">
                        {(viewOnly || isReadOnly || isSuperUserReadOnly) ? (
                            <div className="w-full text-center p-3 text-slate-500 font-bold bg-slate-200 rounded-2xl text-sm flex items-center justify-center gap-2">
                                <FiAlertCircle /> View-Only Mode
                            </div>
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
            )}

            {/* Modals */}
            {showSaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><FiAlertCircle size={24} /></div>
                        <h3 className="text-lg font-bold text-center text-slate-800 mb-2">Save Enrolment?</h3>
                        <p className="text-center text-slate-500 text-sm mb-6">Confirm that all learner counts are accurate.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                            <button onClick={confirmSave} className="flex-1 py-3 bg-[#004A99] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-transform active:scale-95">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {showInfoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><FiInfo size={24} /></div>
                        <h3 className="text-lg font-bold text-center text-slate-800 mb-2">Form Guide</h3>
                        <p className="text-center text-slate-500 text-sm mb-6">This form is answering the question: <b>'What is the total number of officially enrolled learners per grade level?'</b></p>
                        <button onClick={() => setShowInfoModal(false)} className="w-full py-3 bg-[#004A99] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-transform active:scale-95">Got it</button>
                    </div>
                </div>
            )}

            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} />
            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
        </div>
    );
};

export default Enrolment;