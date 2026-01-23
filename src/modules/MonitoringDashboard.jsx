import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiTrendingUp, FiCheckCircle, FiClock, FiFileText, FiMapPin } from 'react-icons/fi';
import { TbTrophy } from 'react-icons/tb';

import Papa from 'papaparse';

const MonitoringDashboard = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [stats, setStats] = useState(null);
    const [engStats, setEngStats] = useState(null);
    const [jurisdictionProjects, setJurisdictionProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');

    // State for Central Office Filters
    const [coRegion, setCoRegion] = useState('');
    const [coDivision, setCoDivision] = useState('');
    const [availableRegions, setAvailableRegions] = useState([]);
    const [availableDivisions, setAvailableDivisions] = useState([]);
    const [schoolData, setSchoolData] = useState([]); // Store raw CSV data

    // NEW: Regional Stats for National View
    const [regionalStats, setRegionalStats] = useState([]);

    const fetchData = async (overrideRegion, overrideDivision) => {
        const user = auth.currentUser;
        if (!user) return;
        
        // If we already have userData, use it, otherwise fetch it
        let currentUserData = userData;
        if (!currentUserData) {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                currentUserData = docSnap.data();
                setUserData(currentUserData);
            }
        }
        
        if (!currentUserData) return;

        try {
            // Determine params based on Role
            let queryRegion = currentUserData.region;
            let queryDivision = currentUserData.division;

            if (currentUserData.role === 'Central Office') {
                // If in National View (no region selected), fetch Regional Overview
                // However, we only need to fetch detailed stats if a region IS selected.
                
                if (overrideRegion || coRegion) {
                     queryRegion = overrideRegion !== undefined ? overrideRegion : coRegion;
                     queryDivision = overrideDivision !== undefined ? overrideDivision : (coDivision || '');
                } else {
                    // NATIONAL VIEW: Fetch Regional Stats
                    const regionRes = await fetch('/api/monitoring/regions');
                    if (regionRes.ok) setRegionalStats(await regionRes.json());
                    setLoading(false);
                    return; // Stop here, don't fetch detailed stats yet
                }
            }

            const params = new URLSearchParams({
                region: queryRegion,
                ...(queryDivision && { division: queryDivision })
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
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        
        // Load Location Data for filters
        import('../locations.json').then(module => {
            const data = module.default;
            setAvailableRegions(Object.keys(data).sort());
        }).catch(err => console.error("Failed to load locations", err));

        // Load Schools Data for Division filtering
        Papa.parse('/schools.csv', {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if(results.data && results.data.length > 0) {
                     setSchoolData(results.data);
                }
            }
        });

    }, []);

    // Effect for Central Office: Update divisions when Region changes
    useEffect(() => {
        // REMOVED: Auto-select Region NCR. Now defaults to National View.
        
        if (userData?.role === 'Central Office' && coRegion && schoolData.length > 0) {
            const divisions = [...new Set(schoolData
                .filter(s => s.region === coRegion)
                .map(s => s.division))]
                .sort();
            setAvailableDivisions(divisions);
        } else {
            setAvailableDivisions([]);
        }
    }, [coRegion, schoolData, userData]);

    const handleFilterChange = (region) => {
        setCoRegion(region); // Set empty string for National View
        setCoDivision(''); // Reset division when region changes
        fetchData(region, '');
    };

    const handleDivisionChange = (division) => {
        setCoDivision(division);
        fetchData(coRegion, division);
    };

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

    // NEW: Calculate Jurisdiction Total (Memoized for reuse)
    const jurisdictionTotal = React.useMemo(() => {
        let total = 0;
        if (schoolData.length > 0 && userData) {
            const targetRegion = userData.role === 'Central Office' ? coRegion : userData.region;
            const targetDivision = userData.role === 'Central Office' ? coDivision : userData.division;
            
            total = schoolData.filter(s => {
                const matchRegion = !targetRegion || s.region === targetRegion;
                const matchDivision = !targetDivision || s.division === targetDivision;
                return matchRegion && matchDivision;
            }).length;
        }
        // Fallback to DB stats if CSV not ready, though CSV is preferred for "Total Jurisdiction"
        return total || stats?.total_schools || 0;
    }, [schoolData, userData, coRegion, coDivision, stats?.total_schools]);


    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    // --- RENDER NATIONAL VIEW (REGIONAL GRID) ---
    if (userData?.role === 'Central Office' && !coRegion) {
        return (
            <PageTransition>
                <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 font-sans">
                     {/* Header */}
                     <div className="bg-gradient-to-br from-[#004A99] to-[#002D5C] p-6 pb-20 rounded-b-[3rem] shadow-xl text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <FiTrendingUp size={120} />
                        </div>
                        <div className="relative z-10">
                            <h1 className="text-3xl font-black tracking-tight">{userData.bureau || 'Central Office'}</h1>
                            <p className="text-blue-100/70 text-sm mt-1">National Overview</p>
                        </div>
                    </div>

                    <div className="px-5 -mt-10 space-y-4 relative z-20">
                         {regionalStats.length === 0 ? (
                            <div className="bg-white p-8 rounded-3xl text-center text-slate-400">Loading regional stats...</div>
                         ) : (
                            regionalStats.map((reg, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => handleFilterChange(reg.region)}
                                    className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all group"
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-black text-slate-700 dark:text-slate-200 group-hover:text-blue-600 transition-colors">{reg.region}</h2>
                                        <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold">
                                            {reg.total_schools} Schools
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-slate-400 font-bold uppercase">Enrollments</p>
                                            <p className="text-xl font-black text-slate-800 dark:text-emerald-400">{reg.with_enrollment}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 font-bold uppercase">Projects</p>
                                            <p className="text-xl font-black text-slate-800 dark:text-blue-400">{reg.total_projects}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="flex justify-between items-center text-xs mb-1">
                                                <span className="font-bold text-slate-500">Project Completion</span>
                                                <span className="font-bold text-blue-600">{reg.avg_accomplishment}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                <div className="bg-blue-500 h-full rounded-full" style={{width: `${reg.avg_accomplishment}%`}}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                         )}
                    </div>
                     <BottomNav userRole={userData?.role} />
                </div>
            </PageTransition>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 font-sans">
                {/* Header */}
                <div className="bg-gradient-to-br from-[#004A99] to-[#002D5C] p-6 pb-20 rounded-b-[3rem] shadow-xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <FiTrendingUp size={120} />
                    </div>
                    {userData?.role === 'Super User' && (
                        <div className="absolute top-6 right-6 z-50">
                            <button 
                                onClick={() => navigate('/super-admin')}
                                className="px-3 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg text-xs font-bold text-white transition"
                            >
                                ← Back to Hub
                            </button>
                        </div>
                    )}

                    <div className="relative z-10">
                        {userData?.role === 'Central Office' || userData?.role === 'Super User' ? (
                            <div className="mb-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">View Region:</span>
                                    <select 
                                        className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none focus:bg-white/20 text-slate-800"
                                        onChange={(e) => handleFilterChange(e.target.value)}
                                        value={coRegion}
                                    >
                                        <option value="" className="text-slate-800">National View</option> 
                                        {availableRegions.map(reg => (
                                            <option key={reg} value={reg} className="text-slate-800">{reg}</option>
                                        ))}
                                    </select>
                                    
                                    {/* Division Filter */}
                                    <select 
                                        className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none focus:bg-white/20 text-slate-800 disabled:opacity-50"
                                        onChange={(e) => handleDivisionChange(e.target.value)}
                                        value={coDivision}
                                        disabled={!coRegion}
                                    >
                                        <option value="" className="text-slate-800">All Divisions</option>
                                        {availableDivisions.map(div => (
                                            <option key={div} value={div} className="text-slate-800">{div}</option>
                                        ))}
                                    </select>
                                </div>
                                <h1 className="text-3xl font-black tracking-tight">{userData.bureau || 'Central Office'}</h1>
                                <p className="text-blue-100/70 text-sm mt-1">{coDivision ? `${coDivision} Division` : (coRegion ? `${coRegion}` : 'National View')}</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-2 opacity-80">
                                    <FiMapPin size={14} />
                                    <span className="text-xs font-bold uppercase tracking-widest">
                                        {userData?.role === 'Regional Office' ? `Region ${userData?.region}` : `${userData?.division} Division`}
                                    </span>
                                </div>
                                <h1 className="text-3xl font-black tracking-tight">Monitoring</h1>
                                <p className="text-blue-100/70 text-sm mt-1">Status of schools & infrastructure.</p>
                            </>
                        )}
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
                                        {(() => {
                                            // Use Memoized Jurisdiction Total
                                            const displayTotal = jurisdictionTotal;

                                            // Get Completed Schools Count (from API Update)
                                            const completedCount = parseInt(stats?.completed_schools_count || 0);

                                            // Calculate Percentage
                                            const percentage = displayTotal > 0 ? ((completedCount / displayTotal) * 100).toFixed(1) : 0;

                                            return (
                                                <>
                                                    <span className="text-3xl font-black text-[#004A99] dark:text-blue-400">
                                                        {percentage}%
                                                    </span>
                                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">
                                                        Completed Forms <br/>
                                                        <span className="text-[#004A99] dark:text-blue-300">({completedCount} / {displayTotal})</span>
                                                    </p>
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
                                        <div className="flex flex-col h-full justify-center">
                                            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{engStats?.total_projects || 0}</span>
                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">Infra Projects</p>
                                            
                                            {/* Completed Projects % */}
                                            {engStats?.total_projects > 0 && (
                                                <div className="mt-2 text-[10px] font-bold text-emerald-700/70 dark:text-emerald-300/70">
                                                    {Math.round(((engStats.completed_count || 0) / engStats.total_projects) * 100)}% Completed
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Quick Stats</h2>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Avg. Project Physical Accomp.</span>
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
                                        onClick={() => navigate('/dummy-forms', { state: { type: 'school' } })}
                                        className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors"
                                    >
                                        View Sample Forms
                                    </button>
                                    <button
                                        onClick={() => {
                                             const params = new URLSearchParams();
                                             if (coRegion) params.append('region', coRegion);
                                             if (coDivision) params.append('division', coDivision);
                                             navigate(`/jurisdiction-schools?${params.toString()}`);
                                        }}
                                        className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-50 hover:bg-blue-100 transition-colors"
                                    >
                                        View All Schools
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Use jurisdictionTotal for ALL cards */}
                                <StatCard title="Profiles" value={stats?.profile || 0} total={jurisdictionTotal} color="bg-blue-500" icon={FiFileText} />
                                <StatCard title="School Head" value={stats?.head || 0} total={jurisdictionTotal} color="bg-indigo-500" icon={FiCheckCircle} />
                                <StatCard title="Enrollment" value={stats?.enrollment || 0} total={jurisdictionTotal} color="bg-emerald-500" icon={FiTrendingUp} />
                                <StatCard title="Classes" value={stats?.organizedclasses || 0} total={jurisdictionTotal} color="bg-cyan-500" icon={FiCheckCircle} />
                                <StatCard title="Modalities" value={stats?.shifting || 0} total={jurisdictionTotal} color="bg-purple-500" icon={FiMapPin} />
                                <StatCard title="Personnel" value={stats?.personnel || 0} total={jurisdictionTotal} color="bg-orange-500" icon={FiFileText} />
                                <StatCard title="Specialization" value={stats?.specialization || 0} total={jurisdictionTotal} color="bg-pink-500" icon={FiTrendingUp} />
                                <StatCard title="Resources" value={stats?.resources || 0} total={jurisdictionTotal} color="bg-amber-500" icon={FiClock} />
                            </div>
                        </div>
                    )}

                    {/* ENGINEER TAB */}
                    {activeTab === 'engineer' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Infrastructure Summary</h2>
                                <button
                                    onClick={() => navigate('/dummy-forms', { state: { type: 'engineer' } })}
                                    className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors"
                                >
                                    View Sample Forms
                                </button>
                            </div>
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
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-1">Validated Project List</h2>
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
