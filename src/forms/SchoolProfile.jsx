import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse'; 
import { auth } from '../firebase'; 
import { onAuthStateChanged } from "firebase/auth";
import locationData from '../locations.json'; 
import LoadingScreen from '../components/LoadingScreen'; 

const SchoolProfile = () => {
    const navigate = useNavigate();
    
    // --- STATE MANAGEMENT ---
    const [loading, setLoading] = useState(true); 
    const [isSaving, setIsSaving] = useState(false);
    
    // Mode States
    const [isLocked, setIsLocked] = useState(false); 
    const [hasSavedData, setHasSavedData] = useState(false); 
    
    // Timestamp State
    const [lastUpdated, setLastUpdated] = useState(null);

    // Modals
    const [showSaveModal, setShowSaveModal] = useState(false); 
    const [showEditModal, setShowEditModal] = useState(false); 
    const [isChecked, setIsChecked] = useState(false); 
    const [editAgreement, setEditAgreement] = useState(false); 

    // Dropdown Data
    const [provinceOptions, setProvinceOptions] = useState([]);
    const [cityOptions, setCityOptions] = useState([]);
    const [barangayOptions, setBarangayOptions] = useState([]);
    const [divisionOptions, setDivisionOptions] = useState([]); 
    const [districtOptions, setDistrictOptions] = useState([]); 
    const [legDistrictOptions, setLegDistrictOptions] = useState([]);
    
    // Maps (Data Relationships)
    const [districtMap, setDistrictMap] = useState({}); 
    const [regionDivMap, setRegionDivMap] = useState({}); 

    // Form Data
    const [formData, setFormData] = useState({
        schoolId: '', schoolName: '', 
        region: '', province: '', municipality: '', barangay: '', 
        division: '', district: '', legDistrict: '', 
        motherSchoolId: '', latitude: '', longitude: ''
    });

    const [originalData, setOriginalData] = useState(null);
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

    // --- 1. INITIAL LOAD LOGIC ---
    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            // A. LOAD CSV & BUILD MAPS
            const csvMaps = await new Promise((resolve) => {
                Papa.parse('/schools.csv', {
                    download: true, header: true, skipEmptyLines: true,
                    complete: (results) => {
                        if (!isMounted) return;
                        const rows = results.data;
                        const tempRegDiv = {}; const tempDivDist = {}; const tempLegs = new Set();

                        if (rows && rows.length > 0) {
                            const headers = Object.keys(rows[0]);
                            const clean = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
                            
                            const regKey = headers.find(h => clean(h) === 'region');
                            const divKey = headers.find(h => clean(h) === 'division');
                            const distKey = headers.find(h => clean(h) === 'district'); 
                            const legKey = headers.find(h => clean(h).includes('legislative') || clean(h) === 'legdistrict');

                            rows.forEach(row => {
                                const reg = regKey ? row[regKey]?.trim() : null;
                                const div = divKey ? row[divKey]?.trim() : null;
                                const dist = distKey ? row[distKey]?.trim() : null;
                                const leg = legKey ? row[legKey]?.trim() : null;

                                if (reg && div) { if (!tempRegDiv[reg]) tempRegDiv[reg] = new Set(); tempRegDiv[reg].add(div); }
                                if (div && dist) { if (!tempDivDist[div]) tempDivDist[div] = new Set(); tempDivDist[div].add(dist); }
                                if (leg) tempLegs.add(leg);
                            });

                            const processedRegDiv = {}; Object.keys(tempRegDiv).forEach(k => processedRegDiv[k] = Array.from(tempRegDiv[k]).sort());
                            const processedDivDist = {}; Object.keys(tempDivDist).forEach(k => processedDivDist[k] = Array.from(tempDivDist[k]).sort());

                            setRegionDivMap(processedRegDiv);
                            setDistrictMap(processedDivDist);
                            setLegDistrictOptions(Array.from(tempLegs).sort());
                            resolve({ regDiv: processedRegDiv, divDist: processedDivDist });
                        } else { resolve({ regDiv: {}, divDist: {} }); }
                    }
                });
            });

            // B. CHECK DATABASE
            onAuthStateChanged(auth, async (user) => {
                if (!isMounted) return;
                
                if (user) {
                    try {
                        const response = await fetch(`http://localhost:3000/api/school-by-user/${user.uid}`);
                        const result = await response.json();
                        
                        if (result.exists) {
                            const dbData = result.data;
                            
                            if (locationData[dbData.region]) setProvinceOptions(Object.keys(locationData[dbData.region]).sort());
                            if (locationData[dbData.region]?.[dbData.province]) setCityOptions(Object.keys(locationData[dbData.region][dbData.province]).sort());
                            if (locationData[dbData.region]?.[dbData.province]?.[dbData.municipality]) setBarangayOptions(locationData[dbData.region][dbData.province][dbData.municipality].sort());

                            if (dbData.region && csvMaps.regDiv[dbData.region]) setDivisionOptions(csvMaps.regDiv[dbData.region]);
                            if (dbData.division && csvMaps.divDist[dbData.division]) setDistrictOptions(csvMaps.divDist[dbData.division]);

                            const loadedData = {
                                schoolId: dbData.school_id, schoolName: dbData.school_name,
                                region: dbData.region, province: dbData.province, municipality: dbData.municipality, barangay: dbData.barangay,
                                division: dbData.division, district: dbData.district, legDistrict: dbData.leg_district,
                                motherSchoolId: dbData.mother_school_id, latitude: dbData.latitude, longitude: dbData.longitude
                            };

                            setFormData(loadedData);
                            setOriginalData(loadedData); 
                            setLastUpdated(dbData.submitted_at); 
                            setIsLocked(true); 
                            setHasSavedData(true);
                        }
                    } catch (error) { console.error("Auto-load failed:", error); }
                }
                setTimeout(() => { if (isMounted) setLoading(false); }, 1000); 
            });
        };

        initialize();
        return () => { isMounted = false; };
    }, []);

    // --- HANDLERS ---
    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
    const handleRegionChange = (e) => {
        const selectedRegion = e.target.value;
        const validDivisions = regionDivMap[selectedRegion] || [];
        setDivisionOptions(validDivisions);
        setFormData(prev => ({ ...prev, region: selectedRegion, province: '', municipality: '', barangay: '', division: '', district: '' }));
        setProvinceOptions(selectedRegion && locationData[selectedRegion] ? Object.keys(locationData[selectedRegion]).sort() : []);
        setCityOptions([]); setBarangayOptions([]); setDistrictOptions([]); 
    };

    const handleDivisionChange = (e) => {
        const selectedDivision = e.target.value;
        setFormData(prev => ({ ...prev, division: selectedDivision, district: '' }));
        setDistrictOptions(districtMap[selectedDivision] || []);
    };

    const handleProvinceChange = (e) => {
        const province = e.target.value;
        setFormData(prev => ({ ...prev, province, municipality: '', barangay: '' }));
        setCityOptions(province && formData.region ? Object.keys(locationData[formData.region][province]).sort() : []);
        setBarangayOptions([]);
    };

    const handleCityChange = (e) => {
        const municipality = e.target.value;
        setFormData(prev => ({ ...prev, municipality, barangay: '' }));
        setBarangayOptions(municipality && formData.province ? locationData[formData.region][formData.province][municipality].sort() : []);
    };

    // CSV Autofill
    const handleIdBlur = async () => {
        if (isLocked || hasSavedData) return; 
        const targetId = String(formData.schoolId).trim();
        if (targetId.length < 6) return; 
        
        setLoading(true);

        try {
            const response = await fetch(`http://localhost:3000/api/check-school/${targetId}`);
            if (response.ok) {
                const result = await response.json();
                if (result.exists) {
                    alert("This School ID is already registered.");
                    setFormData(prev => ({...prev, schoolId: ''})); 
                    setLoading(false);
                    return;
                }
            }
        } catch (error) { console.warn("DB Check skipped."); }

        Papa.parse('/schools.csv', {
            download: true, header: true, skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data;
                const headers = Object.keys(rows[0] || {});
                const clean = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
                const idKey = headers.find(h => clean(h) === 'schoolid');

                if (idKey) {
                    const school = rows.find(s => String(s[idKey]).trim().split('.')[0] === targetId);
                    if (school) {
                        const getVal = (target) => {
                            const k = headers.find(h => clean(h).includes(clean(target)));
                            return k ? String(school[k]).trim() : '';
                        };
                        const findMatch = (options, value) => options.find(opt => clean(opt) === clean(value)) || value;

                        const rawRegion = getVal('region');
                        const matchedRegion = findMatch(Object.keys(locationData), rawRegion);
                        const validDivisions = regionDivMap[matchedRegion] || [];
                        setDivisionOptions(validDivisions);
                        const rawDiv = getVal('division');
                        const matchedDiv = findMatch(validDivisions, rawDiv);
                        const validDistricts = districtMap[matchedDiv] || [];
                        setDistrictOptions(validDistricts);
                        
                        let provOpts = [], matchedProv = getVal('province');
                        if (locationData[matchedRegion]) {
                            provOpts = Object.keys(locationData[matchedRegion]).sort();
                            matchedProv = findMatch(provOpts, matchedProv);
                        }
                        setProvinceOptions(provOpts);

                        let cityOpts = [], matchedMun = getVal('municipality');
                        if (locationData[matchedRegion]?.[matchedProv]) {
                            cityOpts = Object.keys(locationData[matchedRegion][matchedProv]).sort();
                            matchedMun = findMatch(cityOpts, matchedMun);
                        }
                        setCityOptions(cityOpts);

                        let brgyOpts = [], matchedBrgy = getVal('barangay');
                        if (locationData[matchedRegion]?.[matchedProv]?.[matchedMun]) {
                            brgyOpts = locationData[matchedRegion][matchedProv][matchedMun].sort();
                            matchedBrgy = findMatch(brgyOpts, matchedBrgy);
                        }
                        setBarangayOptions(brgyOpts);

                        setFormData(prev => ({
                            ...prev,
                            schoolName: getVal('schoolname'),
                            region: matchedRegion, province: matchedProv, municipality: matchedMun, barangay: matchedBrgy,
                            division: matchedDiv, district: getVal('district'), 
                            legDistrict: getVal('legdistrict') || getVal('legislative'),
                            motherSchoolId: getVal('motherschool') || '', latitude: getVal('latitude'), longitude: getVal('longitude')
                        }));
                    } else { alert("School ID not found in CSV."); }
                }
                setLoading(false);
            },
            error: (err) => { console.error(err); setLoading(false); }
        });
    };

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
    
    const confirmSave = async () => {
        setShowSaveModal(false); 
        setIsSaving(true);
        const payload = { ...formData, submittedBy: auth.currentUser.uid };
        
        try {
            const response = await fetch('http://localhost:3000/api/save-school', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            if (response.ok) {
                alert('Success: Profile updated successfully.'); 
                setLastUpdated(new Date().toISOString()); 
                setOriginalData({...formData}); 
                setIsLocked(true); 
                setHasSavedData(true);
            } else { 
                const err = await response.json(); 
                alert('Failed: ' + err.message); 
            }
        } catch (error) { alert("Error."); } finally { setIsSaving(false); }
    };

    // Styling Helpers
    const inputClass = `w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004A99] bg-white text-gray-800 font-semibold text-[14px] shadow-sm disabled:bg-gray-100 disabled:text-gray-500 transition-all`;
    const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1";
    const sectionClass = "bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6";

    if (loading) return <LoadingScreen message="Loading School Profile..." />;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-32 relative"> 
            
            {/* --- TOP HEADER (MATCHING DASHBOARD) --- */}
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white/80 hover:text-white text-2xl transition">&larr;</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">School Profile</h1>
                        <p className="text-blue-200 text-xs mt-1">
                            {lastUpdated ? `Last Updated: ${formatTimestamp(lastUpdated)}` : 'Create your school profile'}
                        </p>
                    </div>
                </div>
            </div>

            {/* --- MAIN FORM CONTENT --- */}
            <div className="px-5 -mt-12 relative z-20">
                <form onSubmit={handleSaveClick}>
                    
                    {/* SECTION 1: IDENTITY */}
                    <div className={sectionClass}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2">
                                <span className="text-xl">🏫</span> Identity
                            </h2>
                            {isLocked && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">Locked</span>}
                            {!isLocked && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider animate-pulse">Editing</span>}
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className={labelClass}>School ID (6-Digit)</label>
                                <input type="text" name="schoolId" value={formData.schoolId} onChange={handleChange} onBlur={handleIdBlur} placeholder="100001" maxLength="6" className={`${inputClass} text-center text-xl tracking-widest font-bold ${hasSavedData ? 'bg-gray-200 cursor-not-allowed' : ''}`} required disabled={isLocked || hasSavedData} />
                                {hasSavedData && <p className="text-[10px] text-gray-400 mt-1 text-center">Permanently linked to this account.</p>}
                            </div>
                            <div>
                                <label className={labelClass}>School Name</label>
                                <input type="text" name="schoolName" value={formData.schoolName} onChange={handleChange} className={inputClass} required disabled={isLocked} />
                            </div>
                            <div>
                                <label className={labelClass}>Mother School ID</label>
                                <input type="text" name="motherSchoolId" value={formData.motherSchoolId} onChange={handleChange} className={inputClass} disabled={isLocked} placeholder="If annex, enter mother school ID" />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: LOCATION */}
                    <div className={sectionClass}>
                        <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2 mb-4">
                            <span className="text-xl">📍</span> Location
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Region</label>
                                <select name="region" value={formData.region} onChange={handleRegionChange} className={inputClass} disabled={isLocked} required>
                                    <option value="">Select Region</option>
                                    {Object.keys(locationData).sort().map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Province</label>
                                <select name="province" value={formData.province} onChange={handleProvinceChange} className={inputClass} disabled={!formData.region || isLocked} required>
                                    <option value="">Select Province</option>
                                    {provinceOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Municipality / City</label>
                                <select name="municipality" value={formData.municipality} onChange={handleCityChange} className={inputClass} disabled={!formData.province || isLocked} required>
                                    <option value="">Select City/Mun</option>
                                    {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Barangay</label>
                                <select name="barangay" value={formData.barangay} onChange={handleChange} className={inputClass} disabled={!formData.municipality || isLocked} required>
                                    <option value="">Select Barangay</option>
                                    {barangayOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: HIERARCHY */}
                    <div className={sectionClass}>
                        <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2 mb-4">
                            <span className="text-xl">🏛️</span> Administration
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Division</label>
                                <select name="division" value={formData.division} onChange={handleDivisionChange} className={inputClass} disabled={!formData.region || isLocked} required>
                                    <option value="">Select Division</option>
                                    {divisionOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>District</label>
                                <select name="district" value={formData.district} onChange={handleChange} className={inputClass} disabled={!formData.division || isLocked} required>
                                    <option value="">Select District</option>
                                    {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>Legislative District</label>
                                <select name="legDistrict" value={formData.legDistrict} onChange={handleChange} className={inputClass} disabled={isLocked} required>
                                    <option value="">Select District</option>
                                    {legDistrictOptions.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: COORDINATES */}
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-6">
                        <h2 className="text-blue-800 font-bold text-sm uppercase tracking-wide mb-4">
                            🌐 Geo-Tagging
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Latitude</label>
                                <input type="text" name="latitude" value={formData.latitude} onChange={handleChange} className={inputClass} disabled={isLocked} placeholder="14.5995" />
                            </div>
                            <div>
                                <label className={labelClass}>Longitude</label>
                                <input type="text" name="longitude" value={formData.longitude} onChange={handleChange} className={inputClass} disabled={isLocked} placeholder="120.9842" />
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
                        <span>✏️</span> Unlock to Edit
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

            {/* --- MODALS (Code reused from before, kept for functionality) --- */}
            {/* EDIT WARNING */}
            {showEditModal && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg">Edit Profile?</h3><div className="mt-4 flex gap-2"><button onClick={()=>setShowEditModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button><button onClick={handleConfirmEdit} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold">Edit</button></div></div></div>}
            
            {/* SAVE CONFIRMATION */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
                        <h3 className="font-bold text-lg">Review Changes</h3>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 my-4 text-xs max-h-32 overflow-y-auto">
                            {getChanges().length > 0 ? getChanges().map((c, i) => (
                                <div key={i} className="flex justify-between border-b pb-1 mb-1 last:border-0"><span className="font-bold text-gray-500">{c.field}</span><span className="text-gray-800">{c.newVal}</span></div>
                            )) : <p className="text-gray-400 italic">No changes detected.</p>}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={()=>setShowSaveModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                            <button onClick={confirmSave} className="flex-1 py-3 bg-[#CC0000] text-white rounded-xl font-bold">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SchoolProfile;