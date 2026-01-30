// src/forms/TeacherSpecialization.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiBook, FiAward, FiBriefcase, FiCheckCircle, FiAlertCircle, FiHelpCircle, FiInfo, FiSave } from 'react-icons/fi';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
// LoadingScreen import removed
import { addToOutbox, getOutbox } from '../db';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';

// Helper: Define initial state structure
const getInitialFields = () => ({
    // Core Subjects (Major & Teaching Load)
    spec_english_major: '', spec_english_teaching: '',
    spec_filipino_major: '', spec_filipino_teaching: '',
    spec_math_major: '', spec_math_teaching: '',
    spec_science_major: '', spec_science_teaching: '',
    spec_ap_major: '', spec_ap_teaching: '',
    spec_mapeh_major: '', spec_mapeh_teaching: '',
    spec_esp_major: '', spec_esp_teaching: '',
    spec_tle_major: '', spec_tle_teaching: ''
});

// --- SUB-COMPONENT (Moved Outside) ---
const SubjectRow = ({ label, id, formData, handleChange, isLocked, viewOnly }) => {
    const major = formData[`spec_${id}_major`];
    const teaching = formData[`spec_${id}_teaching`];

    return (
        <div className="group flex items-center justify-between py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors px-2 -mx-2 rounded-xl">
            <div className="flex-1 pr-4">
                <span className="font-bold text-slate-700 text-sm block group-hover:text-blue-700 transition-colors">{label}</span>
            </div>
            <div className="w-24 px-1">
                <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Total Count</p>
                <input
                    type="number"
                    min="0"
                    placeholder=""
                    name={`spec_${id}_major`}
                    value={major ?? ''}
                    onChange={handleChange}
                    disabled={isLocked || viewOnly}
                    onWheel={(e) => e.target.blur()}
                    className="w-full text-center border border-slate-200 rounded-xl py-2.5 bg-blue-50/50 text-blue-700 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-50 text-base shadow-sm"
                    onFocus={(e) => e.target.select()}
                />
            </div>
            <div className="w-24 px-1">
                <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Total Count</p>
                <input
                    type="number"
                    min="0"
                    placeholder=""
                    name={`spec_${id}_teaching`}
                    value={teaching ?? ''}
                    onChange={handleChange}
                    disabled={isLocked || viewOnly}
                    onWheel={(e) => e.target.blur()}
                    className="w-full text-center border border-slate-200 rounded-xl py-2.5 bg-orange-50/50 text-orange-700 font-bold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all disabled:opacity-50 text-base shadow-sm"
                    onFocus={(e) => e.target.select()}
                />
            </div>
        </div>
    );
};

