// src/forms/SchoolResources.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
// LoadingScreen import removed
import { addToOutbox } from '../db';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';


const SchoolResources = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [userRole, setUserRole] = useState("School Head");
    const [crType, setCrType] = useState('Segmented'); // 'Segmented' or 'Shared'

    const [schoolId, setSchoolId] = useState(null);
    const [formData, setFormData] = useState({});
    const [originalData, setOriginalData] = useState(null);

    const goBack = () => navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');

    // --- NEON SCHEMA MAPPING ---
    const initialFields = {
        res_internet_type: '',
        res_toilets_male: 0,
        res_toilets_female: 0,
        res_toilets_common: 0, // [NEW] Common CR
        res_toilets_pwd: 0,
        res_water_source: '',
        res_tvl_workshops: 0,
        res_ownership_type: '',
        res_electricity_source: '',
        res_buildable_space: '',
        sha_category: '', // [NEW] SHA Category

        // LABS
        res_sci_labs: 0, res_com_labs: 0,

        // FUNCTIONAL / NON-FUNCTIONAL
        res_ecart_func: 0, res_ecart_nonfunc: 0,
        res_laptop_func: 0, res_laptop_nonfunc: 0,
        res_tv_func: 0, res_tv_nonfunc: 0,
        res_printer_func: 0, res_printer_nonfunc: 0,
        res_desk_func: 0, res_desk_nonfunc: 0,
        res_armchair_func: 0, res_armchair_nonfunc: 0,
        res_toilet_func: 0, res_toilet_nonfunc: 0,
        res_handwash_func: 0, res_handwash_nonfunc: 0,

        // SEATS
        seats_kinder: 0, seats_grade_1: 0, seats_grade_2: 0, seats_grade_3: 0,
        seats_grade_4: 0, seats_grade_5: 0, seats_grade_6: 0,
        seats_grade_7: 0, seats_grade_8: 0, seats_grade_9: 0, seats_grade_10: 0,
        seats_grade_11: 0, seats_grade_12: 0
    };

    // --- FETCH DATA ---
    const [enrollmentData, setEnrollmentData] = useState({});
    const [curricularOffering, setCurricularOffering] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Check local cache first
                const cachedId = localStorage.getItem('schoolId');
                if (cachedId) setSchoolId(cachedId);

                // Fetch user role for BottomNav
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) setUserRole(userDoc.data().role);

                // 1. Fetch BASIC PROFILE / ENROLLMENT (needed for computation & ID)
                try {
                    let profileFetchUrl = `/api/school-by-user/${user.uid}`;
                    if (viewOnly && schoolIdParam) {
                        profileFetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                    }
                    const profileRes = await fetch(profileFetchUrl);
                    const profileJson = await profileRes.json();

                    if (profileJson.exists || (viewOnly && schoolIdParam)) {
                        const pData = (viewOnly && schoolIdParam) ? profileJson : profileJson.data;
                        setSchoolId(pData.school_id || pData.schoolId);
                        setCurricularOffering(pData.curricular_offering || pData.curricularOffering || '');
                        setEnrollmentData({
                            gradeKinder: pData.grade_kinder || pData.kinder || 0,
                            grade1: pData.grade_1 || 0, grade2: pData.grade_2 || 0,
                            grade3: pData.grade_3 || 0, grade4: pData.grade_4 || 0,
                            grade5: pData.grade_5 || 0, grade6: pData.grade_6 || 0,
                            grade7: pData.grade_7 || 0, grade8: pData.grade_8 || 0,
                            grade9: pData.grade_9 || 0, grade10: pData.grade_10 || 0,
                            grade11: (pData.abm_11 + pData.stem_11 + pData.humss_11 + pData.gas_11 + pData.tvl_ict_11 + pData.tvl_he_11 + pData.tvl_ia_11 + pData.tvl_afa_11 + pData.arts_11 + pData.sports_11) || 0,
                            grade12: (pData.abm_12 + pData.stem_12 + pData.humss_12 + pData.gas_12 + pData.tvl_ict_12 + pData.tvl_he_12 + pData.tvl_ia_12 + pData.tvl_afa_12 + pData.arts_12 + pData.sports_12) || 0
                        });
                    }
                } catch (e) {
                    console.log("Offline: Loading basic profile from cache");
                    const cachedProfile = localStorage.getItem('fullSchoolProfile');
                    if (cachedProfile) {
                        const pData = JSON.parse(cachedProfile);
                        setCurricularOffering(pData.curricularOffering || '');
                        // Simplify offline enrollment load (might be limited if not full profile)
                    }
                }

                // 2. Fetch RESOURCES
                try {
                    let resourcesFetchUrl = `/api/school-resources/${user.uid}`;
                    if (viewOnly && schoolIdParam) {
                        resourcesFetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                    }
                    const res = await fetch(resourcesFetchUrl);
                    const json = await res.json();

                    if (json.exists || (viewOnly && schoolIdParam)) {
                        const dbData = (viewOnly && schoolIdParam) ? json : json.data;
                        setSchoolId(dbData.school_id || dbData.schoolId || cachedId);

                        // Map database columns to state
                        const loaded = {};
                        Object.keys(initialFields).forEach(key => {
                            loaded[key] = dbData[key] ?? (typeof initialFields[key] === 'string' ? '' : 0);
                        });

                        setFormData(loaded);
                        setOriginalData(loaded);

                        // Lock if data is already present or viewOnly
                        if (dbData.res_armchairs_good > 0 || dbData.res_toilets_male > 0 || viewOnly) {
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
                setShowSuccessModal(true);
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
        setShowOfflineModal(true);
        setOriginalData({ ...formData });
        setIsLocked(true);
        setIsSaving(false);
    };

    // --- COMPONENTS ---
    const InputField = ({ label, name, type = "number" }) => (
        <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest w-2/3">{label}</label>
            <input
                type={type} name={name} value={formData[name] ?? (type === 'number' ? 0 : '')}
                onChange={handleChange} disabled={isLocked || viewOnly}
                className="w-24 text-center font-bold text-blue-900 dark:text-blue-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg py-2 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-transparent disabled:border-transparent dark:disabled:bg-transparent"
            />
        </div>
    );

    const SelectField = ({ label, name, options }) => (
        <div className="flex flex-col gap-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
            <select
                name={name} value={formData[name] || ''} onChange={handleChange} disabled={isLocked || viewOnly}
                className="w-full font-bold text-blue-900 bg-white border border-gray-200 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-transparent disabled:border-transparent"
            >
                <option value="">-- Select --</option>
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );

    const SeatRow = ({ label, enrollment, seatKey }) => {
        const seats = formData[seatKey] || 0;
        const shortage = enrollment - seats;
        const isShortage = shortage > 0;

        return (
            <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="py-3 px-4 text-xs font-bold text-gray-600">{label}</td>
                <td className="py-3 px-4 text-center">
                    <span className="bg-blue-50 text-blue-700 text-[10px] px-2 py-1 rounded-md font-bold border border-blue-100">
                        {enrollment}
                    </span>
                </td>
                <td className="py-3 px-4">
                    <input
                        type="number"
                        name={seatKey}
                        value={seats}
                        onChange={handleChange}
                        disabled={isLocked || viewOnly}
                        className="w-full text-center font-bold text-gray-800 bg-white border border-gray-200 rounded-lg py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-transparent disabled:border-transparent"
                    />
                </td>
                <td className="py-3 px-4 text-center">
                    {isShortage ? (
                        <span className="text-red-600 bg-red-50 px-2 py-1 rounded-md text-[10px] font-extrabold border border-red-100">
                            -{shortage}
                        </span>
                    ) : (
                        <span className="text-green-600 bg-green-50 px-2 py-1 rounded-md text-[10px] font-bold border border-green-100">
                            OK
                        </span>
                    )}
                </td>
            </tr>
        );
    };

    const ResourceAuditRow = ({ label, funcName, nonFuncName }) => (
        <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
            <td className="py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</td>
            <td className="py-2 px-2">
                <input
                    type="number"
                    name={funcName}
                    value={formData[funcName] || 0}
                    onChange={handleChange}
                    disabled={isLocked || viewOnly}
                    className="w-full text-center font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-lg py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-transparent disabled:border-transparent"
                    placeholder="0"
                />
            </td>
            <td className="py-2 px-2">
                <input
                    type="number"
                    name={nonFuncName}
                    value={formData[nonFuncName] || 0}
                    onChange={handleChange}
                    disabled={isLocked || viewOnly}
                    className="w-full text-center font-bold text-rose-500 bg-rose-50/50 border border-rose-100 rounded-lg py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none disabled:bg-transparent disabled:border-transparent"
                    placeholder="0"
                />
            </td>
        </tr>
    );

    const LabRow = ({ label, name }) => (
        <div className="flex justify-between items-center p-3 border-b border-gray-50 last:border-0 bg-slate-50/50 rounded-lg">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</label>
            <input
                type="number"
                name={name}
                value={formData[name] || 0}
                onChange={handleChange}
                disabled={isLocked || viewOnly}
                className="w-20 text-center font-bold text-blue-900 bg-white border border-gray-200 rounded-lg py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-transparent"
            />
        </div>
    );

    // VISIBILITY Helpers
    const showElem = () => !curricularOffering || curricularOffering.includes("Elementary") || curricularOffering.includes("K-12") || curricularOffering.includes("K-10");
    const showJHS = () => !curricularOffering || curricularOffering.includes("Junior") || curricularOffering.includes("K-12") || curricularOffering.includes("K-10");
    const showSHS = () => !curricularOffering || curricularOffering.includes("Senior") || curricularOffering.includes("K-12");

    // LoadingScreen check removed

    return (
        <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-900 font-sans pb-40">
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white text-2xl">←</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">School Resources</h1>
                        <p className="text-blue-100 text-[10px] uppercase font-bold tracking-widest opacity-80">{viewOnly ? "Monitor View (Read-Only)" : "Neon Inventory System"}</p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-12 relative z-20 max-w-4xl mx-auto space-y-6">




                {/* EQUIPMENT & INVENTORY */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-gray-800 font-bold mb-4 flex items-center gap-2">📦 Equipment & Inventory</h2>

                    {/* Functional / Non-Functional Table */}
                    <div className="overflow-hidden rounded-xl border border-gray-100 mb-6">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-1/2">Item</th>
                                    <th className="py-3 px-2 text-center text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Functional</th>
                                    <th className="py-3 px-2 text-center text-[10px] font-bold text-rose-500 uppercase tracking-wider">Non-Functional</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                <ResourceAuditRow label="E-Cart" funcName="res_ecart_func" nonFuncName="res_ecart_nonfunc" />
                                <ResourceAuditRow label="Laptop" funcName="res_laptop_func" nonFuncName="res_laptop_nonfunc" />
                                <ResourceAuditRow label="TV / Smart TV" funcName="res_tv_func" nonFuncName="res_tv_nonfunc" />
                                <ResourceAuditRow label="Printers" funcName="res_printer_func" nonFuncName="res_printer_nonfunc" />
                                <ResourceAuditRow label="Desks" funcName="res_desk_func" nonFuncName="res_desk_nonfunc" />
                                <ResourceAuditRow label="Arm Chairs" funcName="res_armchair_func" nonFuncName="res_armchair_nonfunc" />
                                <ResourceAuditRow label="Toilets" funcName="res_toilet_func" nonFuncName="res_toilet_nonfunc" />
                                <ResourceAuditRow label="Hand Washing Stn" funcName="res_handwash_func" nonFuncName="res_handwash_nonfunc" />
                            </tbody>
                        </table>
                    </div>

                    {/* Labs Section */}
                    <div className="space-y-2">
                        <LabRow label="Science Laboratory" name="res_sci_labs" />
                        <LabRow label="Computer Laboratory" name="res_com_labs" />
                        <LabRow label="TVL/TLE Workshop Lab" name="res_tvl_workshops" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-gray-800 font-bold mb-4 flex items-center gap-2">🏞️ Site & Utilities</h2>
                    <div className="grid gap-3">
                        <SelectField
                            label="Ownership Type"
                            name="res_ownership_type"
                            options={["DOS", "DOD", "For Verification", "PP", "SP", "Tax Dec", "TCT/OCT", "Usucfruct agreement", "With Adverse Claims"]}
                        />
                        <SelectField
                            label="Electricity Source"
                            name="res_electricity_source"
                            options={["For Verification", "GRID AND OFF-GRID SUPPLY", "GRID SUPPLY", "OFF-GRID SUPPLY", "NO ELECTRICITY"]}
                        />
                        <SelectField
                            label="Water Source"
                            name="res_water_source"
                            options={["For Verification", "Natural Resources", "Piped line from Local Service Provider", "No Water Source"]}
                        />
                        <SelectField
                            name="res_buildable_space"
                            options={["Yes", "No"]}
                        />
                        <SelectField
                            label="SHA (Special Hardship Allowance) Category"
                            name="sha_category"
                            options={[
                                "NOT INCLUDED",
                                "HARDSHIP POST",
                                "PURE MULTIGRADE SCHOOL",
                                "HARDSHIP POST AND PURE MULTIGRADE SCHOOL"
                            ]}
                        />
                    </div>
                </div>

                {/* SEAT ANALYSIS */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-gray-800 font-bold mb-4 flex items-center gap-2">🪑 Furniture & Seat Analysis</h2>

                    {/* Seat Shortage Table */}
                    <div className="overflow-hidden rounded-xl border border-gray-100">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Grade</th>
                                    <th className="py-3 px-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Enrollment</th>
                                    <th className="py-3 px-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Seats</th>
                                    <th className="py-3 px-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Shortage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {showElem() && (
                                    <>
                                        <SeatRow label="Kinder" enrollment={enrollmentData.gradeKinder || 0} seatKey="seats_kinder" />
                                        <SeatRow label="Grade 1" enrollment={enrollmentData.grade1 || 0} seatKey="seats_grade_1" />
                                        <SeatRow label="Grade 2" enrollment={enrollmentData.grade2 || 0} seatKey="seats_grade_2" />
                                        <SeatRow label="Grade 3" enrollment={enrollmentData.grade3 || 0} seatKey="seats_grade_3" />
                                        <SeatRow label="Grade 4" enrollment={enrollmentData.grade4 || 0} seatKey="seats_grade_4" />
                                        <SeatRow label="Grade 5" enrollment={enrollmentData.grade5 || 0} seatKey="seats_grade_5" />
                                        <SeatRow label="Grade 6" enrollment={enrollmentData.grade6 || 0} seatKey="seats_grade_6" />
                                    </>
                                )}
                                {showJHS() && (
                                    <>
                                        <SeatRow label="Grade 7" enrollment={enrollmentData.grade7 || 0} seatKey="seats_grade_7" />
                                        <SeatRow label="Grade 8" enrollment={enrollmentData.grade8 || 0} seatKey="seats_grade_8" />
                                        <SeatRow label="Grade 9" enrollment={enrollmentData.grade9 || 0} seatKey="seats_grade_9" />
                                        <SeatRow label="Grade 10" enrollment={enrollmentData.grade10 || 0} seatKey="seats_grade_10" />
                                    </>
                                )}
                                {showSHS() && (
                                    <>
                                        <SeatRow label="Grade 11" enrollment={enrollmentData.grade11 || 0} seatKey="seats_grade_11" />
                                        <SeatRow label="Grade 12" enrollment={enrollmentData.grade12 || 0} seatKey="seats_grade_12" />
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-gray-800 font-bold flex items-center gap-2">🚰 Comfort Rooms</h2>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => !viewOnly && !isLocked && setCrType('Segmented')}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition ${crType === 'Segmented' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}
                            >
                                Male/Female
                            </button>
                            <button
                                onClick={() => !viewOnly && !isLocked && setCrType('Shared')}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition ${crType === 'Shared' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}
                            >
                                Common/Shared
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        {crType === 'Segmented' ? (
                            <>
                                <InputField label="Male Toilets" name="res_toilets_male" />
                                <InputField label="Female Toilets" name="res_toilets_female" />
                            </>
                        ) : (
                            <InputField label="Common/Shared Toilets" name="res_toilets_common" />
                        )}
                        <InputField label="PWD Toilets" name="res_toilets_pwd" />
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 pb-10 z-50 flex gap-3 shadow-2xl">
                {viewOnly ? (
                    <button
                        onClick={() => navigate('/jurisdiction-schools')}
                        className="w-full bg-[#004A99] text-white font-bold py-4 rounded-xl shadow-lg ring-4 ring-blue-500/20"
                    >
                        Back to Schools List
                    </button>
                ) : isLocked ? (
                    <button onClick={() => setShowEditModal(true)} className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg transition">✏️ Unlock to Edit</button>
                ) : (
                    <>
                        {originalData && <button onClick={() => { setFormData(originalData); setIsLocked(true); }} className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 font-bold py-4 rounded-xl">Cancel</button>}
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg">
                            {isSaving ? "Updating..." : "Save to Neon"}
                        </button>
                    </>
                )}
            </div>

            {/* Modals for Edit/Save */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm">
                        <h3 className="font-bold text-lg text-center dark:text-slate-200">Unlock for Editing?</h3>
                        <div className="mt-6 flex gap-2">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border dark:border-slate-700 rounded-xl dark:text-slate-300">Cancel</button>
                            <button onClick={() => { setIsLocked(false); setShowEditModal(false); }} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold">Unlock</button>
                        </div>
                    </div>
                </div>
            )}

            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm">
                        <h3 className="font-bold text-lg text-center dark:text-slate-200">Confirm Update?</h3>
                        <div className="mt-6 flex gap-2">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border dark:border-slate-700 rounded-xl dark:text-slate-300">Cancel</button>
                            <button onClick={confirmSave} className="flex-1 py-3 bg-[#CC0000] text-white rounded-xl font-bold">Submit</button>
                        </div>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="School Resources updated successfully!" />


        </div>
    );
};

export default SchoolResources;