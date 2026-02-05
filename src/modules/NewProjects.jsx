import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import Papa from 'papaparse';
import { auth, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
// --- IMPORT NEW DB LOGIC ---
import { addEngineerToOutbox, getCachedProjects } from '../db';
// --- CONSTANTS ---
const DOC_TYPES = {
    POW: "Program of Works",
    DUPA: "DUPA",
    CONTRACT: "Signed Contract"
};

// Kept for offline fallback provided logic exists elsewhere, or for images if needed (though images use compressImage)
const convertFullFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};
import { compressImage } from '../utils/imageCompression';
import LocationPickerMap from '../components/LocationPickerMap'; // Import Map Component

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
    const [previews, setPreviews] = useState([]);
    const [documents, setDocuments] = useState({
        POW: null,
        DUPA: null,
        CONTRACT: null
    });
    
    // State to hold the CSV data
    const [schoolData, setSchoolData] = useState([]);

    // --- 1. LOAD CSV DATA & CHECK PROJECT LIMIT ON MOUNT ---
    useEffect(() => {
        // A. Load CSV
        Papa.parse(`${import.meta.env.BASE_URL}schools.csv`, {
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
        otherRemarks: '',

        // Location (New)
        latitude: '',
        longitude: ''
    });

    // --- NEW: GEOLOCATION LOGIC ---
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
            },
            (error) => {
                console.warn("Geolocation warning:", error);
                
                // Fallback / Detailed Error
                let msg = "Unable to retrieve location.";
                if (error.code === 1) msg = "❌ Location permission denied. Please enable location services.";
                else if (error.code === 2) msg = "❌ Position unavailable. Check your GPS signal.";
                else if (error.code === 3) msg = "❌ Location request timed out.";
                
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

    // --- NEW: FILE HANDLING FUNCTIONS ---
    const handleFileChange = (e) => {
        const files = e.target.files;
        if (files) {
            const newFiles = Array.from(files);
            // Limit to 5 photos total
            if (selectedFiles.length + newFiles.length > 5) {
                alert("⚠️ MAX LIMIT REACHED\n\nYou can only upload a maximum of 5 site photos.");
                return;
            }
            setSelectedFiles((prev) => [...prev, ...newFiles]);
            
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setPreviews(prev => [...prev, ...newPreviews]);
        }
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleDocumentSelect = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            if (file.type !== "application/pdf") {
                alert("⚠️ INVALID FORMAT\n\nPlease upload a valid PDF file.");
                return;
            }
            // Store raw file object for upload
            setDocuments(prev => ({ ...prev, [type]: file }));
        }
    };

    const removeDocument = (type) => {
        setDocuments(prev => ({ ...prev, [type]: null }));
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
                division: found.division,
                // --- AUTO POPULATE COORDINATES ---
                latitude: found.latitude || prev.latitude,
                longitude: found.longitude || prev.longitude
            }));
            
            let idMsg = `✅ School Found: ${found.school_name}`;
            if (found.latitude && found.longitude) {
                idMsg += `\n📍 Coordinates Auto-Detected!`;
            }
            alert(idMsg);
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
            const raw = value.replace(/,/g, '').replace(/[^0-9.]/g, '');
            if (!raw) {
                value = '';
            } else {
                const parts = raw.split('.');
                parts[0] = Number(parts[0]).toLocaleString('en-US');
                value = parts.join('.');
            }
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // --- 4. SUBMIT LOGIC (3-STEP PROCESS) ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isDummy) {
            alert("PREVIEW MODE: This project entry will NOT be saved.");
            navigate(-1);
            return;
        }

        // --- VALIDATIONS ---
        if (!formData.projectName || !formData.schoolName) {
            alert("⚠️ MISSING DETAILS\n\nPlease provide at least the Project Name and School Name.");
            return;
        }

        if (!documents.POW || !documents.DUPA || !documents.CONTRACT) {
            alert("⚠️ INCOMPLETE SUBMISSION\n\nYou must fill up all the forms and upload all required documents (POW, DUPA, Signed Contract) before creating the project.");
            return;
        }

        if (selectedFiles.length === 0) {
            alert("⚠️ PROOF REQUIRED\n\nAccording to COA requirements, you must attach at least one site photo for every project entry.");
            return;
        }

        if (!formData.latitude || !formData.longitude) {
            alert("⚠️ LOCATION REQUIRED\n\nAccording to COA requirements, you must capture the project's coordinates.\nPlease use the 'Get Current Location' button.");
            return;
        }

        const requiredFields = [
            { key: 'region', label: 'Region' },
            { key: 'division', label: 'Division' },
            { key: 'statusAsOfDate', label: 'Status Date' },
            { key: 'targetCompletionDate', label: 'Target Completion Date' },
            { key: 'contractorName', label: 'Contractor Name' },
            { key: 'projectAllocation', label: 'Project Allocation' },
            { key: 'batchOfFunds', label: 'Batch of Funds' },
            { key: 'otherRemarks', label: 'Remarks' }
        ];

        for (const field of requiredFields) {
            if (!formData[field.key]) {
                alert(`⚠️ MISSING FIELD\n\nPlease enter the ${field.label}. All fields are mandatory.`);
                return;
            }
        }

        setIsSubmitting(true);

        try {
            // A. Prepare Images (Base64) - Still stored in engineer_image for now
            const compressedImages = [];
            for (const file of selectedFiles) {
                const base64 = await compressImage(file);
                compressedImages.push(base64);
            }

            // B. Construct Project Data Payload (NO DOCUMENTS)
            const projectBody = { 
                ...formData, 
                projectAllocation: Number(formData.projectAllocation?.toString().replace(/,/g, '') || 0),
                uid: auth.currentUser?.uid,
                modifiedBy: auth.currentUser?.displayName || 'Engineer',
                images: compressedImages,
                statusAsOfDate: new Date().toISOString()
            };

            // --- OFFLINE CHECK ---
            if (!navigator.onLine) {
                // For offline, we might want to store docs locally, but we are supposed to avoid binary in DB.
                // However, 'addEngineerToOutbox' saves to indexedDB (local). This is safe.
                // We convert them to base64 ONLY for the offline store.
                const offlineDocs = [];
                 if (documents.POW) offlineDocs.push({ type: 'POW', base64: await convertFullFileToBase64(documents.POW) });
                 if (documents.DUPA) offlineDocs.push({ type: 'DUPA', base64: await convertFullFileToBase64(documents.DUPA) });
                 if (documents.CONTRACT) offlineDocs.push({ type: 'CONTRACT', base64: await convertFullFileToBase64(documents.CONTRACT) });

                const offlinePayload = {
                    url: '/api/save-project', 
                    method: 'POST',
                    body: { ...projectBody, documents: offlineDocs }, 
                    formName: `Project: ${formData.projectName}`
                };

                await addEngineerToOutbox(offlinePayload);
                alert("📁 No internet. Project & Photos saved to Sync Center. \n\nNOTE: Documents will be uploaded when connection is restored.");
                setIsSubmitting(false);
                navigate('/engineer-dashboard');
                return;
            }

            // --- ONLINE STEP 1: CREATE PROJECT RECORD ---
            const projectRes = await fetch('/api/save-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectBody),
            });

            if (!projectRes.ok) {
                const errorData = await projectRes.json();
                throw new Error(errorData.message || 'Failed to create project record');
            }

            const projectData = await projectRes.json();
            const projectId = projectData.project.project_id; // Get ID
            const ipc = projectData.ipc; 

            // --- ONLINE STEP 2: UPLOAD DOCUMENTS TO FIREBASE STORAGE ---
            console.log(`🚀 Project Created (ID: ${projectId}, IPC: ${ipc}). Uploading documents...`);
            
            const uploadedDocsMeta = [];
            const docEntries = Object.entries(documents).filter(([_, file]) => file !== null);

            for (const [type, file] of docEntries) {
                // engineer_forms/{project_id}/{type}/{timestamp}_{filename}
                const storagePath = `engineer_forms/${projectId}/${type}/${Date.now()}_${file.name}`;
                const storageRef = ref(storage, storagePath);

                                // Wrap upload in a timeout to prevent infinite hanging (e.g. CORS retries)
                const uploadWithTimeout = (ref, data, ms = 25000) => {
                    return new Promise((resolve, reject) => {
                        const timer = setTimeout(() => reject(new Error("Upload timed out (CORS/Network).")), ms);
                        uploadBytes(ref, data)
                            .then(res => { clearTimeout(timer); resolve(res); })
                            .catch(err => { clearTimeout(timer); reject(err); });
                    });
                };

                const snapshot = await uploadWithTimeout(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);

                uploadedDocsMeta.push({
                    type: type, // POW, DUPA, CONTRACT
                    url: downloadURL,
                    path: storagePath,
                    size: file.size,
                    contentType: file.type
                });
            }

            // --- ONLINE STEP 3: SAVE DOCUMENT METADATA ---
            console.log("💾 Documents uploaded. Saving metadata...");
            
            const metaRes = await fetch('/api/save-project-documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: projectId,
                    documents: uploadedDocsMeta,
                    uploadedBy: auth.currentUser?.uid
                })
            });

            if (!metaRes.ok) {
                 // Non-fatal, but warning needed?
                 console.warn("Project created, but document metadata save failed.");
            }

            alert(`✅ Project ${ipc} created and documents uploaded successfully!`);
            navigate('/engineer-dashboard');

        } catch (error) {
            console.error("Submission failed:", error);
            
            // If project was created (we have an ID) but something else failed
            // We should NOT save to outbox (it would duplicate the project creation)
            // But we should warn the user.
            // Note: We can't easily detect if Project was created unless we track it in state, 
            // but here we are inside the try block. 
            // If error happened BEFORE projectRes, then nothing is saved.
            // If error happened AFTER projectRes, then Project is Saved, but Docs failed.
            
            const isDocUploadError = error.message && (error.message.includes("upload") || error.code === 'storage/unauthorized');
            
            if (isDocUploadError) {
                 alert(`⚠️ PARTIAL SUCCESS: Project was created, but Document Upload failed.\n\nError: ${error.message}\n\nPlease contact admin or try re-uploading documents from the Edit page (Feature coming soon).`);
                 navigate('/engineer-dashboard');
            } else {
                // Fully failed (likely network before project creation)
                // Attempt to save to outbox
                try {
                     await addEngineerToOutbox(payload);
                     alert("⚠️ Connection failed. Project saved to Sync Center for later retry.");
                     navigate('/engineer-dashboard');
                } catch (fallbackErr) {
                     console.error("Fallback failed:", fallbackErr);
                     // If IDB is broken, correct
                     alert(`❌ CRITICAL: Submission failed and could not save to offline storage.\n\n${error.message}`);
                }
            }
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

                        <SectionHeader title="Project Location" icon="📍" />
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="text-blue-600 text-xl">ℹ️</div>
                                    <p className="text-xs text-blue-800 leading-relaxed">
                                        <strong>COA Requirement:</strong> Drag the pin to the exact project site, or stand on-site and click "Get Current Location".
                                    </p>
                                </div>
                                
                                <div className="mb-4 rounded-xl overflow-hidden shadow-sm border border-slate-200">
                                     <LocationPickerMap 
                                        latitude={formData.latitude} 
                                        longitude={formData.longitude} 
                                        onLocationSelect={handleLocationSelect}
                                        disabled={isDummy}
                                     />
                                </div>

                                <div className="flex gap-3 mb-3">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Latitude</label>
                                        <input 
                                            name="latitude" 
                                            value={formData.latitude} 
                                            readOnly 
                                            placeholder="0.000000"
                                            className="w-full p-2 bg-white text-slate-700 font-mono text-xs border border-blue-200 rounded-lg focus:outline-none" 
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Longitude</label>
                                        <input 
                                            name="longitude" 
                                            value={formData.longitude} 
                                            readOnly 
                                            placeholder="0.000000"
                                            className="w-full p-2 bg-white text-slate-700 font-mono text-xs border border-blue-200 rounded-lg focus:outline-none" 
                                        />
                                    </div>
                                </div>

                                <button 
                                    type="button" 
                                    onClick={handleGetLocation}
                                    disabled={isDummy}
                                    className="w-full py-3 bg-blue-600 text-white font-bold text-xs uppercase rounded-lg shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span>📡</span> {formData.latitude ? 'Refine with GPS' : 'Get Current Location'}
                                </button>
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
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, accomplishmentPercentage: Math.min(100, Number(prev.accomplishmentPercentage || 0) + 5) }))} className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded hover:bg-green-200 transition">+5%</button>
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, accomplishmentPercentage: Math.min(100, Number(prev.accomplishmentPercentage || 0) + 10) }))} className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded hover:bg-green-200 transition">+10%</button>
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

                        {/* --- REQUIRED DOCUMENTS SECTION --- */}
                        <div className="mt-4 pt-4 border-t border-slate-100">
                             <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">📄</span>
                                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Prerequisite Documents</h3>
                             </div>
                             <p className="text-xs text-slate-400 -mt-2 mb-2">Each document must be a PDF file.</p>

                             {Object.entries(DOC_TYPES).map(([key, label]) => (
                                <div key={key} className={`p-4 rounded-xl border transition-all ${documents[key] ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className={`text-xs font-black uppercase tracking-widest ${documents[key] ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                {label}
                                            </p>
                                            {documents[key] ? (
                                                <p className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                    {documents[key].name}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-red-400 font-bold mt-0.5">* Required</p>
                                            )}
                                        </div>
                                        <div>
                                            {documents[key] ? (
                                                <button 
                                                    onClick={() => removeDocument(key)}
                                                    className="w-8 h-8 rounded-full bg-white text-red-500 shadow-sm border border-red-100 flex items-center justify-center hover:bg-red-50"
                                                >
                                                    ✕
                                                </button>
                                            ) : (
                                                <label className="cursor-pointer px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-wider hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95">
                                                    Select PDF
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

                        {/* --- SITE PHOTOS SECTION --- */}
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Attach Site Photos</label>
                                <span className="text-[10px] font-bold text-blue-500">{selectedFiles.length} Images Added</span>
                            </div>
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

                            {previews.length > 0 && (
                                <div className="grid grid-cols-4 gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-100 mt-3">
                                    {previews.map((url, index) => (
                                        <div key={index} className="relative group aspect-square rounded-xl overflow-hidden shadow-sm ring-2 ring-white">
                                            <img src={url} alt="preview" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removeFile(index)}
                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center shadow-md active:scale-95"
                                            >✕</button>
                                        </div>
                                    ))}
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