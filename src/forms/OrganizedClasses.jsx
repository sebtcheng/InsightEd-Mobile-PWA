// src/forms/OrganizedClasses.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
import { addToOutbox } from '../db';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';

import { FiArrowLeft, FiSave, FiGrid, FiLayers, FiAlertCircle, FiCheckCircle, FiBarChart2 } from 'react-icons/fi';
import { TbSchool } from 'react-icons/tb';

// --- STYLES ---
const inputClass = "w-full h-12 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004A99] outline-none text-sm transition-all hover:border-blue-200 disabled:bg-slate-100 disabled:text-slate-400";
const labelClass = "text-[9px] font-bold text-slate-400 uppercase mb-1 block text-center";
const sectionClass = "bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6";

const OrganizedClasses = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');
    const isDummy = location.state?.isDummy || false;

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // UI States
    const [isLocked, setIsLocked] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [userRole, setUserRole] = useState("School Head");

    // Data
    const [schoolId, setSchoolId] = useState(null);
    const [offering, setOffering] = useState('');

    // Default values set to 0
    const [formData, setFormData] = useState({
        kinder: 0, g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g6: 0,
        g7: 0, g8: 0, g9: 0, g10: 0,
        g11: 0, g12: 0
    });

    const [classSizeData, setClassSizeData] = useState({
        cntLessG1: 0, cntWithinG1: 0, cntAboveG1: 0,
        cntLessG2: 0, cntWithinG2: 0, cntAboveG2: 0,
        cntLessG3: 0, cntWithinG3: 0, cntAboveG3: 0,
        cntLessG4: 0, cntWithinG4: 0, cntAboveG4: 0,
        cntLessG5: 0, cntWithinG5: 0, cntAboveG5: 0,
        cntLessG6: 0, cntWithinG6: 0, cntAboveG6: 0,
        cntLessG7: 0, cntWithinG7: 0, cntAboveG7: 0,
        cntLessG8: 0, cntWithinG8: 0, cntAboveG8: 0,
        cntLessG9: 0, cntWithinG9: 0, cntAboveG9: 0,
        cntLessG10: 0, cntWithinG10: 0, cntAboveG10: 0,
        cntLessG11: 0, cntWithinG11: 0, cntAboveG11: 0,
        cntLessG12: 0, cntWithinG12: 0, cntAboveG12: 0
    });
    const [originalData, setOriginalData] = useState(null);

    const goBack = () => {
        if (isDummy) {
            navigate(-1);
        } else {
            navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');
        }
    };

    // --- FETCH DATA ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');

                if (storedSchoolId) setSchoolId(storedSchoolId);
                if (storedOffering) setOffering(storedOffering);

                try {
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) setUserRole(docSnap.data().role);

                    let fetchUrl = `/api/organized-classes/${user.uid}`;
                    if (viewOnly && schoolIdParam) {
                        fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                    }

                    const res = await fetch(fetchUrl);
                    const json = await res.json();

                    if (json.exists || (viewOnly && schoolIdParam)) {
                        setSchoolId(json.school_id || json.schoolId);
                        setOffering(json.curricular_offering || json.offering || storedOffering || '');

                        localStorage.setItem('schoolId', json.schoolId);
                        localStorage.setItem('schoolOffering', json.offering || '');

                        const dbData = (viewOnly && schoolIdParam) ? json : json.data;
                        const hasData = Object.values(dbData).some(val => val !== null && val !== 0);

                        const initialData = {
                            kinder: dbData.classes_kinder || dbData.kinder || 0,
                            g1: dbData.classes_grade_1 || dbData.grade_1 || 0, g2: dbData.classes_grade_2 || dbData.grade_2 || 0, g3: dbData.classes_grade_3 || dbData.grade_3 || 0,
                            g4: dbData.classes_grade_4 || dbData.grade_4 || 0, g5: dbData.classes_grade_5 || dbData.grade_5 || 0, g6: dbData.classes_grade_6 || dbData.grade_6 || 0,
                            g7: dbData.classes_grade_7 || dbData.grade_7 || 0, g8: dbData.classes_grade_8 || dbData.grade_8 || 0, g9: dbData.classes_grade_9 || dbData.grade_9 || 0, g10: dbData.classes_grade_10 || dbData.grade_10 || 0,
                            g11: dbData.classes_grade_11 || dbData.grade_11 || 0, g12: dbData.classes_grade_12 || dbData.grade_12 || 0
                        };
                        setFormData(initialData);

                        const initialClassSize = {
                            cntLessG1: dbData.cnt_less_g1 || 0, cntWithinG1: dbData.cnt_within_g1 || 0, cntAboveG1: dbData.cnt_above_g1 || 0,
                            cntLessG2: dbData.cnt_less_g2 || 0, cntWithinG2: dbData.cnt_within_g2 || 0, cntAboveG2: dbData.cnt_above_g2 || 0,
                            cntLessG3: dbData.cnt_less_g3 || 0, cntWithinG3: dbData.cnt_within_g3 || 0, cntAboveG3: dbData.cnt_above_g3 || 0,
                            cntLessG4: dbData.cnt_less_g4 || 0, cntWithinG4: dbData.cnt_within_g4 || 0, cntAboveG4: dbData.cnt_above_g4 || 0,
                            cntLessG5: dbData.cnt_less_g5 || 0, cntWithinG5: dbData.cnt_within_g5 || 0, cntAboveG5: dbData.cnt_above_g5 || 0,
                            cntLessG6: dbData.cnt_less_g6 || 0, cntWithinG6: dbData.cnt_within_g6 || 0, cntAboveG6: dbData.cnt_above_g6 || 0,
                            cntLessG7: dbData.cnt_less_g7 || 0, cntWithinG7: dbData.cnt_within_g7 || 0, cntAboveG7: dbData.cnt_above_g7 || 0,
                            cntLessG8: dbData.cnt_less_g8 || 0, cntWithinG8: dbData.cnt_within_g8 || 0, cntAboveG8: dbData.cnt_above_g8 || 0,
                            cntLessG9: dbData.cnt_less_g9 || 0, cntWithinG9: dbData.cnt_within_g9 || 0, cntAboveG9: dbData.cnt_above_g9 || 0,
                            cntLessG10: dbData.cnt_less_g10 || 0, cntWithinG10: dbData.cnt_within_g10 || 0, cntAboveG10: dbData.cnt_above_g10 || 0,
                            cntLessG11: dbData.cnt_less_g11 || 0, cntWithinG11: dbData.cnt_within_g11 || 0, cntAboveG11: dbData.cnt_above_g11 || 0,
                            cntLessG12: dbData.cnt_less_g12 || 0, cntWithinG12: dbData.cnt_within_g12 || 0, cntAboveG12: dbData.cnt_above_g12 || 0
                        };
                        setClassSizeData(initialClassSize);
                        setOriginalData({ ...initialData, classSize: initialClassSize });

                        if (hasData) setIsLocked(true);
                    }
                } catch (error) {
                    console.error("Error fetching classes:", error);
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- HELPERS ---
    const showElem = () => offering.includes("Elementary") || offering.includes("K-12") || offering.includes("K-10");
    const showJHS = () => offering.includes("Junior") || offering.includes("K-12") || offering.includes("K-10");
    const showSHS = () => offering.includes("Senior") || offering.includes("K-12");
    const getTotalClasses = () => Object.values(formData).reduce((a, b) => a + (parseInt(b) || 0), 0);

    // --- HANDLER FIXES ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        const cleanValue = value.replace(/[^0-9]/g, '');
        const intValue = cleanValue === '' ? 0 : parseInt(cleanValue, 10);
        setFormData(prev => ({ ...prev, [name]: intValue }));
    };

    const handleClassSizeChange = (e) => {
        const { name, value } = e.target;
        const cleanValue = value.replace(/[^0-9]/g, '');
        const intValue = cleanValue === '' ? 0 : parseInt(cleanValue, 10);
        setClassSizeData(prev => ({ ...prev, [name]: intValue }));
    };

    // --- RENDER HELPER ---
    const renderClassInput = (label, name) => (
        <div>
            <label className={labelClass}>{label}</label>
            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                name={name}
                value={formData[name]}
                onChange={handleChange}
                disabled={isLocked || viewOnly}
                className={inputClass}
                onFocus={(e) => e.target.select()}
            />
        </div>
    );

    // --- ACTIONS ---
    const handleUpdateClick = () => setShowEditModal(true);

    const handleConfirmEdit = () => {
        setOriginalData({ ...formData, classSize: { ...classSizeData } });
        setIsLocked(false);
        setShowEditModal(false);
    };

    const handleCancelEdit = () => {
        if (originalData) {
            setFormData(originalData);
            if (originalData.classSize) setClassSizeData(originalData.classSize);
        }
        setIsLocked(true);
    };

    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);

        const payload = {
            schoolId: schoolId || localStorage.getItem('schoolId'),
            kinder: showElem() ? formData.kinder : 0,
            g1: showElem() ? formData.g1 : 0, g2: showElem() ? formData.g2 : 0, g3: showElem() ? formData.g3 : 0,
            g4: showElem() ? formData.g4 : 0, g5: showElem() ? formData.g5 : 0, g6: showElem() ? formData.g6 : 0,
            g7: showJHS() ? formData.g7 : 0, g8: showJHS() ? formData.g8 : 0, g9: showJHS() ? formData.g9 : 0, g10: showJHS() ? formData.g10 : 0,
            g11: showSHS() ? formData.g11 : 0, g12: showSHS() ? formData.g12 : 0,
            ...classSizeData
        };

        if (!navigator.onLine) {
            try {
                await addToOutbox({
                    type: 'ORGANIZED_CLASSES', label: 'Organized Classes', url: '/api/save-organized-classes', payload
                });
                setShowOfflineModal(true);
                setOriginalData({ ...formData });
                setIsLocked(true);
            } catch (e) { alert("Failed to save offline."); }
            finally { setIsSaving(false); }
            return;
        }

        try {
            const res = await fetch('/api/save-organized-classes', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (res.ok) {
                setShowSuccessModal(true);
                setOriginalData({ ...formData, classSize: { ...classSizeData } });
                setIsLocked(true);
            } else { throw new Error("Server Error"); }
        } catch (err) {
            // Fallback logic
        } finally { setIsSaving(false); }
    };

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
                            <h1 className="text-2xl font-bold text-white tracking-tight">Organized Classes</h1>
                            {offering && (
                                <span className="px-2 py-0.5 rounded-lg bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/10">
                                    {offering}
                                </span>
                            )}
                        </div>
                        <p className="text-blue-100 text-xs font-medium mt-1">{viewOnly ? "Monitor View (Read-Only)" : "Official Section Counts"}</p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-10 relative z-20 space-y-5">

                {/* TOTAL BANNER */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-blue-50 to-transparent"></div>
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Organized Classes</p>
                        <h2 className="text-3xl font-black text-[#004A99]">{getTotalClasses()}</h2>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#004A99] flex items-center justify-center text-2xl z-10">
                        <FiLayers />
                    </div>
                </div>

                <form onSubmit={(e) => e.preventDefault()}>
                    {showElem() && (
                        <div className={sectionClass}>
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl">
                                    <TbSchool />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800">Elementary</h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kinder to Grade 6</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {renderClassInput("Kinder", "kinder")}
                                {renderClassInput("Grade 1", "g1")}
                                {renderClassInput("Grade 2", "g2")}
                                {renderClassInput("Grade 3", "g3")}
                                {renderClassInput("Grade 4", "g4")}
                                {renderClassInput("Grade 5", "g5")}
                                {renderClassInput("Grade 6", "g6")}
                            </div>
                        </div>
                    )}

                    {showJHS() && (
                        <div className={sectionClass}>
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                                    <FiGrid />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800">Junior High School</h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Grade 7 to Grade 10</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {renderClassInput("Grade 7", "g7")}
                                {renderClassInput("Grade 8", "g8")}
                                {renderClassInput("Grade 9", "g9")}
                                {renderClassInput("Grade 10", "g10")}
                            </div>
                        </div>
                    )}

                    {showSHS() && (
                        <div className={sectionClass}>
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
                                    <FiLayers />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800">Senior High School</h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Grade 11 & 12</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {renderClassInput("Grade 11", "g11")}
                                {renderClassInput("Grade 12", "g12")}
                            </div>
                        </div>
                    )}

                    {!showElem() && !showJHS() && !showSHS() && (
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
                            <p className="text-slate-400 font-bold">No offering details found.</p>
                            <p className="text-xs text-slate-400 mt-2">Please ensure your <b>School Profile</b> is complete.</p>
                        </div>
                    )}

                    {/* --- RESTORED CLASS SIZE STANDARD TABLE --- */}
                    <div className={sectionClass}>
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl">
                                <FiBarChart2 />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-800">Class Size Standards</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Analysis per Category</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-center border-b border-slate-50">
                                    <tr>
                                        <th className="pb-3 text-left pl-2">Grade Level</th>
                                        <th className="pb-3 text-emerald-600">{"< 50"} <br /> (Less than)</th>
                                        <th className="pb-3 text-blue-600">{"50 - 60"} <br /> (Within)</th>
                                        <th className="pb-3 text-red-600">{"> 60"} <br /> (Above)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {[
                                        ...(showElem() ? [1, 2, 3, 4, 5, 6] : []),
                                        ...(showJHS() ? [7, 8, 9, 10] : []),
                                        ...(showSHS() ? [11, 12] : [])
                                    ].map(g => (
                                        <tr key={g} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="py-2 pl-2 font-bold text-slate-600 text-xs text-left">Grade {g}</td>
                                            <td className="p-1">
                                                <input
                                                    type="text" inputMode="numeric" pattern="[0-9]*"
                                                    name={`cntLessG${g}`}
                                                    value={classSizeData[`cntLessG${g}`]}
                                                    onChange={handleClassSizeChange}
                                                    disabled={isLocked || viewOnly}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-emerald-700 bg-emerald-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs transition-all hover:border-emerald-200"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="text" inputMode="numeric" pattern="[0-9]*"
                                                    name={`cntWithinG${g}`}
                                                    value={classSizeData[`cntWithinG${g}`]}
                                                    onChange={handleClassSizeChange}
                                                    disabled={isLocked || viewOnly}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-blue-700 bg-blue-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs transition-all hover:border-blue-200"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="text" inputMode="numeric" pattern="[0-9]*"
                                                    name={`cntAboveG${g}`}
                                                    value={classSizeData[`cntAboveG${g}`]}
                                                    onChange={handleClassSizeChange}
                                                    disabled={isLocked || viewOnly}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-red-700 bg-red-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-xs transition-all hover:border-red-200"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </form>
            </div>

            {/* --- FLOATING ACTION BAR --- */}
            <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-50">
                <div className="max-w-4xl mx-auto flex gap-3">
                    {viewOnly ? (
                        <button onClick={() => navigate('/jurisdiction-schools')} className="w-full py-4 rounded-2xl bg-[#004A99] text-white font-bold shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
                            <FiArrowLeft /> Back to Schools List
                        </button>
                    ) : isLocked ? (
                        <button onClick={handleUpdateClick} className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
                            <span>✏️</span> UNLOCK EDIT
                        </button>
                    ) : (
                        <>
                            {originalData && <button onClick={handleCancelEdit} className="w-1/3 py-4 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-colors">Cancel</button>}
                            <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="w-2/3 py-4 rounded-2xl bg-[#004A99] text-white font-bold shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                                {isSaving ? "Saving..." : <><FiSave /> Save Changes</>}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* MODALS */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4 text-amber-500 text-2xl">
                            <FiAlertCircle />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Edit Class Data?</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6">You are to update organized class data. Proceed carefully.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancel</button>
                            <button onClick={handleConfirmEdit} className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold shadow-sm hover:bg-amber-600">Unlock</button>
                        </div>
                    </div>
                </div>
            )}

            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-blue-600 text-2xl">
                            <FiCheckCircle />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Confirm Save</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6">Are you sure you want to save the organized class data?</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancel</button>
                            <button onClick={confirmSave} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="Organized Classes saved successfully!" />
        </div>
    );
};

export default OrganizedClasses;