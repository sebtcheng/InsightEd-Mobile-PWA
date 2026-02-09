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
    const [userRole, setUserRole] = useState(null);

    // --- FETCH ROLE ---
    useEffect(() => {
        const fetchRole = async () => {
            if (auth.currentUser) {
                try {
                    const res = await fetch(`/api/user-info/${auth.currentUser.uid}`);
                    if (res.ok) {
                        const data = await res.json();
                        setUserRole(data.role);
                        // Auto-fill region/division if LGU? 
                        // Maybe later.
                    }
                } catch (err) {
                    console.error("Failed to fetch user role:", err);
                }
            }
        };
        fetchRole();
    }, []);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- NEW STATE FOR FAB AND IMAGES ---
    const fileInputRef = useRef(null);
    const [showUploadOptions, setShowUploadOptions] = useState(false);
    
    // Split State for Internal/External
    const [internalFiles, setInternalFiles] = useState([]);
    const [internalPreviews, setInternalPreviews] = useState([]);
    
    const [externalFiles, setExternalFiles] = useState([]);
    const [externalPreviews, setExternalPreviews] = useState([]);
    
    const [activeCategory, setActiveCategory] = useState('Internal'); // To track which button clicked
    
    // Removed legacy selectedFiles/previews
    const [selectedFiles, setSelectedFiles] = useState([]); // Kept for backward compat checks if needed, but we will use the new ones. 
    // Actually best to remove selectedFiles usage entirely to avoid confusion, but handleSubmit uses it. 
    // I will update handleSubmit. Let's keep these lines commented out or remove them.

    const [documents, setDocuments] = useState({
        POW: null,
        DUPA: null,
        CONTRACT: null
    });
    
    // State to hold the CSV data
    const [schoolData, setSchoolData] = useState([]);

    // 1.) Category Choices
