// src/modules/SchoolHeadDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";

import SchoolHeadBottomNav from './SchoolHeadBottomNav';
import PageTransition from '../components/PageTransition';

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
        totalForms: 8,
        enrollment: 0,
        teachers: 0
    });

    // --- SEARCH STATE ---
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const SEARCHABLE_ITEMS = [
        { name: "School Profile", route: "/school-profile", type: "Form" },
        { name: "School Information (Head)", route: "/school-information", type: "Form" },
        { name: "Enrollment per Grade Level", route: "/enrolment", type: "Form" },
        { name: "Organized Classes", route: "/organized-classes", type: "Form" },
        { name: "Teaching Personnel", route: "/teaching-personnel", type: "Form" },
        { name: "Shifting & Modality", route: "/shifting-modality", type: "Form" },
        { name: "School Resources", route: "/school-resources", type: "Form" },
        { name: "Teacher Specialization", route: "/teacher-specialization", type: "Form" },
    ];

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (query.trim() === '') {
            setSearchResults([]);
            return;
        }

        const filtered = SEARCHABLE_ITEMS.filter(item =>
            item.name.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(filtered);
    };

    // Stats for the "cards"
    // Calculate Completion Logic
    useEffect(() => {
        if (!schoolProfile) return;

        let completed = 0;

        // Helper to check if any field with prefix has value > 0 (or non-empty for strings)
        const hasData = (prefix, type = 'number') => {
            return Object.keys(schoolProfile).some(key => {
                if (!key.startsWith(prefix)) return false;
                const val = schoolProfile[key];
                if (type === 'number') return val > 0;
                return val && val !== '' && val !== 'null';
            });
        };

        // 1. School Profile (Always true if we have the object)
        if (schoolProfile.school_id) completed++;

        // 2. School Head (Check if name exists)
        if (schoolProfile.head_last_name && schoolProfile.head_last_name.trim() !== '') completed++;

        // 3. Enrolment (Check Total > 0)
        if (schoolProfile.total_enrollment > 0) completed++;

        // 4. Organized Classes (Check any class count > 0)
        if (hasData('classes_', 'number')) completed++;

        // 5. Teaching Personnel (Check any teacher count > 0)
        if (hasData('teach_', 'number')) completed++;

        // 6. Shifting & Modality (Check if any shift strategy is set)
        if (hasData('shift_', 'string') || hasData('mode_', 'string')) completed++;

        // 7. School Resources (Check any resource > 0 or existing string for water/internet)
        const hasResources = hasData('res_', 'number') || (schoolProfile.res_water_source && schoolProfile.res_water_source !== '');
        if (hasResources) completed++;

        // 8. Teacher Specialization (Check any spec > 0)
        if (hasData('spec_', 'number')) completed++;

        setStats(prev => ({
            ...prev,
            completedForms: completed,
            enrollment: schoolProfile.total_enrollment || 0
        }));
    }, [schoolProfile]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) setUserName(userDoc.data().firstName);

                    const profileRes = await fetch(`/api/school-by-user/${user.uid}`);
                    const profileJson = await profileRes.json();
                    if (profileJson.exists) setSchoolProfile(profileJson.data);

                    const headRes = await fetch(`/api/school-head/${user.uid}`);
                    const headJson = await headRes.json();
                    if (headJson.exists) setHeadProfile(headJson.data);
                } catch (error) {
                    console.error("Dashboard Load Error:", error);
                }
            }
            setTimeout(() => setLoading(false), 800);
        });
        return () => unsubscribe();
    }, []);

    const { completedForms, totalForms } = stats;
    const progress = totalForms > 0 ? Math.round((completedForms / totalForms) * 100) : 0;

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 font-sans pb-24 relative">
                {/* --- TOP HEADER --- */}
                <div className="relative bg-[#004A99] pt-12 pb-24 px-6 rounded-b-[2.5rem] shadow-xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-blue-200 text-xs font-bold tracking-wider uppercase">
                                {schoolProfile ? `ID: ${schoolProfile.school_id}` : 'InsightEd Mobile'}
                            </p>
                            <h1 className="text-2xl font-bold text-white mt-1">
                                {schoolProfile ? schoolProfile.school_name : 'Dashboard'}
                            </h1>
                            <p className="text-blue-100 mt-1 text-sm">
                                Principal {userName}
                            </p>
                        </div>
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white shadow-inner">
                            🏫
                        </div>
                    </div>

                    {/* Search Bar Embedded in Header */}
                    <div className="mt-6 relative">
                        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex items-center gap-3">
                            <span className="text-blue-200 text-lg">🔍</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={handleSearch}
                                placeholder="Search forms..."
                                className="bg-transparent border-none text-white text-sm w-full placeholder-blue-200/50 focus:outline-none"
                            />
                            {searchQuery && (
                                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-blue-200 hover:text-white">✕</button>
                            )}
                        </div>
                        {/* Search Results Dropdown */}
                        {searchQuery && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                {searchResults.length > 0 ? (
                                    <ul>
                                        {searchResults.map((item, idx) => (
                                            <li key={idx}>
                                                <button
                                                    onClick={() => navigate(item.route)}
                                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#004A99] flex items-center justify-center text-xs font-bold">
                                                            📝
                                                        </div>
                                                        <span className="text-sm font-semibold text-gray-700 group-hover:text-[#004A99]">{item.name}</span>
                                                    </div>
                                                    <span className="text-gray-300 group-hover:text-[#004A99] text-xs">Jump &rarr;</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-4 text-center text-gray-400 text-xs italic">
                                        No results found.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- MAIN CONTENT --- */}
                <div className="px-5 -mt-16 relative z-10 space-y-6">

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Completion</p>
                            <p className={`text-xl font-bold mt-1 ${progress === 100 ? 'text-green-600' : 'text-[#004A99]'}`}>
                                {progress}%
                            </p>
                        </div>
                        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Forms</p>
                            <p className="text-xl font-bold text-slate-800 mt-1">{completedForms}/{totalForms}</p>
                        </div>
                        <div
                            className="bg-gradient-to-br from-[#004A99] to-[#003377] p-3 rounded-xl shadow-lg shadow-blue-900/20 flex flex-col justify-center items-center text-center text-white"
                        >
                            <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wide">Total Learners</p>
                            <p className="text-xl font-bold mt-1">{stats.enrollment || 0}</p>
                        </div>
                    </div>

                    {/* Swiper Carousel */}
                    <div className="w-full">
                        <Swiper
                            modules={[Pagination, Autoplay]}
                            spaceBetween={15}
                            slidesPerView={1}
                            pagination={{ clickable: true, dynamicBullets: true }}
                            autoplay={{ delay: 6000 }}
                            className="w-full"
                        >
                            <SwiperSlide className="pb-8">
                                <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-[#FDB913] flex flex-col justify-center min-h-[140px]">
                                    <h3 className="text-[#004A99] font-bold text-sm flex items-center mb-1">
                                        <span className="text-xl mr-2">👋</span>
                                        Welcome, Principal!
                                    </h3>
                                    <p className="text-slate-500 text-xs leading-relaxed ml-7">
                                        Monitor your school's data and ensure all reports are submitted on time.
                                    </p>
                                </div>
                            </SwiperSlide>

                            <SwiperSlide className="pb-8">
                                <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-emerald-500 flex flex-col h-[140px]">
                                    <h3 className="text-emerald-700 font-bold text-sm flex items-center mb-2 shrink-0">
                                        <span className="text-xl mr-2">�</span>
                                        Data Status
                                    </h3>
                                    <div className="flex-1 flex flex-col justify-center pl-7">
                                        <p className="text-slate-600 text-xs mb-1">
                                            You have completed <span className="font-bold text-emerald-600">{completedForms}</span> out of {totalForms} forms.
                                        </p>
                                        <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                                            <div
                                                className="bg-emerald-500 h-2 rounded-full transition-all duration-1000"
                                                style={{ width: `${progress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </SwiperSlide>
                        </Swiper>
                    </div>

                    {/* Recent Activities */}
                    <div className="w-full mb-6">
                        <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-3 ml-1">Recent Updates</h3>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {schoolProfile?.history_logs && schoolProfile.history_logs.length > 0 ? (
                                <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto custom-scrollbar">
                                    {[...schoolProfile.history_logs].reverse().slice(0, 5).map((log, idx) => (
                                        <div key={idx} className="p-4 flex gap-3 hover:bg-slate-50 transition-colors">
                                            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-blue-500"></div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border mb-1 inline-block bg-blue-50 text-blue-600 border-blue-100">
                                                        UPDATE
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-xs font-bold text-slate-700 truncate">{log.action}</p>
                                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                                    Updated by {userName}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center">
                                    <p className="text-2xl mb-2">💤</p>
                                    <p className="text-sm font-bold text-slate-600">No recent activity</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                <SchoolHeadBottomNav />
            </div>
        </PageTransition>
    );
};

export default SchoolHeadDashboard;