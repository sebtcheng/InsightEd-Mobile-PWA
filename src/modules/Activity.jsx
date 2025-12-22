import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition'; 

const Activity = () => {
    const [activities, setActivities] = useState([]); 
    const [loading, setLoading] = useState(true);

    // --- Fetch Activities ---
    useEffect(() => {
        const fetchActivities = async () => {
            try {
                // Ensure this matches your backend endpoint
                const response = await fetch('http://localhost:3000/api/activities');
                if (response.ok) {
                    const data = await response.json();
                    setActivities(data);
                } else {
                    console.error("Server Error:", response.status);
                }
            } catch (error) {
                console.error("Fetch Error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchActivities();
    }, []);

    // Helper to color-code the action types
    const getActionColor = (type) => {
        switch (type) {
            case 'CREATE': return 'bg-green-100 text-green-700 border-green-200';
            case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 font-sans pb-24 relative">
                
                {/* HEADER */}
                <div className="bg-white px-6 pt-12 pb-6 rounded-b-[2rem] shadow-sm relative z-10">
                    <h1 className="text-2xl font-bold text-slate-800">Activity Logs</h1>
                    <p className="text-xs text-slate-400 mt-1">Real-time updates across the system</p>
                </div>

                {/* TIMELINE LIST */}
                {loading ? (
                    <div className="p-10 text-center text-slate-400 text-sm">Loading activities...</div>
                ) : (
                    <div className="px-5 mt-6 space-y-4">
                        {activities.length === 0 ? (
                            <p className="text-center text-slate-400 text-xs italic">No recent activities found.</p>
                        ) : (
                            activities.map((log) => (
                                <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start">
                                    {/* Date Column */}
                                    <div className="flex flex-col items-center min-w-[65px] border-r border-slate-100 pr-3 pt-1">
                                        <span className="text-[10px] font-bold text-slate-700">
                                            {log.formatted_time?.split(',')[0]}
                                        </span>
                                        <span className="text-[9px] text-slate-400">
                                            {log.formatted_time?.split(',')[1]}
                                        </span>
                                    </div>
                                    
                                    {/* Content Column */}
                                    <div className="flex-1 ml-3">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getActionColor(log.action_type)}`}>
                                                {log.action_type}
                                            </span>
                                            <span className="text-[9px] text-slate-400">👤 {log.user_name}</span>
                                        </div>
                                        <h3 className="text-xs font-bold text-slate-700">{log.target_entity}</h3>
                                        <p className="text-[10px] text-slate-500 mt-0.5">{log.details}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* --- BOTTOM NAV BAR --- */}
                {/* Hardcoded to "Admin" so it shows the flat layout (Home, Activity, Accounts, Settings) */}
                <BottomNav userRole="Admin" />
            </div>
        </PageTransition>
    );
};

export default Activity;