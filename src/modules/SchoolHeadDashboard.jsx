// src/modules/SchoolHeadDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

// Icons (Using the libraries you already have installed)
import { TbSearch, TbX, TbChevronRight, TbSchool, TbUsers, TbBooks, TbActivity, TbBell, TbTrophy, TbReportAnalytics } from "react-icons/tb";
import { LuLayoutDashboard, LuFileCheck, LuHistory } from "react-icons/lu";
import { FiUser, FiBox, FiLayers } from "react-icons/fi";

import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";

import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import NotificationCenter from '../components/NotificationCenter';

const SchoolHeadDashboard = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('School Head');
    const [schoolProfile, setSchoolProfile] = useState(null);
    const [headProfile, setHeadProfile] = useState(null);

    // Stats State
    const [stats, setStats] = useState({
        completedForms: 0,
        totalForms: 10,
        enrollment: 0,
        teachers: 0
    });

    // --- SEARCH STATE ---
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    // --- SEARCH & QUICK ACTION ITEMS (10 FORMS) ---
    const SEARCHABLE_ITEMS = [
        // IDENTITY
        { name: "School Profile", route: "/school-profile", icon: TbSchool, color: "bg-blue-100 text-blue-600" },
        { name: "School Head Info", route: "/school-information", icon: FiUser, color: "bg-indigo-100 text-indigo-600" },

        // LEARNERS
        { name: "Enrollment", route: "/enrolment", icon: TbUsers, color: "bg-orange-100 text-orange-600" },
        { name: "Organized Classes", route: "/organized-classes", icon: FiLayers, color: "bg-purple-100 text-purple-600" },
        { name: "Learner Statistics", route: "/learner-statistics", icon: TbActivity, color: "bg-pink-100 text-pink-600" },
        { name: "Shifting & Modality", route: "/shifting-modalities", icon: TbReportAnalytics, color: "bg-cyan-100 text-cyan-600" },

        // FACULTY
        { name: "Teaching Personnel", route: "/teaching-personnel", icon: FiUser, color: "bg-teal-100 text-teal-600" },
        { name: "Specialization", route: "/teacher-specialization", icon: FiLayers, color: "bg-lime-100 text-lime-600" },

        // ASSETS
        { name: "School Resources", route: "/school-resources", icon: FiBox, color: "bg-emerald-100 text-emerald-600" },
        { name: "Physical Facilities", route: "/physical-facilities", icon: FiLayers, color: "bg-amber-100 text-amber-600" },
    ];

    // Reuse SEARCHABLE_ITEMS for search logic to keep them in sync
    const ALL_ITEMS = SEARCHABLE_ITEMS;

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (query.trim() === '') {
            setSearchResults([]);
            return;
        }

        const filtered = ALL_ITEMS.filter(item =>
            item.name.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(filtered);
    };

    // ... [Keep your useEffects for Stats/Auth exactly as they were] ...
    useEffect(() => {
        if (!schoolProfile) return;
        let completed = 0;
        // Helper to check if any field with prefix has value > 0
        const hasData = (prefix, type = 'number') => {
            return Object.keys(schoolProfile).some(key => {
                if (!key.startsWith(prefix)) return false;
                const val = schoolProfile[key];
                if (type === 'number') return val > 0;
                return val && val !== '' && val !== 'null';
            });
        };

        if (schoolProfile.school_id) completed++; // 1. Profile
        if (schoolProfile.head_last_name && schoolProfile.head_last_name.trim() !== '') completed++; // 2. Head Info
        if (schoolProfile.total_enrollment > 0) completed++; // 3. Enrollment

        // 4. Classes
        const totalClasses = (schoolProfile.classes_kinder || 0) + (schoolProfile.classes_grade_1 || 0) + (schoolProfile.classes_grade_6 || 0) + (schoolProfile.classes_grade_10 || 0) + (schoolProfile.classes_grade_12 || 0);
        if (totalClasses > 0) completed++;

        // 5. Learner Stats
        if (hasData('stat_', 'number')) completed++;

        // 6. Shifting
        const hasShift = (schoolProfile.shift_kinder || schoolProfile.shift_g1) || (schoolProfile.adm_mdl || schoolProfile.adm_odl);
        if (hasShift) completed++;

        // 7. Teaching Personnel
        const totalTeachers = (schoolProfile.teach_kinder || 0) + (schoolProfile.teach_g1 || 0) + (schoolProfile.teach_g6 || 0) + (schoolProfile.teach_g10 || 0) + (schoolProfile.teach_g12 || 0);
        if (totalTeachers > 0) completed++;

        // 8. Specialization
        if (hasData('spec_', 'number')) completed++;

        // 9. Resources
        const hasResources = hasData('res_', 'number') || (schoolProfile.res_water_source && schoolProfile.res_water_source !== '');
        if (hasResources) completed++;

        // 10. Physical Facilities
        if (hasData('build_', 'number') || hasData('pf_', 'number')) completed++;

        setStats(prev => ({
            ...prev,
            completedForms: completed,
            enrollment: schoolProfile.total_enrollment || 0
        }));
    }, [schoolProfile]);

    const [searchParams] = useSearchParams(); // Get query params
    const impersonatedUid = searchParams.get('uid');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setUserName(userData.firstName);

                        let targetUid = user.uid;
                        // Impersonation Logic
                        if (userData.role === 'Super User' && impersonatedUid) {
                            targetUid = impersonatedUid;
                            setUserName(`Super User (Viewing: ${targetUid.slice(0, 5)}...)`); // Optional: indicate view mode
                        }

                        const profileRes = await fetch(`/api/school-by-user/${targetUid}`);
                        const profileJson = await profileRes.json();
                        if (profileJson.exists) setSchoolProfile(profileJson.data);

                        const headRes = await fetch(`/api/school-head/${targetUid}`);
                        const headJson = await headRes.json();
                        if (headJson.exists) setHeadProfile(headJson.data);
                    }

                } catch (error) {
                    console.error("Dashboard Load Error:", error);
                }
                setTimeout(() => setLoading(false), 800);
            } else {
                // Not authenticated, redirect to login
                navigate('/');
            }
        });
        return () => unsubscribe();
    }, [impersonatedUid]); // Re-run if query param changes

    const { completedForms, totalForms } = stats;
    const progress = totalForms > 0 ? Math.round((completedForms / totalForms) * 100) : 0;

    return (
        <>
            <PageTransition>
                <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-28 relative">

                    {/* --- HEADER SECTION --- */}
                    <div className="relative bg-[#004A99] pt-14 pb-20 px-6 rounded-b-[3rem] shadow-2xl z-0 overflow-hidden">
                        {impersonatedUid && (
                            <div className="absolute top-6 right-6 z-50">
                                <button
                                    onClick={() => navigate('/super-admin')}
                                    className="px-3 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg text-xs font-bold text-white transition"
                                >
                                    ← Back to Hub
                                </button>
                            </div>
                        )}
                        {/* Background Decorative Circles */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>

                        <div className="relative flex justify-between items-start z-10">
                            <div>
                                <div className="inline-flex items-center gap-2 bg-blue-800/50 px-3 py-1 rounded-full border border-blue-400/20 backdrop-blur-sm mb-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                    <p className="text-blue-100 text-[10px] font-bold tracking-wider uppercase">
                                        {(headProfile?.head_first_name || headProfile?.first_name) ? 'School Head' : userName}
                                    </p>
                                </div>
                                <h1 className="text-3xl font-bold text-white tracking-tight">
                                    {(headProfile?.head_first_name || headProfile?.first_name) || (schoolProfile ? schoolProfile.school_id : '---')}
                                </h1>
                                <p className="text-blue-200 text-sm mt-1 opacity-90">
                                    {(headProfile?.head_first_name || headProfile?.first_name) && schoolProfile
                                        ? `${schoolProfile.school_id} • ${schoolProfile.school_name}`
                                        : (schoolProfile ? schoolProfile.school_name : 'School Principal')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <NotificationCenter />
                                <button onClick={() => navigate('/leaderboard')} className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white shadow-lg hover:bg-white/20 transition-all active:scale-95 group">
                                    <TbTrophy size={20} className="text-yellow-300 group-hover:scale-110 transition-transform" />
                                </button>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="mt-8 relative z-50">
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1 flex items-center shadow-lg transition-all focus-within:bg-white/20 focus-within:border-white/40">
                                <div className="pl-4 pr-3 text-blue-200">
                                    <TbSearch size={20} />
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={handleSearch}
                                    placeholder="Find a form or report..."
                                    className="bg-transparent border-none text-white text-sm w-full placeholder-blue-200/60 focus:outline-none py-3"
                                />
                                {searchQuery && (
                                    <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="pr-4 text-blue-200 hover:text-white transition-colors">
                                        <TbX size={18} />
                                    </button>
                                )}
                            </div>

                            {/* Search Dropdown */}
                            {searchQuery && (
                                <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[60] animate-in fade-in zoom-in-95 duration-200">
                                    {searchResults.length > 0 ? (
                                        <ul className="max-h-60 overflow-y-auto dark:bg-slate-800">
                                            {searchResults.map((item, idx) => (
                                                <li key={idx}>
                                                    <button
                                                        onClick={() => navigate(item.route)}
                                                        className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between group border-b border-slate-50 dark:border-slate-700 last:border-none"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-[#004A99] dark:text-blue-400 flex items-center justify-center">
                                                                <LuFileCheck size={16} />
                                                            </div>
                                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-[#004A99] dark:group-hover:text-blue-400 transition-colors">{item.name}</span>
                                                        </div>
                                                        <TbChevronRight size={16} className="text-slate-300 dark:text-slate-500 group-hover:text-[#004A99] dark:group-hover:text-blue-400 transition-colors" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs italic dark:bg-slate-800">
                                            No forms found matching "{searchQuery}"
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- DASHBOARD CONTENT --- */}
                    <div className="px-6 -mt-12 relative z-10 space-y-8">

                        {/* 1. Quick Stats Row */}
                        <div className="grid grid-cols-3 gap-3">
                            {/* Progress Card */}
                            <div className="col-span-1 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-700 flex flex-col justify-center items-center text-center">
                                <div className="relative w-12 h-12 flex items-center justify-center mb-2">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                        <path className="text-slate-100 dark:text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                        <path className={`${progress === 100 ? 'text-green-500' : 'text-[#004A99] dark:text-blue-400'} transition-all duration-1000 ease-out`} strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                    </svg>
                                    <span className="absolute text-[10px] font-bold text-slate-700 dark:text-slate-200">{progress}%</span>
                                </div>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide">Overall</p>
                            </div>

                            {/* Forms Count */}
                            <div className="col-span-1 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-700 flex flex-col justify-center items-center text-center">
                                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[#004A99] dark:text-blue-400 flex items-center justify-center mb-2">
                                    <LuFileCheck size={20} />
                                </div>
                                <p className="text-xl font-bold text-slate-800 dark:text-white leading-none">{completedForms}<span className="text-slate-300 dark:text-slate-600 text-sm">/{totalForms}</span></p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide mt-1">Forms</p>
                            </div>

                            {/* Learners Highlight */}
                            <div className="col-span-1 bg-gradient-to-br from-[#004A99] to-[#003377] dark:from-blue-600 dark:to-blue-800 p-4 rounded-2xl shadow-xl shadow-blue-900/20 flex flex-col justify-center items-center text-center text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <TbUsers size={40} />
                                </div>
                                <p className="text-2xl font-bold leading-none">{stats.enrollment || 0}</p>
                                <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wide mt-1">Learners</p>
                            </div>
                        </div>

                        {/* 2. Swiper / Highlights */}
                        <div className="w-full">
                            <Swiper
                                modules={[Pagination, Autoplay]}
                                spaceBetween={20}
                                slidesPerView={1}
                                pagination={{ clickable: true, dynamicBullets: true }}
                                autoplay={{ delay: 5000 }}
                                className="w-full rounded-2xl"
                            >
                                <SwiperSlide>
                                    <div
                                        onClick={() => navigate('/school-forms')}
                                        className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border-l-4 border-[#FDB913] min-h-[140px] flex flex-col justify-center relative overflow-hidden cursor-pointer active:scale-[0.98] transition-all hover:shadow-md"
                                    >
                                        <div className="absolute right-[-10px] top-[-10px] opacity-5 dark:opacity-10">
                                            <TbSchool size={100} className="dark:text-white" />
                                        </div>
                                        <h3 className="text-[#004A99] dark:text-blue-400 font-bold text-lg flex items-center mb-2 z-10">
                                            Welcome, Principal!
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-[85%] z-10">
                                            Ensure all school forms are up to date before the division deadline. Tap here to view forms.
                                        </p>
                                    </div>
                                </SwiperSlide>
                                {/* Add more slides if needed */}
                            </Swiper>
                        </div>

                        {/* 3. Quick Actions Grid (NEW) */}
                        <div>
                            <div className="flex justify-between items-end mb-4 px-1">
                                <h3 className="text-slate-700 dark:text-slate-300 font-bold text-sm uppercase tracking-wider">Quick Actions</h3>
                                <button onClick={() => navigate('/school-forms')} className="text-[#004A99] dark:text-blue-400 text-xs font-semibold">View All</button>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                                {SEARCHABLE_ITEMS.map((item, index) => (
                                    <button
                                        key={index}
                                        onClick={() => navigate(item.route)}
                                        className="flex flex-col items-center gap-2 group relative z-20 cursor-pointer"
                                    >
                                        <div className={`w-14 h-14 rounded-2xl ${item.color} dark:bg-slate-800 dark:text-blue-400 flex items-center justify-center shadow-sm group-active:scale-95 transition-all border border-transparent dark:border-slate-700 group-hover:border-slate-200 dark:group-hover:border-slate-600`}>
                                            <item.icon size={24} />
                                        </div>
                                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center leading-tight max-w-[60px]">
                                            {item.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 4. Recent Activity Timeline */}
                        {/* <div className="pb-4">
                            <h3 className="text-slate-700 dark:text-slate-300 font-bold text-sm uppercase tracking-wider mb-4 px-1">Recent History</h3>
                            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
                                {schoolProfile?.history_logs && schoolProfile.history_logs.length > 0 ? (
                                    <div className="relative border-l-2 border-slate-100 dark:border-slate-700 ml-2 space-y-6 my-2">
                                        {[...schoolProfile.history_logs].reverse().slice(0, 5).map((log, idx) => (
                                            <div key={idx} className="relative pl-6">
                                                
                                                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-4 border-blue-500"></div>

                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{log.action}</p>
                                                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-full w-fit">
                                                        {new Date(log.timestamp).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    Updated by <span className="text-[#004A99] dark:text-blue-400 font-medium">{userName}</span>
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-8 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 opacity-60">
                                        <LuHistory size={32} className="mb-2" />
                                        <p className="text-xs">No recent activity recorded</p>
                                    </div>
                                )}
                            </div>
                        </div> */}

                    </div>

                </div>
            </PageTransition>
            <BottomNav userRole="School Head" />
        </>
    );
};

export default SchoolHeadDashboard;