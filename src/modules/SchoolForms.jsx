// src/modules/SchoolForms.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import BottomNav from './BottomNav'; // ✅ UPDATED IMPORT

// Icons
import {
    FiCheckCircle, FiAlertCircle, FiFilter, FiChevronRight,
    FiUser, FiUsers, FiLayers, FiBox
} from "react-icons/fi";
import { TbSchool, TbReportAnalytics } from "react-icons/tb";

const SchoolForms = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'pending', 'completed'
    const [schoolProfile, setSchoolProfile] = useState(null);
    const [headProfile, setHeadProfile] = useState(null);

    // --- 1. DATA CONTENT (Categorized) ---
    const formsData = [
        // CATEGORY: IDENTITY
        {
            id: 'profile',
            category: 'Identity',
            name: "School Profile",
            description: "General school identification.",
            route: "/school-profile",
            icon: TbSchool
        },
        {
            id: 'head',
            category: 'Identity',
            name: "School Head Info",
            description: "Contact details & position.",
            route: "/school-information",
            icon: FiUser
        },
        // CATEGORY: LEARNERS
        {
            id: 'enrolment',
            category: 'Learners',
            name: "Enrollment",
            description: "Enrollees per grade level.",
            route: "/enrolment",
            icon: FiUsers
        },
        {
            id: 'classes',
            category: 'Learners',
            name: "Organized Classes",
            description: "Sections per grade level.",
            route: "/organized-classes",
            icon: FiLayers
        },
        {
            id: 'infra',
            category: 'Learners',
            name: "Shifting & Modality",
            description: "Schedules & delivery modes.",
            route: "/shifting-modality",
            icon: TbReportAnalytics
        },
        // CATEGORY: FACULTY
        {
            id: 'teachers',
            category: 'Faculty',
            name: "Teaching Personnel",
            description: "Staff summary by level.",
            route: "/teaching-personnel",
            icon: FiUser
        },
        {
            id: 'specialization',
            category: 'Faculty',
            name: "Specialization",
            description: "Teachers by subject major.",
            route: "/teacher-specialization",
            icon: FiLayers
        },
        // CATEGORY: ASSETS
        {
            id: 'resources',
            category: 'Assets',
            name: "School Resources",
            description: "Equipment & facilities inventory.",
            route: "/school-resources",
            icon: FiBox
        },
    ];

    // --- 2. FETCH DATA ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const profileRes = await fetch(`/api/school-by-user/${user.uid}`);
                    if (!profileRes.ok) throw new Error("Network response was not ok");
                    const profileJson = await profileRes.json();
                    if (profileJson.exists) setSchoolProfile(profileJson.data);

                    const headRes = await fetch(`/api/school-head/${user.uid}`);
                    if (!headRes.ok) throw new Error("Network response was not ok");
                    const headJson = await headRes.json();
                    if (headJson.exists) setHeadProfile(headJson.data);
                } catch (error) {
                    console.warn("⚠️ Offline/Network Error. Loading from cache...");
                    const cachedProfile = localStorage.getItem('fullSchoolProfile');
                    if (cachedProfile) {
                        try {
                            const parsedProfile = JSON.parse(cachedProfile);
                            setSchoolProfile(parsedProfile);
                            console.log("✅ School profile loaded from cache.");
                        } catch (e) {
                            console.error("Failed to parse cached profile", e);
                        }
                    }
                }
            }
            setTimeout(() => setLoading(false), 600);
        });
        return () => unsubscribe();
    }, []);

    // --- 3. STATUS LOGIC ---
    const getStatus = (id) => {
        if (!schoolProfile) return 'pending'; // Fail safe

        switch (id) {
            case 'profile':
                return schoolProfile.school_id ? 'completed' : 'pending';
            case 'head':
                return headProfile ? 'completed' : 'pending';
            case 'enrolment':
                return (schoolProfile.total_enrollment > 0) ? 'completed' : 'pending';
            case 'classes':
                const totalClasses = (schoolProfile.classes_kinder || 0) + (schoolProfile.classes_grade_1 || 0) + (schoolProfile.classes_grade_6 || 0) + (schoolProfile.classes_grade_10 || 0) + (schoolProfile.classes_grade_12 || 0);
                return totalClasses > 0 ? 'completed' : 'pending';
            case 'teachers':
                const totalTeachers = (schoolProfile.teach_kinder || 0) + (schoolProfile.teach_g1 || 0) + (schoolProfile.teach_g6 || 0) + (schoolProfile.teach_g10 || 0) + (schoolProfile.teach_g12 || 0);
                return totalTeachers > 0 ? 'completed' : 'pending';
            case 'specialization':
                return ((schoolProfile.spec_math_major > 0) || (schoolProfile.spec_english_major > 0)) ? 'completed' : 'pending';
            case 'resources':
                return ((schoolProfile.res_armchairs_good > 0) || (schoolProfile.res_toilets_male > 0)) ? 'completed' : 'pending';
            case 'infra':
                const hasShift = schoolProfile.shift_kinder || schoolProfile.shift_g1;
                const hasAdm = schoolProfile.adm_mdl || schoolProfile.adm_odl;
                return (hasShift || hasAdm) ? 'completed' : 'pending';
            default:
                return 'pending';
        }
    };

    // --- 4. COMPUTED STATS ---
    const { completedCount, totalCount, progress, categorizedForms } = useMemo(() => {
        let completed = 0;
        const processedForms = formsData.map(f => {
            const status = getStatus(f.id);
            if (status === 'completed') completed++;
            return { ...f, status };
        });

        // Group by Category
        const grouped = processedForms.reduce((acc, item) => {
            if (filter !== 'all' && item.status !== filter) return acc; // Apply Filter
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
        }, {});

        return {
            completedCount: completed,
            totalCount: formsData.length,
            progress: Math.round((completed / formsData.length) * 100),
            categorizedForms: grouped
        };
    }, [schoolProfile, headProfile, filter]);

    // --- COMPONENTS ---

    const FilterTab = ({ label, value }) => (
        <button
            onClick={() => setFilter(value)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${filter === value
                ? 'bg-[#004A99] text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
        >
            {label}
        </button>
    );

    const FormCard = ({ item }) => {
        const isDone = item.status === 'completed';
        const Icon = item.icon;

        return (
            <div
                onClick={() => navigate(item.route)}
                className={`group relative p-4 mb-3 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center gap-4
                    ${isDone
                        ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700 opacity-80 hover:opacity-100'
                        : 'bg-white dark:bg-slate-800 border-orange-100 dark:border-orange-900/30 shadow-[0_4px_20px_rgba(249,115,22,0.08)] hover:-translate-y-1 hover:shadow-lg'
                    }
                `}
            >
                {/* Status Indicator Strip */}
                <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${isDone ? 'bg-green-400' : 'bg-orange-400'}`} />

                {/* Icon Box */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors
                    ${isDone ? 'bg-green-100 text-green-600' : 'bg-orange-50 text-orange-500'}
                `}>
                    {isDone ? <FiCheckCircle /> : <Icon />}
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <h3 className={`font-bold text-sm truncate ${isDone ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                            {item.name}
                        </h3>
                        {!isDone && <FiAlertCircle className="text-orange-400 text-xs animate-pulse" />}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5 truncate">
                        {item.description}
                    </p>
                </div>

                {/* Arrow Action */}
                <FiChevronRight className={`text-slate-300 transition-transform group-hover:translate-x-1 ${isDone ? 'opacity-0' : 'opacity-100'}`} />
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900 font-sans pb-24">

            {/* --- HEADER --- */}
            <div className="bg-[#004A99] pt-8 pb-20 px-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />

                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Forms Hub</h1>
                        <p className="text-blue-200 text-xs mt-1">
                            {completedCount === totalCount
                                ? "🎉 All reports submitted!"
                                : `${totalCount - completedCount} forms require attention.`}
                        </p>
                    </div>

                    {/* Progress Donut */}
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <path className="text-blue-900/30 dark:text-blue-900/50" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                            <path className="text-green-400 transition-all duration-1000 ease-out" strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                        </svg>
                        <span className="absolute text-[10px] font-bold text-white">{progress}%</span>
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="px-5 -mt-10 relative z-20">

                {/* Filter Tabs */}
                <div className="bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl flex gap-1 mb-6 backdrop-blur-sm">
                    <FilterTab label="All" value="all" />
                    <FilterTab label="Pending" value="pending" />
                    <FilterTab label="Completed" value="completed" />
                </div>

                {/* Categories List */}
                <div className="space-y-6 pb-4">
                    {Object.keys(categorizedForms).length > 0 ? (
                        Object.entries(categorizedForms).map(([category, items]) => (
                            <div key={category} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                    {category}
                                </h3>
                                <div>
                                    {items.map((item) => (
                                        <FormCard key={item.id} item={item} />
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 opacity-50">
                            <FiFilter size={40} className="mx-auto mb-3 text-slate-400" />
                            <p className="text-sm text-slate-500">No forms found for this filter.</p>
                        </div>
                    )}
                </div>
            </div>

            <BottomNav userRole="School Head" />
        </div>
    );
};

export default SchoolForms;