import React, { useState, useEffect } from 'react';
import { FiMapPin, FiMaximize, FiPlusCircle, FiCheck, FiX } from 'react-icons/fi';

const MapTutorialModal = ({ isOpen, onClose, onDoNotShowAgain }) => {
    const [doNotShow, setDoNotShow] = useState(false);

    if (!isOpen) return null;

    const handleClose = () => {
        if (doNotShow) {
            onDoNotShowAgain();
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 dark:border-slate-700 transform transition-all scale-100">

                {/* Header */}
                <div className="bg-[#004A99] p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 pointer-events-none blur-2xl"></div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span>🗺️</span> Buildable Space Guide
                    </h2>
                    <p className="text-blue-200 text-xs mt-1">How to map your school's available space.</p>
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
                        <FiX size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">

                    {/* Step 1 */}
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-lg border border-blue-100">
                            1
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1 flex items-center gap-2">
                                <FiMapPin className="text-red-500" /> Pin Location
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Tap anywhere on the map to drop a pin. You can drag the pin to adjust its exact location.
                            </p>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-lg border border-blue-100">
                            2
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1 flex items-center gap-2">
                                <FiMaximize className="text-emerald-500" /> Enter Dimensions
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Input the <strong>Length</strong> and <strong>Width</strong> in meters. The area (sqm) will look auto-calculate.
                            </p>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-lg border border-blue-100">
                            3
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1 flex items-center gap-2">
                                <FiPlusCircle className="text-amber-500" /> Add & Repeat
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Click <strong>"Record Space"</strong> to save it to your list. Repeat for other buildable areas.
                            </p>
                        </div>
                    </div>

                    {/* Checkbox */}
                    <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${doNotShow ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                {doNotShow && <FiCheck size={12} className="text-white" />}
                            </div>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={doNotShow}
                                onChange={(e) => setDoNotShow(e.target.checked)}
                            />
                            <span className="text-xs font-bold text-slate-500 group-hover:text-blue-600 transition-colors">Don't show this guide again</span>
                        </label>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                        onClick={handleClose}
                        className="bg-[#004A99] hover:bg-blue-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all w-full sm:w-auto"
                    >
                        Got it, Start Mapping!
                    </button>
                </div>

            </div>
        </div>
    );
};

export default MapTutorialModal;
