// src/forms/SchoolInformation.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
// LoadingScreen import removed 
import { addToOutbox } from '../db';
import Papa from 'papaparse'; //

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

    const goBack = () => navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');

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
                alert("Data saved to Outbox! Sync when online.");
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
                alert('School Head Information saved successfully!');
                setOriginalData({ ...formData });
                setIsLocked(true);
            } else {
                const err = await response.json();
                alert('Error: ' + err.error);
            }
        } catch (error) {
            alert("Network Error. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    // LoadingScreen check removed

    const inputClass = `w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#004A99] dark:focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 font-semibold text-[14px] shadow-sm disabled:bg-gray-100 dark:disabled:bg-slate-900 disabled:text-gray-500 transition-all`;
    const labelClass = "block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1 ml-1";
    const sectionClass = "bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mb-6";

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-32 relative">
            {/* DUMMY MODE BANNER */}
            {isDummy && (
                <div className="bg-amber-100 border-b border-amber-200 px-6 py-3 sticky top-0 z-50 flex items-center justify-center gap-2 shadow-sm">
                    <span className="font-bold text-amber-800 text-sm uppercase tracking-wide">⚠️ Sample Mode: Read-Only Preview</span>
                </div>
            )}
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white/80 hover:text-white text-2xl transition">&larr;</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">School Head Info</h1>
                        <p className="text-blue-200 text-xs mt-1">
                            {viewOnly ? "Monitor View (Read-Only)" : (lastUpdated ? `Last Verified: ${new Date(lastUpdated).toLocaleDateString()}` : 'Manage personnel record')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-3xl mx-auto">
                {/* PSI_CD LOOKUP SECTION */}
                <div className={sectionClass}>
                    <label className={labelClass}>Item Number (PSI_CD)</label>
                    <div className="relative">
                        <input
                            type="text"
                            name="itemNumber"
                            value={formData.itemNumber}
                            onChange={handleChange}
                            onBlur={handleItemNumberBlur}
                            placeholder="Enter PSI_CD for autofill..."
                            className={`${inputClass} !border-blue-200`}
                            disabled={isLocked || viewOnly || isDummy}
                        />
                        {isSearching && <span className="absolute right-4 top-3 animate-spin">⏳</span>}
                    </div>
                    <p className="text-[10px] text-blue-500 mt-2 italic font-medium">
                        💡 Enter your Item Number (e.g. OSEC-DECSB-ADA1-27-2004) and tap outside to autofill.
                    </p>
                </div>

                {/* PERSONAL DETAILS */}
                <div className={sectionClass}>
                    <h2 className="text-gray-800 dark:text-slate-200 font-bold text-lg flex items-center gap-2 mb-4">
                        <span className="text-xl">🆔</span> Personal Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>First Name</label>
                            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy} />
                        </div>
                        <div>
                            <label className={labelClass}>Middle Name</label>
                            <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy} />
                        </div>
                        <div>
                            <label className={labelClass}>Last Name</label>
                            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy} />
                        </div>
                        <div className="md:col-span-3">
                            <label className={labelClass}>Sex</label>
                            <input type="text" name="sex" value={formData.sex} readOnly className={inputClass} disabled={true} />
                        </div>
                    </div>
                </div>

                {/* STATION DETAILS */}
                <div className={sectionClass}>
                    <h2 className="text-gray-800 dark:text-slate-200 font-bold text-lg flex items-center gap-2 mb-4">
                        <span className="text-xl">📍</span> Station Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Region</label>
                            <input type="text" value={formData.region} readOnly className={inputClass} disabled={true} />
                        </div>
                        <div>
                            <label className={labelClass}>Division</label>
                            <input type="text" value={formData.division} readOnly className={inputClass} disabled={true} />
                        </div>
                    </div>
                </div>

                {/* APPOINTMENT DATA */}
                <div className={sectionClass}>
                    <h2 className="text-gray-800 dark:text-slate-200 font-bold text-lg flex items-center gap-2 mb-4">
                        <span className="text-xl">💼</span> Appointment Data
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Position Title</label>
                            <select name="positionTitle" value={formData.positionTitle} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy}>
                                <option value="">Select Position...</option>
                                {positionOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Date of Appointment</label>
                            <input type="date" name="dateHired" value={formData.dateHired} onChange={handleChange} className={inputClass} disabled={isLocked || viewOnly || isDummy} />
                        </div>
                    </div>
                </div>
            </div>

            {/* FOOTER */}
            {(viewOnly || isDummy) ? (
                <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 pb-8 z-50 flex gap-3 shadow-lg">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="w-full bg-[#004A99] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-800 active:scale-[0.98] transition flex items-center justify-center gap-2"
                    >
                        ← Back
                    </button>
                </div>
            ) : (
                <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 pb-8 z-50 flex gap-3 shadow-lg">
                    {isLocked ? (
                        <button onClick={() => { setShowEditModal(true); }} className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-amber-600 flex items-center justify-center gap-2">
                            <span>✏️</span> Unlock to Edit
                        </button>
                    ) : (
                        <>
                            <button onClick={() => { setFormData(originalData); setIsLocked(true); }} className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-bold py-4 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600">Cancel</button>
                            <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-[#A30000] flex items-center justify-center gap-2">
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm">
                        <h3 className="text-lg font-bold dark:text-slate-200">Confirm Updates</h3>
                        <label className="flex items-start gap-3 my-6">
                            <input type="checkbox" checked={isChecked} onChange={(e) => setIsChecked(e.target.checked)} className="mt-1" />
                            <span className="text-xs font-bold text-gray-700 dark:text-slate-400">I certify this information is correct.</span>
                        </label>
                        <div className="flex gap-2">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border dark:border-slate-700 rounded-xl dark:text-slate-400">Cancel</button>
                            <button onClick={confirmSave} disabled={!isChecked} className="flex-1 py-3 rounded-xl bg-[#CC0000] text-white font-bold">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SchoolInformation;