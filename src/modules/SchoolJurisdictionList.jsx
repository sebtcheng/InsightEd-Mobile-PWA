import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiSearch, FiChevronRight, FiMapPin, FiBarChart2, FiHardDrive } from 'react-icons/fi';

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
                                    <div>
                                        <h3 className="font-black text-slate-800 dark:text-slate-100 leading-tight group-hover:text-blue-600 transition-colors">
                                            {school.school_name || "Unknown School"}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">ID: {school.school_id}</p>
                                    </div>
                                    <button 
                                        onClick={() => navigate(`/school-profile?viewOnly=true&schoolId=${school.school_id}`)}
                                        className="p-2 text-slate-300 hover:text-blue-600 transition-colors"
                                    >
                                        <FiChevronRight size={20} />
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-50 dark:border-slate-700">
                                    <StatusBadge active={school.profile_status} label="Profile" />
                                    <StatusBadge active={school.enrollment_status} label="Enrollment" />
                                    <StatusBadge active={school.classes_status} label="Classes" />
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <button 
                                         onClick={() => navigate(`/enrolment?viewOnly=true&schoolId=${school.school_id}`)}
                                         className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tighter hover:bg-blue-50 transition-colors"
                                    >
                                        <FiBarChart2 /> View Stats
                                    </button>
                                    <button 
                                         onClick={() => navigate(`/project-validation?schoolId=${school.school_id}`)}
                                         className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tighter hover:bg-blue-50 transition-colors"
                                    >
                                        <FiHardDrive /> Infrastructure
                                    </button>
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
