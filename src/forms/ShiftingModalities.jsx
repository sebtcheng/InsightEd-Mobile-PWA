// src/forms/ShiftingModalities.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { addToOutbox } from '../db';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';

// --- SUB-COMPONENT (Moved Outside) ---
const GradeRow = ({ label, lvl, shifts, modes, onShiftChange, onModeChange, isLocked, viewOnly }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
        <div className="flex items-center">
            <span className="font-bold text-gray-700 text-sm">{label}</span>
        </div>
        <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Shifting Strategy</label>
            <select
                value={shifts[`shift_${lvl}`] || ''}
                onChange={(e) => onShiftChange(e, lvl)}
                disabled={isLocked || viewOnly}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#004A99] dark:focus:ring-blue-500 disabled:bg-gray-50 dark:disabled:bg-slate-900"
            >
                <option value="">Select...</option>
                <option value="Single Shift">Single Shift</option>
                <option value="Double Shift">Double Shift</option>
                <option value="Triple Shift">Triple Shift</option>
            </select>
        </div>
        <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Learning Delivery</label>
            <select
                value={modes[`mode_${lvl}`] || ''}
                onChange={(e) => onModeChange(e, lvl)}
                disabled={isLocked || viewOnly}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#004A99] dark:focus:ring-blue-500 disabled:bg-gray-50 dark:disabled:bg-slate-900"
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

const ShiftingModalities = () => {
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
    const [hasSavedData, setHasSavedData] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

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
    const goBack = () => navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');

    // --- FETCH DATA (With Offline Offering Recovery) ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // 1. OFFLINE RECOVERY: Load from LocalStorage first
                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');

                if (storedSchoolId) setSchoolId(storedSchoolId);
                if (storedOffering) setOffering(storedOffering);

                try {
                    let fetchUrl = `/api/learning-modalities/${user.uid}`;
                    if (viewOnly && schoolIdParam) {
                        fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                    }

                    const res = await fetch(fetchUrl);
                    const json = await res.json();

                    if (json.exists || (viewOnly && schoolIdParam)) {
                        setSchoolId(json.school_id || json.schoolId || storedSchoolId);
                        setOffering(json.curricular_offering || json.offering || storedOffering || '');

                        // Keep cache in sync
                        localStorage.setItem('schoolId', json.schoolId);
                        localStorage.setItem('schoolOffering', json.offering || '');

                        const dbData = (viewOnly && schoolIdParam) ? json : json.data;
                        const loadedShifts = {};
                        const loadedModes = {};
                        const levels = ["kinder", "g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8", "g9", "g10", "g11", "g12"];

                        levels.forEach(lvl => {
                            loadedShifts[`shift_${lvl}`] = dbData[`shift_${lvl}`] || '';
                            loadedModes[`mode_${lvl}`] = dbData[`mode_${lvl}`] || '';
                        });

                        const loadedAdms = {
                            adm_mdl: dbData.adm_mdl || false,
                            adm_odl: dbData.adm_odl || false,
                            adm_tvi: dbData.adm_tvi || false,
                            adm_blended: dbData.adm_blended || false,
                            adm_others: dbData.adm_others || ''
                        };

                        setShifts(loadedShifts);
                        setModes(loadedModes);
                        setAdms(loadedAdms);
                        setOriginalData({ shifts: loadedShifts, modes: loadedModes, adms: loadedAdms });

                        // Check if specifically Modalities data exists
                        const relevantKeys = [
                            ...levels.map(l => `shift_${l}`),
                            ...levels.map(l => `mode_${l}`),
                            "adm_mdl", "adm_odl", "adm_tvi", "adm_blended", "adm_others"
                        ];
                        const hasModalitiesData = relevantKeys.some(k => dbData[k] && dbData[k] !== '' && dbData[k] !== false);

                        if (hasModalitiesData || viewOnly) {
                            setIsLocked(true);
                            setHasSavedData(true);
                        } else {
                            setHasSavedData(false);
                            setIsLocked(false);
                        }
                    }
                } catch (error) {
                    console.error("Offline or Error fetching modalities:", error);
                    // UI will rely on storedOffering from step 1
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- VISIBILITY HELPERS (Uses 'offering' which is now offline-available) ---
    const showElem = () => offering.includes("Elementary") || offering.includes("K-12") || offering.includes("K-10");
    const showJHS = () => offering.includes("Junior") || offering.includes("K-12") || offering.includes("K-10");
    const showSHS = () => offering.includes("Senior") || offering.includes("K-12");

    // --- HANDLERS ---
    const handleShiftChange = (e, lvl) => setShifts(prev => ({ ...prev, [`shift_${lvl}`]: e.target.value }));
    const handleModeChange = (e, lvl) => setModes(prev => ({ ...prev, [`mode_${lvl}`]: e.target.value }));
    const handleAdmCheck = (e) => setAdms({ ...adms, [e.target.name]: e.target.checked });
    const handleAdmText = (e) => setAdms({ ...adms, adm_others: e.target.value });

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

    // --- SAVE ---
    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);

        const cleanShifts = { ...shifts };
        const cleanModes = { ...modes };

        // Payload sanitization based on current offering
        if (!showElem()) { ["kinder", "g1", "g2", "g3", "g4", "g5", "g6"].forEach(l => { cleanShifts[`shift_${l}`] = ""; cleanModes[`mode_${l}`] = ""; }); }
        if (!showJHS()) { ["g7", "g8", "g9", "g10"].forEach(l => { cleanShifts[`shift_${l}`] = ""; cleanModes[`mode_${l}`] = ""; }); }
        if (!showSHS()) { ["g11", "g12"].forEach(l => { cleanShifts[`shift_${l}`] = ""; cleanModes[`mode_${l}`] = ""; }); }

        const payload = {
            schoolId: schoolId || localStorage.getItem('schoolId'),
            ...cleanShifts,
            ...cleanModes,
            ...adms
        };

        const saveOffline = async () => {
            try {
                await addToOutbox({
                    type: 'SHIFTING_MODALITIES',
                    label: 'Shifting & Modalities',
                    url: '/api/save-learning-modalities',
                    payload: payload
                });
                setShowOfflineModal(true);
                setOriginalData({ shifts: cleanShifts, modes: cleanModes, adms });
                setIsLocked(true);
            } catch (e) { alert("Error saving locally."); }
        };

        if (!navigator.onLine) {
            await saveOffline();
            setIsSaving(false);
            return;
        }

        try {
            const res = await fetch('/api/save-learning-modalities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setShowSuccessModal(true);
                setOriginalData({ shifts: cleanShifts, modes: cleanModes, adms });
                setIsLocked(true);
                setHasSavedData(true);
            } else { throw new Error(); }
        } catch (err) {
            await saveOffline();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-900 font-sans pb-32 relative">
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white text-2xl">←</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Shifting & Modality</h1>
                        <p className="text-blue-200 text-xs mt-1">{viewOnly ? "Monitor View (Read-Only)" : "Manage schedules and delivery modes"}</p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-4xl mx-auto space-y-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="font-bold text-gray-800 dark:text-slate-200 flex items-center gap-2">🗓️ Per Grade Strategy</h2>
                        {offering && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full font-bold uppercase">{offering}</span>}
                    </div>

                    {showElem() && (
                        <div className="mb-6">
                            <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-lg text-xs font-bold inline-block mb-4">Elementary</div>
                            {/* Passed props to external GradeRow */}
                            <GradeRow label="Kinder" lvl="kinder" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 1" lvl="g1" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 2" lvl="g2" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 3" lvl="g3" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 4" lvl="g4" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 5" lvl="g5" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 6" lvl="g6" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                        </div>
                    )}

                    {showJHS() && (
                        <div className="mb-6">
                            <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-lg text-xs font-bold inline-block mb-4">Junior High School</div>
                            <GradeRow label="Grade 7" lvl="g7" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 8" lvl="g8" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 9" lvl="g9" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 10" lvl="g10" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                        </div>
                    )}

                    {showSHS() && (
                        <div>
                            <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-lg text-xs font-bold inline-block mb-4">Senior High School</div>
                            <GradeRow label="Grade 11" lvl="g11" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 12" lvl="g12" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                    <h2 className="font-bold text-gray-800 dark:text-slate-200 mb-2 flex items-center gap-2">📡 Emergency ADMs</h2>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-4 tracking-tight">Utilized during class suspensions or emergencies.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {['adm_mdl', 'adm_odl', 'adm_tvi', 'adm_blended'].map(adm => (
                            <label key={adm} className="flex items-center gap-3 p-3 border border-gray-100 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition">
                                <input type="checkbox" name={adm} checked={adms[adm]} onChange={handleAdmCheck} disabled={isLocked || viewOnly} className="w-5 h-5 accent-[#004A99] dark:accent-blue-500" />
                                <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase">
                                    {adm === 'adm_mdl' ? 'Modular' : adm === 'adm_odl' ? 'Online' : adm === 'adm_tvi' ? 'TV/Radio' : 'Blended'}
                                </span>
                            </label>
                        ))}
                    </div>
                    <div className="mt-4">
                        <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-2">Other Strategies</label>
                        <textarea
                            value={adms.adm_others} onChange={handleAdmText} disabled={isLocked || viewOnly}
                            placeholder="Specify other modes..."
                            className="w-full p-4 border border-gray-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" rows="2"
                        />
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 pb-10 z-50 flex gap-3 shadow-lg">
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
                        {originalData && hasSavedData && <button onClick={handleCancelEdit} className="flex-1 bg-gray-100 text-gray-500 font-bold py-4 rounded-xl">Cancel</button>}
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg">
                            {isSaving ? "Saving..." : (hasSavedData ? "Update Changes" : "Save Settings")}
                        </button>
                    </>
                )}
            </div>

            {showEditModal && <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg">Edit Modalities?</h3><div className="mt-6 flex gap-2"><button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button><button onClick={handleConfirmEdit} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold">Unlock</button></div></div></div>}
            {showSaveModal && <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg">{hasSavedData ? "Confirm Update?" : "Confirm Save?"}</h3><div className="mt-6 flex gap-2"><button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button><button onClick={confirmSave} className="flex-1 py-3 bg-[#CC0000] text-white rounded-xl font-bold">Confirm</button></div></div></div>}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message={hasSavedData ? 'Settings Updated!' : 'Settings Saved!'} />
        </div>
    );
};

export default ShiftingModalities;