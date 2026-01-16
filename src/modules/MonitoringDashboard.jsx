import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiTrendingUp, FiCheckCircle, FiClock, FiFileText, FiMapPin } from 'react-icons/fi';

const MonitoringDashboard = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [stats, setStats] = useState(null);
    const [engStats, setEngStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const user = auth.currentUser;
            if (!user) return;

            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);

                try {
                    const params = new URLSearchParams({
                        region: data.region,
                        ...(data.division && { division: data.division })
                    });

                    const [statsRes, engStatsRes] = await Promise.all([
                        fetch(`/api/monitoring/stats?${params.toString()}`),
                        fetch(`/api/monitoring/engineer-stats?${params.toString()}`)
                    ]);

                    if (statsRes.ok) setStats(await statsRes.json());
                    if (engStatsRes.ok) setEngStats(await engStatsRes.json());
                } catch (err) {
                    console.error("Dashboard Fetch Error:", err);
                }
            }
            setLoading(false);
        };

        fetchData();
    }, []);

    const StatCard = ({ title, value, total, color, icon: Icon }) => {
        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl ${color} bg-opacity-10 dark:bg-opacity-20`}>
                        <Icon className={color.replace('bg-', 'text-')} size={24} />
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{percentage}%</span>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{value} / {total}</p>
                    </div>
                </div>
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300">{title}</h3>
                <div className="mt-3 w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${color} transition-all duration-1000`} 
                        style={{ width: `${percentage}%` }}
                    ></div>
                </div>
            </div>
        );
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 font-sans">
                {/* Header */}
                <div className="bg-gradient-to-br from-[#004A99] to-[#002D5C] p-6 pb-20 rounded-b-[3rem] shadow-xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <FiTrendingUp size={120} />
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2 opacity-80">
                            <FiMapPin size={14} />
                            <span className="text-xs font-bold uppercase tracking-widest">
                                {userData?.role === 'Regional Office' ? `Region ${userData?.region}` : `${userData?.division} Division`}
                            </span>
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">Monitoring Dashboard</h1>
                        <p className="text-blue-100/70 text-sm mt-1">Status of schools & infrastructure projects.</p>
                    </div>
                </div>

                <div className="px-5 -mt-10 space-y-6 relative z-20">
                    {/* Infrastructure Summary */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Infrastructure Status</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                                <span className="text-3xl font-black text-[#004A99] dark:text-blue-400">{engStats?.avg_progress || 0}%</span>
                                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Avg. Progress</p>
                            </div>
                            <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
                                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{engStats?.completed_count || 0}</span>
                                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Completed</p>
                            </div>
                        </div>
                    </div>

                    {/* School Submissions */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Form Submissions</h2>
                            <button 
                                onClick={() => navigate('/jurisdiction-schools')}
                                className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg"
                            >
                                View All Schools
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <StatCard 
                                title="School Profiles" 
                                value={stats?.profile || 0} 
                                total={stats?.total_schools || 0} 
                                color="bg-blue-500" 
                                icon={FiFileText} 
                            />
                            <StatCard 
                                title="Enrollment Data" 
                                value={stats?.enrollment || 0} 
                                total={stats?.total_schools || 0} 
                                color="bg-emerald-500" 
                                icon={FiCheckCircle} 
                            />
                            <StatCard 
                                title="School Resources" 
                                value={stats?.resources || 0} 
                                total={stats?.total_schools || 0} 
                                color="bg-amber-500" 
                                icon={FiClock} 
                            />
                        </div>
                    </div>
                </div>

                <BottomNav userRole={userData?.role} />
            </div>
        </PageTransition>
    );
};

export default MonitoringDashboard;
