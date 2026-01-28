import React, { useState, useEffect } from 'react';
import { FiSave, FiUsers, FiArrowLeft, FiGrid, FiHelpCircle, FiInfo } from 'react-icons/fi';
import { TbActivity } from 'react-icons/tb';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { addToOutbox, getOutbox } from '../db';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';

// --- HELPERS (Moved Outside) ---
const getGrades = () => ['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];

// --- SUB-COMPONENT (Moved Outside to prevent re-renders) ---
const GridSection = ({ label, category, icon, color, formData, onGridChange, isLocked }) => {
    const grades = getGrades();

    // Helper to get value specifically for this component instance
    const getGridValue = (cat, grade) => {
        const key = `stat_${cat}_${grade}`;
        return formData[key] || 0;
    };

    // Calculate totals locally based on the passed formData
    const calculateTotals = () => {
        const sum = (gradeList) => gradeList.reduce((acc, g) => acc + (getGridValue(category, g) || 0), 0);
        return {
            es: sum(['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6']),
            jhs: sum(['g7', 'g8', 'g9', 'g10']),
            shs: sum(['g11', 'g12']),
            total: sum(grades)
        };
    };

    const totals = calculateTotals();

    const offering = formData.curricular_offering?.toLowerCase() || '';
    const showElem = offering.includes('elementary') || offering.includes('integrated') || offering.includes('k-12') || offering.includes('k-10') || !offering;
    const showJhs = offering.includes('junior') || offering.includes('secondary') || offering.includes('integrated') || offering.includes('k-12') || offering.includes('k-10') || !offering;
    const showShs = offering.includes('senior') || offering.includes('secondary') || offering.includes('integrated') || offering.includes('k-12') || !offering;

    return (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-50">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${color} bg-opacity-10 flex items-center justify-center text-xl`}>
                        {icon}
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800">{label}</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Per Grade Level</p>
                    </div>
                </div>
                {/* Read-only Totals Badge */}
                <div className="flex flex-wrap gap-2">
                    {showElem && (
                        <div className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-center min-w-[60px]">
                            <span className="block text-[9px] text-slate-400 font-bold uppercase">ES Total</span>
                            <span className="text-sm font-black text-slate-700">{totals.es}</span>
                        </div>
                    )}
                    {showJhs && (
                        <div className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-center min-w-[60px]">
                            <span className="block text-[9px] text-slate-400 font-bold uppercase">JHS Total</span>
                            <span className="text-sm font-black text-slate-700">{totals.jhs}</span>
                        </div>
                    )}
                    {showShs && (
                        <div className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-center min-w-[60px]">
                            <span className="block text-[9px] text-slate-400 font-bold uppercase">SHS Total</span>
                            <span className="text-sm font-black text-slate-700">{totals.shs}</span>
                        </div>
                    )}
                    <div className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-100 text-center min-w-[70px]">
                        <span className="block text-[9px] text-blue-400 font-bold uppercase">Grand Total</span>
                        <span className="text-sm font-black text-blue-700">{totals.total}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-3">
                {grades.map((g) => {
                    const isElem = ['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'].includes(g) && (offering.includes('elementary') || offering.includes('integrated') || offering.includes('k-12') || offering.includes('k-10'));
                    const isJhs = ['g7', 'g8', 'g9', 'g10'].includes(g) && (offering.includes('junior') || offering.includes('secondary') || offering.includes('integrated') || offering.includes('k-12') || offering.includes('k-10'));
                    const isShs = ['g11', 'g12'].includes(g) && (offering.includes('senior') || offering.includes('secondary') || offering.includes('integrated') || offering.includes('k-12'));

                    const shouldShow = isElem || isJhs || isShs || !offering;
                    if (!shouldShow) return null;

                    return (
                        <div key={g} className="text-center group">
                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block group-hover:text-blue-500 transition-colors">{g === 'k' ? 'Kinder' : g.toUpperCase()}</label>
                            <p className="text-[9px] text-slate-400 font-medium mb-1.5 block">Total (All Sections)</p>
                            <input
                                type="text" inputMode="numeric" pattern="[0-9]*"
                                value={getGridValue(category, g)}
                                onChange={(e) => onGridChange(category, g, e.target.value)}
                                disabled={isLocked}
                                className="w-full h-12 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm hover:border-blue-200"
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const LearnerStatistics = () => {
    const navigate = useNavigate();
    // Use location to determine viewOnly mode
    const location = window.location;
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const monitorSchoolId = queryParams.get('schoolId');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);

    // Core Form Data + JSONB Grids
    const [formData, setFormData] = useState({
        schoolId: '',
        curricular_offering: localStorage.getItem('schoolOffering') || '',
        learner_stats_grids: {}
    });

    const handleGridChange = (category, grade, value) => {
        const key = `stat_${category}_${grade}`;
        // Limit to 3 digits
        const cleanValue = value.replace(/[^0-9]/g, '').slice(0, 3);
        const intValue = cleanValue === '' ? 0 : parseInt(cleanValue, 10);

        setFormData(prev => ({
            ...prev,
            [key]: intValue
        }));
    };

    // Need a way to calculate totals for the SAVE payload
    // We can reuse the same logic or just sum it up during save
    // Unified helper to get value from flat formData
    const getGridValueForSave = (data, category, grade) => {
        const key = `stat_${category}_${grade}`;
        // during save, 'data' is the flat formData
        return data[key] || 0;
    };

    const calculateTotalsForSave = (data, category) => {
        // Reuse getGrades from outside scope
        const grades = getGrades();
        const sum = (gradeList) => gradeList.reduce((acc, g) => acc + (getGridValueForSave(data, category, g) || 0), 0);
        return {
            es: sum(['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6']),
            jhs: sum(['g7', 'g8', 'g9', 'g10']),
            shs: sum(['g11', 'g12']),
            total: sum(grades)
        };
    };

    useEffect(() => {
        const fetchData = async () => {
            const user = auth.currentUser;
            if (!user) return;

            const storedSchoolId = localStorage.getItem('schoolId');
            const storedOffering = localStorage.getItem('schoolOffering');

            // STEP 1: LOCK - IMMEDIATE LOAD
            if (storedOffering) {
                // We don't have a direct setter for just offering unless we update formData
                // LearnerStatistics uses formData.curricular_offering usually.
                setFormData(prev => ({ ...prev, curricular_offering: storedOffering }));
            }

            // SWR: Load Cached Data Immediately
            const CACHE_KEY = `CACHE_LEARNER_STATS_${user.uid}`;
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (cachedData) {
                try {
                    const parsed = JSON.parse(cachedData);
                    // Restore complex state
                    // We need to carefully restore formData structure if it's flat
                    // LearnerStatistics saves formData which includes grids usually?
                    // Previous caching code (not visible) likely saves the whole 'formData' object
                    // Check logic: setFormData(parsed);
                    setFormData(prev => ({ ...prev, ...parsed }));

                    const hasCachedData = Object.entries(parsed).some(([k, v]) => k.startsWith('stat_') && Number(v) > 0);
                    setIsLocked(hasCachedData);
                    setLoading(false); // CRITICAL: Instant Load
                    console.log("Loaded cached Learner Stats data (Instant Load)");
                } catch (e) { console.error("Cache parse error", e); }
            }

            try {
                // 1. CHECK OUTBOX FIRST (Inverted Logic)
                let restored = false;
                try {
                    const drafts = await getOutbox();
                    // Try to match by SchoolID if possible. If not, maybe just match by type if user only has one school?
                    // Typically School Head has one school.
                    const targetId = storedSchoolId || (user.uid ? undefined : undefined); // Weak match if no ID, but better than nothing

                    const draft = drafts.find(d => d.type === 'LEARNER_STATISTICS' && (targetId ? d.payload.schoolId === targetId : true));

                    if (draft) {
                        console.log("Restored draft from Outbox (Instant Load)");
                        setFormData(prev => ({ ...prev, ...draft.payload }));

                        // CRITICAL: Lock Offering from Draft
                        if (draft.payload.curricular_offering) {
                            localStorage.setItem('schoolOffering', draft.payload.curricular_offering);
                        }

                        setIsLocked(false);
                        restored = true;
                        setLoading(false);
                        return; // EXIT EARLY
                    }
                } catch (e) {
                    console.error("Outbox check failed:", e);
                }

                // 2. FETCH FROM API (If not restored)
                if (!restored) {
                    const res = await fetch(`/api/learner-statistics/${user.uid}`);
                    const result = await res.json();
                    if (result.exists) {
                        const fallbackOffering = result.data.curricular_offering || storedOffering || '';

                        // CRITICAL: Save Offering to localStorage
                        // Assuming result.data.school_id is available
                        const targetSchoolId = result.data.school_id || result.data.schoolId || storedSchoolId;
                        if (!viewOnly && targetSchoolId) {
                            localStorage.setItem('schoolId', targetSchoolId);
                            localStorage.setItem('schoolOffering', result.data.curricular_offering || '');
                        }

                        // Flatten the grids into formData
                        const flattenedGrids = {};
                        if (result.data.learner_stats_grids) {
                            Object.entries(result.data.learner_stats_grids).forEach(([key, val]) => {
                                flattenedGrids[key] = val;
                            });
                        }

                        // Also flatten any existing stat_ keys from root data
                        const categories = ['sned', 'disability', 'als', 'muslim', 'ip', 'displaced', 'repetition', 'overage', 'dropout'];
                        const grades = getGrades();
                        categories.forEach(cat => {
                            grades.forEach(g => {
                                const key = `stat_${cat}_${g}`;
                                if (result.data[key] !== undefined) {
                                    flattenedGrids[key] = result.data[key];
                                }
                            });
                        });

                        const loadedData = {
                            ...result.data,
                            ...flattenedGrids,
                            curricular_offering: fallbackOffering,
                            learner_stats_grids: result.data.learner_stats_grids || {}
                        };

                        setFormData(prev => ({ ...prev, ...loadedData }));
                        const hasLoadedData = Object.entries(loadedData).some(([k, v]) => k.startsWith('stat_') && Number(v) > 0);
                        setIsLocked(hasLoadedData);

                        // CACHE DATA
                        const CACHE_KEY = `CACHE_LEARNER_STATS_${user.uid}`;
                        localStorage.setItem(CACHE_KEY, JSON.stringify(result.data));
                    }
                }
            } catch (err) {
                console.error("Fetch Error:", err);

                // OFFLINE CACHE RECOVERY
                const CACHE_KEY = `CACHE_LEARNER_STATS_${user.uid}`;
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    console.log("Loaded cached data for Learner Stats (Offline Mode)");
                    const dbData = JSON.parse(cached);
                    const fallbackOffering = dbData.curricular_offering || localStorage.getItem('schoolOffering') || '';

                    // Re-apply flattening logic
                    const flattenedGrids = {};
                    if (dbData.learner_stats_grids) {
                        Object.entries(dbData.learner_stats_grids).forEach(([key, val]) => { flattenedGrids[key] = val; });
                    }
                    const categories = ['sned', 'disability', 'als', 'muslim', 'ip', 'displaced', 'repetition', 'overage', 'dropout'];
                    const grades = getGrades();
                    categories.forEach(cat => {
                        grades.forEach(g => {
                            const key = `stat_${cat}_${g}`;
                            if (dbData[key] !== undefined) flattenedGrids[key] = dbData[key];
                        });
                    });

                    setFormData(prev => ({
                        ...prev,
                        ...dbData,
                        ...flattenedGrids,
                        curricular_offering: fallbackOffering,
                        learner_stats_grids: dbData.learner_stats_grids || {}
                    }));
                    const hasOfflineData = Object.entries(dbData).some(([k, v]) => k.startsWith('stat_') && Number(v) > 0);
                    setIsLocked(hasOfflineData); // Read-Only if data exists
                } else if (storedOffering) {
                    setFormData(prev => ({ ...prev, curricular_offering: storedOffering }));
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSave = async () => {
        const user = auth.currentUser;
        if (!user) return;

        setSaving(true);

        const payload = {
            ...formData,
            schoolId: formData.schoolId || formData.school_id || localStorage.getItem('schoolId'),
            uid: user.uid,
            userName: user.displayName || 'School Head',
            role: 'School Head',
            submitted_at: new Date().toISOString(),
            // IMPORTANT: Also update the nested object for JSONB persistence
            learner_stats_grids: {}
        };

        // Re-construct the grid object from the flat formData
        // FIX: Ensure this is DENSE (contains all keys) even if formData is sparse (because offline)
        // This mitigates backend issues where missing keys might be treated as null or result in data loss.
        const allGrades = getGrades();
        const allCats = ['sned', 'disability', 'als', 'muslim', 'ip', 'displaced', 'repetition', 'overage', 'dropout'];

        allCats.forEach(cat => {
            allGrades.forEach(g => {
                const key = `stat_${cat}_${g}`;
                // Use the value from formData if present (user edited), otherwise 0
                payload.learner_stats_grids[key] = formData[key] || 0;
            });
        });

        const cats = ['sned', 'disability', 'als', 'muslim', 'ip', 'displaced', 'repetition', 'overage', 'dropout'];

        cats.forEach(cat => {
            // Pass formData to calculation since it's now outside scope of GridSection
            const totals = calculateTotalsForSave(formData, cat);

            if (cat === 'sned') {
                payload.stat_sned_es = totals.es;
                payload.stat_sned_jhs = totals.jhs;
                payload.stat_sned_shs = totals.shs;
            } else if (cat === 'disability') {
                payload.stat_disability_es = totals.es;
                payload.stat_disability_jhs = totals.jhs;
                payload.stat_disability_shs = totals.shs;
            } else if (cat === 'als') {
                payload.stat_als_es = totals.es;
                payload.stat_als_jhs = totals.jhs;
                payload.stat_als_shs = totals.shs;
            } else if (cat !== 'muslim') {
                payload[`stat_${cat}_es`] = totals.es;
                payload[`stat_${cat}_jhs`] = totals.jhs;
                payload[`stat_${cat}_shs`] = totals.shs;

                if (cat === 'dropout') payload.stat_dropout_prev_sy = totals.total;
                else payload[`stat_${cat}`] = totals.total;
            }
        });

        // 1. EXPLICIT OFFLINE CHECK (Matches Enrolment.jsx)
        if (!navigator.onLine) {
            try {
                console.log("Offline mode detected. Saving to Outbox...", payload);
                await addToOutbox({
                    type: 'LEARNER_STATISTICS',
                    label: 'Learner Statistics',
                    url: '/api/save-learner-statistics',
                    payload: payload
                });
                setShowOfflineModal(true);
                setIsLocked(true);
            } catch (err) {
                console.error("Offline Save Error:", err);
                alert("Failed to save to Outbox. Please try again or check your storage.");
            } finally {
                setSaving(false);
            }
            return;
        }

        // 2. ONLINE SAVE
        try {
            const res = await fetch('/api/save-learner-statistics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setShowSuccessModal(true);
                setIsLocked(true);
            } else {
                throw new Error("Server error");
            }
        } catch (err) {
            console.warn("Network request failed, falling back to Outbox...", err);
            try {
                await addToOutbox({
                    type: 'LEARNER_STATISTICS',
                    label: 'Learner Statistics',
                    url: '/api/save-learner-statistics',
                    payload: payload
                });
                setShowOfflineModal(true);
                setIsLocked(true);
            } catch (outboxErr) {
                console.error("Outbox Fallback Failed:", outboxErr);
                alert("Failed to save online AND failed to save to Outbox.");
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen grid place-items-center bg-slate-50">
            <div className="w-10 h-10 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
        </div>
    );

    return (
        <div className="min-h-[100dvh] bg-slate-50 pb-32 font-sans">
            {/* --- PREMIUM BLUE HEADER --- */}
            <div className="bg-[#004A99] px-6 pt-10 pb-20 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                            <FiArrowLeft size={24} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-white tracking-tight">Learner Statistics</h1>
                                {formData.curricular_offering && (
                                    <span className="px-2 py-0.5 rounded-lg bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/10">
                                        {formData.curricular_offering}
                                    </span>
                                )}
                            </div>
                            <p className="text-blue-100 text-xs font-medium mt-1">Q: What is the breakdown of learners by specific programs (IP, Muslim, etc.) and categories per grade level?</p>
                        </div>
                    </div>
                    <button onClick={() => setShowInfoModal(true)} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                        <FiHelpCircle size={24} />
                    </button>
                </div>
            </div>

            <div className="px-5 -mt-10 relative z-20 space-y-5">
                {/* --- SPECIAL PROGRAMS --- */}
                <GridSection
                    label="SNEd (Special Needs)"
                    category="sned"
                    icon={<TbActivity />}
                    color="text-purple-600"
                    formData={formData}
                    onGridChange={handleGridChange}
                    isLocked={isLocked}
                />
                <GridSection
                    label="Learners with Disability"
                    category="disability"
                    icon={<TbActivity />}
                    color="text-amber-600"
                    formData={formData}
                    onGridChange={handleGridChange}
                    isLocked={isLocked}
                />
                <GridSection
                    label="ALS Learners"
                    category="als"
                    icon={<TbActivity />}
                    color="text-green-600"
                    formData={formData}
                    onGridChange={handleGridChange}
                    isLocked={isLocked}
                />

                {/* --- MUSLIM LEARNERS --- */}
                <GridSection
                    label="Muslim Learners"
                    category="muslim"
                    icon={<FiUsers />}
                    color="text-emerald-600"
                    formData={formData}
                    onGridChange={handleGridChange}
                    isLocked={isLocked}
                />

                {/* --- GROUPS --- */}
                <GridSection
                    label="Indigenous People (IP)"
                    category="ip"
                    icon={<FiUsers />}
                    color="text-blue-600"
                    formData={formData}
                    onGridChange={handleGridChange}
                    isLocked={isLocked}
                />
                <GridSection
                    label="Displaced Learners"
                    category="displaced"
                    icon={<FiUsers />}
                    color="text-rose-600"
                    formData={formData}
                    onGridChange={handleGridChange}
                    isLocked={isLocked}
                />

                {/* --- STATUS --- */}
                <GridSection
                    label="Repetition"
                    category="repetition"
                    icon={<FiGrid />}
                    color="text-orange-600"
                    formData={formData}
                    onGridChange={handleGridChange}
                    isLocked={isLocked}
                />
                <GridSection
                    label="Overage"
                    category="overage"
                    icon={<FiGrid />}
                    color="text-orange-600"
                    formData={formData}
                    onGridChange={handleGridChange}
                    isLocked={isLocked}
                />
                <GridSection
                    label="Dropouts (Prev SY)"
                    category="dropout"
                    icon={<FiGrid />}
                    color="text-red-600"
                    formData={formData}
                    onGridChange={handleGridChange}
                    isLocked={isLocked}
                />
            </div>

            {/* --- FLOATING ACTION BAR --- */}
            <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-50">
                <div className="max-w-4xl mx-auto flex gap-3">
                    {isLocked ? (
                        <button
                            onClick={() => setIsLocked(false)}
                            className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                        >
                            <TbActivity /> 🔓 Unlock to Edit Data
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full py-4 rounded-2xl bg-[#004A99] text-white font-bold shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                        >
                            {saving ? 'Saving...' : <><FiSave /> Save Statistics</>}
                        </button>
                    )}
                </div>
            </div>

            {showInfoModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-blue-600 text-2xl">
                            <FiInfo />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 text-center">Form Guide</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6 text-center">This form is answering the question: <b>'What is the breakdown of learners by specific programs (IP, Muslim, etc.) and categories per grade level?'</b></p>
                        <button onClick={() => setShowInfoModal(false)} className="w-full py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition-transform active:scale-95">Got it</button>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="Statistic saved successfully!" />
        </div>
    );
};

export default LearnerStatistics;