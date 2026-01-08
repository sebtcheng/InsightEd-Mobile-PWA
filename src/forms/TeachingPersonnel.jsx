// src/forms/TeachingPersonnel.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase'; 
import { onAuthStateChanged } from "firebase/auth";
import LoadingScreen from '../components/LoadingScreen';
import { addToOutbox } from '../db';
import SchoolHeadBottomNav from '../modules/SchoolHeadBottomNav';

const TeachingPersonnel = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);

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
                    const res = await fetch(`/api/teaching-personnel/${user.uid}`);
                    const json = await res.json();

                    if (json.exists) {
                        setSchoolId(json.schoolId || storedSchoolId);
                        setOffering(json.offering || storedOffering || '');

                        const db = json.data;
                        const initialData = {
                            teach_kinder: db.teach_kinder || 0,
                            teach_g1: db.teach_g1 || 0, teach_g2: db.teach_g2 || 0, teach_g3: db.teach_g3 || 0,
                            teach_g4: db.teach_g4 || 0, teach_g5: db.teach_g5 || 0, teach_g6: db.teach_g6 || 0,
                            teach_g7: db.teach_g7 || 0, teach_g8: db.teach_g8 || 0, teach_g9: db.teach_g9 || 0, teach_g10: db.teach_g10 || 0,
                            teach_g11: db.teach_g11 || 0, teach_g12: db.teach_g12 || 0
                        };
                        setFormData(initialData);
                        setOriginalData(initialData);

                        const hasData = Object.values(db).some(val => val > 0);
                        if (hasData) setIsLocked(true);
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
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1 text-center">{label}</label>
            <input 
                type="number" min="0" 
                name={name} 
                value={formData[name]} 
                onChange={handleChange} 
                disabled={isLocked}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004A99] bg-white text-gray-800 font-bold text-center text-lg shadow-sm disabled:bg-gray-100 disabled:text-gray-500 transition-all" 
            />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-32 relative"> 
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white text-2xl">←</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Teaching Personnel</h1>
                        <p className="text-blue-200 text-xs mt-1">Teacher count per grade level</p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-4xl mx-auto">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Curricular Offering</p>
                        <p className="text-blue-900 font-bold text-sm uppercase">{offering || 'Not Set'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Faculty</p>
                        <p className="text-2xl font-extrabold text-[#004A99]">{getTotal()}</p>
                    </div>
                </div>

                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                    {showElem() && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h2 className="text-gray-800 font-bold text-md mb-4 flex items-center gap-2">🎒 Elementary</h2>
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
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h2 className="text-gray-800 font-bold text-md mb-4 flex items-center gap-2">📘 Junior High</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <TeacherInput label="Grade 7" name="teach_g7" />
                                <TeacherInput label="Grade 8" name="teach_g8" />
                                <TeacherInput label="Grade 9" name="teach_g9" />
                                <TeacherInput label="Grade 10" name="teach_g10" />
                            </div>
                        </div>
                    )}

                    {showSHS() && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h2 className="text-gray-800 font-bold text-md mb-4 flex items-center gap-2">🎓 Senior High</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <TeacherInput label="Grade 11" name="teach_g11" />
                                <TeacherInput label="Grade 12" name="teach_g12" />
                            </div>
                        </div>
                    )}
                </form>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 pb-10 z-50 flex gap-3 shadow-2xl">
                {isLocked ? (
                    <button onClick={handleUpdateClick} className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg">✏️ Unlock to Edit</button>
                ) : (
                    <>
                        {originalData && <button onClick={handleCancelEdit} className="flex-1 bg-gray-100 text-gray-500 font-bold py-4 rounded-xl">Cancel</button>}
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg">
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </>
                )}
            </div>

            {showEditModal && <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg">Edit Personnel?</h3><div className="mt-6 flex gap-2"><button onClick={()=>setShowEditModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-600">Cancel</button><button onClick={handleConfirmEdit} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold">Unlock</button></div></div></div>}
            {showSaveModal && <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg">Save Changes?</h3><div className="mt-6 flex gap-2"><button onClick={()=>setShowSaveModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-600">Cancel</button><button onClick={confirmSave} className="flex-1 py-3 bg-[#CC0000] text-white rounded-xl font-bold">Confirm</button></div></div></div>}

            <SchoolHeadBottomNav />
        </div>
    );
};

export default TeachingPersonnel;