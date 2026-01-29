import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiTrendingUp, FiCheckCircle, FiClock, FiFileText, FiMapPin, FiArrowLeft, FiMenu, FiBell, FiSearch, FiFilter, FiAlertCircle, FiX, FiBarChart2 } from 'react-icons/fi';
import { TbTrophy, TbSchool } from 'react-icons/tb';

import Papa from 'papaparse';


// Helper for robust name matching (ignoring "Division", "District" suffixes)
const normalizeLocationName = (name) => {
    return name?.toString().toLowerCase().trim()
        .replace(/\s+division$/, '')
        .replace(/\s+district$/, '')
        .replace(/^division\s+of\s+/, '')
        .replace(/^district\s+of\s+/, '')
        .trim() || '';
};

const MonitoringDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [userData, setUserData] = useState(null);
    const [stats, setStats] = useState(null);
    const [engStats, setEngStats] = useState(null);
    const [jurisdictionProjects, setJurisdictionProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('accomplishment'); // Default to InsightED Accomplishment

    // State for Central Office Filters
    const [coRegion, setCoRegion] = useState('');
    const [coDivision, setCoDivision] = useState('');
    const [coDistrict, setCoDistrict] = useState(''); // NEW: District Filter
    const [availableRegions, setAvailableRegions] = useState([]);
    const [availableDivisions, setAvailableDivisions] = useState([]);
    const [availableDistricts, setAvailableDistricts] = useState([]); // NEW: District State
    const [schoolData, setSchoolData] = useState([]); // Store raw CSV data

    // NEW: Regional Stats for National View
    const [regionalStats, setRegionalStats] = useState([]);
    const [divisionStats, setDivisionStats] = useState([]); // Per-division stats for RO
    const [districtStats, setDistrictStats] = useState([]); // Per-district stats for SDO
    const [districtSchools, setDistrictSchools] = useState([]); // Schools for Drill-down
    const [loadingDistrict, setLoadingDistrict] = useState(false);
    const [schoolSort, setSchoolSort] = useState('pct-desc'); // Sort state for schools

    // NEW: Store Aggregated CSV Totals
    const [csvRegionalTotals, setCsvRegionalTotals] = useState({});

    const [projectListModal, setProjectListModal] = useState({ isOpen: false, title: '', projects: [], isLoading: false });

    // --- EFFECT: DATA FETCHING ---
    useEffect(() => {
        if (userData) {
           fetchData(userData.region || '', userData.division || '');
        }
    }, [userData]);

    const fetchProjectList = async (region, status) => {
        setProjectListModal({ isOpen: true, title: `${status} Projects in ${region}`, projects: [], isLoading: true });
        try {
            const res = await fetch(`/api/monitoring/engineer-projects?region=${encodeURIComponent(region)}`);
            if (res.ok) {
                const data = await res.json();
                // Filter by status on client side
                const filtered = data.filter(p => {
                    const s = p.status?.toLowerCase() || '';
                    const q = status.toLowerCase();
                    return s === q; // Strict matching now for all statuses
                });
                setProjectListModal(prev => ({ ...prev, projects: filtered, isLoading: false }));
            } else {
                 setProjectListModal(prev => ({ ...prev, isLoading: false }));
            }
        } catch (err) {
            console.error(err);
             setProjectListModal(prev => ({ ...prev, isLoading: false }));
        }
    };

    const handleProjectDrillDown = (region, status) => {
        fetchProjectList(region, status);
    };

    const fetchData = async (region, division) => {
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
            let queryRegion = region;
            let queryDivision = division;

            if (currentUserData.role === 'Central Office') {
                // If in National View (no region selected), fetch Regional Overview
                // However, we only need to fetch detailed stats if a region IS selected.
                
                if (region || coRegion) {
                     queryRegion = region !== undefined ? region : coRegion;
                     queryDivision = division !== undefined ? division : (coDivision || '');
                } else {
                    // NATIONAL VIEW: Fetch Regional Stats
                    const regionRes = await fetch('/api/monitoring/regions');
                    if (regionRes.ok) setRegionalStats(await regionRes.json());
                    setLoading(false);
                    return; // Stop here, don't fetch detailed stats yet
                }
            } else {
                // For Regional Office and School Division Office, ALWAYS use their assigned jurisdiction
                // if not explicitly overridden (though they usually can't override)
                queryRegion = currentUserData.region;
                queryDivision = currentUserData.division;
            }

            const params = new URLSearchParams({
                region: queryRegion,
                ...(queryDivision && { division: queryDivision }),
                ...(coDistrict && { district: coDistrict }) // Add District param
            });

            const fetchPromises = [
                fetch(`/api/monitoring/stats?${params.toString()}`),
                fetch(`/api/monitoring/engineer-stats?${params.toString()}`),
                fetch(`/api/monitoring/engineer-projects?${params.toString()}`)
            ];

            // Fetch Division Stats for Regional Office OR Central Office (when drilling down to a region)
            if (currentUserData.role === 'Regional Office' || (currentUserData.role === 'Central Office' && queryRegion && !queryDivision)) {
                fetchPromises.push(fetch(`/api/monitoring/division-stats?${params.toString()}`));
            }
            
            // Fetch District Stats only for SDO or CO (when Division is selected)
            if (currentUserData.role === 'School Division Office' || (currentUserData.role === 'Central Office' && queryDivision)) {
                fetchPromises.push(fetch(`/api/monitoring/district-stats?${params.toString()}`));
            }

            const results = await Promise.all(fetchPromises);
            const statsRes = results[0];
            const engStatsRes = results[1];
            const projectsRes = results[2];
            const divStatsRes = currentUserData.role === 'Regional Office' || (currentUserData.role === 'Central Office' && queryRegion && !queryDivision) ? results[3] : null;
            const distStatsRes = currentUserData.role === 'School Division Office' || (currentUserData.role === 'Central Office' && queryDivision) ? results[3] : null;

            if (statsRes.ok) setStats(await statsRes.json());
            if (engStatsRes.ok) setEngStats(await engStatsRes.json());
            if (projectsRes.ok) setJurisdictionProjects(await projectsRes.json());
            if (divStatsRes && divStatsRes.ok) setDivisionStats(await divStatsRes.json());
            if (distStatsRes && distStatsRes.ok) setDistrictStats(await distStatsRes.json());
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
                     
                     // Aggregate Totals by Region
                     const totals = {};
                     results.data.forEach(row => {
                         if (row.region) {
                             totals[row.region] = (totals[row.region] || 0) + 1;
                         }
                     });
                     setCsvRegionalTotals(totals);
                }
            }
        });

    }, []);

    // NEW: Handle Active Tab from Navigation State
    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);

            if (location.state.resetFilters) {
                setCoRegion('');
                setCoDivision('');
                setCoDistrict('');
                // Fetch Data for National View (empty params)
                fetchData('', '');
            }
        }
    }, [location.state]);

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

    // NEW: Update Districts when Division changes
    useEffect(() => {
        if (userData?.role === 'Central Office' && coDivision && schoolData.length > 0) {
            const districts = [...new Set(schoolData
                .filter(s => s.region === coRegion && s.division === coDivision)
                .map(s => s.district))]
                .sort();
            setAvailableDistricts(districts);
        } else {
            setAvailableDistricts([]);
        }
    }, [coDivision, coRegion, schoolData, userData]);

    const handleFilterChange = (region) => {
        setCoRegion(region); // Set empty string for National View
        setCoDivision(''); // Reset division when region changes
        setCoDistrict(''); // Reset district
        fetchData(region, '');
    };

    const handleDivisionChange = (division) => {
        setCoDivision(division);
        setCoDistrict(''); // Reset district
        fetchData(coRegion, division);
    };
    
    const handleDistrictChange = async (district) => {
        setCoDistrict(district);
        
        if (district) {
            setLoadingDistrict(true);
            try {
                // Determine params
                const user = auth.currentUser;
                // Use state or user data (User data is safer for SDO)
                const region = userData.role === 'Central Office' ? coRegion : userData.region;
                const division = userData.role === 'Central Office' ? coDivision : userData.division;
                
                const res = await fetch(`/api/monitoring/schools?region=${region}&division=${division}&district=${district}`);
                if (res.ok) {
                    const data = await res.json();
                    setDistrictSchools(data);
                }
            } catch (error) {
                console.error("Failed to fetch district schools:", error);
            } finally {
                setLoadingDistrict(false);
            }
        } else {
             setDistrictSchools([]);
        }

        // Trigger global stats fetch
        setTimeout(() => fetchData(), 0); 
    };
    
    // Better: Add useEffect for Filters
    useEffect(() => {
        if(userData?.role === 'Central Office' && (coDistrict || coDivision || coRegion)) {
             fetchData(coRegion, coDivision);
        }
    }, [coDistrict, coDivision, coRegion]); // Only trigger when district changes for now to avoid loops with other handlers

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
    const jurisdictionTotal = useMemo(() => {
        let total = 0;
        if (schoolData.length > 0 && userData) {
            const targetRegion = userData.role === 'Central Office' ? coRegion : userData.region;
            const targetDivision = userData.role === 'Central Office' ? coDivision : userData.division;
            const targetDistrict = userData.role === 'Central Office' ? coDistrict : null;
            
            total = schoolData.filter(s => {
                const matchRegion = !targetRegion || s.region === targetRegion;
                const matchDivision = !targetDivision || s.division === targetDivision;
                const matchDistrict = !targetDistrict || s.district === targetDistrict;
                return matchRegion && matchDivision && matchDistrict;
            }).length;
        }
        // Fallback to DB stats if CSV not ready, though CSV is preferred for "Total Jurisdiction"
        return total || stats?.total_schools || 0;
    }, [schoolData, userData, coRegion, coDivision, coDistrict, stats?.total_schools]);


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
                     <div className="bg-gradient-to-br from-[#004A99] to-[#002D5C] p-8 pb-32 rounded-b-[3rem] shadow-2xl text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <FiTrendingUp size={200} />
                        </div>
                        <div className="relative z-10 max-w-7xl mx-auto">
                            <div className="flex justify-between items-end mb-6">
                                <div>
                                    <h1 className="text-4xl font-black tracking-tighter">{userData.bureau || 'Central Office'}</h1>
                                    <p className="text-blue-200 text-lg font-medium mt-1">
                                        {activeTab === 'infra' ? 'Infrastructure Project Monitoring' : 'National Accomplishment Overview'}
                                    </p>
                                </div>
                                <div className="hidden md:block text-right">
                                    <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">Current Scope</p>
                                    <p className="text-2xl font-bold">Philippines (National)</p>
                                </div>
                            </div>

                            {/* Global Quick Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                                
                                {/* 1. InsightED Stats (Accomplishment Tab) */}
                                {activeTab === 'accomplishment' && (
                                    <>
                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 col-span-2">
                                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">National Accomplishment Rate</p>
                                            {/* Show Percentage */}
                                            {(() => {
                                                const totalSchools = Object.values(csvRegionalTotals).length > 0 
                                                    ? Object.values(csvRegionalTotals).reduce((a, b) => a + b, 0)
                                                    : regionalStats.reduce((acc, curr) => acc + parseInt(curr.total_schools || 0), 0);
                                                const completed = regionalStats.reduce((acc, curr) => acc + parseInt(curr.completed_schools || 0), 0);
                                                const pct = totalSchools > 0 ? ((completed / totalSchools) * 100).toFixed(1) : 0;
                                                return (
                                                    <div className="flex items-end gap-3">
                                                        <p className="text-4xl font-black mt-1">{pct}%</p>
                                                        <p className="text-sm opacity-70 mb-1 font-medium">{completed.toLocaleString()} of {totalSchools.toLocaleString()} Schools Complete</p>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </>
                                )}

                                {/* 2. Infra Stats (Infra Tab) */}
                                {activeTab === 'infra' && (
                                    <>
                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Total Projects</p>
                                            <p className="text-3xl font-black mt-1">{regionalStats.reduce((acc, curr) => acc + parseInt(curr.total_projects || 0), 0).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Ongoing Projects</p>
                                            <p className="text-3xl font-black mt-1 text-blue-400">{regionalStats.reduce((acc, curr) => acc + parseInt(curr.ongoing_projects || 0), 0).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Completed</p>
                                            <p className="text-3xl font-black mt-1 text-emerald-400">{regionalStats.reduce((acc, curr) => acc + parseInt(curr.completed_projects || 0), 0).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Delayed</p>
                                            <p className="text-3xl font-black mt-1 text-rose-400">
                                                {regionalStats && regionalStats.length > 0
                                                    ? regionalStats.reduce((acc, curr) => acc + parseInt(curr.delayed_projects || 0), 0).toLocaleString() 
                                                    : (engStats?.delayed_count || 0)}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="max-w-7xl mx-auto px-6 -mt-20 space-y-12 relative z-20 pb-20">
                         {regionalStats.length === 0 ? (
                            <div className="bg-white p-8 rounded-3xl text-center text-slate-400">Loading regional stats...</div>
                         ) : (
                            <>
                                {/* SECTION 1: REGIONAL PERFORMANCE (SCHOOL DATA) - INSIGHTED TAB */}
                                {activeTab === 'accomplishment' && (
                                    <div>
                                        <h2 className="text-black/60 dark:text-white/60 text-xs font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                            <FiCheckCircle className="text-blue-500" /> Regional Compliance Performance
                                        </h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {regionalStats.map((reg, idx) => {
                                                // Ensure we use the CSV Total if available
                                                const totalSchools = csvRegionalTotals[reg.region] || reg.total_schools || 0;
                                                const completedCount = reg.completed_schools || 0;
                                                
                                                // Handle edge case where backend total is 0 but we want to show 0/CSV_Total
                                                const completionRate = totalSchools > 0 ? Math.round((completedCount / totalSchools) * 100) : 0;
                                                
                                                return (
                                                    <div 
                                                        key={idx}
                                                        onClick={() => handleFilterChange(reg.region)}
                                                        className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden"
                                                    >
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>
                                                        
                                                        <div className="relative z-10">
                                                            <div className="flex justify-between items-start mb-6">
                                                                <div>
                                                                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-600 transition-colors">{reg.region}</h2>
                                                                    {/* REMOVED: Total Schools sub-label if desired, but user said remove "Total Schools" metric. 
                                                                        Does that mean remove it from cards too? 
                                                                        "InsightED Accomplishment page should only feature (1) National Accomplishment Rate (2) Regional and division breakdown".
                                                                        Usually breakdown implies visualizing the counts or rate. I will keep the rate prominent.
                                                                        I will Hide the "X Schools" label if strictly interpreted, but it's useful context. 
                                                                        Let's keep the percentage prominent.
                                                                     */}
                                                                    <p className="text-xs font-bold text-slate-400 uppercase mt-1">Status Report</p>
                                                                </div>
                                                                <div className={`flex items-center justify-center w-12 h-12 rounded-full font-black text-sm border-4 ${completionRate >= 100 ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : (completionRate >= 50 ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-orange-500 text-orange-600 bg-orange-50')}`}>
                                                                    {completionRate}%
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3">
                                                                <div>
                                                                    <div className="flex justify-between text-xs font-bold mb-1">
                                                                        <span className="text-slate-500">Form Completion</span>
                                                                        <span className="text-slate-700 dark:text-slate-300">{completedCount} / {totalSchools.toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                                                        <div className={`h-full rounded-full ${completionRate >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{width: `${completionRate}%`}}></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* SECTION 2: INFRASTRUCTURE PROJECTS MATRIX - INFRA TAB */}
                                {activeTab === 'infra' && (
                                    <div>
                                        <h2 className="text-black/60 dark:text-white/60 text-xs font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                            <FiTrendingUp className="text-emerald-500" /> Infrastructure Projects Matrix
                                        </h2>
                                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden relative">
                                            <div className="overflow-x-auto custom-scrollbar">
                                                <table className="w-full text-left border-collapse min-w-[800px]">
                                                    <thead>
                                                        <tr className="text-[10px] uppercase font-black text-slate-400 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                                                            <th className="p-5 min-w-[180px] sticky left-0 bg-white dark:bg-slate-800 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Region</th>
                                                            <th className="p-5 text-center min-w-[100px]">Projects</th>
                                                            <th className="p-5 text-center min-w-[140px]">Total Allocation</th>
                                                            <th className="p-5 text-center text-slate-400 min-w-[100px]">Not Started</th>
                                                            <th className="p-5 text-center text-orange-400 min-w-[120px]">Under Proc.</th>
                                                            <th className="p-5 text-center text-blue-500 min-w-[100px]">Ongoing</th>
                                                            <th className="p-5 text-center text-emerald-500 min-w-[100px]">Completed</th>
                                                            <th className="p-5 text-center text-rose-500 min-w-[100px]">Delayed</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                        {regionalStats.map((reg, idx) => (
                                                            <tr key={idx} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-50 dark:border-slate-800 group">
                                                                <td className="p-5 sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors z-10 border-r border-slate-50 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] text-slate-700 dark:text-slate-100 font-extrabold">
                                                                    {reg.region}
                                                                </td>
                                                                <td className="p-5 text-center text-base">{reg.total_projects}</td>
                                                                <td className="p-5 text-center font-mono text-slate-500 text-[11px]">
                                                                    ₱{parseInt(reg.total_allocation || 0).toLocaleString()}
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleProjectDrillDown(reg.region, 'Not Yet Started'); }}
                                                                        className="w-full py-2 px-3 rounded-lg text-slate-500 bg-slate-50/50 hover:bg-slate-100/80 hover:scale-105 active:scale-95 transition-all font-black shadow-sm"
                                                                    >
                                                                        {reg.not_yet_started_projects || 0}
                                                                    </button>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleProjectDrillDown(reg.region, 'Under Procurement'); }}
                                                                        className="w-full py-2 px-3 rounded-lg text-orange-500 bg-orange-50/50 hover:bg-orange-100/80 hover:scale-105 active:scale-95 transition-all font-black shadow-sm"
                                                                    >
                                                                        {reg.under_procurement_projects || 0}
                                                                    </button>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleProjectDrillDown(reg.region, 'Ongoing'); }}
                                                                        className="w-full py-2 px-3 rounded-lg text-blue-600 bg-blue-50/50 hover:bg-blue-100/80 hover:scale-105 active:scale-95 transition-all font-black shadow-sm"
                                                                    >
                                                                        {reg.ongoing_projects}
                                                                    </button>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleProjectDrillDown(reg.region, 'Completed'); }}
                                                                        className="w-full py-2 px-3 rounded-lg text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100/80 hover:scale-105 active:scale-95 transition-all font-black shadow-sm"
                                                                    >
                                                                        {reg.completed_projects}
                                                                    </button>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleProjectDrillDown(reg.region, 'Delayed'); }}
                                                                        className="w-full py-2 px-3 rounded-lg text-rose-500 bg-rose-50/50 hover:bg-rose-100/80 hover:scale-105 active:scale-95 transition-all font-black shadow-sm"
                                                                    >
                                                                        {reg.delayed_projects}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                         )}
                    </div>
                     <BottomNav userRole={userData?.role} />
                </div>
                {/* PROJECT LIST MODAL (NATIONAL VIEW) */}
                {projectListModal.isOpen && (
                    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white">{projectListModal.title}</h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{projectListModal.projects.length} Projects Found</p>
                                </div>
                                <button 
                                    onClick={() => setProjectListModal(prev => ({ ...prev, isOpen: false }))}
                                    className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
                                >
                                    <FiX />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {projectListModal.isLoading ? (
                                    <div className="flex justify-center py-10">
                                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {projectListModal.projects.map((p) => (
                                            <div key={p.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:border-blue-200 transition-colors">
                                                <div>
                                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 transition-colors">{p.schoolName}</h4>
                                                    <p className="text-xs text-slate-500 italic">{p.projectName}</p>
                                                    {p.projectAllocation && (
                                                         <p className="text-[10px] font-mono text-slate-400 mt-1">
                                                            Alloc: ₱{Number(p.projectAllocation).toLocaleString()}
                                                         </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                     <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase mb-1 ${
                                                         p.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' :
                                                         p.status === 'Delayed' ? 'bg-rose-100 text-rose-600' :
                                                         'bg-blue-100 text-blue-600'
                                                     }`}>
                                                        {p.status}
                                                     </span>
                                                     <div className="text-xs font-black text-slate-700 dark:text-slate-300">
                                                        {p.accomplishmentPercentage}%
                                                     </div>
                                                </div>
                                            </div>
                                        ))}
                                        {projectListModal.projects.length === 0 && (
                                            <p className="text-center text-slate-400 italic py-10">No projects found for this category.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
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
                                <div className="flex items-center gap-2 mb-4">
                                    {(coRegion || coDivision || coDistrict) && (
                                        <button 
                                            onClick={() => {
                                                if (coDistrict) handleDistrictChange(''); // Back to Division View
                                                else if (coDivision) handleDivisionChange(''); // Back to Regional View
                                                else if (coRegion) handleFilterChange(''); // Back to National View
                                            }}
                                            className="mr-2 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition flex items-center justify-center group"
                                            title="Go Back"
                                        >
                                            <FiArrowLeft className="text-lg group-hover:-translate-x-0.5 transition-transform" />
                                        </button>
                                    )}
                                    
                                    <div>
                                        <h1 className="text-3xl font-black tracking-tight">{userData.bureau || 'Central Office'}</h1>
                                        <p className="text-blue-100/70 text-sm mt-1 font-bold uppercase tracking-widest">
                                            {coDistrict ? `${coDistrict}, ${coDivision}` : (coDivision ? `${coDivision} Division` : (coRegion ? `${coRegion}` : 'National View'))}
                                        </p>
                                    </div>
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

                    {/* Tabs - Hidden for SDO AND RO as they use Bottom Nav. Also hidden for Central Office when drilling down to a region. */}
                    {userData?.role !== 'School Division Office' && userData?.role !== 'Regional Office' && !(userData?.role === 'Central Office' && coRegion) && (
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
                    )}
                </div>

                <div className="px-5 -mt-10 space-y-6 relative z-20">
                    {/* HOME TAB (Previously ALL) - NOW SHARED FOR REGIONAL/DIVISION VIEWS */}
                    {(activeTab === 'all' || activeTab === 'home' || activeTab === 'accomplishment' || activeTab === 'infra') && (
                        <>
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Jurisdiction Overview</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {(activeTab === 'all' || activeTab === 'home' || activeTab === 'accomplishment') && (
                                        <div className={`p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl ${(activeTab === 'accomplishment' || activeTab === 'all' || activeTab === 'home') ? 'col-span-2' : ''}`}>
                                            {(() => {
                                                // Use Memoized Jurisdiction Total
                                                const displayTotal = jurisdictionTotal;

                                                // Get Completed Schools Count (from API Update)
                                                const completedCount = parseInt(stats?.completed_schools_count || 0);

                                                // Calculate Percentage
                                                const percentage = displayTotal > 0 ? ((completedCount / displayTotal) * 100).toFixed(1) : 0;

                                                return (
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                             <span className="text-3xl font-black text-[#004A99] dark:text-blue-400">
                                                                {percentage}%
                                                            </span>
                                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">
                                                                Completed Forms <br/>
                                                                <span className="text-[#004A99] dark:text-blue-300">({completedCount} / {displayTotal})</span>
                                                            </p>
                                                        </div>
                                                        {(activeTab === 'accomplishment' || activeTab === 'all' || activeTab === 'home') && <TbTrophy size={40} className="text-blue-200" />}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                    
                                    {(activeTab === 'infra') && (
                                        <div className={`p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl ${activeTab === 'infra' ? 'col-span-2' : ''}`}>
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
                                    )}
                                </div>
                            </div>

                            {/* Accomplishment Rate per School Division (Regional Office Only OR Central Office Regional View) */}
                            {/* ONLY SHOW FOR INSIGHTED ACCOMPLISHMENT TAB */}
                            {(activeTab === 'all' || activeTab === 'home' || activeTab === 'accomplishment') && 
                             (userData?.role === 'Regional Office' || (userData?.role === 'Central Office' && coRegion && !coDivision)) && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700 mt-6">
                                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Accomplishment Rate per School Division</h2>
                                    {(() => {
                                        // 1. Get List of Divisions for Current Region from CSV Data
                                        // Use userData.region or coRegion depending on role
                                        const targetRegion = userData.role === 'Central Office' ? coRegion : userData.region;
                                        
                                        // Filter unique divisions from CSV
                                        const regionDivisions = [...new Set(schoolData
                                            .filter(s => s.region === targetRegion)
                                            .map(s => s.division))]
                                            .sort();

                                        if (regionDivisions.length === 0) {
                                            return <p className="text-sm text-slate-400 italic">No division data available in Master List (CSV).</p>;
                                        }

                                        return (
                                            <div className="space-y-4">
                                                {regionDivisions.map((divName, idx) => {
                                                    // 2. Calculate Total Schools from CSV for this Division
                                                    const totalSchools = schoolData.filter(s => 
                                                        s.region === targetRegion && s.division === divName
                                                    ).length;

                                                    // 3. Get Completed Count from Backend Stats
                                                    // Find the matching entry in divisionStats array (Robust Matching)
                                                    const startStat = divisionStats.find(d => normalizeLocationName(d.division) === normalizeLocationName(divName));
                                                    const completedCount = startStat ? parseInt(startStat.completed_schools || 0) : 0;

                                                    // 4. Calculate Percentage
                                                    const percentage = totalSchools > 0 ? Math.round((completedCount / totalSchools) * 100) : 0;
                                                    
                                                    // Define colors for progress bars (cycling)
                                                    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500'];
                                                    const color = colors[idx % colors.length];

                                                    return (
                                                        <div 
                                                            key={divName} 
                                                            onClick={() => handleDivisionChange(divName)}
                                                            className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group"
                                                        >
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div>
                                                                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-blue-600 transition-colors">{divName}</h3>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                                                        {completedCount} out of {totalSchools} schools completed all forms
                                                                    </p>
                                                                </div>
                                                                <span className="text-lg font-black text-slate-700 dark:text-slate-200">{percentage}%</span>
                                                            </div>
                                                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full ${color} transition-all duration-1000`} 
                                                                    style={{ width: `${percentage}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        
                            {/* NEW: District Accomplishment Rate for SDO OR Central Office Division View */}
                            {/* SHOW FOR INSIGHTED ACCOMPLISHMENT TAB */}
                            {(activeTab === 'all' || activeTab === 'home' || activeTab === 'accomplishment') && 
                             (userData?.role === 'School Division Office' || (userData?.role === 'Central Office' && coDivision)) && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700 mt-6">
                                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Accomplishment Rate per District</h2>
                                    {(() => {
                                        const targetRegion = userData.role === 'Central Office' ? coRegion : userData.region;
                                        const targetDivision = userData.role === 'Central Office' ? coDivision : userData.division;
                                        
                                        // IF DISTRICT SELECTED: SHOW DRILL-DOWN
                                        if (coDistrict) {
                                            if (loadingDistrict) {
                                                return <div className="p-8 text-center text-slate-400 animate-pulse">Loading schools...</div>;
                                            }

                                            // Calculate Accomplishment Percentage for ALL Schools
                                            const schoolsWithStats = districtSchools.map(s => {
                                                const checks = [
                                                    s.profile_status, s.head_status, s.enrollment_status,
                                                    s.classes_status, s.personnel_status, s.specialization_status,
                                                    s.resources_status, s.shifting_status, s.learner_stats_status,
                                                    s.facilities_status
                                                ];
                                                const completedCount = checks.filter(Boolean).length;
                                                const totalChecks = 10;
                                                const percentage = Math.round((completedCount / totalChecks) * 100);
                                                
                                                // Identify missing for tooltip/subtitle if needed
                                                const missing = [];
                                                if (!s.profile_status) missing.push("Profile");
                                                if (!s.head_status) missing.push("School Head");
                                                if (!s.enrollment_status) missing.push("Enrollment");
                                                if (!s.classes_status) missing.push("Classes");
                                                if (!s.personnel_status) missing.push("Personnel");
                                                if (!s.specialization_status) missing.push("Specialization");
                                                if (!s.resources_status) missing.push("Resources");
                                                if (!s.shifting_status) missing.push("Modalities");
                                                if (!s.learner_stats_status) missing.push("Learner Stats");
                                                if (!s.facilities_status) missing.push("Facilities");

                                                return { ...s, percentage, missing };
                                            });

                                            // Sort State (Local to this block? No, better to be at component level, but for now lets default and allow toggle)
                                            // Since we are inside a render function (bad practice usually, but following existing pattern), 
                                            // we will use a simple sort based on a variable we can't easily change via state without moving specific state up.
                                            // Ideally, `sortOption` should be a state variable in the main component. 
                                            // I'll add `sortOption` to the main component state in a separate edit if needed, 
                                            // but to be safe and clean, I should declare `sortOption` at the top. 
                                            // FOR NOW: I'll assume I can add the state in the next step or use a default sort here and add UI controls.
                                            // Actually, the user asked for a sort feature. I must add state.
                                            // I will use a ref or just hardcode a default for this step and then add the state variable in `MonitoringDashboard` top level.
                                            
                                            // Let's modify the code to assume `schoolSort` state exists. I will add it in a subsequent tool call.
                                            const sortedSchools = [...schoolsWithStats].sort((a, b) => {
                                                 if (schoolSort === 'name-asc') return a.school_name.localeCompare(b.school_name);
                                                 if (schoolSort === 'pct-desc') return b.percentage - a.percentage;
                                                 if (schoolSort === 'pct-asc') return a.percentage - b.percentage;
                                                 return 0;
                                            });

                                            return (
                                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                                    {/* Header with Back Button */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <button 
                                                                onClick={() => handleDistrictChange('')}
                                                                className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 transition"
                                                            >
                                                                <FiArrowLeft size={18} className="text-slate-600 dark:text-slate-300" />
                                                            </button>
                                                            <div>
                                                                <h3 className="font-black text-xl text-slate-800 dark:text-white">{coDistrict}</h3>
                                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">School List</p>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Sort Controls */}
                                                        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                                                            <button 
                                                                onClick={() => setSchoolSort('name-asc')}
                                                                className={`p-1.5 rounded-md text-xs font-bold transition ${schoolSort === 'name-asc' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-400'}`}
                                                                title="Sort A-Z"
                                                            >
                                                                A-Z
                                                            </button>
                                                            <button 
                                                                onClick={() => setSchoolSort('pct-desc')}
                                                                className={`p-1.5 rounded-md text-xs font-bold transition ${schoolSort === 'pct-desc' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-300' : 'text-slate-400'}`}
                                                                title="Sort % High-Low"
                                                            >
                                                                % High
                                                            </button>
                                                            <button 
                                                                onClick={() => setSchoolSort('pct-asc')}
                                                                className={`p-1.5 rounded-md text-xs font-bold transition ${schoolSort === 'pct-asc' ? 'bg-white dark:bg-slate-600 shadow text-rose-600 dark:text-rose-300' : 'text-slate-400'}`}
                                                                title="Sort % Low-High"
                                                            >
                                                                % Low
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Unified School List */}
                                                    <div className="space-y-3">
                                                        {sortedSchools.map((s) => (
                                                            <div key={s.school_id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center group">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-blue-600 transition-colors">{s.school_name}</h4>
                                                                        {s.percentage === 100 && <FiCheckCircle className="text-emerald-500" size={14} />}
                                                                        {s.percentage === 0 && <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-md font-bold uppercase">No Data</span>}
                                                                    </div>
                                                                    
                                                                    <div className="mt-2 w-full max-w-[200px] h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                         <div 
                                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                                s.percentage === 100 ? 'bg-emerald-500' : 
                                                                                s.percentage >= 50 ? 'bg-blue-500' : 
                                                                                s.percentage > 0 ? 'bg-amber-500' : 'bg-slate-300'
                                                                            }`} 
                                                                            style={{ width: `${s.percentage}%` }}
                                                                         ></div>
                                                                    </div>
                                                                    
                                                                    {s.missing.length > 0 && s.missing.length < 10 && (
                                                                        <p className="text-[10px] text-slate-400 mt-1 truncate max-w-xs">
                                                                            Missing: {s.missing.join(', ')}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                
                                                                <div className="text-right">
                                                                    <span className={`text-xl font-black ${
                                                                        s.percentage === 100 ? 'text-emerald-500' : 
                                                                        s.percentage >= 50 ? 'text-blue-500' : 
                                                                        s.percentage > 0 ? 'text-amber-500' : 'text-slate-300'
                                                                    }`}>
                                                                        {s.percentage}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // DEFAULT: LIST OF DISTRICTS
                                        // 1. Get unique districts from CSV
                                        const divisionDistricts = [...new Set(schoolData
                                            .filter(s => s.region === targetRegion && s.division === targetDivision)
                                            .map(s => s.district))]
                                            .sort();
                                            
                                        if (divisionDistricts.length === 0) {
                                            return <p className="text-sm text-slate-400 italic">No district data available in Master List (CSV).</p>;
                                        }

                                        return (
                                            <div className="space-y-4">
                                                {divisionDistricts.map((distName, idx) => {
                                                    // 2. Count Total from CSV
                                                    const totalSchools = schoolData.filter(s => 
                                                        s.region === targetRegion && 
                                                        s.division === targetDivision && 
                                                        s.district === distName
                                                    ).length;

                                                    // 3. Count Completed from DB Stats
                                                    const startStat = districtStats.find(d => {
                                                        const match = normalizeLocationName(d.district) === normalizeLocationName(distName);
                                                        // Debug logging for the problematic district
                                                        if (distName.includes('Adams')) {
                                                            console.log(`[Dashboard Debug] Matching: '${distName}' -> '${normalizeLocationName(distName)}' vs API: '${d.district}' -> '${normalizeLocationName(d.district)}' = ${match}`);
                                                        }
                                                        return match;
                                                    });
                                                    
                                                    if (distName.includes('Adams') && !startStat) {
                                                        console.log("[Dashboard Debug] Failed to find stat match for:", distName, "Available Stats:", districtStats);
                                                    }

                                                    const completedCount = startStat ? parseInt(startStat.completed_schools || 0) : 0;

                                                    const percentage = totalSchools > 0 ? Math.round((completedCount / totalSchools) * 100) : 0;
                                                    
                                                    // Colors
                                                    const colors = ['bg-orange-500', 'bg-cyan-500', 'bg-lime-500', 'bg-fuchsia-500', 'bg-indigo-500'];
                                                    const color = colors[idx % colors.length];

                                                    return (
                                                         <div 
                                                            key={distName} 
                                                            onClick={() => handleDistrictChange(distName)}
                                                            className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group"
                                                         >
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div>
                                                                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-blue-600 transition-colors">{distName}</h3>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                                                        {completedCount} out of {totalSchools} schools completed all forms
                                                                    </p>
                                                                </div>
                                                                <span className="text-lg font-black text-slate-700 dark:text-slate-200">{percentage}%</span>
                                                            </div>
                                                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full ${color} transition-all duration-1000`} 
                                                                    style={{ width: `${percentage}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
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
                                                onClick={() => navigate(`/project-details/${project.id}`)}
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

                    {/* VALIDATION TAB (For SDO) */}
                    {activeTab === 'validation' && (
                        <div className="space-y-6">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Data Validation</h2>
                            
                            {/* School Validation Section */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
                                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">School Data Validation</h3>
                                <p className="text-sm text-slate-500 mb-4">Validate school profiles and submitted forms.</p>
                                <button
                                    onClick={() => navigate('/jurisdiction-schools')} 
                                    className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-blue-100 transition-colors"
                                >
                                    View Schools to Validate
                                </button>
                            </div>

                            {/* Infrastructure Validation Section */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
                                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Infrastructure Validation</h3>
                                <p className="text-sm text-slate-500 mb-4">Review and validate ongoing infrastructure projects.</p>
                                
                                {jurisdictionProjects.filter(p => p.validation_status !== 'Validated').length === 0 ? (
                                    <p className="text-center text-slate-400 text-sm py-4">No pending project validations.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {jurisdictionProjects
                                            .filter(p => p.validation_status !== 'Validated') // Show pending/rejected
                                            .map((project) => (
                                            <div
                                                key={project.id}
                                                onClick={() => navigate(`/project-validation?schoolId=${project.schoolId}`)}
                                                className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex justify-between items-center group"
                                            >
                                                <div>
                                                    <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-blue-600">{project.projectName}</h4>
                                                    <p className="text-[10px] text-slate-400 uppercase mt-0.5">{project.schoolName}</p>
                                                </div>
                                                <div className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase">
                                                    {project.validation_status || 'Pending'}
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
            {/* PROJECT LIST MODAL */}
            {projectListModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[1100] p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[80vh] flex flex-col rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white">{projectListModal.title}</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                                    {projectListModal.projects.length} Projects Found
                                </p>
                            </div>
                            <button 
                                onClick={() => setProjectListModal(prev => ({ ...prev, isOpen: false }))}
                                className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {projectListModal.isLoading ? (
                                <div className="flex justify-center py-10">
                                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {projectListModal.projects.map((p) => (
                                        <div key={p.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:border-blue-200 transition-colors">
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 transition-colors">{p.schoolName}</h4>
                                                <p className="text-xs text-slate-500 italic">{p.projectName}</p>
                                                {p.projectAllocation && (
                                                     <p className="text-[10px] font-mono text-slate-400 mt-1">
                                                        Alloc: ₱{Number(p.projectAllocation).toLocaleString()}
                                                     </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                 <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase mb-1 ${
                                                     p.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' :
                                                     p.status === 'Delayed' ? 'bg-rose-100 text-rose-600' :
                                                     'bg-blue-100 text-blue-600'
                                                 }`}>
                                                    {p.status}
                                                 </span>
                                                 <div className="text-xs font-black text-slate-700 dark:text-slate-300">
                                                    {p.accomplishmentPercentage}%
                                                 </div>
                                            </div>
                                        </div>
                                    ))}
                                    {projectListModal.projects.length === 0 && (
                                        <p className="text-center text-slate-400 italic py-10">No projects found for this category.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </PageTransition>
    );
};

export default MonitoringDashboard;
