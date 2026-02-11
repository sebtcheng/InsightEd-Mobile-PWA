import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import PageTransition from '../components/PageTransition'; // Assuming you have this
import { getCachedProjects, cacheGallery, getCachedGallery } from '../db';
import LocationPickerMap from '../components/LocationPickerMap';
import { TbPhoto } from "react-icons/tb";

const DetailedProjInfo = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const type = searchParams.get('type'); // 'LGU' or null
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
                 if (type === 'LGU') {
                    // LGU Fetch
                    try {
                        const response = await fetch(`/api/lgu/project/${id}`);
                        if (!response.ok) throw new Error("LGU Project not found");
                        const data = await response.json();
                        
                        // MAP LGU Data to Component State Format
                        const mappedProject = {
                            id: data.project_id,
                            schoolId: data.school_id,
                            schoolName: data.school_name,
                            projectName: data.project_name,
                            projectCategory: 'LGU Project', // Or derive
                            ipc: data.ipc,
                            status: data.status,
                            accomplishmentPercentage: data.accomplishment_percentage,
                            
                            // Dates (API already formatted these in the specific endpoint)
                            noticeToProceed: data.noticeToProceed, 
                            constructionStartDate: data.construction_start_date,
                            targetCompletionDate: data.targetCompletionDate,
                            actualCompletionDate: data.actualCompletionDate,
                            statusAsOfDate: data.statusAsOfDate,
                            
                            // Financial
                            contractorName: data.contractor_name,
                            scopeOfWork: data.scope_of_works || data.scope_of_work, // LGU uses plural in some places?
                            projectAllocation: data.project_allocation, // or contract_amount?
                            batchOfFunds: data.batch_of_funds || data.fund_source, // Map fund source here or separate?
                            fundsUtilized: data.funds_utilized,
                            
                            // Specs
                            numberOfClassrooms: null, // LGU might not have this
                            numberOfStoreys: null,
                            numberOfSites: null,
                            
                            region: data.region,
                            division: data.division,
                            
                            // Docs
                            pow_pdf: data.pow_pdf,
                            dupa_pdf: data.dupa_pdf,
                            contract_pdf: data.contract_pdf,
                            
                            // Loc
                            latitude: data.latitude,
                            longitude: data.longitude,
                            
                            otherRemarks: data.other_remarks,

                            // Extra LGU Fields
                            lguData: {
                                sourceAgency: data.source_agency,
                                lsbResolutionNo: data.lsb_resolution_no,
                                moaRefNo: data.moa_ref_no,
                                validityPeriod: data.validity_period,
                                contractDuration: data.contract_duration,
                                modeOfProcurement: data.mode_of_procurement,
                                philgepsRefNo: data.philgeps_ref_no,
                                pcabLicenseNo: data.pcab_license_no,
                                dateContractSigning: data.date_contract_signing,
                                bidAmount: data.bid_amount,
                                natureOfDelay: data.nature_of_delay
                            },
                             // IMAGES (LGU endpoint returns them included)
                             images: data.images || []
                        };

                        setProject(mappedProject);
                        
                        // Perform direct image set since LGU endpoint returns them
                        if(data.images){
                             setProjectImages(data.images);
                             setImageLoading(false);
                        }

                    } catch (lguErr) {
                         console.error("LGU Fetch Failed:", lguErr);
                         // Logic: If NO project in state (cache failed/empty) AND network failed -> Show Error
                         // ... (existing error logic)
                         alert("Could not load LGU project details.");
                         navigate('/lgu-projects');
                    }
                    return; // Exit main try/catch flow
                 }

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
            if (type === 'LGU') return; // LGU images handled in main fetch
            
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

                    {/* LGU SPECIFIC DETAILS SECTION */}
                    {project.lguData && (
                        <div>
                            <h3 className="text-slate-700 font-bold text-sm mb-2 ml-1">LGU Procurement & Agreement</h3>
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <DetailItem label="Source Agency" value={project.lguData.sourceAgency} />
                                    <DetailItem label="Mode of Procurement" value={project.lguData.modeOfProcurement} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                     <DetailItem label="LSB Res. No." value={project.lguData.lsbResolutionNo} />
                                     <DetailItem label="MOA Ref No." value={project.lguData.moaRefNo} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <DetailItem label="Validity Period" value={project.lguData.validityPeriod} />
                                    <DetailItem label="Contract Duration" value={project.lguData.contractDuration} />
                                </div>
                                 <div className="grid grid-cols-2 gap-3">
                                    <DetailItem label="PhilGEPS Ref" value={project.lguData.philgepsRefNo} />
                                    <DetailItem label="PCAB License" value={project.lguData.pcabLicenseNo} />
                                </div>
                                 <div className="grid grid-cols-2 gap-3">
                                    <DetailItem label="Bid Amount" value={project.lguData.bidAmount} isMoney/>
                                    <DetailItem label="Contract Signing" value={project.lguData.dateContractSigning} />
                                </div>
                                {project.lguData.natureOfDelay && (
                                     <div className="text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                                        <p className="text-[10px] uppercase font-bold opacity-70 mb-1">Nature of Delay</p>
                                        <p className="text-sm font-semibold">{project.lguData.natureOfDelay}</p>
                                     </div>
                                )}
                            </div>
                        </div>
                    )}



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
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13l-2.5 2.5 2.5 2.5"/><path d="M13 13l2.5 2.5-2.5 2.5"/></svg>
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
                                                        onError={(e) => {e.target.style.display = 'none'}}
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                                                        <p className="text-white text-[10px] font-medium truncate w-full">By: {img.uploaded_by}</p>
                                                    </div>
                                                </div>
                                            )})}
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
                                                        onError={(e) => {e.target.style.display = 'none'}}
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                                                        <p className="text-white text-[10px] font-medium truncate w-full">By: {img.uploaded_by}</p>
                                                    </div>
                                                </div>
                                            )})}
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
            </div>
        </PageTransition>
    );
};

export default DetailedProjInfo;