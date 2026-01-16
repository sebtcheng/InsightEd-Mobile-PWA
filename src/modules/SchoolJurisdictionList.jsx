import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiSearch, FiChevronRight, FiMapPin, FiBarChart2, FiHardDrive, FiFileText, FiTrendingUp, FiCheckCircle, FiClock } from 'react-icons/fi';

const SchoolJurisdictionList = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchSchools = async () => {
            const user = auth.currentUser;
            if (!user) return;

            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);

                try {
                    const params = new URLSearchParams({
                        region: data.region,
                        ...(data.division && { division: data.division })
                    });

                    const res = await fetch(`/api/monitoring/schools?${params.toString()}`);
                    if (res.ok) setSchools(await res.json());
                } catch (err) {
                    console.error("Fetch Schools Error:", err);
                }
            }
            setLoading(false);
        };

        fetchSchools();
    }, []);

    const filteredSchools = schools.filter(s => 
        s.school_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.school_id?.includes(searchQuery)
    );

    const StatusBadge = ({ active, label }) => (
        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {label}
        </span>
    );

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 font-sans">
                {/* Header */}
                <div className="bg-[#004A99] p-6 pt-12 rounded-b-[2rem] shadow-lg text-white mb-6">
                    <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-blue-100 hover:text-white">← Back</button>
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">Schools List</h1>
                            <p className="text-blue-200/70 text-xs mt-0.5">
                                {userData?.role === 'Regional Office' ? `Regional Monitoring: Region ${userData?.region}` : `Division Monitoring: ${userData?.division}`}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black">{filteredSchools.length}</span>
                            <p className="text-[10px] font-bold opacity-60 uppercase">Total</p>
                        </div>
                    </div>
                </div>

                <div className="px-5 space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search school name or ID..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 shadow-sm text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                        />
                    </div>

                    {/* School Cards */}
                    <div className="space-y-3">
                        {filteredSchools.map((school) => (
                            <div 
                                key={school.school_id}
                                className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-900 transition-all group"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1 pr-4">
                                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 leading-snug group-hover:text-blue-600 transition-colors">
                                            {school.school_name || "Unknown School"}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">ID: {school.school_id}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-1 justify-end max-w-[140px]">
                                        <StatusBadge active={school.profile_status} label="Info" />
                                        <StatusBadge active={school.head_status} label="Head" />
                                        <StatusBadge active={school.enrollment_status} label="Enrol" />
                                        <StatusBadge active={school.classes_status} label="Class" />
                                        <StatusBadge active={school.shifting_status} label="Mode" />
                                        <StatusBadge active={school.personnel_status} label="Staff" />
                                        <StatusBadge active={school.specialization_status} label="Spec" />
                                        <StatusBadge active={school.resources_status} label="Res" />
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">View Selection</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        <button 
                                            onClick={() => navigate(`/school-profile?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/40 rounded-xl hover:bg-blue-100 transition-colors"
                                            title="Profile"
                                        >
                                            <FiFileText className="text-blue-600 dark:text-blue-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-blue-900/60 dark:text-blue-200/60">Profile</span>
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/school-information?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-indigo-50 dark:bg-indigo-900/40 rounded-xl hover:bg-indigo-100 transition-colors"
                                            title="School Head"
                                        >
                                            <FiBarChart2 className="text-indigo-600 dark:text-indigo-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-indigo-900/60 dark:text-indigo-200/60">HdInfo</span>
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/enrolment?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-900/40 rounded-xl hover:bg-emerald-100 transition-colors"
                                            title="Enrolment"
                                        >
                                            <FiTrendingUp className="text-emerald-600 dark:text-emerald-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-emerald-900/60 dark:text-emerald-200/60">Enrol</span>
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/organized-classes?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-cyan-50 dark:bg-cyan-900/40 rounded-xl hover:bg-cyan-100 transition-colors"
                                            title="Classes"
                                        >
                                            <FiCheckCircle className="text-cyan-600 dark:text-cyan-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-cyan-900/60 dark:text-cyan-200/60">Class</span>
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/shifting-modalities?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-purple-50 dark:bg-purple-900/40 rounded-xl hover:bg-purple-100 transition-colors"
                                            title="Modalities"
                                        >
                                            <FiMapPin className="text-purple-600 dark:text-purple-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-purple-900/60 dark:text-purple-200/60">Mode</span>
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/teaching-personnel?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-orange-50 dark:bg-orange-900/40 rounded-xl hover:bg-orange-100 transition-colors"
                                            title="Personnel"
                                        >
                                            <FiFileText className="text-orange-600 dark:text-orange-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-orange-900/60 dark:text-orange-200/60">Staff</span>
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/teacher-specialization?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-pink-50 dark:bg-pink-900/40 rounded-xl hover:bg-pink-100 transition-colors"
                                            title="Specialization"
                                        >
                                            <FiTrendingUp className="text-pink-600 dark:text-pink-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-pink-900/60 dark:text-pink-200/60">Spec</span>
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/school-resources?viewOnly=true&schoolId=${school.school_id}`)}
                                            className="p-2 aspect-square flex flex-col items-center justify-center bg-amber-50 dark:bg-amber-900/40 rounded-xl hover:bg-amber-100 transition-colors"
                                            title="Resources"
                                        >
                                            <FiClock className="text-amber-600 dark:text-amber-400" size={16} />
                                            <span className="text-[8px] font-bold mt-1 text-amber-900/60 dark:text-amber-200/60">Res</span>
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/project-validation?schoolId=${school.school_id}`)}
                                            className="col-span-4 mt-2 flex items-center justify-center gap-2 py-3 bg-[#CC0000] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
                                        >
                                            <FiHardDrive /> Infrastructure Monitoring
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <BottomNav userRole={userData?.role} />
            </div>
        </PageTransition>
    );
};

export default SchoolJurisdictionList;
