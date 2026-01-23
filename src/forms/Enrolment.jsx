
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { addToOutbox } from '../db';
import { FiArrowLeft, FiSave, FiGrid, FiLayers, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { TbSchool } from 'react-icons/tb';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal'; // NEW // NEW

const Enrolment = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const queryParams = new URLSearchParams(window.location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const monitorSchoolId = queryParams.get('schoolId');

    // UI States
    const [isLocked, setIsLocked] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    // School Identity & Settings
    const [schoolId, setSchoolId] = useState('');
    const [curricularOffering, setCurricularOffering] = useState('');

    // Modals
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false); // NEW // NEW
    const [editAgreement, setEditAgreement] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine); // NEW: Offline State

    // BASIC GRADES (Kinder - G10)
    const [basicGrades, setBasicGrades] = useState({
        gradeKinder: 0, grade1: 0, grade2: 0, grade3: 0,
        grade4: 0, grade5: 0, grade6: 0,
        grade7: 0, grade8: 0, grade9: 0, grade10: 0
    });

    // SHS STRANDS (G11 - G12)
    const [shsStrands, setShsStrands] = useState({
        abm11: 0, abm12: 0, stem11: 0, stem12: 0,
        humss11: 0, humss12: 0, gas11: 0, gas12: 0,
        ict11: 0, ict12: 0, he11: 0, he12: 0,
        ia11: 0, ia12: 0, afa11: 0, afa12: 0,
        arts11: 0, arts12: 0, sports11: 0, sports12: 0
    });



    // ARAL ENROLLEES (Grades 1-6)
    const [aralData, setAralData] = useState({
        aral_math_g1: 0, aral_read_g1: 0, aral_sci_g1: 0,
        aral_math_g2: 0, aral_read_g2: 0, aral_sci_g2: 0,
        aral_math_g3: 0, aral_read_g3: 0, aral_sci_g3: 0,
        aral_math_g4: 0, aral_read_g4: 0, aral_sci_g4: 0,
        aral_math_g5: 0, aral_read_g5: 0, aral_sci_g5: 0,
        aral_math_g6: 0, aral_read_g6: 0, aral_sci_g6: 0
    });

    const [originalData, setOriginalData] = useState(null);
    const goBack = () => navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');

    // --- CALCULATIONS ---
    const getG11Total = () => {
        const { abm11, stem11, humss11, gas11, ict11, he11, ia11, afa11, arts11, sports11 } = shsStrands;
        return (abm11 || 0) + (stem11 || 0) + (humss11 || 0) + (gas11 || 0) + (ict11 || 0) + (he11 || 0) + (ia11 || 0) + (afa11 || 0) + (arts11 || 0) + (sports11 || 0);
    };

    const getG12Total = () => {
        const { abm12, stem12, humss12, gas12, ict12, he12, ia12, afa12, arts12, sports12 } = shsStrands;
        return (abm12 || 0) + (stem12 || 0) + (humss12 || 0) + (gas12 || 0) + (ict12 || 0) + (he12 || 0) + (ia12 || 0) + (afa12 || 0) + (arts12 || 0) + (sports12 || 0);
    };

    const getESTotal = () => {
        const { gradeKinder, grade1, grade2, grade3, grade4, grade5, grade6 } = basicGrades;
        return (gradeKinder || 0) + (grade1 || 0) + (grade2 || 0) + (grade3 || 0) + (grade4 || 0) + (grade5 || 0) + (grade6 || 0);
    };

    const getJHSTotal = () => {
        const { grade7, grade8, grade9, grade10 } = basicGrades;
        return (grade7 || 0) + (grade8 || 0) + (grade9 || 0) + (grade10 || 0);
    };

    const getSHSTotal = () => getG11Total() + getG12Total();
    const getGrandTotal = () => getESTotal() + getJHSTotal() + getSHSTotal();

    // --- VISIBILITY LOGIC ---
    const showElem = () => curricularOffering.includes("Elementary") || curricularOffering.includes("K-12") || curricularOffering.includes("K-10") || !curricularOffering;
    const showJHS = () => curricularOffering.includes("Junior") || curricularOffering.includes("K-12") || curricularOffering.includes("K-10") || !curricularOffering;
    const showSHS = () => curricularOffering.includes("Senior") || curricularOffering.includes("K-12") || !curricularOffering;

    // --- NETWORK LISTENER ---
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // --- INITIALIZATION ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');

                if (storedSchoolId) setSchoolId(storedSchoolId);
                if (storedOffering) setCurricularOffering(storedOffering);

                try {
                    const fetchUrl = viewOnly && monitorSchoolId
                        ? `/api/monitoring/school-detail/${monitorSchoolId}`
                        : `/api/school-by-user/${user.uid}`;

                    const response = await fetch(fetchUrl);
                    if (response.ok) {
                        const result = await response.json();
                        const data = (viewOnly && monitorSchoolId) ? result : result.data;

                        if (data) {
                            setSchoolId(data.school_id);
                            setLastUpdated(data.submitted_at);
                            setCurricularOffering(data.curricular_offering || storedOffering || '');

                            if (!viewOnly) {
                                localStorage.setItem('schoolId', data.school_id);
                                localStorage.setItem('schoolOffering', data.curricular_offering || '');
                            }

                            setBasicGrades({
                                gradeKinder: data.grade_kinder || 0,
                                grade1: data.grade_1 || 0, grade2: data.grade_2 || 0,
                                grade3: data.grade_3 || 0, grade4: data.grade_4 || 0,
                                grade5: data.grade_5 || 0, grade6: data.grade_6 || 0,
                                grade7: data.grade_7 || 0, grade8: data.grade_8 || 0,
                                grade9: data.grade_9 || 0, grade10: data.grade_10 || 0
                            });

                            setShsStrands({
                                abm11: data.abm_11 || 0, abm12: data.abm_12 || 0,
                                stem11: data.stem_11 || 0, stem12: data.stem_12 || 0,
                                humss11: data.humss_11 || 0, humss12: data.humss_12 || 0,
                                gas11: data.gas_11 || 0, gas12: data.gas_12 || 0,
                                ict11: data.tvl_ict_11 || 0, ict12: data.tvl_ict_12 || 0,
                                he11: data.tvl_he_11 || 0, he12: data.tvl_he_12 || 0,
                                ia11: data.tvl_ia_11 || 0, ia12: data.tvl_ia_12 || 0,
                                afa11: data.tvl_afa_11 || 0, afa12: data.tvl_afa_12 || 0,
                                arts11: data.arts_11 || 0, arts12: data.arts_12 || 0,
                                sports11: data.sports_11 || 0, sports12: data.sports_12 || 0
                            });



                            setAralData({
                                aral_math_g1: data.aral_math_g1 || 0, aral_read_g1: data.aral_read_g1 || 0, aral_sci_g1: data.aral_sci_g1 || 0,
                                aral_math_g2: data.aral_math_g2 || 0, aral_read_g2: data.aral_read_g2 || 0, aral_sci_g2: data.aral_sci_g2 || 0,
                                aral_math_g3: data.aral_math_g3 || 0, aral_read_g3: data.aral_read_g3 || 0, aral_sci_g3: data.aral_sci_g3 || 0,
                                aral_math_g4: data.aral_math_g4 || 0, aral_read_g4: data.aral_read_g4 || 0, aral_sci_g4: data.aral_sci_g4 || 0,
                                aral_math_g5: data.aral_math_g5 || 0, aral_read_g5: data.aral_read_g5 || 0, aral_sci_g5: data.aral_sci_g5 || 0,
                                aral_math_g6: data.aral_math_g6 || 0, aral_read_g6: data.aral_read_g6 || 0, aral_sci_g6: data.aral_sci_g6 || 0
                            });

                            if (data.grade_1 || data.grade_7 || data.stem_11) {
                                setIsLocked(true);
                                setOriginalData({
                                    basic: { ...basicGrades },
                                    strands: { ...shsStrands },
                                    aral: { ...aralData }
                                });
                            }
                        } else if (!viewOnly && !storedSchoolId) {
                            alert("School Profile missing. Redirecting to setup...");
                            navigate('/school-profile', { state: { isFirstTime: true } });
                        }
                    }
                } catch (error) {
                    console.log("Fetch Error:", error);
                    if (!viewOnly && !storedSchoolId) {
                        alert("⚠️ You are offline and no School ID is saved. Please connect to internet.");
                        navigate('/schoolhead-dashboard');
                    }
                }
            }
            setTimeout(() => { setLoading(false); }, 1000);
        });
        return () => unsubscribe();
    }, []);

    // --- HANDLERS ---
    const handleBasicChange = (e) => setBasicGrades({ ...basicGrades, [e.target.name]: parseInt(e.target.value) || 0 });
    const handleStrandChange = (e) => setShsStrands({ ...shsStrands, [e.target.name]: parseInt(e.target.value) || 0 });

    const handleAralChange = (e) => setAralData({ ...aralData, [e.target.name]: parseInt(e.target.value) || 0 });

    const handleUpdateClick = () => { setEditAgreement(false); setShowEditModal(true); };

    const handleConfirmEdit = () => {
        setOriginalData({ basic: { ...basicGrades }, strands: { ...shsStrands }, aral: { ...aralData } });
        setIsLocked(false);
        setShowEditModal(false);
    };

    const handleCancelEdit = () => {
        if (originalData) {
            setBasicGrades(originalData.basic);
            setShsStrands(originalData.strands);

            setAralData(originalData.aral);
        }
        setIsLocked(true);
    };

    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);
        const user = auth.currentUser;

        if (!schoolId) {
            alert("Error: Missing School ID.");
            setIsSaving(false);
            return;
        }

        const finalESTotal = getESTotal();
        const finalJHSTotal = getJHSTotal();
        const finalSHSTotal = getSHSTotal();
        const finalGrandTotal = finalESTotal + finalJHSTotal + finalSHSTotal;

        const payload = {
            schoolId,
            submittedBy: user.uid,
            curricularOffering,
            ...basicGrades,
            ...shsStrands,

            ...aralData,
            grade11: getG11Total(),
            grade12: getG12Total(),
            esTotal: finalESTotal,
            jhsTotal: finalJHSTotal,
            shsTotal: finalSHSTotal,
            grandTotal: finalGrandTotal
        };

        if (!navigator.onLine) {
            try {
                await addToOutbox({
                    type: 'ENROLMENT',
                    label: 'Enrolment Data',
                    url: '/api/save-enrolment',
                    payload: payload
                });
                setShowOfflineModal(true); // USE MODAL
                setLastUpdated(new Date().toISOString());
                setIsLocked(true);
            } catch (e) {
                console.error(e);
                alert("Offline save failed.");
            } finally {
                setIsSaving(false);
            }
            return;
        }

        try {
            const response = await fetch('/api/save-enrolment', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (response.ok) {
                setShowSuccessModal(true); // USE MODAL
                setLastUpdated(new Date().toISOString());
                setIsLocked(true);
            } else {
                const err = await response.json();
                alert('Error: ' + err.message);
            }
        } catch (error) {
            // Offline fallback
            await addToOutbox({
                type: 'ENROLMENT',
                label: 'Enrolment Data',
                url: '/api/save-enrolment',
                payload: payload
            });
            alert("📴 Saved to Outbox!");
            setIsLocked(true);
        } finally { setIsSaving(false); }
    };

    if (loading) return (
        <div className="min-h-screen grid place-items-center bg-slate-50">
            <div className="w-10 h-10 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-32 font-sans">
            {/* --- PREMIUM BLUE HEADER --- */}
            <div className="bg-[#004A99] px-6 pt-10 pb-20 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />

                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                        <FiArrowLeft size={24} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-white tracking-tight">Enrollment</h1>
                            {curricularOffering && (
                                <span className="px-2 py-0.5 rounded-lg bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/10">
                                    {curricularOffering}
                                </span>
                            )}
                        </div>
                        <p className="text-blue-100 text-xs font-medium mt-1">Official Enrollment Counts</p>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-10 relative z-20 space-y-5">

                {/* OFFLINE BANNER */}
                {isOffline && (
                    <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded shadow-md relative z-30" role="alert">
                        <p className="font-bold">You are offline</p>
                        <p className="text-sm">Changes will be saved to Outbox and synced when online.</p>
                    </div>
                )}

                {/* --- ELEMENTARY CARD --- */}
                {showElem() && (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl">
                                    <TbSchool />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800">Elementary</h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kinder to Grade 6</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 text-xs font-black">
                                {getESTotal()}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {[
                                { l: 'Kinder', k: 'gradeKinder' }, { l: 'Grade 1', k: 'grade1' }, { l: 'Grade 2', k: 'grade2' },
                                { l: 'Grade 3', k: 'grade3' }, { l: 'Grade 4', k: 'grade4' }, { l: 'Grade 5', k: 'grade5' },
                                { l: 'Grade 6', k: 'grade6' }
                            ].map((item) => (
                                <div key={item.k} className="text-center group">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block group-hover:text-orange-500 transition-colors">{item.l}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        name={item.k}
                                        value={basicGrades[item.k]}
                                        onChange={handleBasicChange}
                                        disabled={isLocked}
                                        onFocus={e => e.target.select()}
                                        className="w-full h-12 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm transition-all hover:border-orange-200"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- JHS CARD --- */}
                {showJHS() && (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                                    <FiGrid />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800">Junior High School</h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Grade 7 to Grade 10</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 text-xs font-black">
                                {getJHSTotal()}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { l: 'Grade 7', k: 'grade7' }, { l: 'Grade 8', k: 'grade8' },
                                { l: 'Grade 9', k: 'grade9' }, { l: 'Grade 10', k: 'grade10' }
                            ].map((item) => (
                                <div key={item.k} className="text-center group">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block group-hover:text-blue-500 transition-colors">{item.l}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        name={item.k}
                                        value={basicGrades[item.k]}
                                        onChange={handleBasicChange}
                                        disabled={isLocked}
                                        onFocus={e => e.target.select()}
                                        className="w-full h-12 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all hover:border-blue-200"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- SHS CARD --- */}
                {showSHS() && (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
                                    <FiLayers />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800">Senior High School</h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Strands & Tracks</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 rounded-lg bg-purple-50 border border-purple-100 text-purple-600 text-xs font-black">
                                {getSHSTotal()}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-left border-b border-slate-100">
                                    <tr>
                                        <th className="pb-3 pl-2">Track / Strand</th>
                                        <th className="pb-3 text-center w-20">G11</th>
                                        <th className="pb-3 text-center w-20">G12</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {/* helper row */}
                                    {[
                                        { label: 'ABM', k11: 'abm11', k12: 'abm12' },
                                        { label: 'STEM', k11: 'stem11', k12: 'stem12' },
                                        { label: 'HUMSS', k11: 'humss11', k12: 'humss12' },
                                        { label: 'GAS', k11: 'gas11', k12: 'gas12' },
                                        { label: 'TVL - ICT', k11: 'ict11', k12: 'ict12' },
                                        { label: 'TVL - HE', k11: 'he11', k12: 'he12' },
                                        { label: 'TVL - IA', k11: 'ia11', k12: 'ia12' },
                                        { label: 'TVL - Agri', k11: 'afa11', k12: 'afa12' },
                                        { label: 'Arts & Design', k11: 'arts11', k12: 'arts12' },
                                        { label: 'Sports', k11: 'sports11', k12: 'sports12' }
                                    ].map((row) => (
                                        <tr key={row.label} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="py-2 pl-2 font-bold text-slate-600 text-xs">{row.label}</td>
                                            <td className="p-1">
                                                <input
                                                    type="number"
                                                    name={row.k11}
                                                    value={shsStrands[row.k11]}
                                                    onChange={handleStrandChange}
                                                    disabled={isLocked}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-xs transition-all hover:border-purple-200"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="number"
                                                    name={row.k12}
                                                    value={shsStrands[row.k12]}
                                                    onChange={handleStrandChange}
                                                    disabled={isLocked}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-xs transition-all hover:border-purple-200"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}



                {/* --- PROSPECTIVE ARAL ENROLLEES (Grades 1-6) --- */}
                {showElem() && (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                                📖
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-800">Prospective ARAL Enrollees</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Academic Recovery & Acceleration (Grades 1-6)</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-center border-b border-slate-100">
                                    <tr>
                                        <th className="pb-3 text-left pl-2">Grade Level</th>
                                        <th className="pb-3 text-indigo-600">Math</th>
                                        <th className="pb-3 text-pink-600">Reading</th>
                                        <th className="pb-3 text-teal-600">Science</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {[1, 2, 3, 4, 5, 6].map(g => (
                                        <tr key={g} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="py-2 pl-2 font-bold text-slate-600 text-xs">Grade {g}</td>
                                            <td className="p-1">
                                                <input
                                                    type="number" min="0"
                                                    name={`aral_math_g${g}`}
                                                    value={aralData[`aral_math_g${g}`]}
                                                    onChange={handleAralChange}
                                                    disabled={isLocked}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-indigo-700 bg-indigo-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs transition-all hover:border-indigo-200"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="number" min="0"
                                                    name={`aral_read_g${g}`}
                                                    value={aralData[`aral_read_g${g}`]}
                                                    onChange={handleAralChange}
                                                    disabled={isLocked}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-pink-700 bg-pink-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none text-xs transition-all hover:border-pink-200"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="number" min="0"
                                                    name={`aral_sci_g${g}`}
                                                    value={aralData[`aral_sci_g${g}`]}
                                                    onChange={handleAralChange}
                                                    disabled={isLocked}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full h-10 text-center font-bold text-teal-700 bg-teal-50/30 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-xs transition-all hover:border-teal-200"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* GRAND TOTAL */}
                <div className="bg-[#004A99] p-6 rounded-3xl flex justify-between items-center shadow-lg shadow-blue-900/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                    <div className="relative z-10">
                        <span className="font-bold uppercase tracking-widest text-[10px] text-blue-200 block mb-1">Total Enrollment</span>
                        <h2 className="text-4xl font-black text-white">{getGrandTotal()}</h2>
                    </div>
                    <div className="text-4xl text-white/20">📊</div>
                </div>

            </div>

            {/* --- FLOATING ACTION BAR --- */}
            <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-50">
                <div className="max-w-4xl mx-auto flex gap-3">
                    {viewOnly ? (
                        <button
                            onClick={() => navigate('/jurisdiction-schools')}
                            className="w-full py-4 rounded-2xl bg-[#004A99] text-white font-bold shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                        >
                            ← Back to Schools List
                        </button>
                    ) : isLocked ? (
                        <button
                            onClick={handleUpdateClick}
                            className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                        >
                            <span>✏️</span> UNLOCK EDIT
                        </button>
                    ) : (
                        <>
                            <button onClick={handleCancelEdit} className="w-1/3 py-4 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={() => setShowSaveModal(true)}
                                disabled={isSaving}
                                className="w-2/3 py-4 rounded-2xl bg-[#004A99] text-white font-bold shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                            >
                                {isSaving ? 'Saving...' : <><FiSave /> Save Enrollment</>}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* --- MODALS --- */}
            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} />

            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4 text-amber-500 text-2xl">
                            <FiAlertCircle />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Edit Enrollment?</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6">You are about to modify official enrollment records. Please confirm to proceed.</p>

                        <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer mb-6 border border-transparent hover:border-slate-100 transition">
                            <input type="checkbox" checked={editAgreement} onChange={(e) => setEditAgreement(e.target.checked)} className="mt-1 w-4 h-4 text-amber-600 rounded focus:ring-amber-600" />
                            <span className="text-xs font-bold text-slate-600 select-none">I understand and wish to proceed.</span>
                        </label>

                        <div className="flex gap-2">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancel</button>
                            <button onClick={handleConfirmEdit} disabled={!editAgreement} className={`flex-1 py-3 rounded-xl text-white font-bold shadow-sm ${editAgreement ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-200 cursor-not-allowed'}`}>Proceed</button>
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
                        <h3 className="font-bold text-lg text-slate-800">Confirm Submission</h3>

                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 my-4 flex justify-between items-center">
                            <span className="text-sm font-bold text-blue-800">Grand Total:</span>
                            <span className="text-xl font-black text-blue-900">{getGrandTotal()}</span>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancel</button>
                            <button onClick={confirmSave} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800">Submit</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Enrolment;