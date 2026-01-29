
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { addToOutbox, getOutbox } from '../db';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
import { FiBox, FiArrowLeft, FiCheckCircle, FiHelpCircle, FiInfo, FiSave } from 'react-icons/fi';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';

// --- EXTRACTED COMPONENT ---
const InputCard = ({ label, name, icon, color, value, onChange, disabled }) => (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center group transition-all hover:border-blue-100">
        <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${color} bg-opacity-10 text-xl group-hover:bg-opacity-20 transition-all`}>
                {icon}
            </div>
            <div>
                <h3 className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors">{label}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Classrooms</p>
            </div>
        </div>
        <div>
            <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Total Count</p>
            <input
                type="number" inputMode="numeric" pattern="[0-9]*"
                name={name}
                value={value}
                onChange={onChange}
                disabled={disabled}
                onWheel={(e) => e.target.blur()}
                className="w-24 text-center font-black text-xl bg-slate-50 border border-slate-200 rounded-xl py-3 focus:ring-4 focus:ring-blue-100 outline-none disabled:bg-transparent disabled:border-transparent text-slate-800"
                onFocus={(e) => e.target.select()}
            />
        </div>
    </div>
);

const PhysicalFacilities = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);

    // --- AUTO-SHOW INFO MODAL ---
    useEffect(() => {
        const hasSeenInfo = localStorage.getItem('hasSeenFacilitiesInfo');
        if (!hasSeenInfo) {
            setShowInfoModal(true);
            localStorage.setItem('hasSeenFacilitiesInfo', 'true');
        }
    }, []);
    const [schoolId, setSchoolId] = useState(null);
    const [formData, setFormData] = useState({});
    const [originalData, setOriginalData] = useState(null);

    const initialFields = {
        build_classrooms_total: '',
        build_classrooms_new: '',
        build_classrooms_good: '',
        build_classrooms_repair: '',
        build_classrooms_demolition: ''
    };

    const goBack = () => navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');

    // --- FETCH DATA (Refactored for Sync Cache) ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');
                if (storedSchoolId) setSchoolId(storedSchoolId);

                // DEFAULT STATE
                const defaultFormData = initialFields;

                // STEP 1: LOAD CACHE IMMEDIATELY
                let loadedFromCache = false;
                const CACHE_KEY = `CACHE_PHYSICAL_FACILITIES_${user.uid}`;
                const cachedData = localStorage.getItem(CACHE_KEY);

                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        setFormData({ ...defaultFormData, ...parsed });
                        setOriginalData({ ...defaultFormData, ...parsed });
                        setIsLocked(true);
                        setLoading(false); // CRITICAL: Instant Load
                        loadedFromCache = true;
                        console.log("Loaded cached Physical Facilities (Instant Load)");
                    } catch (e) { console.error("Cache parse error", e); }
                }

                try {
                    // STEP 2: CHECK OUTBOX
                    let restored = false;
                    if (!viewOnly) {
                        try {
                            const drafts = await getOutbox();
                            const draft = drafts.find(d => d.type === 'PHYSICAL_FACILITIES');
                            if (draft) {
                                console.log("Restored draft from Outbox");
                                setFormData({ ...defaultFormData, ...draft.payload });

                                if (draft.payload.curricular_offering || draft.payload.offering) {
                                    localStorage.setItem('schoolOffering', draft.payload.curricular_offering || draft.payload.offering);
                                }

                                setIsLocked(false);
                                restored = true;
                                setLoading(false);
                                return; // Stop here if draft found
                            }
                        } catch (e) { console.error("Outbox check failed:", e); }
                    }

                    // STEP 3: BACKGROUND FETCH
                    if (!restored) {
                        let fetchUrl = `/api/physical-facilities/${user.uid}`;
                        if (viewOnly && schoolIdParam) {
                            fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                        }

                        // Only show loading if we didn't load from cache
                        if (!loadedFromCache) setLoading(true);

                        const res = await fetch(fetchUrl);
                        const json = await res.json();

                        if (json.exists || (viewOnly && schoolIdParam)) {
                            const dbData = (viewOnly && schoolIdParam) ? json : json.data;
                            if (!schoolIdParam) setSchoolId(dbData.school_id || dbData.schoolId || storedSchoolId);

                            if (dbData.school_id && !viewOnly) {
                                localStorage.setItem('schoolId', dbData.school_id);
                                if (json.curricular_offering) localStorage.setItem('schoolOffering', json.curricular_offering);
                            }

                            const loaded = {};
                            Object.keys(initialFields).forEach(key => {
                                loaded[key] = dbData[key] ?? 0;
                            });

                            setFormData(loaded);
                            setOriginalData(loaded);

                            // Check if there is ANY actual data before locking
                            // Check if there is ANY actual data in FORM FIELDS before locking
                            const hasData = Object.keys(initialFields).some(key => {
                                const val = dbData[key];
                                return val !== 0 && val !== '0' && val !== '' && val !== null && val !== undefined;
                            });
                            if (hasData || viewOnly) setIsLocked(true);
                            else setIsLocked(false);

                            // UPDATE CACHE
                            localStorage.setItem(CACHE_KEY, JSON.stringify(loaded));
                        } else {
                            if (!loadedFromCache) {
                                setFormData(defaultFormData);
                                setIsLocked(false); // Explicitly ensure unlocked if no data
                            }
                        }
                    }
                } catch (error) {
                    console.error("Fetch Error:", error);
                    if (!loadedFromCache) {
                        // Fallback: Try main cache again
                        const CACHE_KEY = `CACHE_PHYSICAL_FACILITIES_${user.uid}`;
                        const cached = localStorage.getItem(CACHE_KEY);
                        if (cached) {
                            const data = JSON.parse(cached);
                            setFormData(data);
                            setOriginalData(data);
                            setIsLocked(true);
                        } else {
                            // Fallback: Try Legacy Cache
                            const localData = localStorage.getItem('physicalFacilitiesData');
                            if (localData) {
                                console.log("Loaded legacy physical facilities data");
                                const data = JSON.parse(localData);
                                setFormData(data);
                                setIsLocked(true);
                            }
                        }
                    }
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- AUTOMATIC TALLYING ---
    useEffect(() => {
        if (!formData) return;
        const total = (formData.build_classrooms_new || 0) +
            (formData.build_classrooms_good || 0) +
            (formData.build_classrooms_repair || 0) +
            (formData.build_classrooms_demolition || 0);

        // Only update if different to avoid loop (though React batches updates)
        if (total !== formData.build_classrooms_total) {
            setFormData(prev => ({ ...prev, build_classrooms_total: total }));
        }
    }, [
        formData.build_classrooms_new,
        formData.build_classrooms_good,
        formData.build_classrooms_repair,
        formData.build_classrooms_demolition
    ]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Robust numeric input handling with 5-digit limit
        const cleanValue = value.replace(/[^0-9]/g, '').slice(0, 5);
        const intValue = cleanValue === '' ? '' : parseInt(cleanValue, 10);
        setFormData(prev => ({ ...prev, [name]: intValue }));
    };

    // --- VALIDATION ---
    const isFormValid = () => {
        const fields = [
            'build_classrooms_new', 'build_classrooms_good',
            'build_classrooms_repair', 'build_classrooms_demolition'
        ];

        for (const f of fields) {
            if (formData[f] === '' || formData[f] === null || formData[f] === undefined) return false;
        }
        return true;
    };

    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);
        const payload = {
            schoolId: schoolId || localStorage.getItem('schoolId'),
            uid: auth.currentUser.uid,
            ...formData
        };

        try {
            if (!navigator.onLine) throw new Error("Offline");
            const res = await fetch('/api/save-physical-facilities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setShowSuccessModal(true);
                setOriginalData({ ...formData });
                setIsLocked(true);
                localStorage.setItem('physicalFacilitiesData', JSON.stringify(formData));
            } else {
                throw new Error("Save failed");
            }
        } catch (e) {
            await addToOutbox({
                type: 'PHYSICAL_FACILITIES',
                label: 'Physical Facilities',
                url: '/api/save-physical-facilities',
                payload
            });
            setShowOfflineModal(true);
            setIsLocked(true);
        } finally {
            setIsSaving(false);
        }
    };



    if (loading) return <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-900"><div className="w-10 h-10 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div></div>;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-40">
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
                                <h1 className="text-2xl font-bold text-white tracking-tight">Physical Facilities</h1>
                            </div>
                            <p className="text-blue-100 text-xs font-medium mt-1">
                                Q: What is the current condition and total number of instructional classrooms?
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setShowInfoModal(true)} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                        <FiHelpCircle size={24} />
                    </button>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-lg mx-auto space-y-4">

                {/* Total Classrooms (Highlight) */}
                <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-slate-100 text-center mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Total Classrooms</p>
                    <input
                        type="text" inputMode="numeric" pattern="[0-9]*"
                        name="build_classrooms_total"
                        value={formData.build_classrooms_total || ''}
                        onChange={handleChange} // Allows manual override if needed, though useEffect will overwrite on dependent change
                        disabled={true}
                        className="w-full text-center text-7xl font-black text-[#004A99] bg-transparent outline-none placeholder-slate-200 tracking-tighter"
                        placeholder="0"
                    />
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Overall count in the school</p>
                </div>

                <InputCard label="Newly Built" name="build_classrooms_new" icon="✨" color="bg-emerald-500 text-emerald-600" value={formData.build_classrooms_new || ''} onChange={handleChange} disabled={isLocked || viewOnly} />
                <InputCard label="Good Condition" name="build_classrooms_good" icon="✅" color="bg-blue-500 text-blue-600" value={formData.build_classrooms_good || ''} onChange={handleChange} disabled={isLocked || viewOnly} />
                <InputCard label="Needs Repair" name="build_classrooms_repair" icon="🛠️" color="bg-orange-500 text-orange-600" value={formData.build_classrooms_repair || ''} onChange={handleChange} disabled={isLocked || viewOnly} />
                <InputCard label="Needs Demolition" name="build_classrooms_demolition" icon="⚠️" color="bg-red-500 text-red-600" value={formData.build_classrooms_demolition || ''} onChange={handleChange} disabled={isLocked || viewOnly} />

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
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving || !isFormValid()} className="flex-1 bg-[#004A99] text-white font-bold py-4 rounded-2xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FiSave /> Save Changes</>}
                        </button>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
                        <h3 className="font-bold text-xl text-slate-800 mb-2">Enable Editing?</h3>
                        <p className="text-slate-500 text-sm mb-6">This allows you to modify the physical facilities data.</p>
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
                        <p className="text-slate-500 text-center text-sm mb-6">You are about to update the physical facilities record.</p>
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
                        <p className="text-sm text-slate-500 mt-2 mb-6 text-center">This form is answering the question: <b>'What is the current condition and total number of instructional classrooms?'</b></p>
                        <button onClick={() => setShowInfoModal(false)} className="w-full py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition-transform active:scale-95">Got it</button>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="Physical Facilities report saved successfully!" />
        </div>
    );
};

export default PhysicalFacilities;
