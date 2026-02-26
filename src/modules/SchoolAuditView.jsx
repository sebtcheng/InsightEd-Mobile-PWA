import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiInfo, FiUsers, FiTrendingUp, FiLayout, FiBox, FiLayers, FiUser, FiActivity, FiServer, FiHeart } from 'react-icons/fi';
import { TbSchool, TbReportAnalytics } from "react-icons/tb";

import Enrolment from '../forms/Enrolment';
import SchoolInformation from '../forms/SchoolInformation';
import SchoolProfile from '../forms/SchoolProfile';
import OrganizedClasses from '../forms/OrganizedClasses';
import LearnerStatistics from '../forms/LearnerStatistics';
import ShiftingModalities from '../forms/ShiftingModalities';
import TeachingPersonnel from '../forms/TeachingPersonnel';
import TeacherSpecialization from '../forms/TeacherSpecialization';
import SchoolResources from '../forms/SchoolResources';
import PhysicalFacilities from '../forms/PhysicalFacilities';
import DataHealthDashboard from '../components/DataHealthDashboard';

const SchoolAuditView = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('health');
    const [schoolData, setSchoolData] = useState(null);

    useEffect(() => {
        const storedId = sessionStorage.getItem('targetSchoolId');
        const storedName = sessionStorage.getItem('targetSchoolName');

        if (!storedId) {
            navigate('/jurisdiction-schools');
            return;
        }

        setSchoolData({
            id: storedId,
            name: storedName || "Unknown School"
        });
    }, [navigate]);

    const handleBack = () => {
        navigate(-1);
    };

    if (!schoolData) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 pt-10 pb-20 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <button
                            onClick={handleBack}
                            className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <FiArrowLeft size={24} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-amber-500 text-amber-950">
                                    Viewer Mode
                                </span>
                                <span className="text-slate-400 text-xs font-mono">ID: {schoolData.id}</span>
                            </div>
                            <h1 className="text-2xl font-bold mt-1">{schoolData.name}</h1>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        <TabButton active={activeTab === 'health'} onClick={() => setActiveTab('health')} icon={<FiHeart />} label="Data Health" />
                        <TabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<TbSchool />} label="Profile" />
                        <TabButton active={activeTab === 'information'} onClick={() => setActiveTab('information')} icon={<FiInfo />} label="Head Info" />
                        <TabButton active={activeTab === 'enrolment'} onClick={() => setActiveTab('enrolment')} icon={<FiUsers />} label="Enrolment" />
                        <TabButton active={activeTab === 'classes'} onClick={() => setActiveTab('classes')} icon={<FiLayers />} label="Classes" />
                        <TabButton active={activeTab === 'statistics'} onClick={() => setActiveTab('statistics')} icon={<FiActivity />} label="Learner Stats" />
                        <TabButton active={activeTab === 'shifting'} onClick={() => setActiveTab('shifting')} icon={<TbReportAnalytics />} label="Shifting" />
                        <TabButton active={activeTab === 'personnel'} onClick={() => setActiveTab('personnel')} icon={<FiUser />} label="Personnel" />
                        <TabButton active={activeTab === 'specialization'} onClick={() => setActiveTab('specialization')} icon={<FiLayout />} label="Specialization" />
                        <TabButton active={activeTab === 'resources'} onClick={() => setActiveTab('resources')} icon={<FiBox />} label="Resources" />
                        <TabButton active={activeTab === 'facilities'} onClick={() => setActiveTab('facilities')} icon={<FiServer />} label="Facilities" />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="-mt-12 px-4 pb-20 relative z-20">
                <div className="bg-white dark:bg-slate-800 min-h-[500px] rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden relative">

                    {/* Watermark for Audit Mode */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] z-0 overflow-hidden">
                        <span className="text-9xl font-black -rotate-45 whitespace-nowrap">AUDIT MODE</span>
                    </div>

                    {activeTab === 'health' && <DataHealthDashboard schoolId={schoolData.id} />}
                    {activeTab === 'profile' && <SchoolProfile embedded={true} />}
                    {activeTab === 'information' && <SchoolInformation embedded={true} />}
                    {activeTab === 'enrolment' && <Enrolment embedded={true} />}
                    {activeTab === 'classes' && <OrganizedClasses embedded={true} />}
                    {activeTab === 'statistics' && <LearnerStatistics embedded={true} />}
                    {activeTab === 'shifting' && <ShiftingModalities embedded={true} />}
                    {activeTab === 'personnel' && <TeachingPersonnel embedded={true} />}
                    {activeTab === 'specialization' && <TeacherSpecialization embedded={true} />}
                    {activeTab === 'resources' && <SchoolResources embedded={true} />}
                    {activeTab === 'facilities' && <PhysicalFacilities embedded={true} />}
                </div>
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap
            ${active
                ? 'bg-white text-slate-900 shadow-lg'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }
        `}
    >
        {icon}
        {label}
    </button>
);

export default SchoolAuditView;
