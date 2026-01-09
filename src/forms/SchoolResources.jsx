// src/forms/SchoolResources.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
// LoadingScreen import removed
import { addToOutbox } from '../db';
import SchoolHeadBottomNav from '../modules/SchoolHeadBottomNav';

const SchoolResources = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);

    const [schoolId, setSchoolId] = useState(null);
    const [formData, setFormData] = useState({});
    const [originalData, setOriginalData] = useState(null);

    const goBack = () => navigate('/school-forms');

    // --- NEON SCHEMA MAPPING ---
    const initialFields = {
        res_armchairs_good: 0,
        res_armchairs_repair: 0,
        res_teacher_tables_good: 0,
        res_teacher_tables_repair: 0,
        res_blackboards_good: 0,
        res_blackboards_defective: 0,
        res_desktops_instructional: 0,
        res_desktops_admin: 0,
        res_laptops_teachers: 0,
        res_tablets_learners: 0,
        res_printers_working: 0,
        res_projectors_working: 0,
        res_internet_type: '',
        res_toilets_male: 0,
        res_toilets_female: 0,
        res_toilets_pwd: 0,
        res_faucets: 0,
        res_water_source: '',
        res_sci_labs: 0,
        res_com_labs: 0,
        res_tvl_workshops: 0
    };

    // --- FETCH DATA ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Check local cache first
                const cachedId = localStorage.getItem('schoolId');
                if (cachedId) setSchoolId(cachedId);

                try {
                    const res = await fetch(`/api/school-resources/${user.uid}`);
                    const json = await res.json();

                    if (json.exists) {
                        const db = json.data;
                        setSchoolId(db.school_id || cachedId);

                        // Map database columns to state
                        const loaded = {};
                        Object.keys(initialFields).forEach(key => {
                            loaded[key] = db[key] ?? (typeof initialFields[key] === 'string' ? '' : 0);
                        });

                        setFormData(loaded);
                        setOriginalData(loaded);

                        // Lock if data is already present
                        if (db.res_armchairs_good > 0 || db.res_toilets_male > 0) {
                            setIsLocked(true);
                        }
                    } else {
                        setFormData(initialFields);
                    }
                } catch (e) {
                    console.error("Fetch failed:", e);
                    setFormData(initialFields);
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (parseInt(value) || 0) : value
        }));
    };

    // --- SAVE LOGIC ---
    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);

        const payload = {
            schoolId: schoolId || localStorage.getItem('schoolId'),
            uid: auth.currentUser.uid,
            ...formData
        };

        if (!navigator.onLine) {
            await handleOffline(payload);
            return;
        }

        try {
            const res = await fetch('/api/save-school-resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert('Success: Database updated!');
                setOriginalData({ ...formData });
                setIsLocked(true);
            } else {
                throw new Error("Update failed");
            }
        } catch (e) {
            await handleOffline(payload);
        } finally {
            setIsSaving(false);
        }
    };

    const handleOffline = async (payload) => {
        await addToOutbox({
            type: 'SCHOOL_RESOURCES',
            label: 'School Resources',
            url: '/api/save-school-resources',
            payload: payload
        });
        alert("Saved to Outbox (Offline Mode)");
        setOriginalData({ ...formData });
        setIsLocked(true);
        setIsSaving(false);
    };

    // --- COMPONENTS ---
    const InputField = ({ label, name, type = "number" }) => (
        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-2/3">{label}</label>
            <input
                type={type} name={name} value={formData[name] ?? (type === 'number' ? 0 : '')}
                onChange={handleChange} disabled={isLocked}
                className="w-24 text-center font-bold text-blue-900 bg-white border border-gray-200 rounded-lg py-2 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-transparent disabled:border-transparent"
            />
        </div>
    );

    // LoadingScreen check removed

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-40">
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white text-2xl">←</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">School Resources</h1>
                        <p className="text-blue-100 text-[10px] uppercase font-bold tracking-widest opacity-80">Neon Inventory System</p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-4xl mx-auto space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-gray-800 font-bold mb-4 flex items-center gap-2">🪑 Furniture</h2>
                    <div className="grid gap-3">
                        <InputField label="Armchairs (Good)" name="res_armchairs_good" />
                        <InputField label="Armchairs (Repair)" name="res_armchairs_repair" />
                        <InputField label="Blackboards (Good)" name="res_blackboards_good" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-gray-800 font-bold mb-4 flex items-center gap-2">💻 ICT Equipment</h2>
                    <div className="grid gap-3">
                        <InputField label="Desktop PCs" name="res_desktops_instructional" />
                        <InputField label="Laptops" name="res_laptops_teachers" />
                        <InputField label="Printers" name="res_printers_working" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-gray-800 font-bold mb-4 flex items-center gap-2">🚰 Facilities</h2>
                    <div className="grid gap-3">
                        <InputField label="Male Toilets" name="res_toilets_male" />
                        <InputField label="Female Toilets" name="res_toilets_female" />
                        <InputField label="Water Source" name="res_water_source" type="text" />
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 pb-10 z-50 flex gap-3 shadow-2xl">
                {isLocked ? (
                    <button onClick={() => setShowEditModal(true)} className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg transition">✏️ Unlock to Edit</button>
                ) : (
                    <>
                        {originalData && <button onClick={() => { setFormData(originalData); setIsLocked(true); }} className="flex-1 bg-gray-100 text-gray-500 font-bold py-4 rounded-xl">Cancel</button>}
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg">
                            {isSaving ? "Updating..." : "Save to Neon"}
                        </button>
                    </>
                )}
            </div>

            {/* Modals for Edit/Save */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
                        <h3 className="font-bold text-lg text-center">Unlock for Editing?</h3>
                        <div className="mt-6 flex gap-2">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                            <button onClick={() => { setIsLocked(false); setShowEditModal(false); }} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold">Unlock</button>
                        </div>
                    </div>
                </div>
            )}

            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
                        <h3 className="font-bold text-lg text-center">Confirm Update?</h3>
                        <div className="mt-6 flex gap-2">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                            <button onClick={confirmSave} className="flex-1 py-3 bg-[#CC0000] text-white rounded-xl font-bold">Submit</button>
                        </div>
                    </div>
                </div>
            )}

            <SchoolHeadBottomNav />
        </div>
    );
};

export default SchoolResources;