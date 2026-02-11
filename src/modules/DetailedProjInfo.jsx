import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import { getCachedProjects, cacheGallery, getCachedGallery } from '../db';
import LocationPickerMap from '../components/LocationPickerMap';
import { TbPhoto } from "react-icons/tb";
import { auth } from '../firebase';
import EditProjectModal from '../components/EditProjectModal';
import { compressImage } from '../utils/imageCompression';
// import { addEngineerToOutbox } from '../db';

const DetailedProjInfo = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // New State for Images
    const [projectImages, setProjectImages] = useState([]);
    const [imageLoading, setImageLoading] = useState(true);

    // --- EDIT MODAL STATE ---
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [internalFiles, setInternalFiles] = useState([]);
    const [internalPreviews, setInternalPreviews] = useState([]);
    const [externalFiles, setExternalFiles] = useState([]);
    const [externalPreviews, setExternalPreviews] = useState([]);
    const [activeCategory, setActiveCategory] = useState('Internal');

    // Refs
    const fileInputRef = React.useRef(null);
    const cameraInputRef = React.useRef(null);

    const API_BASE = ""; // Or import from config

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

    // --- HANDLERS ---

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Limit removed
        const validFiles = files.filter(file => file.size <= 5 * 1024 * 1024);
        const newPreviews = validFiles.map(file => URL.createObjectURL(file));

        if (activeCategory === 'Internal') {
            setInternalFiles(prev => [...prev, ...validFiles]);
            setInternalPreviews(prev => [...prev, ...newPreviews]);
        } else {
            setExternalFiles(prev => [...prev, ...validFiles]);
            setExternalPreviews(prev => [...prev, ...newPreviews]);
        }

        e.target.value = null;
    };

    const removeFile = (index, category) => {
        if (category === 'Internal') {
            setInternalFiles(prev => prev.filter((_, i) => i !== index));
            setInternalPreviews(prev => prev.filter((_, i) => i !== index));
        } else {
            setExternalFiles(prev => prev.filter((_, i) => i !== index));
            setExternalPreviews(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleSaveProject = async (updatedProject) => {
        const user = auth.currentUser;
        if (!user) return;

        // CHECK: Mandatory Location
        // CHECK: Mandatory Location REMOVED per user request
        // if (!updatedProject.latitude || !updatedProject.longitude) {
        //     alert("⚠️ LOCATION REQUIRED\n\nPlease capture the project coordinates (Latitude/Longitude) before saving.");
        //     return;
        // }

        setIsUploading(true);
        try {
            // 1. Update Project Details
            const body = { ...updatedProject, uid: user.uid, modifiedBy: "Engineer" }; // Simplify userName for now or fetch it

            const response = await fetch(`${API_BASE}/api/update-project/${updatedProject.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error("Update failed");

            // 2. Upload Images
            const allFiles = [
                ...internalFiles.map(f => ({ file: f, category: 'Internal' })),
                ...externalFiles.map(f => ({ file: f, category: 'External' }))
            ];

            if (allFiles.length > 0) {
                for (const item of allFiles) {
                    try {
                        const base64Image = await compressImage(item.file);
                        await fetch(`${API_BASE}/api/upload-image`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ projectId: updatedProject.id, imageData: base64Image, uploadedBy: user.uid, category: item.category }),
                        });
                    } catch (err) {
                        console.error("Compression failed for file:", item.file.name, err);
                    }
                }
            }

            // 3. Refresh Data
            setProject(updatedProject);
            alert("Success: Project details updated!");
            setInternalFiles([]);
            setExternalFiles([]);
            setEditModalOpen(false);

            // Trigger refresh of images (optional, or just append locally)
            // For now simplest is to reload page or re-fetch images? 
            // Let's just append locally for immediate feedback if we had the image data, but we sent base64.
            // Re-fetching images is safer.
            const res = await fetch(`/api/project-images/${id}`);
            const data = await res.json();
            if (Array.isArray(data)) setProjectImages(data);

        } catch (err) {
            console.error("Save Error:", err);
            alert("Sync error. Try again later.");
        } finally {
            setIsUploading(false);
        }
    };


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

                    {/* EDIT BUTTON REMOVED PER USER REQUEST */}

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
                        <div className="mt-2 inline-block px-4 py-1.5 rounded-full border border-blue-400/30 bg-blue-900/30 backdrop-blur-sm">
                            <p className="text-[10px] uppercase font-black tracking-widest text-blue-200 mb-0.5">{project.projectCategory || 'Infrastructure Project'}</p>
                            <p className="text-blue-50 text-xs sm:text-sm font-bold leading-relaxed">
                                {project.projectName}
                            </p>
                        </div>
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
                            <DetailItem label="Start of Construction" value={project.constructionStartDate} />
                            <DetailItem label="Target Completion" value={project.targetCompletionDate} />

                            {/* Actual Completion with Late Logic */}
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Actual Completion</p>
                                <p className={`text-sm font-semibold ${project.actualCompletionDate && project.targetCompletionDate && new Date(project.actualCompletionDate) > new Date(project.targetCompletionDate)
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
                            <DetailItem label="Scope of Work" value={project.scopeOfWork} />
                            <div className="grid grid-cols-2 gap-3">
                                <DetailItem label="Allocation" value={project.projectAllocation} isMoney />
                                <DetailItem label="Batch of Funds" value={project.batchOfFunds} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <DetailItem label="Funds Utilized" value={project.fundsUtilized} isMoney />
                                <div className="hidden sm:block"></div> {/* Spacer */}
                            </div>

                            {/* Physical Specs */}
                            <div className="grid grid-cols-3 gap-3">
                                <DetailItem label="Classrooms" value={project.numberOfClassrooms} />
                                <DetailItem label="Storeys" value={project.numberOfStoreys} />
                                <DetailItem label="Sites" value={project.numberOfSites} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <DetailItem label="Region" value={project.region} />
                                <DetailItem label="Division" value={project.division} />
                            </div>
                        </div>
                    </div>



                    {/* Documents Section */}
                    <div>
                        <h3 className="text-slate-700 font-bold text-sm mb-2 ml-1">Project Documents</h3>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
                            {['pow_pdf', 'dupa_pdf', 'contract_pdf'].map(docKey => {
                                const docValue = project[docKey];
                                let label = docKey.replace('_pdf', '').toUpperCase();
                                return (
                                    <div key={docKey} className="flex justify-between items-center p-2 border-b border-slate-50 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-red-50 text-red-500 rounded-lg">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M10 13l-2.5 2.5 2.5 2.5" /><path d="M13 13l2.5 2.5-2.5 2.5" /></svg>
                                            </div>
                                            <span className="text-xs font-bold text-slate-700">{label}</span>
                                        </div>
                                        {docValue ? (
                                            <a
                                                href={docValue}
                                                download={`${project.schoolName}_${label}.pdf`}
                                                className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
                                            >
                                                Download PDF
                                            </a>
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                                                Not Available
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Location Section */}
                    <div>
                        <h3 className="text-slate-700 font-bold text-sm mb-2 ml-1">Project Location</h3>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Latitude</p>
                                    <p className="text-sm font-mono font-semibold text-slate-800">{project.latitude || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Longitude</p>
                                    <p className="text-sm font-mono font-semibold text-slate-800">{project.longitude || "N/A"}</p>
                                </div>
                            </div>

                            {/* Map Preview */}
                            {(project.latitude && project.longitude) && (
                                <div className="rounded-xl overflow-hidden shadow-inner border border-slate-200 mt-2 h-48 relative z-0">
                                    <LocationPickerMap
                                        latitude={project.latitude}
                                        longitude={project.longitude}
                                        disabled={true} // Read Only Mode
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Photos Section */}
                    <div className="space-y-6 pt-4 border-t border-slate-200">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-slate-700 font-bold text-sm flex items-center gap-2">
                                <TbPhoto /> Project Documentation
                            </h3>
                            <span className="bg-slate-200 text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-full">
                                {projectImages.length} Total
                            </span>
                        </div>

                        {imageLoading ? (
                            <div className="bg-white rounded-2xl p-8 border border-slate-100 flex justify-center">
                                <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <>
                                {/* EXTERNAL (First) */}
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 ml-1">External Photos</h4>
                                    {projectImages.filter(img => img.category && img.category.toLowerCase() === 'external').length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            {projectImages.filter(img => img.category && img.category.toLowerCase() === 'external').map((img, idx) => {
                                                const getImageSrc = (imageItem) => {
                                                    if (imageItem.image_url) return imageItem.image_url;
                                                    if (imageItem.image_data) {
                                                        let base64 = imageItem.image_data;
                                                        if (typeof base64 === 'string' && base64.trim().startsWith('{')) {
                                                            try {
                                                                const parsed = JSON.parse(base64);
                                                                base64 = parsed.image_data || parsed;
                                                            } catch (e) {
                                                                // keep as is
                                                            }
                                                        }
                                                        // Ensure prefix
                                                        if (typeof base64 === 'string' && !base64.startsWith("http") && !base64.startsWith("data:")) {
                                                            return `data:image/jpeg;base64,${base64}`;
                                                        }
                                                        return base64;
                                                    }
                                                    return null;
                                                };
                                                const imgSrc = getImageSrc(img);

                                                return (
                                                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-200 shadow-sm border border-white group">
                                                        <img
                                                            src={imgSrc}
                                                            alt={`External ${idx}`}
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                            onError={(e) => { e.target.style.display = 'none' }}
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                                                            <p className="text-white text-[10px] font-medium truncate w-full">By: {img.uploaded_by}</p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 rounded-xl p-4 text-center border border-dashed border-slate-200 text-slate-400 text-xs italic">
                                            No external photos uploaded.
                                        </div>
                                    )}
                                </div>

                                {/* INTERNAL (Second) */}
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 ml-1">Internal Photos</h4>
                                    {projectImages.filter(img => !img.category || img.category.toLowerCase() !== 'external').length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            {projectImages.filter(img => !img.category || img.category.toLowerCase() !== 'external').map((img, idx) => {
                                                const getImageSrc = (imageItem) => {
                                                    if (imageItem.image_url) return imageItem.image_url;
                                                    if (imageItem.image_data) {
                                                        let base64 = imageItem.image_data;
                                                        if (typeof base64 === 'string' && base64.trim().startsWith('{')) {
                                                            try {
                                                                const parsed = JSON.parse(base64);
                                                                base64 = parsed.image_data || parsed;
                                                            } catch (e) {
                                                                // keep as is
                                                            }
                                                        }
                                                        if (typeof base64 === 'string' && !base64.startsWith("http") && !base64.startsWith("data:")) {
                                                            return `data:image/jpeg;base64,${base64}`;
                                                        }
                                                        return base64;
                                                    }
                                                    return null;
                                                };
                                                const imgSrc = getImageSrc(img);

                                                return (
                                                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-200 shadow-sm border border-white group">
                                                        <img
                                                            src={imgSrc}
                                                            alt={`Internal ${idx}`}
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                            onError={(e) => { e.target.style.display = 'none' }}
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                                                            <p className="text-white text-[10px] font-medium truncate w-full">By: {img.uploaded_by}</p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 rounded-xl p-4 text-center border border-dashed border-slate-200 text-slate-400 text-xs italic">
                                            No internal photos uploaded.
                                        </div>
                                    )}
                                </div>
                            </>
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

                {/* --- HIDDEN INPUTS & MODALS --- */}
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                <input type="file" ref={cameraInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />

                <EditProjectModal
                    project={project}
                    isOpen={editModalOpen}
                    mode="full"
                    onClose={() => setEditModalOpen(false)}
                    onSave={handleSaveProject}
                    onCameraClick={(category) => {
                        setActiveCategory(category);
                        cameraInputRef.current?.click();
                    }}
                    onGalleryClick={(category) => {
                        setActiveCategory(category);
                        fileInputRef.current?.click();
                    }}
                    internalPreviews={internalPreviews}
                    externalPreviews={externalPreviews}
                    onRemoveFile={removeFile}
                    isUploading={isUploading}
                />
            </div>
        </PageTransition>
    );
};

export default DetailedProjInfo;