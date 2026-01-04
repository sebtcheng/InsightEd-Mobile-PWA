// src/forms/TeachingPersonnel.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase'; 
import { onAuthStateChanged } from "firebase/auth";
import LoadingScreen from '../components/LoadingScreen';
import { addToOutbox } from '../db'; // 👈 Added Import

const TeachingPersonnel = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // UI States
    const [isLocked, setIsLocked] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);

    // Data
    const [schoolId, setSchoolId] = useState(null);
    const [offering, setOffering] = useState('');
    const [formData, setFormData] = useState({
        es: 0,
        jhs: 0,
        shs: 0
    });
    const [originalData, setOriginalData] = useState(null);

    const goBack = () => navigate('/school-forms');

    // --- FETCH DATA ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const res = await fetch(`/api/teaching-personnel/${user.uid}`);
                    const json = await res.json();

                    if (json.exists) {
                        setSchoolId(json.schoolId);
                        setOffering(json.offering || '');
                        
                        const db = json.data;
                        const initialData = {
                            es: db.es || 0,
                            jhs: db.jhs || 0,
                            shs: db.shs || 0
                        };
                        setFormData(initialData);
                        setOriginalData(initialData);

                        const hasData = (db.es > 0 || db.jhs > 0 || db.shs > 0);
                        if (hasData) setIsLocked(true);
                    }
                } catch (error) {
                    console.error("Error fetching personnel:", error);
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

    const getTotal = () => {
        let total = 0;
        if (showElem()) total += formData.es;
        if (showJHS()) total += formData.jhs;
        if (showSHS()) total += formData.shs;
        return total;
    };

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
                type: 'TEACHING_PERSONNEL',
                label: 'Teaching Personnel',
                url: '/api/save-teaching-personnel',
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
        const payload = { 
            schoolId, 
            es: showElem() ? formData.es : 0,
            jhs: showJHS() ? formData.jhs : 0,
            shs: showSHS() ? formData.shs : 0
        };

        // 1. Check Explicit Offline
        if (!navigator.onLine) {
            await saveOffline(payload);
            setIsSaving(false);
            return;
        }

        // 2. Try Online Save
        try {
            const res = await fetch('/api/save-teaching-personnel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert('Success: Teaching Personnel saved!');
                setOriginalData({ ...formData });
                setIsLocked(true); 
            } else {
                // Force fallback if server error
                throw new Error("Server rejected request");
            }
        } catch (err) {
            // 3. Network Failure Fallback
            console.log("Fetch failed, falling back to offline store...", err);
            await saveOffline(payload);
        } finally {
            setIsSaving(false);
        }
    };

    // --- STYLES ---
    const inputClass = "w-full md:w-32 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004A99] bg-white text-gray-800 font-bold text-center text-xl shadow-sm disabled:bg-gray-100 disabled:text-gray-500 transition-all";
    const labelClass = "text-gray-700 font-bold text-sm md:text-base";
    const rowClass = "bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4";

    if (loading) return <LoadingScreen message="Loading Personnel Data..." />;

    // Helper Input
    const TeacherInput = ({ label, name }) => (
        <div className={rowClass}>
            <label className={labelClass}>{label}</label>
            <input 
                type="number" 
                min="0"
                name={name}
                value={formData[name]}
                onChange={handleChange}
                disabled={isLocked}
                className={inputClass}
            />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-32 relative"> 
            
            {/* --- TOP HEADER --- */}
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white/80 hover:text-white text-2xl transition">&larr;</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Teaching Personnel</h1>
                        <p className="text-blue-200 text-xs mt-1">Summary of teachers by level</p>
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="px-5 -mt-12 relative z-20">
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                    
                    {/* Status Bar */}
                    <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                        <div>
                             <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Teachers</p>
                             <p className="text-3xl font-extrabold text-[#004A99] mt-1">{getTotal()}</p>
                        </div>
                        {offering && <span className="text-[10px] bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold uppercase">{offering}</span>}
                    </div>

                    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                        
                        {showElem() && <TeacherInput label="Elementary School (ES) Teachers" name="es" />}
                        {showJHS() && <TeacherInput label="Junior High School (JHS) Teachers" name="jhs" />}
                        {showSHS() && <TeacherInput label="Senior High School (SHS) Teachers" name="shs" />}

                        {!showElem() && !showJHS() && !showSHS() && (
                            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                <p className="font-bold text-gray-500">No levels available.</p>
                                <p className="text-xs text-gray-400 mt-1">Please set your "Curricular Offering" in Enrolment.</p>
                            </div>
                        )}
                    </form>
                </div>
            </div>

            {/* --- FLOATING ACTION BAR --- */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 pb-8 z-50 flex gap-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                {isLocked ? (
                    <button 
                        onClick={handleUpdateClick}
                        className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-amber-600 active:scale-[0.98] transition flex items-center justify-center gap-2"
                    >
                        <span>🔓</span> Unlock to Edit
                    </button>
                ) : (
                    <>
                        {originalData && <button onClick={handleCancelEdit} className="flex-1 bg-gray-100 text-gray-600 font-bold py-4 rounded-xl hover:bg-gray-200">Cancel</button>}
                        
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-[#A30000] flex items-center justify-center gap-2">
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </>
                )}
            </div>

            {/* --- MODALS --- */}
            {showEditModal && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg">Edit Data?</h3><p className="text-gray-500 text-sm mt-2">Unlock fields to modify teacher counts.</p><div className="mt-6 flex gap-2"><button onClick={()=>setShowEditModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-600">Cancel</button><button onClick={handleConfirmEdit} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold shadow-md">Unlock</button></div></div></div>}
            
            {showSaveModal && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg">Save Changes?</h3><p className="text-gray-500 text-sm mt-2">This will update the database records.</p><div className="mt-6 flex gap-2"><button onClick={()=>setShowSaveModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-600">Cancel</button><button onClick={confirmSave} className="flex-1 py-3 bg-[#CC0000] text-white rounded-xl font-bold shadow-md">Confirm Save</button></div></div></div>}

        </div>
    );
};

export default TeachingPersonnel;