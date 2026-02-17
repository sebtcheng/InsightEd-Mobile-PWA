import React from 'react';
import { FiX, FiCheck, FiChevronDown } from 'react-icons/fi';

const RepairEntryModal = ({
    isOpen,
    onClose,
    onSave,
    editingRoomIdx,
    activeBuildingIdx,
    facilityData,
    roomModalData,
    setRoomModalData,

    repairItems,
    readOnly = false
}) => {
    if (!isOpen) return null;

    const building = activeBuildingIdx !== null ? facilityData[activeBuildingIdx] : null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto transform transition-all animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="font-bold text-xl text-slate-800">
                            {editingRoomIdx !== null ? 'Edit Assessment' : 'New Assessment'}
                        </h3>
                        {building && (
                            <p className="text-sm text-orange-500 font-semibold mt-0.5">
                                {editingRoomIdx !== null ? 'Modifying' : 'Adding to'} Building {building.building_no}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 text-xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <FiX />
                    </button>
                </div>

                {/* Room Number */}
                <div className="mb-5">
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Room Number / Name</label>
                    <input
                        type="text"
                        value={roomModalData.room_no}
                        onChange={(e) => setRoomModalData(prev => ({ ...prev, room_no: e.target.value }))}
                        placeholder="e.g. Room 101, Grade 1-A"
                        disabled={readOnly}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold text-slate-700 focus:ring-4 focus:ring-orange-100 outline-none transition-all disabled:opacity-70 disabled:bg-slate-100"
                    />
                </div>

                {/* Repair Checklist */}
                {/* Repair Checklist (Detailed) */}
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Detailed Item Assessment</label>
                <div className="mb-6 space-y-6">
                    {Object.entries(repairItems.reduce((acc, item) => {
                        (acc[item.group] = acc[item.group] || []).push(item);
                        return acc;
                    }, {})).map(([group, items]) => (
                        <div key={group} className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">{group}</h4>
                            <div className="space-y-3">
                                {items.map(item => {
                                    const existingItem = roomModalData.items?.find(i => i.item_name === item.label);
                                    const isChecked = !!existingItem;
                                    return (
                                        <RepairItemRow
                                            key={item.key}
                                            item={item}
                                            existingItem={existingItem || {}}
                                            isChecked={isChecked}
                                            setRoomModalData={setRoomModalData}
                                            readOnly={readOnly}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Remarks */}
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Additional Remarks</label>
                    <textarea
                        value={roomModalData.remarks || ''}
                        onChange={(e) => setRoomModalData(prev => ({ ...prev, remarks: e.target.value }))}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:ring-4 focus:ring-orange-100 outline-none transition-all h-24 resize-none"
                        placeholder="General notes about this room..."
                        disabled={readOnly}
                    />
                </div>

                {/* Footer / Counter */}
                <div className="bg-slate-50 -mx-6 -mb-6 p-4 border-t border-slate-100 rounded-b-3xl">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assessment Progress</p>
                            <p className="text-sm font-bold text-slate-800">
                                {roomModalData.items?.length || 0} of {repairItems.length} Items Assessed
                            </p>
                        </div>
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-orange-500 transition-all duration-300"
                                style={{ width: `${((roomModalData.items?.length || 0) / repairItems.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(roomModalData)}
                            className="flex-1 py-3 bg-[#004A99] text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-800 transition-colors"
                            disabled={readOnly}
                        >
                            {readOnly ? 'Close' : 'Save Room'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default RepairEntryModal;

// --- EXTRACTED ROW COMPONENT FOR STATE ISOLATION ---
const RepairItemRow = ({ item, existingItem, isChecked, setRoomModalData, readOnly }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    // Auto-expand newly checked items
    React.useEffect(() => {
        if (isChecked && !isExpanded) {
            setIsExpanded(true);
        }
    }, [isChecked]);

    const handleToggle = () => {
        if (!readOnly) setIsExpanded(!isExpanded);
    };

    return (
        <div className={`rounded-xl border transition-all ${isChecked ? 'bg-white border-orange-200 shadow-sm' : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'}`}>
            {/* Header */}
            <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={handleToggle}
            >
                {/* Checkbox (Controlled separately) */}
                <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0 ${isChecked
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-slate-300 bg-white'
                        }`}
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent toggle expand
                        if (readOnly) return;
                        setRoomModalData(prev => {
                            const newItems = [...(prev.items || [])];
                            if (!isChecked) {
                                // Add Item
                                newItems.push({
                                    item_name: item.label,
                                    oms: '',
                                    condition: 'Good',
                                    damage_ratio: 0,
                                    recommended_action: ['repair_purlins', 'repair_trusses', 'repair_structural'].includes(item.key) ? 'Major Repair / Rehabilitation' : '',
                                    remarks: '',
                                    demo_justification: ''
                                });
                            } else {
                                // Remove Item
                                const idx = newItems.findIndex(i => i.item_name === item.label);
                                if (idx > -1) newItems.splice(idx, 1);
                            }
                            return { ...prev, items: newItems };
                        });
                    }}
                >
                    {isChecked && <FiCheck size={14} />}
                </div>

                <span className={`text-sm font-bold flex-1 ${isChecked ? 'text-slate-800' : 'text-slate-600'}`}>
                    {item.label}
                </span>

                {/* Chevron */}
                <div className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    <FiChevronDown />
                </div>
            </div>

            {/* Detailed Inputs (Expanded) */}
            {isExpanded && isChecked && (
                <div className="px-3 pb-3 pt-0 space-y-3 animate-in slide-in-from-top-2 duration-200 cursor-default" onClick={e => e.stopPropagation()}>
                    <hr className="border-slate-100" />

                    {/* OMS & Condition */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">OMS (Material)</label>
                            <input
                                type="text"
                                value={existingItem.oms || ''}
                                onChange={(e) => setRoomModalData(prev => ({
                                    ...prev,
                                    items: prev.items.map(i => i.item_name === item.label ? { ...i, oms: e.target.value } : i)
                                }))}
                                placeholder="e.g. GI Sheet"
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:border-orange-300"
                                disabled={readOnly}
                            />
                        </div>
                    </div>
                    {/* Condition (Radio) */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Condition</label>
                        <div className="flex flex-col gap-2">
                            {['Good', 'Needs Repair', 'For Replacement'].map(opt => (
                                <label key={opt} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${existingItem.condition === opt
                                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                                    : 'bg-white border-slate-100'
                                    }`}>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${existingItem.condition === opt
                                        ? 'border-blue-500 bg-blue-500'
                                        : 'border-slate-300'
                                        }`}>
                                        {existingItem.condition === opt && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                    </div>
                                    <input
                                        type="radio"
                                        name={`condition-${item.key}`}
                                        value={opt}
                                        checked={existingItem.condition === opt}
                                        onChange={(e) => setRoomModalData(prev => ({
                                            ...prev,
                                            items: prev.items.map(i => i.item_name === item.label ? { ...i, condition: e.target.value } : i)
                                        }))}
                                        className="hidden"
                                        disabled={readOnly}
                                    />
                                    <span className={`text-xs font-bold ${existingItem.condition === opt ? 'text-blue-700' : 'text-slate-600'}`}>
                                        {opt}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Damage Ratio Slider */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Damage Ratio</label>
                            <span className="text-xs font-bold text-orange-600">{existingItem.damage_ratio || 0}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={existingItem.damage_ratio || 0}
                            onChange={(e) => setRoomModalData(prev => ({
                                ...prev,
                                items: prev.items.map(i => i.item_name === item.label ? { ...i, damage_ratio: parseInt(e.target.value) } : i)
                            }))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            disabled={readOnly}
                        />
                    </div>

                    {/* Recommended Action */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Action</label>
                        <select
                            value={existingItem.recommended_action || ''}
                            onChange={(e) => setRoomModalData(prev => ({
                                ...prev,
                                items: prev.items.map(i => i.item_name === item.label ? { ...i, recommended_action: e.target.value } : i)
                            }))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:border-orange-300"
                            disabled={readOnly}
                        >
                            <option value="">-- Select Action --</option>
                            <option value="None">None (Good)</option>
                            <option value="Routine Repair">Routine Repair</option>
                            <option value="Major Repair / Rehabilitation">Major Repair / Rehabilitation</option>
                            <option value="Structural Retrofit">Structural Retrofit</option>
                            <option value="Recommend for Condemnation">Recommend for Condemnation</option>
                            <option value="Recommend for Demolition">Recommend for Demolition</option>
                        </select>
                    </div>

                    {/* Demolition Justification (Conditional) */}
                    {existingItem.recommended_action === 'Recommend for Demolition' && (
                        <div className="animate-in fade-in slide-in-from-top-1">
                            <label className="text-[10px] font-bold text-red-500 uppercase tracking-wider block mb-1">Demolition Reason</label>
                            <select
                                value={existingItem.demo_justification || ''}
                                onChange={(e) => setRoomModalData(prev => ({
                                    ...prev,
                                    items: prev.items.map(i => i.item_name === item.label ? { ...i, demo_justification: e.target.value } : i)
                                }))}
                                className="w-full p-2 bg-red-50 border border-red-200 rounded-lg text-sm font-semibold text-red-700 outline-none focus:border-red-400"
                                disabled={readOnly}
                            >
                                <option value="">-- Select Reason --</option>
                                <option value="Age">Exceeded Lifespan (Age)</option>
                                <option value="Safety">Unsafe / Structural Failure</option>
                                <option value="Calamity">Destroyed by Calamity</option>
                                <option value="Upgrade">Obsolete / Facility Upgrade</option>
                                <option value="Uneconomical">Repair Uneconomical (&gt;50% Cost)</option>
                            </select>
                        </div>
                    )}

                    {/* Remarks */}
                    <div>
                        <input
                            type="text"
                            value={existingItem.remarks || ''}
                            onChange={(e) => setRoomModalData(prev => ({
                                ...prev,
                                items: prev.items.map(i => i.item_name === item.label ? { ...i, remarks: e.target.value } : i)
                            }))}
                            placeholder="Remarks / Specific Defects..."
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 outline-none focus:border-orange-300"
                            disabled={readOnly}
                        />
                    </div>
                </div>
            )}

            {/* Disabled State Explanation (if needed) */}
            {isExpanded && !isChecked && (
                <div className="px-3 pb-3 pt-0 text-xs text-slate-400 text-center italic">
                    Check the box to enable assessment for this item.
                </div>
            )}
        </div>
    );
};
