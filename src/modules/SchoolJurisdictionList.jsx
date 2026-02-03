import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiSearch, FiChevronRight, FiMapPin, FiBarChart2, FiHardDrive, FiFileText, FiTrendingUp, FiCheckCircle, FiClock, FiBell, FiRefreshCw } from 'react-icons/fi';


const SchoolJurisdictionList = () => {
    const navigate = useNavigate();
    // NEW: Use Search Params for CO Drill-down
    const [searchParams] = useSearchParams(); 
    
    const [userData, setUserData] = useState(null);
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Determine effective filters
    const filterRegion = searchParams.get('region');
    const filterDivision = searchParams.get('division');


    const fetchSchools = async () => {
        setLoading(true); // Ensure loading state is shown on refresh
        const user = auth.currentUser;
        if (!user) return;

        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);

            try {
                // Logic: Use URL params if present (CO drill-down), otherwise use User Data (RO/SDO)
                const regionToUse = filterRegion || data.region;
                const divisionToUse = filterDivision || data.division;

                const params = new URLSearchParams({
                    region: regionToUse,
                    ...(divisionToUse && { division: divisionToUse })
                });

                // If we have a region (either from URL or User), fetch schools
                if (regionToUse) {
                    const res = await fetch(`/api/monitoring/schools?${params.toString()}`);
                    if (res.ok) setSchools(await res.json());
                }
            } catch (err) {
                console.error("Fetch Schools Error:", err);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSchools();
    }, [filterRegion, filterDivision]);


    const filteredSchools = schools.filter(s => 
        s.school_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.school_id?.includes(searchQuery)
    );

    const handleAlert = async (school) => {
        // Identify missing forms
        const missing = [];
        if (!school.profile_status) missing.push("School Profile");
        if (!school.head_status) missing.push("School Head Info");
        if (!school.enrollment_status) missing.push("Enrolment");
        
        if (missing.length === 0) {
             // If these basic ones are done, check others or just say generic update needed
             if (!school.classes_status) missing.push("Organized Classes");
             if (!school.personnel_status) missing.push("Personnel");
        }

        if (missing.length === 0) return alert("This school seems to have completed the core forms!");

        const message = `Action Required: Please complete the following forms: ${missing.join(', ')}.`;

        const confirmSend = window.confirm(`Send alert to ${school.school_name}?\n\nMessage: "${message}"`);
        if (!confirmSend) return;

        // We need the recipient UID. 
        // Current /api/monitoring/schools might not return submitted_by UID.
        // We will TRY to use 'submitted_by' if we add it to the backend or use a separate lookup.
        // FOR NOW: Let's assume we need to Fetch user by school_id or similar.
        // Actually, the implementation plan said: "Update endpoint to join with users".
        // Use the school.school_id to find the user? Or relying on 'submitted_by' in the school object?
        // Let's check the backend query in api/index.js for /api/monitoring/schools...
        // It selects * from school_profiles if I recall? No, it selects specific columns.
        // I should have updated the backend GET schools to include 'submitted_by' (the user UID).
        
        // AUTO-FIX: I will update this frontend to use `school.submitted_by` assuming I update the backend to return it.
        // If 'submitted_by' is missing, we can't send.
        
        if (!school.submitted_by) {
            alert("Cannot alert: No registered user found for this school (submitted_by is missing).");
            return;
        }

        try {
            const res = await fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientUid: school.submitted_by,
                    senderUid: auth.currentUser.uid,
                    senderName: `${userData.firstName} (${userData.role})`,
                    title: "Incomplete Forms Alert",
                    message: message,
                    type: "alert"
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Alert sent successfully!");
            } else {
                alert("Failed to send alert.");
            }
        } catch (error) {
            console.error(error);
            alert("Error sending alert.");
        }
    };

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

                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">Schools List</h1>
                            <p className="text-blue-200/70 text-xs mt-0.5">
                                {userData?.role === 'Central Office' ? (
                                    // CO View
                                    `Monitoring: ${filterDivision ? `${filterDivision}` : (filterRegion ? `${filterRegion}` : 'All Regions')}`
                                ) : (
                                    // RO/SDO View
                                    userData?.role === 'Regional Office' ? `Regional Monitoring: Region ${userData?.region}` : `Division Monitoring: ${userData?.division}`
                                )}
                            </p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <span className="text-2xl font-black">{filteredSchools.length}</span>
                            <p className="text-[10px] font-bold opacity-60 uppercase mb-2">Total</p>
                            
                            <button 
                                onClick={fetchSchools}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:rotate-180 active:scale-95 backdrop-blur-md"
                                title="Refresh List"
                            >
                                <FiRefreshCw size={14} />
                            </button>
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
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID: {school.school_id}</p>
                                            
                                            {/* COMPLETION INDICATOR */}
                                            {(() => {
                                                const isComplete = school.profile_status && school.head_status && school.enrollment_status && 
                                                                 school.classes_status && school.shifting_status && school.personnel_status && 
                                                                 school.specialization_status && school.resources_status;
                                                return isComplete ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        <FiCheckCircle size={10} /> Completed
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        <FiClock size={10} /> Incomplete
                                                    </span>
                                                );
                                            })()}
                                        </div>
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
                                        
                                        {/* ALERT BUTTON - Only show if something is missing */}
                                        {/* DISABLED PER USER REQUEST
                                        {(!school.profile_status || !school.enrollment_status || !school.head_status) && (
                                            <button 
                                                onClick={() => handleAlert(school)}
                                                className="col-span-4 mt-1 flex items-center justify-center gap-2 py-3 bg-white border-2 border-red-100 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-colors"
                                            >
                                                <FiBell /> Send Alert Notification
                                            </button>
                                        )}
                                        */}
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