const TeacherSpecialization = () => {
    const navigate = useNavigate();
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


    // --- AUTO-SHOW INFO MODAL ---
    useEffect(() => {
        const hasSeenInfo = localStorage.getItem('hasSeenSpecializationInfo');
        if (!hasSeenInfo) {
            setShowInfoModal(true);
            localStorage.setItem('hasSeenSpecializationInfo', 'true');
        }
    }, []);

    // --- SAVE TIMER EFFECTS ---

    const [userRole, setUserRole] = useState("School Head");

    const [schoolId, setSchoolId] = useState(null);
    const [formData, setFormData] = useState(getInitialFields());
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

                // STEP 1: PREPARE DEFAULTS
                const defaultFormData = getInitialFields();

                // STEP 2: IMMEDIATE CACHE LOAD
                let loadedFromCache = false;
                const CACHE_KEY = `CACHE_TEACHER_SPEC_${user.uid}`;
                const cachedData = localStorage.getItem(CACHE_KEY);

                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        setFormData({ ...defaultFormData, ...parsed }); // Merge
                        setOriginalData({ ...defaultFormData, ...parsed });

                        setIsLocked(Object.values(parsed).some(v => Number(v) > 0));
                        setLoading(false); // CRITICAL: Instant Load
                        loadedFromCache = true;
                        console.log("Loaded cached Teacher Specialization (Instant Load)");
                    } catch (e) { console.error("Cache parse error", e); }
                }

                // STEP 3: ASYNC OPERATIONS (Outbox & Network)
                const performAsyncChecks = async () => {
                    let restored = false;

                    // A. Check Outbox
                    if (!viewOnly) {
                        try {
                            const drafts = await getOutbox();
                            const draft = drafts.find(d => d.type === 'TEACHER_SPECIALIZATION');

                            if (draft) {
                                console.log("Restored draft from Outbox");
                                setFormData({ ...defaultFormData, ...draft.payload });

                                if (draft.payload.curricular_offering || draft.payload.offering) {
                                    localStorage.setItem('schoolOffering', draft.payload.curricular_offering || draft.payload.offering);
                                }

                                setIsLocked(false);
                                restored = true;
                                setLoading(false);

                                getDoc(doc(db, "users", user.uid)).then(s => { if (s.exists()) setUserRole(s.data().role); });
                                return;
                            }
                        } catch (e) { console.error("Outbox check failed:", e); }
                    }

                    // B. Network Fetch
                    if (!restored) {
                        let fetchUrl = `/api/teacher-specialization/${user.uid}`;
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
                                if (json.school_id || json.schoolId) setSchoolId(json.school_id || json.schoolId);

                                if (!viewOnly && json.school_id) {
                                    localStorage.setItem('schoolId', json.school_id);
                                    localStorage.setItem('schoolOffering', newOffering);
                                }

                                const dbData = (viewOnly && schoolIdParam) ? json : json.data;

                                // Map DB to Form (using default keys to ensure safe merge)
                                const loaded = {};
                                Object.keys(defaultFormData).forEach(key => {
                                    loaded[key] = dbData[key] !== null && dbData[key] !== undefined ? dbData[key] : 0;
                                });

                                setFormData(loaded);
                                setOriginalData(loaded);

                                setIsLocked(Object.values(loaded).some(v => Number(v) > 0));

                                // UPDATE CACHE
                                const cachePayload = { ...dbData, curricular_offering: newOffering, schoolId: json.school_id };
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
    }, [viewOnly, schoolIdParam]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Limit to 3 digits
        const cleanValue = value.replace(/[^0-9]/g, '').slice(0, 3);
        const intValue = cleanValue === '' ? '' : parseInt(cleanValue, 10);
        setFormData(prev => ({ ...prev, [name]: intValue }));
    };

    // --- VALIDATION ---
    const isFormValid = () => {
        const isValidEntry = (value) => value !== '' && value !== null && value !== undefined;
        const subjects = ['english', 'filipino', 'math', 'science', 'ap', 'mapeh', 'esp', 'tle'];
        for (const s of subjects) {
            const major = formData[`spec_${s}_major`];
            const teaching = formData[`spec_${s}_teaching`];
            if (!isValidEntry(major)) return false;
            if (!isValidEntry(teaching)) return false;
        }
        return true;
    };

    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);

        const user = auth.currentUser;

        // 🔑 PAYLOAD: Using UID as the primary identifier for the UPDATE
        const payload = {
            uid: user.uid,
            schoolId: schoolId || localStorage.getItem('schoolId'),
            ...formData
        };

        const handleOfflineSave = async () => {
            try {
                await addToOutbox({
                    type: 'TEACHER_SPECIALIZATION',
                    label: 'Teacher Specialization',
                    url: '/api/save-teacher-specialization',
                    payload: payload
                });
                setShowOfflineModal(true);
                setOriginalData({ ...formData });
                setIsLocked(true);
            } catch (e) { alert("Offline save failed."); }
        };

        if (!navigator.onLine) {
            await handleOfflineSave();
            setIsSaving(false);
            return;
        }

        try {
            const res = await fetch('/api/save-teacher-specialization', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setShowSuccessModal(true);
                setOriginalData({ ...formData });
                setIsLocked(true);
            } else {
                const err = await res.json();
                throw new Error(err.error || "Save failed");
            }
        } catch (e) {
            console.log("Network error, moving to outbox...");
            await handleOfflineSave();
        } finally {
            setIsSaving(false);
        }
    };

    // Components


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
                                <h1 className="text-2xl font-bold text-white tracking-tight">Teacher Specialization</h1>
                            </div>
                            <p className="text-blue-100 text-xs font-medium mt-1">
                                Q: How many teachers specialized/majored in the subject as compared to how many teachers are actually teaching the subject?
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setShowInfoModal(true)} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                        <FiHelpCircle size={24} />
                    </button>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-4xl mx-auto space-y-6">
                {/* CORE SUBJECTS TABLE */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-end justify-between mb-6 pb-4 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <FiBook size={20} />
                            </div>
                            <div>
                                <h2 className="text-slate-800 font-bold text-lg">Core Subjects</h2>
                                <p className="text-xs text-slate-400 font-medium">Subject assignments</p>
                            </div>
                        </div>
                    </div>

                    {/* Column Headers */}
                    <div className="flex justify-end gap-2 mb-2 px-2">
                        <div className="w-24 text-center">
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block bg-blue-50 py-1 rounded-lg">Major</span>
                        </div>
                        <div className="w-24 text-center">
                            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block bg-orange-50 py-1 rounded-lg">Teaching</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <SubjectRow label="English" id="english" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly} />
                        <SubjectRow label="Filipino" id="filipino" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly} />
                        <SubjectRow label="Mathematics" id="math" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly} />
                        <SubjectRow label="Science" id="science" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly} />
                        <SubjectRow label="Araling Panlipunan" id="ap" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly} />
                        <SubjectRow label="MAPEH" id="mapeh" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly} />
                        <SubjectRow label="Edukasyon sa Pagpapakatao (EsP)" id="esp" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly} />
                        <SubjectRow label="TLE / TVL / ICT" id="tle" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly} />
                    </div>
                </div>
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

            {/* Modals */}
            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
                        <h3 className="font-bold text-xl text-slate-800 mb-2">Enable Editing?</h3>
                        <p className="text-slate-500 text-sm mb-6">This allows you to modify the specialization data.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={() => { setIsLocked(false); setShowEditModal(false); }} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-colors">Confirm</button>
                        </div>
                    </div>
                </div >
            )}

            {
                showSaveModal && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                                <FiCheckCircle size={24} />
                            </div>
                            <h3 className="font-bold text-xl text-slate-800 text-center mb-2">Save Changes?</h3>
                            <p className="text-slate-500 text-center text-sm mb-6">You are about to update the specialization record.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                                <button onClick={confirmSave} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-colors">Save Changes</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {showInfoModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-blue-600 text-2xl">
                            <FiInfo />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 text-center">Form Guide</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6 text-center">This form is answering the question: <b>'How many teachers specialized/majored in the subject as compared to how many teachers are actually teaching the subject?'</b></p>
                        <button onClick={() => setShowInfoModal(false)} className="w-full py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition-transform active:scale-95">Got it</button>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="Specialization saved successfully!" />
        </div >
    );
};

export default TeacherSpecialization;