import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import { TbChevronLeft, TbSchool, TbUsers, TbBooks, TbActivity, TbHammer, TbClipboardList, TbBuildingSkyscraper, TbReportAnalytics, TbMapSearch } from "react-icons/tb";
import { LuLayoutDashboard, LuFileCheck } from "react-icons/lu";
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNav from './BottomNav';

const DummyDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [userData, setUserData] = React.useState(null);

    React.useEffect(() => {
        const fetchUser = async () => {
            const user = auth.currentUser;
            if (user) {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setUserData(docSnap.data());
                }
            }
        };
        fetchUser();
    }, []);
    
    // Default to 'school' if no type is passed
    const formType = location.state?.type || 'school'; 

    const SCHOOL_FORMS = [
        { name: "School Profile", route: "/school-profile", icon: TbSchool, color: "bg-blue-100 text-blue-600" },
        { name: "School Information (Head)", route: "/school-information", icon: TbSchool, color: "bg-indigo-100 text-indigo-600" },
        { name: "Enrollment per Grade Level", route: "/enrolment", icon: TbUsers, color: "bg-orange-100 text-orange-600" },
        { name: "Organized Classes", route: "/organized-classes", icon: LuLayoutDashboard, color: "bg-purple-100 text-purple-600" },
        { name: "Teaching Personnel", route: "/teaching-personnel", icon: TbUsers, color: "bg-pink-100 text-pink-600" },
        { name: "Shifting & Modality", route: "/shifting-modalities", icon: TbActivity, color: "bg-amber-100 text-amber-600" },
        { name: "School Resources", route: "/school-resources", icon: TbBooks, color: "bg-emerald-100 text-emerald-600" },
        { name: "Teacher Specialization", route: "/teacher-specialization", icon: TbUsers, color: "bg-cyan-100 text-cyan-600" },
    ];

    const ENGINEER_FORMS = [
        { name: "New Project Entry", route: "/new-project", icon: TbBuildingSkyscraper, color: "bg-blue-100 text-blue-600" },
    ];

    const FORMS_TO_DISPLAY = formType === 'engineer' ? ENGINEER_FORMS : SCHOOL_FORMS;
    const TITLE = formType === 'engineer' ? 'Sample Engineer Forms' : 'Sample School Forms';
    const DESCRIPTION = formType === 'engineer' 
        ? 'Select a form below to view exactly what Engineers see when submitting their reports.'
        : 'Select a form below to view exactly what School Heads see when submitting their data.';
    const ICON = formType === 'engineer' ? TbHammer : TbSchool;

    const handleNavigate = (route) => {
        // Navigate with 'isDummy: true' state
        navigate(route, { state: { isDummy: true } });
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
                {/* Header */}
                <div className="bg-[#004A99] pt-14 pb-12 px-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <ICON size={120} className="text-white" />
                    </div>

                    <h1 className="text-2xl font-bold text-white mb-2 mt-4 relative z-10">{TITLE}</h1>
                    <div className="inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg border border-white/20">
                        <p className="text-white text-xs font-bold uppercase tracking-wider">
                            Read-Only Preview
                        </p>
                    </div>
                    <p className="text-blue-100 text-sm mt-4 max-w-xs relative z-10 opactiy-90">
                        {DESCRIPTION}
                    </p>
                </div>

                {/* Content */}
                <div className="px-6 -mt-6 relative z-10 space-y-4">
                    {/* Banner */}
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                            <LuFileCheck size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-amber-800">Preview Mode</h3>
                            <p className="text-xs text-amber-600 mt-1">Data entered in these dummy forms will NOT be saved. Use this for reference only.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {FORMS_TO_DISPLAY.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleNavigate(item.route)}
                                className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 hover:bg-slate-50 transition-all active:scale-[0.98]"
                            >
                                <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                                    <item.icon size={24} />
                                </div>
                                <div className="text-left flex-1">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{item.name}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">View Sample</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                                    <TbChevronLeft size={16} className="rotate-180" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <BottomNav userRole={userData?.role} />
            </div>
        </PageTransition>
    );
};

export default DummyDashboard;
