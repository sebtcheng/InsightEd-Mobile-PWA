// src/forms/OrganizedClasses.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
// LoadingScreen import removed
import { addToOutbox } from '../db';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';


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
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [userRole, setUserRole] = useState("School Head");

    // Data
    const [schoolId, setSchoolId] = useState(null);
    const [offering, setOffering] = useState('');
    const [formData, setFormData] = useState({
        kinder: 0, g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g6: 0,
        g7: 0, g8: 0, g9: 0, g10: 0,
        g11: 0, g12: 0
    });

    // CLASS SIZE STANDARDS (Grades 1-12)
    const [classSizeData, setClassSizeData] = useState({
        cntLessG1: 0, cntWithinG1: 0, cntAboveG1: 0,
        cntLessG2: 0, cntWithinG2: 0, cntAboveG2: 0,
        cntLessG3: 0, cntWithinG3: 0, cntAboveG3: 0,
        cntLessG4: 0, cntWithinG4: 0, cntAboveG4: 0,
        cntLessG5: 0, cntWithinG5: 0, cntAboveG5: 0,
        cntLessG6: 0, cntWithinG6: 0, cntAboveG6: 0,
        cntLessG7: 0, cntWithinG7: 0, cntAboveG7: 0,
        cntLessG8: 0, cntWithinG8: 0, cntAboveG8: 0,
        cntLessG9: 0, cntWithinG9: 0, cntAboveG9: 0,
        cntLessG10: 0, cntWithinG10: 0, cntAboveG10: 0,
        cntLessG11: 0, cntWithinG11: 0, cntAboveG11: 0,
        cntLessG12: 0, cntWithinG12: 0, cntAboveG12: 0
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

                        const initialClassSize = {
                            cntLessG1: dbData.cnt_less_g1 || 0, cntWithinG1: dbData.cnt_within_g1 || 0, cntAboveG1: dbData.cnt_above_g1 || 0,
                            cntLessG2: dbData.cnt_less_g2 || 0, cntWithinG2: dbData.cnt_within_g2 || 0, cntAboveG2: dbData.cnt_above_g2 || 0,
                            cntLessG3: dbData.cnt_less_g3 || 0, cntWithinG3: dbData.cnt_within_g3 || 0, cntAboveG3: dbData.cnt_above_g3 || 0,
                            cntLessG4: dbData.cnt_less_g4 || 0, cntWithinG4: dbData.cnt_within_g4 || 0, cntAboveG4: dbData.cnt_above_g4 || 0,
                            cntLessG5: dbData.cnt_less_g5 || 0, cntWithinG5: dbData.cnt_within_g5 || 0, cntAboveG5: dbData.cnt_above_g5 || 0,
                            cntLessG6: dbData.cnt_less_g6 || 0, cntWithinG6: dbData.cnt_within_g6 || 0, cntAboveG6: dbData.cnt_above_g6 || 0,
                            cntLessG7: dbData.cnt_less_g7 || 0, cntWithinG7: dbData.cnt_within_g7 || 0, cntAboveG7: dbData.cnt_above_g7 || 0,
                            cntLessG8: dbData.cnt_less_g8 || 0, cntWithinG8: dbData.cnt_within_g8 || 0, cntAboveG8: dbData.cnt_above_g8 || 0,
                            cntLessG9: dbData.cnt_less_g9 || 0, cntWithinG9: dbData.cnt_within_g9 || 0, cntAboveG9: dbData.cnt_above_g9 || 0,
                            cntLessG10: dbData.cnt_less_g10 || 0, cntWithinG10: dbData.cnt_within_g10 || 0, cntAboveG10: dbData.cnt_above_g10 || 0,
                            cntLessG11: dbData.cnt_less_g11 || 0, cntWithinG11: dbData.cnt_within_g11 || 0, cntAboveG11: dbData.cnt_above_g11 || 0,
                            cntLessG12: dbData.cnt_less_g12 || 0, cntWithinG12: dbData.cnt_within_g12 || 0, cntAboveG12: dbData.cnt_above_g12 || 0
                        };
                        setClassSizeData(initialClassSize);

                        setOriginalData({ ...initialData, classSize: initialClassSize });

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

    const handleClassSizeChange = (e) => setClassSizeData({ ...classSizeData, [e.target.name]: parseInt(e.target.value) || 0 });

    // --- ACTIONS ---
    const handleUpdateClick = () => setShowEditModal(true);

    const handleConfirmEdit = () => {
        setOriginalData({ ...formData, classSize: { ...classSizeData } });
        setIsLocked(false);
        setShowEditModal(false);
    };

    const handleCancelEdit = () => {
        if (originalData) {
            setFormData(originalData); // Restore main form
            if (originalData.classSize) setClassSizeData(originalData.classSize); // Restore class size
        }
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
            setShowOfflineModal(true);

            setOriginalData({ ...formData, classSize: { ...classSizeData } });
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
            schoolId: schoolId || localStorage.getItem('schoolId'),
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
            g12: showSHS() ? formData.g12 : 0,
            ...classSizeData
        };

        if (!navigator.onLine) {
            try {
                await addToOutbox({
                    type: 'ORGANIZED_CLASSES',
                    label: 'Organized Classes',
                    url: '/api/save-organized-classes',
                    payload: payload
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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setShowSuccessModal(true);
                setOriginalData({ ...formData, classSize: { ...classSizeData } });
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
                    {/* --- CLASS SIZE STANDARD --- */}
                    <div className={sectionClass}>
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl">
                                ✅
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-800 dark:text-slate-200">Class Size Standards</h2>
                                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Number of Classes per Category</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 tracking-wider text-center border-b border-gray-100 dark:border-slate-700">
                                    <tr>
                                        <th className="pb-3 text-left pl-2">Grade Level</th>
                                        <th className="pb-3 text-emerald-600">{"< 50"} <br /> (Less than)</th>
                                        <th className="pb-3 text-blue-600">{"50 - 60"} <br /> (Within)</th>
                                        <th className="pb-3 text-red-600">{"> 60"} <br /> (Above)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                                    {/* Generate Rows Dynamically */}
                                    {[
                                        ...(showElem() ? [1, 2, 3, 4, 5, 6] : []),
                                        ...(showJHS() ? [7, 8, 9, 10] : []),
                                        ...(showSHS() ? [11, 12] : [])
                                    ].map(g => (
                                        <tr key={g} className="group hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="py-2 pl-2 font-bold text-gray-600 dark:text-slate-300 text-xs">Grade {g}</td>
                                            <td className="p-1">
                                                <input
                                                    type="number" min="0"
                                                    name={`cntLessG${g}`}
                                                    value={classSizeData[`cntLessG${g}`]}
                                                    onChange={handleClassSizeChange}
                                                    disabled={isLocked || viewOnly}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-emerald-700 bg-emerald-50/30 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs transition-all hover:border-emerald-200"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="number" min="0"
                                                    name={`cntWithinG${g}`}
                                                    value={classSizeData[`cntWithinG${g}`]}
                                                    onChange={handleClassSizeChange}
                                                    disabled={isLocked || viewOnly}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-blue-700 bg-blue-50/30 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs transition-all hover:border-blue-200"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="number" min="0"
                                                    name={`cntAboveG${g}`}
                                                    value={classSizeData[`cntAboveG${g}`]}
                                                    onChange={handleClassSizeChange}
                                                    disabled={isLocked || viewOnly}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-red-700 bg-red-50/30 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-xs transition-all hover:border-red-200"
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

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="Organized Classes saved successfully!" />
        </div>
    );
};

export default OrganizedClasses;