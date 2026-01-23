// src/forms/SchoolInformation.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
// LoadingScreen import removed 
import { addToOutbox } from '../db';
import Papa from 'papaparse'; //
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';
import { FiArrowLeft, FiUser, FiMapPin, FiBriefcase, FiHash, FiSearch, FiCheckCircle, FiSave, FiAlertCircle } from 'react-icons/fi';

const SchoolInformation = () => {
    const navigate = useNavigate();

    // --- STATE MANAGEMENT ---
    const location = useLocation();
    const isDummy = location.state?.isDummy || false; // NEW: Dummy Mode Check
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const [isLocked, setIsLocked] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const [showSaveModal, setShowSaveModal] = useState(false);
    const [isChecked, setIsChecked] = useState(false);
    const [editAgreement, setEditAgreement] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const [formData, setFormData] = useState({
        lastName: '', firstName: '', middleName: '',
        itemNumber: '', positionTitle: '', dateHired: '',
        sex: '', region: '', division: ''
    });

    const [originalData, setOriginalData] = useState(null);

    const positionOptions = [
        "Teacher I", "Teacher II", "Teacher III", "Master Teacher I", "Master Teacher II",
        "Master Teacher III", "Master Teacher IV", "SPED Teacher I", "SPED Teacher II",
        "SPED Teacher III", "SPED Teacher IV", "SPED Teacher V", "Special Science Teacher I",
        "Special Science Teacher II", "Head Teacher I", "Head Teacher II", "Head Teacher III",
        "Head Teacher IV", "Head Teacher V", "Head Teacher VI", "Assistant School Principal I",
        "Assistant School Principal II", "School Principal I", "School Principal II",
        "School Principal III", "School Principal IV", "Special School Principal I",
        "Special School Principal II", "Vocational School Administrator I",
        "Vocational School Administrator II", "Vocational School Administrator III",
        "Public School District Supervisor"
    ];

    const goBack = () => {
        if (isDummy) {
            navigate(-1);
        } else {
            navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');
        }
    };

    // --- 1. CSV LOOKUP LOGIC ---
    // This function matches PSI_CD from Oct2025-GMIS-Filled RAW.csv
    const handlePsiLookup = (psiCd) => {
        const cleanPsi = String(psiCd).trim();
        if (cleanPsi.length < 5) return;

        setIsSearching(true);
        Papa.parse("/Oct2025-GMIS-Filled_Minified.csv", {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                // Find match based on PSI_CD column
                const match = results.data.find(row =>
                    String(row.PSI_CD).trim() === cleanPsi
                );

                if (match) {
                    setFormData(prev => ({
                        ...prev,
                        lastName: match.LAST_NAME || '',
                        firstName: match.FIRST_NAME || '',
                        middleName: match.MID_NAME || '',
                        positionTitle: match.POS_DSC || '',
                        sex: match.SEX || '',
                        region: match.UACS_REG_DSC || '',
                        division: match.UACS_DIV_DSC || ''
                    }));
                } else {
                    console.warn("No match found for PSI_CD:", cleanPsi);
                }
                setIsSearching(false);
            },
            error: (err) => {
                console.error("CSV Parse Error:", err);
                setIsSearching(false);
            }
        });
    };

    // --- 2. LOAD DATA ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Determine which ID to use for fetching
                    // If viewOnly and schoolIdParam are present, we fetch by School ID
                    // BUT /api/school-head/:uid usually takes user UID. 
                    // Let's check api/index.js for a dedicated monitor endpoint or use school-detail

                    let fetchUrl = `/api/school-head/${user.uid}`;
                    if (viewOnly && schoolIdParam) {
                        fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                    }

                    const response = await fetch(fetchUrl);
                    if (response.ok) {
                        const result = await response.json();
                        // Handle difference in response structure: result.data (from school-head) vs result (from school-detail)
                        const data = (viewOnly && schoolIdParam) ? result : (result.exists ? result.data : null);

                        if (data) {
                            const loadedData = {
                                lastName: data.head_last_name || data.last_name || '',
                                firstName: data.head_first_name || data.first_name || '',
                                middleName: data.head_middle_name || data.middle_name || '',
                                itemNumber: data.head_item_number || data.item_number || '',
                                positionTitle: data.head_position_title || data.position_title || '',
                                dateHired: data.head_date_hired ? data.head_date_hired.split('T')[0] : '',
                                sex: data.head_sex || '',
                                region: data.head_region || '',
                                division: data.head_division || ''
                            };
                            setFormData(loadedData);
                            setOriginalData(loadedData);
                            setLastUpdated(data.updated_at || data.submitted_at);
                            setIsLocked(true);
                        }
                    }
                } catch (error) {
                    console.log("Offline or Server Error.");
                }
            }
            setTimeout(() => setLoading(false), 1000);
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Trigger lookup when user finishes typing the Item Number
    const handleItemNumberBlur = () => {
        handlePsiLookup(formData.itemNumber);
    };

    // --- 3. SAVE LOGIC ---
    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);
        const user = auth.currentUser;

        // Package all data including the new CSV fields
        const payload = {
            uid: user.uid,
            ...formData // Includes lastName, firstName, middleName, itemNumber, positionTitle, dateHired, sex, region, division
        };

        if (!navigator.onLine) {
            try {
                await addToOutbox({
                    type: 'SCHOOL_HEAD_INFO',
                    label: 'School Head Info',
                    url: '/api/save-school-head',
                    payload: payload
                });
                setShowOfflineModal(true);
                setIsLocked(true);
            } finally {
                setIsSaving(false);
            }
            return;
        }

        try {
            const response = await fetch('/api/save-school-head', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setShowSuccessModal(true);
                setOriginalData({ ...formData });
                setIsLocked(true);
            } else {
                const err = await response.json();
                alert('Error: ' + err.error);
            }
        } catch (error) {
            await addToOutbox({
                type: 'SCHOOL_HEAD_INFO',
                label: 'School Head Info',
                url: '/api/save-school-head',
                payload: payload
            });
            setShowOfflineModal(true);
            setIsLocked(true);
        } finally {
            setIsSaving(false);
        }
    };

    // LoadingScreen check removed

    if (loading) return (
        <div className="min-h-screen grid place-items-center bg-slate-50">
            <div className="w-10 h-10 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
        </div>
    );

    const inputClass = "w-full h-12 px-4 font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all hover:border-blue-200 disabled:bg-slate-100 disabled:text-slate-400";
    const labelClass = "text-[9px] font-bold text-slate-400 uppercase mb-1 block ml-1";
    const sectionClass = "bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-5";

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-40">
            {/* --- PREMIUM BLUE HEADER --- */}
            <div className="bg-[#004A99] px-6 pt-10 pb-20 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />

                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                        <FiArrowLeft size={24} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-white tracking-tight">School Head Info</h1>
                            {isDummy && (
                                <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-200 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-amber-500/30">
                                    Sample Mode
                                </span>
                            )}
                        </div>
                        <p className="text-blue-100 text-xs font-medium mt-1">
                            {viewOnly ? "Monitor View (Read-Only)" : (lastUpdated ? `Last Verified: ${new Date(lastUpdated).toLocaleDateString()}` : 'Manage personnel record')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-10 relative z-20 max-w-3xl mx-auto space-y-5">

                {/* --- PSI_CD LOOKUP SECTION --- */}
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                            <FiHash />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Item Number</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PSI_CD Lookup</p>
                        </div>
                    </div>

                    <div className="relative">
                        <label className={labelClass}>PSI_CD / Item No.</label>
                        <input
                            type="text"
                            name="itemNumber"
                            value={formData.itemNumber}
                            onChange={handleChange}
                            onBlur={handleItemNumberBlur}
                            placeholder="e.g. OSEC-DECSB-ADA1-27-2004"
                            className={`${inputClass} !border-blue-200 text-blue-700`}
                            disabled={isLocked || viewOnly || isDummy}
                        />
                        {isSearching && (
                            <div className="absolute right-4 bottom-3 animate-spin text-blue-500">
                                <FiSearch />
                            </div>
                        )}
                    </div>
                    {!isLocked && !viewOnly && !isDummy && (
                        <p className="text-[10px] text-blue-400 mt-2 font-medium ml-1">
                            💡 Enter Item Number and tap outside to autofill details.
                        </p>
                    )}
                </div>

                {/* --- PERSONAL DETAILS --- */}
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
                            <FiUser />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Personal Details</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Basic Information</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className={labelClass}>First Name</label>
                            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>Middle Name</label>
                            <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>Last Name</label>
                            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy} />
                        </div>
                        <div className="md:col-span-3 space-y-1">
                            <label className={labelClass}>Sex</label>
                            <input type="text" name="sex" value={formData.sex} readOnly className={`${inputClass} !bg-slate-100 !text-slate-500`} disabled={true} />
                        </div>
                    </div>
                </div>

                {/* --- STATION DETAILS --- */}
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl">
                            <FiMapPin />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Station Details</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Location Assignment</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className={labelClass}>Region</label>
                            <input type="text" value={formData.region} readOnly className={`${inputClass} !bg-slate-100 !text-slate-500`} disabled={true} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>Division</label>
                            <input type="text" value={formData.division} readOnly className={`${inputClass} !bg-slate-100 !text-slate-500`} disabled={true} />
                        </div>
                    </div>
                </div>

                {/* --- APPOINTMENT DATA --- */}
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
                            <FiBriefcase />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Appointment</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Position & Hiring Date</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className={labelClass}>Position Title</label>
                            <select name="positionTitle" value={formData.positionTitle} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy}>
                                <option value="">Select Position...</option>
                                {positionOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>Date of Appointment</label>
                            <input type="date" name="dateHired" value={formData.dateHired} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy} />
                        </div>
                    </div>
                </div>
            </div>

            {/* --- FLOATING ACTION BAR --- */}
            <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-50">
                <div className="max-w-4xl mx-auto flex gap-3">
                    {(viewOnly || isDummy) ? (
                        <button
                            type="button"
                            onClick={() => navigate('/jurisdiction-schools')}
                            className="w-full py-4 rounded-2xl bg-[#004A99] text-white font-bold shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                        >
                            <FiArrowLeft /> Back to School List
                        </button>
                    ) : isLocked ? (
                        <button
                            onClick={() => setShowEditModal(true)}
                            className="w-full py-4 rounded-2xl bg-amber-500 text-white font-bold shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors"
                        >
                            <span>✏️</span> Unlock to Edit
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => { setFormData(originalData); setIsLocked(true); }}
                                className="w-1/3 py-4 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setShowSaveModal(true)}
                                disabled={isSaving}
                                className="w-2/3 py-4 rounded-2xl bg-[#004A99] text-white font-bold shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                            >
                                {isSaving ? "Saving..." : <><FiSave /> Save Changes</>}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* --- MODALS --- */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-blue-600 text-2xl">
                            <FiCheckCircle />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Confirm Updates</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6">Are you sure the information is correct?</p>

                        <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer mb-6 border border-transparent hover:border-slate-100 transition">
                            <input type="checkbox" checked={isChecked} onChange={(e) => setIsChecked(e.target.checked)} className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-600" />
                            <span className="text-xs font-bold text-slate-600 select-none">I certify this information is correct.</span>
                        </label>

                        <div className="flex gap-2">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancel</button>
                            <button onClick={confirmSave} disabled={!isChecked} className={`flex-1 py-3 rounded-xl text-white font-bold shadow-sm ${isChecked ? 'bg-[#004A99] hover:bg-blue-800' : 'bg-slate-200 cursor-not-allowed'}`}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Warning Modal for Unlock */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4 text-amber-500 text-2xl">
                            <FiAlertCircle />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Edit Information?</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6">You are about to modify official school head records. Please confirm to proceed.</p>

                        <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer mb-6 border border-transparent hover:border-slate-100 transition">
                            <input type="checkbox" checked={editAgreement} onChange={(e) => setEditAgreement(e.target.checked)} className="mt-1 w-4 h-4 text-amber-600 rounded focus:ring-amber-600" />
                            <span className="text-xs font-bold text-slate-600 select-none">I understand and wish to proceed.</span>
                        </label>

                        <div className="flex gap-2">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancel</button>
                            <button onClick={() => { setShowEditModal(false); setIsLocked(false); }} disabled={!editAgreement} className={`flex-1 py-3 rounded-xl text-white font-bold shadow-sm ${editAgreement ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-200 cursor-not-allowed'}`}>Proceed</button>
                        </div>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="School Head Information saved successfully!" />
        </div>
    );
};

export default SchoolInformation;