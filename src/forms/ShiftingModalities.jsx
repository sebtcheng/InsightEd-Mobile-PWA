// src/forms/ShiftingModalities.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { addToOutbox, getOutbox } from '../db';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';

import { FiArrowLeft, FiCalendar, FiClock, FiWifi, FiCheckCircle, FiSave, FiAlertCircle, FiBookOpen, FiHelpCircle, FiInfo } from 'react-icons/fi';
import { TbSchool } from 'react-icons/tb';

// --- SUB-COMPONENT (Moved Outside) ---
const GradeRow = ({ label, lvl, shifts, modes, onShiftChange, onModeChange, isLocked, viewOnly }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-50 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
        <div className="flex items-center">
            <span className="font-bold text-slate-700 text-sm">{label}</span>
        </div>
        <div>
            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Shifting Strategy</label>
            <p className="text-[9px] text-slate-400 font-medium mb-1.5 block">Select Dominant Mode</p>
            <div className="relative">
                <select
                    value={shifts[`shift_${lvl}`] || ''}
                    onChange={(e) => onShiftChange(e, lvl)}
                    disabled={isLocked || viewOnly}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none disabled:bg-slate-100 disabled:text-slate-400"
                >
                    <option value="">Select Strategy...</option>
                    <option value="Single Shift">Single Shift</option>
                    <option value="Double Shift">Double Shift</option>
                    <option value="Triple Shift">Triple Shift</option>
                </select>
                <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
                    <FiClock size={14} />
                </div>
            </div>
        </div>
        <div>
            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Learning Delivery</label>
            <p className="text-[9px] text-slate-400 font-medium mb-1.5 block">Select Dominant Mode</p>
            <div className="relative">
                <select
                    value={modes[`mode_${lvl}`] || ''}
                    onChange={(e) => onModeChange(e, lvl)}
                    disabled={isLocked || viewOnly}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none disabled:bg-slate-100 disabled:text-slate-400"
                >
                    <option value="">Select Mode...</option>
                    <option value="In-Person Classes">In-Person Classes</option>
                    <option value="Blended Learning (3-2)">Blended (3-2)</option>
                    <option value="Blended Learning (4-1)">Blended (4-1)</option>
                    <option value="Full Distance Learning">Full Distance Learning</option>
                </select>
                <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
                    <FiBookOpen size={14} />
                </div>
            </div>
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
    const [showInfoModal, setShowInfoModal] = useState(false);

    // Data
    const [schoolId, setSchoolId] = useState(null);
    const [offering, setOffering] = useState('');

    // Form Data
    const [shifts, setShifts] = useState({});
    const [modes, setModes] = useState({});
    const [adms, setAdms] = useState({
        adm_mdl: false, adm_odl: false, adm_tvi: false, adm_blended: false, adm_others: ''
    });

    const isDummy = location.state?.isDummy || false;
    const [originalData, setOriginalData] = useState(null);
    const goBack = () => {
        if (isDummy) {
            navigate(-1);
        } else {
            navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');
        }
    };

    // --- FETCH DATA (With Offline Offering Recovery) ---
    // --- FETCH DATA (Strict Instant Load Strategy) ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // STEP 1: PREPARE DEFAULTS
                const LEVELS = ["kinder", "g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8", "g9", "g10", "g11", "g12"];
                const defaultShifts = {};
                const defaultModes = {};
                LEVELS.forEach(lvl => {
                    defaultShifts[`shift_${lvl}`] = '';
                    defaultModes[`mode_${lvl}`] = '';
                });

                const defaultAdms = {
                    adm_mdl: false, adm_odl: false, adm_tvi: false, adm_blended: false, adm_others: ''
                };

                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');

                if (storedSchoolId) setSchoolId(storedSchoolId);
                if (storedOffering) setOffering(storedOffering);

                // STEP 2: IMMEDIATE CACHE LOAD
                let loadedFromCache = false;
                const CACHE_KEY = `CACHE_SHIFTING_${user.uid}`;
                const cachedData = localStorage.getItem(CACHE_KEY);

                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);

                        // Merge with defaults for safety
                        setShifts({ ...defaultShifts, ...(parsed.shifts || {}) });
                        setModes({ ...defaultModes, ...(parsed.modes || {}) });
                        setAdms({ ...defaultAdms, ...(parsed.adms || {}) });

                        if (parsed.curricular_offering) setOffering(parsed.curricular_offering);

                        const hasData = Object.values(parsed.shifts || {}).some(v => v) || Object.values(parsed.modes || {}).some(v => v) || (parsed.adms && (parsed.adms.adm_mdl || parsed.adms.adm_odl || parsed.adms.adm_tvi || parsed.adms.adm_blended));
                        setIsLocked(hasData);
                        setLoading(false); // CRITICAL: Instant Load
                        loadedFromCache = true;
                        console.log("Loaded cached Shifting Modalities (Instant Load)");
                    } catch (e) { console.error("Cache parse error", e); }
                }

                // STEP 3: ASYNC OPERATIONS (Outbox & Network)
                const performAsyncChecks = async () => {
                    let restored = false;

                    // A. Check Outbox
                    if (!viewOnly) {
                        try {
                            const drafts = await getOutbox();
                            const draft = drafts.find(d => d.type === 'SHIFTING_MODALITIES');
                            if (draft) {
                                console.log("Restored draft from Outbox");
                                const p = draft.payload;

                                if (p.curricular_offering || p.offering) {
                                    const draftOff = p.curricular_offering || p.offering;
                                    setOffering(draftOff);
                                    localStorage.setItem('schoolOffering', draftOff);
                                }

                                // Map Draft to State
                                const loadedShifts = {};
                                const loadedModes = {};
                                LEVELS.forEach(lvl => {
                                    loadedShifts[`shift_${lvl}`] = p[`shift_${lvl}`] || '';
                                    loadedModes[`mode_${lvl}`] = p[`mode_${lvl}`] || '';
                                });
                                // Merge draft specifically
                                setShifts({ ...defaultShifts, ...loadedShifts });
                                setModes({ ...defaultModes, ...loadedModes });

                                setAdms({
                                    ...defaultAdms, ...{
                                        adm_mdl: p.adm_mdl || false,
                                        adm_odl: p.adm_odl || false,
                                        adm_tvi: p.adm_tvi || false,
                                        adm_blended: p.adm_blended || false,
                                        adm_others: p.adm_others || ''
                                    }
                                });

                                setIsLocked(false);
                                restored = true;
                                setLoading(false);
                                return;
                            }
                        } catch (e) { console.error("Outbox check failed:", e); }
                    }

                    // B. Network Fetch
                    if (!restored) {
                        let fetchUrl = `/api/learning-modalities/${user.uid}`;
                        if (viewOnly && schoolIdParam) {
                            fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                        }

                        // Only show loading if we didn't load from cache
                        if (!loadedFromCache) setLoading(true);

                        try {
                            const res = await fetch(fetchUrl);
                            const json = await res.json();

                            if (json.exists || (viewOnly && schoolIdParam)) {
                                // Update IDs
                                setSchoolId(json.school_id || json.schoolId || storedSchoolId);
                                const newOffering = json.curricular_offering || json.offering || storedOffering || '';
                                setOffering(newOffering);

                                if (!viewOnly && json.school_id) {
                                    localStorage.setItem('schoolId', json.school_id || json.schoolId || storedSchoolId);
                                    localStorage.setItem('schoolOffering', newOffering);
                                }

                                const data = (viewOnly && schoolIdParam) ? (json.data || json) : (json.data || {});

                                // Map DB -> State
                                const loadedShifts = {};
                                const loadedModes = {};
                                LEVELS.forEach(lvl => {
                                    loadedShifts[`shift_${lvl}`] = data[`shift_${lvl}`] || '';
                                    loadedModes[`mode_${lvl}`] = data[`mode_${lvl}`] || '';
                                });

                                setShifts({ ...defaultShifts, ...loadedShifts });
                                setModes({ ...defaultModes, ...loadedModes });
                                setAdms({
                                    ...defaultAdms, ...{
                                        adm_mdl: data.adm_mdl || false,
                                        adm_odl: data.adm_odl || false,
                                        adm_tvi: data.adm_tvi || false,
                                        adm_blended: data.adm_blended || false,
                                        adm_others: data.adm_others || ''
                                    }
                                });

                                const hasData = Object.values(loadedShifts).some(v => v) || Object.values(loadedModes).some(v => v) || (data.adm_mdl || data.adm_odl || data.adm_tvi || data.adm_blended);
                                setIsLocked(hasData);

                                // Cache It
                                const cachePayload = {
                                    shifts: loadedShifts,
                                    modes: loadedModes,
                                    adms: {
                                        adm_mdl: data.adm_mdl || false,
                                        adm_odl: data.adm_odl || false,
                                        adm_tvi: data.adm_tvi || false,
                                        adm_blended: data.adm_blended || false,
                                        adm_others: data.adm_others || ''
                                    },
                                    curricular_offering: newOffering
                                };
                                localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
                            }
                        } catch (err) {
                            console.error("Fetch Error:", err);
                        } finally {
                            setLoading(false);
                        }
                    }
                };

                performAsyncChecks();
            }
        });
        return () => unsubscribe();
    }, [viewOnly, schoolIdParam]);




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
        <div className="min-h-screen bg-slate-50 font-sans pb-40">
            {/* --- PREMIUM BLUE HEADER --- */}
            <div className="bg-[#004A99] px-6 pt-10 pb-20 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                            <FiArrowLeft size={24} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-white tracking-tight">Shifting & Modality</h1>
                                {offering && (
                                    <span className="px-2 py-0.5 rounded-lg bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/10">
                                        {offering}
                                    </span>
                                )}
                            </div>
                            <p className="text-blue-100 text-xs font-medium mt-1">Q: What is the shifting schedule and learning delivery mode adopted by each grade level?</p>
                        </div>
                    </div>
                    <button onClick={() => setShowInfoModal(true)} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                        <FiHelpCircle size={24} />
                    </button>
                </div>
            </div>

            <div className="px-5 -mt-10 relative z-20 max-w-4xl mx-auto space-y-6">

                {/* --- GRADE LEVEL STRATEGIES --- */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                            <FiCalendar />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Per Grade Strategy</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Schedule & Learning Mode</p>
                        </div>
                    </div>

                    {showElem() && (
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Elementary</span>
                            </div>
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
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Junior High School</span>
                            </div>
                            <GradeRow label="Grade 7" lvl="g7" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 8" lvl="g8" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 9" lvl="g9" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 10" lvl="g10" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                        </div>
                    )}

                    {showSHS() && (
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Senior High School</span>
                            </div>
                            <GradeRow label="Grade 11" lvl="g11" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                            <GradeRow label="Grade 12" lvl="g12" shifts={shifts} modes={modes} onShiftChange={handleShiftChange} onModeChange={handleModeChange} isLocked={isLocked} viewOnly={viewOnly} />
                        </div>
                    )}
                </div>

                {/* --- EMERGENCY ADMS --- */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-xl">
                            <FiWifi />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Emergency ADMs</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Alternative Delivery Modes</p>
                        </div>
                    </div>

                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                        <input type="checkbox" name="adm_mdl" checked={adms.adm_mdl} onChange={handleAdmCheck} disabled={isLocked || viewOnly} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm font-bold text-slate-700">Modular Distance Learning (MDL)</span>
                    </label>
                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                        <input type="checkbox" name="adm_odl" checked={adms.adm_odl} onChange={handleAdmCheck} disabled={isLocked || viewOnly} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm font-bold text-slate-700">Online Distance Learning (ODL)</span>
                    </label>
                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                        <input type="checkbox" name="adm_tvi" checked={adms.adm_tvi} onChange={handleAdmCheck} disabled={isLocked || viewOnly} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm font-bold text-slate-700">TV-Based Instruction (TVI/RBI)</span>
                    </label>
                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                        <input type="checkbox" name="adm_blended" checked={adms.adm_blended} onChange={handleAdmCheck} disabled={isLocked || viewOnly} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm font-bold text-slate-700">Blended Learning</span>
                    </label>
                    <div className="mt-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Others (Please Specify)</label>
                        <input type="text" value={adms.adm_others} onChange={handleAdmText} disabled={isLocked || viewOnly} className="w-full p-4 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="e.g. Homeschooling" />
                    </div>
                </div>
            </div>

            {/* --- STANDARDIZED FOOTER (Unlock to Edit) --- */}
            <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-50">
                <div className="max-w-4xl mx-auto flex gap-3">
                    {viewOnly ? (
                        <button onClick={() => navigate(-1)} className="w-full py-4 rounded-2xl bg-[#004A99] text-white font-bold shadow-lg">
                            Back to List
                        </button>
                    ) : isLocked ? (
                        <button
                            onClick={() => setIsLocked(false)}
                            className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                        >
                            🔓 Unlock to Edit Data
                        </button>
                    ) : (
                        <>
                            <button onClick={() => { setIsLocked(true); setShifts(originalData?.shifts || shifts); setModes(originalData?.modes || modes); setAdms(originalData?.adms || adms); }} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 font-bold">
                                Cancel
                            </button>
                            <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] py-4 rounded-2xl bg-[#004A99] text-white font-bold shadow-lg">
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* --- MODALS --- */}
            {
                showEditModal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4 text-amber-500 text-2xl">
                                <FiAlertCircle />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">Edit Modalities?</h3>
                            <p className="text-sm text-slate-500 mt-2 mb-6">You are to update shifting schedules. Proceed carefully.</p>
                            <div className="flex gap-2">
                                <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancel</button>
                                <button onClick={handleConfirmEdit} className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold shadow-sm hover:bg-amber-600">Unlock</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showSaveModal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-blue-600 text-2xl">
                                <FiCheckCircle />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">{hasSavedData ? "Confirm Update?" : "Confirm Save?"}</h3>
                            <p className="text-sm text-slate-500 mt-2 mb-6">Are you sure you want to save these modality settings?</p>
                            <div className="flex gap-2">
                                <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancel</button>
                                <button onClick={confirmSave} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800">Confirm</button>
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
                        <p className="text-sm text-slate-500 mt-2 mb-6 text-center">This form is answering the question: <b>'What is the shifting schedule and learning delivery mode adopted by each grade level?'</b></p>
                        <button onClick={() => setShowInfoModal(false)} className="w-full py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition-transform active:scale-95">Got it</button>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message={hasSavedData ? 'Settings Updated!' : 'Settings Saved!'} />
        </div >
    );
};

export default ShiftingModalities;