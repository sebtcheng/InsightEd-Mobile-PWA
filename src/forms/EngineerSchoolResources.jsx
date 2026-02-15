import React from 'react';
import { useNavigate } from 'react-router-dom';

const SchoolResources = ({ embedded }) => {
    const navigate = useNavigate();

    // Super User / Audit Context
    const isSuperUser = localStorage.getItem('userRole') === 'Super User';
    const auditTargetId = sessionStorage.getItem('targetSchoolId');
    const isAuditMode = isSuperUser && !!auditTargetId;
    const isReadOnly = isAuditMode;

    return (
        <div className={`min-h-screen font-sans pb-20 ${embedded ? '' : 'bg-slate-50'}`}>
            {!embedded && (
                <div className="bg-violet-600 p-6 pt-12 rounded-b-[2rem] shadow-lg text-white mb-6">
                    <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-violet-200 hover:text-white">← Back</button>
                    <h1 className="text-2xl font-bold">School Resources</h1>
                    <p className="text-violet-200 text-sm">Utilities and Connectivity Inventory.</p>
                </div>
            )}

            <form className={`px-6 space-y-4 ${embedded ? '' : ''}`}>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Resource Type</label>
                            <select disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200">
                                <option>Electricity</option>
                                <option>Water Supply</option>
                                <option>Internet / WiFi</option>
                                <option>Solar Panel</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                            <select disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200">
                                <option>Functional</option>
                                <option>Intermittent</option>
                                <option>Not Working</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Provider Name</label>
                        <input type="text" disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" placeholder="e.g. Meralco / PLDT" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Avg. Monthly Cost</label>
                        <input type="number" disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" placeholder="0.00" />
                    </div>
                </div>

                {!isReadOnly && (
                    <button type="button" onClick={() => alert("Resource Added")} className="w-full bg-violet-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-violet-700 transition">
                        Save Resource
                    </button>
                )}
            </form>
        </div>
    );
};

export default SchoolResources;