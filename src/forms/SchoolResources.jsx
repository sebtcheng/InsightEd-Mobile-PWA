// src/forms/SchoolResources.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiPackage, FiMapPin, FiLayout, FiCheckCircle, FiXCircle, FiMonitor, FiTool, FiDroplet, FiZap, FiHelpCircle, FiInfo, FiSave, FiPlus, FiTrash2 } from 'react-icons/fi';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
// LoadingScreen import removed
import { addToOutbox, getOutbox, saveSpaceDraft, getSpaceDrafts, clearSpaceDrafts } from '../db';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';
import { normalizeOffering } from '../utils/dataNormalization';
import MapTutorialModal from '../components/MapTutorialModal'; // [NEW]
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Rectangle } from 'react-leaflet'; // [MODIFIED] Added Rectangle
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet Icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const PHILIPPINES_CENTER = [12.8797, 121.7740];



// --- EXTRACTED COMPONENTS ---
const InputField = ({ label, name, type = "number", formData, handleChange, isLocked, viewOnly }) => (
    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 group hover:border-blue-100 transition-colors">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider w-2/3 group-hover:text-blue-600 transition-colors">{label}</label>
        <input
            type="text" inputMode="numeric" pattern="[0-9]*" name={name} value={formData[name] ?? 0}
            onChange={handleChange} disabled={isLocked || viewOnly}
            className="w-24 text-center font-bold text-blue-900 bg-white border border-slate-200 rounded-xl py-2.5 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-transparent disabled:border-transparent text-lg shadow-sm"
            onFocus={() => formData[name] === 0 && handleChange({ target: { name, value: '' } })}
            onBlur={() => (formData[name] === '' || formData[name] === null) && handleChange({ target: { name, value: 0 } })}
        />
    </div>
);

