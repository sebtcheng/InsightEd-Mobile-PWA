// src/forms/TeacherSpecialization.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
// LoadingScreen import removed
import { addToOutbox } from '../db';

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
    spec_tle_major: 0, spec_tle_teaching: 0
});

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
    const [userRole, setUserRole] = useState("School Head");

    const [schoolId, setSchoolId] = useState(null);
    const [formData, setFormData] = useState(getInitialFields());
    const [originalData, setOriginalData] = useState(null);

    const goBack = () => navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // 1. OFFLINE RECOVERY
                const cachedId = localStorage.getItem('schoolId');
                if (cachedId) setSchoolId(cachedId);

                try {
                    // Fetch user role for BottomNav
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) setUserRole(userDoc.data().role);

                    let fetchUrl = `/api/teacher-specialization/${user.uid}`;
                    if (viewOnly && schoolIdParam) {
                        fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                    }

                    const res = await fetch(fetchUrl);
                    const json = await res.json();

                    if (json.exists || (viewOnly && schoolIdParam)) {
                        setSchoolId(json.school_id || json.schoolId || cachedId);
                        const dbData = (viewOnly && schoolIdParam) ? json : json.data;
                        const loaded = {};

                        // Use getInitialFields keys to ensure all are present
                        const defaults = getInitialFields();
                        Object.keys(defaults).forEach(key => {
                            loaded[key] = dbData[key] !== null ? dbData[key] : 0;
                        });

                        setFormData(loaded);
                        setOriginalData(loaded);

                        // Lock if data exists or viewOnly
                        if (dbData.spec_math_major > 0 || dbData.spec_guidance > 0 || viewOnly) setIsLocked(true);
                    } else {
                        setFormData(getInitialFields());
                    }
                } catch (e) {
                    console.error("Fetch error:", e);
                    setFormData(getInitialFields());
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
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
                alert("📴 Saved to Outbox! Data will sync when you are online.");
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
                alert('✅ Saved successfully to Neon!');
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
    const SubjectRow = ({ label, id }) => {
        const major = formData[`spec_${id}_major`];
        const teaching = formData[`spec_${id}_teaching`];

        return (
            <div className="grid grid-cols-5 gap-2 items-center border-b border-gray-100 dark:border-slate-700 py-4 last:border-0">
                <div className="col-span-3">
                    <span className="font-bold text-gray-700 dark:text-slate-300 text-sm block">{label}</span>
                </div>
                <div className="col-span-1 text-center">
                    <input type="number" min="0" name={`spec_${id}_major`} value={major} onChange={handleChange} disabled={isLocked || viewOnly} className="w-full text-center border-gray-200 dark:border-slate-600 rounded-lg py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 dark:disabled:bg-slate-800" />
                </div>
                <div className="col-span-1 text-center">
                    <input type="number" min="0" name={`spec_${id}_teaching`} value={teaching} onChange={handleChange} disabled={isLocked || viewOnly} className="w-full text-center border-gray-200 dark:border-slate-600 rounded-lg py-2 bg-orange-50 dark:bg-orange-900/30 text-orange-900 dark:text-orange-200 font-bold focus:ring-2 focus:ring-orange-500 outline-none disabled:bg-gray-100 dark:disabled:bg-slate-800" />
                </div>
            </div>
        );
    };

    // LoadingScreen check removed

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-32 relative text-sm">
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white/80 hover:text-white text-2xl transition">←</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Teacher Specialization</h1>
                        <p className="text-blue-200 text-xs mt-1">{viewOnly ? "Monitor View (Read-Only)" : "Majors vs. Non-Major Teachers"}</p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-4xl mx-auto space-y-6">

                {/* 2. CORE SUBJECTS TABLE */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mb-20">
                    <div className="flex justify-between items-end mb-4 border-b pb-2 border-gray-100 dark:border-slate-700">
                        <h2 className="text-gray-800 dark:text-slate-200 font-bold text-md flex items-center gap-2"><span className="text-xl">📚</span> Core Subjects</h2>
                        <div className="flex gap-4 text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500">
                            <span className="text-blue-600 dark:text-blue-400">Specialized (Major)</span>
                            <span className="text-orange-500 dark:text-orange-400">Non-Major (Teaching)</span>
                        </div>
                    </div>

                    <SubjectRow label="English" id="english" />
                    <SubjectRow label="Filipino" id="filipino" />
                    <SubjectRow label="Mathematics" id="math" />
                    <SubjectRow label="Science" id="science" />
                    <SubjectRow label="Araling Panlipunan" id="ap" />
                    <SubjectRow label="MAPEH" id="mapeh" />
                    <SubjectRow label="EsP" id="esp" />
                    <SubjectRow label="TLE / TVL" id="tle" />
                </div>
            </div>

            {/* Floating Action Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 pb-10 z-50 flex gap-3 shadow-2xl">
                {viewOnly ? (
                    <button
                        onClick={() => navigate('/jurisdiction-schools')}
                        className="w-full bg-[#004A99] text-white font-bold py-4 rounded-xl shadow-lg ring-4 ring-blue-500/20"
                    >
                        Back to Schools List
                    </button>
                ) : isLocked ? (
                    <button onClick={() => setShowEditModal(true)} className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition">✏️ Unlock to Edit</button>
                ) : (
                    <>
                        {originalData && <button onClick={() => { setFormData(originalData); setIsLocked(true); }} className="flex-1 bg-gray-100 text-gray-600 font-bold py-4 rounded-xl">Cancel</button>}
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition">
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </>
                )}
            </div>

            {/* Modals */}
            {showEditModal && <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in"><div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg dark:text-slate-200">Modify Data?</h3><div className="mt-6 flex gap-2"><button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border dark:border-slate-700 rounded-xl font-bold text-gray-600 dark:text-slate-400">Cancel</button><button onClick={() => { setIsLocked(false); setShowEditModal(false); }} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold">Unlock</button></div></div></div>}
            {showSaveModal && <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in"><div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg dark:text-slate-200">Confirm Save?</h3><div className="mt-6 flex gap-2"><button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border dark:border-slate-700 rounded-xl font-bold text-gray-600 dark:text-slate-400">Cancel</button><button onClick={confirmSave} className="flex-1 py-3 bg-[#CC0000] text-white rounded-xl font-bold">Save</button></div></div></div>}


        </div>
    );
};

export default TeacherSpecialization;