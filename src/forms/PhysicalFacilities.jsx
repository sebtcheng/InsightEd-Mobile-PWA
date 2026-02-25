import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { addToOutbox, getOutbox, addRepairToLocal, getLocalRepairs, deleteLocalRepair } from '../db';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
import { FiChevronRight, FiEdit, FiTrash2, FiSave, FiCheckCircle, FiInfo, FiAlertCircle, FiPlus, FiArrowRight, FiFileText, FiMapPin, FiHome, FiHelpCircle, FiSearch, FiArrowLeft, FiMoreVertical, FiLayout, FiTruck, FiBox, FiArchive, FiClock, FiChevronDown } from 'react-icons/fi';
import RepairEntryModal from '../components/RepairEntryModal';
import OfflineSuccessModal from '../components/OfflineSuccessModal';
import SuccessModal from '../components/SuccessModal';
import useReadOnly from '../hooks/useReadOnly'; // Import Hook

// --- EXTRACTED COMPONENT ---
const InputCard = ({ label, name, icon, color, value, onChange, disabled }) => (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center group transition-all hover:border-blue-100">
        <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${color} bg-opacity-10 text-xl group-hover:bg-opacity-20 transition-all`}>
                {icon}
            </div>
            <div>
                <h3 className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors">{label}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Classrooms</p>
            </div>
        </div>
        <div>
            <p className="text-[9px] text-slate-400 font-medium mb-1 text-center block">Total Count</p>
            <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                name={name}
                value={value}
                onChange={(e) => onChange(name, e.target.value)}
                disabled={disabled}
                onWheel={(e) => e.target.blur()}
                className="w-24 text-center font-black text-xl bg-slate-50 border border-slate-200 rounded-xl py-3 focus:ring-4 focus:ring-blue-100 outline-none disabled:bg-transparent disabled:border-transparent text-slate-800"
                onFocus={() => value === 0 && onChange(name, '')}
                onBlur={() => (value === '' || value === null) && onChange(name, 0)}
            />
        </div>
    </div>
);

const DemolitionEntryModal = ({ isOpen, onClose, onSave, data, setData }) => {
    if (!isOpen) return null;

    const reasons = [
        { key: 'reason_age', label: 'Age / Dilapidation' },
        { key: 'reason_safety', label: 'Safety Hazard' },
        { key: 'reason_calamity', label: 'Calamity Damage' },
        { key: 'reason_upgrade', label: 'Site Upgrade / Repurposing' }
    ];

    const selectedCount = reasons.filter(r => data[r.key]).length;

    const toggleReason = (key) => {
        // if (!data[key] && selectedCount >= 2) return; // Prevent more than 2 (REMOVED LIMIT)
        setData(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">Add for Demolition</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center transition-colors">✕</button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Building Number / Name</label>
                        <input
                            type="text"
                            value={data.building_no}
                            onChange={(e) => setData({ ...data, building_no: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-red-100 focus:border-red-200 transition-all"
                            placeholder="e.g. Building 1"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Select Reasons</label>
                        {reasons.map(Reason => (
                            <div
                                key={Reason.key}
                                onClick={() => toggleReason(Reason.key)}
                                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${data[Reason.key]
                                    ? 'bg-red-50 border-red-200 shadow-sm'
                                    : 'bg-white border-slate-100 hover:border-red-200'
                                    }`}
                            >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${data[Reason.key] ? 'border-red-500 bg-red-500 text-white' : 'border-slate-300 bg-white'
                                    }`}>
                                    {data[Reason.key] && <FiCheckCircle size={12} />}
                                </div>
                                <span className={`text-sm font-bold ${data[Reason.key] ? 'text-red-700' : 'text-slate-600'}`}>{Reason.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50/50">
                    <button
                        onClick={onSave}
                        disabled={!data.building_no.trim() || selectedCount === 0}
                        className="w-full py-3.5 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        Add to List
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- BUILDING INVENTORY MODAL ---

const SearchableDropdown = ({ options, value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const dropdownRef = useRef(null);

    const filteredOptions = options.filter(option =>
        option.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 cursor-pointer flex justify-between items-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-200 transition-all"
                onClick={() => setIsOpen(!isOpen)}
                tabIndex={0}
            >
                <span className={value ? "text-slate-700" : "text-slate-400"}>
                    {value || placeholder}
                </span>
                <FiChevronDown className="text-slate-400" />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-blue-300 transition-colors"
                                placeholder="Search..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto p-1 max-h-48">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((type, index) => (
                                <div
                                    key={index}
                                    className={`px-4 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                                        value === type ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                    onClick={() => {
                                        onChange(type);
                                        setIsOpen(false);
                                        setQuery('');
                                    }}
                                >
                                    {type}
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-3 text-sm text-slate-400 text-center">No results found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const defaultInventoryData = {
    building_name: '', category: '',
    no_of_storeys: 1, no_of_classrooms: '', year_completed: '', remarks: ''
};

