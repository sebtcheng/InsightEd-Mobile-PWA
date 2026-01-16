
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbArrowLeft, TbCheck, TbX, TbBuildingSkyscraper, TbFileDescription, TbCalendar, TbCoin, TbActivity, TbPhoto } from "react-icons/tb";
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import PageTransition from '../components/PageTransition';

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
                {showTutorial && (
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
                            <h1 className="text-2xl font-bold tracking-tight">
                                {selectedProject ? 'Project Details' : 'Project Validation'}
                            </h1>
                        </div>
                        {!selectedProject && (
                            <p className="text-blue-100 text-sm opacity-90 pl-10 max-w-xs">
                                Verify and approve completed infrastructure projects for your school.
                            </p>
                        )}
                    </div>
                </div>

                {/* Content Container (Overlapping Header) */}
                <div className="px-6 -mt-12 relative z-10 pb-20">
                    {loading ? (
                        <div className="bg-white rounded-3xl p-8 shadow-lg border border-slate-100 text-center text-slate-400">
                            <div className="animate-pulse flex flex-col items-center">
                                <div className="w-12 h-12 bg-slate-200 rounded-full mb-3"></div>
                                <div className="h-4 w-32 bg-slate-200 rounded mb-2"></div>
                                <div className="h-3 w-48 bg-slate-200 rounded"></div>
                            </div>
                        </div>
                    ) : selectedProject ? (
                        // --- DETAILED VIEW ---
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">

                            {/* IMMERSIVE HEADER CARD */}
                            <div className="bg-white rounded-3xl shadow-xl overflow-hidden relative">
                                {/* Image Background or Gradient */}
                                <div className="h-48 bg-slate-800 relative">
                                    {projectImages.length > 0 ? (
                                        <img
                                            src={projectImages[0].image_data}
                                            alt="Project Cover"
                                            className="w-full h-full object-cover opacity-80"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
                                            <TbBuildingSkyscraper className="text-white/20" size={64} />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                                    {/* Status Badge Over Image */}
                                    <div className={`absolute top-4 right-4 text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-md shadow-lg ${selectedProject.validation_status === 'Validated' ? 'bg-green-500/90 text-white' :
                                        selectedProject.validation_status === 'Rejected' ? 'bg-red-500/90 text-white' :
                                            'bg-orange-500/90 text-white'
                                        }`}>
                                        {selectedProject.validation_status.toUpperCase()}
                                    </div>

                                    <div className="absolute bottom-0 left-0 p-6 w-full">
                                        <h2 className="text-2xl font-bold text-white leading-tight shadow-sm">{selectedProject.projectName}</h2>
                                        <p className="text-blue-100 text-xs mt-1 flex items-center gap-1 opacity-90">
                                            <TbBuildingSkyscraper size={14} />
                                            {selectedProject.contractorName || 'Contractor Not Specified'}
                                        </p>
                                    </div>
                                </div>

                                {/* Key Stats Grid */}
                                <div className="p-6 grid grid-cols-2 gap-y-6 gap-x-4">
                                    <div className="col-span-2 grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                                                <TbCoin size={14} className="text-blue-500" />
                                                Allocation
                                            </label>
                                            <p className="font-bold text-slate-800 text-lg">
                                                ₱ {selectedProject.projectAllocation ? Number(selectedProject.projectAllocation).toLocaleString() : '0.00'}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                                                <TbActivity size={14} className="text-green-500" />
                                                Progress
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${selectedProject.accomplishmentPercentage}%` }}></div>
                                                </div>
                                                <span className="font-bold text-slate-800">{selectedProject.accomplishmentPercentage}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Status</label>
                                        <p className="font-semibold text-slate-700 text-sm">{selectedProject.status}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Funds Batch</label>
                                        <p className="font-semibold text-slate-700 text-sm">{selectedProject.batchOfFunds || 'N/A'}</p>
                                    </div>

                                    <div className="col-span-2 pt-2 grid grid-cols-3 gap-2">
                                        <div className="bg-slate-50 p-2 rounded-lg text-center">
                                            <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Target</label>
                                            <p className="text-xs font-bold text-slate-700">{formatDate(selectedProject.targetCompletionDate)}</p>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded-lg text-center">
                                            <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Actual</label>
                                            <p className="text-xs font-bold text-slate-700">{formatDate(selectedProject.actualCompletionDate)}</p>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded-lg text-center">
                                            <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Notice</label>
                                            <p className="text-xs font-bold text-slate-700">{formatDate(selectedProject.noticeToProceed)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Engineer's Remarks Card */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                                    <TbFileDescription size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-slate-800 text-sm mb-1">Engineer's Report</h3>
                                    <p className="text-sm text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        "{selectedProject.otherRemarks || "No additional remarks provided."}"
                                    </p>
                                </div>
                            </div>

                            {/* Images Gallery */}
                            <div className="space-y-3">
                                <h3 className="font-bold text-slate-700 pl-2 flex items-center gap-2">
                                    <TbPhoto size={18} />
                                    Project Gallery
                                </h3>
                                {imageLoading ? (
                                    <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-400 shadow-sm border border-slate-100">Loading photos...</div>
                                ) : projectImages.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {projectImages.map((img) => (
                                            <div key={img.id} className="relative aspect-video rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-100 group">
                                                <img
                                                    src={img.image_data}
                                                    alt="Project"
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
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
                                <textarea
                                    className="w-full p-4 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                    rows="3"
                                    placeholder={monitorSchoolId ? "Validation remarks from School Head" : "Enter your remarks here..."}
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    disabled={selectedProject.validation_status !== 'Pending' || monitorSchoolId}
                                ></textarea>

                                {selectedProject.validation_status === 'Pending' ? (
                                    !monitorSchoolId ? (
                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => handleValidation('Rejected')}
                                                className="flex-1 py-3.5 rounded-2xl bg-white border border-red-100 text-red-600 font-bold text-sm hover:bg-red-50 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                <TbX size={18} />
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleValidation('Validated')}
                                                className="flex-[2] py-3.5 rounded-2xl bg-[#004A99] text-white font-bold text-sm hover:bg-blue-800 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-blue-900/20"
                                            >
                                                <TbCheck size={18} />
                                                Confirm & Validate
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="pt-2">
                                            <div className="w-full py-3.5 rounded-2xl bg-orange-50 text-orange-700 font-bold text-sm flex items-center justify-center gap-2">
                                                <TbActivity size={18} />
                                                Awaiting Head Validation
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    <div className="pt-2">
                                        <button
                                            disabled
                                            className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-90 ${selectedProject.validation_status === 'Validated'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                                }`}
                                        >
                                            {selectedProject.validation_status === 'Validated' ? <TbCheck size={18} /> : <TbX size={18} />}
                                            {selectedProject.validation_status === 'Validated' ? 'Project Confirmed' : 'Project Rejected'}
                                        </button>
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
                                <p className="text-slate-500 text-sm mt-2 max-w-[200px] mx-auto">There are no submitted projects waiting for your validation.</p>
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
                                                'bg-orange-100 text-orange-700'
                                            }`}>
                                            {project.validation_status.toUpperCase()}
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#004A99] flex items-center justify-center shrink-0 shadow-sm group-hover:bg-[#004A99] group-hover:text-white transition-colors duration-300">
                                                <TbBuildingSkyscraper size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0 pr-16">
                                                <h3 className="font-bold text-slate-800 leading-tight truncate">{project.projectName}</h3>
                                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                    <TbCalendar size={12} />
                                                    {formatDate(project.statusAsOfDate)}
                                                </p>
                                            </div>
                                            <div className="text-slate-300 group-hover:text-[#004A99] transition-colors pr-1">
                                                <TbArrowLeft className="rotate-180" size={20} />
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
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </PageTransition>
    );
};

export default ProjectValidation;
