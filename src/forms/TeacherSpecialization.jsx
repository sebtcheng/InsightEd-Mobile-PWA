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
    spec_english_major: 0, spec_english_teaching: 0,
    spec_filipino_major: 0, spec_filipino_teaching: 0,
    spec_math_major: 0, spec_math_teaching: 0,
    spec_science_major: 0, spec_science_teaching: 0,
    spec_ap_major: 0, spec_ap_teaching: 0,
    spec_mapeh_major: 0, spec_mapeh_teaching: 0,
    spec_esp_major: 0, spec_esp_teaching: 0,
    spec_tle_major: 0, spec_tle_teaching: 0,
    // General Education (For Purely Elementary)
    spec_general_major: 0, spec_general_teaching: 0,
    spec_ece_major: 0, spec_ece_teaching: 0,
    // New Secondary Fields
    spec_bio_sci_major: 0, spec_bio_sci_teaching: 0,
    spec_phys_sci_major: 0, spec_phys_sci_teaching: 0,
    spec_agri_fishery_major: 0, spec_agri_fishery_teaching: 0,
    spec_others_major: 0, spec_others_teaching: 0
});

// --- SUB-COMPONENT: Standard Subject Row (Double Input) ---
const SubjectRow = ({ label, id, formData, handleChange, isLocked, viewOnly }) => {
    const major = formData[`spec_${id}_major`];
    const teaching = formData[`spec_${id}_teaching`];

    return (
        <div className="group flex items-center justify-between py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors px-2 -mx-2 rounded-xl">
            <div className="flex-1 pr-4">
                <span className="font-bold text-slate-700 text-sm block group-hover:text-blue-700 transition-colors uppercase">{label}</span>
            </div>
            <div className="w-24 px-1">
                <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Major</p>
                <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    name={`spec_${id}_major`}
                    value={major ?? 0}
                    onChange={(e) => handleChange(e.target.name, e.target.value)}
                    disabled={isLocked || viewOnly}
                    className="w-full text-center border border-slate-200 rounded-xl py-2.5 bg-blue-50/50 text-blue-700 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 text-base"
                    onFocus={(e) => major === 0 && handleChange(e.target.name, '')}
                    onBlur={(e) => (major === '' || major === null) && handleChange(e.target.name, 0)}
                />
            </div>
            <div className="w-24 px-1">
                <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Teaching</p>
                <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    name={`spec_${id}_teaching`}
                    value={teaching ?? 0}
                    onChange={(e) => handleChange(e.target.name, e.target.value)}
                    disabled={isLocked || viewOnly}
                    className="w-full text-center border border-slate-200 rounded-xl py-2.5 bg-orange-50/50 text-orange-700 font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50 text-base"
                    onFocus={(e) => teaching === 0 && handleChange(e.target.name, '')}
                    onBlur={(e) => (teaching === '' || teaching === null) && handleChange(e.target.name, 0)}
                />
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: Elementary Row (Single Input) ---
const ElementaryRow = ({ label, id, formData, handleChange, isLocked, viewOnly }) => {
    const total = formData[`spec_${id}_major`]; // Using 'major' column to store Total

    return (
        <div className="group flex items-center justify-between py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors px-2 -mx-2 rounded-xl">
            <div className="flex-1 pr-4">
                <span className="font-bold text-slate-700 text-sm block group-hover:text-teal-700 transition-colors uppercase">{label}</span>
            </div>
            <div className="w-32 px-1">
                <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Total Teachers</p>
                <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    name={`spec_${id}_major`}
                    value={total ?? 0}
                    onChange={(e) => handleChange(e.target.name, e.target.value)}
                    disabled={isLocked || viewOnly}
                    className="w-full text-center border border-slate-200 rounded-xl py-2.5 bg-teal-50/50 text-teal-700 font-bold focus:ring-2 focus:ring-teal-500 outline-none transition-all disabled:opacity-50 text-base"
                    onFocus={(e) => total === 0 && handleChange(e.target.name, '')}
                    onBlur={(e) => (total === '' || total === null) && handleChange(e.target.name, 0)}
                />
            </div>
        </div>
    );
};

const TeacherSpecialization = () => {
    // ... [Hooks unchanged] ...
    const navigate = useNavigate();
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
    const [userRole, setUserRole] = useState("School Head");
    const [schoolId, setSchoolId] = useState(null);
    const [formData, setFormData] = useState(getInitialFields());
    const [originalData, setOriginalData] = useState(null);
    const [offering, setOffering] = useState('');

    // --- AUTO-SHOW INFO MODAL ---
    useEffect(() => {
        // ... [Unchanged] ...
        const hasSeenInfo = localStorage.getItem('hasSeenSpecializationInfo');
        if (!hasSeenInfo) {
            setShowInfoModal(true);
            localStorage.setItem('hasSeenSpecializationInfo', 'true');
        }
    }, []);

    const goBack = () => {
        // ... [Unchanged] ...
        if (isDummy) {
            navigate(-1);
        } else {
            navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');
        }
    };

    // --- DETECT SECTIONS ---
    const getSections = () => {
        // Fallback: Check local storage directly if state not yet set
        const rawOffering = offering || localStorage.getItem('schoolOffering') || '';
        const currentOffering = rawOffering.toLowerCase(); // Case-insensitive check

        // "Integrated", "All", "K-12", "K-10" implies both Elementary AND Secondary
        const isIntegrated = currentOffering.includes('integrated') ||
            currentOffering.includes('all') ||
            currentOffering.includes('k-12') ||
            currentOffering.includes('k-10') ||
            currentOffering.includes('k to 12') ||
            currentOffering.includes('k to 10');

        const hasElementary = currentOffering === 'purely elementary' ||
            currentOffering.includes('elementary') ||
            currentOffering.includes('kinder') ||
            currentOffering.includes('primary') ||
            isIntegrated;

        // Secondary checks (Junior or Senior)
        const hasSecondary = currentOffering === 'purely secondary' ||
            currentOffering.includes('junior') ||
            currentOffering.includes('senior') ||
            currentOffering.includes('secondary') ||
            currentOffering.includes('high school') ||
            isIntegrated;

        // Fallback: If absolutely nothing matches but we have a string, default to Elementary (safest) 
        if (!hasElementary && !hasSecondary && currentOffering.length > 0) {
            console.warn("Unknown offering type:", rawOffering);
        }

        return { hasElementary, hasSecondary };
    };

    const { hasElementary, hasSecondary } = getSections();

    // ... [useEffect for fetching data - Update setOffering] ...
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // ... [Role checks unchanged] ...
                try {
                    const role = localStorage.getItem('userRole');
                    if (role === 'Central Office' || isDummy) setIsReadOnly(true);
                } catch (e) { }

                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');
                if (storedSchoolId) setSchoolId(storedSchoolId);
                if (storedOffering) setOffering(storedOffering);

                const defaultFormData = getInitialFields();
                let loadedFromCache = false;
                const CACHE_KEY = `CACHE_TEACHER_SPEC_${user.uid}`;
                const cachedData = localStorage.getItem(CACHE_KEY);

                if (cachedData) {
                    // ... [Cache load logic unchanged] ...
                    try {
                        const parsed = JSON.parse(cachedData);
                        setFormData({ ...defaultFormData, ...parsed });
                        setOriginalData({ ...defaultFormData, ...parsed });
                        setIsLocked(Object.values(parsed).some(v => Number(v) > 0));
                        if (parsed.curricular_offering) setOffering(parsed.curricular_offering); // Ensure offering is updated
                        setLoading(false);
                        loadedFromCache = true;
                    } catch (e) { }
                }

                // ... [Async checks] ...
                const performAsyncChecks = async () => {
                    let restored = false;
                    if (!viewOnly) {
                        try {
                            const drafts = await getOutbox();
                            const draft = drafts.find(d => d.type === 'TEACHER_SPECIALIZATION');
                            if (draft) {
                                setFormData({ ...defaultFormData, ...draft.payload });
                                if (draft.payload.curricular_offering) {
                                    localStorage.setItem('schoolOffering', draft.payload.curricular_offering);
                                    setOffering(draft.payload.curricular_offering);
                                }
                                setIsLocked(false);
                                restored = true;
                                setLoading(false);
                                return;
                            }
                        } catch (e) { }
                    }

                    if (!restored) {
                        let fetchUrl = `/api/teacher-specialization/${user.uid}`;
                        const role = localStorage.getItem('userRole');
                        if ((viewOnly || role === 'Central Office' || isDummy) && schoolIdParam) {
                            fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                        }
                        if (!loadedFromCache) setLoading(true);

                        try {
                            // ... [Fetch logic] ...
                            const requests = [
                                getDoc(doc(db, "users", user.uid)).catch(e => ({ exists: () => false })),
                                fetch(fetchUrl).then(res => res.json()).catch(e => ({ error: e, exists: false }))
                            ];

                            // If we don't have an offering, try to fetch the full school profile separately
                            const needsProfile = !storedOffering && !viewOnly && !schoolIdParam;
                            if (needsProfile) {
                                requests.push(fetch(`/api/school-profile/${user.uid}`).then(r => r.json()).catch(() => ({})));
                            }

                            const [userDoc, apiResult, profileResult] = await Promise.all(requests);

                            // ... [Process result] ...
                            // ... [Process result] ...
                            const json = apiResult;

                            // Base offering from result or storage
                            let fetchedOffering = json.curricular_offering || json.offering || storedOffering || '';

                            // If we fetched the separate profile because we were missing data, try to get offering from there
                            if (!fetchedOffering && profileResult && profileResult.exists) {
                                fetchedOffering = profileResult.data.curricular_offering;
                            }

                            // If we have data OR we fetched profile successfully
                            if (json.exists || (viewOnly && schoolIdParam) || (profileResult && profileResult.exists)) {

                                setOffering(fetchedOffering); // Update state

                                if (json.school_id) setSchoolId(json.school_id);
                                else if (profileResult && profileResult.data && profileResult.data.school_id) {
                                    setSchoolId(profileResult.data.school_id);
                                }

                                if (!viewOnly) {
                                    if (json.school_id) localStorage.setItem('schoolId', json.school_id);
                                    if (fetchedOffering) localStorage.setItem('schoolOffering', fetchedOffering);
                                }

                                const dbData = (viewOnly && schoolIdParam) ? json : json.data;
                                // If dbData is null (because we only fetched profile), use empty object or defaults
                                const safeData = dbData || {};

                                const loaded = {};
                                Object.keys(defaultFormData).forEach(key => {
                                    loaded[key] = safeData[key] !== null && safeData[key] !== undefined ? safeData[key] : 0;
                                });

                                setFormData(loaded);
                                setOriginalData(loaded);
                                setIsLocked(Object.values(loaded).some(v => Number(v) > 0));

                                const cachePayload = { ...dbData, curricular_offering: fetchedOffering, schoolId: json.school_id };
                                localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
                            }
                        } catch (err) { console.error(err); } finally { setLoading(false); }
                    }
                };
                performAsyncChecks();
            }
        });
        return () => unsubscribe();
    }, [viewOnly, schoolIdParam]);

    const handleChange = (name, value) => {
        const cleanValue = value.replace(/[^0-9]/g, '');
        const intValue = cleanValue === '' ? '' : parseInt(cleanValue, 10);
        setFormData(prev => ({ ...prev, [name]: intValue }));
    };

    // --- VALIDATION ---
    const isFormValid = () => {
        const isValidEntry = (value) => value !== '' && value !== null && value !== undefined;
        let valid = true;
        const { hasElementary, hasSecondary } = getSections();

        if (hasElementary) {
            if (!isValidEntry(formData.spec_general_major)) valid = false; // Check only Total (Major)
            if (!isValidEntry(formData.spec_ece_major)) valid = false;   // Check only Total (Major)
        }

        if (hasSecondary) {
            const secondarySubjects = [
                'filipino', 'english', 'math', 'science', 'ap',
                'tle', 'mapeh', 'esp',
                'bio_sci', 'phys_sci', 'agri_fishery', 'others'
            ];
            for (const s of secondarySubjects) {
                const major = formData[`spec_${s}_major`];
                const teaching = formData[`spec_${s}_teaching`];
                if (!isValidEntry(major) || !isValidEntry(teaching)) {
                    valid = false;
                    break;
                }
            }
        }
        return valid;
    };

    const confirmSave = async () => {
        // ... [Save logic unchanged] ...
        setShowSaveModal(false);
        setIsSaving(true);
        const user = auth.currentUser;
        const payload = {
            uid: user.uid,
            schoolId: schoolId || localStorage.getItem('schoolId'),
            ...formData
        };
        // ... [Rest of save logic] ...
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

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-32 relative">
            {/* ... [Header Unchanged] ... */}
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

                {/* SECTION: ELEMENTARY */}
                {hasElementary && (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-end justify-between mb-4 pb-4 border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                                    <FiBook size={20} />
                                </div>
                                <div>
                                    <h2 className="text-slate-800 font-bold text-lg">Kinder / Elementary</h2>
                                    <p className="text-xs text-slate-400 font-medium">Input total number of teachers per category</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <ElementaryRow label="GENERAL EDUCATION" id="general" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                            <ElementaryRow label="EARLY CHILDHOOD EDUCATION AND RELATED" id="ece" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                        </div>
                    </div>
                )}

                {/* SECTION: SECONDARY */}
                {hasSecondary && (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-end justify-between mb-2 pb-4 border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <FiBriefcase size={20} />
                                </div>
                                <div>
                                    <h2 className="text-slate-800 font-bold text-lg">Secondary (JHS/SHS)</h2>
                                    <p className="text-xs text-slate-400 font-medium">Subject majors and teaching assignments</p>
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
                            <SubjectRow label="FILIPINO" id="filipino" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                            <SubjectRow label="ENGLISH" id="english" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                            <SubjectRow label="MATH" id="math" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                            <SubjectRow label="SCIENCE" id="science" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                            <SubjectRow label="ARALING PANLIPUNAN" id="ap" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                            <SubjectRow label="TLE/EPP" id="tle" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                            <SubjectRow label="MAPEH" id="mapeh" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                            <SubjectRow label="ESP/ VALUES" id="esp" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                            <SubjectRow label="BIOLOGICAL SCIENCE" id="bio_sci" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                            <SubjectRow label="PHYSICAL SCIENCE" id="phys_sci" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                            <SubjectRow label="AGRICULTURE AND FISHERY ARTS" id="agri_fishery" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                            <SubjectRow label="OTHERS" id="others" formData={formData} handleChange={handleChange} isLocked={isLocked || viewOnly || isDummy || isReadOnly} />
                        </div>
                    </div>
                )}

                {!hasElementary && !hasSecondary && (
                    <div className="text-center p-10 text-slate-400">
                        <p>No specialization sections available for offering type: "{offering || localStorage.getItem('schoolOffering') || "None"}"</p>
                    </div>
                )}
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