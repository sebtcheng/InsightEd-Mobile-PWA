// src/forms/TeacherSpecialization.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiBriefcase, FiCheckCircle, FiHelpCircle, FiInfo, FiSave, FiTrash2, FiPlus, FiPieChart, FiAlertCircle, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import { auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { addToOutbox, getOutbox } from '../db';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';

const SPECIALIZATION_OPTIONS = [
    'GENERAL EDUCATION',
    'EARLY CHILDHOOD EDUCATION',
    'FILIPINO',
    'ENGLISH',
    'MATH',
    'SCIENCE',
    'ARALING PANLIPUNAN',
    'TLE/EPP',
    'MAPEH',
    'ESP/ VALUES',
    'BIOLOGICAL SCIENCE',
    'PHYSICAL SCIENCE',
    'AGRICULTURE AND FISHERY ARTS',
    'OTHERS'
];

const ACADEMIC_MAP = {
    'GENERAL EDUCATION': 'spec_general_teaching',
    'EARLY CHILDHOOD EDUCATION': 'spec_ece_teaching',
    'ENGLISH': 'spec_english_major',
    'FILIPINO': 'spec_filipino_major',
    'MATH': 'spec_math_major',
    'SCIENCE': 'spec_science_major',
    'ARALING PANLIPUNAN': 'spec_ap_major',
    'TLE/EPP': 'spec_tle_major',
    'MAPEH': 'spec_mapeh_major',
    'ESP/ VALUES': 'spec_esp_major',
    'BIOLOGICAL SCIENCE': 'spec_bio_sci_major',
    'PHYSICAL SCIENCE': 'spec_phys_sci_major',
    'AGRICULTURE AND FISHERY ARTS': 'spec_agri_fishery_major',
    'OTHERS': 'spec_others_major'
};

