
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { addToOutbox } from '../db';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
import { FiBox } from 'react-icons/fi';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';

const PhysicalFacilities = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [schoolId, setSchoolId] = useState(null);
    const [formData, setFormData] = useState({});
    const [originalData, setOriginalData] = useState(null);

    const initialFields = {
        build_classrooms_total: 0,
        build_classrooms_new: 0,
        build_classrooms_good: 0,
        build_classrooms_repair: 0,
        build_classrooms_demolition: 0
    };

    const goBack = () => navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const cachedId = localStorage.getItem('schoolId');
                if (cachedId) setSchoolId(cachedId);

                // Check Local Cache first
                const localData = localStorage.getItem('physicalFacilitiesData');
                if (localData) {
                    setFormData(JSON.parse(localData));
                    setIsLocked(true);
                }

                // Fetch Data
                try {
                    let fetchUrl = `/api/physical-facilities/${user.uid}`;
                    if (viewOnly && schoolIdParam) fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;

                    const res = await fetch(fetchUrl);
                    const json = await res.json();

                    if (json.exists || (viewOnly && schoolIdParam)) {
                        const dbData = (viewOnly && schoolIdParam) ? json : json.data;
                        if (!schoolIdParam) setSchoolId(dbData.school_id || dbData.schoolId);

                        const loaded = {};
                        Object.keys(initialFields).forEach(key => {
                            loaded[key] = dbData[key] ?? 0;
                        });
                        setFormData(loaded);
                        setOriginalData(loaded);
                        if (dbData.build_classrooms_total > 0 || viewOnly) setIsLocked(true);
                    } else {
                        setFormData(initialFields);
                    }
                } catch (err) {
                    console.log("Offline/Error fetching facilities:", err);
                }
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const val = parseInt(value) || 0;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);
        const payload = {
            schoolId: schoolId || localStorage.getItem('schoolId'),
            uid: auth.currentUser.uid,
            ...formData
        };

        try {
            if (!navigator.onLine) throw new Error("Offline");
            const res = await fetch('/api/save-physical-facilities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setShowSuccessModal(true);
                setOriginalData({ ...formData });
                setIsLocked(true);
                localStorage.setItem('physicalFacilitiesData', JSON.stringify(formData));
            } else {
                throw new Error("Save failed");
            }
        } catch (e) {
            await addToOutbox({
                type: 'PHYSICAL_FACILITIES',
                label: 'Physical Facilities',
                url: '/api/save-physical-facilities',
                payload
            });
            setShowOfflineModal(true);
            setIsLocked(true);
        } finally {
            setIsSaving(false);
        }
    };

    const InputCard = ({ label, name, icon, color }) => (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${color} bg-opacity-10 dark:bg-opacity-20 text-xl`}>
                    {icon}
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Classrooms</p>
                </div>
            </div>
            <input
                type="number" min="0" name={name} value={formData[name] || 0} onChange={handleChange} disabled={isLocked || viewOnly}
                className="w-20 text-center font-black text-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
        </div>
    );

    if (loading) return <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-900"><div className="w-10 h-10 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div></div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-40">
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white text-2xl">←</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Physical Facilities</h1>
                        <p className="text-blue-100 text-[10px] uppercase font-bold tracking-widest opacity-80">Classroom Inventory</p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-lg mx-auto space-y-4">

                {/* Total Classrooms (Highlight) */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 text-center mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Classrooms</p>
                    <input
                        type="number" min="0" name="build_classrooms_total"
                        value={formData.build_classrooms_total || 0} onChange={handleChange} disabled={isLocked || viewOnly}
                        className="w-full text-center text-5xl font-black text-[#004A99] dark:text-blue-400 bg-transparent outline-none placeholder-slate-200"
                        placeholder="0"
                    />
                    <p className="text-[10px] text-slate-400 mt-2">Enter the overall count of classrooms in the school.</p>
                </div>

                <InputCard label="Newly Built" name="build_classrooms_new" icon="✨" color="bg-emerald-500 text-emerald-600" />
                <InputCard label="Good Condition" name="build_classrooms_good" icon="✅" color="bg-blue-500 text-blue-600" />
                <InputCard label="Needs Repair" name="build_classrooms_repair" icon="🛠️" color="bg-orange-500 text-orange-600" />
                <InputCard label="Needs Demolition" name="build_classrooms_demolition" icon="⚠️" color="bg-red-500 text-red-600" />

            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 pb-10 z-50 flex gap-3 shadow-2xl">
                {viewOnly ? (
                    <button onClick={goBack} className="w-full bg-[#004A99] text-white font-bold py-4 rounded-xl shadow-lg">Back to Overview</button>
                ) : isLocked ? (
                    <button onClick={() => setShowEditModal(true)} className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg">✏️ Unlock to Edit</button>
                ) : (
                    <>
                        <button onClick={() => setIsLocked(true)} className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-500 font-bold py-4 rounded-xl">Cancel</button>
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg">
                            {isSaving ? "Saving..." : "Save Report"}
                        </button>
                    </>
                )}
            </div>

            {/* Modals */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm text-center">
                        <h3 className="font-bold text-lg dark:text-slate-200">Unlock for Editing?</h3>
                        <div className="mt-6 flex gap-2">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border rounded-xl dark:text-slate-300">Cancel</button>
                            <button onClick={() => { setIsLocked(false); setShowEditModal(false); }} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold">Unlock</button>
                        </div>
                    </div>
                </div>
            )}

            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm text-center">
                        <h3 className="font-bold text-lg dark:text-slate-200">Confirm Submission?</h3>
                        <div className="mt-6 flex gap-2">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border rounded-xl dark:text-slate-300">Cancel</button>
                            <button onClick={confirmSave} className="flex-1 py-3 bg-[#CC0000] text-white rounded-xl font-bold">Submit</button>
                        </div>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="Physical Facilities report saved successfully!" />
        </div>
    );
};

export default PhysicalFacilities;
