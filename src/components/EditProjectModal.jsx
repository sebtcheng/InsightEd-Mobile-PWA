import React, { useState, useEffect, useRef } from 'react';
import { FiSettings } from 'react-icons/fi';
import LocationPickerMap from './LocationPickerMap';
import { compressImage } from '../utils/imageCompression'; // Assuming this utility exists or will be moved

// --- CONSTANTS ---
const ProjectStatus = {
    UnderProcurement: "Under Procurement",
    NotYetStarted: "Not Yet Started",
    Ongoing: "Ongoing",
    ForFinalInspection: "For Final Inspection",
    Completed: "Completed",
};

const DOC_TYPES = {
    POW: "Program of Works",
    DUPA: "DUPA",
    CONTRACT: "Signed Contract"
};

const formatDateShort = (dateString) => {
    if (!dateString) return "TBD";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "2-digit",
    });
};

const convertFullFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

const EditProjectModal = ({
    project,
    isOpen,
    onClose,
    onSave,
    // mode: 'full' | 'quick'
    mode = 'full',

    // Handlers for external state management (if needed, or handle internally)
    // For simplicity, we can handle file state internally if we pass it out on save,
    // but EngineerProjects.jsx handles it externally. Let's keep the existing pattern 
    // where the parent manages the file state for now to minimize refactor risk, 
    // or better: encapsulate it here? 
    // Given EngineerProjects.jsx has complex file handling, let's accept props first.

    onCameraClick,
    onGalleryClick,
    internalPreviews,
    externalPreviews,
    onRemoveFile,
    isUploading,

    // Optional: For internal logic if not provided
    internalFiles, // Array of File objects
    externalFiles  // Array of File objects
}) => {
    const [formData, setFormData] = useState(null);

    // Local document state (for 'full' mode)
    const [documents, setDocuments] = useState({
        POW: null,
        DUPA: null,
        CONTRACT: null
    });

    useEffect(() => {
        if (project) {
            setFormData({
                ...project,
                // Ensure fields exist to control inputs
                latitude: project.latitude || '',
                longitude: project.longitude || '',
                // Populate all fields
                projectCategory: project.projectCategory || '',
                projectName: project.projectName || '',
                scopeOfWork: project.scopeOfWork || '',
                numberOfStoreys: project.numberOfStoreys || '',
                numberOfClassrooms: project.numberOfClassrooms || '',
                numberOfSites: project.numberOfSites || '',
                schoolId: project.schoolId || '',
                schoolName: project.schoolName || '',
                region: project.region || '',
                division: project.division || '',
                targetCompletionDate: project.targetCompletionDate || '',
                noticeToProceed: project.noticeToProceed || '',
                constructionStartDate: project.constructionStartDate || '',
                contractorName: project.contractorName || '',
                projectAllocation: project.projectAllocation || '',
                batchOfFunds: project.batchOfFunds || '',
                fundsUtilized: project.fundsUtilized || '',
                statusAsOfDate: project.statusAsOfDate || new Date().toISOString().split('T')[0], // Default to today if missing
                accomplishmentPercentage: project.accomplishmentPercentage || 0,
                status: project.status || ProjectStatus.NotYetStarted,
                otherRemarks: project.otherRemarks || ''
            });
            // Reset docs on open
            setDocuments({ POW: null, DUPA: null, CONTRACT: null });
        }
    }, [project, isOpen]);

    // --- Document Handlers ---
    const handleDocumentSelect = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            if (file.type !== "application/pdf") {
                alert("⚠️ INVALID FORMAT\n\nPlease upload a valid PDF file.");
                return;
            }
            // Limit to 25MB (Safety buffer for 50MB payload limit)
            if (file.size > 25 * 1024 * 1024) {
                alert("⚠️ FILE TOO LARGE\n\nMaximum file size is 25MB per document.");
                return;
            }
            setDocuments(prev => ({ ...prev, [type]: file }));
        }
    };

    const removeDocument = (type) => {
        setDocuments(prev => ({ ...prev, [type]: null }));
    };

    if (!isOpen || !formData) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            let newData = { ...prev, [name]: value };

            // Force Uppercase for Scope of Work & Batch of Funds
            if (['scopeOfWork', 'batchOfFunds', 'projectCategory'].includes(name)) {
                newData[name] = value.toUpperCase();
            }

            if (name === "accomplishmentPercentage") {
                // Remove leading zeros
                if (value.length > 1 && value.startsWith('0')) {
                    value = value.replace(/^0+/, '');
                    newData.accomplishmentPercentage = value;
                }

                // Limit 0-100
                let percent = parseFloat(value);
                if (percent < 0) { percent = 0; newData.accomplishmentPercentage = 0; }
                if (percent > 100) { percent = 100; newData.accomplishmentPercentage = 100; }

                if (percent === 100) {
                    if (prev.status !== ProjectStatus.Completed)
                        newData.status = ProjectStatus.ForFinalInspection;
                } else if (percent >= 1 && percent < 100) {
                    if (
                        prev.status === ProjectStatus.Completed ||
                        prev.status === ProjectStatus.ForFinalInspection
                    )
                        newData.status = ProjectStatus.Ongoing;
                } else if (percent === 0) newData.status = ProjectStatus.NotYetStarted;
            }
            if (name === "status") {
                if (
                    value === ProjectStatus.NotYetStarted ||
                    value === ProjectStatus.UnderProcurement
                )
                    newData.accomplishmentPercentage = 0;
                else if (
                    value === ProjectStatus.Completed ||
                    value === ProjectStatus.ForFinalInspection
                )
                    newData.accomplishmentPercentage = 100;
            }
            return newData;
        });
    };

    const handleUpdatePercentage = (newVal) => {
        const percent = Math.min(100, Math.max(0, Number(newVal)));
        setFormData((prev) => {
            let newData = { ...prev, accomplishmentPercentage: percent };

            if (percent === 100) {
                if (prev.status !== ProjectStatus.Completed)
                    newData.status = ProjectStatus.ForFinalInspection;
            } else if (percent >= 1 && percent < 100) {
                if (
                    prev.status === ProjectStatus.Completed ||
                    prev.status === ProjectStatus.ForFinalInspection
                )
                    newData.status = ProjectStatus.Ongoing;
            } else if (percent === 0) {
                newData.status = ProjectStatus.NotYetStarted;
            }
            return newData;
        });
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            alert("❌ Geolocation is not supported by your browser.");
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(6);
                const long = position.coords.longitude.toFixed(6);

                setFormData(prev => ({
                    ...prev,
                    latitude: lat,
                    longitude: long
                }));
                // alert(`✅ Coordinates Captured!\nLat: ${lat}\nLong: ${long}`);
            },
            (error) => {
                console.warn("Geolocation warning:", error);
                let msg = "Unable to retrieve location.";
                if (error.code === 1) msg = "❌ Location permission denied.";
                else if (error.code === 2) msg = "❌ Position unavailable.";
                else if (error.code === 3) msg = "❌ Timeout.";
                alert(msg);
            },
            options
        );
    };

    const handleLocationSelect = (lat, lng) => {
        setFormData(prev => ({
            ...prev,
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6)
        }));
    };

    const isDisabledPercentageInput =
        formData.status === ProjectStatus.NotYetStarted ||
        formData.status === ProjectStatus.UnderProcurement ||
        formData.status === ProjectStatus.Completed ||
        formData.status === ProjectStatus.ForFinalInspection;

    // --- Render Sections Helpers ---

    const renderProjectDetails = () => (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Project Details</h3>

            {/* Category & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                    <input name="projectCategory" value={formData.projectCategory} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Project Name</label>
                    <input name="projectName" value={formData.projectName} readOnly className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-xs" />
                </div>
            </div>

            {/* Scope of Work */}
            <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Scope of Work</label>
                <textarea name="scopeOfWork" rows="2" value={formData.scopeOfWork} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs resize-none" />
            </div>

            {/* Stats: Classrooms, Storeys, Sites */}
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Classrooms</label>
                    <input type="number" name="numberOfClassrooms" value={formData.numberOfClassrooms} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Storeys</label>
                    <input type="number" name="numberOfStoreys" value={formData.numberOfStoreys} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sites</label>
                    <input type="number" name="numberOfSites" value={formData.numberOfSites} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
            </div>

            {/* School Info (ReadOnly) */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">School ID</label>
                    <input value={formData.schoolId} readOnly className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">School Name</label>
                    <input value={formData.schoolName} readOnly className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-xs" />
                </div>
            </div>
        </div>
    );

    const renderTimelineAndFunds = () => (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Timeline & Funds</h3>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Completion</label>
                    <input type="date" name="targetCompletionDate" value={formData.targetCompletionDate} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notice to Proceed</label>
                    <input type="date" name="noticeToProceed" value={formData.noticeToProceed} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Construction Start</label>
                    <input type="date" name="constructionStartDate" value={formData.constructionStartDate} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contractor</label>
                    <input name="contractorName" value={formData.contractorName} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Allocation</label>
                    <input type="number" name="projectAllocation" value={formData.projectAllocation} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Batch</label>
                    <input name="batchOfFunds" value={formData.batchOfFunds} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
            </div>
        </div>
    );

    const renderStatusAndProgress = () => (
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Status</label>
                <div className="relative">
                    <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    >
                        {Object.values(ProjectStatus).map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <FiSettings className="text-slate-400" />
                    </div>
                </div>
            </div>
            {!['Not Yet Started', 'Under Procurement'].includes(formData.status) && (
                <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Percentage (%)</label>
                        <div className="flex gap-1.5">
                            <button type="button" onClick={() => handleUpdatePercentage(Number(formData.accomplishmentPercentage || 0) + 5)} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded hover:bg-blue-100 transition">+5%</button>
                            <button type="button" onClick={() => handleUpdatePercentage(Number(formData.accomplishmentPercentage || 0) + 10)} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded hover:bg-blue-100 transition">+10%</button>
                        </div>
                    </div>
                    <input
                        type="number"
                        name="accomplishmentPercentage"
                        value={formData.accomplishmentPercentage}
                        onChange={handleChange}
                        min="0"
                        max="100"
                        disabled={isDisabledPercentageInput}
                        className={`w-full p-3 border rounded-2xl text-sm font-black text-center ${isDisabledPercentageInput
                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                            : "bg-blue-50 text-[#004A99] border-blue-100 focus:ring-2 focus:ring-blue-500 outline-none"
                            }`}
                    />
                </div>
            )}
        </div>
    );

    const renderFundsUtilized = () => (
        // For Quick Mode: Standalone Funds Utilized input
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Funds Utilized</label>
            <input type="number" name="fundsUtilized" value={formData.fundsUtilized} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center z-[1100] p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
                {/* --- HEADER --- */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Update Project</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {mode === 'quick' ? 'Quick Status Update' : (mode === 'docs_only' ? 'Upload Documents' : 'Full Project Edit')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* --- BODY --- */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">

                    {/* FULL MODE: Project Details */}
                    {mode === 'full' && renderProjectDetails()}

                    {/* FULL MODE: Timeline & Funds (Part 1 - Allocation, Batch) */}
                    {mode === 'full' && renderTimelineAndFunds()}

                    {/* COMMON: Status & Percentage - SHOW ONLY IN QUICK MODE PER USER REQUEST */}
                    {mode === 'quick' && renderStatusAndProgress()}

                    {/* COMMON: Funds Utilized */}
                    {/* In full mode, this is inside renderTimelineAndFunds. In quick mode, render here. */}
                    {mode === 'quick' && renderFundsUtilized()}

                    {/* COMMON: Site Photos - SHOW ONLY IN QUICK MODE PER USER REQUEST */}
                    {mode === 'quick' && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Site Photos</h3>
                            <div className="space-y-4">
                                {/* External */}
                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase">External Photos</span>
                                        <span className="text-[9px] font-bold text-blue-500">{externalPreviews?.length || 0} Added</span>
                                    </div>
                                    <div className="text-[9px] text-slate-400 mb-2 italic space-y-0.5">
                                        <p>• Front, Left, Right, Rear (wide shots)</p>
                                        <p>• Orthographic at height 20-30m (optional)</p>
                                    </div>
                                    <div className="flex gap-2 mb-2">
                                        <button onClick={() => onCameraClick('External')} className="flex-1 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-[9px] font-black uppercase hover:border-blue-400 hover:text-blue-500 transition-all">
                                            📷 Camera
                                        </button>
                                        <button onClick={() => onGalleryClick('External')} className="flex-1 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-[9px] font-black uppercase hover:border-blue-400 hover:text-blue-500 transition-all">
                                            🖼️ Gallery
                                        </button>
                                    </div>
                                    {externalPreviews?.length > 0 && (
                                        <div className="grid grid-cols-4 gap-2">
                                            {externalPreviews.map((url, index) => (
                                                <div key={index} className="relative aspect-square rounded-lg overflow-hidden ring-1 ring-slate-200">
                                                    <img src={url} alt="external" className="w-full h-full object-cover" />
                                                    <button onClick={() => onRemoveFile(index, 'External')} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-[8px] flex items-center justify-center">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Internal */}
                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase">Internal Photos</span>
                                        <span className="text-[9px] font-bold text-blue-500">{internalPreviews?.length || 0} Added</span>
                                    </div>
                                    <div className="text-[9px] text-slate-400 mb-2 italic space-y-0.5">
                                        <p>• Classrooms (2-3): Wide shot from doorway/corner, Camera at 1.4-1.6m height, Facing longest wall.</p>
                                        <p>• Key indicators: Ceiling, Lighting, Outlets, Painted walls, Floor condition.</p>
                                    </div>
                                    <div className="flex gap-2 mb-2">
                                        <button onClick={() => onCameraClick('Internal')} className="flex-1 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-[9px] font-black uppercase hover:border-blue-400 hover:text-blue-500 transition-all">
                                            📷 Camera
                                        </button>
                                        <button onClick={() => onGalleryClick('Internal')} className="flex-1 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-[9px] font-black uppercase hover:border-blue-400 hover:text-blue-500 transition-all">
                                            🖼️ Gallery
                                        </button>
                                    </div>
                                    {internalPreviews?.length > 0 && (
                                        <div className="grid grid-cols-4 gap-2">
                                            {internalPreviews.map((url, index) => (
                                                <div key={index} className="relative aspect-square rounded-lg overflow-hidden ring-1 ring-slate-200">
                                                    <img src={url} alt="internal" className="w-full h-full object-cover" />
                                                    <button onClick={() => onRemoveFile(index, 'Internal')} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-[8px] flex items-center justify-center">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FULL OR DOCS_ONLY MODE: Documents */}
                    {(mode === 'full' || mode === 'docs_only') && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">📄</span>
                                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Update Documents</h3>
                            </div>
                            <p className="text-xs text-slate-400 -mt-2 mb-2">Upload new PDFs to replace existing ones.</p>

                            <div className="space-y-2">
                                {Object.entries(DOC_TYPES).map(([key, label]) => (
                                    <div key={key} className={`p-3 rounded-xl border transition-all ${documents[key] ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${documents[key] ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                    {label}
                                                </p>
                                                {documents[key] ? (
                                                    <p className="text-[9px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        {documents[key].name}
                                                    </p>
                                                ) : (
                                                    project && project[`${key.toLowerCase()}_pdf`] ? (
                                                        <p className="text-[9px] text-blue-500 font-bold mt-0.5">Existing File Available</p>
                                                    ) : (
                                                        <p className="text-[9px] text-slate-400 mt-0.5">No file uploaded</p>
                                                    )
                                                )}
                                            </div>
                                            <div>
                                                {documents[key] ? (
                                                    <button
                                                        onClick={() => removeDocument(key)}
                                                        className="w-6 h-6 rounded-full bg-white text-red-500 shadow-sm border border-red-100 flex items-center justify-center hover:bg-red-50"
                                                    >
                                                        ✕
                                                    </button>
                                                ) : (
                                                    <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-200 shadow-sm rounded-lg text-[9px] font-bold text-slate-600 uppercase tracking-wider hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95">
                                                        Upload
                                                        <input
                                                            type="file"
                                                            accept=".pdf"
                                                            className="hidden"
                                                            onChange={(e) => handleDocumentSelect(e, key)}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}


                    {/* LOCATION REMOVED PER USER REQUEST */}

                    {mode === 'quick' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Date</label>
                            <input
                                type="date"
                                name="statusAsOfDate"
                                value={formData.statusAsOfDate}
                                onChange={handleChange}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                max={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    )}

                    {/* CHECK: Conditional Actual Completion Date for Completed Status */}
                    {mode === 'quick' && formData.status === ProjectStatus.Completed && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actual Completion Date</label>
                                {formData.actualCompletionDate && formData.targetCompletionDate && new Date(formData.actualCompletionDate) > new Date(formData.targetCompletionDate) && (
                                    <span className="text-[9px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase tracking-widest animate-pulse">
                                        ⚠️ Late Completion
                                    </span>
                                )}
                            </div>
                            <input
                                type="date"
                                name="actualCompletionDate"
                                value={formData.actualCompletionDate || ""}
                                onChange={handleChange}
                                className={`w-full p-3 border rounded-2xl text-sm font-bold shadow-sm transition-all outline-none ${formData.actualCompletionDate && formData.targetCompletionDate && new Date(formData.actualCompletionDate) > new Date(formData.targetCompletionDate)
                                    ? "bg-red-50 border-red-200 text-red-700 focus:ring-2 focus:ring-red-200"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-2 focus:ring-emerald-200"
                                    }`}
                            />
                            <p className="text-[9px] text-slate-400 ml-1 italic">
                                Target was: {formatDateShort(formData.targetCompletionDate)}
                            </p>
                        </div>
                    )}

                    {/* FULL MODE: Remarks */}
                    {mode === 'full' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remarks</label>
                            <textarea
                                name="otherRemarks"
                                value={formData.otherRemarks || ""}
                                onChange={handleChange}
                                rows={3}
                                placeholder="Enter site observations or issues..."
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            />
                        </div>
                    )}

                </div>

                {/* --- FOOTER --- */}
                <div className="p-6 border-t border-slate-100 flex gap-4 bg-white">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 text-slate-500 font-black text-xs uppercase tracking-widest bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={async () => {
                            // VALIDATION
                            const requiredFields = [
                                { key: 'statusAsOfDate', label: 'Status Date' },
                                { key: 'accomplishmentPercentage', label: 'Accomplishment %' }
                                // { key: 'otherRemarks', label: 'Remarks' } // REMOVED: Optional
                            ];

                            for (const field of requiredFields) {
                                if (formData[field.key] === "" || formData[field.key] === null || formData[field.key] === undefined) {
                                    alert(`⚠️ MISSING FIELD\n\nPlease enter the ${field.label}.`);
                                    return;
                                }
                            }

                            // CONVERT DOCUMENTS (Only relevant for full mode or if docs are handled here)
                            const finalData = { ...formData };
                            if (documents.POW) finalData.pow_pdf = await convertFullFileToBase64(documents.POW);
                            if (documents.DUPA) finalData.dupa_pdf = await convertFullFileToBase64(documents.DUPA);
                            if (documents.CONTRACT) finalData.contract_pdf = await convertFullFileToBase64(documents.CONTRACT);

                            onSave(finalData);
                        }}
                        disabled={isUploading}
                        className="flex-[2] py-4 text-white font-black text-xs uppercase tracking-widest bg-gradient-to-r from-[#004A99] to-[#003366] rounded-2xl shadow-xl shadow-blue-900/20 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                        {isUploading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Syncing Data...
                            </>
                        ) : "Confirm & Save"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditProjectModal;
