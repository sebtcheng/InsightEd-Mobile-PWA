import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiTrendingUp, FiCheckCircle, FiClock, FiFileText, FiMapPin } from 'react-icons/fi';
import { TbTrophy } from 'react-icons/tb';

const MonitoringDashboard = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [stats, setStats] = useState(null);
    const [engStats, setEngStats] = useState(null);
    const [jurisdictionProjects, setJurisdictionProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');

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

                    const [statsRes, engStatsRes, projectsRes] = await Promise.all([
                        fetch(`/api/monitoring/stats?${params.toString()}`),
                        fetch(`/api/monitoring/engineer-stats?${params.toString()}`),
                        fetch(`/api/monitoring/engineer-projects?${params.toString()}`)
                    ]);

                    if (statsRes.ok) setStats(await statsRes.json());
                    if (engStatsRes.ok) setEngStats(await engStatsRes.json());
                    if (projectsRes.ok) setJurisdictionProjects(await projectsRes.json());
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
                        <h1 className="text-3xl font-black tracking-tight">Monitoring</h1>
                        <p className="text-blue-100/70 text-sm mt-1">Status of schools & infrastructure.</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 mt-8 relative z-10">
                        {['all', 'school', 'engineer'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab
                                        ? 'bg-white text-[#004A99] shadow-lg'
                                        : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-5 -mt-10 space-y-6 relative z-20">
                    {/* ALL TAB */}
                    {activeTab === 'all' && (
                        <>
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Jurisdiction Overview</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                                        <span className="text-3xl font-black text-[#004A99] dark:text-blue-400">{stats?.total_schools || 0}</span>
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">Total Schools</p>
                                    </div>
                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
                                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{engStats?.total_projects || 0}</span>
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">Infra Projects</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Quick Stats</h2>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Avg. Project Progress</span>
                                        <span className="font-bold text-[#004A99] dark:text-blue-400">{engStats?.avg_progress || 0}%</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Profile Completion</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                            {stats?.total_schools ? Math.round(((stats?.profile || 0) / stats.total_schools) * 100) : 0}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* SCHOOL TAB */}
                    {activeTab === 'school' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Form Submissions</h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => navigate('/dummy-forms')}
                                        className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors"
                                    >
                                        View Sample Forms
                                    </button>
                                    <button
                                        onClick={() => navigate('/jurisdiction-schools')}
                                        className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-50 hover:bg-blue-100 transition-colors"
                                    >
                                        View All Schools
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <StatCard title="Profiles" value={stats?.profile || 0} total={stats?.total_schools || 0} color="bg-blue-500" icon={FiFileText} />
                                <StatCard title="School Head" value={stats?.head || 0} total={stats?.total_schools || 0} color="bg-indigo-500" icon={FiCheckCircle} />
                                <StatCard title="Enrollment" value={stats?.enrollment || 0} total={stats?.total_schools || 0} color="bg-emerald-500" icon={FiTrendingUp} />
                                <StatCard title="Classes" value={stats?.organizedclasses || 0} total={stats?.total_schools || 0} color="bg-cyan-500" icon={FiCheckCircle} />
                                <StatCard title="Modalities" value={stats?.shifting || 0} total={stats?.total_schools || 0} color="bg-purple-500" icon={FiMapPin} />
                                <StatCard title="Personnel" value={stats?.personnel || 0} total={stats?.total_schools || 0} color="bg-orange-500" icon={FiFileText} />
                                <StatCard title="Specialization" value={stats?.specialization || 0} total={stats?.total_schools || 0} color="bg-pink-500" icon={FiTrendingUp} />
                                <StatCard title="Resources" value={stats?.resources || 0} total={stats?.total_schools || 0} color="bg-amber-500" icon={FiClock} />
                            </div>
                        </div>
                    )}

                    {/* ENGINEER TAB */}
                    {activeTab === 'engineer' && (
                        <div className="space-y-4">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Infrastructure Summary</h2>
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="text-center">
                                        <p className="text-4xl font-black text-[#004A99] dark:text-blue-400">{engStats?.total_projects || 0}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Projects</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{engStats?.completed_count || 0}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Completed</p>
                                    </div>
                                    <div className="text-center col-span-2 pt-4 border-t border-slate-50 dark:border-slate-700">
                                        <p className="text-4xl font-black text-amber-500 dark:text-amber-400">{engStats?.avg_progress || 0}%</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Avg. Physical Accomplishment</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-1">Project List</h2>
                                {jurisdictionProjects.length === 0 ? (
                                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400">
                                        No projects found in this jurisdiction.
                                    </div>
                                ) : (
                                    <div className="space-y-3 pb-6">
                                        {jurisdictionProjects.map((project) => (
                                            <div
                                                key={project.id}
                                                onClick={() => navigate(`/project-validation?schoolId=${project.schoolId}`)}
                                                className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 active:scale-[0.98] transition-all cursor-pointer group"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-blue-600 transition-colors">{project.projectName}</h3>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 flex items-center gap-1">
                                                            <FiMapPin size={10} /> {project.schoolName}
                                                        </p>
                                                    </div>
                                                    <div className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${project.validation_status === 'Validated' ? 'bg-emerald-50 text-emerald-600' :
                                                            project.validation_status === 'Rejected' ? 'bg-red-50 text-red-600' :
                                                                'bg-orange-50 text-orange-600'
                                                        }`}>
                                                        {project.validation_status || 'Pending'}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 rounded-full"
                                                            style={{ width: `${project.accomplishmentPercentage}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">{project.accomplishmentPercentage}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <BottomNav userRole={userData?.role} />
            </div>
        </PageTransition>
    );
};

export default MonitoringDashboard;
