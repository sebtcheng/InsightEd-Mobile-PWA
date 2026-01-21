
import React, { useState, useEffect } from 'react';
import { FiSave, FiUsers, FiAlertCircle, FiArrowLeft, FiGrid } from 'react-icons/fi';
import { TbActivity } from 'react-icons/tb';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { addToOutbox } from '../db';

const LearnerStatistics = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);

    // Core Form Data + JSONB Grids
    const [formData, setFormData] = useState({
        schoolId: '',
        learner_stats_grids: {} // Stores { sned: { k:0, g1:0... }, ip: {...} }
        // learner_stats_grids: {} // Stores { sned: { k:0, g1:0... }, ip: {...} } - REMOVED
    });

    // --- HELPERS ---
    const getGrades = () => ['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];

    const getGridValue = (category, grade) => {
        // Map category aliases to DB prefixes if needed, but we standardized on stat_[cat]_[grade]
        // except for some inconsistencies? 
        // My migration used: stat_sned, stat_disability, stat_als, stat_muslim, etc.
        // So the pattern is `stat_${category}_${grade}`.
        const key = `stat_${category}_${grade}`;
        return formData[key] || 0;
    };

    const handleGridChange = (category, grade, value) => {
        const key = `stat_${category}_${grade}`;
        setFormData(prev => ({
            ...prev,
            [key]: parseInt(value) || 0
        }));
    };

    const calculateTotals = (category) => {
        const grades = getGrades();
        const sum = (gradeList) => gradeList.reduce((acc, g) => acc + (getGridValue(category, g) || 0), 0);
        return {
            es: sum(['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6']),
            jhs: sum(['g7', 'g8', 'g9', 'g10']),
            shs: sum(['g11', 'g12']),
            total: sum(grades)
        };
    };

    const GridSection = ({ label, category, icon, color }) => {
        const totals = calculateTotals(category);
        const grades = getGrades();

        const offering = formData.curricular_offering?.toLowerCase() || '';
        const showElem = offering.includes('elementary') || offering.includes('integrated') || !offering;
        const showJhs = offering.includes('secondary') || offering.includes('integrated') || offering.includes('jhs') || !offering;
        const showShs = offering.includes('secondary') || offering.includes('integrated') || offering.includes('shs') || !offering;

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
                        const offering = formData.curricular_offering?.toLowerCase() || '';
                        const isElem = ['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'].includes(g) && (offering.includes('elementary') || offering.includes('integrated'));
                        const isJhs = ['g7', 'g8', 'g9', 'g10'].includes(g) && (offering.includes('secondary') || offering.includes('integrated') || offering.includes('jhs'));
                        const isShs = ['g11', 'g12'].includes(g) && (offering.includes('secondary') || offering.includes('integrated') || offering.includes('shs'));

                        const shouldShow = isElem || isJhs || isShs || !offering;
                        if (!shouldShow) return null;

                        return (
                            <div key={g} className="text-center group">
                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block group-hover:text-blue-500 transition-colors">{g === 'k' ? 'Kinder' : g.toUpperCase()}</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={getGridValue(category, g)}
                                    onChange={(e) => handleGridChange(category, g, e.target.value)}
                                    disabled={isLocked}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full h-12 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all hover:border-blue-200"
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    useEffect(() => {
        const fetchData = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                const res = await fetch(`/api/learner-statistics/${user.uid}`);
                const result = await res.json();
                if (result.exists) {
                    setFormData(prev => ({
                        ...prev,
                        ...result.data,
                        learner_stats_grids: result.data.learner_stats_grids || {} // Ensure grid object exists
                    }));
                    setIsLocked(true);
                }
            } catch (err) {
                console.error("Fetch Error:", err);
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
            uid: user.uid,
            userName: user.displayName || 'School Head',
            role: 'School Head'
        };

        // Recalculate totals for consistency (optional but safe)
        const cats = ['sned', 'disability', 'als', 'muslim', 'ip', 'displaced', 'repetition', 'overage', 'dropout'];
        cats.forEach(cat => {
            const totals = calculateTotals(cat);
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
                // For others, set the specific new columns
                payload[`stat_${cat}_es`] = totals.es;
                payload[`stat_${cat}_jhs`] = totals.jhs;
                payload[`stat_${cat}_shs`] = totals.shs;

                if (cat === 'dropout') payload.stat_dropout_prev_sy = totals.total;
                else payload[`stat_${cat}`] = totals.total;
            }
        });

        try {
            const res = await fetch('/api/save-learner-statistics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert('Statistics saved successfully!');
                setIsLocked(true);
            } else {
                throw new Error("Server error");
            }
        } catch (err) {
            console.warn("Saving to outbox...");
            await addToOutbox('Learner Statistics', payload);
            alert('Offline: Saved to Outbox');
            setIsLocked(true);
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
        <div className="min-h-screen bg-slate-50 pb-32 font-sans">
            {/* --- PREMIUM BLUE HEADER --- */}
            <div className="bg-[#004A99] px-6 pt-10 pb-20 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />

                <div className="relative z-10 flex items-center gap-4">
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
                        <p className="text-blue-100 text-xs font-medium mt-1">Detailed Demographics & Breakdown</p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-10 relative z-20 space-y-5">

                {/* --- SPECIAL PROGRAMS --- */}
                <GridSection label="SNEd (Special Needs)" category="sned" icon={<TbActivity />} color="text-purple-600" />
                <GridSection label="Learners with Disability" category="disability" icon={<TbActivity />} color="text-amber-600" />
                <GridSection label="ALS Learners" category="als" icon={<TbActivity />} color="text-green-600" />

                {/* --- MUSLIM LEARNERS --- */}
                {/* Note: category 'muslim' is new to grid, logic maps to existing fields in backend OR we migrate fully.
                    Current plan uses the new 'learner_stats_grids' JSON for ALL new grids.
                    The OLD 'stat_muslim_' fields are technically separate.
                    To keep it unified in UI, I'm using 'grid' logic.
                    But the backend saves 'learner_stats_grids'.
                    Wait, if I use 'muslim' here, it saves to JSON.
                    The OLD columns 'stat_muslim_k' etc will be ignored/empty unless I map them.
                    For now, I will use JSON for everything for simplicity as per new plan.
                */}
                <GridSection label="Muslim Learners" category="muslim" icon={<FiUsers />} color="text-emerald-600" />

                {/* --- GROUPS --- */}
                <GridSection label="Indigenous People (IP)" category="ip" icon={<FiUsers />} color="text-blue-600" />
                <GridSection label="Displaced Learners" category="displaced" icon={<FiUsers />} color="text-rose-600" />

                {/* --- STATUS --- */}
                <GridSection label="Repetition" category="repetition" icon={<FiGrid />} color="text-orange-600" />
                <GridSection label="Overage" category="overage" icon={<FiGrid />} color="text-orange-600" />
                <GridSection label="Dropouts (Prev SY)" category="dropout" icon={<FiGrid />} color="text-red-600" />

            </div>

            {/* --- FLOATING ACTION BAR --- */}
            <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-50">
                <div className="max-w-4xl mx-auto flex gap-3">
                    {isLocked ? (
                        <button
                            onClick={() => setIsLocked(false)}
                            className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                        >
                            <TbActivity /> Edit Statistics
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
        </div>
    );
};

export default LearnerStatistics;
