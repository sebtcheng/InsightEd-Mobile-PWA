import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase'; 
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";
import BottomNav from './BottomNav';
import LoadingScreen from '../components/LoadingScreen';

const SchoolHeadDashboard = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('School Head');
    
    // Data States
    const [schoolProfile, setSchoolProfile] = useState(null);
    const [headProfile, setHeadProfile] = useState(null);
    
    // Calculated Stats
    const [progress, setProgress] = useState(0);
    const [completedForms, setCompletedForms] = useState(0);
    const totalForms = 8; // Matches the 8 items in SchoolForms.jsx

    // --- 1. FETCH DATA ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // A. Get User Name (Firebase)
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) setUserName(userDoc.data().firstName);

                    // B. Get School Profile & Enrolment (Neon)
                    const profileRes = await fetch(`http://localhost:3000/api/school-by-user/${user.uid}`);
                    const profileJson = await profileRes.json();
                    
                    if (profileJson.exists) {
                        setSchoolProfile(profileJson.data);
                    }

                    // C. Get School Head Info (Neon)
                    const headRes = await fetch(`http://localhost:3000/api/school-head/${user.uid}`);
                    const headJson = await headRes.json();

                    if (headJson.exists) {
                        setHeadProfile(headJson.data);
                    }

                } catch (error) {
                    console.error("Dashboard Load Error:", error);
                }
            }
            // Add slight delay for smooth UI
            setTimeout(() => setLoading(false), 800);
        });
        return () => unsubscribe();
    }, []);

    // --- 2. CALCULATE PROGRESS (The "8 Forms" Logic) ---
    useEffect(() => {
        let count = 0;

        // 1. School Profile
        if (schoolProfile) count++;
        
        // 2. School Head Info
        if (headProfile) count++;   
        
        // 3. Enrolment
        if (schoolProfile && schoolProfile.total_enrollment > 0) count++; 
        
        // 4. Organized Classes (Not built yet)
        // if (classesData) count++;

        // 5. Teaching Personnel (Not built yet)
        // if (teachersData) count++;

        // 6. School Infrastructure (Not built yet)
        // if (infraData) count++;

        // 7. School Resources (Not built yet)
        // if (resourcesData) count++;

        // 8. Teacher Specialization (Not built yet)
        // if (specializationData) count++;
        
        setCompletedForms(count);
        setProgress(Math.round((count / totalForms) * 100));
    }, [schoolProfile, headProfile]);

    // --- HELPERS ---
    const formatDate = (isoString) => {
        if (!isoString) return 'Never';
        return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) return <LoadingScreen message="Loading Command Center..." />;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24 relative">
            
            {/* --- TOP HEADER (IDENTITY) --- */}
            <div className="bg-[#004A99] px-6 pt-12 pb-32 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                
                <div className="relative z-10 flex justify-between items-start">
                    <div className="text-white">
                        <p className="text-blue-200 text-xs font-bold tracking-widest uppercase mb-1">
                            {schoolProfile ? `ID: ${schoolProfile.school_id}` : 'No School ID'}
                        </p>
                        <h1 className="text-2xl font-bold leading-tight max-w-[250px]">
                            {schoolProfile ? schoolProfile.school_name : 'No School Profile Linked'}
                        </h1>
                        <p className="text-blue-100/80 text-sm mt-2">Principal {userName}</p>
                    </div>
                    {/* Progress Ring (Mini) */}
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-blue-900/30" />
                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" 
                                className={`${progress === 100 ? 'text-green-400' : 'text-[#FDB913]'}`}
                                strokeDasharray={175} 
                                strokeDashoffset={175 - (175 * progress) / 100} 
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="absolute text-xs font-bold text-white">{progress}%</span>
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT (OVERLAPPING) --- */}
            <div className="px-5 -mt-24 relative z-20 space-y-5">

                {/* 1. STATUS SUMMARY CARD */}
                <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-gray-800 font-bold text-lg">Data Completion</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            {progress === 100 
                                ? "Excellent! All reports are up to date." 
                                : `You have completed ${completedForms} out of ${totalForms} required forms.`}
                        </p>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm ${progress === 100 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600 animate-pulse'}`}>
                        {progress === 100 ? '✓' : '!'}
                    </div>
                </div>

                {/* 2. THE MAIN ACTION BUTTON */}
                <button 
                    onClick={() => navigate('/school-forms')}
                    className="w-full bg-gradient-to-r from-[#CC0000] to-[#990000] text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-red-900/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
                >
                    <span className="text-xl">📝</span>
                    <span>Open School Forms Menu</span>
                </button>

                {/* 3. SMART SHORTCUTS GRID */}
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Quick Access</h3>
                <div className="grid grid-cols-2 gap-4">
                    
                    {/* CARD A: SCHOOL PROFILE */}
                    <div onClick={() => navigate('/school-profile')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition cursor-pointer relative overflow-hidden group">
                        <div className={`absolute top-0 left-0 w-1 h-full ${schoolProfile ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-2xl">🏫</span>
                            {schoolProfile && <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">Updated</span>}
                        </div>
                        <h3 className="font-bold text-gray-800 text-sm">School Profile</h3>
                        <p className="text-[10px] text-gray-400 mt-1">
                            {schoolProfile ? `Last: ${formatDate(schoolProfile.submitted_at)}` : 'Not Created Yet'}
                        </p>
                    </div>

                    {/* CARD B: SCHOOL HEAD INFO */}
                    <div onClick={() => navigate('/school-information')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition cursor-pointer relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1 h-full ${headProfile ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-2xl">👨‍💼</span>
                            {headProfile && <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">Verified</span>}
                        </div>
                        <h3 className="font-bold text-gray-800 text-sm">Head Info</h3>
                        <p className="text-[10px] text-gray-400 mt-1">
                            {headProfile ? `${headProfile.position_title}` : 'Action Required'}
                        </p>
                    </div>

                    {/* CARD C: ENROLMENT (LIVE DATA) */}
                    <div onClick={() => navigate('/enrolment')} className="col-span-2 bg-gradient-to-r from-blue-600 to-blue-800 p-5 rounded-2xl shadow-lg text-white active:scale-95 transition cursor-pointer relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                        
                        <div className="flex justify-between items-center relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-2xl">📊</span>
                                    <h3 className="font-bold text-lg">Enrolment</h3>
                                </div>
                                <p className="text-blue-100 text-xs">
                                    {schoolProfile?.total_enrollment 
                                        ? `Breakdown: ${schoolProfile.es_enrollment} ES • ${schoolProfile.jhs_enrollment} JHS • ${schoolProfile.shs_enrollment} SHS`
                                        : 'Please encode learner data'}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="block text-3xl font-bold">
                                    {schoolProfile?.total_enrollment || 0}
                                </span>
                                <span className="text-[10px] text-blue-200 uppercase tracking-wider">Learners</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* 4. RECENT ACTIVITY (LOGS) */}
                {schoolProfile?.history_logs && schoolProfile.history_logs.length > 0 && (
                    <div className="pt-2">
                        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1 mb-3">Recent Activity</h3>
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
                            {/* Take the last 2 logs and reverse them to show newest first */}
                            {[...schoolProfile.history_logs].reverse().slice(0, 2).map((log, idx) => (
                                <div key={idx} className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs">
                                        {idx === 0 ? 'Now' : 'Old'}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-700">{log.action}</p>
                                        <p className="text-[10px] text-gray-400">
                                            {new Date(log.timestamp).toLocaleString()} • {log.user === auth.currentUser?.uid ? 'You' : 'Admin'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Navigation */}
            <BottomNav homeRoute="/schoolhead-dashboard" />
        </div>
    );
};

export default SchoolHeadDashboard;