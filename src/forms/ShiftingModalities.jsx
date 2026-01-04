// src/forms/ShiftingModalities.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase'; 
import { onAuthStateChanged } from "firebase/auth";
import LoadingScreen from '../components/LoadingScreen';
import { addToOutbox } from '../db'; // 👈 Import Outbox

const ShiftingModalities = () => {
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
    
    // Form Data
    const [shifts, setShifts] = useState({});
    const [modes, setModes] = useState({});
    const [adms, setAdms] = useState({
        adm_mdl: false, adm_odl: false, adm_tvi: false, adm_blended: false, adm_others: ''
    });

    const [originalData, setOriginalData] = useState(null);
    const goBack = () => navigate('/school-forms');

    // --- FETCH DATA ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const res = await fetch(`/api/learning-modalities/${user.uid}`);
                    const json = await res.json();

                    if (json.exists) {
                        setSchoolId(json.schoolId);
                        setOffering(json.offering || '');
                        
                        const db = json.data;
                        
                        // Parse DB Data to State
                        const loadedShifts = {};
                        const loadedModes = {};
                        const levels = ["kinder", "g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8", "g9", "g10", "g11", "g12"];
                        
                        levels.forEach(lvl => {
                            loadedShifts[`shift_${lvl}`] = db[`shift_${lvl}`] || '';
                            loadedModes[`mode_${lvl}`] = db[`mode_${lvl}`] || '';
                        });

                        const loadedAdms = {
                            adm_mdl: db.adm_mdl || false,
                            adm_odl: db.adm_odl || false,
                            adm_tvi: db.adm_tvi || false,
                            adm_blended: db.adm_blended || false,
                            adm_others: db.adm_others || '' 
                        };

                        setShifts(loadedShifts);
                        setModes(loadedModes);
                        setAdms(loadedAdms);

                        setOriginalData({ shifts: loadedShifts, modes: loadedModes, adms: loadedAdms });

                        // Lock if data exists
                        if (db.shift_g1 || db.adm_others || db.adm_mdl) setIsLocked(true);
                    }
                } catch (error) { console.error("Fetch error:", error); }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- VISIBILITY HELPERS ---
    const showElem = () => offering.includes("Elementary") || offering.includes("K-12") || offering.includes("K-10");
    const showJHS = () => offering.includes("Junior") || offering.includes("K-12") || offering.includes("K-10");
    const showSHS = () => offering.includes("Senior") || offering.includes("K-12");

    // --- HANDLERS ---
    const handleShiftChange = (e, lvl) => setShifts({ ...shifts, [`shift_${lvl}`]: e.target.value });
    const handleModeChange = (e, lvl) => setModes({ ...modes, [`mode_${lvl}`]: e.target.value });
    const handleAdmCheck = (e) => setAdms({ ...adms, [e.target.name]: e.target.checked });
    const handleAdmText = (e) => setAdms({ ...adms, adm_others: e.target.value });

    // --- ACTIONS ---
    const handleUpdateClick = () => setShowEditModal(true);
    const handleConfirmEdit = () => { setIsLocked(false); setShowEditModal(false); };
    const handleCancelEdit = () => {
        if (originalData) {
            setShifts(originalData.shifts);
            setModes(originalData.modes);
            setAdms(originalData.adms);
        }
        setIsLocked(true);
    };

    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);

        const cleanShifts = { ...shifts };
        const cleanModes = { ...modes };

        // Clean up hidden fields based on offering
        if (!showElem()) { ["kinder", "g1", "g2", "g3", "g4", "g5", "g6"].forEach(l => { cleanShifts[`shift_${l}`] = ""; cleanModes[`mode_${l}`] = ""; }); }
        if (!showJHS()) { ["g7", "g8", "g9", "g10"].forEach(l => { cleanShifts[`shift_${l}`] = ""; cleanModes[`mode_${l}`] = ""; }); }
        if (!showSHS()) { ["g11", "g12"].forEach(l => { cleanShifts[`shift_${l}`] = ""; cleanModes[`mode_${l}`] = ""; }); }

        const payload = { 
            schoolId, 
            ...cleanShifts, 
            ...cleanModes, 
            ...adms 
        };

        // Helper to update UI on success
        const handleSuccess = () => {
            setShifts(cleanShifts);
            setModes(cleanModes);
            setOriginalData({ shifts: cleanShifts, modes: cleanModes, adms });
            setIsLocked(true);
        };

        // 🛡️ OFFLINE SAVE HELPER
        const saveOffline = async () => {
            try {
                await addToOutbox({
                    type: 'SHIFTING_MODALITIES',
                    label: 'Shifting & Modalities',
                    url: '/api/save-learning-modalities',
                    payload: payload
                });
                alert("⚠️ Connection unstable. \n\nData saved to Outbox! Sync when you have internet.");
                handleSuccess();
            } catch (e) { 
                alert("Critical Error: Could not save locally."); 
            }
        };

        // 1. Check Explicit Offline
        if (!navigator.onLine) {
            await saveOffline();
            setIsSaving(false);
            return;
        }

        // 2. Try Online Save
        try {
            const res = await fetch('/api/save-learning-modalities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert('Saved successfully!');
                handleSuccess();
            } else { 
                throw new Error("Server Error"); 
            }
        } catch (err) { 
            console.log("Fetch failed, falling back to offline...", err);
            await saveOffline(); 
        } 
        finally { setIsSaving(false); }
    };

    if (loading) return <LoadingScreen message="Loading Modalities..." />;

    // --- SUB-COMPONENT ---
    const GradeRow = ({ label, lvl }) => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
            <div className="flex items-center">
                <span className="font-bold text-gray-700 text-sm">{label}</span>
            </div>
            
            {/* Shifting */}
            <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Shifting Strategy</label>
                <select 
                    value={shifts[`shift_${lvl}`]} 
                    onChange={(e) => handleShiftChange(e, lvl)} 
                    disabled={isLocked}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#004A99]"
                >
                    <option value="">Select...</option>
                    <option value="Single Shift">Single Shift</option>
                    <option value="Double Shift">Double Shift</option>
                    <option value="Triple Shift">Triple Shift</option>
                </select>
            </div>

            {/* Modality */}
            <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Learning Delivery</label>
                <select 
                    value={modes[`mode_${lvl}`]} 
                    onChange={(e) => handleModeChange(e, lvl)} 
                    disabled={isLocked}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#004A99]"
                >
                    <option value="">Select...</option>
                    <option value="In-Person Classes">In-Person Classes</option>
                    <option value="Blended Learning (3-2)">Blended (3-2)</option>
                    <option value="Blended Learning (4-1)">Blended (4-1)</option>
                    <option value="Full Distance Learning">Full Distance Learning</option>
                </select>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-32 relative">
             {/* --- HEADER --- */}
             <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white/80 hover:text-white text-2xl transition">&larr;</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Shifting & Modality</h1>
                        <p className="text-blue-200 text-xs mt-1">Manage schedules and delivery modes</p>
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="px-5 -mt-12 relative z-20 max-w-4xl mx-auto space-y-6">
                
                {/* 1. PER GRADE STRATEGIES */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="font-bold text-gray-800 flex items-center gap-2">
                            <span className="text-xl">🗓️</span> Per Grade Strategy
                        </h2>
                        {offering && <span className="text-[10px] bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold uppercase">{offering}</span>}
                    </div>
                    
                    {showElem() && (
                        <div className="mb-6">
                            <div className="bg-blue-50 text-blue-800 px-3 py-1 rounded-lg text-xs font-bold inline-block mb-4">Elementary</div>
                            <GradeRow label="Kinder" lvl="kinder" />
                            <GradeRow label="Grade 1" lvl="g1" />
                            <GradeRow label="Grade 2" lvl="g2" />
                            <GradeRow label="Grade 3" lvl="g3" />
                            <GradeRow label="Grade 4" lvl="g4" />
                            <GradeRow label="Grade 5" lvl="g5" />
                            <GradeRow label="Grade 6" lvl="g6" />
                        </div>
                    )}

                    {showJHS() && (
                        <div className="mb-6">
                            <div className="bg-blue-50 text-blue-800 px-3 py-1 rounded-lg text-xs font-bold inline-block mb-4">Junior High School</div>
                            <GradeRow label="Grade 7" lvl="g7" />
                            <GradeRow label="Grade 8" lvl="g8" />
                            <GradeRow label="Grade 9" lvl="g9" />
                            <GradeRow label="Grade 10" lvl="g10" />
                        </div>
                    )}

                    {showSHS() && (
                        <div>
                            <div className="bg-blue-50 text-blue-800 px-3 py-1 rounded-lg text-xs font-bold inline-block mb-4">Senior High School</div>
                            <GradeRow label="Grade 11" lvl="g11" />
                            <GradeRow label="Grade 12" lvl="g12" />
                        </div>
                    )}

                     {/* Empty State if no offering matches */}
                     {!showElem() && !showJHS() && !showSHS() && (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            <p className="font-bold text-gray-500">No levels available.</p>
                            <p className="text-xs text-gray-400 mt-1">Please set your "Curricular Offering" in Enrolment.</p>
                        </div>
                    )}
                </div>

                {/* 2. ADM CHECKLIST */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <span className="text-xl">📡</span> Alternative Delivery Modes (ADMs)
                    </h2>
                    <p className="text-xs text-gray-500 mb-4">Which ADMs are utilized during class suspensions or emergencies?</p>
                    
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" name="adm_mdl" checked={adms.adm_mdl} onChange={handleAdmCheck} disabled={isLocked} className="w-5 h-5 accent-[#004A99]" />
                            <span className="text-sm font-semibold text-gray-700">Modular Distance Learning (MDL)</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" name="adm_odl" checked={adms.adm_odl} onChange={handleAdmCheck} disabled={isLocked} className="w-5 h-5 accent-[#004A99]" />
                            <span className="text-sm font-semibold text-gray-700">Online Distance Learning (ODL)</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" name="adm_tvi" checked={adms.adm_tvi} onChange={handleAdmCheck} disabled={isLocked} className="w-5 h-5 accent-[#004A99]" />
                            <span className="text-sm font-semibold text-gray-700">TV/Radio-Based Instruction (TVI/RBI)</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" name="adm_blended" checked={adms.adm_blended} onChange={handleAdmCheck} disabled={isLocked} className="w-5 h-5 accent-[#004A99]" />
                            <span className="text-sm font-semibold text-gray-700">Blended Learning</span>
                        </label>
                    </div>

                    <div className="mt-6">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Other ADMs (Aside from above)</label>
                        <textarea 
                            value={adms.adm_others} 
                            onChange={handleAdmText} 
                            disabled={isLocked}
                            placeholder="If none, put N/A"
                            className="w-full p-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004A99] focus:outline-none"
                            rows="2"
                        ></textarea>
                    </div>
                </div>

            </div>

             {/* --- FLOATING ACTION BAR --- */}
             <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 pb-8 z-50 flex gap-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                {isLocked ? (
                    <button onClick={handleUpdateClick} className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-amber-600 active:scale-[0.98] transition flex items-center justify-center gap-2">
                        <span>🔓</span> Unlock to Edit
                    </button>
                ) : (
                    <>
                        {/* Only show Cancel if we have data to revert to */}
                        {originalData && <button onClick={handleCancelEdit} className="flex-1 bg-gray-100 text-gray-600 font-bold py-4 rounded-xl hover:bg-gray-200">Cancel</button>}
                        
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-[#A30000] flex items-center justify-center gap-2">
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </>
                )}
            </div>

            {/* --- MODALS --- */}
            {showEditModal && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg">Edit Modalities?</h3><p className="text-gray-500 text-sm mt-2">Unlock fields to modify strategies.</p><div className="mt-6 flex gap-2"><button onClick={()=>setShowEditModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-600">Cancel</button><button onClick={handleConfirmEdit} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold shadow-md">Unlock</button></div></div></div>}
            {showSaveModal && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg">Save Changes?</h3><p className="text-gray-500 text-sm mt-2">This will update the database records.</p><div className="mt-6 flex gap-2"><button onClick={()=>setShowSaveModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-600">Cancel</button><button onClick={confirmSave} className="flex-1 py-3 bg-[#CC0000] text-white rounded-xl font-bold shadow-md">Confirm Save</button></div></div></div>}

        </div>
    );
};

export default ShiftingModalities;