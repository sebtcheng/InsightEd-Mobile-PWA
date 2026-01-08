// src/modules/SchoolHeadDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";
import SchoolHeadBottomNav from './SchoolHeadBottomNav';
import LoadingScreen from '../components/LoadingScreen';

// Icons
import { FiFileText, FiActivity, FiUsers, FiBox, FiCheckCircle, FiAlertCircle, FiClock } from "react-icons/fi";

const SchoolHeadDashboard = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('School Head');
    const [schoolProfile, setSchoolProfile] = useState(null);
    const [headProfile, setHeadProfile] = useState(null);

    // Stats for the "cards"
    const [stats, setStats] = useState({
        completedForms: 0,
        totalForms: 8,
        enrollment: 0,
        teachers: 0
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // 1. Get User Name
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) setUserName(userDoc.data().firstName);

                    // 2. Get School Data
                    const profileRes = await fetch(`/api/school-by-user/${user.uid}`);
                    const profileJson = await profileRes.json();

                    let profileData = null;
                    if (profileJson.exists) {
                        profileData = profileJson.data;
                        setSchoolProfile(profileData);
                    }

                    // 3. Get Head Data
                    const headRes = await fetch(`/api/school-head/${user.uid}`);
                    const headJson = await headRes.json();
                    if (headJson.exists) setHeadProfile(headJson.data);

                    // 4. Calculate Stats (Mirroring logic from SchoolForms.jsx)
                    const calculateStats = () => {
                        let completed = 0;
                        const total = 8; // Total number of forms

                        // 1. School Profile
                        if (profileData) completed++;

                        // 2. School Head Profile
                        if (headJson.exists) completed++;

                        // 3. Enrolment
                        if (profileData && profileData.total_enrollment > 0) completed++;

                        // 4. Classes
                        if (profileData) {
                            const totalClasses = (profileData.classes_kinder || 0) +
                                (profileData.classes_grade_1 || 0) +
                                (profileData.classes_grade_6 || 0) +
                                (profileData.classes_grade_10 || 0) +
                                (profileData.classes_grade_12 || 0);
                            if (totalClasses > 0) completed++;
                        }

                        // 5. Teachers (Granular Check)
                        if (profileData) {
                            const totalTeachers = (profileData.teach_kinder || 0) +
                                (profileData.teach_g1 || 0) + (profileData.teach_g2 || 0) +
                                (profileData.teach_g3 || 0) + (profileData.teach_g4 || 0) +
                                (profileData.teach_g5 || 0) + (profileData.teach_g6 || 0) +
                                (profileData.teach_g7 || 0) + (profileData.teach_g8 || 0) +
                                (profileData.teach_g9 || 0) + (profileData.teach_g10 || 0) +
                                (profileData.teach_g11 || 0) + (profileData.teach_g12 || 0);
                            if (totalTeachers > 0) completed++;
                        }

                        // 6. Specialization
                        if (profileData) {
                            const hasSpec =
                                (profileData.spec_math_major > 0) ||
                                (profileData.spec_english_major > 0) ||
                                (profileData.spec_ict_coord > 0) ||
                                (profileData.spec_guidance > 0);
                            if (hasSpec) completed++;
                        }

                        // 7. Resources
                        if (profileData) {
                            const hasResources =
                                (profileData.res_armchairs_good > 0) ||
                                (profileData.res_toilets_male > 0) ||
                                (profileData.res_sci_labs > 0) ||
                                (profileData.res_desktops_instructional > 0);
                            if (hasResources) completed++;
                        }

                        // 8. Infrastructure (Learning Modalities)
                        if (profileData) {
                            const hasShift = profileData.shift_kinder || profileData.shift_g1 || profileData.shift_g7 || profileData.shift_g11;
                            const hasAdm = profileData.adm_mdl || profileData.adm_odl || profileData.adm_others;
                            if (hasShift || hasAdm) completed++;
                        }

                        return { completed, total };
                    };

                    const result = calculateStats();

                    setStats({
                        completedForms: result.completed,
                        totalForms: result.total,
                        enrollment: profileData?.total_enrollment || 0,
                        // Sum up granular teachers if available
                        teachers: profileData ? (
                            (profileData.teach_kinder || 0) + (profileData.teach_g1 || 0) +
                            (profileData.teach_g2 || 0) + (profileData.teach_g3 || 0) +
                            (profileData.teach_g4 || 0) + (profileData.teach_g5 || 0) +
                            (profileData.teach_g6 || 0) + (profileData.teach_g7 || 0) +
                            (profileData.teach_g8 || 0) + (profileData.teach_g9 || 0) +
                            (profileData.teach_g10 || 0) + (profileData.teach_g11 || 0) +
                            (profileData.teach_g12 || 0)
                        ) : 0
                    });

                } catch (error) {
                    console.error("Dashboard Load Error:", error);
                }
            }
            setTimeout(() => setLoading(false), 800);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <LoadingScreen message="Loading Command Center..." />;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24 relative">
            {/* --- 1. ENGINEER-STYLE CURVED HEADER --- */}
            <div className="bg-[#004A99] px-6 pt-12 pb-32 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                {/* Abstract Background Shapes */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-blue-200 text-xs font-bold tracking-widest uppercase mb-1">
                                School Head Dashboard
                            </p>
                            <h1 className="text-2xl font-bold text-white leading-tight">
                                Hello, {userName}
                            </h1>
                            <p className="text-blue-100 text-sm mt-1 opacity-90">
                                {schoolProfile ? schoolProfile.school_name : "No School Linked"}
                            </p>
                        </div>
                        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                            <span className="text-lg">🏫</span>
                        </div>
                    </div>

                    {/* Quick Search / Filter Placeholder (Visual only for now) */}
                    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex items-center gap-3">
                        <span className="text-blue-200 text-lg">🔍</span>
                        <input
                            type="text"
                            placeholder="Search forms or reports..."
                            className="bg-transparent border-none text-white text-sm w-full placeholder-blue-200/50 focus:outline-none"
                            disabled
                        />
                    </div>
                </div>
            </div>

            {/* --- 2. STATS GRID (Overlapping Header) --- */}
            <div className="px-5 -mt-20 relative z-20">
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {/* Stat Card 1: Enrollment */}
                    <div className="bg-white p-3 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center justify-center text-center py-4">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-[#004A99] flex items-center justify-center mb-2">
                            <FiUsers size={14} />
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Learners</p>
                        <p className="text-lg font-bold text-gray-800">{stats.enrollment > 0 ? stats.enrollment : '-'}</p>
                    </div>

                    {/* Stat Card 2: Forms Progress */}
                    <div className="bg-white p-3 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center justify-center text-center py-4">
                        <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-2">
                            <FiFileText size={14} />
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Reports</p>
                        <p className="text-lg font-bold text-gray-800">{stats.completedForms}/{stats.totalForms}</p>
                    </div>

                    {/* Stat Card 3: School ID */}
                    <div className="bg-white p-3 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center justify-center text-center py-4">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                            <FiBox size={14} />
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">ID</p>
                        <p className="text-xs font-bold text-gray-800 mt-1">{schoolProfile?.school_id || 'N/A'}</p>
                    </div>
                </div>

                {/* --- 3. MAIN ACTION SECTION --- */}
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1 mb-3">Quick Actions</h3>

                <button
                    onClick={() => navigate('/school-forms')}
                    className="w-full bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all active:scale-[0.98] mb-6"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#004A99] to-[#003366] text-white flex items-center justify-center text-xl shadow-blue-200 shadow-lg">
                            📝
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-gray-800 text-sm group-hover:text-[#004A99] transition-colors">Manage School Forms</h3>
                            <p className="text-xs text-gray-400 mt-1">Update profile, enrollment & resources</p>
                        </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        ➜
                    </div>
                </button>

                {/* --- 4. RECENT ACTIVITY LIST --- */}
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Recent Updates</h3>
                    <span className="text-[10px] text-[#004A99] font-bold bg-blue-50 px-2 py-0.5 rounded-full">Live</span>
                </div>

                <div className="space-y-3">
                    {schoolProfile?.history_logs && schoolProfile.history_logs.length > 0 ? (
                        [...schoolProfile.history_logs].reverse().slice(0, 5).map((log, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-3 items-start">
                                <div className="mt-1 w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-700 leading-tight">{log.action}</p>
                                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                        <FiClock size={10} />
                                        {new Date(log.timestamp).toLocaleDateString()} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 bg-white/50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-xs text-gray-400 italic">No recent activity recorded.</p>
                        </div>
                    )}
                </div>
            </div>

            <SchoolHeadBottomNav />
        </div>
    );
};

export default SchoolHeadDashboard;