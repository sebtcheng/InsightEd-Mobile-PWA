import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbTrophy, TbArrowLeft, TbMap2, TbMedal, TbSearch } from "react-icons/tb";
import { auth } from '../firebase';
import PageTransition from '../components/PageTransition';
import MyRankFooter from './MyRankFooter';

const Leaderboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // 1. CHANGED: Default tab is now 'regions'
    const [activeTab, setActiveTab] = useState('regions');
    const [data, setData] = useState({ divisions: [], regions: [] });
    const [userScope, setUserScope] = useState(null);
    const [currentUserRegion, setCurrentUserRegion] = useState(null);
    const [currentUserDivision, setCurrentUserDivision] = useState(null);
    const [currentSchoolId, setCurrentSchoolId] = useState(null); // To highlight current user
    const [myRankData, setMyRankData] = useState(null); // Store user's rank info
    const [showStickyFooter, setShowStickyFooter] = useState(false); // Toggle footer visibility

    // 2. CHANGED: Search now filters divisions/regions
    const [search, setSearch] = useState('');

    useEffect(() => {
        const init = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                // Fetch basic user context to know their region
                const headRes = await fetch(`/api/school-head/${user.uid}`);
                const headJson = await headRes.json();

                let regionFilter = 'Region VIII'; // Default fallback

                if (headJson.exists) {
                    setCurrentUserRegion(headJson.data.region);
                    // Store division if school head to restrict view
                    setCurrentUserDivision(headJson.data.division);
                    setCurrentSchoolId(headJson.data.school_id); // Save ID for highlighting
                    regionFilter = headJson.data.region;
                } else {
                    const savedRole = localStorage.getItem('userRole');
                    if (savedRole === 'Regional Office') {
                        regionFilter = 'Region VIII';
                    }
                }

                setCurrentUserRegion(regionFilter);

                // Initial Fetch: Regions (Default)
                await fetchTab('regions', regionFilter);

            } catch (err) {
                console.error("Leaderboard init error:", err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleTabChange = async (tab) => {
        setActiveTab(tab);
        setSearch(''); // Clear search on tab switch
        // If switching back to divisions/regions, clear specific school data to save memory/avoid confusion
        if (tab !== 'schools') {
            await fetchTab(tab, currentUserRegion);
        }
    };

    const handleDivisionClick = async (divisionName) => {
        setActiveTab('schools');
        setSearch('');
        setLoading(true);
        try {
            const url = `/api/leaderboard?scope=division&filter=${encodeURIComponent(divisionName)}`;
            setUserScope(`${divisionName} Schools`);
            const res = await fetch(url);
            const json = await res.json();
            setData(prev => ({ ...prev, schools: json.schools })); // Keep others? actually maybe just overwrite or separate
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchTab = async (tab, regionOverride) => {
        setLoading(true);
        try {
            let url = '';

            if (tab === 'regions') {
                // National View: Fetch all regions
                url = `/api/leaderboard?scope=national`;
                setUserScope('National');
            } else {
                // Divisions View: 
                // If a region is specified (Drill-down or User's Region), show divisions for that region
                if (regionOverride) {
                    url = `/api/leaderboard?scope=region&filter=${encodeURIComponent(regionOverride)}`;
                    setUserScope(regionOverride);
                } else {
                    // Fallback: Fetch ALL divisions (National)
                    url = `/api/leaderboard?scope=national_divisions`;
                    setUserScope('National');
                }
            }

            const res = await fetch(url);
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error("Fetch tab error:", e);
        } finally {
            setLoading(false);
        }
    }

    const getMedalColor = (index) => {
        if (index === 0) return 'text-yellow-500';
        if (index === 1) return 'text-slate-400';
        if (index === 2) return 'text-amber-700';
        return 'text-slate-300 opacity-50';
    };

    // 3. CHANGED: Generic filtering logic
    const getFilteredList = () => {
        if (activeTab === 'schools') {
            return (data.schools || []).filter(s => s.school_name.toLowerCase().includes(search.toLowerCase()));
        }

        let list = activeTab === 'divisions' ? data.divisions : data.regions;
        if (!list) return [];

        // RESTRICTION: If user is a School Head (has currentUserDivision) and looking at divisions,
        // ONLY show their division.
        if (activeTab === 'divisions' && currentUserDivision) {
            list = list.filter(d => d.name === currentUserDivision);
        }

        return list.filter(item =>
            (item.name || '').toLowerCase().includes(search.toLowerCase())
        );
    };

    const displayList = getFilteredList();

    // Intersection Observer for Sticky Footer
    // We want to verify if the user's row is visible. 
    // Effect to update MyRankData when data changes
    useEffect(() => {
        const schools = data.schools || [];
        if (currentSchoolId && schools.length > 0) {
            const index = schools.findIndex(s => s.school_id === currentSchoolId);
            if (index !== -1) {
                setMyRankData({
                    rank: index + 1,
                    ...schools[index]
                });
            } else {
                setMyRankData(null);
            }
        }
    }, [data.schools, currentSchoolId]);

    // Ref for the user's row
    const userRowRef = React.useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                // If user row is NOT intersecting (not visible), show sticky footer
                setShowStickyFooter(!entry.isIntersecting);
            },
            { threshold: 0.1 } // Trigger as soon as 10% is visible
        );

        if (userRowRef.current) {
            observer.observe(userRowRef.current);
        } else {
            if (myRankData) setShowStickyFooter(true);
        }

        return () => {
            if (userRowRef.current) observer.unobserve(userRowRef.current);
        };
    }, [data.schools, myRankData, activeTab]);

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 relative pb-20">
                {/* Header */}
                <div className="bg-[#004A99] px-6 pt-12 pb-20 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between text-white mb-2">
                            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors">
                                <TbArrowLeft size={24} />
                            </button>
                            <div className="flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                                <TbTrophy size={18} className="text-yellow-400" />
                                <span className="text-xs font-bold tracking-wide uppercase">Leaderboard</span>
                            </div>
                            <div className="w-8"></div>
                        </div>
                        <h1 className="text-2xl font-bold text-white text-center mt-2">Top Performers</h1>
                        <p className="text-blue-200 text-center text-xs opacity-80 mb-6">{userScope || 'Loading...'}</p>

                        {/* Search Bar */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 flex items-center border border-white/10 shadow-inner shadow-black/10 max-w-sm mx-auto">
                            <TbSearch className="text-blue-200 ml-1" size={18} />
                            <input
                                type="text"
                                placeholder={`Search ${activeTab}...`}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-transparent border-none text-white placeholder-blue-200/50 text-sm w-full focus:outline-none px-3 font-medium"
                            />
                        </div>
                    </div>
                </div>

                {/* Tabs - Reduced to 2 */}
                <div className="flex justify-center -mt-8 relative z-20 px-4 mb-6">
                    <div className="bg-white p-1 rounded-full shadow-lg flex w-full max-w-[200px]">
                        <button
                            onClick={() => handleTabChange('regions')}
                            className={`flex-1 py-2 px-2 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'regions' ? 'bg-[#004A99] text-white shadow-md' : 'text-slate-500'}`}
                        >
                            Regions
                        </button>
                        <button
                            onClick={() => handleTabChange('divisions')}
                            className={`flex-1 py-2 px-2 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'divisions' ? 'bg-[#004A99] text-white shadow-md' : 'text-slate-500'}`}
                        >
                            Divisions
                        </button>
                    </div>
                </div>

                {/* List Content */}
                <div className="px-5 relative z-10 space-y-4">
                    {loading ? (
                        <div className="text-center py-10 text-slate-400 text-sm">Loading rankings...</div>
                    ) : (
                        <>
                            {activeTab === 'schools' ? (
                                /* SCHOOLS RENDER LOGIC */
                                displayList.length > 0 ? displayList.map((item, index) => {
                                    const isMe = item.school_id === currentSchoolId; // logic for highlight
                                    return (
                                        <div
                                            key={item.school_id}
                                            ref={isMe ? userRowRef : null}
                                            className={`bg-white p-4 rounded-2xl shadow-sm border flex items-center gap-4 relative overflow-hidden transition-all ${isMe ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 z-10 scale-[1.01]' : 'border-slate-100'}`}
                                        >
                                            <div className={`text-2xl font-black italic ${getMedalColor(index)} w-8 text-center shrink-0`}>
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <h3 className={`font-bold text-sm truncate pr-2 ${isMe ? 'text-blue-800' : 'text-slate-800'}`}>
                                                        {item.school_name} {isMe && <span className="ml-1 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase align-middle">You</span>}
                                                    </h3>
                                                    <span className="font-bold text-[#004A99] text-sm">{Math.round(item.completion_rate)}%</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                                                    <TbMap2 size={12} />
                                                    {item.division}
                                                </div>
                                                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                                    <div
                                                        className="bg-gradient-to-r from-blue-400 to-[#004A99] h-full rounded-full"
                                                        style={{ width: `${item.completion_rate}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                            {index < 3 && (
                                                <div className="absolute -top-1 -right-1">
                                                    <TbMedal className={`${getMedalColor(index)} opacity-20 rotate-12`} size={40} />
                                                </div>
                                            )}
                                        </div>
                                    )
                                }) : <div className="text-center text-slate-400 py-10">No schools found</div>
                            ) : (
                                /* DIVISIONS / REGIONS RENDER LOGIC */
                                displayList.length > 0 ? displayList.map((item, index) => {
                                    const isMe = activeTab === 'regions'
                                        ? item.name === currentUserRegion
                                        : item.name === currentUserDivision;

                                    return (
                                        <div
                                            key={item.name}
                                            onClick={() => {
                                                if (activeTab === 'regions') {
                                                    // Drill down to division
                                                    setCurrentUserRegion(item.name);
                                                    setActiveTab('divisions');
                                                    fetchTab('divisions', item.name);
                                                } else {
                                                    handleDivisionClick(item.name);
                                                }
                                            }}
                                            className={`bg-white p-5 rounded-2xl shadow-sm border flex items-center gap-4 relative overflow-hidden group hover:border-blue-200 transition-colors cursor-pointer active:scale-[0.98] ${isMe ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 z-10 scale-[1.01]' : 'border-slate-100'}`}
                                        >
                                            {/* Rank Number */}
                                            <div className={`text-2xl font-black italic ${getMedalColor(index)} w-8 text-center shrink-0`}>
                                                {index + 1}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h3 className={`font-bold text-sm truncate pr-2 ${isMe ? 'text-blue-800' : 'text-slate-800'}`}>
                                                        {item.name} {isMe && <span className="ml-1 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase align-middle">You</span>}
                                                    </h3>
                                                    <span className={`px-2 py-0.5 rounded-lg text-xs font-black border ${activeTab === 'regions' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                        {item.avg_completion}%
                                                    </span>
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full bg-gradient-to-r ${activeTab === 'regions' ? 'from-emerald-400 to-teal-600' : 'from-blue-400 to-indigo-600'}`}
                                                        style={{ width: `${item.avg_completion}%` }}
                                                    ></div>
                                                </div>

                                                {/* NEW HELPER TEXT */}
                                                <p className="text-[10px] text-blue-400 mt-3 font-medium flex items-center gap-1 opacity-80">
                                                    {activeTab === 'regions' ? '👆 Tap to see Divisions' : '👆 Tap to see Schools'}
                                                </p>
                                            </div>

                                            {/* Medal Icon for Top 3 */}
                                            {index < 3 && (
                                                <TbMedal className={`${getMedalColor(index)} opacity-10 absolute -right-4 -top-2 rotate-12`} size={80} />
                                            )}
                                        </div>
                                    );
                                }) : (
                                    <div className="text-center py-10 text-slate-400 text-xs">
                                        No {activeTab} found matching "{search}"
                                    </div>
                                )
                            )}
                        </>
                    )}
                </div>

                {/* Sticky "My Rank" Footer */}
                {activeTab === 'schools' && myRankData && showStickyFooter && (
                    <MyRankFooter
                        rank={myRankData.rank}
                        schoolName={myRankData.school_name}
                        score={myRankData.completion_rate}
                        medalColor={getMedalColor(myRankData.rank - 1)}
                    />
                )}
            </div>
        </PageTransition >
    );
};

export default Leaderboard;