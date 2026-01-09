// src/modules/SchoolForms.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import SchoolHeadBottomNav from './SchoolHeadBottomNav'; // ✅ UPDATED IMPORT
// LoadingScreen import removed

const SchoolForms = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [schoolProfile, setSchoolProfile] = useState(null);
    const [headProfile, setHeadProfile] = useState(null);

    // --- 1. DATA CONTENT ---
    const formsData = [
        {
            id: 'profile',
            name: "School Profile",
            emoji: "🏫",
            description: "General school identification and classification.",
            route: "/school-profile",
        },
        {
            id: 'head',
            name: "School Information (Head)",
            emoji: "👨‍💼",
            description: "Contact details and position of the School Head.",
            route: "/school-information",
        },
        {
            id: 'enrolment',
            name: "Enrollment per Grade Level",
            emoji: "📊",
            description: "Total number of enrollees for Grades 1 through 12.",
            route: "/enrolment",
        },
        {
            id: 'classes',
            name: "Organized Classes",
            emoji: "🗂️",
            description: "Number of sections/classes organized per grade level.",
            route: "/organized-classes",
        },
        {
            id: 'teachers',
            name: "Teaching Personnel",
            emoji: "👩‍🏫",
            description: "Summary of teaching staff by level.",
            route: "/teaching-personnel",
        },
        {
            id: 'infra',
            name: "Shifting & Modality",
            emoji: "🔄",
            description: "Shifting schedules and learning delivery modes.",
            route: "/shifting-modality",
        },
        {
            id: 'resources',
            name: "School Resources",
            emoji: "💻",
            description: "Inventory of equipment and facilities.",
            route: "/school-resources",
        },
        {
            id: 'specialization',
            name: "Teacher Specialization",
            emoji: "🎓",
            description: "Count of teachers by subject specialization.",
            route: "/teacher-specialization",
        },
    ];

    // --- 2. FETCH DATA ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Check School Profile
                    const profileRes = await fetch(`/api/school-by-user/${user.uid}`);
                    const profileJson = await profileRes.json();
                    if (profileJson.exists) setSchoolProfile(profileJson.data);

                    // Check School Head Info
                    const headRes = await fetch(`/api/school-head/${user.uid}`);
                    const headJson = await headRes.json();
                    if (headJson.exists) setHeadProfile(headJson.data);

                } catch (error) { console.error("Error loading status:", error); }
            }
            setTimeout(() => setLoading(false), 600);
        });
        return () => unsubscribe();
    }, []);

    // --- 3. STATUS LOGIC ---
    const getStatus = (id) => {
        switch (id) {
            case 'profile':
                return schoolProfile ? 'completed' : 'pending';
            case 'head':
                return headProfile ? 'completed' : 'pending';
            case 'enrolment':
                return (schoolProfile?.total_enrollment > 0) ? 'completed' : 'pending';
            case 'classes':
                if (!schoolProfile) return 'pending';
                const totalClasses = (schoolProfile.classes_kinder || 0) +
                    (schoolProfile.classes_grade_1 || 0) +
                    (schoolProfile.classes_grade_6 || 0) +
                    (schoolProfile.classes_grade_10 || 0) +
                    (schoolProfile.classes_grade_12 || 0);
                return totalClasses > 0 ? 'completed' : 'pending';
            case 'teachers':
                if (!schoolProfile) return 'pending';
                const totalTeachers = (schoolProfile.teach_kinder || 0) +
                    (schoolProfile.teach_g1 || 0) + (schoolProfile.teach_g2 || 0) +
                    (schoolProfile.teach_g3 || 0) + (schoolProfile.teach_g4 || 0) +
                    (schoolProfile.teach_g5 || 0) + (schoolProfile.teach_g6 || 0) +
                    (schoolProfile.teach_g7 || 0) + (schoolProfile.teach_g8 || 0) +
                    (schoolProfile.teach_g9 || 0) + (schoolProfile.teach_g10 || 0) +
                    (schoolProfile.teach_g11 || 0) + (schoolProfile.teach_g12 || 0);
                return totalTeachers > 0 ? 'completed' : 'pending';

            case 'specialization':
                if (!schoolProfile) return 'pending';
                // ✅ Check for any spec_ columns
                // If even one major is recorded, mark as completed
                const hasSpec =
                    (schoolProfile.spec_math_major > 0) ||
                    (schoolProfile.spec_english_major > 0) ||
                    (schoolProfile.spec_ict_coord > 0) ||
                    (schoolProfile.spec_guidance > 0);
                return hasSpec ? 'completed' : 'pending';

            case 'resources':
                if (!schoolProfile) return 'pending';
                // ✅ Check for the new res_ prefixes
                const hasResources =
                    (schoolProfile.res_armchairs_good > 0) ||
                    (schoolProfile.res_toilets_male > 0) ||
                    (schoolProfile.res_sci_labs > 0) ||
                    (schoolProfile.res_desktops_instructional > 0);
                return hasResources ? 'completed' : 'pending';

            case 'infra':
                if (!schoolProfile) return 'pending';
                const hasShift = schoolProfile.shift_kinder || schoolProfile.shift_g1 || schoolProfile.shift_g7 || schoolProfile.shift_g11;
                const hasAdm = schoolProfile.adm_mdl || schoolProfile.adm_odl || schoolProfile.adm_others;
                return (hasShift || hasAdm) ? 'completed' : 'pending';
            default:
                return 'pending';
        }
    };

    const StatusBadge = ({ status }) => {
        if (status === 'completed') return <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider border border-green-200">Completed</span>;
        return <span className="bg-orange-50 text-orange-600 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider border border-orange-100 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span> Pending</span>;
    };

    const FormCard = ({ item }) => {
        const status = getStatus(item.id);
        return (
            <div
                onClick={() => navigate(item.route)}
                className={`p-5 rounded-2xl border flex items-center justify-between transition-all duration-200 relative overflow-hidden group bg-white border-gray-100 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.98]`}
            >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${status === 'completed' ? 'bg-[#004A99]' : 'bg-orange-400'}`} />
                <div className="flex items-center gap-4 ml-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform duration-300 group-hover:scale-110 bg-blue-50 text-blue-600">
                        {item.emoji}
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-gray-800">{item.name}</h3>
                        <p className="text-[10px] text-gray-400 leading-tight max-w-[180px] mt-0.5">{item.description}</p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={status} />
                    <span className="text-gray-300 group-hover:text-[#004A99] transition text-xl">&rarr;</span>
                </div>
            </div>
        );
    };

    // LoadingScreen check removed

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24 relative">

            {/* --- HEADER --- */}
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={() => navigate('/schoolhead-dashboard')} className="text-white/80 hover:text-white text-2xl transition">&larr;</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">School Forms</h1>
                        <p className="text-blue-200 text-xs mt-1">Select a module to update your data.</p>
                    </div>
                </div>
            </div>

            {/* --- FORM LIST --- */}
            <div className="px-5 -mt-12 relative z-20 grid gap-4 md:grid-cols-2">
                {formsData.map((form) => (
                    <FormCard key={form.id} item={form} />
                ))}
            </div>

            {/* ✅ UPDATED NAVIGATION CALL */}
            <SchoolHeadBottomNav />
        </div>
    );
};

export default SchoolForms;