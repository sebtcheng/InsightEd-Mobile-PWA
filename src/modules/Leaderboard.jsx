import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbTrophy, TbArrowLeft, TbBuildingSkyscraper, TbMap2, TbMedal, TbSearch } from "react-icons/tb";
import { auth } from '../firebase';
import PageTransition from '../components/PageTransition';

const Leaderboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('schools'); // 'schools' or 'divisions'
    const [data, setData] = useState({ schools: [], divisions: [] });
    const [userRole, setUserRole] = useState(null);
    const [userScope, setUserScope] = useState(null); // The region or division name
    const [currentUserRegion, setCurrentUserRegion] = useState(null);
    const [currentUserDivision, setCurrentUserDivision] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const init = async () => {
            const user = auth.currentUser;
            if (!user) return;

            // Determine Scope based on functionality context (simulated here since we don't have a rigid role context provider yet)
            // We'll fetch the user's profile to see their assigned region/division
            try {
                // Try School Head profile first
                const headRes = await fetch(`/api/school-head/${user.uid}`);
                const headJson = await headRes.json();

                let scope = '';
                let filter = '';
                let role = 'School Head';

                if (headJson.exists) {
                    // School Head -> View their Division
                    scope = 'division';
                    filter = headJson.data.division; // Assuming head_division exists from schema
                    setUserScope(filter);
                } else {
                    // Try to infer from localStorage or simplified logic for RO/SDO
                    const savedRole = localStorage.getItem('userRole');
                    role = savedRole;
                    // For demo/hackathon purposes, we might need to fetch the specific RO/SDO profile
                    // But for now, let's assume if role is 'Regional Office', we show Region VIII
                    if (savedRole === 'Regional Office') {
                        scope = 'region';
                        filter = 'Region VIII'; // Hardcoded for this region as per context likely
                        setUserScope(filter);
                    } else if (savedRole === 'School Division Office') {
                        scope = 'division';
                        // Ideally strictly fetched, but for now we might need to ask or default
                        filter = 'Leyte'; // Placeholder default or fetch from separate profile table if exists
                        setUserScope(filter);
                    }
                }

                if (headJson.exists) {
                    setCurrentUserRegion(headJson.data.region || 'Region VIII');
                    setCurrentUserDivision(headJson.data.division || 'Leyte');
                } else {
                    // Defaults for demo
                    setCurrentUserRegion('Region VIII');
                    setCurrentUserDivision('Leyte');
                }

                setUserRole(role);

                // Fetch Leaderboard Data
                if (filter) {
                    const res = await fetch(`/api/leaderboard?scope=${scope}&filter=${encodeURIComponent(filter)}`);
                    const json = await res.json();
                    setData(json);
                }

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
        setLoading(true);
        try {
            let url = '';
            if (tab === 'regions') {
                url = `/api/leaderboard?scope=national`;
                setUserScope('National');
            } else if (tab === 'divisions') {
                url = `/api/leaderboard?scope=region&filter=${encodeURIComponent(currentUserRegion || 'Region VIII')}`;
                setUserScope(currentUserRegion || 'Region VIII');
            } else {
                // Schools - default to division view for School Heads, but let's allow Region view for RO
                if (userRole === 'Regional Office') {
                    url = `/api/leaderboard?scope=region&filter=${encodeURIComponent(currentUserRegion || 'Region VIII')}`;
                    setUserScope(currentUserRegion || 'Region VIII');
                } else {
                    url = `/api/leaderboard?scope=division&filter=${encodeURIComponent(currentUserDivision || 'Leyte')}`;
                    setUserScope(currentUserDivision || 'Leyte');
                }
            }

            const res = await fetch(url);
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error("Tab switch error:", err);
        } finally {
            setLoading(false);
        }
    };

    const getMedalColor = (index) => {
        if (index === 0) return 'text-yellow-500';
        if (index === 1) return 'text-slate-400';
        if (index === 2) return 'text-amber-700';
        return 'text-slate-300 opacity-50';
    };

    const sortedSchools = data.schools ? data.schools.filter(s => s.school_name.toLowerCase().includes(search.toLowerCase())) : [];

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 relative pb-20">
                {/* Header */}
                <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
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
                            <div className="w-8"></div> {/* Spacer */}
                        </div>
                        <h1 className="text-2xl font-bold text-white text-center mt-2">Top Performers</h1>
                        <p className="text-blue-200 text-center text-xs opacity-80 mb-6">{userScope ? `${userScope} Rankings` : 'Loading scope...'}</p>

                        {/* Search */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2 flex items-center border border-white/10">
                            <TbSearch className="text-blue-200 ml-2" size={20} />
                            <input
                                type="text"
                                placeholder="Search schools..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-transparent border-none text-white placeholder-blue-200/50 text-sm w-full focus:outline-none px-3"
                            />
                        </div>
                    </div>
                </div>

                {/* Scope Tabs (Visible for everyone now to allow National View) */}
                <div className="flex justify-center -mt-8 relative z-20 px-4 mb-6">
                    <div className="bg-white p-1 rounded-full shadow-lg flex w-full max-w-sm overflow-x-auto">
                        <button
                            onClick={() => handleTabChange('schools')}
                            className={`flex-1 py-2 px-2 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'schools' ? 'bg-[#004A99] text-white shadow-md' : 'text-slate-500'}`}
                        >
                            Schools
                        </button>
                        <button
                            onClick={() => handleTabChange('divisions')}
                            className={`flex-1 py-2 px-2 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'divisions' ? 'bg-[#004A99] text-white shadow-md' : 'text-slate-500'}`}
                        >
                            Divisions
                        </button>
                        <button
                            onClick={() => handleTabChange('regions')}
                            className={`flex-1 py-2 px-2 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'regions' ? 'bg-[#004A99] text-white shadow-md' : 'text-slate-500'}`}
                        >
                            Regions
                        </button>
                    </div>
                </div>

                {/* List Content */}
                <div className={`px-5 relative z-10 ${userRole !== 'Regional Office' ? '-mt-12' : ''} space-y-4`}>
                    {loading ? (
                        <div className="text-center py-10 text-slate-400 text-sm">Loading rankings...</div>
                    ) : (
                        <>
                            {activeTab === 'schools' && sortedSchools.map((item, index) => (
                                <div key={item.school_id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 relative overflow-hidden">
                                    {/* Rank Badge */}
                                    <div className={`text-2xl font-black italic ${getMedalColor(index)} w-8 text-center shrink-0`}>
                                        {index + 1}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-slate-800 text-sm truncate pr-2">{item.school_name}</h3>
                                            <span className="font-bold text-[#004A99] text-sm">{Math.round(item.completion_rate)}%</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                                            <TbMap2 size={12} />
                                            {item.division}
                                        </div>

                                        {/* Progress Bar */}
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
                            ))}

                            {activeTab === 'divisions' && data.divisions && data.divisions.map((item, index) => (
                                <div key={item.name} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                                    <div className={`text-2xl font-black italic ${getMedalColor(index)} w-8 text-center shrink-0`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <h3 className="font-bold text-slate-800">{item.name}</h3>
                                            <span className="font-bold text-[#004A99]">{item.avg_completion}%</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">Average Completion Rate</p>
                                        <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-purple-500 to-blue-600 h-full rounded-full"
                                                style={{ width: `${item.avg_completion}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}


                            {activeTab === 'regions' && data.regions && data.regions.map((item, index) => (
                                <div key={item.name} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                                    <div className={`text-2xl font-black italic ${getMedalColor(index)} w-8 text-center shrink-0`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <h3 className="font-bold text-slate-800">{item.name}</h3>
                                            <span className="font-bold text-[#004A99]">{item.avg_completion}%</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">Average Completion Rate</p>
                                        <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full"
                                                style={{ width: `${item.avg_completion}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </PageTransition >
    );
};

export default Leaderboard;
