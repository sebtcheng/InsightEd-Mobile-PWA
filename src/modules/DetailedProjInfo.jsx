import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition'; // Assuming you have this
import { getCachedProjects, cacheGallery, getCachedGallery } from '../db';

import { TbPhoto } from "react-icons/tb";

const DetailedProjInfo = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // New State for Images
    const [projectImages, setProjectImages] = useState([]);
    const [imageLoading, setImageLoading] = useState(true);

    useEffect(() => {
        const fetchProjectDetails = async () => {
            // Stale-While-Revalidate Strategy
            
            // 1. Immediate Cache Load
            try {
                const cachedProjects = await getCachedProjects();
                const foundProject = cachedProjects.find(p => String(p.id) === String(id));
                if (foundProject) {
                    setProject(foundProject);
                    setIsLoading(false); // Render fast
                }
            } catch (err) {
                 console.warn("Cache read failed", err);
            }

            // 2. Network Request (Background Sync)
            try {
                const response = await fetch(`/api/projects/${id}?_t=${Date.now()}`);
                if (!response.ok) throw new Error("Project not found");
                const data = await response.json();
                setProject(data);
                
                // TODO: Update cache with new details if needed (currently we only cache list)
                // For a robust app, we might want to update the single item in the `projects_cache` array here.

            } catch (err) {
                console.warn("Network fetch failed:", err);
                // If we have cached data, we are fine.
                // If we didn't have cache, we might want to show error or navigate away
                if (!project) {
                    // Logic: If NO project in state (cache failed/empty) AND network failed -> Show Error
                     const cachedProjects = await getCachedProjects();
                     const foundProject = cachedProjects.find(p => String(p.id) === String(id));
                     if (!foundProject) {
                         alert("Could not load project details (Offline & Not Cached).");
                         navigate('/engineer-dashboard');
                     }
                }
            } finally {
                // Ensure loading state is off eventually
                setIsLoading(false);
            }
        };

        const fetchImages = async () => {
            setImageLoading(true);
            try {
                // Network First
                const res = await fetch(`/api/project-images/${id}`);
                const data = await res.json();
                
                if (Array.isArray(data)) {
                    setProjectImages(data);
                    // Update Gallery Cache
                    await cacheGallery(id, data);
                } else {
                    console.warn("API did not return an array for images:", data);
                    setProjectImages([]);
                }
            } catch (error) {
                console.warn("Online gallery load failed, checking cache:", error);
                
                // Cache Fallback
                try {
                   const cachedImages = await getCachedGallery(id);
                   if (cachedImages && cachedImages.length > 0) {
                      setProjectImages(cachedImages);
                   }
                } catch (cacheErr) {
                   console.error("Cache retrieval failed", cacheErr);
                }
            } finally {
                setImageLoading(false);
            }
        };

        fetchProjectDetails();
        fetchImages();
    }, [id, navigate]);

    if (isLoading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading details...</div>;
    if (!project) return null;

    // Helper for display fields
    const DetailItem = ({ label, value, isMoney }) => (
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">{label}</p>
            <p className="text-sm font-semibold text-slate-800">
                {isMoney && value ? `₱${(Number(value)).toLocaleString()}` : (value || 'N/A')}
            </p>
        </div>
    );

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 pb-10">
                {/* Header */}
                <div className="bg-[#004A99] px-6 pt-8 pb-16 rounded-b-[2.5rem] shadow-lg relative">
                    <button onClick={() => navigate(-1)} className="absolute top-8 left-6 text-blue-200 hover:text-white text-sm font-bold flex items-center gap-1">
                        ← Back
                    </button>
                    <div className="mt-8 text-center relative z-10">
                        {/* Premium ID Badges */}
                        <div className="flex flex-wrap justify-center items-center gap-3 mb-4">
                             {/* School ID Pill */}
                             <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-lg group hover:bg-white/15 transition-all">
                                <span className="text-[9px] text-blue-200 uppercase font-black tracking-widest group-hover:text-blue-100 transition-colors">School ID</span>
                                <div className="h-3 w-[1px] bg-white/20"></div>
                                <span className="text-sm text-white font-mono font-bold tracking-wider shadow-black drop-shadow-sm">{project.schoolId}</span>
                            </div>

                            {/* IPC Pill */}
                            {project.ipc && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 backdrop-blur-md rounded-xl border border-emerald-400/30 shadow-lg shadow-emerald-900/20 group hover:bg-emerald-500/30 transition-all">
                                     <span className="text-[9px] text-emerald-200 uppercase font-black tracking-widest group-hover:text-emerald-100 transition-colors">InsightEd Project Code</span>
                                     <div className="h-3 w-[1px] bg-emerald-400/30"></div>
                                     <span className="text-sm text-emerald-50 font-mono font-bold tracking-wider shadow-black drop-shadow-sm">{project.ipc}</span>
                                </div>
                            )}
                        </div>
                        
                        <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight drop-shadow-md">{project.schoolName}</h1>
                        <p className="text-blue-100/80 text-xs sm:text-sm font-medium mt-2 max-w-md mx-auto leading-relaxed border-t border-blue-400/30 pt-2 inline-block px-4">
                            {project.projectName}
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="px-5 -mt-8 relative z-10 space-y-4">
                    
                    {/* Status Card */}
                    <div className="bg-white p-5 rounded-2xl shadow-md border-l-4 border-blue-500 flex justify-between items-center">
                        <div>
                            <p className="text-xs text-slate-500 font-bold uppercase">Current Status</p>
                            <p className="text-lg font-bold text-[#004A99]">{project.status}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-bold text-slate-200">{project.accomplishmentPercentage}%</p>
                            <p className="text-[10px] text-slate-400">Completion</p>
                        </div>
                    </div>

                    {/* Timeline Section */}
                    <div>
                        <h3 className="text-slate-700 font-bold text-sm mb-2 ml-1">Timeline</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <DetailItem label="Notice to Proceed" value={project.noticeToProceed} />
                            <DetailItem label="Target Completion" value={project.targetCompletionDate} />
                            
                            {/* Actual Completion with Late Logic */}
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Actual Completion</p>
                                <p className={`text-sm font-semibold ${
                                    project.actualCompletionDate && project.targetCompletionDate && new Date(project.actualCompletionDate) > new Date(project.targetCompletionDate)
                                    ? "text-red-600"
                                    : "text-slate-800"
                                }`}>
                                    {project.actualCompletionDate || 'N/A'}
                                </p>
                                {project.actualCompletionDate && project.targetCompletionDate && new Date(project.actualCompletionDate) > new Date(project.targetCompletionDate) && (
                                    <div className="absolute top-0 right-0 bg-red-100 text-red-600 text-[9px] font-bold px-2 py-1 rounded-bl-lg">
                                        LATE
                                    </div>
                                )}
                            </div>

                            <DetailItem label="Status As Of" value={project.statusAsOfDate} />
                        </div>
                    </div>

                    {/* Financial & Contractor Section */}
                    <div>
                        <h3 className="text-slate-700 font-bold text-sm mb-2 ml-1">Project Details</h3>
                        <div className="space-y-3">
                            <DetailItem label="Contractor" value={project.contractorName} />
                            <div className="grid grid-cols-2 gap-3">
                                <DetailItem label="Allocation" value={project.projectAllocation} isMoney />
                                <DetailItem label="Batch of Funds" value={project.batchOfFunds} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <DetailItem label="Region" value={project.region} />
                                <DetailItem label="Division" value={project.division} />
                            </div>
                        </div>
                    </div>

                    {/* Photos Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-slate-700 font-bold text-sm flex items-center gap-2">
                                <TbPhoto /> Project Photos
                            </h3>
                            <span className="bg-slate-200 text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-full">
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
                                            <p className="text-white text-[10px] font-medium truncate w-full">By: {img.uploaded_by}</p>
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

                    {/* Remarks Section */}
                    {project.otherRemarks && (
                        <div className="bg-amber-50 p-5 rounded-xl border border-amber-100 text-amber-900">
                            <p className="text-[10px] font-bold uppercase opacity-70 mb-2">📢 Remarks / Issues</p>
                            <p className="text-sm italic">"{project.otherRemarks}"</p>
                        </div>
                    )}

                </div>
            </div>
        </PageTransition>
    );
};

export default DetailedProjInfo;