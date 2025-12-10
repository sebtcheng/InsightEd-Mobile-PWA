import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase'; 
import { onAuthStateChanged } from "firebase/auth";
import LoadingScreen from '../components/LoadingScreen'; 

const SchoolInformation = () => {
    const navigate = useNavigate();

    // --- STATE MANAGEMENT ---
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Mode States
    const [isLocked, setIsLocked] = useState(false); 
    const [lastUpdated, setLastUpdated] = useState(null);

    // Modals
    const [showSaveModal, setShowSaveModal] = useState(false); 
    const [showEditModal, setShowEditModal] = useState(false); 
    const [isChecked, setIsChecked] = useState(false); 
    const [editAgreement, setEditAgreement] = useState(false); 

    const [formData, setFormData] = useState({
        lastName: '', firstName: '', middleName: '',
        itemNumber: '', positionTitle: '', dateHired: ''
    });

    const [originalData, setOriginalData] = useState(null);

    const positionOptions = [
        "Teacher I", "Teacher II", "Teacher III",
        "Master Teacher I", "Master Teacher II", "Master Teacher III", "Master Teacher IV",
        "SPED Teacher I", "SPED Teacher II", "SPED Teacher III", "SPED Teacher IV", "SPED Teacher V",
        "Special Science Teacher I", "Special Science Teacher II",
        "Head Teacher I", "Head Teacher II", "Head Teacher III", "Head Teacher IV", "Head Teacher V", "Head Teacher VI",
        "Assistant School Principal I", "Assistant School Principal II",
        "School Principal I", "School Principal II", "School Principal III", "School Principal IV",
        "Special School Principal I", "Special School Principal II",
        "Vocational School Administrator I", "Vocational School Administrator II", "Vocational School Administrator III",
        "Public School District Supervisor"
    ];

    const goBack = () => navigate('/school-forms');

    // --- HELPER: FORMAT TIMESTAMP ---
    const formatTimestamp = (isoString) => {
        if (!isoString) return '';
        return new Date(isoString).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', 
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    };

    // --- HELPER: DETECT CHANGES ---
    const getChanges = () => {
        if (!originalData) return [];
        const changes = [];
        Object.keys(formData).forEach(key => {
            if (formData[key] !== originalData[key]) {
                changes.push({
                    field: key,
                    oldVal: originalData[key],
                    newVal: formData[key]
                });
            }
        });
        return changes;
    };

    // --- 1. LOAD DATA ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const response = await fetch(`http://localhost:3000/api/school-head/${user.uid}`);
                    if (response.ok) {
                        const result = await response.json();
                        if (result.exists) {
                            const data = result.data;
                            const loadedData = {
                                lastName: data.last_name || '',
                                firstName: data.first_name || '',
                                middleName: data.middle_name || '',
                                itemNumber: data.item_number || '',
                                positionTitle: data.position_title || '',
                                dateHired: data.date_hired ? data.date_hired.split('T')[0] : ''
                            };
                            setFormData(loadedData);
                            setOriginalData(loadedData);
                            setLastUpdated(data.updated_at); 
                            setIsLocked(true);
                        }
                    }
                } catch (error) { console.error("Failed to load info:", error); }
            }
            setTimeout(() => { setLoading(false); }, 1000);
        });
        return () => unsubscribe();
    }, []);

    // --- HANDLERS ---
    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    // --- BUTTON ACTIONS ---
    const handleUpdateClick = () => { setEditAgreement(false); setShowEditModal(true); };
    
    const handleConfirmEdit = () => { 
        setOriginalData({...formData}); 
        setIsLocked(false); 
        setShowEditModal(false); 
    };
    
    const handleCancelEdit = () => { 
        if (originalData) setFormData(originalData); 
        setIsLocked(true); 
    };

    const handleSaveClick = (e) => { 
        e.preventDefault(); 
        if (!auth.currentUser) return; 
        setShowSaveModal(true); 
    };

    // --- 2. SAVE DATA ---
    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);
        const user = auth.currentUser;

        try {
            const payload = { uid: user.uid, ...formData };
            const response = await fetch('http://localhost:3000/api/save-school-head', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert('School Head Information saved successfully!');
                setLastUpdated(new Date().toISOString()); 
                setOriginalData({...formData});
                setIsLocked(true); 
            } else {
                const err = await response.json();
                alert('Error: ' + err.message);
            }
        } catch (error) { alert("Failed to connect."); } 
        finally { setIsSaving(false); }
    };
    
    // --- STYLES ---
    const inputClass = `w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004A99] bg-white text-gray-800 font-semibold text-[14px] shadow-sm disabled:bg-gray-100 disabled:text-gray-500 transition-all`;
    const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1";
    const sectionClass = "bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6";

    if (loading) return <LoadingScreen message="Loading Head Profile..." />;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-32 relative"> 
            
            {/* --- TOP HEADER (MATCHING THEME) --- */}
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white/80 hover:text-white text-2xl transition">&larr;</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">School Head Info</h1>
                        <p className="text-blue-200 text-xs mt-1">
                            {lastUpdated ? `Last Verified: ${formatTimestamp(lastUpdated)}` : 'Manage your personnel record'}
                        </p>
                    </div>
                </div>
            </div>

            {/* --- MAIN FORM CONTENT --- */}
            <div className="px-5 -mt-12 relative z-20 max-w-3xl mx-auto">
                <form onSubmit={handleSaveClick}>
                    
                    {/* SECTION 1: PERSONAL DETAILS */}
                    <div className={sectionClass}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2">
                                <span className="text-xl">🆔</span> Personal Details
                            </h2>
                            {isLocked && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">Verified</span>}
                            {!isLocked && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider animate-pulse">Editing</span>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>First Name</label>
                                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required placeholder="Juan" className={inputClass} disabled={isLocked} />
                            </div>
                            <div>
                                <label className={labelClass}>Middle Name</label>
                                <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} required placeholder="Dela" className={inputClass} disabled={isLocked} />
                            </div>
                            <div>
                                <label className={labelClass}>Last Name</label>
                                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required placeholder="Cruz" className={inputClass} disabled={isLocked} />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: APPOINTMENT DETAILS */}
                    <div className={sectionClass}>
                        <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2 mb-4">
                            <span className="text-xl">💼</span> Appointment Data
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Position Title</label>
                                <select name="positionTitle" value={formData.positionTitle} onChange={handleChange} required className={inputClass} disabled={isLocked}>
                                    <option value="">Select Position...</option>
                                    {positionOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Item Number</label>
                                <input type="text" name="itemNumber" value={formData.itemNumber} onChange={handleChange} required placeholder="OSEC-DECS..." className={inputClass} disabled={isLocked} />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>Date of First Appointment</label>
                                <input type="date" name="dateHired" value={formData.dateHired} onChange={handleChange} required className={inputClass} disabled={isLocked} />
                                <p className="text-[10px] text-gray-400 mt-1 ml-1">Refers to your first entry into DepEd service.</p>
                            </div>
                        </div>
                    </div>

                </form>
            </div>

            {/* --- FLOATING ACTION BAR (BOTTOM) --- */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 pb-8 z-50 flex gap-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                {isLocked ? (
                    <button 
                        onClick={handleUpdateClick}
                        className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-amber-600 active:scale-[0.98] transition flex items-center justify-center gap-2"
                    >
                        <span>✏️</span> Update Info
                    </button>
                ) : (
                    <>
                        <button onClick={handleCancelEdit} className="flex-1 bg-gray-100 text-gray-600 font-bold py-4 rounded-xl hover:bg-gray-200">Cancel</button>
                        <button onClick={handleSaveClick} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-[#A30000] flex items-center justify-center gap-2">
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </>
                )}
            </div>

            {/* --- MODALS --- */}
            
            {/* EDIT WARNING */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
                        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4"><span className="text-2xl">⚠️</span></div>
                        <h3 className="text-lg font-bold text-gray-900">Update Personal Info?</h3>
                        <p className="text-sm text-gray-500 mt-2 mb-4">You are about to modify your official record. These changes will reflect on all school forms.</p>
                        
                        <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer mb-6 border border-transparent hover:border-gray-200 transition">
                            <input type="checkbox" checked={editAgreement} onChange={(e) => setEditAgreement(e.target.checked)} className="mt-1 w-4 h-4 text-amber-600 rounded focus:ring-amber-600" />
                            <span className="text-xs font-bold text-gray-700 select-none">I understand and wish to proceed.</span>
                        </label>
                        
                        <div className="flex gap-2">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-600">Cancel</button>
                            <button onClick={handleConfirmEdit} disabled={!editAgreement} className={`flex-1 py-3 rounded-xl text-white font-bold shadow-sm ${editAgreement ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gray-300 cursor-not-allowed'}`}>Proceed</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SAVE CONFIRMATION */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4"><span className="text-2xl">💾</span></div>
                        <h3 className="text-lg font-bold text-gray-900">Confirm Updates</h3>
                        
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 my-4 text-xs max-h-32 overflow-y-auto">
                            <h4 className="font-bold text-gray-400 uppercase text-[10px] mb-2">Changes Detected:</h4>
                            {getChanges().length > 0 ? getChanges().map((c, i) => (
                                <div key={i} className="flex justify-between border-b pb-1 mb-1 last:border-0">
                                    <span className="font-bold text-gray-700 capitalize">{c.field}</span>
                                    <div className="flex gap-2 text-[10px]">
                                        <span className="text-red-400 line-through opacity-50">{c.oldVal || 'Empty'}</span>
                                        <span className="text-gray-400">&rarr;</span>
                                        <span className="text-green-600 font-bold">{c.newVal}</span>
                                    </div>
                                </div>
                            )) : <p className="text-gray-400 italic">No changes detected.</p>}
                        </div>

                        <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer mb-6 border border-transparent hover:border-gray-200 transition">
                            <input type="checkbox" checked={isChecked} onChange={(e) => setIsChecked(e.target.checked)} className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-600" />
                            <span className="text-xs font-bold text-gray-700 select-none">I certify that this information is correct.</span>
                        </label>

                        <div className="flex gap-2">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-600">Cancel</button>
                            <button onClick={confirmSave} disabled={!isChecked} className={`flex-1 py-3 rounded-xl text-white font-bold shadow-lg ${isChecked ? 'bg-[#CC0000] hover:bg-[#A30000]' : 'bg-gray-300 cursor-not-allowed'}`}>Save & Finish</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SchoolInformation;