import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import Papa from 'papaparse'; 
import { auth } from '../firebase'; 

// Helper component for Section Headers
const SectionHeader = ({ title, icon }) => (
    <div className="flex items-center gap-3 text-slate-700 font-bold text-sm uppercase mt-6 mb-3">
        <span className="text-xl">{icon}</span>
        <h2>{title}</h2>
    </div>
);

const NewProjects = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // --- NEW STATE FOR FAB AND IMAGES ---
    const fileInputRef = useRef(null);
    const [showUploadOptions, setShowUploadOptions] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    
    // State to hold the CSV data
    const [schoolData, setSchoolData] = useState([]); 

    // --- 1. LOAD CSV DATA ON MOUNT ---
    useEffect(() => {
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
    }, []);

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

    // --- 2. AUTOFILL LOGIC ---
    const handleAutoFill = (name, value, currentData) => {
        let updates = {};

        if (name === 'schoolId') {
            const foundSchool = schoolData.find(s => s.school_id === value);
            if (foundSchool) {
                updates.schoolName = foundSchool.school_name || currentData.schoolName;
                updates.region = foundSchool.region || currentData.region;
                updates.division = foundSchool.division || currentData.division;
            }
        }

        if (name === 'schoolName') {
            const foundSchool = schoolData.find(s => 
                s.school_name && s.school_name.toLowerCase() === value.toLowerCase()
            );
            if (foundSchool) {
                updates.schoolId = foundSchool.school_id || currentData.schoolId;
                updates.region = foundSchool.region || currentData.region;
                updates.division = foundSchool.division || currentData.division;
            }
        }
        return updates;
    };

    // --- 3. HANDLE CHANGE WITH STRICT VALIDATION ---
    const handleChange = (e) => {
        let { name, value } = e.target;
        if (name === 'schoolId') {
            value = value.replace(/\D/g, ''); 
            if (value.length > 6) value = value.slice(0, 6);
        }

        setFormData(prev => {
            let newData = { ...prev, [name]: value };
            const autoFillUpdates = handleAutoFill(name, value, prev);
            if (Object.keys(autoFillUpdates).length > 0) {
                newData = { ...newData, ...autoFillUpdates };
            }
            return newData;
        });
    };

    // --- 4. UPDATED SUBMIT LOGIC ---
   const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
        // 1. Save Project Text Data
        const response = await fetch('http://localhost:3000/api/save-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ...formData, 
                uid: auth.currentUser.uid,
                modifiedBy: auth.currentUser.displayName || 'Engineer'
            }),
        });

        const result = await response.json();

        // 2. Capture the project_id returned from your SQL 'RETURNING' clause
        if (response.ok && result.project?.project_id) {
            const newProjectId = result.project.project_id;

            // 3. Upload Images linked to this ID
            if (selectedFiles.length > 0) {
                for (const file of selectedFiles) {
                    const reader = new FileReader();
                    const base64Promise = new Promise(resolve => {
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(file);
                    });
                    const base64Image = await base64Promise;

                    await fetch('http://localhost:3000/api/upload-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectId: newProjectId,
                            imageData: base64Image,
                            uploadedBy: auth.currentUser.uid
                        }),
                    });
                }
            }
            alert('Project and photos saved successfully!');
            navigate('/engineer-dashboard');
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        setIsSubmitting(false);
    }
};

