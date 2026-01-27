import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiTrendingUp, FiCheckCircle, FiClock, FiFileText, FiMapPin } from 'react-icons/fi';
import { TbTrophy } from 'react-icons/tb';

import Papa from 'papaparse';

const MonitoringDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [userData, setUserData] = useState(null);
    const [stats, setStats] = useState(null);
    const [engStats, setEngStats] = useState(null);
    const [jurisdictionProjects, setJurisdictionProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');

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
                ...(queryDivision && { division: queryDivision }),
                ...(coDistrict && { district: coDistrict }) // Add District param
            });

            const fetchPromises = [
                fetch(`/api/monitoring/stats?${params.toString()}`),
                fetch(`/api/monitoring/engineer-stats?${params.toString()}`),
                fetch(`/api/monitoring/engineer-projects?${params.toString()}`)
            ];

            // Fetch Division Stats only for Regional Office
            if (currentUserData.role === 'Regional Office') {
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

    // NEW: Store Aggregated CSV Totals
    const [csvRegionalTotals, setCsvRegionalTotals] = useState({});

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
            // Optional: Clear state so it doesn't persist on refresh if undesirable, 
            // but for now keeping it is fine.
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
    
    const handleDistrictChange = (district) => {
        setCoDistrict(district);
        // Force fetch with current Filters + new District State
        // Since fetchData reads coDistrict state directly if not overridden, 
        // we might need to rely on the state update or pass it explicit.
        // But fetchData uses state `coDivision` which is set.
        // It uses `coDistrict` state which might not be updated yet in closure?
        // Actually fetchData creates params. Let's make sure it picks up the NEW district.
        // Best approach: Add params to fetchData signature or rely on effect? 
        // Current fetchData signature is `(overrideRegion, overrideDivision)`.
        // Let's modify fetchData slightly to read state, but state updates are async.
        
        // Simpler: Just set state, and use a useEffect to trigger fetch? 
        // OR pass it explicitly.
        
        // Let's rely on re-render? No, explicit is better.
        // But `fetchData` function doesn't take district arg. 
        // Let's trust that the next render cycle or a small timeout works, 
        // OR better: Just put `coDistrict` in a useEffect dependency for fetching.
        // But `fetchData` is called manually in handlers.
        
        // Quick Fix: Update state then call logic. But we need the value *now*.
        // Let's update `fetchData` to accept optional `overrideDistrict`? No, too messy.
        // Let's just update state and let a `useEffect` handle it? 
        // actually `fetchData` is called in `useEffect` on mount.
        // Let's add a `useEffect(() => { fetchData() }, [coDistrict])`?
        // That might cause double fetches if other things change.
        
        // Let's just do this:
        setTimeout(() => fetchData(), 0); 
    };
    
    // Better: Add useEffect for Filters
    useEffect(() => {
        if(userData?.role === 'Central Office' && (coDistrict || coDivision || coRegion)) {
             fetchData();
        }
    }, [coDistrict]); // Only trigger when district changes for now to avoid loops with other handlers

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
                                    <p className="text-blue-200 text-lg font-medium mt-1">National Overview & Strategic Monitoring</p>
                                </div>
                                <div className="hidden md:block text-right">
                                    <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">Current Scope</p>
                                    <p className="text-2xl font-bold">Philippines (National)</p>
                                </div>
                            </div>

                            {/* Global Quick Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                    <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Total Schools</p>
                                    <p className="text-3xl font-black mt-1">
                                        {/* Sum of CSV Totals if available, else backend stats */}
                                        {Object.values(csvRegionalTotals).length > 0 
                                            ? Object.values(csvRegionalTotals).reduce((a, b) => a + b, 0).toLocaleString()
                                            : regionalStats.reduce((acc, curr) => acc + parseInt(curr.total_schools || 0), 0).toLocaleString()
                                        }
                                    </p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                    <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Forms Completed</p>
                                    {/* Show Percentage */}
                                    {(() => {
                                        const totalSchools = Object.values(csvRegionalTotals).length > 0 
                                            ? Object.values(csvRegionalTotals).reduce((a, b) => a + b, 0)
                                            : regionalStats.reduce((acc, curr) => acc + parseInt(curr.total_schools || 0), 0);
                                        const completed = regionalStats.reduce((acc, curr) => acc + parseInt(curr.completed_schools || 0), 0);
                                        const pct = totalSchools > 0 ? ((completed / totalSchools) * 100).toFixed(1) : 0;
                                        return (
                                             <div>
                                                <p className="text-3xl font-black mt-1">{pct}%</p>
                                                <p className="text-[10px] opacity-70">{completed.toLocaleString()} / {totalSchools.toLocaleString()}</p>
                                             </div>
                                        );
                                    })()}
                                </div>
                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                    <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Total Projects</p>
                                    <p className="text-3xl font-black mt-1">{regionalStats.reduce((acc, curr) => acc + parseInt(curr.total_projects || 0), 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                    <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider">Active Projects</p>
                                    <p className="text-3xl font-black mt-1 text-emerald-300">{regionalStats.reduce((acc, curr) => acc + parseInt(curr.ongoing_projects || 0), 0).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="max-w-7xl mx-auto px-6 -mt-20 space-y-12 relative z-20 pb-20">
                         {regionalStats.length === 0 ? (
                            <div className="bg-white p-8 rounded-3xl text-center text-slate-400">Loading regional stats...</div>
                         ) : (
                            <>
                                {/* SECTION 1: REGIONAL PERFORMANCE (SCHOOL DATA) */}
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
                                                                <p className="text-xs font-bold text-slate-400 uppercase mt-1">{totalSchools.toLocaleString()} Schools</p>
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

                                {/* SECTION 2: INFRASTRUCTURE PROJECTS MATRIX */}
                                <div>
                                    <h2 className="text-black/60 dark:text-white/60 text-xs font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                        <FiTrendingUp className="text-emerald-500" /> Infrastructure Projects Matrix
                                    </h2>
                                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                                                        <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Region</th>
                                                        <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider text-center">Total Projects</th>
                                                        <th className="p-6 text-xs font-black text-emerald-500 uppercase tracking-wider text-center bg-emerald-50/50 dark:bg-emerald-900/10">Ongoing</th>
                                                        <th className="p-6 text-xs font-black text-blue-500 uppercase tracking-wider text-center">Completed</th>
                                                        <th className="p-6 text-xs font-black text-red-500 uppercase tracking-wider text-center bg-red-50/50 dark:bg-red-900/10">Delayed</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                    {regionalStats.map((reg, idx) => (
                                                        <tr 
                                                            key={idx} 
                                                            onClick={() => handleFilterChange(reg.region)}
                                                            className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                                                        >
                                                            <td className="p-6 font-bold text-slate-700 dark:text-slate-200">{reg.region}</td>
                                                            <td className="p-6 text-center font-bold text-slate-800 dark:text-white text-lg">{reg.total_projects}</td>
                                                            <td className="p-6 text-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/5">{reg.ongoing_projects}</td>
                                                            <td className="p-6 text-center font-bold text-blue-600 dark:text-blue-400">{reg.completed_projects}</td>
                                                            <td className="p-6 text-center font-bold text-red-600 dark:text-red-400 bg-red-50/30 dark:bg-red-900/5">{reg.delayed_projects}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </>
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

                                    {/* District Filter */}
                                    {coDivision && (
                                        <select 
                                            className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none focus:bg-white/20 text-slate-800 disabled:opacity-50"
                                            onChange={(e) => handleDistrictChange(e.target.value)}
                                            value={coDistrict}
                                        >
                                            <option value="" className="text-slate-800">All Districts</option>
                                            {availableDistricts.map(dist => (
                                                <option key={dist} value={dist} className="text-slate-800">{dist}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <h1 className="text-3xl font-black tracking-tight">{userData.bureau || 'Central Office'}</h1>
                                <p className="text-blue-100/70 text-sm mt-1">
                                    {coDistrict ? `${coDistrict}, ${coDivision}` : (coDivision ? `${coDivision} Division` : (coRegion ? `${coRegion}` : 'National View'))}
                                </p>
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

                            {/* Accomplishment Rate per School Division (Regional Office Only OR Central Office Regional View) */}
                            {(userData?.role === 'Regional Office' || (userData?.role === 'Central Office' && coRegion && !coDivision)) && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
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
                                                    // Find the matching entry in divisionStats array
                                                    const startStat = divisionStats.find(d => d.division === divName);
                                                    const completedCount = startStat ? parseInt(startStat.completed_schools || 0) : 0;

                                                    // 4. Calculate Percentage
                                                    const percentage = totalSchools > 0 ? Math.round((completedCount / totalSchools) * 100) : 0;
                                                    
                                                    // Define colors for progress bars (cycling)
                                                    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500'];
                                                    const color = colors[idx % colors.length];

                                                    return (
                                                        <div key={divName} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div>
                                                                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{divName}</h3>
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
                            {(userData?.role === 'School Division Office' || (userData?.role === 'Central Office' && coDivision && !coDistrict)) && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700 mt-6">
                                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Accomplishment Rate per District</h2>
                                    {(() => {
                                        const targetRegion = userData.role === 'Central Office' ? coRegion : userData.region;
                                        const targetDivision = userData.role === 'Central Office' ? coDivision : userData.division;
                                        
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
                                                    const startStat = districtStats.find(d => d.district === distName);
                                                    const completedCount = startStat ? parseInt(startStat.completed_schools || 0) : 0;

                                                    const percentage = totalSchools > 0 ? Math.round((completedCount / totalSchools) * 100) : 0;
                                                    
                                                    // Colors
                                                    const colors = ['bg-orange-500', 'bg-cyan-500', 'bg-lime-500', 'bg-fuchsia-500', 'bg-indigo-500'];
                                                    const color = colors[idx % colors.length];

                                                    return (
                                                         <div key={distName} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div>
                                                                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{distName}</h3>
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