const BuildingInventoryModal = ({ isOpen, onClose, onSave, data, setData, statusLabel, isEditing, buildingTypes = [] }) => {
    if (!isOpen) return null;

    const canSave = data.building_name.trim() &&
        data.category !== '' &&
        data.no_of_classrooms !== '' && Number(data.no_of_classrooms) > 0;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">{isEditing ? 'Edit' : 'Add'} {statusLabel} Building</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center transition-colors">✕</button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                    {/* Building Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Building Name *</label>
                        <input type="text" value={data.building_name}
                            onChange={(e) => setData({ ...data, building_name: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-200 transition-all"
                            placeholder="e.g. Building A" autoFocus />
                    </div>

                    {/* Category Dropdown */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Category *</label>
                        <SearchableDropdown
                            options={buildingTypes}
                            value={data.category}
                            onChange={(val) => setData({ ...data, category: val })}
                            placeholder="Select Building Type"
                        />
                    </div>

                    {/* Storey & Classrooms — Side by Side */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Storeys</label>
                            <input type="number" min="1" max="999" value={data.no_of_storeys}
                                onChange={(e) => { const v = parseInt(e.target.value) || 1; setData({ ...data, no_of_storeys: Math.min(v, 999) }); }}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-200 transition-all text-center" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Classrooms *</label>
                            <input type="number" min="1" max="999" value={data.no_of_classrooms}
                                onChange={(e) => { if (e.target.value === '') { setData({ ...data, no_of_classrooms: '' }); return; } const v = parseInt(e.target.value) || 0; setData({ ...data, no_of_classrooms: Math.min(v, 999) }); }}
                                className={`w-full p-3 bg-slate-50 border rounded-xl font-bold text-slate-700 outline-none focus:ring-4 transition-all text-center ${data.no_of_classrooms === '' || Number(data.no_of_classrooms) <= 0
                                    ? 'border-red-300 focus:ring-red-100 focus:border-red-300'
                                    : 'border-slate-200 focus:ring-blue-100 focus:border-blue-200'
                                    }`}
                                placeholder="Req." />
                        </div>
                    </div>
                    {(data.no_of_classrooms === '' || Number(data.no_of_classrooms) <= 0) &&
                        <p className="text-red-500 text-xs font-semibold -mt-2">⚠️ No. of Classrooms is required</p>}

                    {/* Year Completed (Dropdown) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Year Completed</label>
                        <select value={data.year_completed}
                            onChange={(e) => setData({ ...data, year_completed: e.target.value === '' ? '' : parseInt(e.target.value) })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-200 transition-all">
                            <option value="">— Select Year —</option>
                            {Array.from({ length: new Date().getFullYear() - 1949 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Remarks</label>
                        <textarea value={data.remarks}
                            onChange={(e) => setData({ ...data, remarks: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-200 transition-all resize-none"
                            rows={2} placeholder="Optional notes..." />
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50/50">
                    <button onClick={onSave} disabled={!canSave}
                        className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:shadow-none">
                        {isEditing ? '✔ Update Building' : '+ Add Building'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PhysicalFacilities = ({ embedded }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const viewOnly = queryParams.get('viewOnly') === 'true';
    const schoolIdParam = queryParams.get('schoolId');
    const isDummy = location.state?.isDummy || false;
    const isSuperUserReadOnly = useReadOnly(); // Use Hook

    const [buildingTypes, setBuildingTypes] = useState([]);

    useEffect(() => {
        const fetchBuildingTypes = async () => {
            try {
                const res = await fetch('/api/reference/building-types');
                if (res.ok) {
                    const data = await res.json();
                    setBuildingTypes(data);
                }
            } catch (err) {
                console.error('Failed to fetch building types:', err);
            }
        };
        fetchBuildingTypes();
    }, []);

    // Super User / Audit Context
    const isSuperUser = localStorage.getItem('userRole') === 'Super User';
    const auditTargetId = sessionStorage.getItem('targetSchoolId');
    const isAuditMode = isSuperUser && !!auditTargetId;

    const [isReadOnly, setIsReadOnly] = useState(isDummy || isSuperUserReadOnly || isAuditMode);

    // Sync state if hook changes
    useEffect(() => {
        if (isSuperUserReadOnly) setIsReadOnly(true);
    }, [isSuperUserReadOnly]);

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);

    // --- FACILITY REPAIR DATA ---
    const [facilityData, setFacilityData] = useState([]); // [{ id, building_no, rooms: [{ room_no, ...booleans, remarks }] }]
    const [isSavingRepair, setIsSavingRepair] = useState(false);
    const [repairSuccessMsg, setRepairSuccessMsg] = useState('');
    const [pendingRepairCount, setPendingRepairCount] = useState(0);

    const [newBuildingName, setNewBuildingName] = useState('');
    const [buildingError, setBuildingError] = useState('');
    const [isRepairSubmitted, setIsRepairSubmitted] = useState(false);
    const [isLoadingRepairs, setIsLoadingRepairs] = useState(false);

    // --- DEMOLITION DATA ---
    const [demolitionData, setDemolitionData] = useState([]); // [{ id, building_no, reason_age... }]
    const [isSavingDemolition, setIsSavingDemolition] = useState(false);
    const [demolitionSuccessMsg, setDemolitionSuccessMsg] = useState('');
    const [showDemolitionModal, setShowDemolitionModal] = useState(false);
    const [demolitionModalData, setDemolitionModalData] = useState({
        building_no: '', reason_age: false, reason_safety: false, reason_calamity: false, reason_upgrade: false
    });
    const [isDemolitionSubmitted, setIsDemolitionSubmitted] = useState(false);
    const [isLoadingDemolitions, setIsLoadingDemolitions] = useState(false);

    // --- BUILDING INVENTORY DATA ---
    const [newlyBuiltBuildings, setNewlyBuiltBuildings] = useState([]);
    const [goodConditionBuildings, setGoodConditionBuildings] = useState([]);
    const [showInventoryModal, setShowInventoryModal] = useState(false);
    const [inventoryModalData, setInventoryModalData] = useState({ ...defaultInventoryData });
    const [inventoryModalTarget, setInventoryModalTarget] = useState('new'); // 'new' or 'good'
    const [editingInventoryIdx, setEditingInventoryIdx] = useState(null); // null = adding, number = editing index
    const [isLoadingInventory, setIsLoadingInventory] = useState(false);

    const openAddInventory = (target) => {
        setInventoryModalData({ ...defaultInventoryData });
        setInventoryModalTarget(target);
        setEditingInventoryIdx(null);
        setShowInventoryModal(true);
    };

    const openEditInventory = (target, idx) => {
        const list = target === 'new' ? newlyBuiltBuildings : goodConditionBuildings;
        setInventoryModalData({ ...list[idx] });
        setInventoryModalTarget(target);
        setEditingInventoryIdx(idx);
        setShowInventoryModal(true);
    };

    const saveInventoryFromModal = () => {
        if (editingInventoryIdx !== null) {
            // Update existing entry
            const updater = (prev) => prev.map((item, i) => i === editingInventoryIdx ? { ...inventoryModalData, id: item.id } : item);
            if (inventoryModalTarget === 'new') {
                setNewlyBuiltBuildings(updater);
            } else {
                setGoodConditionBuildings(updater);
            }
        } else {
            // Add new entry
            const entry = { ...inventoryModalData, id: Date.now() };
            if (inventoryModalTarget === 'new') {
                setNewlyBuiltBuildings(prev => [...prev, entry]);
            } else {
                setGoodConditionBuildings(prev => [...prev, entry]);
            }
        }
        setEditingInventoryIdx(null);
        setShowInventoryModal(false);
    };

    const removeInventoryBuilding = (target, idx) => {
        if (target === 'new') {
            setNewlyBuiltBuildings(prev => prev.filter((_, i) => i !== idx));
        } else {
            setGoodConditionBuildings(prev => prev.filter((_, i) => i !== idx));
        }
    };


    const repairItems = [
        { key: 'repair_roofing', label: 'Roofing', group: 'Roof' },
        { key: 'repair_purlins', label: 'Purlins', group: 'Roof' },
        { key: 'repair_trusses', label: 'Trusses', group: 'Roof' },
        { key: 'repair_ceiling_ext', label: 'Ceiling (Exterior)', group: 'Ceiling' },
        { key: 'repair_ceiling_int', label: 'Ceiling (Interior)', group: 'Ceiling' },
        { key: 'repair_wall_ext', label: 'Wall (Exterior)', group: 'Walls & Openings' },
        { key: 'repair_partition', label: 'Partition', group: 'Walls & Openings' },
        { key: 'repair_door', label: 'Door', group: 'Walls & Openings' },
        { key: 'repair_windows', label: 'Windows', group: 'Walls & Openings' },
        { key: 'repair_flooring', label: 'Flooring', group: 'Structural & Floor' },
        { key: 'repair_structural', label: 'Beams / Columns', group: 'Structural & Floor' }
    ];

    const defaultRoomData = {
        room_no: '',
        items: [] // Will contain objects: { item_name, oms, condition, damage_ratio, recommended_action, demo_justification, remarks }
    };

    // --- BUILDING CRUD ---
    const isDuplicateBuilding = newBuildingName.trim() !== '' && facilityData.some(
        b => b.building_no.toLowerCase() === newBuildingName.trim().toLowerCase()
    );

    const addBuilding = () => {
        const name = newBuildingName.trim();
        if (!name) return;
        if (facilityData.some(b => b.building_no.toLowerCase() === name.toLowerCase())) {
            setBuildingError('This building has already been added.');
            setTimeout(() => setBuildingError(''), 3000);
            return;
        }
        setBuildingError('');
        setFacilityData(prev => [...prev, { id: Date.now(), building_no: name, rooms: [] }]);
        setNewBuildingName('');
    };

    const removeBuilding = (bIdx) => {
        setFacilityData(prev => prev.filter((_, i) => i !== bIdx));
    };

    // --- REPAIR MODAL & STATE ---
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [activeBuildingIdx, setActiveBuildingIdx] = useState(null);
    const [editingRoomIdx, setEditingRoomIdx] = useState(null); // null = adding, number = editing



    const [roomModalData, setRoomModalData] = useState({ ...defaultRoomData });

    // --- OPEN MODAL FOR EDITING ---
    const openEditRoom = (bIdx, rIdx) => {
        const room = facilityData[bIdx].rooms[rIdx];
        setRoomModalData({
            ...defaultRoomData, // Ensure defaults result in valid structure
            items: [], // Reset items to empty array default
            ...room, // Overwrite with room data (which should have .items)
            // Legacy cleanup: remove old keys if present by not copying them explicitly? 
            // Spreading room might bring old keys, but that's okay, we ignore them now.
        });
        setEditingRoomIdx(rIdx);
        setActiveBuildingIdx(bIdx);
        setShowRoomModal(true);
    };

    // --- OPEN MODAL FOR ADDING NEW ROOM ---
    const openAddRoom = (bIdx) => {
        setRoomModalData({ ...defaultRoomData });
        setEditingRoomIdx(null);
        setActiveBuildingIdx(bIdx);
        setShowRoomModal(true);
    };

    const saveRoomFromModal = () => {
        if (!roomModalData.room_no.trim()) {
            alert('Please enter a Room Number.');
            return;
        }
        if (!roomModalData.items || roomModalData.items.length === 0) {
            alert('Please assess at least one item.');
            return;
        }
        setFacilityData(prev => {
            const updated = [...prev];
            const building = { ...updated[activeBuildingIdx], rooms: [...updated[activeBuildingIdx].rooms] };
            if (editingRoomIdx !== null) {
                building.rooms[editingRoomIdx] = { ...roomModalData };
            } else {
                building.rooms.push({ ...roomModalData });
            }
            updated[activeBuildingIdx] = building;
            return updated;
        });
        setShowRoomModal(false);
    };

    // --- DELETED INLINE LOGIC, RESTORED MODAL ---
    const deleteRoom = (bIdx, rIdx) => {
        if (!window.confirm("Delete this room?")) return;
        setFacilityData(prev => {
            const updated = [...prev];
            const building = { ...updated[bIdx], rooms: updated[bIdx].rooms.filter((_, i) => i !== rIdx) };
            updated[bIdx] = building;
            return updated;
        });
    };

    // --- SUBMIT ALL REPAIRS ---
    const submitAllRepairs = async () => {
        // Group items by Room to prevent overwriting during save
        const roomPayloads = [];

        for (const building of facilityData) {
            for (const room of building.rooms) {
                if (!room.saved && room.items && room.items.length > 0) {
                    roomPayloads.push({
                        schoolId: schoolId || localStorage.getItem('schoolId'),
                        iern: schoolId || localStorage.getItem('schoolId'),
                        building_no: building.building_no,
                        room_no: room.room_no,
                        items: room.items,
                        remarks: room.items[0]?.remarks || '' // Fallback if remarks are per-item now
                    });
                }
            }
        }

        if (roomPayloads.length === 0) {
            alert('No new assessments to submit.');
            return;
        }

        setIsSavingRepair(true);
        setRepairSuccessMsg('');
        let savedCount = 0;
        let offlineCount = 0;

        for (const payload of roomPayloads) {
            try {
                await addRepairToLocal(payload);
                if (navigator.onLine) {
                    const res = await fetch('/api/save-facility-repair', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        savedCount++;
                    } else {
                        throw new Error('Server error');
                    }
                } else {
                    throw new Error('Offline');
                }
            } catch (e) {
                console.error("Save failed for room:", payload.room_no, e);
                offlineCount++;
            }
        }

        if (offlineCount > 0) {
            setRepairSuccessMsg(`${savedCount} saved online, ${offlineCount} queued offline — will sync when connected.`);
        } else {
            setRepairSuccessMsg(`All ${savedCount} room assessments submitted successfully!`);
        }
        if (offlineCount === 0) {
            // All saved online — lock the form
            setIsRepairSubmitted(true);
        } else {
            // Some went offline — clear so user doesn't double-submit
            setFacilityData([]);
        }
        setIsSavingRepair(false);
        try {
            const pending = await getLocalRepairs();
            setPendingRepairCount(pending.length);
        } catch (_) { }
    };

    // --- DEMOLITION LOGIC ---
    const addDemolition = () => {
        setDemolitionModalData({
            building_no: '', reason_age: false, reason_safety: false, reason_calamity: false, reason_upgrade: false
        });
        setShowDemolitionModal(true);
    };

    const saveDemolitionFromModal = () => {
        setDemolitionData(prev => [...prev, { id: Date.now(), ...demolitionModalData }]);
        setShowDemolitionModal(false);
    };

    const removeDemolition = (idx) => {
        setDemolitionData(prev => prev.filter((_, i) => i !== idx));
    };

    const submitAllDemolitions = async () => {
        const payloadList = demolitionData
            .filter(d => !d.saved) // Only submit unsaved items
            .map(d => ({
                schoolId: schoolId || localStorage.getItem('schoolId'),
                iern: schoolId || localStorage.getItem('schoolId'),
                building_no: d.building_no,
                reason_age: d.reason_age,
                reason_safety: d.reason_safety,
                reason_calamity: d.reason_calamity,
                reason_upgrade: d.reason_upgrade
            }));


        if (payloadList.length === 0) return;

        setIsSavingDemolition(true);
        setDemolitionSuccessMsg('');
        let savedCount = 0;

        for (const payload of payloadList) {
            try {
                const res = await fetch('/api/save-facility-demolition', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) savedCount++;
            } catch (e) {
                console.error("Demolition save failed:", e);
            }
        }

        if (savedCount === payloadList.length) {
            setDemolitionSuccessMsg(`All ${savedCount} demolition records submitted successfully!`);
            setIsDemolitionSubmitted(true);
        } else {
            setDemolitionSuccessMsg(`Saved ${savedCount} out of ${payloadList.length} records.`);
        }
        setIsSavingDemolition(false);
    };

    // --- SYNC DEMOLITION COUNT ---
    useEffect(() => {
        const count = demolitionData.length;
        // if (count !== (formData.build_classrooms_demolition || 0)) {
        //     setFormData(prev => ({ ...prev, build_classrooms_demolition: count }));
        // }
        if (formData && count !== (formData.build_classrooms_demolition || 0)) {
            setFormData(prev => ({ ...prev, build_classrooms_demolition: count }));
        }
    }, [demolitionData]);

    // --- HYDRATE DEMOLITIONS ---
    useEffect(() => {
        const fetchDemolitions = async () => {
            const iern = queryParams.get('schoolId') || localStorage.getItem('schoolId');
            if (!iern) return;

            setIsLoadingDemolitions(true);
            try {
                const res = await fetch(`/api/facility-demolitions/${iern}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.length > 0) {
                        setDemolitionData(data.map((d, i) => ({ id: Date.now() + i, ...d, saved: true })));
                        setIsDemolitionSubmitted(true);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch demolitions", e);
            } finally {
                setIsLoadingDemolitions(false);
            }
        };
        fetchDemolitions();
    }, [schoolIdParam]);

    // --- HYDRATE BUILDING INVENTORY ---
    useEffect(() => {
        const fetchInventory = async () => {
            const iern = queryParams.get('schoolId') || localStorage.getItem('schoolId');
            if (!iern) return;

            setIsLoadingInventory(true);
            try {
                const res = await fetch(`/api/facility-inventory/${iern}`);
                if (res.ok) {
                    const data = await res.json();
                    console.log('📦 Inventory API response:', data.length, 'rows, statuses:', [...new Set(data.map(d => d.status))]);
                    const newBuildings = data.filter(d => d.status === 'Newly Built' || d.status === 'New').map((d, i) => ({ id: Date.now() + i, ...d }));
                    const goodBuildings = data.filter(d => d.status === 'Good Condition' || d.status === 'Good').map((d, i) => ({ id: Date.now() + 1000 + i, ...d }));
                    console.log('📦 Filtered:', newBuildings.length, 'new,', goodBuildings.length, 'good');
                    setNewlyBuiltBuildings(newBuildings);
                    setGoodConditionBuildings(goodBuildings);
                } else {
                    console.error('📦 Inventory API error:', res.status);
                }
            } catch (e) {
                console.error("Failed to fetch inventory", e);
            } finally {
                setIsLoadingInventory(false);
            }
        };
        fetchInventory();
    }, [schoolIdParam]);

    // --- CHECK PENDING REPAIRS ON MOUNT ---
    useEffect(() => {
        const checkPending = async () => {
            try {
                const pending = await getLocalRepairs();
                setPendingRepairCount(pending.length);
            } catch (_) { }
        };
        checkPending();
        const handleOnline = () => checkPending();
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    // --- SYNC REPAIR COUNT FROM FACILITY DATA ---
    useEffect(() => {
        const totalRooms = facilityData.reduce((sum, b) => sum + b.rooms.length, 0);
        if (totalRooms !== (formData.build_classrooms_repair || 0)) {
            setFormData(prev => ({ ...prev, build_classrooms_repair: totalRooms }));
        }
    }, [facilityData]);

    // --- SYNC NEW BUILDING COUNT FROM INVENTORY ---
    useEffect(() => {
        const totalNew = newlyBuiltBuildings.reduce((sum, b) => sum + (Number(b.no_of_classrooms) || 0), 0);
        if (totalNew !== (formData.build_classrooms_new || 0)) {
            setFormData(prev => ({ ...prev, build_classrooms_new: totalNew }));
        }
    }, [newlyBuiltBuildings]);

    // --- SYNC GOOD BUILDING COUNT FROM INVENTORY ---
    useEffect(() => {
        const totalGood = goodConditionBuildings.reduce((sum, b) => sum + (Number(b.no_of_classrooms) || 0), 0);
        if (totalGood !== (formData.build_classrooms_good || 0)) {
            setFormData(prev => ({ ...prev, build_classrooms_good: totalGood }));
        }
    }, [goodConditionBuildings]);

    // --- FETCH AND HYDRATE REPAIRS ---
    useEffect(() => {
        const fetchAndHydrateRepairs = async () => {
            const iern = schoolIdParam || localStorage.getItem('schoolId');
            if (!iern) return;

            setIsLoadingRepairs(true);
            try {
                let data = [];
                if (navigator.onLine) {
                    try {
                        const res = await fetch(`/api/facility-repairs/${iern}`);
                        if (res.ok) {
                            data = await res.json();
                        }
                    } catch (err) {
                        console.warn("API Fetch failed, will try IndexedDB:", err);
                    }
                }

                // Hydrate logic: Convert flat items list to Building -> Room -> Items
                if (data.length > 0) {
                    const groups = {};
                    data.forEach((row, idx) => {
                        const bKey = row.building_no || 'Unassigned';
                        if (!groups[bKey]) {
                            groups[bKey] = {
                                id: Date.now() + idx,
                                building_no: bKey,
                                rooms: []
                            };
                        }

                        // Find or create room
                        let room = groups[bKey].rooms.find(r => r.room_no === row.room_no);
                        if (!room) {
                            room = {
                                room_no: row.room_no,
                                saved: false,
                                items: []
                            };
                            groups[bKey].rooms.push(room);
                        }

                        // Add item details
                        room.items.push({
                            item_name: row.item_name,
                            oms: row.oms,
                            condition: row.condition,
                            damage_ratio: row.damage_ratio,
                            recommended_action: row.recommended_action,
                            demo_justification: row.demo_justification,
                            remarks: row.remarks
                        });
                    });
                    setFacilityData(Object.values(groups));
                }
            } catch (error) {
                console.error("Hydration Error:", error);
            } finally {
                setIsLoadingRepairs(false);
            }
        };

        fetchAndHydrateRepairs();
    }, [schoolIdParam]);


    // --- AUTO-SHOW INFO MODAL ---
    useEffect(() => {
        const hasSeenInfo = localStorage.getItem('hasSeenFacilitiesInfo');
        if (!hasSeenInfo) {
            setShowInfoModal(true);
            localStorage.setItem('hasSeenFacilitiesInfo', 'true');
        }
    }, []);
    const [schoolId, setSchoolId] = useState(null);
    const [iern, setIern] = useState(null); // Actual IERN from school profile
    const [formData, setFormData] = useState({});
    const [originalData, setOriginalData] = useState(null);

    const initialFields = {
        build_classrooms_total: 0,
        build_classrooms_new: 0,
        build_classrooms_good: 0,
        build_classrooms_repair: 0,
        build_classrooms_demolition: 0
    };

    const goBack = () => {
        if (isDummy) {
            navigate('/dummy-forms', { state: { type: 'school' } });
        } else {
            navigate(viewOnly ? '/jurisdiction-schools' : '/school-forms');
        }
    };

    // --- FETCH DATA (Refactored for Sync Cache) ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Check Role for Read-Only
                try {
                    const role = localStorage.getItem('userRole');
                    if (role === 'Central Office' || isDummy) {
                        setIsReadOnly(true);
                    }
                } catch (e) { }

                const storedSchoolId = localStorage.getItem('schoolId');
                const storedOffering = localStorage.getItem('schoolOffering');
                if (storedSchoolId) setSchoolId(storedSchoolId);

                // DEFAULT STATE
                const defaultFormData = initialFields;

                // STEP 1: LOAD CACHE IMMEDIATELY
                let loadedFromCache = false;
                const CACHE_KEY = `CACHE_PHYSICAL_FACILITIES_${user.uid} `;
                const cachedData = localStorage.getItem(CACHE_KEY);

                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        setFormData({ ...defaultFormData, ...parsed });
                        setOriginalData({ ...defaultFormData, ...parsed });
                        setIsLocked(true);
                        setLoading(false); // CRITICAL: Instant Load
                        loadedFromCache = true;
                        console.log("Loaded cached Physical Facilities (Instant Load)");
                    } catch (e) { console.error("Cache parse error", e); }
                }

                try {
                    // STEP 2: CHECK OUTBOX
                    let restored = false;
                    if (!viewOnly) {
                        try {
                            const drafts = await getOutbox();
                            const draft = drafts.find(d => d.type === 'PHYSICAL_FACILITIES');
                            if (draft) {
                                console.log("Restored draft from Outbox");
                                setFormData({ ...defaultFormData, ...draft.payload });

                                if (draft.payload.curricular_offering || draft.payload.offering) {
                                    localStorage.setItem('schoolOffering', draft.payload.curricular_offering || draft.payload.offering);
                                }

                                setIsLocked(false);
                                restored = true;
                                setLoading(false);
                                return; // Stop here if draft found
                            }
                        } catch (e) { console.error("Outbox check failed:", e); }
                    }

                    // STEP 3: BACKGROUND FETCH
                    if (!restored) {
                        let fetchUrl = `/api/physical-facilities/${user.uid}`;
                        const role = localStorage.getItem('userRole');
                        if (isAuditMode) {
                            fetchUrl = `/api/monitoring/school-detail/${auditTargetId}`;
                        } else if ((viewOnly || role === 'Central Office' || isDummy) && schoolIdParam) {
                            fetchUrl = `/api/monitoring/school-detail/${schoolIdParam}`;
                        }

                        // Only show loading if we didn't load from cache
                        if (!loadedFromCache) setLoading(true);

                        const res = await fetch(fetchUrl);
                        const json = await res.json();

                        if (json.exists || (viewOnly && schoolIdParam) || isAuditMode) {
                            const dbData = ((viewOnly && schoolIdParam) || isAuditMode) ? json : json.data;
                            if (!schoolIdParam) setSchoolId(dbData.school_id || dbData.schoolId || storedSchoolId);
                            if (dbData.iern) setIern(dbData.iern); // Load actual IERN from profile

                            if (dbData.school_id && !viewOnly) {
                                localStorage.setItem('schoolId', dbData.school_id);
                                if (json.curricular_offering) localStorage.setItem('schoolOffering', json.curricular_offering);
                            }

                            const loaded = {};
                            Object.keys(initialFields).forEach(key => {
                                loaded[key] = dbData[key] ?? 0;
                            });

                            setFormData(loaded);
                            setOriginalData(loaded);

                            // Check if there is ANY actual data before locking
                            // Check if there is ANY actual data in FORM FIELDS before locking
                            const hasData = Object.keys(initialFields).some(key => {
                                const val = dbData[key];
                                return val !== 0 && val !== '0' && val !== '' && val !== null && val !== undefined;
                            });
                            if (hasData || viewOnly) setIsLocked(true);
                            else setIsLocked(false);

                            // UPDATE CACHE
                            localStorage.setItem(CACHE_KEY, JSON.stringify(loaded));
                        } else {
                            if (!loadedFromCache) {
                                setFormData(defaultFormData);
                                setIsLocked(false); // Explicitly ensure unlocked if no data
                            }
                        }
                    }
                } catch (error) {
                    console.error("Fetch Error:", error);
                    if (!loadedFromCache) {
                        // Fallback: Try main cache again
                        const CACHE_KEY = `CACHE_PHYSICAL_FACILITIES_${user.uid} `;
                        const cached = localStorage.getItem(CACHE_KEY);
                        if (cached) {
                            const data = JSON.parse(cached);
                            setFormData(data);
                            setOriginalData(data);
                            setIsLocked(true);
                        } else {
                            // Fallback: Try Legacy Cache
                            const localData = localStorage.getItem('physicalFacilitiesData');
                            if (localData) {
                                console.log("Loaded legacy physical facilities data");
                                const data = JSON.parse(localData);
                                setFormData(data);
                                setIsLocked(true);
                            }
                        }
                    }
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- SAVE TIMER EFFECTS ---


    // --- AUTOMATIC TALLYING ---
    useEffect(() => {
        if (!formData) return;
        const total = (formData.build_classrooms_new || 0) +
            (formData.build_classrooms_good || 0) +
            (formData.build_classrooms_repair || 0) +
            (formData.build_classrooms_demolition || 0);

        // Only update if different to avoid loop (though React batches updates)
        if (total !== formData.build_classrooms_total) {
            setFormData(prev => ({ ...prev, build_classrooms_total: total }));
        }
    }, [
        formData.build_classrooms_new,
        formData.build_classrooms_good,
        formData.build_classrooms_repair,
        formData.build_classrooms_demolition
    ]);

    const handleChange = (name, value) => {
        // 1. Strip non-numeric characters
        const cleanValue = value.replace(/[^0-9]/g, '');
        // 2. Parse integer to remove leading zeros (or default to 0 if empty)
        // Allow empty string '' temporarily, otherwise parse Int
        const intValue = cleanValue === '' ? '' : parseInt(cleanValue, 10);

        setFormData(prev => ({ ...prev, [name]: intValue }));
    };

    // --- VALIDATION AND UNIFIED SAVE ---
    const [confirmationData, setConfirmationData] = useState(null);
    const [showUnifiedConfirmModal, setShowUnifiedConfirmModal] = useState(false);

    const validateAndConfirm = () => {
        // 1. Basic Field Validation
        const isValidEntry = (value) => value !== '' && value !== null && value !== undefined;
        const fields = [
            'build_classrooms_new', 'build_classrooms_good',
            'build_classrooms_repair', 'build_classrooms_demolition'
        ];
        for (const f of fields) {
            if (!isValidEntry(formData[f])) {
                alert("Please fill in all classroom counts (use 0 if none).");
                return;
            }
        }

        // 2. Cross-Verification (Count Mismatches)
        const totalRoomsInRepairs = facilityData.reduce((sum, b) => sum + b.rooms.length, 0);
        if (totalRoomsInRepairs !== formData.build_classrooms_repair) {
            alert(`Mismatch: "Needs Repair" count (${formData.build_classrooms_repair}) does not match the total rooms listed in Repair Assessment (${totalRoomsInRepairs}).\n\nPlease ensure you have added all rooms needing repair.`);
            return;
        }

        const totalDemolitions = demolitionData.length;
        if (totalDemolitions !== formData.build_classrooms_demolition) {
            alert(`Mismatch: "Needs Demolition" count (${formData.build_classrooms_demolition}) does not match the total buildings listed in Demolition Records (${totalDemolitions}).`);
            return;
        }

        // 3. Prepare Confirmation Data
        setConfirmationData({
            new: formData.build_classrooms_new,
            good: formData.build_classrooms_good,
            repairs: totalRoomsInRepairs,
            repairBuildings: facilityData.length,
            demolitions: totalDemolitions
        });
        setShowSaveModal(false); // Close generic save modal if open
        setShowUnifiedConfirmModal(true);
    };

    const confirmUnifiedSave = async () => {
        setShowUnifiedConfirmModal(false);
        setIsSaving(true);

        // Prepare Master Payload
        // Flatten repairs for backend
        // Flatten repairs for backend
        const repairEntries = [];
        for (const building of facilityData) {
            for (const room of building.rooms) {
                if (room.items && room.items.length > 0) {
                    room.items.forEach(item => {
                        repairEntries.push({
                            building_no: building.building_no,
                            room_no: room.room_no,
                            ...item
                        });
                    });
                }
            }
        }

        const payload = {
            schoolId: schoolId || localStorage.getItem('schoolId'),
            iern: iern || schoolId || localStorage.getItem('schoolId'), // Use actual IERN
            uid: auth.currentUser.uid,
            ...formData,
            repairEntries,
            demolitionEntries: demolitionData,
            inventoryEntries: [
                ...newlyBuiltBuildings.map(b => ({ ...b, status: 'Newly Built' })),
                ...goodConditionBuildings.map(b => ({ ...b, status: 'Good Condition' }))
            ]
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

                // Keep repairs editable — don't lock them after save
                // setIsRepairSubmitted(true); // Removed: allow re-editing
                setIsDemolitionSubmitted(true);

                setOriginalData({ ...formData });
                setIsLocked(true);
                localStorage.setItem('physicalFacilitiesData', JSON.stringify(formData));
            } else {
                throw new Error("Save failed");
            }
        } catch (e) {
            console.error(e);
            alert("Save failed or offline. Please check connection.");
            // Offline handling logic could be re-integrated here if needed, 
            // but for now we focus on the unified online flow.
        } finally {
            setIsSaving(false);
        }
    };







    if (loading) return <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-900"><div className="w-10 h-10 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div></div>;

    return (
        <div className={`min-h-screen font-sans pb-40 ${embedded ? '' : 'bg-slate-50'} `}>
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
                                    <h1 className="text-2xl font-bold text-white tracking-tight">Physical Facilities</h1>
                                </div>
                                <p className="text-blue-100 text-xs font-medium mt-1">
                                    Q: What is the current condition and total number of instructional classrooms?
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setShowInfoModal(true)} className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                            <FiHelpCircle size={24} />
                        </button>
                    </div>
                </div>
            )}

            <div className={`px-5 relative z-20 max-w-lg mx-auto space-y-4 ${embedded ? '' : '-mt-12'} `}>

                {/* Total Classrooms (Highlight) */}
                <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-slate-100 text-center mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Total Classrooms</p>
                    <input
                        type="text" inputMode="numeric" pattern="[0-9]*"
                        name="build_classrooms_total"
                        value={formData.build_classrooms_total ?? 0}
                        onChange={(e) => handleChange(e.target.name, e.target.value)} // Allows manual override if needed, though useEffect will overwrite on dependent change
                        disabled={true}
                        className="w-full text-center text-7xl font-black text-[#004A99] bg-transparent outline-none placeholder-slate-200 tracking-tighter"
                        placeholder="0"
                    />
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Overall count in the school</p>
                </div>

                <InputCard label="Newly Built" name="build_classrooms_new" icon="✨" color="bg-emerald-500 text-emerald-600" value={formData.build_classrooms_new ?? 0} onChange={handleChange} disabled={true} />
                <p className="text-[10px] text-emerald-400 font-semibold -mt-2 ml-1 flex items-center gap-1">✨ Calculated from buildings added below</p>
                <InputCard label="Good Condition" name="build_classrooms_good" icon="✅" color="bg-blue-500 text-blue-600" value={formData.build_classrooms_good ?? 0} onChange={handleChange} disabled={true} />
                <p className="text-[10px] text-blue-400 font-semibold -mt-2 ml-1 flex items-center gap-1">✨ Calculated from buildings added below</p>
                <InputCard label="Needs Repair" name="build_classrooms_repair" icon="🛠️" color="bg-orange-500 text-orange-600" value={formData.build_classrooms_repair ?? 0} onChange={handleChange} disabled={true} />
                <p className="text-[10px] text-orange-400 font-semibold -mt-2 ml-1 flex items-center gap-1">✨ Calculated from rooms added below</p>
                <InputCard label="Needs Demolition" name="build_classrooms_demolition" icon="⚠️" color="bg-red-500 text-red-600" value={formData.build_classrooms_demolition ?? 0} onChange={handleChange} disabled={isLocked || viewOnly || isReadOnly} />

                {/* --- NEWLY BUILT BUILDINGS SECTION --- */}
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-emerald-900/5 border border-emerald-100 mt-6 relative overflow-hidden">
                    {isLoadingInventory && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                            <p className="text-xs font-bold text-emerald-600 animate-pulse">Loading buildings...</p>
                        </div>
                    )}
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-3 bg-emerald-100 rounded-2xl text-2xl">✨</div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Newly Built Buildings</h2>
                            <p className="text-xs text-slate-400 font-medium">Buildings recently constructed or completed</p>
                        </div>
                    </div>

                    {!isReadOnly && !isLocked && (
                        <div className="mb-4">
                            <button onClick={() => openAddInventory('new')}
                                className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2">
                                <FiPlus /> Add Newly Built Building
                            </button>
                        </div>
                    )}

                    <div className="space-y-3">
                        {newlyBuiltBuildings.map((item, idx) => (
                            <div key={item.id} className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                {/* Card Header */}
                                <div className="px-4 pt-4 pb-2 flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">{item.category}</span>
                                        <h4 className="font-bold text-slate-800 text-[15px] mt-1.5 truncate">{item.building_name}</h4>
                                    </div>
                                    {!isReadOnly && !isLocked && (
                                        <div className="flex items-center gap-1 ml-2 shrink-0">
                                            <button onClick={() => openEditInventory('new', idx)} className="w-7 h-7 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center transition-colors" title="Edit">
                                                <FiEdit size={13} />
                                            </button>
                                            <button onClick={() => removeInventoryBuilding('new', idx)} className="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors" title="Delete">
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {/* Card Body */}
                                <div className="px-4 py-2 flex items-center gap-4 text-slate-500">
                                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                                        <FiLayout size={13} className="text-purple-400" /> {item.no_of_storeys || 1} Storey{(item.no_of_storeys || 1) !== 1 ? 's' : ''}
                                    </span>
                                    <span className="text-slate-200">|</span>
                                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                                        <FiBox size={13} className="text-blue-400" /> {item.no_of_classrooms} Classroom{item.no_of_classrooms !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                {/* Card Footer */}
                                {(item.year_completed || item.remarks) && (
                                    <div className="px-4 pb-3 pt-1 flex items-center gap-3 border-t border-slate-100/80 mt-1">
                                        {item.year_completed && <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1"><FiClock size={10} /> Built {item.year_completed}</span>}
                                        {item.remarks && <p className="text-[10px] text-slate-400 font-medium truncate flex-1">📝 {item.remarks}</p>}
                                    </div>
                                )}
                            </div>
                        ))}
                        {newlyBuiltBuildings.length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-sm">
                                <p className="text-xl mb-2">🏗️</p>
                                <p>No newly built buildings added.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- GOOD CONDITION BUILDINGS SECTION --- */}
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-blue-100 mt-6 relative overflow-hidden">
                    {isLoadingInventory && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                            <p className="text-xs font-bold text-blue-600 animate-pulse">Loading buildings...</p>
                        </div>
                    )}
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-3 bg-blue-100 rounded-2xl text-2xl">✅</div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Good Condition Buildings</h2>
                            <p className="text-xs text-slate-400 font-medium">Buildings in good working condition</p>
                        </div>
                    </div>

                    {!isReadOnly && !isLocked && (
                        <div className="mb-4">
                            <button onClick={() => openAddInventory('good')}
                                className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-colors text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2">
                                <FiPlus /> Add Good Condition Building
                            </button>
                        </div>
                    )}

                    <div className="space-y-3">
                        {goodConditionBuildings.map((item, idx) => (
                            <div key={item.id} className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/30 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                {/* Card Header */}
                                <div className="px-4 pt-4 pb-2 flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">{item.category}</span>
                                        <h4 className="font-bold text-slate-800 text-[15px] mt-1.5 truncate">{item.building_name}</h4>
                                    </div>
                                    {!isReadOnly && !isLocked && (
                                        <div className="flex items-center gap-1 ml-2 shrink-0">
                                            <button onClick={() => openEditInventory('good', idx)} className="w-7 h-7 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center transition-colors" title="Edit">
                                                <FiEdit size={13} />
                                            </button>
                                            <button onClick={() => removeInventoryBuilding('good', idx)} className="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors" title="Delete">
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {/* Card Body */}
                                <div className="px-4 py-2 flex items-center gap-4 text-slate-500">
                                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                                        <FiLayout size={13} className="text-purple-400" /> {item.no_of_storeys || 1} Storey{(item.no_of_storeys || 1) !== 1 ? 's' : ''}
                                    </span>
                                    <span className="text-slate-200">|</span>
                                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                                        <FiBox size={13} className="text-blue-400" /> {item.no_of_classrooms} Classroom{item.no_of_classrooms !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                {/* Card Footer */}
                                {(item.year_completed || item.remarks) && (
                                    <div className="px-4 pb-3 pt-1 flex items-center gap-3 border-t border-slate-100/80 mt-1">
                                        {item.year_completed && <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1"><FiClock size={10} /> Built {item.year_completed}</span>}
                                        {item.remarks && <p className="text-[10px] text-slate-400 font-medium truncate flex-1">📝 {item.remarks}</p>}
                                    </div>
                                )}
                            </div>
                        ))}
                        {goodConditionBuildings.length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-sm">
                                <p className="text-xl mb-2">🏢</p>
                                <p>No good condition buildings added.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- BUILDING INVENTORY SUMMARY --- */}
                {(newlyBuiltBuildings.length > 0 || goodConditionBuildings.length > 0) && (
                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-indigo-900/5 border border-indigo-100 mt-6 relative overflow-hidden">
                        {/* Accent bar */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-blue-400 to-indigo-400" />

                        <div className="flex items-center gap-3 mb-5 mt-1">
                            <div className="p-3 bg-indigo-100 rounded-2xl text-2xl">📊</div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Building Inventory Summary</h2>
                                <p className="text-xs text-slate-400 font-medium">Breakdown of all buildings by category</p>
                            </div>
                        </div>

                        {/* Category breakdown */}
                        {(() => {
                            const allBuildings = [...newlyBuiltBuildings, ...goodConditionBuildings];
                            const catMap = {};
                            allBuildings.forEach(b => {
                                if (!catMap[b.category]) catMap[b.category] = { count: 0, classrooms: 0 };
                                catMap[b.category].count += 1;
                                catMap[b.category].classrooms += Number(b.no_of_classrooms) || 0;
                            });
                            const categories = Object.entries(catMap).sort((a, b) => b[1].count - a[1].count);
                            const totalBuildings = allBuildings.length;
                            const totalClassrooms = allBuildings.reduce((sum, b) => sum + (Number(b.no_of_classrooms) || 0), 0);

                            return (
                                <>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {categories.map(([cat, info]) => (
                                            <div key={cat} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                                                <span className="text-sm font-black text-indigo-600">{info.count}</span>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700 leading-tight">{cat}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">{info.classrooms} classroom{info.classrooms !== 1 ? 's' : ''}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                            <span className="text-xs font-bold text-slate-500">{newlyBuiltBuildings.length} Newly Built</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                                            <span className="text-xs font-bold text-slate-500">{goodConditionBuildings.length} Good Condition</span>
                                        </div>
                                        <div className="ml-auto text-right">
                                            <p className="text-xs font-bold text-slate-400">{totalBuildings} Building{totalBuildings !== 1 ? 's' : ''} · {totalClassrooms} Classroom{totalClassrooms !== 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* --- FACILITY REPAIR ASSESSMENT SECTION --- */}
                {!viewOnly && (
                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-orange-900/5 border border-orange-100 mt-6 relative overflow-hidden">
                        {isLoadingRepairs && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                                <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                                <p className="text-xs font-bold text-orange-600 animate-pulse">Loading assessments...</p>
                            </div>
                        )}
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-3 bg-orange-100 rounded-2xl text-2xl">🔧</div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Repair Assessment</h2>
                                <p className="text-xs text-slate-400 font-medium">Add buildings and assess rooms needing repair</p>
                            </div>
                            {pendingRepairCount > 0 && (
                                <div className="ml-auto bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 animate-pulse">
                                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                                    {pendingRepairCount} Pending Sync
                                </div>
                            )}
                        </div>

                        {/* Add Building Input */}
                        {!isReadOnly && (
                            <div className="mb-4">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newBuildingName}
                                        onChange={(e) => { setNewBuildingName(e.target.value); setBuildingError(''); }}
                                        placeholder="Building name or number"
                                        disabled={isRepairSubmitted}
                                        className={`flex-1 p-3 bg-slate-50 border rounded-xl text-sm font-semibold text-slate-700 focus:ring-4 outline-none transition-colors ${isDuplicateBuilding
                                            ? 'border-red-400 focus:ring-red-100 bg-red-50'
                                            : 'border-slate-200 focus:ring-orange-100'
                                            } ${isRepairSubmitted ? 'opacity-50 cursor-not-allowed' : ''} `}
                                        onKeyDown={(e) => e.key === 'Enter' && addBuilding()}
                                    />
                                    <button
                                        onClick={addBuilding}
                                        disabled={isDuplicateBuilding || !newBuildingName.trim() || isRepairSubmitted}
                                        className="px-5 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors text-sm shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        + Add
                                    </button>
                                </div>
                                {(buildingError || isDuplicateBuilding) && (
                                    <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1">
                                        ⚠️ {buildingError || 'This building has already been added.'}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Building Cards */}
                        {
                            facilityData.length === 0 && (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    <p className="text-3xl mb-2">🏢</p>
                                    <p className="font-medium">No buildings added yet.</p>
                                    {!isReadOnly && <p className="text-xs mt-1">Start by adding a building above.</p>}
                                </div>
                            )
                        }

                        <div className="space-y-4">
                            {facilityData.map((building, bIdx) => (
                                <div key={building.id} className={`p - 4 rounded - 2xl border transition - colors ${isRepairSubmitted
                                    ? 'bg-slate-100 border-slate-300 opacity-80'
                                    : 'bg-slate-50 border-slate-200'
                                    } `}>
                                    {/* Building Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">🏢</span>
                                            <h3 className="font-bold text-slate-700">Building {building.building_no}</h3>
                                            <span className="text-xs bg-blue-100 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                                                {building.rooms.length} Rooms Recorded
                                            </span>
                                            {isRepairSubmitted && (
                                                <span className="text-xs bg-green-100 text-green-600 font-bold px-2 py-0.5 rounded-full">
                                                    Submitted ✓
                                                </span>
                                            )}
                                        </div>
                                        {!isRepairSubmitted && !isReadOnly && (
                                            <button
                                                onClick={() => removeBuilding(bIdx)}
                                                className="text-red-400 hover:text-red-600 text-xs font-bold transition-colors"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>

                                    {/* Room Summary List (Card View) */}
                                    {building.rooms.length > 0 && (
                                        <div className="space-y-3 mb-4">
                                            {building.rooms.map((room, rIdx) => {
                                                const checkedCount = room.items?.length || 0;
                                                const checkedLabels = room.items?.map(it => it.item_name).join(', ') || 'No items checked';
                                                const isSaved = room.saved;

                                                return (
                                                    <div
                                                        key={rIdx}
                                                        onClick={() => openEditRoom(bIdx, rIdx)}
                                                        className={`group p-4 rounded-[1.25rem] border transition-all flex items-center justify-between active:scale-[0.98] cursor-pointer ${isRepairSubmitted || isSaved || isReadOnly
                                                            ? 'bg-slate-50 border-slate-100'
                                                            : 'bg-white border-slate-100 hover:border-orange-200 hover:shadow-md'
                                                            } `}
                                                    >
                                                        <div className="flex-1 min-w-0 pr-2">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <p className="text-sm font-extrabold text-slate-800">Room {room.room_no}</p>
                                                                {isSaved && (
                                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[9px] font-black uppercase tracking-tighter">
                                                                        Saved
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-orange-600 font-bold truncate">
                                                                {checkedCount > 0 ? checkedLabels : 'No items checked'}
                                                            </p>
                                                            {room.remarks && (
                                                                <p className="text-[10px] text-slate-400 font-medium truncate mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100/50">
                                                                    📝 {room.remarks}
                                                                </p>
                                                            )}
                                                            {room.recommended_action && (
                                                                <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${room.recommended_action === 'Routine Repair' ? 'bg-blue-100 text-blue-700' :
                                                                    room.recommended_action === 'Major Repair / Rehabilitation' ? 'bg-orange-100 text-orange-700' :
                                                                        room.recommended_action === 'Structural Retrofit' ? 'bg-purple-100 text-purple-700' :
                                                                            'bg-red-100 text-red-700'
                                                                    }`}>
                                                                    {room.recommended_action}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {!isRepairSubmitted && !isSaved && !isReadOnly && (
                                                                <>
                                                                    <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <FiEdit size={14} />
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); deleteRoom(bIdx, rIdx); }}
                                                                        className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                                                                    >
                                                                        <FiTrash2 size={14} />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {(isRepairSubmitted || isSaved || isReadOnly) && (
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                                                                    <FiChevronRight size={18} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Add Room Button */}
                                    {!isRepairSubmitted && !isReadOnly && (
                                        <button
                                            onClick={() => openAddRoom(bIdx)}
                                            className="w-full py-2.5 border-2 border-dashed border-orange-200 text-orange-500 font-bold text-sm rounded-xl hover:bg-orange-50 transition-colors"
                                        >
                                            + Add Room Assessment
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Success Message */}
                        {
                            repairSuccessMsg && (
                                <div className="bg-green-50 border border-green-200 text-green-700 text-sm font-semibold p-3 rounded-xl mt-4 flex items-center gap-2">
                                    <FiCheckCircle /> {repairSuccessMsg}
                                </div>
                            )
                        }

                        {/* Submit / New Assessment Buttons */}

                    </div>
                )}

                {/* --- DEMOLITION RECORDS SECTION --- */}
                {!viewOnly && (
                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-red-900/5 border border-red-100 mt-6 relative overflow-hidden">
                        {isLoadingDemolitions && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                                <div className="w-8 h-8 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
                                <p className="text-xs font-bold text-red-600 animate-pulse">Loading demolition records...</p>
                            </div>
                        )}
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-3 bg-red-100 rounded-2xl text-2xl">⚠️</div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Demolition Records</h2>
                                <p className="text-xs text-slate-400 font-medium">Buildings slated for demolition</p>
                            </div>
                        </div>

                        {/* Add Button */}
                        {!isReadOnly && (
                            <div className="mb-4">
                                <button
                                    onClick={addDemolition}
                                    disabled={isDemolitionSubmitted}
                                    className="w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors text-sm shadow-md shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <FiPlus /> Add Building for Demolition
                                </button>
                            </div>
                        )}

                        {/* List */}
                        <div className="space-y-3">
                            {demolitionData.map((item, idx) => (
                                <div key={item.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-slate-700">{item.building_no}</h4>
                                        <div className="flex gap-2 mt-1">
                                            {item.reason_age && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">Age</span>}
                                            {item.reason_safety && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">Safety</span>}
                                            {item.reason_calamity && <span className="text-[10px] bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full font-bold">Calamity</span>}
                                            {item.reason_upgrade && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">Upgrade</span>}
                                        </div>
                                    </div>
                                    {!isDemolitionSubmitted && !isReadOnly && (
                                        <button onClick={() => removeDemolition(idx)} className="text-red-400 hover:text-red-600">
                                            <FiTrash2 />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {demolitionData.length === 0 && (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    <p className="text-xl mb-2">🏚️</p>
                                    <p>No buildings added.</p>
                                </div>
                            )}
                        </div>

                        {/* Submit */}

                    </div>
                )}
            </div>

            {/* Footer Actions */}
            {
                !embedded && (

                    <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-100 p-4 pb-8 z-40">
                        <div className="max-w-lg mx-auto flex gap-3">
                            {(viewOnly || isReadOnly || isSuperUserReadOnly) ? (
                                <div className="w-full text-center p-3 text-slate-500 font-bold bg-slate-200 rounded-2xl text-sm flex items-center justify-center gap-2">
                                    <FiInfo /> View-Only Mode
                                </div>
                            ) : isLocked ? (
                                <button onClick={() => setShowEditModal(true)} className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-colors">
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
                )
            }



            {/* Room Repair Assessment Modal */}
            <RepairEntryModal
                isOpen={showRoomModal}
                onClose={() => setShowRoomModal(false)}
                onSave={saveRoomFromModal}
                editingRoomIdx={editingRoomIdx}
                activeBuildingIdx={activeBuildingIdx}
                facilityData={facilityData}
                roomModalData={roomModalData}
                setRoomModalData={setRoomModalData}
                repairItems={repairItems}
                readOnly={isReadOnly || roomModalData.saved}
            />

            <BuildingInventoryModal
                isOpen={showInventoryModal}
                onClose={() => { setShowInventoryModal(false); setEditingInventoryIdx(null); }}
                onSave={saveInventoryFromModal}
                data={inventoryModalData}
                setData={setInventoryModalData}
                statusLabel={inventoryModalTarget === 'new' ? 'Newly Built' : 'Good Condition'}
                isEditing={editingInventoryIdx !== null}
                buildingTypes={buildingTypes}
            />

            <DemolitionEntryModal
                isOpen={showDemolitionModal}
                onClose={() => setShowDemolitionModal(false)}
                onSave={saveDemolitionFromModal}
                data={demolitionModalData}
                setData={setDemolitionModalData}
            />

            {/* Modals */}
            {
                showEditModal && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
                            <h3 className="font-bold text-xl text-slate-800 mb-2">Enable Editing?</h3>
                            <p className="text-slate-500 text-sm mb-6">This allows you to modify the physical facilities data.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                                <button onClick={() => { setIsLocked(false); setShowEditModal(false); }} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-colors">Confirm</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showSaveModal && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                                <FiCheckCircle size={24} />
                            </div>
                            <h3 className="font-bold text-xl text-slate-800 text-center mb-2">Save Changes?</h3>
                            <p className="text-slate-500 text-center text-sm mb-6">You are about to update the physical facilities record.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                                <button onClick={validateAndConfirm} className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-colors">Validation Check</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- UNIFIED CONFIRMATION MODAL --- */}
            {showUnifiedConfirmModal && confirmationData && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl">
                                <FiAlertCircle />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Confirm Submission</h3>
                                <p className="text-sm text-slate-500">Please review your data before saving.</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 space-y-3 mb-6 border border-slate-100">
                            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Summary of Changes</h4>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600">New Classrooms:</span>
                                <span className="font-bold text-slate-800">{confirmationData.new}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600">Good Condition:</span>
                                <span className="font-bold text-slate-800">{confirmationData.good}</span>
                            </div>
                            <div className="w-full h-px bg-slate-200 my-2"></div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-orange-600 font-bold">Needs Repair:</span>
                                <span className="font-bold text-orange-700">{confirmationData.repairs} rooms</span>
                            </div>
                            <div className="text-xs text-right text-slate-400">across {confirmationData.repairBuildings} buildings</div>

                            <div className="flex justify-between items-center text-sm mt-2">
                                <span className="text-red-600 font-bold">Needs Demolition:</span>
                                <span className="font-bold text-red-700">{confirmationData.demolitions} building{confirmationData.demolitions !== 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowUnifiedConfirmModal(false)}
                                className="py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmUnifiedSave}
                                className="py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? 'Saving...' : 'Confirm & Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {
                showInfoModal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-blue-600 text-2xl">
                                <FiInfo />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800 text-center">Form Guide</h3>
                            <p className="text-sm text-slate-500 mt-2 mb-6 text-center">This form is answering the question: <b>'What is the current condition and total number of instructional classrooms?'</b></p>
                            <button onClick={() => setShowInfoModal(false)} className="w-full py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition-transform active:scale-95">Got it</button>
                        </div>
                    </div>
                )
            }

            <OfflineSuccessModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="Physical Facilities report saved successfully!" />
        </div >
    );
};

export default PhysicalFacilities;
