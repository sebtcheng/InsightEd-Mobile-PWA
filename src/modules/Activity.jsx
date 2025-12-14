import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase'; 
import { doc, getDoc } from 'firebase/firestore';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition'; 

const Activity = () => {
    const [homeRoute, setHomeRoute] = useState('/');
    const [activities, setActivities] = useState([]); 
    const [loading, setLoading] = useState(true);

    // 1. Fetch User Role
    useEffect(() => {
        const fetchUserRole = async () => {
            const user = auth.currentUser;
            if (user) {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setHomeRoute(getDashboardPath(docSnap.data().role));
                }
            }
        };
        fetchUserRole();
    }, []);

    // 2. Fetch Activities (This matches the new backend route)
    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const response = await fetch('http://localhost:3000/api/activities');
                if (response.ok) {
                    const data = await response.json();
                    setActivities(data);
                } else {
                    console.error("Server Error:", response.status);
                }
            } catch (error) {
                console.error("Network Error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchActivities();
    }, []);

    const getDashboardPath = (role) => {
        const roleMap = { 'Engineer': '/engineer-dashboard', 'School Head': '/schoolhead-dashboard', 'Human Resource': '/hr-dashboard', 'Admin': '/admin-dashboard' };
        return roleMap[role] || '/';
    };

    const getActionColor = (type) => {
        if (type === 'CREATE') return 'bg-emerald-100 text-emerald-600 border-emerald-200';
        if (type === 'UPDATE') return 'bg-blue-100 text-blue-600 border-blue-200';
        return 'bg-gray-100 text-gray-600 border-gray-200';
    };

    return (
        <PageTransition>
            <div style={{ padding: '20px', paddingBottom: '80px', minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[#004A99] rounded-full flex items-center justify-center text-white text-lg">📊</div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Audit Trail</h1>
                        <p className="text-xs text-slate-500">System modifications history</p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-gray-400 text-xs">Loading history...</div>
                ) : (
                    <div className="space-y-3">
                        {activities.length === 0 ? (
                            <div className="text-center text-gray-400 py-10 bg-white rounded-xl border border-dashed">No activities yet.</div>
                        ) : (
                            activities.map((log) => (
                                <div key={log.log_id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex gap-3 items-start">
                                    <div className="flex flex-col items-center min-w-[65px] border-r border-slate-100 pr-3 pt-1">
                                        <span className="text-[10px] font-bold text-slate-700">{log.formatted_time?.split(',')[0]}</span>
                                        <span className="text-[9px] text-slate-400">{log.formatted_time?.split(',')[1]}</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getActionColor(log.action_type)}`}>{log.action_type}</span>
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
                <BottomNav homeRoute={homeRoute} />
            </div>
        </PageTransition>
    );
};

export default Activity;