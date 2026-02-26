import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiXCircle, FiActivity } from 'react-icons/fi';

const DataHealthDashboard = ({ schoolId }) => {
    const [healthData, setHealthData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchHealthScore = async () => {
            if (!schoolId) return;
            setLoading(true);
            try {
                const response = await fetch(`/api/schools/${schoolId}/health-score`);
                if (!response.ok) {
                    throw new Error('Failed to fetch data health score');
                }
                const data = await response.json();
                setHealthData(data);
            } catch (err) {
                console.error("Error fetching health score:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchHealthScore();
    }, [schoolId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-64 text-red-500">
                <p>Error: {error}</p>
            </div>
        );
    }

    if (!healthData) return null;

    const { score, checklist, totalModules, completedCount } = healthData;

    // Determine color based on score
    let scoreColorClass = "text-red-500";
    let scoreBgClass = "bg-red-50 dark:bg-red-900/20";
    if (score === 100) {
        scoreColorClass = "text-emerald-500";
        scoreBgClass = "bg-emerald-50 dark:bg-emerald-900/20";
    } else if (score >= 50) {
        scoreColorClass = "text-amber-500";
        scoreBgClass = "bg-amber-50 dark:bg-amber-900/20";
    }

    return (
        <div className="p-6 lg:p-10 animate-fade-in custom-scrollbar overflow-y-auto w-full h-full max-h-[85vh]">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Score Section */}
                <div className="w-full md:w-1/3 flex flex-col items-center justify-center p-8 rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                    <div className={`p-4 rounded-full mb-4 ${scoreBgClass}`}>
                        <FiActivity className={scoreColorClass} size={32} />
                    </div>
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 text-center">
                        Overall Data Health
                    </h3>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-6xl font-black tracking-tighter ${scoreColorClass}`}>
                            {score}
                        </span>
                        <span className="text-3xl font-bold text-slate-400">%</span>
                    </div>
                    <p className="text-xs font-bold text-slate-500 mt-4 text-center">
                        {completedCount} of {totalModules} Modules Completed
                    </p>
                </div>

                {/* Checklist Section */}
                <div className="w-full md:w-2/3 flex flex-col bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                        Data Completion Checklist
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {checklist.map((item, index) => (
                            <div 
                                key={index} 
                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors
                                    ${item.status 
                                        ? 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-900/10' 
                                        : 'border-red-100 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10'
                                    }`}
                            >
                                <div className="shrink-0">
                                    {item.status ? (
                                        <FiCheckCircle className="text-emerald-500" size={20} />
                                    ) : (
                                        <FiXCircle className="text-red-400" size={20} />
                                    )}
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${item.status ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {item.module}
                                    </p>
                                    <p className="text-[10px] font-black uppercase tracking-wider mt-0.5">
                                        {item.status ? (
                                            <span className="text-emerald-600 dark:text-emerald-400">Completed</span>
                                        ) : (
                                            <span className="text-red-500 dark:text-red-400">Incomplete</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataHealthDashboard;
