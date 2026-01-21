
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbArrowLeft, TbCheck, TbX, TbBuildingSkyscraper, TbFileDescription, TbCalendar, TbCoin, TbActivity, TbPhoto, TbSearch } from "react-icons/tb";
import { FiChevronRight } from "react-icons/fi";
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import PageTransition from '../components/PageTransition';
import BottomNav from './BottomNav';

const ProjectValidation = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const queryParams = new URLSearchParams(window.location.search);
    const monitorSchoolId = queryParams.get('schoolId');
    const [schoolId, setSchoolId] = useState(monitorSchoolId || null);
    const [user, setUser] = useState(null);
    const [schoolHeadName, setSchoolHeadName] = useState(null);

    // New State for Detailed View
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectImages, setProjectImages] = useState([]);
    const [imageLoading, setImageLoading] = useState(false);
    const [remarks, setRemarks] = useState('');
    const userRole = localStorage.getItem('userRole') || 'School Head';

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) return;
            setUser(currentUser);

            try {
                let targetSchoolId = monitorSchoolId;

                // If no schoolId in URL, we try to get it from the user's school profile (Normal Flow)
                if (!targetSchoolId) {
                    const profileRes = await fetch(`/api/school-by-user/${currentUser.uid}`);
                    const profileJson = await profileRes.json();
                    if (profileJson.exists) {
                        targetSchoolId = profileJson.data.school_id;
                        setSchoolId(targetSchoolId);

                        const fName = profileJson.data.head_first_name || '';
                        const lName = profileJson.data.head_last_name || '';
                        const fullName = `${fName} ${lName}`.trim();
                        if (fullName) setSchoolHeadName(fullName);
                    }
                }

                if (targetSchoolId) {
                    const projectRes = await fetch(`/api/projects-by-school-id/${targetSchoolId}`);
                    if (projectRes.ok) {
                        const projectData = await projectRes.json();
                        setProjects(projectData);
                    }
                }
            } catch (err) {
                console.error("Error fetching data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Fetch images when a project is selected
    useEffect(() => {
        if (!selectedProject) {
            setProjectImages([]);
            setRemarks('');
            return;
        }

        const fetchImages = async () => {
            setImageLoading(true);
            try {
                const res = await fetch(`/api/project-images/${selectedProject.id}`);
                const data = await res.json();
                setProjectImages(data);
            } catch (error) {
                console.error("Error loading images:", error);
            } finally {
                setImageLoading(false);
            }
        };

        setRemarks(selectedProject.validationRemarks || '');
        fetchImages();
    }, [selectedProject]);

    const handleValidation = async (status) => {
        if (!selectedProject) return;

        const action = status === 'Validated' ? 'Confirm' : 'Reject';
        if (!confirm(`Are you sure you want to ${action} this project?`)) return;

        try {
            const res = await fetch('/api/validate-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProject.id,
                    status,
                    userUid: user.uid,
                    userName: schoolHeadName || user.displayName || 'School Head',
                    remarks: remarks
                })
            });

            if (res.ok) {
                setProjects(prev => prev.map(p =>
                    p.id === selectedProject.id ? { ...p, validation_status: status, validationRemarks: remarks } : p
                ));
                alert(`Project ${status}!`);
                setSelectedProject(null); // Go back to list
            } else {
                alert("Failed to update status");
            }
        } catch (err) {
            console.error("Validation error:", err);
            alert("Error connecting to server");
        }
    };

    // --- TUTORIAL STATE ---
    const [showTutorial, setShowTutorial] = useState(false);

    useEffect(() => {
        if (monitorSchoolId) return; // Don't show tutorial for monitors
        const hasViewed = localStorage.getItem('hasViewedValidationTutorial');
        if (!hasViewed) {
            setShowTutorial(true);
        }
    }, [monitorSchoolId]);

    const closeTutorial = () => {
        localStorage.setItem('hasViewedValidationTutorial', 'true');
        setShowTutorial(false);
    };

    // --- RENDER HELPERS ---
    const formatDate = (dateStr) => {
        if (!dateStr) return "N/A";
        return new Date(dateStr).toLocaleDateString();
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 pb-20 relative">
                {/* TUTORIAL MODAL */}
                {showTutorial && !monitorSchoolId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>

                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                <TbCheck size={32} />
                            </div>

                            <h2 className="text-xl font-bold text-slate-800">Project Validation</h2>
                            <p className="text-sm text-slate-500">
                                As a School Head, you play a key role in verifying completed projects.
                            </p>

                            <div className="text-left space-y-3 bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">
                                <div className="flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">1</div>
                                    <p className="text-slate-600"><strong className="text-slate-800">Select a project</strong> from the list to view full details and photos.</p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">2</div>
                                    <p className="text-slate-600"><strong className="text-slate-800">Review</strong> the engineer's report and uploaded images.</p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">3</div>
                                    <p className="text-slate-600"><strong className="text-slate-800">Add Notes</strong> and Confirm or Reject the project.</p>
                                </div>
                            </div>

                            <button
                                onClick={closeTutorial}
                                className="w-full py-3 rounded-xl bg-[#004A99] text-white font-bold hover:bg-blue-800 transition shadow-lg shadow-blue-900/20"
                            >
                                Got it, let's start!
                            </button>
                        </div>
                    </div>
                )}

                {/* HEADER SECTION (Themed) */}
                <div className="relative bg-[#004A99] pt-12 pb-24 px-6 rounded-b-[3rem] shadow-2xl z-0 overflow-hidden">
                    {/* Background Decorative Circles */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 text-white mb-2">
                            <button
                                onClick={() => selectedProject ? setSelectedProject(null) : navigate(-1)}
                                className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <TbArrowLeft size={24} />
                            </button>
                            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                                {selectedProject ? 'Project Details' : 'Project Monitoring'}
                                {monitorSchoolId && (
                                    <span className="bg-white/20 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border border-white/30 backdrop-blur-sm">Monitor View</span>
                                )}
                            </h1>
                        </div>
                        {!selectedProject && (
                            <p className="text-blue-100/60 text-xs font-medium pl-10 max-w-xs">
                                {monitorSchoolId ? `Inspecting school ID: ${monitorSchoolId}` : "Manage and verify infrastructure projects."}
                            </p>
                        )}
                    </div>
                </div>

                {/* Content Container */}
                <div className="px-6 -mt-12 relative z-10 pb-20">

                    {/* SEARCH BAR (Only show when list is active) */}
                    {!selectedProject && !loading && projects.length > 0 && (
                        <div className="mb-6 bg-white rounded-2xl shadow-lg shadow-blue-900/5 p-2 flex items-center border border-slate-100">
                            <div className="pl-3 pr-2 text-slate-400">
                                <TbSearch size={20} />
                            </div>
                            <input
                                type="text"
                                placeholder="Search projects or contractors..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 bg-transparent border-none focus:outline-none text-slate-700 text-sm placeholder-slate-400 py-2"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="p-2 text-slate-300 hover:text-slate-500 transition-colors">
                                    <TbX size={16} />
                                </button>
                            )}
                        </div>
                    )}
                    {loading ? (
                        <div className="bg-white rounded-3xl p-8 shadow-lg border border-slate-100 text-center">
                            <div className="animate-pulse flex flex-col items-center">
                                <div className="w-12 h-12 bg-slate-200 rounded-full mb-3"></div>
                                <div className="h-4 w-32 bg-slate-200 rounded mb-2"></div>
                                <div className="h-3 w-48 bg-slate-200 rounded"></div>
                            </div>
                        </div>
                    ) : selectedProject ? (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            {/* Project Details Card */}
                            <div className="bg-white p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#004A99] flex items-center justify-center shrink-0">
                                        <TbBuildingSkyscraper size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-xl font-bold text-slate-800 leading-tight">{selectedProject.projectName}</h2>
                                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">ID: {selectedProject.id}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</span>
                                        <span className="text-sm font-bold text-slate-700">{selectedProject.status}</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Accomplishment</span>
                                        <span className="text-sm font-bold text-[#004A99]">{selectedProject.accomplishmentPercentage}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Project Description */}
                            <div className="bg-white p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-100">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Description</h3>
                                <p className="text-sm text-slate-700 leading-relaxed">{selectedProject.projectDescription || 'No description provided.'}</p>
                            </div>

                            {/* Photos Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <TbPhoto /> Project Photos
                                    </h3>
                                    <span className="bg-slate-100 text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-full">
                                        {projectImages.length} Images
                                    </span>
                                </div>

                                {imageLoading ? (
                                    <div className="bg-white rounded-2xl p-8 border border-slate-100 flex justify-center">
                                        <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                                    </div>
                                ) : projectImages.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {projectImages.map((img, idx) => (
                                            <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-200 shadow-sm border border-white group">
                                                <img src={img.image_url || img.image_data} alt={`Project ${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                                                    <p className="text-white text-[10px] font-medium truncate w-full">Uploaded by {img.uploaded_by}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-200 text-slate-400 text-sm">
                                        No photos available for this project.
                                    </div>
                                )}
                            </div>

                            {/* Validation Section */}
                            <div className="bg-white p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <TbCheck size={16} />
                                    </div>
                                    <h3 className="font-bold text-slate-700">Validation Decision</h3>
                                </div>

                                {selectedProject.validation_status === 'Pending' ? (
                                    monitorSchoolId ? (
                                        <div className="pt-2">
                                            <div className="w-full py-3.5 rounded-2xl bg-orange-50 text-orange-700 font-bold text-sm flex items-center justify-center gap-2">
                                                <TbActivity size={18} />
                                                Awaiting School Head Validation
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Validation Remarks</label>
                                                <textarea
                                                    value={remarks}
                                                    onChange={(e) => setRemarks(e.target.value)}
                                                    placeholder="Add any additional observation or reason for rejection..."
                                                    className="w-full bg-slate-100 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 min-h-[100px] outline-none"
                                                />
                                            </div>

                                            <div className="flex gap-3 pt-4">
                                                <button
                                                    onClick={() => handleValidation('Rejected')}
                                                    className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                                                >
                                                    <TbX /> Reject
                                                </button>
                                                <button
                                                    onClick={() => handleValidation('Validated')}
                                                    className="flex-[2] py-4 bg-[#004A99] text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-colors"
                                                >
                                                    <TbCheck /> Confirm Project
                                                </button>
                                            </div>
                                        </>
                                    )
                                ) : (
                                    <div className="space-y-4 pt-2">
                                        <div className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-90 ${selectedProject.validation_status === 'Validated'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                            }`}>
                                            {selectedProject.validation_status === 'Validated' ? <TbCheck size={18} /> : <TbX size={18} />}
                                            {selectedProject.validation_status === 'Validated' ? 'Project Confirmed' : 'Project Rejected'}
                                        </div>
                                        {selectedProject.validationRemarks && (
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm italic text-slate-600">
                                                "{selectedProject.validationRemarks}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // --- LIST VIEW ---
                        projects.length === 0 ? (
                            <div className="bg-white rounded-3xl p-8 shadow-lg border border-slate-100 text-center py-12">
                                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <TbBuildingSkyscraper size={32} />
                                </div>
                                <h3 className="text-slate-800 font-bold text-lg">No Projects Found</h3>
                                <p className="text-slate-500 text-sm mt-2 max-w-[200px] mx-auto">There are no submitted projects available for this school.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 pb-6">
                                {projects.map((project) => (
                                    <div
                                        key={project.id}
                                        onClick={() => setSelectedProject(project)}
                                        className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer group"
                                    >
                                        {/* Status Badge */}
                                        <div className={`absolute top-0 right-0 text-[10px] font-bold px-4 py-1.5 rounded-bl-2xl ${project.validation_status === 'Validated' ? 'bg-green-500 text-white' :
                                            project.validation_status === 'Rejected' ? 'bg-red-500 text-white' :
                                                'bg-orange-500 text-white'
                                            }`}>
                                            {project.validation_status || 'Submitted'}
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#004A99] flex items-center justify-center shrink-0 shadow-sm group-hover:bg-[#004A99] group-hover:text-white transition-colors duration-300">
                                                <TbBuildingSkyscraper size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0 pr-6">
                                                <h3 className="font-bold text-slate-800 leading-tight truncate">{project.projectName}</h3>
                                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                    <TbCalendar size={12} />
                                                    {formatDate(project.statusAsOfDate)}
                                                </p>
                                            </div>
                                            <div className="text-slate-300 group-hover:text-[#004A99] transition-colors pr-1">
                                                <FiChevronRight size={20} />
                                            </div>
                                        </div>



                                        <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Progress</span>
                                                <span className="text-sm font-bold text-slate-700">{project.accomplishmentPercentage}%</span>
                                            </div>
                                            {/* Mini visual bar/pill could go here */}
                                            <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full"
                                                    style={{ width: `${project.accomplishmentPercentage}%` }}
                                                ></div>
                                            </div>
                                            <div className="text-slate-300 group-hover:text-[#004A99] transition-colors">
                                                <FiChevronRight size={20} />
                                            </div>
                                        </div>
                                    </div>


                                )
                                )}
                            </div>
                        ))
                    }
                </div>
                <BottomNav userRole={userRole} />
            </div>
        </PageTransition>
    );
};

export default ProjectValidation;