const TeacherSpecialization = ({ embedded }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');
    const isDummy = location.state?.isDummy || false;

    // Super User / Audit Context
    const isSuperUser = localStorage.getItem('userRole') === 'Super User';
    const auditTargetId = sessionStorage.getItem('targetSchoolId');
    const isAuditMode = isSuperUser && !!auditTargetId;

    const [isReadOnly, setIsReadOnly] = useState(isDummy || isAuditMode);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);

    const [schoolId, setSchoolId] = useState(localStorage.getItem('schoolId'));
    const [teacherList, setTeacherList] = useState([]); // Array of teacher objects
    const [originalData, setOriginalData] = useState([]);

    // New Teacher State
    const [newTeacher, setNewTeacher] = useState({ full_name: '', position: '', specialization: 'GENERAL EDUCATION' });

    // --- PAGINATION STATE ---
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // --- DELETE STATE ---
    const [teacherToDelete, setTeacherToDelete] = useState(null);

    // --- AUTO-SAVE FUNCTION ---
    const autoSaveTeacher = async (teacher) => {
        if (!navigator.onLine || isReadOnly || viewOnly || isLocked) return;

        // Don't save if missing key fields or temp ID that isn't ready (though control_num is generated on add)
        if (!teacher.full_name || !teacher.control_num) return;

        try {
            // Calculate teaching load for save
            const h = parseInt(teacher.load_hours || 0, 10);
            const m = parseInt(teacher.load_minutes || 0, 10);
            const payload = {
                ...teacher,
                teaching_load: h + (m / 60)
            };

            const response = await fetch('/api/save-single-teacher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schoolId, teacher: payload })
            });

            if (!response.ok) {
                console.warn("Auto-save failed");
            }
        } catch (e) {
            console.error("Auto-save error:", e);
        }
    };

    // --- COMPUTED: SUMMARY STATS ---
    const summaryStats = useMemo(() => {
        if (!teacherList.length) return [];

        const stats = {};
        teacherList.forEach(t => {
            if (!t.specialization) return;
            if (!stats[t.specialization]) {
                stats[t.specialization] = { count: 0, load: 0 };
            }
            stats[t.specialization].count += 1;

            // Calculate load
            const h = parseInt(t.load_hours || 0, 10);
            const m = parseInt(t.load_minutes || 0, 10);
            const decimalLoad = h + (m / 60);
            stats[t.specialization].load += decimalLoad;
        });

        // Convert to array and sort by count desc
        return Object.entries(stats).map(([spec, data]) => ({
            name: spec,
            count: data.count,
            load: data.load
        })).sort((a, b) => b.count - a.count);
    }, [teacherList]);

    // --- PAGINATED DATA ---
    const totalPages = Math.ceil(teacherList.length / itemsPerPage);
    const paginatedTeachers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return teacherList.slice(start, start + itemsPerPage);
    }, [teacherList, currentPage]);

    // Reset to page 1 if items change significantly (optional, but good for filtering)
    // For now, we'll keep it simple.

    // --- AUTO-SHOW INFO MODAL ---
    useEffect(() => {
        const hasSeenInfo = localStorage.getItem('hasSeenSpecializationInfo');
        if (!hasSeenInfo) {
            setShowInfoModal(true);
            localStorage.setItem('hasSeenSpecializationInfo', 'true');
        }
    }, []);

    // --- LEGACY DATA STATE ---
    const [legacyHasData, setLegacyHasData] = useState(false);

    // --- DATA FETCHING ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const role = localStorage.getItem('userRole');
                    if (role === 'Central Office' || isDummy) setIsReadOnly(true);
                } catch (e) { }

                const storedSchoolId = localStorage.getItem('schoolId');
                if (storedSchoolId) setSchoolId(storedSchoolId);

                // Determine effective School ID
                let targetId = schoolIdParam || storedSchoolId;
                if (isAuditMode) targetId = auditTargetId;

                if (!targetId && !isDummy) {
                    setLoading(false);
                    return;
                }

                setLoading(true);
                try {
                    // Check Outbox first
                    let draftFound = false;
                    if (!viewOnly && !isAuditMode) {
                        try {
                            const drafts = await getOutbox();
                            const draft = drafts.find(d => d.type === 'TEACHER_SPECIALIZATION');
                            if (draft) {
                                setTeacherList(draft.payload.teachers); // Assuming payload structure
                                setIsLocked(false);
                                setLoading(false);
                                draftFound = true;
                            }
                        } catch (e) { }
                    }

                    if (draftFound) return;

                    // 1. Fetch INDIVIDUAL Teachers
                    const response = await fetch(`/api/teacher-personnel/${targetId}`);
                    if (response.ok) {
                        const data = await response.json();
                        // Transform data: Parse decimal to hours/mins
                        const formatted = data.map(t => {
                            const totalLoad = Number(t.teaching_load || 0);
                            const hours = Math.floor(totalLoad);
                            const minutes = Math.round((totalLoad % 1) * 60);
                            return {
                                ...t,
                                load_hours: hours,
                                load_minutes: minutes
                            };
                        });
                        setTeacherList(formatted);
                        setOriginalData(formatted);
                        setIsLocked(formatted.length > 0); // Lock if data exists
                    } else {
                        setTeacherList([]);
                    }

                    // 2. Fetch LEGACY Data (for backward compatibility validation)
                    // We can reuse the school profile endpoint or just a lightweight check
                    try {
                        // Use the school-by-user or similar if accessible, or a direct query
                        // Since we have schoolId, let's use a specific check if possible, or just fetch the profile
                        // We will check if we can get the profile data. 
                        // The user might be viewing another school (Audit), so we need an endpoint by School ID.
                        // Let's use the public/shared endpoint if available, or just assume if teacherList is empty we might need to check.
                        // Actually, let's try to fetch the profile data using the endpoint that returns all data including spec_ fields.

                        // NOTE: We don't have a direct 'get-school-profile-by-id' that returns everything publicly unless authenticated?
                        // But we are authenticated.
                        // Let's try fetching `/api/school-by-user/${user.uid}` if it's our school, but that doesn't work for audit.
                        // Let's use `/api/school-resources/${user.uid}`? No, that's by UID.

                        // Let's just Add a new endpoint or use an existing one?
                        // Wait, we can use `/api/print/school-profile/:schoolId`? That returns the profile.
                        // Or `/api/school-summary/:schoolId`?

                        // Quickest way: Add a small check in the same effect?
                        // Let's assume there's an endpoint or I'll just skip this check if I can't find one easily?
                        // No, I MUST implement it.

                        // Let's use a known endpoint that returns school_profiles data.
                        // I see `/api/school-by-user/:uid` returns data.
                        // If I am the user, I can use that.
                        // If I am checking another school (Audit), I might need another way.
                        // But for now, let's try to assume the user is the owner or check if we can get it.

                        // Actually, I will add a fetch to `/api/school-profile-legacy/${targetId}` (I'll create this if needed, or use a raw query if I could).
                        // Better: Use `fetch('/api/school-profile/' + targetId)`?

                        // Let's just add the logic to check `spec_` fields if `teacherList` is empty.
                        // I will add a fetch to `/api/check-legacy-specialization/${targetId}`.
                        const legacyRes = await fetch(`/api/check-legacy-specialization/${targetId}`);
                        if (legacyRes.ok) {
                            const legacyData = await legacyRes.json();
                            if (legacyData.hasLegacyData) {
                                setLegacyHasData(true);
                            }
                        }
                    } catch (e) {
                        console.warn("Legacy check failed", e);
                    }

                } catch (err) {
                    console.error("Fetch error:", err);
                } finally {
                    setLoading(false);
                }
            }
        });
        return () => unsubscribe();
    }, [viewOnly, schoolIdParam, isAuditMode, auditTargetId, isDummy]);

    const goBack = () => {
        if (isDummy) {
            navigate('/dummy-forms', { state: { type: 'school' } });
        } else {
            navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');
        }
    };

    // --- HANDLERS ---
    // --- HANDLERS ---
    const handleInputChange = (index, field, value) => {
        // Adjust index for pagination if needed, BUT here 'index' comes from the map
        // If we map over paginatedTeachers, the index is 0..9. We need the REAL index in teacherList.
        // We will pass the REAL index from the render method.

        let cleanVal = value;

        if (field === 'load_hours') {
            cleanVal = value.replace(/^0+/, '');
            if (cleanVal && parseInt(cleanVal, 10) > 10) cleanVal = '10';
        } else if (field === 'load_minutes') {
            cleanVal = value.slice(0, 2).replace(/^0+/, '');
            if (cleanVal && parseInt(cleanVal, 10) > 59) cleanVal = '59';
        }

        const updated = [...teacherList];
        updated[index] = { ...updated[index], [field]: cleanVal };
        setTeacherList(updated);

        // Auto-Save for strict fields (Name/Spec)
        if (field === 'full_name' || field === 'specialization') {
            autoSaveTeacher(updated[index]);
        }
    };

    const handleDeleteTeacher = (teacher) => {
        setTeacherToDelete(teacher);
    };

    const confirmDeleteTeacher = async () => {
        if (!teacherToDelete) return;

        // 1. Optimistic UI Update
        setTeacherList(prev => prev.filter(t => t.control_num !== teacherToDelete.control_num));
        setTeacherToDelete(null);

        // 2. Adjust Pagination if needed
        // If the current page becomes empty and it's not the first page, go back one
        const remainingOnPage = teacherList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).length - 1;
        if (remainingOnPage === 0 && currentPage > 1) {
            setCurrentPage(curr => curr - 1);
        }

        // 3. Backend Call
        try {
            // Only call API if it has a real ID (not a temp one, though we assigned one)
            // But wait, our 'control_num' is our ID.
            if (teacherToDelete.control_num) {
                await fetch(`/api/delete-teacher-personnel/${schoolId}/${teacherToDelete.control_num}`, {
                    method: 'DELETE'
                });
            }
        } catch (e) {
            console.error("Delete failed", e);
            // Optionally revert UI if needed, but since we want "snappy", we assume success
            // or show a toast on error.
            alert("Failed to delete from server. Please refresh.");
        }
    };

    const handleAddTeacher = () => {
        if (!newTeacher.full_name || !newTeacher.position) {
            alert("Please enter Name and Position.");
            return;
        }

        const toAdd = {
            control_num: `MANUAL-${Date.now()}`, // Temporary ID
            school_id: schoolId,
            full_name: newTeacher.full_name,
            position: newTeacher.position,
            position_group: 'TBD', // Default
            specialization: newTeacher.specialization,
            teaching_load: 0,
            load_hours: 0,
            load_minutes: 0,
            iern: null
        };

        setTeacherList([...teacherList, toAdd]);
        setNewTeacher({ full_name: '', position: '', specialization: 'GENERAL EDUCATION' });
        setShowAddModal(false);
        // Go to last page
        const newTotal = teacherList.length + 1;
        setCurrentPage(Math.ceil(newTotal / itemsPerPage));
    };

    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);
        const user = auth.currentUser;

        // 1. Prepare TEACHER LIST Payload
        const teachersPayload = teacherList.map(t => {
            const h = parseInt(t.load_hours || 0, 10);
            const m = parseInt(t.load_minutes || 0, 10);
            return {
                ...t,
                teaching_load: h + (m / 60)
            };
        });

        // 2. Prepare LEGACY AGGREGATE Payload
        // Count occurrences per mapped specialization
        const aggregateData = {};
        teacherList.forEach(t => {
            const dbColumn = ACADEMIC_MAP[t.specialization];
            if (dbColumn) {
                aggregateData[dbColumn] = (aggregateData[dbColumn] || 0) + 1;
            }
        });

        const listPayload = {
            uid: user.uid,
            schoolId: schoolId,
            teachers: teachersPayload
        };

        const legacyPayload = {
            schoolId: schoolId,
            data: aggregateData
        };

        const handleOfflineSave = async () => {
            try {
                await addToOutbox({
                    type: 'TEACHER_SPECIALIZATION',
                    label: 'Teacher Specialization',
                    url: '/api/save-teacher-personnel',
                    payload: listPayload
                });
                setShowOfflineModal(true);
                setOriginalData([...teacherList]);
                setIsLocked(true);
            } catch (e) { alert("Offline save failed."); }
        };

        if (!navigator.onLine) {
            await handleOfflineSave();
            setIsSaving(false);
            return;
        }

        try {
            // DUAL SAVE: PARALLEL REQUESTS
            const [resList, resLegacy] = await Promise.all([
                fetch('/api/save-teacher-personnel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(listPayload)
                }),
                fetch('/api/save-teacher-specialization-legacy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(legacyPayload)
                })
            ]);

            if (resList.ok && resLegacy.ok) {
                setShowSuccessModal(true);
                setOriginalData([...teacherList]);
                setIsLocked(true);
            } else {
                const err = await resList.json();
                throw new Error(err.error || "Save failed");
            }
        } catch (e) {
            console.log("Network error, moving to outbox...", e);
            await handleOfflineSave();
        } finally {
            setIsSaving(false);
        }
    };

    const isFormValid = () => {
        // 1. New Check: Teacher List
        const hasValidTeacher = teacherList.length > 0 && teacherList.some(t =>
            t.specialization &&
            ((parseInt(t.load_hours || 0) > 0) || (parseInt(t.load_minutes || 0) > 0))
        );

        if (hasValidTeacher) return true;

        // 2. Legacy Check:
        if (legacyHasData) return true;

        return false;
    };

    if (loading) return (
        <div className="min-h-screen grid place-items-center bg-slate-50">
            <div className="w-10 h-10 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
        </div>
    );

    return (
        <div className={`min-h-screen font-sans pb-32 relative ${embedded ? '' : 'bg-slate-50'}`}>
            {/* Header */}
            {!embedded && (
                <div className="bg-[#004A99] px-6 pt-10 pb-20 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                    <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={goBack} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                                <FiArrowLeft size={24} />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-white tracking-tight">Teacher Personnel</h1>
                                <p className="text-blue-100 text-xs font-medium mt-1">Manage specializations and teaching loads</p>
                            </div>
                        </div>
                        <button onClick={() => setShowInfoModal(true)} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                            <FiHelpCircle size={24} />
                        </button>
                    </div>
                </div>
            )}

            <div className={`px-5 relative z-20 max-w-5xl mx-auto space-y-6 ${embedded ? '' : '-mt-12'}`}>

                {/* --- NEW: SUMMARY DASHBOARD --- */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <FiPieChart size={18} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">School Specialization Summary</h2>
                    </div>

                    {summaryStats.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No specialization data yet.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 pb-4">
                            {summaryStats.map((stat) => (
                                <div key={stat.name} className="w-full bg-blue-50/50 border border-blue-100 p-4 rounded-2xl">
                                    <div className="text-[10px] font-bold text-blue-600 uppercase mb-2 line-clamp-2 h-8">
                                        {stat.name}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-center text-slate-700 text-xs font-medium">
                                            <span>Teachers:</span>
                                            <span className="font-bold">{stat.count}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-700 text-xs font-medium">
                                            <span>Total Load:</span>
                                            <span className="font-bold">{Number(stat.load).toFixed(1)} h</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* TEACHER LIST CARD */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                <FiBriefcase size={20} />
                            </div>
                            <div>
                                <h2 className="text-slate-800 font-bold text-lg">Teacher List</h2>
                                <p className="text-xs text-slate-400 font-medium">{teacherList.length} Record(s) Found</p>
                            </div>
                        </div>

                        {(!isLocked && !viewOnly && !isReadOnly) && (
                            <button onClick={() => setShowAddModal(true)} className="bg-green-50 text-green-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-green-100 transition-colors">
                                <FiPlus /> Add Teacher
                            </button>
                        )}
                    </div>

                    <div className="p-4 space-y-4 bg-slate-50/50">
                        {teacherList.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-2xl border border-dashed border-slate-200">
                                No teachers found. Click "Add Teacher" to start.
                            </div>
                        ) : (
                            <>
                                {paginatedTeachers.map((teacher, pIndex) => {
                                    // Calculate REAL index in main array
                                    const realIndex = (currentPage - 1) * itemsPerPage + pIndex;

                                    return (
                                        <div key={realIndex} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3 relative overflow-hidden">
                                            {/* Row 1: Name & Delete */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                                                        Teacher Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        disabled={isLocked || viewOnly || isReadOnly}
                                                        value={teacher.full_name}
                                                        onChange={(e) => handleInputChange(realIndex, 'full_name', e.target.value.toUpperCase())}
                                                        placeholder="SURNAME, FIRST NAME M.I."
                                                        className="w-full font-bold text-slate-800 uppercase bg-transparent border-b border-transparent focus:border-blue-500 focus:bg-slate-50 outline-none transition-all placeholder:text-slate-300"
                                                    />
                                                </div>
                                                {(!isLocked && !viewOnly && !isReadOnly) && (
                                                    <button
                                                        onClick={() => handleDeleteTeacher(teacher)}
                                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors -mr-2 -mt-2"
                                                        title="Remove Teacher"
                                                    >
                                                        <FiTrash2 size={18} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Row 2: Position */}
                                            <div className="-mt-1">
                                                <div className="text-xs font-semibold text-slate-500 uppercase bg-slate-100/50 inline-block px-2 py-0.5 rounded">
                                                    {teacher.position}
                                                </div>
                                            </div>

                                            {/* Row 3: Specialization */}
                                            <div>
                                                <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1 block flex items-center gap-1">
                                                    <FiBriefcase size={10} /> Verified Major/Specialization
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        disabled={isLocked || viewOnly || isReadOnly}
                                                        value={teacher.specialization || ''}
                                                        onChange={(e) => handleInputChange(realIndex, 'specialization', e.target.value)}
                                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none disabled:opacity-60"
                                                    >
                                                        <option value="" disabled>Select Specialization</option>
                                                        {SPECIALIZATION_OPTIONS.map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 4: Teaching Load */}
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                                                    Teaching Load
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 relative">
                                                        <input
                                                            type="number"
                                                            disabled={isLocked || viewOnly || isReadOnly}
                                                            value={teacher.load_hours}
                                                            onChange={(e) => handleInputChange(realIndex, 'load_hours', e.target.value)}
                                                            onBlur={() => autoSaveTeacher(teacher)}
                                                            className="w-full p-2.5 text-center bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                                            placeholder="0"
                                                            min="0"
                                                        />
                                                        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">HRS</span>
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <input
                                                            type="number"
                                                            disabled={isLocked || viewOnly || isReadOnly}
                                                            value={teacher.load_minutes}
                                                            onChange={(e) => handleInputChange(realIndex, 'load_minutes', e.target.value)}
                                                            onBlur={() => autoSaveTeacher(teacher)}
                                                            className="w-full p-2.5 text-center bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                                            placeholder="0"
                                                            min="0" max="59"
                                                        />
                                                        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">MINS</span>
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    );
                                })}

                                {/* PAGINATION CONTROLS */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 pt-4">
                                        <button
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                            className="p-2 text-slate-500 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50"
                                            title="First Page"
                                        >
                                            <FiChevronsLeft />
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-4 py-2 text-sm font-bold text-slate-500 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-xs font-bold text-slate-400 px-2">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-4 py-2 text-sm font-bold text-slate-500 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50"
                                        >
                                            Next
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages}
                                            className="p-2 text-slate-500 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50"
                                            title="Last Page"
                                        >
                                            <FiChevronsRight />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

            </div>

            {/* Footer Actions */}
            {!embedded && (
                <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-100 p-4 pb-8 z-40">
                    <div className="max-w-lg mx-auto flex gap-3">
                        {(viewOnly || isReadOnly) ? (
                            <div className="w-full text-center p-3 text-slate-400 font-bold bg-slate-100 rounded-2xl text-sm">Read-Only Mode</div>
                        ) : isLocked ? (
                            <button onClick={() => setIsLocked(false)} className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-colors">
                                🔓 Unlock to Edit Data
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowSaveModal(true)}
                                disabled={isSaving || !isFormValid()}
                                className="flex-1 bg-[#004A99] text-white font-bold py-4 rounded-2xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <><FiSave /> Save Changes</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ADD TEACHER MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="font-bold text-xl text-slate-800 mb-4">Add New Teacher</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Full Name (First MI Last)</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g. Juan A. dela Cruz"
                                    value={newTeacher.full_name}
                                    onChange={e => setNewTeacher({ ...newTeacher, full_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Position</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g. Teacher I"
                                    value={newTeacher.position}
                                    onChange={e => setNewTeacher({ ...newTeacher, position: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Specialization</label>
                                <select
                                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    value={newTeacher.specialization}
                                    onChange={e => setNewTeacher({ ...newTeacher, specialization: e.target.value })}
                                >
                                    {SPECIALIZATION_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Cancel</button>
                            <button onClick={handleAddTeacher} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-800">Add Teacher</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SAVE MODAL */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <FiCheckCircle size={24} />
                        </div>
                        <h3 className="font-bold text-xl text-slate-800 text-center mb-2">Save Changes?</h3>
                        <p className="text-slate-500 text-center text-sm mb-6">This will update the personnel list for this school.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={confirmSave} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-colors">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* INFO MODAL */}
            {showInfoModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-blue-600 text-2xl">
                            <FiInfo />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 text-center">Personnel Guide</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6 text-center">
                            Please review the list of teachers. <br />
                            1. Select the <b>Specialization</b> for each teacher.<br />
                            2. Input the <b>Teaching Load</b> (hours & minutes).<br />
                            3. Use <b>Add Teacher</b> for missing personnel.
                        </p>
                        <button onClick={() => setShowInfoModal(false)} className="w-full py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition-transform active:scale-95">Got it</button>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            {teacherToDelete && (
                <div className="bg-slate-900/40 backdrop-blur-sm fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                        <FiAlertCircle className="text-red-500 w-12 h-12 mx-auto mb-4" />

                        <h3 className="font-bold text-xl text-slate-800 text-center mb-2">Remove Teacher?</h3>
                        <p className="text-slate-500 text-center text-sm mb-6">
                            Are you sure you want to remove <br />
                            <span className="font-bold text-slate-700">
                                {teacherToDelete.full_name}
                            </span> from this school's roster? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setTeacherToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={confirmDeleteTeacher} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-900/20 hover:bg-red-700 transition-colors">Confirm Remove</button>
                        </div>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="Personnel list saved successfully!" />
        </div>
    );
};

export default TeacherSpecialization;