// Helper function to convert File objects to Base64 strings
const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 font-sans pb-32"> {/* Added more padding for FAB */}
                
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

                <form onSubmit={handleSubmit} className="px-6 -mt-10">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">

                        <SectionHeader title="Project Identification" icon="🏢" />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name <span className="text-red-500">*</span></label>
                                <input name="projectName" value={formData.projectName} onChange={handleChange} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">School Name <span className="text-red-500">*</span></label>
                                <input 
                                    list="school-suggestions" 
                                    name="schoolName" 
                                    value={formData.schoolName} 
                                    onChange={handleChange} 
                                    required 
                                    placeholder="Type to search..."
                                    autoComplete="off"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" 
                                />
                                <datalist id="school-suggestions">
                                    {schoolData.slice(0, 100).map((school, index) => (
                                        <option key={index} value={school.school_name} />
                                    ))}
                                </datalist>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1"> School ID (6 Digits) <span className="text-red-500">*</span> </label>
                                <input type="text" inputMode="numeric" name="schoolId" value={formData.schoolId} onChange={handleChange} required maxLength="6" placeholder="e.g. 100001" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 font-mono" />
                                <div className="text-right text-xs text-slate-400 mt-1">
                                    {formData.schoolId.length}/6 digits
                                </div>
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
                                <select name="status" value={formData.status} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500">
                                    <option value="Not Yet Started">Not Yet Started</option>
                                    <option value="Under Procurement">Under Procurement</option>
                                    <option value="Ongoing">Ongoing</option>
                                    <option value="For Final Inspection">For Final Inspection</option> 
                                    <option value="Completed">Completed</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Accomplishment Percentage (%)</label>
                                <input type="number" name="accomplishmentPercentage" value={formData.accomplishmentPercentage} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status As Of Date</label>
                                <input type="date" name="statusAsOfDate" value={formData.statusAsOfDate} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>

                        <SectionHeader title="Timelines" icon="📅" />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notice to Proceed Date</label>
                                <input type="date" name="noticeToProceed" value={formData.noticeToProceed} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Completion Date</label>
                                <input type="date" name="targetCompletionDate" value={formData.targetCompletionDate} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Actual Completion Date</label>
                                <input type="date" name="actualCompletionDate" value={formData.actualCompletionDate} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>

                        <SectionHeader title="Funds and Contractor" icon="💰" />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Allocation (PHP)</label>
                                <input type="number" name="projectAllocation" value={formData.projectAllocation} onChange={handleChange} placeholder="e.g. 15000000" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Batch of Funds</label>
                                <input name="batchOfFunds" value={formData.batchOfFunds} onChange={handleChange} placeholder="e.g. Batch 1" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contractor Name</label>
                                <input name="contractorName" value={formData.contractorName} onChange={handleChange} placeholder="e.g. ABC Builders" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>

                        <SectionHeader title="Other Remarks" icon="📝" />
                        <div className="mb-4">
                            <textarea 
                                name="otherRemarks" 
                                rows="3" 
                                value={formData.otherRemarks} 
                                onChange={handleChange} 
                                placeholder="Any specific issues or notes..." 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" 
                            />
                        </div>

                        {/* Display Number of Selected Images */}
                        {selectedFiles.length > 0 && (
                            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                                <span className="text-lg">📸</span>
                                <span className="text-xs font-bold">{selectedFiles.length} project image(s) attached</span>
                            </div>
                        )}

                    </div>

                    <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2 border-t border-slate-50">
                        <button type="button" onClick={() => navigate(-1)} className="flex-1 py-3 text-slate-600 font-bold text-sm bg-slate-100 rounded-xl hover:bg-slate-200 transition">
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting} 
                            className="flex-1 py-3 text-white font-bold text-sm bg-[#004A99] rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : 'Create Project'}
                        </button>
                    </div>
                </form>

                {/* --- FLOATING ACTION BUTTON (FAB) UI --- */}
                <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-3">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                    />
                    
                    {showUploadOptions && (
                        <div className="flex flex-col gap-3 mb-2 animate-in slide-in-from-bottom-4 duration-200">
                            <button 
                                type="button"
                                onClick={() => triggerFilePicker('camera')} 
                                className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                            >
                                <span className="text-lg">📸</span>
                                <span className="text-xs font-bold uppercase">Take Photo</span>
                            </button>
                            <button 
                                type="button"
                                onClick={() => triggerFilePicker('gallery')} 
                                className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                            >
                                <span className="text-lg">🖼️</span>
                                <span className="text-xs font-bold uppercase">From Gallery</span>
                            </button>
                        </div>
                    )}

                    <button 
                        type="button"
                        onClick={() => setShowUploadOptions(!showUploadOptions)} 
                        className={`bg-[#FDB913] hover:bg-yellow-500 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-all transform ${showUploadOptions ? 'rotate-45 bg-red-500' : ''} border-4 border-white`}
                    >
                        <span className="text-2xl">{showUploadOptions ? '✕' : '📸'}</span>
                    </button>
                </div>

            </div>
        </PageTransition>
    );
};

export default NewProjects;