const SelectField = ({ label, name, options, formData, handleChange, isLocked, viewOnly }) => (
    <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 group hover:border-blue-100 transition-colors">
        {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">{label}</label>}
        <select
            name={name} value={formData[name] || ''} onChange={handleChange} disabled={isLocked || viewOnly}
            className="w-full font-bold text-slate-900 bg-white border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-800 disabled:border-transparent shadow-sm text-sm"
        >
            <option value="" disabled hidden>-- Select --</option>
            {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
    </div>
);

const SeatRow = ({ label, enrollment, seatKey, formData, handleChange, isLocked, viewOnly, shiftModality }) => {
    const seats = formData[seatKey] || 0;

    const isDoubleShift = seatKey === 'seats_kinder' || shiftModality === 'Double Shift';

    const requiredSeats = isDoubleShift
        ? Math.ceil(enrollment / 2)
        : enrollment;

    const shortage = Math.max(0, requiredSeats - seats);
    const isShortage = shortage > 0;

    return (
        <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
            <td className="py-4 px-4 text-xs font-bold text-slate-600 group-hover:text-blue-600 transition-colors">
                {label}
                {isDoubleShift && <span className="block text-[8px] text-blue-500 uppercase mt-0.5">Double Shift</span>}
            </td>
            <td className="py-4 px-4 text-center">
                <span className="bg-blue-50 text-blue-700 text-[10px] px-2.5 py-1 rounded-lg font-bold">
                    {enrollment}
                </span>
            </td>
            <td className="py-4 px-4">
                <div className="flex justify-center flex-col items-center">
                    <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Total (All Sections)</p>
                    <input
                        type="text" inputMode="numeric" pattern="[0-9]*"
                        name={seatKey}
                        onChange={handleChange}
                        disabled={isLocked || viewOnly}
                        className="w-20 text-center font-bold text-slate-900 bg-white border border-slate-200 rounded-lg py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-transparent disabled:border-transparent shadow-sm"
                        value={seats ?? 0}
                        onFocus={() => seats === 0 && handleChange({ target: { name: seatKey, value: '' } })}
                        onBlur={() => (seats === '' || seats === null) && handleChange({ target: { name: seatKey, value: 0 } })}
                    />
                </div>
            </td>
            <td className="py-4 px-4 text-center">
                {isShortage ? (
                    <span className="text-red-600 bg-red-50 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border border-red-100 inline-flex items-center gap-1">
                        <FiXCircle className="inline" /> -{shortage}
                    </span>
                ) : (
                    <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-emerald-100 inline-flex items-center gap-1">
                        <FiCheckCircle className="inline" /> OK
                    </span>
                )}
            </td>
        </tr>
    );
};

const ResourceAuditRow = ({ label, funcName, nonFuncName, formData, handleChange, isLocked, viewOnly }) => (
    <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
        <td className="py-4 px-4 text-xs font-bold text-slate-600 uppercase tracking-wide group-hover:text-blue-600 transition-colors">{label}</td>
        <td className="py-3 px-2">
            <div className="relative">
                <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Total Count</p>
                <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    name={funcName}
                    value={formData[funcName] ?? 0}
                    onChange={handleChange}
                    disabled={isLocked || viewOnly}
                    className="w-full text-center font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-transparent disabled:border-transparent"
                    onFocus={() => formData[funcName] === 0 && handleChange({ target: { name: funcName, value: '' } })}
                    onBlur={() => (formData[funcName] === '' || formData[funcName] === null) && handleChange({ target: { name: funcName, value: 0 } })}
                />
            </div>
        </td>
        <td className="py-3 px-2">
            <div className="relative">
                <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Total Count</p>
                <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    name={nonFuncName}
                    value={formData[nonFuncName] ?? 0}
                    onChange={handleChange}
                    disabled={isLocked || viewOnly}
                    className="w-full text-center font-bold text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none disabled:bg-transparent disabled:border-transparent"
                    onFocus={() => formData[nonFuncName] === 0 && handleChange({ target: { name: nonFuncName, value: '' } })}
                    onBlur={() => (formData[nonFuncName] === '' || formData[nonFuncName] === null) && handleChange({ target: { name: nonFuncName, value: 0 } })}
                />
            </div>
        </td>
    </tr>
);

const LabRow = ({ label, name, formData, handleChange, isLocked, viewOnly }) => (
    <div className="flex justify-between items-center p-4 border-b border-slate-50 last:border-0 bg-slate-50/50 rounded-2xl mb-2 hover:bg-white hover:shadow-sm hover:border-slate-100 transition-all">
        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">{label}</label>
        <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            name={name}
            value={formData[name] ?? 0}
            onChange={handleChange}
            disabled={isLocked || viewOnly}
            className="w-20 text-center font-bold text-blue-900 bg-white border border-slate-200 rounded-xl py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-transparent shadow-sm"
            onFocus={() => formData[name] === 0 && handleChange({ target: { name, value: '' } })}
            onBlur={() => (formData[name] === '' || formData[name] === null) && handleChange({ target: { name, value: 0 } })}
        />
    </div>
);

const SchoolResources = ({ embedded }) => {
    const navigate = useNavigate();

    // --- STATE ---
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
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);


    // --- AUTO-SHOW INFO MODAL ---
    useEffect(() => {
        const hasSeenInfo = localStorage.getItem('hasSeenResourcesInfo');
        if (!hasSeenInfo) {
            setShowInfoModal(true);
            localStorage.setItem('hasSeenResourcesInfo', 'true');
        }
    }, []);

    // --- SAVE TIMER EFFECTS ---

    const [userRole, setUserRole] = useState("School Head");


    const [schoolId, setSchoolId] = useState(null);
    const [iern, setIern] = useState(null); // [NEW] IERN State
    const [formData, setFormData] = useState({});
    // const isDummy = location.state?.isDummy || false; // Moved up
    const [originalData, setOriginalData] = useState(null);

    // --- SHIFTING DATA STATE ---
    const [shiftingData, setShiftingData] = useState({});

    // --- BUILDABLE SPACES STATE ---
    const [spaces, setSpaces] = useState([]);
    const [schoolLocation, setSchoolLocation] = useState(null); // [NEW]

    // --- E-CART BATCHES STATE ---
    const ECART_TEMPLATE = {
        batch_no: '', year_received: '', source_fund: 'DepEd Central',
        ecart_qty_laptops: '', ecart_condition_laptops: 'Good',
        ecart_has_smart_tv: false, ecart_tv_size: '', ecart_condition_tv: '',
        ecart_condition_charging: '', ecart_condition_cabinet: ''
    };
    const [ecartBatches, setEcartBatches] = useState([]);
    const [showEcartModal, setShowEcartModal] = useState(false);
    const [currentEcart, setCurrentEcart] = useState({ ...ECART_TEMPLATE });
    const [editingEcartIdx, setEditingEcartIdx] = useState(null); // null = adding, number = editing
    const [showTutorial, setShowTutorial] = useState(false); // [NEW]
    const [currentSpace, setCurrentSpace] = useState({ lat: null, lng: null, length: '', width: '', area: 0 });
    const [mapCenter, setMapCenter] = useState([12.8797, 121.7740]); // Default PH Center

    // Trigger Tutorial when 'Yes' is selected
    useEffect(() => {
        if (formData.res_buildable_space === 'Yes' && !isAuditMode && !viewOnly) {
            const hasSeen = localStorage.getItem('hasSeenMapTutorial');
            if (!hasSeen) {
                setShowTutorial(true);
            }
        }
    }, [formData.res_buildable_space]);

    // Helper: Calculate Bounds from Center + Dimensions (Meters)
    const getBounds = (lat, lng, length, width) => {
        if (!lat || !lng || !length || !width) return null;
        // Approx: 1 deg lat = 111320m
        const latOffset = (width / 2) / 111320;
        // Approx: 1 deg lng = 111320 * cos(lat)
        const lngOffset = (length / 2) / (111320 * Math.cos(lat * (Math.PI / 180)));
        return [
            [lat - latOffset, lng - lngOffset], // SouthWest
            [lat + latOffset, lng + lngOffset]  // NorthEast
        ];
    };

    const AddMarker = () => {
        const map = useMap();

        // 4. INVALIDATE SIZE
        useEffect(() => {
            if (formData.res_buildable_space === 'Yes') {
                setTimeout(() => { map.invalidateSize(); }, 400); // Delay for transition
            }
        }, [formData.res_buildable_space, map]);

        useMapEvents({
            click(e) {
                if (!isLocked && !viewOnly && !isReadOnly && formData.res_buildable_space === 'Yes') {
                    setCurrentSpace(prev => ({ ...prev, lat: e.latlng.lat, lng: e.latlng.lng }));
                }
            },
        });

        // Draggable Marker Logic
        const markerRef = React.useRef(null);
        const eventHandlers = React.useMemo(
            () => ({
                dragend() {
                    const marker = markerRef.current;
                    if (marker != null) {
                        const { lat, lng } = marker.getLatLng();
                        setCurrentSpace(prev => ({ ...prev, lat, lng }));
                    }
                },
            }),
            [],
        );

        // Calculate Dynamic Bounds for Preview
        const previewBounds = getBounds(currentSpace.lat, currentSpace.lng, parseFloat(currentSpace.length), parseFloat(currentSpace.width));

        return (
            <>
                {currentSpace.lat && (
                    <Marker
                        draggable={!isLocked && !viewOnly && !isReadOnly}
                        eventHandlers={eventHandlers}
                        position={[currentSpace.lat, currentSpace.lng]}
                        ref={markerRef}
                    />
                )}
                {/* Dynamic Preview Rectangle */}
                {previewBounds && (
                    <Rectangle
                        bounds={previewBounds}
                        pathOptions={{ color: '#3b82f6', weight: 1, fillOpacity: 0.4 }}
                    />
                )}
            </>
        );
    };

    const handleSpaceInput = (e) => {
        let { name, value } = e.target;

        // Enforce 3-digit limit (max 999)
        if (value.length > 3) value = value.slice(0, 3);

        const val = parseFloat(value) || 0;

        setCurrentSpace(prev => {
            const newState = { ...prev, [name]: val };
            newState.area = (newState.length || 0) * (newState.width || 0);
            return newState;
        });
    };

    const addSpace = () => {
        if (!currentSpace.lat || !currentSpace.length || !currentSpace.width) {
            alert("Please drop a pin and enter dimensions.");
            return;
        }
        setSpaces(prev => {
            const updated = [...prev, { ...currentSpace, id: Date.now() }];
            if (auth.currentUser) saveSpaceDraft(auth.currentUser.uid, updated).catch(console.error);
            return updated;
        });
        setCurrentSpace({ lat: null, lng: null, length: '', width: '', area: 0 });
    };

    const removeSpace = (id) => {
        setSpaces(prev => {
            const updated = prev.filter(s => s.id !== id);
            if (auth.currentUser) saveSpaceDraft(auth.currentUser.uid, updated).catch(console.error);
            return updated;
        });
    };

    const goBack = () => {
        if (isDummy) {
            navigate('/dummy-forms', { state: { type: 'school' } });
        } else {
            navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');
        }
    };

    // --- NEON SCHEMA MAPPING ---
    const initialFields = {
        res_water_source: '',
        res_tvl_workshops: 0,
        res_electricity_source: '',
        res_buildable_space: '',
        sha_category: '', // [NEW] SHA Category

        // LABS
        res_sci_labs: 0, res_com_labs: 0,

        // FUNCTIONAL / NON-FUNCTIONAL (E-Cart moved to separate ecartBatches state)
        res_laptop_func: 0, res_laptop_nonfunc: 0,
        res_tv_func: 0, res_tv_nonfunc: 0,
        res_printer_func: 0, res_printer_nonfunc: 0,
        res_desk_func: 0, res_desk_nonfunc: 0,
        res_armchair_func: 0, res_armchair_nonfunc: 0,
        res_handwash_func: 0, res_handwash_nonfunc: 0,

        // SANITATION: Specific Fixture Counts
        female_bowls_func: 0, female_bowls_nonfunc: 0,
        male_bowls_func: 0, male_bowls_nonfunc: 0,
        male_urinals_func: 0, male_urinals_nonfunc: 0,
        pwd_bowls_func: 0, pwd_bowls_nonfunc: 0,

        // SEATS
        seats_kinder: 0, seats_grade_1: 0, seats_grade_2: 0, seats_grade_3: 0,
        seats_grade_4: 0, seats_grade_5: 0, seats_grade_6: 0,
        seats_grade_7: 0, seats_grade_8: 0, seats_grade_9: 0, seats_grade_10: 0,
        seats_grade_11: 0, seats_grade_12: 0
    };

    // --- FETCH DATA (Strict Sync Cache Strategy) ---
    const [enrollmentData, setEnrollmentData] = useState({});
    const [curricularOffering, setCurricularOffering] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // DEFAULT STATE
                const defaultFormData = initialFields;

                // Check Role for Read-Only and Fetch Logic
                let isCORole = false;
                try {
                    const role = localStorage.getItem('userRole');
                    if (role === 'Central Office' || isDummy) {
                        setIsReadOnly(true);
                        isCORole = (role === 'Central Office');
                    }
                } catch (e) { }

                // Sync Cache Loading
                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');
                if (storedSchoolId) setSchoolId(storedSchoolId);
                if (storedOffering) setCurricularOffering(storedOffering);

                // Load Profile Cache (Enrollment) - Critical for calculations
                const cachedProfile = localStorage.getItem('fullSchoolProfile');
                if (cachedProfile) {
                    try {
                        const pData = JSON.parse(cachedProfile);
                        // Offering from profile has precedence if valid
                        if (pData.curricular_offering) setCurricularOffering(pData.curricular_offering);
                        if (pData.iern) setIern(pData.iern); // [NEW] Load IERN from cache

                        // Map Enrollment using cached data
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
                    } catch (e) { console.error("Profile cache error", e); }
                }

                // Load Resources Cache (Main Form)
                let loadedFromCache = false;
                const CACHE_KEY_RES = `CACHE_RESOURCES_${user.uid}`;
                const cachedRes = localStorage.getItem(CACHE_KEY_RES);

                if (cachedRes) {
                    try {
                        const parsed = JSON.parse(cachedRes);
                        setFormData({ ...defaultFormData, ...parsed });
                        setOriginalData({ ...defaultFormData, ...parsed });

                        const hasCachedData = Object.keys(initialFields).some(k => parsed[k]);
                        setIsLocked(hasCachedData);
                        setLoading(false); // CRITICAL: Instant Load
                        loadedFromCache = true;
                        console.log("Loaded cached Resources (Instant Load)");
                    } catch (e) { console.error("Resources cache error", e); }
                }

                // Load Shifting Cache (For Double Shift logic)
                const CACHE_KEY_SHIFTING = `CACHE_SHIFTING_${user.uid}`;
                const cachedShifting = localStorage.getItem(CACHE_KEY_SHIFTING);
                if (cachedShifting) {
                    try {
                        const parsed = JSON.parse(cachedShifting);
                        setShiftingData(parsed.shifts || {});
                    } catch (e) { console.error("Shifting cache error", e); }
                }

                try {
                    // 2. CHECK OUTBOX
                    let restored = false;
                    if (!viewOnly) {
                        try {
                            const drafts = await getOutbox();
                            const draft = drafts.find(d => d.type === 'SCHOOL_RESOURCES');
                            if (draft) {
                                console.log("Restored draft from Outbox");
                                setFormData({ ...defaultFormData, ...draft.payload });
                                if (draft.payload.spaces) setSpaces(draft.payload.spaces); // Restore spaces
                                setIsLocked(false);
                                restored = true;
                                setLoading(false);
                                return; // EXIT EARLY
                            }
                        } catch (e) { console.error("Outbox check failed:", e); }
                    }


                    // 3. BACKGROUND FETCHES
                    if (!restored) {
                        let profileFetchUrl = `/api/school-by-user/${user.uid}`;
                        let resourcesFetchUrl = `/api/school-resources/${user.uid}`;

                        if (isAuditMode) {
                            profileFetchUrl = `/api/monitoring/school-detail/${auditTargetId}`;
                            resourcesFetchUrl = `/api/monitoring/school-detail/${auditTargetId}`;
                        } else if ((viewOnly || isCORole) && schoolIdParam) {
                            profileFetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                            resourcesFetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                        }

                        let shiftingFetchUrl = `/api/learning-modalities/${user.uid}`;
                        if (isAuditMode) {
                            shiftingFetchUrl = `/api/monitoring/school-detail/${auditTargetId}`;
                        } else if ((viewOnly || isCORole) && schoolIdParam) {
                            shiftingFetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                        }

                        // Only show loading if we didn't load from cache
                        if (!loadedFromCache) setLoading(true);

                        // Fetch All in Parallel
                        const [userDoc, profileRes, resourcesRes, shiftingRes] = await Promise.all([
                            getDoc(doc(db, "users", user.uid)).catch(() => ({ exists: () => false })),
                            fetch(profileFetchUrl).then(r => r.json()).catch(e => ({ exists: false })),
                            fetch(resourcesFetchUrl).then(r => r.json()).catch(e => ({ exists: false })),
                            fetch(shiftingFetchUrl).then(r => r.json()).catch(e => ({ exists: false }))
                        ]);

                        // Handle Role
                        if (userDoc.exists()) setUserRole(userDoc.data().role);

                        // Handle Shifting Modalities
                        if (shiftingRes.exists || (viewOnly && schoolIdParam) || isAuditMode) {
                            const dbData = ((viewOnly && schoolIdParam) || isAuditMode) ? shiftingRes : (shiftingRes.data || {});
                            // Map shift_kinder, shift_g1, etc.
                            const loadedShifts = {};
                            const LEVELS = ["kinder", "g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8", "g9", "g10", "g11", "g12"];
                            LEVELS.forEach(lvl => {
                                loadedShifts[`shift_${lvl}`] = dbData[`shift_${lvl}`] || '';
                            });
                            setShiftingData(loadedShifts);
                        }

                        // Handle Profile (Enrollment updates)
                        if (profileRes.exists || (viewOnly && schoolIdParam) || isAuditMode) {
                            const pData = ((viewOnly && schoolIdParam) || isAuditMode) ? profileRes : profileRes.data;
                            setSchoolId(pData.school_id || pData.schoolId);
                            if (pData.iern) setIern(pData.iern); // [NEW] Set IERN from fetch
                            setCurricularOffering(normalizeOffering(pData.curricular_offering || pData.curricularOffering || storedOffering));

                            const newEnrollment = {
                                gradeKinder: pData.grade_kinder || pData.kinder || 0,
                                grade1: pData.grade_1 || 0, grade2: pData.grade_2 || 0,
                                grade3: pData.grade_3 || 0, grade4: pData.grade_4 || 0,
                                grade5: pData.grade_5 || 0, grade6: pData.grade_6 || 0,
                                grade7: pData.grade_7 || 0, grade8: pData.grade_8 || 0,
                                grade9: pData.grade_9 || 0, grade10: pData.grade_10 || 0,
                                grade11: (pData.abm_11 + pData.stem_11 + pData.humss_11 + pData.gas_11 + pData.tvl_ict_11 + pData.tvl_he_11 + pData.tvl_ia_11 + pData.tvl_afa_11 + pData.arts_11 + pData.sports_11) || 0,
                                grade12: (pData.abm_12 + pData.stem_12 + pData.humss_12 + pData.gas_12 + pData.tvl_ict_12 + pData.tvl_he_12 + pData.tvl_ia_12 + pData.tvl_afa_12 + pData.arts_12 + pData.sports_12) || 0
                            };
                            setEnrollmentData(newEnrollment);

                            if (!viewOnly && pData.school_id) {
                                localStorage.setItem('schoolId', pData.school_id);
                            }

                            // [NEW] SMART MAP INITIALIZATION
                            if (pData.latitude && pData.longitude && !isNaN(pData.latitude)) {
                                const lat = parseFloat(pData.latitude);
                                const lng = parseFloat(pData.longitude);
                                setSchoolLocation({ lat, lng });
                                setMapCenter([lat, lng]);
                                console.log("Map Centered on School Profile:", lat, lng);
                            } else {
                                // Fallback: Try Device GPS
                                if (navigator.geolocation) {
                                    navigator.geolocation.getCurrentPosition(
                                        (pos) => {
                                            const { latitude, longitude } = pos.coords;
                                            setSchoolLocation({ lat: latitude, lng: longitude }); // Treat as temp school loc
                                            setMapCenter([latitude, longitude]);
                                            console.log("Map Centered on Device GPS");
                                        },
                                        (err) => console.warn("GPS Fallback failed:", err),
                                        { enableHighAccuracy: true, timeout: 5000 }
                                    );
                                }
                            }
                        }

                        // Handle Resources
                        if (resourcesRes.exists || (viewOnly && schoolIdParam) || isAuditMode) {
                            const dbData = ((viewOnly && schoolIdParam) || isAuditMode) ? resourcesRes : resourcesRes.data;

                            // Map to State
                            const loaded = {};
                            Object.keys(defaultFormData).forEach(key => {
                                loaded[key] = dbData[key] ?? (typeof defaultFormData[key] === 'string' ? '' : 0);
                            });

                            setFormData(loaded);
                            setOriginalData(loaded);

                            const hasOnlineData = Object.keys(initialFields).some(k => loaded[k]);
                            setIsLocked(hasOnlineData);

                            // Update Cache
                            localStorage.setItem(CACHE_KEY_RES, JSON.stringify(loaded));

                            // Fetch Buildable Spaces if applicable
                            // Use dbData (current scope) or fallback IDs
                            const resolvedSchoolId = dbData.school_id || schoolIdParam || auditTargetId || localStorage.getItem('schoolId');
                            if (loaded.res_buildable_space === 'Yes' && resolvedSchoolId) {
                                try {
                                    const spacesRes = await fetch(`/api/buildable-spaces/${resolvedSchoolId}`);
                                    if (spacesRes.ok) {
                                        const spacesData = await spacesRes.json();
                                        const mappedSpaces = spacesData.map(s => ({
                                            id: s.space_id,
                                            lat: parseFloat(s.latitude),
                                            lng: parseFloat(s.longitude),
                                            length: parseFloat(s.length),
                                            width: parseFloat(s.width),
                                            area: parseFloat(s.total_area)
                                        }));
                                        setSpaces(mappedSpaces);
                                        // Cache Spaces
                                        localStorage.setItem(`CACHE_SPACES_${user.uid}`, JSON.stringify(mappedSpaces));
                                    }
                                } catch (e) {
                                    console.error("Failed to load spaces", e);
                                }
                            }

                            // Fetch e-Cart Batches
                            if (resolvedSchoolId) {
                                try {
                                    const ecartRes = await fetch(`/api/ecart-batches/${resolvedSchoolId}`);
                                    if (ecartRes.ok) {
                                        const ecartData = await ecartRes.json();
                                        if (ecartData.length > 0) {
                                            setEcartBatches(ecartData.map(b => ({
                                                batch_no: b.batch_no || '',
                                                year_received: b.year_received || '',
                                                source_fund: b.source_fund || '',
                                                ecart_qty_laptops: b.ecart_qty_laptops || 0,
                                                ecart_condition_laptops: b.ecart_condition_laptops || '',
                                                ecart_has_smart_tv: !!b.ecart_has_smart_tv,
                                                ecart_tv_size: b.ecart_tv_size || '',
                                                ecart_condition_tv: b.ecart_condition_tv || '',
                                                ecart_condition_charging: b.ecart_condition_charging || '',
                                                ecart_condition_cabinet: b.ecart_condition_cabinet || ''
                                            })));
                                        }
                                    }
                                } catch (e) {
                                    console.error("Failed to load e-Cart batches", e);
                                }
                            }
                        }
                    }

                } catch (error) {
                    console.error("Fetch Error:", error);
                    if (!loadedFromCache) {
                        const CACHE_KEY_RES = `CACHE_RESOURCES_${user.uid}`;
                        const cached = localStorage.getItem(CACHE_KEY_RES);
                        if (cached) {
                            try {
                                const data = JSON.parse(cached);
                                setFormData(data);
                                setOriginalData(data);
                                const hasOfflineData = Object.keys(initialFields).some(k => data[k]);
                                setIsLocked(hasOfflineData);

                                // Load Spaces Draft from IndexedDB (Priority over cache)
                                try {
                                    const drafts = await getSpaceDrafts(user.uid);
                                    if (drafts && drafts.length > 0) {
                                        setSpaces(drafts);
                                        console.log("Loaded spaces from IndexedDB Drafts");
                                    } else {
                                        // Fallback to localStorage if no IDB draft
                                        const cachedSpaces = localStorage.getItem(`CACHE_SPACES_${user.uid}`);
                                        if (cachedSpaces) {
                                            setSpaces(JSON.parse(cachedSpaces));
                                        }
                                    }
                                } catch (e) { console.error("Failed to load space drafts", e); }
                            } catch (e) { }
                        }
                    }
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);


    const handleChange = (e) => {
        const { name, value, type } = e.target;

        // Check if one of the known non-numeric fields
        const isStringField = ['res_water_source', 'res_electricity_source', 'res_buildable_space', 'sha_category'].includes(name);

        if (isStringField) {
            setFormData(prev => ({ ...prev, [name]: value }));
            return;
        }

        // 1. Strip non-numeric characters
        const cleanValue = value.replace(/[^0-9]/g, '');
        // 2. Parse integer to remove leading zeros (or default to 0 if empty)
        // 2. Parse integer to remove leading zeros (or default to 0 if empty)
        // Allow empty string '' temporarily, otherwise parse Int
        const intValue = cleanValue === '' ? '' : parseInt(cleanValue, 10);

        setFormData(prev => ({ ...prev, [name]: intValue }));
    };

    useEffect(() => {
        // Debugging: Log formData to check if res_buildable_space is populated
        console.log("FormData Snapshot:", formData);
    }, [formData]);

    // --- SAVE LOGIC ---
    // --- VALIDATION ---
    const isFormValid = () => {
        const isValidEntry = (value) => value !== '' && value !== null && value !== undefined;
        // 1. Check Generic Inputs (Labs + Dropdowns)
        const genericFields = [
            // Labs (Numeric)
            'res_sci_labs', 'res_com_labs', 'res_tvl_workshops',
            // Dropdowns (Strict Check)
            'res_water_source', 'res_electricity_source', 'res_buildable_space', 'sha_category'
        ];

        for (const f of genericFields) {
            // Strict check: must not be empty string (for dropdowns) or null/undefined
            if (!isValidEntry(formData[f])) return false;
        }

        // 2. Check Toilets (Removed legacy validation)

        // 3. Check Seats (Conditional)
        if (showElem()) {
            if (!isValidEntry(formData.seats_kinder) || !isValidEntry(formData.seats_grade_1) || !isValidEntry(formData.seats_grade_2) ||
                !isValidEntry(formData.seats_grade_3) || !isValidEntry(formData.seats_grade_4) || !isValidEntry(formData.seats_grade_5) ||
                !isValidEntry(formData.seats_grade_6)) return false;
        }
        if (showJHS()) {
            if (!isValidEntry(formData.seats_grade_7) || !isValidEntry(formData.seats_grade_8) || !isValidEntry(formData.seats_grade_9) ||
                !isValidEntry(formData.seats_grade_10)) return false;
        }
        if (showSHS()) {
            if (!isValidEntry(formData.seats_grade_11) || !isValidEntry(formData.seats_grade_12)) return false;
        }

        return true;
    };

    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);

        const rawPayload = {
            schoolId: schoolId || localStorage.getItem('schoolId'),
            uid: auth.currentUser.uid,
            ...formData,
            spaces: formData.res_buildable_space === 'Yes' ? spaces : [], // Include spaces
            ecartBatches: ecartBatches // Include e-Cart batches
        };

        // Sanitize Payload: Convert empty strings to 0 for numeric fields
        // Define fields that are ALLOWED to be strings (nullable in DB or handled by valueOrNull)
        const stringFields = [
            'res_water_source', 'res_electricity_source',
            'res_buildable_space', 'sha_category',
            'schoolId', 'uid'
        ];
        const skipFields = ['spaces', 'ecartBatches']; // Complex types handled by backend separately

        const payload = {};
        Object.keys(rawPayload).forEach(key => {
            if (skipFields.includes(key)) return; // Skip complex types
            if (stringFields.includes(key)) {
                payload[key] = rawPayload[key];
            } else {
                // Numeric fields: Convert '' -> 0
                const val = rawPayload[key];
                payload[key] = (val === '' || val === null || val === undefined) ? 0 : val;
            }
        });
        // Re-attach complex fields
        payload.spaces = rawPayload.spaces;
        payload.ecartBatches = rawPayload.ecartBatches;
        payload.iern = iern || schoolId || localStorage.getItem('schoolId'); // Use IERN state first

        if (!payload.schoolId) {
            alert("Error: School ID is missing. Please ensure your profile is loaded.");
            setIsSaving(false);
            return;
        }

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
                if (auth.currentUser) clearSpaceDrafts(auth.currentUser.uid).catch(console.error);
            } else {
                const errorData = await res.json();
                alert(`Server Error: ${errorData.error || errorData.message || "Update failed"}`);
                // Do not fallback to offline for server logic errors
            }
        } catch (e) {
            console.error(e);
            // Only fallback to offline for network errors
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
        if (auth.currentUser) clearSpaceDrafts(auth.currentUser.uid).catch(console.error);
        setShowOfflineModal(true);
        setOriginalData({ ...formData });
        setIsLocked(true);
        setIsSaving(false);
    };

    // --- COMPONENTS EXTRACTED ABOVE ---

    // VISIBILITY Helpers
    // VISIBILITY Helpers (Case Insensitive)
    const getOfferingLower = () => curricularOffering?.toLowerCase() || '';
    const isPermissive = () => {
        const off = getOfferingLower();
        return !off || off.includes('no curricular');
    };
    const showElem = () => {
        const off = getOfferingLower();
        return off.includes("elementary") || off.includes("k-12") || off.includes("k-10") || isPermissive();
    };
    const showJHS = () => {
        const off = getOfferingLower();
        return off.includes("junior") || off.includes("secondary") || off.includes("k-12") || off.includes("k-10") || isPermissive();
    };
    const showSHS = () => {
        const off = getOfferingLower();
        return off.includes("senior") || off.includes("secondary") || off.includes("k-12") || isPermissive();
    };

    // LoadingScreen check removed

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
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-bold text-white tracking-tight">School Resources</h1>
                                </div>
                                <p className="text-blue-100 text-xs font-medium mt-1">
                                    Q: What is the current inventory status of school facilities, equipment, and utilities?
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setShowInfoModal(true)} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                            <FiHelpCircle size={24} />
                        </button>
                    </div>
                </div>
            )}

            <div className={`px-5 relative z-20 max-w-4xl mx-auto space-y-6 ${embedded ? '' : '-mt-12'}`}>

                {/* EQUIPMENT & INVENTORY */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <FiPackage size={20} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-slate-800 font-bold text-lg">Equipment & Inventory</h2>
                            <p className="text-xs text-slate-400 font-medium">Assets status audit</p>
                        </div>
                        {ecartBatches.length > 0 && (
                            <div className="text-right">
                                <p className="text-lg font-extrabold text-indigo-600">{ecartBatches.reduce((sum, b) => sum + (parseInt(b.ecart_qty_laptops) || 0), 0)}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">e-Cart Laptops</p>
                            </div>
                        )}
                    </div>

                    {/* Functional / Non-Functional Table */}
                    <div className="overflow-hidden rounded-2xl border border-slate-100 mb-6 shadow-sm">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="py-4 px-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-1/3">Item</th>
                                    <th className="py-4 px-2 text-center text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Functional</th>
                                    <th className="py-4 px-2 text-center text-[10px] font-bold text-rose-500 uppercase tracking-wider">Non-Functional</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 bg-white">

                                <ResourceAuditRow label="Laptop" funcName="res_laptop_func" nonFuncName="res_laptop_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                <ResourceAuditRow label="TV / Smart TV" funcName="res_tv_func" nonFuncName="res_tv_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                <ResourceAuditRow label="Printers" funcName="res_printer_func" nonFuncName="res_printer_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                <ResourceAuditRow label="Desks" funcName="res_desk_func" nonFuncName="res_desk_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                <ResourceAuditRow label="Arm Chairs" funcName="res_armchair_func" nonFuncName="res_armchair_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />

                                <ResourceAuditRow label="Hand Washing Stn" funcName="res_handwash_func" nonFuncName="res_handwash_nonfunc" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                            </tbody>
                        </table>
                    </div>

                    {/* E-CART BATCHES SECTION */}
                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">e-Cart Batches</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">Track multiple e-Cart deliveries by batch</p>
                            </div>
                            {!isLocked && !viewOnly && !isReadOnly && (
                                <button
                                    onClick={() => {
                                        setCurrentEcart({ ...ECART_TEMPLATE });
                                        setEditingEcartIdx(null);
                                        setShowEcartModal(true);
                                    }}
                                    className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-bold px-4 py-2 rounded-xl shadow-sm transition-all active:scale-95"
                                >
                                    <FiPlus size={14} /> Add Batch
                                </button>
                            )}
                        </div>

                        {ecartBatches.length === 0 && (
                            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <FiMonitor className="mx-auto text-slate-300 mb-2" size={28} />
                                <p className="text-xs text-slate-400 font-medium">No e-Carts recorded yet.</p>
                                {!isLocked && !viewOnly && !isReadOnly && (
                                    <p className="text-[10px] text-slate-400 mt-1">Click <b>+ Add Batch</b> to add.</p>
                                )}
                            </div>
                        )}

                        {/* Resource Cards */}
                        <div className="space-y-3">
                            {ecartBatches.map((batch, idx) => {
                                const COND_STYLES = {
                                    'Good': { cls: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: '✅' },
                                    'Needs Repair': { cls: 'bg-amber-50 text-amber-600 border-amber-200', icon: '🔧' },
                                    'For Replacement': { cls: 'bg-rose-50 text-rose-600 border-rose-200', icon: '🔄' }
                                };
                                const cond = COND_STYLES[batch.ecart_condition_laptops] || COND_STYLES['Good'];
                                return (
                                    <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                        {/* Card Header */}
                                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2.5 flex items-center justify-between">
                                            <span className="text-white text-xs font-bold tracking-wide">e-Cart — {batch.batch_no || `Batch ${idx + 1}`}</span>
                                            {!isLocked && !viewOnly && !isReadOnly && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => {
                                                            setCurrentEcart({ ...batch });
                                                            setEditingEcartIdx(idx);
                                                            setShowEcartModal(true);
                                                        }}
                                                        className="text-white/70 hover:text-white hover:bg-white/20 p-1 rounded-md transition-colors"
                                                    >
                                                        <FiTool size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEcartBatches(prev => prev.filter((_, i) => i !== idx))}
                                                        className="text-white/70 hover:text-white hover:bg-white/20 p-1 rounded-md transition-colors"
                                                    >
                                                        <FiTrash2 size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {/* Card Body */}
                                        <div className="px-4 py-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <FiMonitor className="text-indigo-400" size={16} />
                                                    <span className="text-sm font-bold text-slate-800">{batch.ecart_qty_laptops || 0} Laptops</span>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${cond.cls}`}>
                                                    {cond.icon} {batch.ecart_condition_laptops || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                                {batch.source_fund && <span className="flex items-center gap-1"><FiPackage size={10} /> {batch.source_fund}</span>}
                                                {batch.year_received && <span>• Year {batch.year_received}</span>}
                                                {batch.ecart_has_smart_tv && <span>• 📺 TV {batch.ecart_tv_size || ''}</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Labs Section */}
                    <div className="space-y-2 pt-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">Specialized Rooms</p>
                        <LabRow label="Science Laboratory" name="res_sci_labs" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                        <LabRow label="Computer Laboratory" name="res_com_labs" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                        <LabRow label="TVL/TLE Workshop Lab" name="res_tvl_workshops" formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                    </div>
                </div>

                {/* SITE & UTILITIES */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                            <FiMapPin size={20} />
                        </div>
                        <div>
                            <h2 className="text-slate-800 font-bold text-lg">Site & Utilities</h2>
                            <p className="text-xs text-slate-400 font-medium">Property and basics</p>
                        </div>
                    </div>

                    <div className="grid gap-4">

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <SelectField
                                label="Electricity Source"
                                name="res_electricity_source"
                                options={["For Verification", "GRID AND OFF-GRID SUPPLY", "GRID SUPPLY", "OFF-GRID SUPPLY", "NO ELECTRICITY"]}
                                formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly}
                            />
                            <SelectField
                                label="Water Source"
                                name="res_water_source"
                                options={["For Verification", "Natural Resources", "Piped line from Local Service Provider", "No Water Source"]}
                                formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly}
                            />
                        </div>
                        <SelectField
                            label="Is there Buildable Space?"
                            name="res_buildable_space"
                            options={["Yes", "No"]}
                            formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly}
                        />

                        {formData.res_buildable_space === 'Yes' && (
                            <div className="col-span-1 sm:col-span-2 space-y-4 mt-4 border-t border-slate-100 pt-4">
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-bold text-slate-700">Manage Buildable Spaces</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowTutorial(true)}
                                        className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 transition-colors"
                                        title="Show Map Guide"
                                    >
                                        <FiHelpCircle size={18} />
                                    </button>
                                </div>

                                <MapTutorialModal
                                    isOpen={showTutorial}
                                    onClose={() => setShowTutorial(false)}
                                    onDoNotShowAgain={() => localStorage.setItem('hasSeenMapTutorial', 'true')}
                                />

                                {/* MAP */}
                                <div className="h-64 rounded-xl overflow-hidden border border-slate-200 z-0 relative">
                                    <MapContainer
                                        key={JSON.stringify(mapCenter)}
                                        center={mapCenter}
                                        zoom={schoolLocation ? 18 : 6}
                                        scrollWheelZoom={false}
                                        style={{ height: '100%', width: '100%' }}
                                    >
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        />

                                        {/* REFERENCE MARKER (School Location) */}
                                        {schoolLocation && (
                                            <Marker position={[schoolLocation.lat, schoolLocation.lng]}>
                                                <Popup>
                                                    <strong>School Location</strong><br />
                                                    Reference Point
                                                </Popup>
                                            </Marker>
                                        )}

                                        <AddMarker />

                                        {spaces.map(s => {
                                            const bounds = getBounds(s.lat, s.lng, s.length, s.width);
                                            return (
                                                <React.Fragment key={s.id}>
                                                    <Marker position={[s.lat, s.lng]}>
                                                        <Popup>
                                                            Area: {s.area} sqm<br />
                                                            {s.length}m x {s.width}m
                                                        </Popup>
                                                    </Marker>
                                                    {bounds && (
                                                        <Rectangle
                                                            bounds={bounds}
                                                            pathOptions={{ color: '#3b82f6', weight: 1, fillOpacity: 0.4 }}
                                                        />
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </MapContainer>
                                    {(!currentSpace.lat && !isLocked && !viewOnly) && (
                                        <div className="absolute top-2 right-2 bg-white/90 px-3 py-1 rounded-lg text-xs font-bold shadow-md z-[1000]">
                                            Tap map to pin location
                                        </div>
                                    )}
                                </div>

                                {/* INPUTS */}
                                {!isLocked && !viewOnly && !isReadOnly && (
                                    <div className="transition-all duration-500 ease-in-out overflow-hidden" style={{ maxHeight: currentSpace.lat ? '24rem' : '0', opacity: currentSpace.lat ? 1 : 0 }}>
                                        <div className="bg-slate-50 p-4 rounded-xl space-y-3 mt-3 border border-slate-200 shadow-sm">
                                            <div className="flex justify-between items-center">
                                                <p className="text-xs font-bold text-slate-500 uppercase">New Space Details</p>
                                                <button onClick={() => setCurrentSpace({ lat: null, lng: null, length: '', width: '', area: 0 })} className="text-[10px] text-red-400 hover:text-red-600 font-bold uppercase">
                                                    Cancel / Clear Pin
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-slate-400">Length (m)</label>
                                                    <input
                                                        type="number"
                                                        name="length"
                                                        value={currentSpace.length}
                                                        onChange={handleSpaceInput}
                                                        className="w-full p-2 rounded-lg border border-slate-200 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                        placeholder="0"
                                                        onInput={(e) => { if (e.target.value.length > 3) e.target.value = e.target.value.slice(0, 3); }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-slate-400">Width (m)</label>
                                                    <input
                                                        type="number"
                                                        name="width"
                                                        value={currentSpace.width}
                                                        onChange={handleSpaceInput}
                                                        className="w-full p-2 rounded-lg border border-slate-200 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                        placeholder="0"
                                                        onInput={(e) => { if (e.target.value.length > 3) e.target.value = e.target.value.slice(0, 3); }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-slate-400">Area (sqm)</label>
                                                    <input type="number" value={currentSpace.area} readOnly className="w-full p-2 rounded-lg border border-slate-200 bg-slate-100 font-bold text-slate-500" />
                                                </div>
                                            </div>
                                            <button
                                                onClick={addSpace}
                                                disabled={!currentSpace.length || !currentSpace.width}
                                                className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg disabled:opacity-50 hover:bg-blue-700 transition shadow-md hover:shadow-lg active:scale-95"
                                            >
                                                Add Space to List
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2 mt-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recorded Spaces ({spaces.length})</p>
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                        {spaces.map((s, idx) => (
                                            <div key={s.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100">
                                                        #{idx + 1}
                                                    </div>
                                                    <div>
                                                        <div className="flex gap-2 items-baseline">
                                                            <span className="font-bold text-slate-700 text-sm">{s.area.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">sqm</span></span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-medium block -mt-0.5">{s.length}m x {s.width}m</span>
                                                    </div>
                                                </div>
                                                {!isLocked && !viewOnly && !isReadOnly && (
                                                    <button
                                                        onClick={() => removeSpace(s.id)}
                                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                        title="Remove Space"
                                                    >
                                                        <FiXCircle size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <SelectField
                            label="SHA (Special Hardship Allowance) Category"
                            name="sha_category"
                            options={[
                                "NOT INCLUDED",
                                "HARDSHIP POST",
                                "PURE MULTIGRADE SCHOOL",
                                "HARDSHIP POST AND PURE MULTIGRADE SCHOOL"
                            ]}
                            formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly}
                        />
                    </div>
                </div>

                {/* SEAT ANALYSIS */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                            <FiLayout size={20} />
                        </div>
                        <div>
                            <h2 className="text-slate-800 font-bold text-lg">Furniture Analysis</h2>
                            <p className="text-xs text-slate-400 font-medium">Seat availability vs enrollment</p>
                        </div>
                    </div>

                    {/* Seat Shortage Table */}
                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="py-4 px-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grade</th>
                                    <th className="py-4 px-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enrollment</th>
                                    <th className="py-4 px-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seats</th>
                                    <th className="py-4 px-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shortage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 bg-white">
                                {showElem() && (
                                    <>
                                        <>
                                            <SeatRow label="Kinder" enrollment={enrollmentData.gradeKinder || 0} seatKey="seats_kinder" shiftModality={shiftingData.shift_kinder} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 1" enrollment={enrollmentData.grade1 || 0} seatKey="seats_grade_1" shiftModality={shiftingData.shift_g1} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 2" enrollment={enrollmentData.grade2 || 0} seatKey="seats_grade_2" shiftModality={shiftingData.shift_g2} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 3" enrollment={enrollmentData.grade3 || 0} seatKey="seats_grade_3" shiftModality={shiftingData.shift_g3} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 4" enrollment={enrollmentData.grade4 || 0} seatKey="seats_grade_4" shiftModality={shiftingData.shift_g4} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 5" enrollment={enrollmentData.grade5 || 0} seatKey="seats_grade_5" shiftModality={shiftingData.shift_g5} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 6" enrollment={enrollmentData.grade6 || 0} seatKey="seats_grade_6" shiftModality={shiftingData.shift_g6} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                        </>
                                    </>
                                )}
                                {showJHS() && (
                                    <>
                                        <>
                                            <SeatRow label="Grade 7" enrollment={enrollmentData.grade7 || 0} seatKey="seats_grade_7" shiftModality={shiftingData.shift_g7} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 8" enrollment={enrollmentData.grade8 || 0} seatKey="seats_grade_8" shiftModality={shiftingData.shift_g8} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 9" enrollment={enrollmentData.grade9 || 0} seatKey="seats_grade_9" shiftModality={shiftingData.shift_g9} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 10" enrollment={enrollmentData.grade10 || 0} seatKey="seats_grade_10" shiftModality={shiftingData.shift_g10} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                        </>
                                    </>
                                )}
                                {showSHS() && (
                                    <>
                                        <>
                                            <SeatRow label="Grade 11" enrollment={enrollmentData.grade11 || 0} seatKey="seats_grade_11" shiftModality={shiftingData.shift_g11} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                            <SeatRow label="Grade 12" enrollment={enrollmentData.grade12 || 0} seatKey="seats_grade_12" shiftModality={shiftingData.shift_g12} formData={formData} handleChange={handleChange} isLocked={isLocked} viewOnly={viewOnly} />
                                        </>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SANITATION & COMFORT ROOMS */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                            <FiDroplet size={20} />
                        </div>
                        <div>
                            <h2 className="text-slate-800 font-bold text-lg">Toilet &amp; Sanitation</h2>
                            <p className="text-[10px] text-slate-400 font-medium">Fixture Count</p>
                        </div>
                    </div>
                    <p className="text-[10px] text-teal-600 bg-teal-50 rounded-xl px-3 py-2 mb-5 font-medium border border-teal-100">
                        ℹ️ Please count the individual fixtures (bowls/urinals), <strong>NOT</strong> the number of rooms.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {/* Female Toilets */}
                        <div className="bg-pink-50/60 border border-pink-100 rounded-2xl p-4">
                            <p className="text-[10px] font-extrabold text-pink-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <span>🚺</span> Female Toilets
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        <FiCheckCircle size={10} /> Functional
                                    </label>
                                    <input
                                        type="number" min="0" name="female_bowls_func"
                                        value={formData.female_bowls_func ?? 0}
                                        onChange={handleChange}
                                        disabled={isLocked || viewOnly}
                                        className="w-full text-center font-bold text-emerald-700 bg-white border border-emerald-200 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 outline-none disabled:bg-transparent disabled:border-transparent shadow-sm"
                                        onFocus={() => formData.female_bowls_func === 0 && handleChange({ target: { name: 'female_bowls_func', value: '' } })}
                                        onBlur={() => (formData.female_bowls_func === '' || formData.female_bowls_func === null) && handleChange({ target: { name: 'female_bowls_func', value: 0 } })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        <FiXCircle size={10} /> Non-Functional
                                    </label>
                                    <input
                                        type="number" min="0" name="female_bowls_nonfunc"
                                        value={formData.female_bowls_nonfunc ?? 0}
                                        onChange={handleChange}
                                        disabled={isLocked || viewOnly}
                                        className="w-full text-center font-bold text-rose-600 bg-white border border-rose-200 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-rose-400 outline-none disabled:bg-transparent disabled:border-transparent shadow-sm"
                                        onFocus={() => formData.female_bowls_nonfunc === 0 && handleChange({ target: { name: 'female_bowls_nonfunc', value: '' } })}
                                        onBlur={() => (formData.female_bowls_nonfunc === '' || formData.female_bowls_nonfunc === null) && handleChange({ target: { name: 'female_bowls_nonfunc', value: 0 } })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Male Toilets (Bowls) */}
                        <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4">
                            <p className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <span>🚹</span> Male Toilets (Bowls)
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        <FiCheckCircle size={10} /> Functional
                                    </label>
                                    <input
                                        type="number" min="0" name="male_bowls_func"
                                        value={formData.male_bowls_func ?? 0}
                                        onChange={handleChange}
                                        disabled={isLocked || viewOnly}
                                        className="w-full text-center font-bold text-emerald-700 bg-white border border-emerald-200 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 outline-none disabled:bg-transparent disabled:border-transparent shadow-sm"
                                        onFocus={() => formData.male_bowls_func === 0 && handleChange({ target: { name: 'male_bowls_func', value: '' } })}
                                        onBlur={() => (formData.male_bowls_func === '' || formData.male_bowls_func === null) && handleChange({ target: { name: 'male_bowls_func', value: 0 } })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        <FiXCircle size={10} /> Non-Functional
                                    </label>
                                    <input
                                        type="number" min="0" name="male_bowls_nonfunc"
                                        value={formData.male_bowls_nonfunc ?? 0}
                                        onChange={handleChange}
                                        disabled={isLocked || viewOnly}
                                        className="w-full text-center font-bold text-rose-600 bg-white border border-rose-200 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-rose-400 outline-none disabled:bg-transparent disabled:border-transparent shadow-sm"
                                        onFocus={() => formData.male_bowls_nonfunc === 0 && handleChange({ target: { name: 'male_bowls_nonfunc', value: '' } })}
                                        onBlur={() => (formData.male_bowls_nonfunc === '' || formData.male_bowls_nonfunc === null) && handleChange({ target: { name: 'male_bowls_nonfunc', value: 0 } })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Male Urinals */}
                        <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-4">
                            <p className="text-[10px] font-extrabold text-sky-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <span>🚹</span> Male Urinals
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        <FiCheckCircle size={10} /> Functional
                                    </label>
                                    <input
                                        type="number" min="0" name="male_urinals_func"
                                        value={formData.male_urinals_func ?? 0}
                                        onChange={handleChange}
                                        disabled={isLocked || viewOnly}
                                        className="w-full text-center font-bold text-emerald-700 bg-white border border-emerald-200 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 outline-none disabled:bg-transparent disabled:border-transparent shadow-sm"
                                        onFocus={() => formData.male_urinals_func === 0 && handleChange({ target: { name: 'male_urinals_func', value: '' } })}
                                        onBlur={() => (formData.male_urinals_func === '' || formData.male_urinals_func === null) && handleChange({ target: { name: 'male_urinals_func', value: 0 } })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        <FiXCircle size={10} /> Non-Functional
                                    </label>
                                    <input
                                        type="number" min="0" name="male_urinals_nonfunc"
                                        value={formData.male_urinals_nonfunc ?? 0}
                                        onChange={handleChange}
                                        disabled={isLocked || viewOnly}
                                        className="w-full text-center font-bold text-rose-600 bg-white border border-rose-200 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-rose-400 outline-none disabled:bg-transparent disabled:border-transparent shadow-sm"
                                        onFocus={() => formData.male_urinals_nonfunc === 0 && handleChange({ target: { name: 'male_urinals_nonfunc', value: '' } })}
                                        onBlur={() => (formData.male_urinals_nonfunc === '' || formData.male_urinals_nonfunc === null) && handleChange({ target: { name: 'male_urinals_nonfunc', value: 0 } })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* PWD Toilets */}
                        <div className="bg-violet-50/60 border border-violet-100 rounded-2xl p-4">
                            <p className="text-[10px] font-extrabold text-violet-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <span>♿</span> PWD Toilets
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        <FiCheckCircle size={10} /> Functional
                                    </label>
                                    <input
                                        type="number" min="0" name="pwd_bowls_func"
                                        value={formData.pwd_bowls_func ?? 0}
                                        onChange={handleChange}
                                        disabled={isLocked || viewOnly}
                                        className="w-full text-center font-bold text-emerald-700 bg-white border border-emerald-200 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 outline-none disabled:bg-transparent disabled:border-transparent shadow-sm"
                                        onFocus={() => formData.pwd_bowls_func === 0 && handleChange({ target: { name: 'pwd_bowls_func', value: '' } })}
                                        onBlur={() => (formData.pwd_bowls_func === '' || formData.pwd_bowls_func === null) && handleChange({ target: { name: 'pwd_bowls_func', value: 0 } })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        <FiXCircle size={10} /> Non-Functional
                                    </label>
                                    <input
                                        type="number" min="0" name="pwd_bowls_nonfunc"
                                        value={formData.pwd_bowls_nonfunc ?? 0}
                                        onChange={handleChange}
                                        disabled={isLocked || viewOnly}
                                        className="w-full text-center font-bold text-rose-600 bg-white border border-rose-200 rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-rose-400 outline-none disabled:bg-transparent disabled:border-transparent shadow-sm"
                                        onFocus={() => formData.pwd_bowls_nonfunc === 0 && handleChange({ target: { name: 'pwd_bowls_nonfunc', value: '' } })}
                                        onBlur={() => (formData.pwd_bowls_nonfunc === '' || formData.pwd_bowls_nonfunc === null) && handleChange({ target: { name: 'pwd_bowls_nonfunc', value: 0 } })}
                                    />
                                </div>
                            </div>
                        </div>

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
                            <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-1 bg-[#004A99] text-white font-bold py-4 rounded-2xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
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

            {/* Modals for Edit/Save */}
            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
                        <h3 className="font-bold text-xl text-slate-800 mb-2">Enable Editing?</h3>
                        <p className="text-slate-500 text-sm mb-6">This allows you to modify the school resources data.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={() => { setIsLocked(false); setShowEditModal(false); }} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-colors">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {/* E-CART ENTRY MODAL */}
            {showEcartModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center" onClick={(e) => e.target === e.currentTarget && setShowEcartModal(false)}>
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white z-10 px-6 pt-5 pb-3 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-lg text-slate-800">{editingEcartIdx !== null ? 'Edit' : 'Add'} e-Cart Batch</h3>
                                <button onClick={() => setShowEcartModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">&times;</button>
                            </div>
                        </div>

                        <div className="px-6 py-4 space-y-5">

                            {/* ─── SECTION 1: ACQUISITION ─── */}
                            <div>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <FiPackage size={12} /> Acquisition
                                </p>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Batch No. <span className="text-rose-400">*</span></label>
                                        <input type="text" placeholder="e.g. Batch 40" value={currentEcart.batch_no}
                                            onChange={(e) => setCurrentEcart(prev => ({ ...prev, batch_no: e.target.value }))}
                                            className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Year Received</label>
                                        <input type="text" inputMode="numeric" placeholder="e.g. 2024" value={currentEcart.year_received}
                                            onChange={(e) => setCurrentEcart(prev => ({ ...prev, year_received: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) }))}
                                            className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Source of Fund</label>
                                    <select value={currentEcart.source_fund}
                                        onChange={(e) => setCurrentEcart(prev => ({ ...prev, source_fund: e.target.value }))}
                                        className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none">
                                        <option value="DepEd Central">DepEd Central</option>
                                        <option value="LGU">LGU</option>
                                        <option value="SEF">SEF</option>
                                        <option value="Private Donor">Private Donor</option>
                                    </select>
                                </div>
                            </div>

                            {/* ─── SECTION 2: LAPTOPS ─── */}
                            <div className="pt-2 border-t border-slate-100">
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <FiMonitor size={12} /> Laptops
                                </p>
                                <div className="mb-3">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantity <span className="text-rose-400">*</span></label>
                                    <input type="text" inputMode="numeric" placeholder="Number of laptops" value={currentEcart.ecart_qty_laptops}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            setCurrentEcart(prev => ({ ...prev, ecart_qty_laptops: val }));
                                        }}
                                        className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Condition</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Good', 'Needs Repair', 'For Replacement'].map(opt => (
                                            <button key={opt}
                                                onClick={() => setCurrentEcart(prev => ({ ...prev, ecart_condition_laptops: opt }))}
                                                className={`py-2.5 px-2 rounded-xl text-[11px] font-bold transition-all border ${currentEcart.ecart_condition_laptops === opt
                                                    ? opt === 'Good' ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                                        : opt === 'Needs Repair' ? 'bg-amber-50 border-amber-300 text-amber-700'
                                                            : 'bg-rose-50 border-rose-300 text-rose-700'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                                    }`}>
                                                {opt === 'Good' ? '✅ Good' : opt === 'Needs Repair' ? '🔧 Repair' : '🔄 Replace'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* ─── SECTION 3: MULTIMEDIA & POWER ─── */}
                            <div className="pt-2 border-t border-slate-100">
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <FiZap size={12} /> Multimedia & Power
                                </p>

                                {/* Smart TV Checkbox */}
                                <label className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 mb-3 cursor-pointer">
                                    <input type="checkbox" checked={currentEcart.ecart_has_smart_tv}
                                        onChange={(e) => setCurrentEcart(prev => ({ ...prev, ecart_has_smart_tv: e.target.checked, ecart_tv_size: e.target.checked ? prev.ecart_tv_size : '', ecart_condition_tv: e.target.checked ? prev.ecart_condition_tv : '' }))}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm font-medium text-slate-700">Includes Smart TV</span>
                                </label>

                                {/* Conditional TV Fields */}
                                {currentEcart.ecart_has_smart_tv && (
                                    <div className="grid grid-cols-2 gap-3 mb-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">TV Size</label>
                                            <input type="text" placeholder="e.g. 55-inch" value={currentEcart.ecart_tv_size}
                                                onChange={(e) => setCurrentEcart(prev => ({ ...prev, ecart_tv_size: e.target.value }))}
                                                className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">TV Condition</label>
                                            <select value={currentEcart.ecart_condition_tv}
                                                onChange={(e) => setCurrentEcart(prev => ({ ...prev, ecart_condition_tv: e.target.value }))}
                                                className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none">
                                                <option value="">-- Select --</option>
                                                <option value="Functional">Functional</option>
                                                <option value="Defective">Defective</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* Cabinet & Charging */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Charging Station</label>
                                        <select value={currentEcart.ecart_condition_charging}
                                            onChange={(e) => setCurrentEcart(prev => ({ ...prev, ecart_condition_charging: e.target.value }))}
                                            className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none">
                                            <option value="">-- Select --</option>
                                            <option value="Functional">Functional</option>
                                            <option value="Defective">Defective</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cabinet</label>
                                        <select value={currentEcart.ecart_condition_cabinet}
                                            onChange={(e) => setCurrentEcart(prev => ({ ...prev, ecart_condition_cabinet: e.target.value }))}
                                            className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none">
                                            <option value="">-- Select --</option>
                                            <option value="Secure">Secure</option>
                                            <option value="Broken Lock">Broken Lock</option>
                                            <option value="Damaged Wheels">Damaged Wheels</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3">
                            <button onClick={() => setShowEcartModal(false)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                                Cancel
                            </button>
                            <button
                                disabled={!currentEcart.batch_no.trim() || !currentEcart.ecart_qty_laptops}
                                onClick={() => {
                                    const entry = { ...currentEcart, ecart_qty_laptops: parseInt(currentEcart.ecart_qty_laptops) || 0 };
                                    if (editingEcartIdx !== null) {
                                        setEcartBatches(prev => prev.map((b, i) => i === editingEcartIdx ? entry : b));
                                    } else {
                                        setEcartBatches(prev => [...prev, entry]);
                                    }
                                    setShowEcartModal(false);
                                }}
                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                {editingEcartIdx !== null ? 'Update Batch' : 'Add Batch'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <FiCheckCircle size={24} />
                        </div>
                        <h3 className="font-bold text-xl text-slate-800 text-center mb-2">Save Changes?</h3>
                        <p className="text-slate-500 text-center text-sm mb-6">You are about to update the school resources record.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={confirmSave} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-colors">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {showInfoModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-blue-600 text-2xl">
                            <FiInfo />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 text-center">Form Guide</h3>
                        <p className="text-sm text-slate-500 mt-2 mb-6 text-center">This form is answering the question: <b>'What is the current inventory status of school facilities, equipment, and utilities?'</b><br /><br />Please count <b>TOILET SEATS / BOWLS</b>, not the number of rooms or doors.</p>
                        <button onClick={() => setShowInfoModal(false)} className="w-full py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition-transform active:scale-95">Got it</button>
                    </div>
                </div>
            )}

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="School Resources updated successfully!" />


        </div>
    );
};

export default SchoolResources;