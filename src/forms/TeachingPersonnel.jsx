// src/forms/TeachingPersonnel.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
// LoadingScreen import removed
import { addToOutbox } from '../db';


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
    const [userRole, setUserRole] = useState("School Head");

    // Data
    const [schoolId, setSchoolId] = useState(null);
    const [offering, setOffering] = useState('');

    // --- KEY FIX: Using teach_ prefix to match Neon Schema ---
    const [formData, setFormData] = useState({
        teach_kinder: 0, teach_g1: 0, teach_g2: 0, teach_g3: 0, teach_g4: 0, teach_g5: 0, teach_g6: 0,
        teach_g7: 0, teach_g8: 0, teach_g9: 0, teach_g10: 0,
        teach_g11: 0, teach_g12: 0
    });
    const [originalData, setOriginalData] = useState(null);

    const goBack = () => navigate('/school-forms');

    // --- FETCH DATA ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');
                if (storedSchoolId) setSchoolId(storedSchoolId);
                if (storedOffering) setOffering(storedOffering);

                try {
                    // Fetch user role for BottomNav
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) setUserRole(userDoc.data().role);

                    let fetchUrl = `/api/teaching-personnel/${user.uid}`;
                    if (viewOnly && schoolIdParam) {
                        fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                    }

                    const res = await fetch(fetchUrl);
                    const json = await res.json();

                    if (json.exists || (viewOnly && schoolIdParam)) {
                        setSchoolId(json.school_id || json.schoolId || storedSchoolId);
                        setOffering(json.curricular_offering || json.offering || storedOffering || '');

                        const dbData = (viewOnly && schoolIdParam) ? json : json.data;
                        const initialData = {
                            teach_kinder: dbData.teach_kinder || 0,
                            teach_g1: dbData.teach_g1 || 0, teach_g2: dbData.teach_g2 || 0, teach_g3: dbData.teach_g3 || 0,
                            teach_g4: dbData.teach_g4 || 0, teach_g5: dbData.teach_g5 || 0, teach_g6: dbData.teach_g6 || 0,
                            teach_g7: dbData.teach_g7 || 0, teach_g8: dbData.teach_g8 || 0, teach_g9: dbData.teach_g9 || 0, teach_g10: dbData.teach_g10 || 0,
                            teach_g11: dbData.teach_g11 || 0, teach_g12: dbData.teach_g12 || 0
                        };
                        setFormData(initialData);
                        setOriginalData(initialData);

                        const hasData = Object.values(dbData).some(val => val > 0);
                        if (hasData || viewOnly) setIsLocked(true);
                    }
                } catch (error) {
                    console.error("Fetch error:", error);
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- HELPERS ---
    const showElem = () => offering.includes("Elementary") || offering.includes("K-12") || offering.includes("K-10");
    const showJHS = () => offering.includes("Junior") || offering.includes("K-12") || offering.includes("K-10");
    const showSHS = () => offering.includes("Senior") || offering.includes("K-12");

    const getTotal = () => Object.values(formData).reduce((a, b) => a + (parseInt(b) || 0), 0);

    const handleChange = (e) => {
        const val = e.target.value === '' ? '' : parseInt(e.target.value);
        setFormData({ ...formData, [e.target.name]: val });
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
                alert("⚠️ Saved to Outbox! Sync when you have internet.");
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
                alert('✅ Teaching Personnel saved successfully to Neon!');
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
            alert("📴 Offline: Saved to Outbox!");
            setOriginalData({ ...formData });
            setIsLocked(true);
        } catch (e) { alert("Offline save failed."); }
    };

    const TeacherInput = ({ label, name }) => (
        <div className="flex flex-col items-center">
            <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1 text-center">{label}</label>
            <input
                type="number" min="0"
                name={name}
                value={formData[name]}
                onChange={handleChange}
                disabled={isLocked || viewOnly}
                className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#004A99] dark:focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 font-bold text-center text-lg shadow-sm disabled:bg-gray-100 dark:disabled:bg-slate-900 disabled:text-gray-500 transition-all"
            />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-32 relative">
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="text-white text-2xl">←</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Teaching Personnel</h1>
                        <p className="text-blue-200 text-xs mt-1">{viewOnly ? "Monitor View (Read-Only)" : "Teacher count per grade level"}</p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-4xl mx-auto">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 mb-4 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Curricular Offering</p>
                        <p className="text-blue-900 dark:text-blue-400 font-bold text-sm uppercase">{offering || 'Not Set'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Total Faculty</p>
                        <p className="text-2xl font-extrabold text-[#004A99] dark:text-blue-500">{getTotal()}</p>
                    </div>
                </div>

                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                    {showElem() && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <h2 className="text-gray-800 dark:text-slate-200 font-bold text-md mb-4 flex items-center gap-2">🎒 Elementary</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <TeacherInput label="Kinder" name="teach_kinder" />
                                <TeacherInput label="Grade 1" name="teach_g1" />
                                <TeacherInput label="Grade 2" name="teach_g2" />
                                <TeacherInput label="Grade 3" name="teach_g3" />
                                <TeacherInput label="Grade 4" name="teach_g4" />
                                <TeacherInput label="Grade 5" name="teach_g5" />
                                <TeacherInput label="Grade 6" name="teach_g6" />
                            </div>
                        </div>
                    )}

                    {showJHS() && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <h2 className="text-gray-800 dark:text-slate-200 font-bold text-md mb-4 flex items-center gap-2">📘 Junior High</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <TeacherInput label="Grade 7" name="teach_g7" />
                                <TeacherInput label="Grade 8" name="teach_g8" />
                                <TeacherInput label="Grade 9" name="teach_g9" />
                                <TeacherInput label="Grade 10" name="teach_g10" />
                            </div>
                        </div>
                    )}

                    {showSHS() && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <h2 className="text-gray-800 dark:text-slate-200 font-bold text-md mb-4 flex items-center gap-2">🎓 Senior High</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <TeacherInput label="Grade 11" name="teach_g11" />
                                <TeacherInput label="Grade 12" name="teach_g12" />
                            </div>
                        </div>
                    )}
                </form>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 pb-10 z-50 flex gap-3 shadow-2xl">
                {viewOnly ? (
                    <button 
                        onClick={() => navigate('/jurisdiction-schools')} 
                        className="w-full bg-[#004A99] text-white font-bold py-4 rounded-xl shadow-lg ring-4 ring-blue-500/20"
                    >
                        Back to Schools List
                    </button>
                ) : isLocked ? (
                    <button onClick={handleUpdateClick} className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg">✏️ Unlock to Edit</button>
                ) : (
                    <>
                        {originalData && <button onClick={handleCancelEdit} className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300 font-bold py-4 rounded-xl">Cancel</button>}
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg">
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </>
                )}
            </div>

            {showEditModal && <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg dark:text-slate-200">Edit Personnel?</h3><div className="mt-6 flex gap-2"><button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border dark:border-slate-700 rounded-xl font-bold text-gray-600 dark:text-slate-400">Cancel</button><button onClick={handleConfirmEdit} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold">Unlock</button></div></div></div>}
            {showSaveModal && <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg dark:text-slate-200">Save Changes?</h3><div className="mt-6 flex gap-2"><button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border dark:border-slate-700 rounded-xl font-bold text-gray-600 dark:text-slate-400">Cancel</button><button onClick={confirmSave} className="flex-1 py-3 bg-[#CC0000] text-white rounded-xl font-bold">Confirm</button></div></div></div>}


        </div>
    );
};

export default TeachingPersonnel;