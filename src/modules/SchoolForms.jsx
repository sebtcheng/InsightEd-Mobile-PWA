import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase'; 
import { onAuthStateChanged } from "firebase/auth";
import BottomNav from './BottomNav';
import LoadingScreen from '../components/LoadingScreen';

const SchoolForms = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [schoolProfile, setSchoolProfile] = useState(null);
    const [headProfile, setHeadProfile] = useState(null);

    // --- 1. DATA CONTENT (All 8 Forms) ---
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
            name: "Enrolment per Grade Level", 
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
            name: "School Infrastructure", 
            emoji: "🏗️",
            description: "Status of classrooms and buildings.",
            route: "/school-infrastructure", 
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

    // --- 2. FETCH DATA (To determine status) ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Check School Profile & Enrolment
                    const profileRes = await fetch(`http://localhost:3000/api/school-by-user/${user.uid}`);
                    const profileJson = await profileRes.json();
                    if (profileJson.exists) setSchoolProfile(profileJson.data);

                    // Check School Head Info
                    const headRes = await fetch(`http://localhost:3000/api/school-head/${user.uid}`);
                    const headJson = await headRes.json();
                    if (headJson.exists) setHeadProfile(headJson.data);

                } catch (error) { console.error("Error loading status:", error); }
            }
            setTimeout(() => setLoading(false), 600);
        });
        return () => unsubscribe();
    }, []);

    // --- HELPERS ---
    const getStatus = (id) => {
        // Real Checks for implemented forms
        if (id === 'profile') return schoolProfile ? 'completed' : 'pending';
        if (id === 'head') return headProfile ? 'completed' : 'pending';
        if (id === 'enrolment') return (schoolProfile && schoolProfile.total_enrollment > 0) ? 'completed' : 'pending';
        
        // Placeholder Checks for future forms (Default to Pending/Open)
        return 'pending'; 
    };

    const StatusBadge = ({ status }) => {
        if (status === 'completed') return <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">Completed</span>;
        if (status === 'pending') return <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider animate-pulse">Pending</span>;
        return <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">Locked</span>;
    };

    // --- COMPONENT: FORM CARD ---
    const FormCard = ({ item }) => {
        const status = getStatus(item.id);
        const isLocked = status === 'locked';

        return (
            <div 
                onClick={() => !isLocked && navigate(item.route)}
                className={`p-5 rounded-2xl border flex items-center justify-between transition-all duration-200 relative overflow-hidden group
                    ${isLocked 
                        ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed' 
                        : 'bg-white border-gray-100 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.98]'
                    }
                `}
            >
                {/* Status Color Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 
                    ${status === 'completed' ? 'bg-green-500' : status === 'pending' ? 'bg-orange-400' : 'bg-gray-300'}`} 
                />

                <div className="flex items-center gap-4 ml-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl
                        ${isLocked ? 'bg-gray-200 grayscale' : 'bg-blue-50 text-blue-600'}
                    `}>
                        {item.emoji}
                    </div>
                    <div>
                        <h3 className={`font-bold text-sm ${isLocked ? 'text-gray-500' : 'text-gray-800'}`}>{item.name}</h3>
                        <p className="text-[10px] text-gray-400 leading-tight max-w-[180px] mt-0.5">{item.description}</p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={status} />
                    {!isLocked && <span className="text-gray-300 group-hover:text-blue-500 transition text-xl">&rarr;</span>}
                </div>
            </div>
        );
    };

    if (loading) return <LoadingScreen message="Loading Forms Menu..." />;

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

            {/* --- FORM LIST (Grid Layout) --- */}
            <div className="px-5 -mt-12 relative z-20 grid gap-4 md:grid-cols-2">
                {formsData.map((form) => (
                    <FormCard key={form.id} item={form} />
                ))}
            </div>

            <BottomNav active="forms" />
        </div>
    );
};

export default SchoolForms;