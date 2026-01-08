// src/modules/SchoolHeadDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";
import SchoolHeadBottomNav from './SchoolHeadBottomNav';
import LoadingScreen from '../components/LoadingScreen';

const SchoolHeadDashboard = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('School Head');
    const [schoolProfile, setSchoolProfile] = useState(null);
    const [headProfile, setHeadProfile] = useState(null);
    const [progress, setProgress] = useState(0);
    const [completedForms, setCompletedForms] = useState(0);
    const totalForms = 8;

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

    useEffect(() => {
        let count = 0;
        if (schoolProfile) count++;
        if (headProfile) count++;
        if (schoolProfile && schoolProfile.total_enrollment > 0) count++;
        setCompletedForms(count);
        setProgress(Math.round((count / totalForms) * 100));
    }, [schoolProfile, headProfile]);

    if (loading) return <LoadingScreen message="Loading Command Center..." />;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24 relative">
            {/* --- TOP HEADER --- */}
            <div className="bg-[#004A99] px-6 pt-12 pb-32 rounded-b-[3rem] shadow-xl relative overflow-hidden">
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

            {/* --- MAIN CONTENT --- */}
            <div className="px-5 -mt-24 relative z-20 space-y-5">
                {/* 1. STATUS SUMMARY CARD */}
                <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-gray-800 font-bold text-lg">Data Completion</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            {progress === 100 ? "Excellent! All reports are up to date." : `You have completed ${completedForms} out of ${totalForms} required forms.`}
                        </p>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm ${progress === 100 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600 animate-pulse'}`}>
                        {progress === 100 ? '✓' : '!'}
                    </div>
                </div>

                {/* 2. THE MAIN ACTION BUTTON */}
                <button 
                    onClick={() => navigate('/school-forms')}
                    className="w-full bg-gradient-to-r from-[#CC0000] to-[#990000] text-white font-bold py-8 px-6 rounded-2xl shadow-lg shadow-red-900/20 hover:scale-[1.02] transition-transform flex flex-col items-center justify-center gap-2"
                >
                    <span className="text-4xl">📝</span>
                    <span className="text-xl">Open School Forms</span>
                    <p className="text-white/70 text-[10px] font-normal uppercase tracking-widest">Encoding & Reports</p>
                </button>

                {/* 3. RECENT ACTIVITY */}
                {schoolProfile?.history_logs && schoolProfile.history_logs.length > 0 && (
                    <div className="pt-2">
                        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1 mb-3">Recent Activity</h3>
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
                            {[...schoolProfile.history_logs].reverse().slice(0, 3).map((log, idx) => (
                                <div key={idx} className="flex gap-3 items-center">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs text-blue-600 font-bold">{idx + 1}</div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-700">{log.action}</p>
                                        <p className="text-[10px] text-gray-400">{new Date(log.timestamp).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <SchoolHeadBottomNav />
        </div>
    );
};

export default SchoolHeadDashboard;