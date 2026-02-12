import React from 'react';
import { useNavigate } from 'react-router-dom';

const SiteInspection = ({ embedded }) => {
    const navigate = useNavigate();

    // Super User / Audit Context
    const isSuperUser = localStorage.getItem('userRole') === 'Super User';
    const auditTargetId = sessionStorage.getItem('targetSchoolId');
    const isAuditMode = isSuperUser && !!auditTargetId;
    const isReadOnly = isAuditMode;

    return (
        <div className={`min-h-screen font-sans pb-20 ${embedded ? '' : 'bg-slate-50'}`}>
            {!embedded && (
                <div className="bg-emerald-600 p-6 pt-12 rounded-b-[2rem] shadow-lg text-white mb-6">
                    <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-emerald-100 hover:text-white">← Back</button>
                    <h1 className="text-2xl font-bold">Site Inspection</h1>
                    <p className="text-emerald-100 text-sm">Safety compliance and validation.</p>
                </div>
            )}

            <form className={`px-6 space-y-4 ${embedded ? '' : ''}`}>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Site / Location</label>
                        <input type="text" disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" placeholder="e.g. Perimeter Fence" />
                    </div>

                    <div className="space-y-3 mt-4">
                        <p className="font-bold text-gray-800 border-b pb-2">Safety Checklist</p>

                        {["Proper PPE Worn", "Warning Signs Posted", "No Hazardous Materials", "Structural Integrity Check"].map((item, idx) => (
                            <label key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <span className="text-sm text-gray-700">{item}</span>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-1 text-xs"><input type="radio" name={`check${idx}`} disabled={isReadOnly} className="accent-emerald-600" /> Yes</label>
                                    <label className="flex items-center gap-1 text-xs"><input type="radio" name={`check${idx}`} disabled={isReadOnly} className="accent-red-600" /> No</label>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Inspector Recommendations</label>
                        <textarea rows="3" disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" placeholder="Notes..."></textarea>
                    </div>
                </div>

                {!isReadOnly && (
                    <button type="button" onClick={() => alert("Inspection Logged")} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-emerald-700 transition">
                        Submit Inspection
                    </button>
                )}
            </form>
        </div>
    );
};

export default SiteInspection;