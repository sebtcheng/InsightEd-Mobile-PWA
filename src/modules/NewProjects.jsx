import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import Papa from 'papaparse'; 
import { auth } from '../firebase'; 
// --- IMPORT NEW DB LOGIC ---
import { addEngineerToOutbox, getCachedProjects } from '../db';
import { compressImage } from '../utils/imageCompression';

// Helper component for Section Headers
const SectionHeader = ({ title, icon }) => (
    <div className="flex items-center gap-3 text-slate-700 font-bold text-sm uppercase mt-6 mb-3">
        <span className="text-xl">{icon}</span>
        <h2>{title}</h2>
    </div>
);

const NewProjects = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isDummy = location.state?.isDummy || false;

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // --- NEW STATE FOR FAB AND IMAGES ---
    const fileInputRef = useRef(null);
    const [showUploadOptions, setShowUploadOptions] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    
    // State to hold the CSV data
    const [schoolData, setSchoolData] = useState([]); 

    // --- 1. LOAD CSV DATA & CHECK PROJECT LIMIT ON MOUNT ---
    useEffect(() => {
        // A. Load CSV
        Papa.parse('/schools.csv', {
            download: true,
            header: true, 
            skipEmptyLines: true,
            complete: (results) => {
                console.log("Loaded schools:", results.data.length);
                setSchoolData(results.data);
            },
            error: (err) => {
                console.error("Error loading CSV:", err);
            }
        });

        // B. Check Project Limit (Max 3)
        const checkProjectLimit = async () => {
            if (isDummy) return; // Skip check for dummy/preview
            
            const user = auth.currentUser;
            if (!user) return;

            try {
                let count = 0;
                // 1. Online Check
                if (navigator.onLine) {
                     const response = await fetch(`/api/projects?engineer_id=${user.uid}`);
                     if (response.ok) {
                         const projects = await response.json();
                         count = projects.length;
                     } else {
                         throw new Error("API check failed, falling back to cache");
                     }
                } else {
                    // 2. Offline Fallback
                    const cached = await getCachedProjects();
                    count = cached.length;
                }

                if (count >= 3) {
                    alert("⚠️ PREVIEW LIMIT REACHED\n\nYou have reached the limit of 3 projects for this account.\nPlease contact admin or update your existing projects.");
                    navigate('/engineer-dashboard');
                }
            } catch (err) {
                console.warn("Limit check failed, falling back to cache:", err);
                const cached = await getCachedProjects();
                if (cached.length >= 3) {
                    alert("⚠️ PREVIEW LIMIT REACHED\n\nYou have reached the limit of 3 projects for this account.\nPlease contact admin or update your existing projects.");
                    navigate('/engineer-dashboard');
                }
            }
        };

        checkProjectLimit();
    }, [isDummy, navigate]);

    // --- PRE-FILL DUMMY DATA ---
    useEffect(() => {
        if (isDummy) {
            setFormData({
                region: 'Region I',
                division: 'Ilocos Norte',
                schoolName: 'Sample School Elementary',
                projectName: 'Construction of 2 Storey 4 Classroom', 
                schoolId: '100001',
                status: 'Ongoing',
                accomplishmentPercentage: 45, 
                statusAsOfDate: '2023-10-15',
                targetCompletionDate: '2024-03-30',
                actualCompletionDate: '',
                noticeToProceed: '2023-08-01',
                contractorName: 'XYZ Construction Corp.',
                projectAllocation: '12,500,000', 
                batchOfFunds: 'Batch 2',
                otherRemarks: 'On schedule. Foundation complete. This is a sample entry.'
            });
        }
    }, [isDummy]);

    const [formData, setFormData] = useState({
        // Basic Info
        region: '',
        division: '',
        schoolName: '',
        projectName: '', 
        schoolId: '',
        
        // Status & Progress
        status: 'Not Yet Started',
        accomplishmentPercentage: 0, 
        statusAsOfDate: '',

        // Timelines
        targetCompletionDate: '',
        actualCompletionDate: '',
        noticeToProceed: '',

        // Contractors & Funds
        contractorName: '',
        projectAllocation: '', 
        batchOfFunds: '',

        // Remarks
        otherRemarks: ''
    });

    // --- NEW: FILE HANDLING FUNCTIONS ---
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            // CHECK: Limit to 2 photos max
            if (selectedFiles.length + files.length > 2) {
                alert("You can only upload a maximum of 2 photos.");
                return;
            }
            setSelectedFiles(prev => [...prev, ...files]);
            setShowUploadOptions(false);
        }
    };

    const triggerFilePicker = (mode) => {
        if (fileInputRef.current) {
            if (mode === 'camera') {
                fileInputRef.current.setAttribute('capture', 'environment');
            } else {
                fileInputRef.current.removeAttribute('capture');
            }
            fileInputRef.current.click();
        }
    };

    // --- 2. VALIDATION LOGIC ---
    const handleValidateSchoolId = () => {
        // Basic check
        if (!formData.schoolId) {
            alert("Please enter a School ID.");
            return;
        }
        
        const found = schoolData.find(s => String(s.school_id) === String(formData.schoolId));
        if (found) {
            setFormData(prev => ({
                ...prev,
                schoolName: found.school_name,
                region: found.region,
                division: found.division
            }));
            alert("✅ School Found: " + found.school_name);
        } else {
            alert("❌ School ID not found in database.");
            setFormData(prev => ({
                ...prev,
                schoolName: '',
                region: '',
                division: ''
            }));
        }
    };

    // --- 3. HANDLE CHANGE ---
    const handleChange = (e) => {
        let { name, value } = e.target;
        // Numeric constraint for School ID
        if (name === 'schoolId') {
            value = value.replace(/\D/g, ''); 
            if (value.length > 6) value = value.slice(0, 6);
        }
        // Auto-comma for Project Allocation
        if (name === 'projectAllocation') {
             // 1. Remove non-numeric (keep decimals if needed, but usually just integers for allocation)
             // Let's assume integers for simplicity as per common request, or handle '.'
             const raw = value.replace(/,/g, '').replace(/[^0-9.]/g, '');
             if (!raw) {
                 value = '';
             } else {
                 // Prevent multiple decimals
                 const parts = raw.split('.');
                 parts[0] = Number(parts[0]).toLocaleString('en-US');
                 value = parts.join('.');
             }
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Helper function to convert File objects to Base64 strings
    // (Moved up so it can be used inside handleSubmit)
    const convertToBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
      });
    };

    // --- 4. FIXED SUBMIT LOGIC (BUNDLES IMAGES) ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isDummy) {
            alert("PREVIEW MODE: This project entry will NOT be saved.");
            navigate(-1);
            return;
        }

        setIsSubmitting(true);

        // 1. PRE-PROCESS IMAGES (Compress and convert to Base64 strings immediately)
        let imagePayload = [];
        if (selectedFiles.length > 0) {
            try {
                // Using compression utility instead of manual convertToBase64
                imagePayload = await Promise.all(selectedFiles.map(file => compressImage(file)));
            } catch (err) {
                console.error("Error compressing images", err);
                alert("Error compressing images");
                setIsSubmitting(false);
                return;
            }
        }

        // 2. CONSTRUCT SINGLE PAYLOAD
        // We use relative URL '/api/save-project' so it works both Localhost & Production
        const payload = {
            url: '/api/save-project', 
            method: 'POST',
            body: { 
                ...formData, 
                projectAllocation: Number(formData.projectAllocation?.toString().replace(/,/g, '') || 0), // Strip commas
                uid: auth.currentUser?.uid,
                modifiedBy: auth.currentUser?.displayName || 'Engineer',
                images: imagePayload // <--- Images are now bundled HERE
            },
            formName: `Project: ${formData.projectName}`
        };

        // 3. OFFLINE CHECK
        if (!navigator.onLine) {
            // Because 'payload' now includes the Base64 images, 
            // addEngineerToOutbox saves EVERYTHING (Text + Photos) in one go.
            await addEngineerToOutbox(payload);
            alert("📁 No internet. Project & Photos saved to Sync Center.");
            setIsSubmitting(false);
            navigate('/engineer-dashboard');
            return;
        }

        // 4. ONLINE SUBMISSION
        try {
            const response = await fetch(payload.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload.body), // Sends Project + Images in one request
            });

            if (response.ok) {
                alert('Project and photos saved successfully!');
                navigate('/engineer-dashboard');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Server responded with error');
            }
        } catch (error) {
            console.error("Submission failed, saving to outbox:", error);
            // On error, we save the FULL payload (with images) to the outbox
            await addEngineerToOutbox(payload);
            alert("⚠️ Connection failed. Saved to Sync Center.");
            navigate('/engineer-dashboard');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 font-sans pb-32">
                
                <div className="bg-[#004A99] pt-8 pb-16 px-6 rounded-b-[2rem] shadow-xl">
                    <div className="flex items-center gap-3 text-white mb-4">
                        <button onClick={() => navigate(-1)} className="p-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-bold">New Project Entry</h1>
                    </div>
                </div>

                {isDummy && (
                    <div className="mx-6 -mt-6 mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 shadow-lg relative z-20">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600 text-xl">👁️</div>
                        <div>
                            <h3 className="font-bold text-amber-900 text-sm">Preview Mode</h3>
                            <p className="text-xs text-amber-700">Data entered here will NOT be saved.</p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="px-6 -mt-10">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">

                        <SectionHeader title="Project Identification" icon="🏢" />
                        <div className="space-y-4">
                            {/* 1. PROJECT NAME */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name <span className="text-red-500">*</span></label>
                                <input name="projectName" value={formData.projectName} onChange={handleChange} required readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>

                            {/* 2. SCHOOL ID + VALIDATE BUTTON */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1"> School ID (6 Digits) <span className="text-red-500">*</span> </label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <input 
                                            type="text" 
                                            inputMode="numeric" 
                                            name="schoolId" 
                                            value={formData.schoolId} 
                                            onChange={handleChange} 
                                            required 
                                            readOnly={isDummy}
                                            maxLength="6" 
                                            placeholder="e.g. 100001" 
                                            className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 font-mono ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} 
                                        />
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={handleValidateSchoolId}
                                        disabled={schoolData.length === 0 || isDummy}
                                        className="px-4 py-2 bg-blue-100 text-blue-700 font-bold text-xs uppercase rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Validate
                                    </button>
                                </div>
                                <div className="text-right text-xs text-slate-400 mt-1">
                                    {formData.schoolId.length}/6 digits
                                </div>
                            </div>
                            
                            {/* 3. SCHOOL NAME (READ ONLY) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">School Name <span className="text-slate-400 font-normal">(Auto-filled)</span></label>
                                <input 
                                    name="schoolName" 
                                    value={formData.schoolName} 
                                    readOnly
                                    placeholder="Click Validate to populate..."
                                    className="w-full p-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm focus:outline-none" 
                                />
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Region</label>
                                    <input name="region" value={formData.region} readOnly className="w-full p-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm focus:outline-none" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Division</label>
                                    <input name="division" value={formData.division} readOnly className="w-full p-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm focus:outline-none" />
                                </div>
                            </div>
                        </div>

                        <SectionHeader title="Status and Progress" icon="📊" />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Status</label>
                                <select name="status" value={formData.status} onChange={handleChange} disabled={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`}>
                                    <option value="Not Yet Started">Not Yet Started</option>
                                    <option value="Under Procurement">Under Procurement</option>
                                    <option value="Ongoing">Ongoing</option>
                                    <option value="For Final Inspection">For Final Inspection</option> 
                                    <option value="Completed">Completed</option>
                                </select>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Accomplishment Percentage (%)</label>
                                    {!isDummy && (
                                        <div className="flex gap-1">
                                            <button type="button" onClick={() => setFormData(prev => ({...prev, accomplishmentPercentage: Math.min(100, Number(prev.accomplishmentPercentage || 0) + 5)}))} className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded hover:bg-green-200 transition">+5%</button>
                                            <button type="button" onClick={() => setFormData(prev => ({...prev, accomplishmentPercentage: Math.min(100, Number(prev.accomplishmentPercentage || 0) + 10)}))} className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded hover:bg-green-200 transition">+10%</button>
                                        </div>
                                    )}
                                </div>
                                <input type="number" name="accomplishmentPercentage" value={formData.accomplishmentPercentage} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status As Of Date</label>
                                <input type="date" name="statusAsOfDate" value={formData.statusAsOfDate} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>
                        </div>

                        <SectionHeader title="Timelines" icon="📅" />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notice to Proceed Date</label>
                                <input type="date" name="noticeToProceed" value={formData.noticeToProceed} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Completion Date</label>
                                <input type="date" name="targetCompletionDate" value={formData.targetCompletionDate} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>
                            {formData.status === 'Completed' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Actual Completion Date</label>
                                    <input type="date" name="actualCompletionDate" value={formData.actualCompletionDate} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                                </div>
                            )}
                        </div>

                        <SectionHeader title="Funds and Contractor" icon="💰" />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Allocation (PHP)</label>
                                <input type="text" name="projectAllocation" value={formData.projectAllocation} onChange={handleChange} readOnly={isDummy} placeholder="e.g. 15,000,000" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Batch of Funds</label>
                                <input name="batchOfFunds" value={formData.batchOfFunds} onChange={handleChange} readOnly={isDummy} placeholder="e.g. Batch 1" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contractor Name</label>
                                <input name="contractorName" value={formData.contractorName} onChange={handleChange} readOnly={isDummy} placeholder="e.g. ABC Builders" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>
                        </div>

                        <SectionHeader title="Other Remarks" icon="📝" />
                        <div className="mb-4">
                            <textarea 
                                name="otherRemarks" 
                                rows="3" 
                                value={formData.otherRemarks} 
                                onChange={handleChange} 
                                readOnly={isDummy}
                                placeholder="Any specific issues or notes..." 
                                className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} 
                            />
                        </div>

                        {selectedFiles.length > 0 && (
                            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                                <span className="text-lg">📸</span>
                                <span className="text-xs font-bold">{selectedFiles.length} project image(s) attached</span>
                            </div>
                        )}

                        {/* --- ATTACH PHOTOS SECTION --- */}
                        <div className="mt-4 pt-4 border-t border-slate-100">
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Attach Site Photos</label>
                             {!isDummy && (
                                 <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => triggerFilePicker('camera')} 
                                        className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all group"
                                    >
                                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform">📸</div>
                                        <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600">Take Photo</span>
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => triggerFilePicker('gallery')} 
                                        className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all group"
                                    >
                                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform">🖼️</div>
                                        <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600">From Gallery</span>
                                    </button>
                                 </div>
                             )}
                             {isDummy && (
                                <p className="text-xs text-slate-400 italic text-center py-4">Photo uploading disabled in preview mode.</p>
                             )}
                        </div>

                    </div>

                    <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2 border-t border-slate-50">
                        <button type="button" onClick={() => navigate(-1)} className="flex-1 py-3 text-slate-600 font-bold text-sm bg-slate-100 rounded-xl hover:bg-slate-200 transition">
                            {isDummy ? 'Back' : 'Cancel'}
                        </button>
                        {!isDummy && (
                            <button 
                                type="submit" 
                                disabled={isSubmitting} 
                                className="flex-1 py-3 text-white font-bold text-sm bg-[#004A99] rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition disabled:opacity-50"
                            >
                                {isSubmitting ? 'Saving...' : 'Create Project'}
                            </button>
                        )}
                    </div>
                </form>

                <div className="hidden">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                    />
                </div>

            </div>
        </PageTransition>
    );
};

export default NewProjects;