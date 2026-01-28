// src/forms/TeachingPersonnel.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiUser, FiBriefcase, FiAward, FiBookOpen, FiUserCheck, FiUsers, FiHelpCircle, FiInfo } from 'react-icons/fi';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
// LoadingScreen import removed
import { addToOutbox, getOutbox } from '../db';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';


// --- EXTRACTED COMPONENT ---
const TeacherInput = ({ label, name, value, onChange, disabled }) => (
    <div className="flex flex-col">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center h-6 flex items-end justify-center">{label}</label>
        <p className="text-[9px] text-slate-400 font-medium mb-1.5 text-center block">Total Teachers</p>
        <div className="relative group">
            <input
                type="number"
                min="0"
                name={name}
                value={value}
                onChange={onChange}
                disabled={disabled}
                onWheel={(e) => e.target.blur()}
                onFocus={(e) => e.target.select()}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-bold text-slate-700 text-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed group-hover:border-blue-300"
            />
        </div>
    </div>
);

const TeachingPersonnel = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
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

    // --- KEY FIX: Using teach_ prefix to match Neon Schema ---
    const [formData, setFormData] = useState({
        teach_kinder: 0, teach_g1: 0, teach_g2: 0, teach_g3: 0, teach_g4: 0, teach_g5: 0, teach_g6: 0,
        teach_g7: 0, teach_g8: 0, teach_g9: 0, teach_g10: 0,
        teach_g11: 0, teach_g12: 0,
        teach_multi_1_2: 0, teach_multi_3_4: 0, teach_multi_5_6: 0,
        teach_multi_3plus_flag: false,
        teach_multi_3plus_count: 0,

        // TEACHING EXPERIENCE
        teach_exp_0_1: 0, teach_exp_2_5: 0, teach_exp_6_10: 0,
        teach_exp_11_15: 0, teach_exp_16_20: 0, teach_exp_21_25: 0,
        teach_exp_26_30: 0, teach_exp_31_35: 0, teach_exp_36_40: 0,
        teach_exp_40_45: 0,
    });
    const isDummy = location.state?.isDummy || false;
    const [originalData, setOriginalData] = useState(null);

    const goBack = () => {
        if (isDummy) {
            navigate(-1);
        } else {
            navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');
        }
    };

    // --- FETCH DATA (Strict Instant Load Strategy) ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');
                if (storedSchoolId) setSchoolId(storedSchoolId);
                if (storedOffering) setOffering(storedOffering);

                // STEP 1: PREPARE DEFAULTS
                const defaultFormData = {
                    teach_kinder: 0, teach_g1: 0, teach_g2: 0, teach_g3: 0, teach_g4: 0, teach_g5: 0, teach_g6: 0,
                    teach_g7: 0, teach_g8: 0, teach_g9: 0, teach_g10: 0,
                    teach_g11: 0, teach_g12: 0,
                    teach_multi_1_2: 0, teach_multi_3_4: 0, teach_multi_5_6: 0,
                    teach_multi_3plus_flag: false,
                    teach_multi_3plus_count: 0,
                    teach_exp_0_1: 0, teach_exp_2_5: 0, teach_exp_6_10: 0,
                    teach_exp_11_15: 0, teach_exp_16_20: 0, teach_exp_21_25: 0,
                    teach_exp_26_30: 0, teach_exp_31_35: 0, teach_exp_36_40: 0,
                    teach_exp_40_45: 0,
                };

                // STEP 2: IMMEDIATE CACHE LOAD
                let loadedFromCache = false;
                const CACHE_KEY = `CACHE_TEACHING_PERSONNEL_${user.uid}`;
                const cachedData = localStorage.getItem(CACHE_KEY);

                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        setFormData({ ...defaultFormData, ...parsed }); // Merge with defaults
                        setOriginalData({ ...defaultFormData, ...parsed });

                        // Restore Offering from cache if available
                        if (parsed.curricular_offering || parsed.offering) {
                            setOffering(parsed.curricular_offering || parsed.offering);
                        }

                        // Check for meaningful data (any field starting with 'teach_' > 0)
                        const hasCachedData = Object.entries(parsed).some(([k, v]) => k.startsWith('teach_') && Number(v) > 0);
                        setIsLocked(hasCachedData);
                        setLoading(false); // CRITICAL: Instant Load
                        loadedFromCache = true;
                        console.log("Loaded cached Teaching Personnel (Instant Load)");
                    } catch (e) { console.error("Cache parse error", e); }
                }

                // STEP 3: ASYNC OPERATIONS (Outbox & Network)
                const performAsyncChecks = async () => {
                    let restored = false;

                    // A. Check Outbox
                    if (!viewOnly) {
                        try {
                            const drafts = await getOutbox();
                            const draft = drafts.find(d => d.type === 'TEACHING_PERSONNEL');
                            if (draft) {
                                console.log("Restored draft from Outbox");
                                if (draft.payload.curricular_offering || draft.payload.offering) {
                                    setOffering(draft.payload.curricular_offering || draft.payload.offering);
                                }
                                setFormData({ ...defaultFormData, ...draft.payload });
                                restored = true;
                                setIsLocked(false); // Unlocks form for draft editing
                                setLoading(false);

                                getDoc(doc(db, "users", user.uid)).then(s => { if (s.exists()) setUserRole(s.data().role); });
                                return;
                            }
                        } catch (e) { console.error("Outbox check failed:", e); }
                    }

                    // B. Network Fetch
                    if (!restored) {
                        let fetchUrl = `/api/teaching-personnel/${user.uid}`;
                        if (viewOnly && schoolIdParam) {
                            fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                        }

                        // Only show loading if we didn't load from cache
                        if (!loadedFromCache) setLoading(true);

                        try {
                            const [userDoc, apiResult] = await Promise.all([
                                getDoc(doc(db, "users", user.uid)).catch(e => ({ exists: () => false })),
                                fetch(fetchUrl).then(res => res.json()).catch(e => ({ error: e, exists: false }))
                            ]);

                            if (userDoc.exists()) setUserRole(userDoc.data().role);

                            const json = apiResult;

                            if (json.exists || (viewOnly && schoolIdParam)) {
                                // Update School ID / Offering
                                const newOffering = json.curricular_offering || json.offering || storedOffering || '';
                                setSchoolId(json.school_id || json.schoolId || storedSchoolId);
                                setOffering(newOffering);

                                if (!viewOnly && json.school_id) {
                                    localStorage.setItem('schoolId', json.school_id);
                                    localStorage.setItem('schoolOffering', newOffering);
                                }

                                const dbData = (viewOnly && schoolIdParam) ? json : json.data;

                                // Map DB to Form (re-using initial structure for safety)
                                const initialData = {
                                    teach_kinder: dbData.teach_kinder || 0,
                                    teach_g1: dbData.teach_g1 || 0, teach_g2: dbData.teach_g2 || 0, teach_g3: dbData.teach_g3 || 0,
                                    teach_g4: dbData.teach_g4 || 0, teach_g5: dbData.teach_g5 || 0, teach_g6: dbData.teach_g6 || 0,
                                    teach_g7: dbData.teach_g7 || 0, teach_g8: dbData.teach_g8 || 0, teach_g9: dbData.teach_g9 || 0, teach_g10: dbData.teach_g10 || 0,
                                    teach_g11: dbData.teach_g11 || 0, teach_g12: dbData.teach_g12 || 0,
                                    teach_multi_1_2: dbData.teach_multi_1_2 || 0,
                                    teach_multi_3_4: dbData.teach_multi_3_4 || 0,
                                    teach_multi_5_6: dbData.teach_multi_5_6 || 0,
                                    teach_multi_3plus_flag: dbData.teach_multi_3plus_flag || false,
                                    teach_multi_3plus_count: dbData.teach_multi_3plus_count || 0,
                                    teach_exp_0_1: dbData.teach_exp_0_1 || 0,
                                    teach_exp_2_5: dbData.teach_exp_2_5 || 0,
                                    teach_exp_6_10: dbData.teach_exp_6_10 || 0,
                                    teach_exp_11_15: dbData.teach_exp_11_15 || 0,
                                    teach_exp_16_20: dbData.teach_exp_16_20 || 0,
                                    teach_exp_21_25: dbData.teach_exp_21_25 || 0,
                                    teach_exp_26_30: dbData.teach_exp_26_30 || 0,
                                    teach_exp_31_35: dbData.teach_exp_31_35 || 0,
                                    teach_exp_36_40: dbData.teach_exp_36_40 || 0,
                                    teach_exp_40_45: dbData.teach_exp_40_45 || 0,
                                };

                                setFormData(initialData);
                                setOriginalData(initialData);
                                setIsLocked(Object.values(initialData).some(v => Number(v) > 0));

                                // UPDATE CACHE
                                const cachePayload = { ...initialData, curricular_offering: newOffering, schoolId: json.school_id };
                                localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
                            }
                        } catch (err) {
                            console.error("Fetch Error:", err);
                        } finally {
                            setLoading(false);
                        }
                    }
                };

                performAsyncChecks();
            }
        });
        return () => unsubscribe();
    }, []);

    // --- HELPERS ---
    const showElem = () => offering.includes("Elementary") || offering.includes("K-12") || offering.includes("K-10");
    const showJHS = () => offering.includes("Junior") || offering.includes("K-12") || offering.includes("K-10");
    const showSHS = () => offering.includes("Senior") || offering.includes("K-12");

    const getTotal = () => Object.values(formData).reduce((a, b) => a + (parseInt(b) || 0), 0);

    const handleChange = (e) => {
        let val = e.target.value;
        // Limit to 3 digits
        if (typeof val === 'string') {
            val = val.replace(/[^0-9]/g, '').slice(0, 3);
        }
        const intVal = val === '' ? '' : parseInt(val);
        setFormData({ ...formData, [e.target.name]: intVal });
    };

    const handleUpdateClick = () => setShowEditModal(true);
    const handleConfirmEdit = () => {
        setOriginalData({ ...formData });
        setIsLocked(false);
        setShowEditModal(false);
    };

    const handleCancelEdit = () => {
        if (originalData) setFormData(originalData);
        setIsLocked(true);
    };

    // Inside src/forms/TeachingPersonnel.jsx

    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);

        const user = auth.currentUser;

        // We send the UID so the backend can find the row WHERE submitted_by = uid
        const payload = {
            uid: user.uid,
            schoolId: schoolId || localStorage.getItem('schoolId'),
            ...formData // This contains teach_kinder, teach_g1, etc.
        };

        // 1. OFFLINE LOGIC
        if (!navigator.onLine) {
            try {
                await addToOutbox({
                    type: 'TEACHING_PERSONNEL',
                    label: 'Teaching Personnel',
                    url: '/api/save-teaching-personnel',
                    payload: payload
                });
                setShowOfflineModal(true);
                setOriginalData({ ...formData });
                setIsLocked(true);
            } finally {
                setIsSaving(false);
            }
            return;
        }

        // 2. ONLINE LOGIC
        try {
            const response = await fetch('/api/save-teaching-personnel', {
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
                // This will now tell you if the school_id was not found
                alert('Error: ' + err.error);
            }
        } catch (error) {
            alert("Network Error. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const saveOffline = async (payload) => {
        try {
            await addToOutbox({
                type: 'TEACHING_PERSONNEL',
                label: 'Teaching Personnel',
                url: '/api/save-teaching-personnel',
                payload: payload
            });
            setShowOfflineModal(true);
            setOriginalData({ ...formData });
            setIsLocked(true);
        } catch (e) { alert("Offline save failed."); }
    };

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
                                <h1 className="text-2xl font-bold text-white tracking-tight">Teaching Personnel</h1>
                                {offering && (
                                    <span className="px-2 py-0.5 rounded-lg bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/10">
                                        {offering}
                                    </span>
                                )}
                            </div>
                            <p className="text-blue-100 text-xs font-medium mt-1">
                                Q: What is the total number of teachers assigned to each grade level and their experience profile?
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setShowInfoModal(true)} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                        <FiHelpCircle size={24} />
                    </button>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-4xl mx-auto space-y-6">

                {/* Total Counts Banner */}
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-blue-900/5 border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-50" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-50 rounded-full -ml-12 -mb-12 blur-xl opacity-50" />

                    <div className="relative flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
                                <FiUsers size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Faculty</p>
                                <p className="text-2xl font-black text-slate-800 tracking-tight">{getTotal()}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isLocked ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                {isLocked ? 'View Mode' : 'Editing'}
                            </div>
                        </div>
                    </div>
                </div>

                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                    {showElem() && (
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                    <FiUser size={20} />
                                </div>
                                <div>
                                    <h2 className="text-slate-800 font-bold text-lg">Elementary</h2>
                                    <p className="text-xs text-slate-400 font-medium">Kinder to Grade 6 Faculty</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <TeacherInput label="Kinder" name="teach_kinder" value={formData.teach_kinder} onChange={handleChange} disabled={isLocked || viewOnly} />
                                <TeacherInput label="Grade 1" name="teach_g1" value={formData.teach_g1} onChange={handleChange} disabled={isLocked || viewOnly} />
                                <TeacherInput label="Grade 2" name="teach_g2" value={formData.teach_g2} onChange={handleChange} disabled={isLocked || viewOnly} />
                                <TeacherInput label="Grade 3" name="teach_g3" value={formData.teach_g3} onChange={handleChange} disabled={isLocked || viewOnly} />
                                <TeacherInput label="Grade 4" name="teach_g4" value={formData.teach_g4} onChange={handleChange} disabled={isLocked || viewOnly} />
                                <TeacherInput label="Grade 5" name="teach_g5" value={formData.teach_g5} onChange={handleChange} disabled={isLocked || viewOnly} />
                                <TeacherInput label="Grade 6" name="teach_g6" value={formData.teach_g6} onChange={handleChange} disabled={isLocked || viewOnly} />
                            </div>
                        </div>
                    )}

                    {showJHS() && (
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <FiBookOpen size={20} />
                                </div>
                                <div>
                                    <h2 className="text-slate-800 font-bold text-lg">Junior High School</h2>
                                    <p className="text-xs text-slate-400 font-medium">Grade 7 to Grade 10 Faculty</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <TeacherInput label="Grade 7" name="teach_g7" value={formData.teach_g7} onChange={handleChange} disabled={isLocked || viewOnly} />
                                <TeacherInput label="Grade 8" name="teach_g8" value={formData.teach_g8} onChange={handleChange} disabled={isLocked || viewOnly} />
                                <TeacherInput label="Grade 9" name="teach_g9" value={formData.teach_g9} onChange={handleChange} disabled={isLocked || viewOnly} />
                                <TeacherInput label="Grade 10" name="teach_g10" value={formData.teach_g10} onChange={handleChange} disabled={isLocked || viewOnly} />
                            </div>
                        </div>
                    )}

                    {showSHS() && (
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                                    <FiAward size={20} />
                                </div>
                                <div>
                                    <h2 className="text-slate-800 font-bold text-lg">Senior High School</h2>
                                    <p className="text-xs text-slate-400 font-medium">Grade 11 & 12 Faculty</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <TeacherInput label="Grade 11" name="teach_g11" value={formData.teach_g11} onChange={handleChange} disabled={isLocked || viewOnly} />
                                <TeacherInput label="Grade 12" name="teach_g12" value={formData.teach_g12} onChange={handleChange} disabled={isLocked || viewOnly} />
                            </div>
                        </div>
                    )}

                    {showElem() && (
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                    <FiUserCheck size={20} />
                                </div>
                                <div>
                                    <h2 className="text-slate-800 font-bold text-lg">Multigrade Classes</h2>
                                    <p className="text-xs text-slate-400 font-medium">Combined grade level assignments</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <TeacherInput label="Grade 1 & 2" name="teach_multi_1_2" value={formData.teach_multi_1_2} onChange={handleChange} disabled={isLocked || viewOnly} />
                                <TeacherInput label="Grade 3 & 4" name="teach_multi_3_4" value={formData.teach_multi_3_4} onChange={handleChange} disabled={isLocked || viewOnly} />
                                <TeacherInput label="Grade 5 & 6" name="teach_multi_5_6" value={formData.teach_multi_5_6} onChange={handleChange} disabled={isLocked || viewOnly} />
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4 text-center">
                                    Does any teacher handle 3+ grades?
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => !isLocked && !viewOnly && setFormData({ ...formData, teach_multi_3plus_flag: true })}
                                        className={`flex-1 py-3 rounded-xl font-bold border transition-all ${formData.teach_multi_3plus_flag
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-[1.02]'
                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        disabled={isLocked || viewOnly}
                                    >
                                        Yes
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => !isLocked && !viewOnly && setFormData({ ...formData, teach_multi_3plus_flag: false, teach_multi_3plus_count: 0 })}
                                        className={`flex-1 py-3 rounded-xl font-bold border transition-all ${!formData.teach_multi_3plus_flag
                                            ? 'bg-slate-700 text-white border-slate-700 shadow-md transform scale-[1.02]'
                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        disabled={isLocked || viewOnly}
                                    >
                                        No
                                    </button>
                                </div>

                                {formData.teach_multi_3plus_flag && (
                                    <div className="mt-6 animate-in slide-in-from-top-2 fade-in duration-300">
                                        <TeacherInput label="How many teachers?" name="teach_multi_3plus_count" value={formData.teach_multi_3plus_count} onChange={handleChange} disabled={isLocked || viewOnly} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                                <FiBriefcase size={20} />
                            </div>
                            <div>
                                <h2 className="text-slate-800 font-bold text-lg">Teaching Experience</h2>
                                <p className="text-xs text-slate-400 font-medium">Based on service duration</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <TeacherInput label="0-1 Years" name="teach_exp_0_1" value={formData.teach_exp_0_1} onChange={handleChange} disabled={isLocked || viewOnly} />
                            <TeacherInput label="2-5 Years" name="teach_exp_2_5" value={formData.teach_exp_2_5} onChange={handleChange} disabled={isLocked || viewOnly} />
                            <TeacherInput label="6-10 Years" name="teach_exp_6_10" value={formData.teach_exp_6_10} onChange={handleChange} disabled={isLocked || viewOnly} />
                            <TeacherInput label="11-15 Years" name="teach_exp_11_15" value={formData.teach_exp_11_15} onChange={handleChange} disabled={isLocked || viewOnly} />
                            <TeacherInput label="16-20 Years" name="teach_exp_16_20" value={formData.teach_exp_16_20} onChange={handleChange} disabled={isLocked || viewOnly} />
                            <TeacherInput label="21-25 Years" name="teach_exp_21_25" value={formData.teach_exp_21_25} onChange={handleChange} disabled={isLocked || viewOnly} />
                            <TeacherInput label="26-30 Years" name="teach_exp_26_30" value={formData.teach_exp_26_30} onChange={handleChange} disabled={isLocked || viewOnly} />
                            <TeacherInput label="31-35 Years" name="teach_exp_31_35" value={formData.teach_exp_31_35} onChange={handleChange} disabled={isLocked || viewOnly} />
                            <TeacherInput label="36-40 Years" name="teach_exp_36_40" value={formData.teach_exp_36_40} onChange={handleChange} disabled={isLocked || viewOnly} />
                            <TeacherInput label="40-45 Years" name="teach_exp_40_45" value={formData.teach_exp_40_45} onChange={handleChange} disabled={isLocked || viewOnly} />
                        </div>
                    </div>
                </form>
            </div >

            {/* --- STANDARDIZED FOOTER (Unlock to Edit) --- */}
            <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-50">
                <div className="max-w-4xl mx-auto flex gap-3">
                    {viewOnly ? (
                        <button onClick={() => navigate(-1)} className="w-full py-4 rounded-2xl bg-[#004A99] text-white font-bold shadow-lg">
                            Back to List
                        </button>
                    ) : isLocked ? (
                        <button
                            onClick={() => setIsLocked(false)}
                            className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                        >
                            🔓 Unlock to Edit Data
                        </button>
                    ) : (
                        <>
                            <button onClick={() => { setIsLocked(true); setFormData(originalData || formData); }} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 font-bold">
                                Cancel
                            </button>
                            <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] py-4 rounded-2xl bg-[#004A99] text-white font-bold shadow-lg">
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
                        <h3 className="font-bold text-xl text-slate-800 mb-2">Enable Editing?</h3>
                        <p className="text-slate-500 text-sm mb-6">This allows you to modify the teaching personnel data.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={handleConfirmEdit} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-colors">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <FiUsers size={24} />
                        </div>
                        <h3 className="font-bold text-xl text-slate-800 text-center mb-2">Save Changes?</h3>
                        <p className="text-slate-500 text-center text-sm mb-6">You are about to update the teaching personnel record.</p>
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
                        <p className="text-sm text-slate-500 mt-2 mb-6 text-center">This form is answering the question: <b>'What is the total number of teachers assigned to each grade level and their experience profile?'</b></p>
                        <button onClick={() => setShowInfoModal(false)} className="w-full py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition-transform active:scale-95">Got it</button>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="Teaching Personnel saved successfully!" />
        </div>
    );
};

export default TeachingPersonnel;