import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import { auth } from '../firebase';
import { compressImage } from '../utils/imageCompression';
import { FiCamera, FiUpload, FiMapPin, FiSave, FiAlertCircle, FiCheck } from 'react-icons/fi';
import BottomNav from './BottomNav';

// Helper for Section Headers
const SectionHeader = ({ title, icon }) => (
    <div className="flex items-center gap-3 text-slate-700 font-bold text-sm uppercase mt-8 mb-4 border-b border-slate-100 pb-2">
        <span className="text-xl">{icon}</span>
        <h2>{title}</h2>
    </div>
);

const LguForms = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false);

    // --- FORM STATE ---
    const [formData, setFormData] = useState({
        // 1. Project Basic Info
        school_id: '',
        school_name: '',
        region: '',
        division: '',
        district: '',
        project_name: '',
        
        // 2. Project Details
        source_agency: '',
        contractor_name: '',
        lsb_resolution_no: '',
        moa_ref_no: '',
        moa_date: '',
        validity_period: '',
        contract_duration: '',
        date_approved_pow: '',
        approved_contract_budget: '',
        
        // 3. Fund Release
        schedule_of_fund_release: 'Lumpsum', // or 'Tranches'
        number_of_tranches: '',
        amount_per_tranche: '',
        total_funds: '',
        fund_released: '',
        date_of_release: '',

        // 4. Procurement
        mode_of_procurement: '',
        philgeps_ref_no: '',
        pcab_license_no: '',
        date_contract_signing: '',
        date_notice_of_award: '',
        bid_amount: '',

        // 5. Location
        latitude: '',
        longitude: '',

        // 6. Progress
        project_status: 'Not Yet Started',
        accomplishment_percentage: 0,
        status_as_of_date: new Date().toISOString().split('T')[0],
        amount_utilized: '',
        nature_of_delay: ''
    });

    // --- DOCUMENTS STATE ---
    const [documents, setDocuments] = useState({
        POW: null,
        DUPA: null,
        CONTRACT: null
    });

    // --- IMAGES STATE ---
    const [internalFiles, setInternalFiles] = useState([]);
    const [internalPreviews, setInternalPreviews] = useState([]);
    const [externalFiles, setExternalFiles] = useState([]);
    const [externalPreviews, setExternalPreviews] = useState([]);
    const [activeCategory, setActiveCategory] = useState('External');
    const [hasProjects, setHasProjects] = useState(false); // Default false for safety
    const [checkingProjects, setCheckingProjects] = useState(true);
    const fileInputRef = useRef(null);

    // --- CHECK FOR EXISTING PROJECTS ---
    useEffect(() => {
        const checkProjects = async () => {
            if (!auth.currentUser) return;
            try {
                const res = await fetch(`/api/lgu/projects?uid=${auth.currentUser.uid}`);
                if (res.ok) {
                    const data = await res.json();
                    setHasProjects(data.length > 0);
                }
            } catch (err) {
                console.error("Failed to check projects:", err);
            } finally {
                setCheckingProjects(false);
            }
        };
        // Wait for auth to settle
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                checkProjects();
            } else {
                setCheckingProjects(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // --- HANDLERS ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNumberChange = (e) => {
        const { name, value } = e.target;
        // Allow numbers and decimal points only
        const rawVal = value.replace(/[^0-9.]/g, '');
        // Format with commas
        const formatted = rawVal.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        setFormData(prev => ({ ...prev, [name]: formatted }));
    };

    // --- SCHOOL VALIDATION ---
    const handleSchoolLookup = async () => {
        if (!formData.school_id || formData.school_id.length !== 6) {
            alert("Please enter a valid 6-digit School ID.");
            return;
        }

        setIsLookingUp(true);
        try {
            const res = await fetch(`/api/school-profile/${formData.school_id}`);
            if (res.ok) {
                const school = await res.json();
                setFormData(prev => ({
                    ...prev,
                    school_name: school.school_name || '',
                    region: school.region || '',
                    division: school.division || '',
                    district: school.district || school.municipality || '',
                    latitude: school.latitude || prev.latitude,
                    longitude: school.longitude || prev.longitude
                }));
                alert(`✅ School Found: ${school.school_name}`);
            } else {
                alert("❌ School not found in database.");
                setFormData(prev => ({ ...prev, school_name: '', region: '', division: '' }));
            }
        } catch (err) {
            console.error("Lookup failed", err);
            alert("Connection error during lookup.");
        } finally {
            setIsLookingUp(false);
        }
    };

    // --- GEOLOCATION ---
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: pos.coords.latitude.toFixed(6),
                    longitude: pos.coords.longitude.toFixed(6)
                }));
            },
            (err) => {
                console.error("Geo Error:", err);
                alert("Unable to retrieve location. Please check permissions.");
            }
        );
    };

    // --- FILE HANDLING ---
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

    const handleDocSelect = (e, type) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            setDocuments(prev => ({ ...prev, [type]: file }));
        } else {
            alert("Please upload a valid PDF file.");
        }
    };
    
    const convertToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    };

    // --- SUBMIT ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.school_name) {
            alert("Please validate the School ID first.");
            return;
        }
        if (!documents.POW || !documents.DUPA || !documents.CONTRACT) {
            alert("Please upload all required Project Documents (POW, DUPA, Contract).");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Prepare Payload
            const payload = { 
                ...formData,
                created_by_uid: auth.currentUser?.uid // Add User ID
            };
            // Auto-calc some logic if needed
            
            // 2. Submit Project Data
            const res = await fetch('/api/lgu/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (!data.success) throw new Error(data.error || "Failed to create project");
            
            const projectId = data.lgu_project_id;

            // 3. Upload Images (Internal & External)
            const uploadImages = async (files, category) => {
                for (const file of files) {
                    const compressed = await compressImage(file);
                    await fetch('/api/lgu/upload-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            project_id: projectId, 
                            image_data: compressed,
                            uploaded_by: auth.currentUser?.uid || 'LGU',
                            category: category // 'Internal' or 'External'
                        })
                    });
                }
            };

            await uploadImages(internalFiles, 'Internal');
            await uploadImages(externalFiles, 'External');

            // 4. Upload Documents
            const uploadDoc = async (type, file) => {
                const base64 = await convertToBase64(file);
                await fetch('/api/lgu/upload-document', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        project_id: projectId,
                        doc_type: type,
                        file_data: base64
                    })
                });
            };

            await uploadDoc('POW', documents.POW);
            await uploadDoc('DUPA', documents.DUPA);
            await uploadDoc('CONTRACT', documents.CONTRACT);

            alert("✅ Project Created Successfully!");
            navigate('/lgu-dashboard'); // Redirect to dashboard

        } catch (err) {
            console.error(err);
            alert("Error submitting project: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 font-sans pb-32">
                 {/* Header */}
                <div className="bg-[#004A99] pt-8 pb-16 px-6 rounded-b-[2rem] shadow-xl">
                    <div className="flex items-center gap-3 text-white mb-4">
                        {hasProjects && (
                            <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full">
                                <FiUpload className="rotate-[-90deg]" />
                            </button>
                        )}
                        <h1 className="text-xl font-bold">New LGU Project</h1>
                    </div>
                    <p className="text-blue-100 text-sm opacity-80 pl-2">Fill in all details completely.</p>
                </div>

                <form onSubmit={handleSubmit} className="px-6 -mt-10 relative z-10 space-y-6">
                    
                    {/* 1. PROJECT INFO */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <SectionHeader title="Project Info" icon="📂" />
                        <div className="space-y-4">
                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Project Name <span className="text-red-500">*</span></label>
                                <input name="project_name" value={formData.project_name} onChange={handleChange} required className="w-full p-3 border border-slate-200 rounded-xl" placeholder="Full Project Title" />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">School ID <span className="text-red-500">*</span></label>
                                    <div className="flex">
                                        <input name="school_id" value={formData.school_id} onChange={handleChange} maxLength={6} required className="w-full p-3 border border-slate-200 rounded-l-xl" placeholder="ID" />
                                        <button type="button" onClick={handleSchoolLookup} disabled={isLookingUp} className="bg-blue-500 text-white px-3 rounded-r-xl font-bold text-sm">
                                            {isLookingUp ? '...' : 'Go'}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">School Name</label>
                                    <input name="school_name" value={formData.school_name} readOnly className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500" />
                                </div>
                            </div>

                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Source Agency</label>
                                <select name="source_agency" value={formData.source_agency} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl">
                                    <option value="">Select Agency</option>
                                    <option value="Provincial Government">Provincial Government</option>
                                    <option value="Municipal Government">Municipal Government</option>
                                    <option value="City Government">City Government</option>
                                    <option value="SEF">SEF (Special Education Fund)</option>
                                    <option value="Others">Others</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Contractor Name</label>
                                <input name="contractor_name" value={formData.contractor_name} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl" />
                            </div>
                        </div>
                    </div>

                    {/* 2. DOCUMENTATION */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <SectionHeader title="Documentation" icon="📄" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">LSB Resolution #</label>
                                <input name="lsb_resolution_no" value={formData.lsb_resolution_no} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">MOA Ref #</label>
                                <input name="moa_ref_no" value={formData.moa_ref_no} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Date of MOA</label>
                                <input type="date" name="moa_date" value={formData.moa_date} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Validity Period</label>
                                <input name="validity_period" value={formData.validity_period} onChange={handleChange} placeholder="e.g. 1 Year" className="w-full p-3 border border-slate-200 rounded-xl" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Contract Duration</label>
                                <input name="contract_duration" value={formData.contract_duration} onChange={handleChange} placeholder="e.g. 180 CD" className="w-full p-3 border border-slate-200 rounded-xl" />
                            </div>
                        </div>
                    </div>

                    {/* 3. FINANCE & BUDGET */}
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <SectionHeader title="Finance & Budget" icon="💰" />
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Approved Budget</label>
                                    <input name="approved_contract_budget" value={formData.approved_contract_budget} onChange={handleNumberChange} type="text" className="w-full p-3 border border-slate-200 rounded-xl font-mono" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Bid Amount</label>
                                    <input name="bid_amount" value={formData.bid_amount} onChange={handleNumberChange} type="text" className="w-full p-3 border border-slate-200 rounded-xl font-mono" placeholder="0.00" />
                                </div>
                            </div>

                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Schedule of Fund Release</label>
                                <select name="schedule_of_fund_release" value={formData.schedule_of_fund_release} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl">
                                    <option value="Lumpsum">Lumpsum</option>
                                    <option value="Tranches">Tranches</option>
                                </select>
                            </div>

                            {formData.schedule_of_fund_release === 'Tranches' && (
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase"># of Tranches</label>
                                        <input name="number_of_tranches" value={formData.number_of_tranches} onChange={handleNumberChange} type="number" className="w-full p-2 border border-slate-200 rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Amount / Tranche</label>
                                        <input name="amount_per_tranche" value={formData.amount_per_tranche} onChange={handleNumberChange} type="text" className="w-full p-2 border border-slate-200 rounded-lg" />
                                    </div>
                                </div>
                            )}

                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Total Funds</label>
                                    <input name="total_funds" value={formData.total_funds} onChange={handleNumberChange} type="text" className="w-full p-3 border border-slate-200 rounded-xl font-mono text-blue-600 font-bold" />
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Funds Released</label>
                                        <input name="fund_released" value={formData.fund_released} onChange={handleNumberChange} type="text" className="w-full p-3 border border-slate-200 rounded-xl font-mono text-emerald-600 font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Date Released</label>
                                        <input type="date" name="date_of_release" value={formData.date_of_release} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl" />
                                    </div>
                                </div>
                            </div>
                        </div>
                     </div>

                    {/* 4. PROCUREMENT */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <SectionHeader title="Procurement" icon="⚖️" />
                        <div className="space-y-4">
                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Mode of Procurement</label>
                                <select name="mode_of_procurement" value={formData.mode_of_procurement} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl">
                                    <option value="">Select Mode</option>
                                    <option value="Public Bidding">Public Bidding</option>
                                    <option value="Negotiated Procurement">Negotiated Procurement</option>
                                    <option value="Shopping">Shopping</option>
                                    <option value="Direct Contracting">Direct Contracting</option>
                                    <option value="Small Value Procurement">Small Value Procurement</option>
                                </select>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">PhilGEPS Ref #</label>
                                    <input name="philgeps_ref_no" value={formData.philgeps_ref_no} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">PCAB License #</label>
                                    <input name="pcab_license_no" value={formData.pcab_license_no} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Notice of Award</label>
                                    <input type="date" name="date_notice_of_award" value={formData.date_notice_of_award} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Contract Signing</label>
                                    <input type="date" name="date_contract_signing" value={formData.date_contract_signing} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. LOCATION */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <SectionHeader title="Site Location" icon="📍" />
                         <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Latitude</label>
                                <input name="latitude" value={formData.latitude} readOnly className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Longitude</label>
                                <input name="longitude" value={formData.longitude} readOnly className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600" />
                            </div>
                        </div>
                        <button type="button" onClick={handleGetLocation} className="w-full py-3 bg-blue-50 text-blue-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100">
                            <FiMapPin /> Get Current Location
                        </button>
                    </div>

                     {/* 6. PROGRESS */}
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <SectionHeader title="Progress Monitoring" icon="📈" />
                        <div className="space-y-4">
                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Project Status</label>
                                <select name="project_status" value={formData.project_status} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl">
                                    <option value="Not Yet Started">Not Yet Started</option>
                                    <option value="Ongoing">Ongoing</option>
                                    <option value="For Final Inspection">For Final Inspection</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Accomplishment Percentage (%)</label>
                                    <div className="flex gap-1">
                                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, accomplishment_percentage: Math.min(100, Number(prev.accomplishment_percentage || 0) + 5) }))} className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded hover:bg-green-200 transition">+5%</button>
                                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, accomplishment_percentage: Math.min(100, Number(prev.accomplishment_percentage || 0) + 10) }))} className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded hover:bg-green-200 transition">+10%</button>
                                    </div>
                                </div>
                                <input type="number" name="accomplishment_percentage" min="0" max="100" value={formData.accomplishment_percentage} onChange={handleNumberChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Status As Of</label>
                                <input type="date" name="status_as_of_date" value={formData.status_as_of_date} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Amount Utilized</label>
                                <input name="amount_utilized" value={formData.amount_utilized} onChange={handleNumberChange} type="number" className="w-full p-3 border border-slate-200 rounded-xl" />
                            </div>
                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Nature of Delay (if any)</label>
                                <textarea name="nature_of_delay" value={formData.nature_of_delay} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-xl" rows="2" />
                            </div>
                        </div>
                    </div>

                     {/* 7. UPLOADS */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <SectionHeader title="Attachments" icon="📎" />
                        
                        <div className="mb-6 space-y-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase">Required Documents (PDF)</h3>
                            {['POW', 'DUPA', 'CONTRACT'].map(type => (
                                <div key={type} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <span className="font-bold text-slate-700 text-sm">{type}</span>
                                    <label className="cursor-pointer bg-white border border-blue-200 text-blue-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-50">
                                        {documents[type] ? <span className="flex items-center gap-1 text-emerald-600"><FiCheck /> Attached</span> : 'Upload PDF'}
                                        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleDocSelect(e, type)} />
                                    </label>
                                </div>
                            ))}
                        </div>

                        <div>
                        {!['Not Yet Started', 'Under Procurement'].includes(formData.project_status) && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <SectionHeader title="Site Photos" icon="📸" />
                                <div className="space-y-6">

                                    {/* EXTERNAL PHOTOS */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="font-bold text-slate-700 text-xs uppercase">External Photos</h3>
                                            <span className="text-[10px] font-bold text-blue-500">{externalFiles.length} Added</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 mb-3 italic">
                                            Front, Left, Right, Rear (wide shots)
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <button type="button" onClick={() => triggerFilePicker('camera', 'External')} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-400">
                                                <span className="text-lg">📸</span> <span className="text-[10px] font-bold text-slate-600">Camera</span>
                                            </button>
                                            <button type="button" onClick={() => triggerFilePicker('gallery', 'External')} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-400">
                                                <span className="text-lg">🖼️</span> <span className="text-[10px] font-bold text-slate-600">Gallery</span>
                                            </button>
                                        </div>
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

                                    {/* INTERNAL PHOTOS */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="font-bold text-slate-700 text-xs uppercase">Internal Photos</h3>
                                            <span className="text-[10px] font-bold text-blue-500">{internalFiles.length} Added</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 mb-3 italic">
                                            Classrooms, Ceiling, Lighting, etc.
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <button type="button" onClick={() => triggerFilePicker('camera', 'Internal')} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-400">
                                                <span className="text-lg">📸</span> <span className="text-[10px] font-bold text-slate-600">Camera</span>
                                            </button>
                                            <button type="button" onClick={() => triggerFilePicker('gallery', 'Internal')} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-400">
                                                <span className="text-lg">🖼️</span> <span className="text-[10px] font-bold text-slate-600">Gallery</span>
                                            </button>
                                        </div>
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
                                <input type="file" ref={fileInputRef} multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                            </div>
                        )}
                    </div>
                    </div>

                    {/* SUBMIT */}
                    <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-slate-100 z-50 flex gap-3">
                        <button 
                            type="button" 
                            onClick={() => navigate('/lgu-dashboard')} 
                            disabled={!hasProjects || checkingProjects}
                            className={`flex-1 py-3 font-bold rounded-xl transition-colors ${(!hasProjects || checkingProjects) ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {checkingProjects ? 'Loading...' : (!hasProjects ? 'Cancel (Required)' : 'Cancel')}
                        </button>
                        <button type="submit" disabled={isSubmitting} className="flex-[2] py-3 bg-[#004A99] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
                            {isSubmitting ? 'Saving...' : <><FiSave /> Save Project</>}
                        </button>
                    </div>

                </form>
            </div>
        </PageTransition>
    );
};

export default LguForms;