const PROJECT_CATEGORIES = [
    "New Construction",
    "Electrification",
    "Health",
    "QRF",
    "LMS",
    "ALS-CLC",
    "Gabaldon",
    "Repairs"
];
    // --- 1. LOAD CSV DATA ---
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
        longitude: '',

        // --- NEW FIELDS ---
        projectCategory: '',
        scopeOfWork: '',
        constructionStartDate: '',

        // --- NEW LGU FIELDS ---
        moa_date: '',
        tranches_count: '',
        tranche_amount: '',
        fund_source: '',
        province: '',
        city: '',
        municipality: '',
        legislative_district: '',
        scope_of_works: '',
        contract_amount: '',
        bid_opening_date: '',
        resolution_award_date: '',
        procurement_stage: '',
        bidding_date: '',
        awarding_date: '',
        construction_start_date: '',
        funds_downloaded: '',
        funds_utilized: ''
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
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            
            if (activeCategory === 'Internal') {
                setInternalFiles(prev => [...prev, ...newFiles]);
                setInternalPreviews(prev => [...prev, ...newPreviews]);
            } else {
                setExternalFiles(prev => [...prev, ...newFiles]);
                setExternalPreviews(prev => [...prev, ...newPreviews]);
            }
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
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

    const triggerFilePicker = (mode, category) => {
        setActiveCategory(category);
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
        // Force Uppercase for Contractor Name, Project Name, and new Project Category
        if (['contractorName', 'projectName', 'projectCategory'].includes(name)) {
            value = value.toUpperCase();
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
        
        setFormData(prev => {
            const newData = { ...prev, [name]: value };
            
            // Auto-update percentage based on status
            if (name === 'status') {
                if (['Not Yet Started', 'Under Procurement'].includes(value)) {
                    newData.accomplishmentPercentage = 0;
                } else if (['Completed', 'For Final Inspection'].includes(value)) {
                    newData.accomplishmentPercentage = 100;
                }
            }
            // Auto-update status based on percentage
            if (name === 'accomplishmentPercentage') {
                 const percent = Number(value);
                 if (percent === 100 && prev.status !== 'Completed') {
                     newData.status = 'For Final Inspection';
                 } else if (percent > 0 && percent < 100 && ['Not Yet Started', 'Under Procurement', 'Completed'].includes(prev.status)) {
                     newData.status = 'Ongoing';
                 } else if (percent === 0) {
                     newData.status = 'Not Yet Started';
                 }
            }
            
            return newData;
        });
    };

    // --- 4. SUBMIT LOGIC (3-STEP PROCESS) ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isDummy) {
            alert("PREVIEW MODE: This project entry will NOT be saved.");
            navigate('/dummy-forms', { state: { type: 'engineer' } });
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

        // CONDITIONAL PHOTO VALIDATION
        if (!['Not Yet Started', 'Under Procurement'].includes(formData.status)) {
            if (internalFiles.length === 0 && externalFiles.length === 0) {
                alert("⚠️ PROOF REQUIRED\n\nAccording to COA requirements, you must attach at least one site photo for every project entry.");
                return;
            }
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
            // A. Prepare Images (Base64) with Category
            const compressedImages = [];
            
            // Process Internal
            for (const file of internalFiles) {
                const base64 = await compressImage(file);
                compressedImages.push({ image_data: base64, category: 'Internal' });
            }
            // Process External
            for (const file of externalFiles) {
                 const base64 = await compressImage(file);
                 compressedImages.push({ image_data: base64, category: 'External' });
            }

            // B. Prepare Documents (Base64)
            // Convert docs to Base64 to send DIRECTLY to DB (No Firebase)
            const processedDocs = [];
            if (documents.POW) processedDocs.push({ type: 'POW', base64: await convertFullFileToBase64(documents.POW) });
            if (documents.DUPA) processedDocs.push({ type: 'DUPA', base64: await convertFullFileToBase64(documents.DUPA) });
            if (documents.CONTRACT) processedDocs.push({ type: 'CONTRACT', base64: await convertFullFileToBase64(documents.CONTRACT) });

            // C. Construct Payload
            const projectBody = { 
                ...formData, 
                projectAllocation: Number(formData.projectAllocation?.toString().replace(/,/g, '') || 0),
                uid: auth.currentUser?.uid,
                modifiedBy: auth.currentUser?.displayName || 'Engineer',
                images: compressedImages,
                documents: processedDocs, // Send docs directly!
                statusAsOfDate: new Date().toISOString()
            };

            // --- OFFLINE/ONLINE CHECK ---
            // Determine endpoint based on role
            const endpointUrl = (userRole === 'Local Government Unit') ? '/api/lgu/save-project' : '/api/save-project';

            const payload = {
                url: endpointUrl,
                method: 'POST',
                body: projectBody,
                formName: `Project: ${formData.projectName}`
            };

            if (!navigator.onLine) {
                 await addEngineerToOutbox(payload);
                 alert("📁 No internet. Project & Docs saved to Sync Center.");
                 setIsSubmitting(false);
                 navigate('/engineer-dashboard');
                 return;
            }

            // --- ONLINE SUBMISSION ---
            let endpoint = '/api/save-project';
            
            // LGU SPECIFIC ENDPOINT
            if (userRole === 'Local Government Unit') {
                endpoint = '/api/lgu/save-project';
            }

            const projectRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectBody),
            });

            if (!projectRes.ok) {
                const errorData = await projectRes.json();
                throw new Error(errorData.message || 'Failed to save project');
            }

            const projectData = await projectRes.json();
            const ipc = projectData.ipc; 
            
            alert(`✅ Project ${ipc} created and all documents saved successfully!`);
            navigate('/engineer-dashboard');

        } catch (error) {
            console.error("Submission failed:", error);
            
            // Try saving to outbox if it might be a network glitch
            try {
                 // We can't easily reconstruct the exact payload if we failed mid-way, 
                 // but typically if fetch failed, we are here.
                 
                 alert(`❌ Submission Failed: ${error.message}\n\nPlease check your connection and try again.`);
            } catch (fallbackErr) {
                 alert(`❌ Critical Error: ${error.message}`);
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
                        <button onClick={() => isDummy ? navigate('/dummy-forms', { state: { type: 'engineer' } }) : navigate(-1)} className="p-2">
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
                            {/* 0. PROJECT CATEGORY (New - Dropdown) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Category</label>
                                <select 
                                    name="projectCategory" 
                                    value={formData.projectCategory || ''} 
                                    onChange={handleChange} 
                                    className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`}
                                >
                                    <option value="">Select Category</option>
                                    {PROJECT_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 1. PROJECT NAME */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name <span className="text-red-500">*</span></label>
                                <input name="projectName" value={formData.projectName} onChange={handleChange} required readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>

                            {/* 1.5 SCOPE OF WORK (New) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Scope of Work</label>
                                <p className="text-[10px] text-slate-400 mb-1">Number of Classrooms (for New Construction) or Number of Sites</p>
                                <textarea name="scopeOfWork" rows="2" value={formData.scopeOfWork || ''} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>

                        <SectionHeader title="School Information" icon="🏫" />
                        <div className="space-y-4">
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

                        {userRole === 'Local Government Unit' && (
                            <>
                                <SectionHeader title="LGU Project Details" icon="🏛️" />
                                <div className="space-y-4">
                                    {/* Location Details */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Province</label>
                                            <input name="province" value={formData.province} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">City/Municipality</label>
                                            <input name="municipality" value={formData.municipality} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                        </div>
                                         <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Legislative District</label>
                                            <input name="legislative_district" value={formData.legislative_district} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                        </div>
                                    </div>

                                    {/* Funding & MOA */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fund Source</label>
                                            <input name="fund_source" value={formData.fund_source} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">MOA Date</label>
                                            <input type="date" name="moa_date" value={formData.moa_date} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                        </div>
                                    </div>

                                    {/* Tranches */}
                                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                        <h4 className="font-bold text-blue-800 text-xs uppercase mb-3">Fund Tranches</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. of Tranches</label>
                                                <input type="number" name="tranches_count" value={formData.tranches_count} onChange={handleChange} className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amount per Tranche</label>
                                                <input name="tranche_amount" value={formData.tranche_amount} onChange={handleChange} className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm" />
                                            </div>
                                             <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Funds Downloaded</label>
                                                <input name="funds_downloaded" value={formData.funds_downloaded} onChange={handleChange} className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Funds Utilized</label>
                                                <input name="funds_utilized" value={formData.funds_utilized} onChange={handleChange} className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                     {/* Scope */}
                                     <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Scope of Works</label>
                                        <textarea name="scope_of_works" rows="2" value={formData.scope_of_works} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                    </div>
                                </div>

                                <SectionHeader title="Procurement Details" icon="⚖️" />
                                <div className="space-y-4">
                                     <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Procurement Stage</label>
                                        <select name="procurement_stage" value={formData.procurement_stage} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                                            <option value="">Select Stage...</option>
                                            <option value="Pre-Procurement">Pre-Procurement</option>
                                            <option value="Advertisement">Advertisement</option>
                                            <option value="Pre-Bid Conference">Pre-Bid Conference</option>
                                            <option value="Opening of Bids">Opening of Bids</option>
                                            <option value="Bid Evaluation">Bid Evaluation</option>
                                            <option value="Post Qualification">Post Qualification</option>
                                            <option value="Awarded">Awarded</option>
                                        </select>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                         <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contract Amount</label>
                                            <input name="contract_amount" value={formData.contract_amount} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                        </div>
                                         <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Construction Start Date</label>
                                            <input type="date" name="construction_start_date" value={formData.construction_start_date} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <h4 className="font-bold text-slate-700 text-xs uppercase mb-3">Key Dates</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bidding Date</label>
                                                <input type="date" name="bidding_date" value={formData.bidding_date} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" />
                                            </div>
                                             <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bid Opening</label>
                                                <input type="date" name="bid_opening_date" value={formData.bid_opening_date} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Awarding Date</label>
                                                <input type="date" name="awarding_date" value={formData.awarding_date} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Resolution to Award</label>
                                                <input type="date" name="resolution_award_date" value={formData.resolution_award_date} onChange={handleChange} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

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
                            {!['Not Yet Started', 'Under Procurement'].includes(formData.status) && (
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
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status As Of Date</label>
                                <input type="date" name="statusAsOfDate" value={formData.statusAsOfDate} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>
                        </div>

                        {/* --- SITE PHOTOS SECTION (Conditional) --- */}
                        {!['Not Yet Started', 'Under Procurement'].includes(formData.status) && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <SectionHeader title="Site Photos" icon="📸" />
                                <div className="space-y-6">
                                    
                                    {/* EXTERNAL PHOTOS (First) */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="font-bold text-slate-700 text-xs uppercase">External Photos</h3>
                                            <span className="text-[10px] font-bold text-blue-500">{externalFiles.length} Added</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 mb-3 italic space-y-1">
                                            <p>• Front, Left, Right, Rear (wide shots)</p>
                                            <p>• Orthographic at height 20-30m (optional)</p>
                                        </div>

                                        {!isDummy && (
                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                <button type="button" onClick={() => triggerFilePicker('camera', 'External')} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-400">
                                                    <span className="text-lg">📸</span> <span className="text-[10px] font-bold text-slate-600">Camera</span>
                                                </button>
                                                <button type="button" onClick={() => triggerFilePicker('gallery', 'External')} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-400">
                                                    <span className="text-lg">🖼️</span> <span className="text-[10px] font-bold text-slate-600">Gallery</span>
                                                </button>
                                            </div>
                                        )}
                                        {externalPreviews.length > 0 && (
                                            <div className="grid grid-cols-4 gap-2">
                                                {externalPreviews.map((url, index) => (
                                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-white shadow-sm ring-1 ring-slate-200">
                                                        <img src={url} alt="external" className="w-full h-full object-cover" />
                                                        <button type="button" onClick={() => removeFile(index, 'External')} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* INTERNAL PHOTOS (Second) */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="font-bold text-slate-700 text-xs uppercase">Internal Photos</h3>
                                            <span className="text-[10px] font-bold text-blue-500">{internalFiles.length} Added</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 mb-3 italic space-y-1">
                                            <p>• Classrooms (2-3): Wide shot from doorway/corner, Camera at 1.4-1.6m height, Facing longest wall.</p>
                                            <p>• Key indicators: Ceiling, Lighting, Outlets, Painted walls, Floor condition.</p>
                                        </div>

                                        {!isDummy && (
                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                <button type="button" onClick={() => triggerFilePicker('camera', 'Internal')} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-400">
                                                    <span className="text-lg">📸</span> <span className="text-[10px] font-bold text-slate-600">Camera</span>
                                                </button>
                                                <button type="button" onClick={() => triggerFilePicker('gallery', 'Internal')} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-400">
                                                    <span className="text-lg">🖼️</span> <span className="text-[10px] font-bold text-slate-600">Gallery</span>
                                                </button>
                                            </div>
                                        )}
                                        {internalPreviews.length > 0 && (
                                            <div className="grid grid-cols-4 gap-2">
                                                {internalPreviews.map((url, index) => (
                                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-white shadow-sm ring-1 ring-slate-200">
                                                        <img src={url} alt="internal" className="w-full h-full object-cover" />
                                                        <button type="button" onClick={() => removeFile(index, 'Internal')} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <SectionHeader title="Timelines" icon="📅" />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notice to Proceed Date</label>
                                <input type="date" name="noticeToProceed" value={formData.noticeToProceed} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
                            </div>
                            {/* Start of Construction (New) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start of Construction</label>
                                <input type="date" name="constructionStartDate" value={formData.constructionStartDate || ''} onChange={handleChange} readOnly={isDummy} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDummy ? 'opacity-75 cursor-not-allowed' : ''}`} />
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