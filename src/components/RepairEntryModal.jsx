import React from 'react';
import { FiX } from 'react-icons/fi';

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
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Repair Checklist</label>
                <div className="grid grid-cols-2 gap-3 mb-6">
                    {repairItems.map(item => (
                        <label key={item.key} className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all active:scale-95 ${roomModalData[item.key]
                            ? 'bg-orange-50 border-orange-300 shadow-sm ring-1 ring-orange-200'
                            : 'bg-slate-50 border-slate-200 hover:border-orange-200'
                            }`}>
                            <input
                                type="checkbox"
                                checked={roomModalData[item.key]}
                                onChange={() => !readOnly && setRoomModalData(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                                className="w-5 h-5 accent-orange-500 rounded-lg cursor-pointer disabled:cursor-not-allowed"
                                disabled={readOnly}
                            />
                            <span className={`text-sm font-bold ${roomModalData[item.key] ? 'text-orange-700' : 'text-slate-600'
                                }`}>{item.label}</span>
                        </label>
                    ))}
                </div>

                {/* Remarks */}
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Additional Remarks</label>
                    <textarea
                        value={roomModalData.remarks}
                        onChange={(e) => setRoomModalData(prev => ({ ...prev, remarks: e.target.value }))}
                        rows="3"
                        placeholder="Optional details or specific observations..."
                        disabled={readOnly}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:ring-4 focus:ring-orange-100 outline-none resize-none transition-all disabled:opacity-70 disabled:bg-slate-100"
                    />
                </div>

                {/* Modal Buttons */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors text-base"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={readOnly ? onClose : onSave}
                        className={`flex-2 py-4 px-8 rounded-2xl font-bold shadow-lg text-base flex-grow transition-colors ${readOnly
                            ? 'bg-slate-400 text-white hover:bg-slate-500 shadow-slate-400/20'
                            : 'bg-orange-500 text-white shadow-orange-500/20 hover:bg-orange-600'
                            }`}
                    >
                        {readOnly ? 'Close' : (editingRoomIdx !== null ? 'Save Changes' : 'Add Assessment')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RepairEntryModal;
