// src/forms/OrganizedClasses.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
// LoadingScreen import removed
import { addToOutbox } from '../db';


const OrganizedClasses = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // UI States: Default to FALSE (Unlocked) so new users can type immediately
    const [isLocked, setIsLocked] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [userRole, setUserRole] = useState("School Head");

    // Data
    const [schoolId, setSchoolId] = useState(null);
    const [offering, setOffering] = useState('');
    const [formData, setFormData] = useState({
        kinder: 0, g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g6: 0,
        g7: 0, g8: 0, g9: 0, g10: 0,
        g11: 0, g12: 0
    });
    const [originalData, setOriginalData] = useState(null);

    const goBack = () => navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');

    // --- FETCH DATA (Updated for Offline Recovery) ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // 1. OFFLINE RECOVERY: Load offering from LocalStorage first
                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');

                if (storedSchoolId) setSchoolId(storedSchoolId);
                if (storedOffering) setOffering(storedOffering);

                try {
                    // Fetch user role for BottomNav
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) setUserRole(docSnap.data().role);

                    let fetchUrl = `/api/organized-classes/${user.uid}`;
                    if (viewOnly && schoolIdParam) {
                        fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                    }

                    const res = await fetch(fetchUrl);
                    const json = await res.json();

                    if (json.exists || (viewOnly && schoolIdParam)) {
                        setSchoolId(json.school_id || json.schoolId);
                        setOffering(json.curricular_offering || json.offering || storedOffering || '');

                        // Sync storage to keep data fresh
                        localStorage.setItem('schoolId', json.schoolId);
                        localStorage.setItem('schoolOffering', json.offering || '');

                        const dbData = (viewOnly && schoolIdParam) ? json : json.data;
                        // Check if data actually exists in DB to lock the form
                        const hasData = Object.values(dbData).some(val => val !== null && val !== 0);

                        const initialData = {
                            kinder: dbData.classes_kinder || dbData.kinder || 0,
                            g1: dbData.classes_grade_1 || dbData.grade_1 || 0, g2: dbData.classes_grade_2 || dbData.grade_2 || 0, g3: dbData.classes_grade_3 || dbData.grade_3 || 0,
                            g4: dbData.classes_grade_4 || dbData.grade_4 || 0, g5: dbData.classes_grade_5 || dbData.grade_5 || 0, g6: dbData.classes_grade_6 || dbData.grade_6 || 0,
                            g7: dbData.classes_grade_7 || dbData.grade_7 || 0, g8: dbData.classes_grade_8 || dbData.grade_8 || 0, g9: dbData.classes_grade_9 || dbData.grade_9 || 0, g10: dbData.classes_grade_10 || dbData.grade_10 || 0,
                            g11: dbData.classes_grade_11 || dbData.grade_11 || 0, g12: dbData.classes_grade_12 || dbData.grade_12 || 0
                        };
                        setFormData(initialData);
                        setOriginalData(initialData);

                        if (hasData) {
                            setIsLocked(true);
                        }
                    }
                } catch (error) {
                    console.error("Offline or Error fetching classes:", error);
                    // UI will rely on storedOffering loaded in step 1
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

    const getTotalClasses = () => Object.values(formData).reduce((a, b) => a + (parseInt(b) || 0), 0);

    const handleChange = (e) => {
        const val = e.target.value === '' ? '' : parseInt(e.target.value);
        setFormData({ ...formData, [e.target.name]: val });
    };

    // --- ACTIONS ---
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

    // 🛡️ OFFLINE SAVE HELPER
    const saveOffline = async (payload) => {
        try {
            await addToOutbox({
                type: 'ORGANIZED_CLASSES',
                label: 'Organized Classes',
                url: '/api/save-organized-classes',
                payload: payload
            });
            alert("⚠️ Connection unstable. \n\nData saved to Outbox! Sync when you have internet.");

            setOriginalData({ ...formData });
            setIsLocked(true);
        } catch (e) {
            alert("Critical Error: Could not save locally.");
        }
    };

    // 💾 MAIN SAVE FUNCTION
    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);

        // Sanitize payload based on active sections
        const payload = {
            schoolId,
            kinder: showElem() ? formData.kinder : 0,
            g1: showElem() ? formData.g1 : 0,
            g2: showElem() ? formData.g2 : 0,
            g3: showElem() ? formData.g3 : 0,
            g4: showElem() ? formData.g4 : 0,
            g5: showElem() ? formData.g5 : 0,
            g6: showElem() ? formData.g6 : 0,
            g7: showJHS() ? formData.g7 : 0,
            g8: showJHS() ? formData.g8 : 0,
            g9: showJHS() ? formData.g9 : 0,
            g10: showJHS() ? formData.g10 : 0,
            g11: showSHS() ? formData.g11 : 0,
            g12: showSHS() ? formData.g12 : 0
        };

        if (!navigator.onLine) {
            try {
                await addToOutbox({
                    type: 'ORGANIZED_CLASSES',
                    label: 'Organized Classes',
                    url: '/api/save-organized-classes',
                    payload: payload
                });
                alert("📴 You are offline. \n\nData saved to Outbox! Sync when you have internet.");
                setOriginalData({ ...formData });
                setIsLocked(true);
            } catch (e) { alert("Failed to save offline."); }
            finally { setIsSaving(false); }
            return;
        }

        try {
            const res = await fetch('/api/save-organized-classes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert('Success: Organized Classes saved!');
                setOriginalData({ ...formData });
                setIsLocked(true);
            } else {
                throw new Error("Server Error");
            }
        } catch (err) {
            await saveOffline(payload);
        } finally {
            setIsSaving(false);
        }
    };

    // --- STYLES ---
    const inputClass = "w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#004A99] dark:focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 font-bold text-center text-lg shadow-sm disabled:bg-gray-100 dark:disabled:bg-slate-900 disabled:text-gray-500 transition-all";
    const labelClass = "block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1 text-center";
    const sectionClass = "bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mb-6";

    // LoadingScreen check removed

    const ClassInput = ({ label, name }) => (
        <div>
            <label className={labelClass}>{label}</label>
            <input
                type="number" min="0"
                name={name}
                value={formData[name]}
                onChange={handleChange}
                disabled={isLocked || viewOnly}
                className={inputClass}
            />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-32 relative">

            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white/80 hover:text-white text-2xl transition">&larr;</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Organized Classes</h1>
                        <p className="text-blue-200 text-xs mt-1">{viewOnly ? "Monitor View (Read-Only)" : "Number of sections per grade level"}</p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 mb-4 flex justify-between items-center">
                    <div>
                        <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Curricular Offering</p>
                        <p className="text-blue-900 dark:text-blue-400 font-bold text-sm uppercase">{offering || 'Not Set'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Total Sections</p>
                        <p className="text-2xl font-extrabold text-[#004A99] dark:text-blue-500">{getTotalClasses()}</p>
                    </div>
                </div>

                <form onSubmit={(e) => e.preventDefault()}>
                    {showElem() && (
                        <div className={sectionClass}>
                            <h2 className="text-gray-800 font-bold text-md mb-4 flex items-center gap-2">
                                <span className="text-xl"></span> Elementary School
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <ClassInput label="Kinder" name="kinder" />
                                <ClassInput label="Grade 1" name="g1" />
                                <ClassInput label="Grade 2" name="g2" />
                                <ClassInput label="Grade 3" name="g3" />
                                <ClassInput label="Grade 4" name="g4" />
                                <ClassInput label="Grade 5" name="g5" />
                                <ClassInput label="Grade 6" name="g6" />
                            </div>
                        </div>
                    )}

                    {showJHS() && (
                        <div className={sectionClass}>
                            <h2 className="text-gray-800 font-bold text-md mb-4 flex items-center gap-2">
                                <span className="text-xl"></span> Junior High School
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <ClassInput label="Grade 7" name="g7" />
                                <ClassInput label="Grade 8" name="g8" />
                                <ClassInput label="Grade 9" name="g9" />
                                <ClassInput label="Grade 10" name="g10" />
                            </div>
                        </div>
                    )}

                    {showSHS() && (
                        <div className={sectionClass}>
                            <h2 className="text-gray-800 font-bold text-md mb-4 flex items-center gap-2">
                                <span className="text-xl"></span> Senior High School
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <ClassInput label="Grade 11" name="g11" />
                                <ClassInput label="Grade 12" name="g12" />
                            </div>
                        </div>
                    )}

                    {!showElem() && !showJHS() && !showSHS() && (
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 text-center">
                            <p className="text-gray-400 dark:text-slate-500 font-bold">No offering details found.</p>
                            <p className="text-xs text-gray-400 dark:text-slate-600 mt-2">Please ensure your <b>School Profile</b> is complete.</p>
                        </div>
                    )}
                </form>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 pb-8 z-50 flex gap-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                {viewOnly ? (
                    <button 
                        onClick={() => navigate('/jurisdiction-schools')} 
                        className="w-full bg-[#004A99] text-white font-bold py-4 rounded-xl shadow-lg ring-4 ring-blue-500/20"
                    >
                        Back to Schools List
                    </button>
                ) : isLocked ? (
                    <button
                        onClick={handleUpdateClick}
                        className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-amber-600 active:scale-[0.98] transition flex items-center justify-center gap-2"
                    >
                        <span>✏️</span> Unlock to Edit
                    </button>
                ) : (
                    <>
                        {originalData && <button onClick={handleCancelEdit} className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-bold py-4 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600">Cancel</button>}
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-[#A30000] flex items-center justify-center gap-2">
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </>
                )}
            </div>

            {showEditModal && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in"><div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg dark:text-slate-200">Edit Classes?</h3><p className="text-gray-500 dark:text-slate-400 text-sm mt-2">Modify the section counts in the database.</p><div className="mt-6 flex gap-2"><button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border dark:border-slate-700 rounded-xl font-bold text-gray-600 dark:text-slate-400">Cancel</button><button onClick={handleConfirmEdit} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold shadow-md">Unlock</button></div></div></div>}

            {showSaveModal && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in"><div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg dark:text-slate-200">Save Changes?</h3><p className="text-gray-500 dark:text-slate-400 text-sm mt-2">This will update the records in the database.</p><div className="mt-6 flex gap-2"><button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border dark:border-slate-700 rounded-xl font-bold text-gray-600 dark:text-slate-400">Cancel</button><button onClick={confirmSave} className="flex-1 py-3 bg-[#CC0000] text-white rounded-xl font-bold shadow-md">Confirm Save</button></div></div></div>}


        </div>
    );
};

export default OrganizedClasses;