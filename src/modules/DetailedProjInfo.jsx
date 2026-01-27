import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition'; // Assuming you have this

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
            try {
                const response = await fetch(`/api/projects/${id}`);
                if (!response.ok) throw new Error("Project not found");
                const data = await response.json();
                setProject(data);
            } catch (err) {
                console.error("Error:", err);
                alert("Could not load project details.");
                navigate('/engineer-dashboard');
            } finally {
                setIsLoading(false);
            }
        };

        const fetchImages = async () => {
            setImageLoading(true);
            try {
                const res = await fetch(`/api/project-images/${id}`);
                const data = await res.json();
                setProjectImages(data);
            } catch (error) {
                console.error("Error loading images:", error);
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
                    <div className="mt-6 text-center">
                        <span className="inline-block px-3 py-1 bg-white/10 text-blue-100 text-[10px] rounded-full mb-2 border border-blue-400/30">
                            ID: {project.schoolId}
                        </span>
                        <h1 className="text-2xl font-bold text-white leading-tight">{project.schoolName}</h1>
                        <p className="text-blue-200 text-sm mt-1">{project.projectName}</p>
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
                            <DetailItem label="Actual Completion" value={project.actualCompletionDate} />
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