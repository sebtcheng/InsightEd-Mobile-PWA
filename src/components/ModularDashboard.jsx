import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiUnlock, FiLock, FiStar, FiMap, FiArrowLeft, FiClock, FiActivity, FiCheckCircle } from "react-icons/fi";
import { FaFire } from "react-icons/fa"; // Added for streaks
import { motion, AnimatePresence } from "framer-motion";
import { getUnit1Draft } from "../db";
const ModularDashboard = () => {
    const navigate = useNavigate();
    const [hasDraft, setHasDraft] = useState(false);
    const [questProgress, setQuestProgress] = useState({ completedUnits: [], xp: 0 });

    useEffect(() => {
        const loadProgress = () => {
            const stored = localStorage.getItem('quest_progress');
            if (stored) {
                try {
                    setQuestProgress(JSON.parse(stored));
                } catch (err) {
                    console.error("Failed to parse quest progress", err);
                }
            }
        };
        loadProgress();

        const checkDraft = async () => {
            const draft = await getUnit1Draft('draft_unit_1');
            // Show resume state if draft exists and isn't finished
            if (draft && draft.step > 1 && draft.step <= 3) {
                setHasDraft(true);
            }
        }
        checkDraft();
    }, []);

    const handleBack = () => {
        // Navigate back to the main dashboard or previous page
        navigate(-1);
    };

    const handleUnitClick = (unitId, isLocked) => {
        if (isLocked) return;
        if (unitId === 1) {
            navigate("/modular/unit-1");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 flex flex-col relative overflow-hidden font-sans">

            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-96 bg-indigo-600/10 blur-[100px] rounded-full point-events-none" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full point-events-none" />

            {/* Sticky Header */}
            <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-indigo-500/20 px-4 py-3 sm:px-6 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleBack}
                        className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors text-slate-300 hover:text-white"
                        aria-label="Go back"
                    >
                        <FiArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                        Insight<span className="text-indigo-400">Ed</span> Quest
                    </h1>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    {/* Streak Indicator (Dummy UI for now) */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center bg-orange-500/20 px-3 py-1.5 rounded-2xl border border-orange-500/30"
                    >
                        <FaFire className="text-orange-500 w-4 h-4 mr-1.5 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                        <span className="text-sm font-bold text-orange-400 drop-shadow-md">3</span>
                    </motion.div>

                    {/* XP / Gem Indicator */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center bg-indigo-500/20 px-3 py-1.5 rounded-2xl border border-indigo-500/30"
                    >
                        <FiActivity className="text-indigo-400 w-4 h-4 mr-1.5 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                        <span className="text-sm font-bold text-indigo-300 drop-shadow-md">{questProgress.xp}</span>
                    </motion.div>
                </div>
            </header>

            {/* Main Map Container */}
            <main className="flex-1 w-full max-w-2xl mx-auto py-12 px-4 relative z-10 flex flex-col justify-end min-h-[800px] pb-32">

                {/* 
                  The structural container for the path. 
                  Render bottom-up, starting with Unit 1 at the bottom.
                */}
                <div className="relative flex flex-col items-center justify-end h-full gap-24 pt-20">

                    {/* ---- UNIT 4 (Locked) ---- */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="relative z-10 flex flex-col items-center group cursor-not-allowed self-start ml-4 sm:ml-16"
                    >
                        {/* Connecting Line to Unit 3 below */}
                        <div className="absolute top-1/2 left-1/2 w-[140px] h-[100px] border-l-8 border-t-8 border-slate-700/50 rounded-tl-[3rem] -z-10 -translate-x-1/2 -translate-y-[85%]" />

                        <div className="mb-2 text-center absolute -top-8 w-max">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Unit 4</h2>
                        </div>
                        <div className="w-[72px] h-[72px] rounded-full bg-slate-800 border-[6px] border-slate-700 flex items-center justify-center shadow-[inset_0_-4px_0_rgba(0,0,0,0.4)]">
                            <FiLock className="w-6 h-6 text-slate-500" />
                        </div>
                    </motion.div>

                    {/* ---- UNIT 3 (Locked) ---- */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="relative z-10 flex flex-col items-center group cursor-not-allowed self-end mr-4 sm:mr-16"
                    >
                        {/* Connecting Line to Unit 2 below */}
                        <div className="absolute top-1/2 right-1/2 w-[140px] h-[100px] border-r-8 border-t-8 border-slate-700/50 rounded-tr-[3rem] -z-10 translate-x-1/2 -translate-y-[85%]" />

                        <div className="mb-2 text-center absolute -top-8 w-max">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Unit 3</h2>
                        </div>
                        <div className="w-[72px] h-[72px] rounded-full bg-slate-800 border-[6px] border-slate-700 flex items-center justify-center shadow-[inset_0_-4px_0_rgba(0,0,0,0.4)]">
                            <FiLock className="w-6 h-6 text-slate-500" />
                        </div>
                    </motion.div>

                    {/* ---- UNIT 2 (Conditionally Unlocked) ---- */}
                    {questProgress.completedUnits.includes(1) ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: "spring", bounce: 0.5 }}
                            className="relative z-10 flex flex-col items-center group cursor-pointer self-start ml-4 sm:ml-16 mt-4"
                            onClick={() => handleUnitClick(2, false)}
                        >
                            {/* Connecting Line to Unit 1 below (Solid / Active) */}
                            <div className="absolute top-1/2 left-1/2 w-[140px] h-[120px] border-l-8 border-t-8 border-indigo-500 rounded-tl-[3rem] -z-10 -translate-x-1/2 -translate-y-[85%]" />

                            {/* Floating Active Tooltip */}
                            <div className="mb-3 text-center absolute -top-14 w-max bg-white text-slate-900 px-4 py-1.5 rounded-xl shadow-xl border-2 border-slate-200 z-20">
                                <h2 className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Unit 2</h2>
                                <p className="text-sm font-bold text-slate-700">The Learners</p>
                                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-slate-200" />
                                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" />
                            </div>

                            {/* Bouncing 3D Node */}
                            <motion.div
                                animate={{ y: [0, -6, 0] }}
                                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                                className="relative w-24 h-24 rounded-full bg-indigo-500 border-[6px] border-indigo-300 flex items-center justify-center shadow-[inset_0_-8px_0_rgba(0,0,0,0.2),_0_10px_20px_rgba(99,102,241,0.6)] group-hover:bg-indigo-400 group-hover:-translate-y-1 transition-all"
                            >
                                <FiStar className="w-10 h-10 text-white drop-shadow-md" />
                            </motion.div>

                            {/* Active Ring Indicator */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-[3px] border-indigo-400/50 rounded-full animate-ping pointer-events-none" />
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative z-10 flex flex-col items-center group cursor-not-allowed self-start ml-4 sm:ml-16"
                        >
                            {/* Connecting Line to Unit 1 below */}
                            <div className="absolute top-1/2 left-1/2 w-[140px] h-[100px] border-l-8 border-t-8 border-slate-700/50 rounded-tl-[3rem] -z-10 -translate-x-1/2 -translate-y-[85%]" />

                            <div className="mb-2 text-center absolute -top-8 w-max">
                                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Unit 2</h2>
                            </div>
                            <div className="w-[72px] h-[72px] rounded-full bg-slate-800 border-[6px] border-slate-700 flex items-center justify-center shadow-[inset_0_-4px_0_rgba(0,0,0,0.4)]">
                                <FiLock className="w-6 h-6 text-slate-500" />
                            </div>
                        </motion.div>
                    )}

                    {/* ---- UNIT 1 (Completed or Active) ---- */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative z-10 flex flex-col items-center group cursor-pointer self-center mt-12"
                        onClick={() => handleUnitClick(1, false)}
                    >
                        {/* Tooltip */}
                        <div className={`mb-3 text-center absolute -top-14 w-max bg-white px-4 py-1.5 rounded-xl shadow-xl z-20 ${questProgress.completedUnits.includes(1) ? 'border-2 border-emerald-200' : 'border-2 border-slate-200'}`}>
                            <h2 className={`text-[11px] font-black uppercase tracking-widest ${questProgress.completedUnits.includes(1) ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                Unit 1
                            </h2>
                            <p className="text-sm font-bold text-slate-700">
                                {questProgress.completedUnits.includes(1) ? "Completed 🌟" : hasDraft ? "Resume" : "School Identity"}
                            </p>
                            <div className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent ${questProgress.completedUnits.includes(1) ? 'border-t-emerald-200' : 'border-t-slate-200'}`} />
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" />
                        </div>

                        {questProgress.completedUnits.includes(1) ? (
                            <div className="w-24 h-24 rounded-full bg-emerald-500 border-[6px] border-emerald-300 flex items-center justify-center shadow-[inset_0_-8px_0_rgba(0,0,0,0.2),_0_10px_20px_rgba(16,185,129,0.5)] group-hover:-translate-y-1 transition-all">
                                <FiCheckCircle className="w-10 h-10 text-white drop-shadow-md" />
                            </div>
                        ) : (
                            <motion.div
                                animate={{ y: [0, -6, 0] }}
                                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                                className="w-24 h-24 rounded-full bg-indigo-500 border-[6px] border-indigo-300 flex items-center justify-center shadow-[inset_0_-8px_0_rgba(0,0,0,0.2),_0_10px_20px_rgba(99,102,241,0.6)] group-hover:bg-indigo-400 group-hover:-translate-y-1 transition-all"
                            >
                                {hasDraft ? <FiClock className="w-10 h-10 text-white drop-shadow-md" /> : <FiStar className="w-10 h-10 text-white drop-shadow-md" />}
                            </motion.div>
                        )}

                        {/* Active Ring Indicator if NOT completed */}
                        {!questProgress.completedUnits.includes(1) && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-[3px] border-indigo-400/50 rounded-full animate-ping pointer-events-none" />
                        )}
                    </motion.div>

                </div>
            </main>
        </div>
    );
};

export default ModularDashboard;
