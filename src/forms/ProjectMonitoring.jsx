import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ProjectMonitoring = ({ embedded }) => {
    const navigate = useNavigate();

    // Super User / Audit Context
    const isSuperUser = localStorage.getItem('userRole') === 'Super User';
    const auditTargetId = sessionStorage.getItem('targetSchoolId');
    const isAuditMode = isSuperUser && !!auditTargetId;
    const isReadOnly = isAuditMode;

    const [progress, setProgress] = useState(50);

    return (
        <div className={`min-h-screen font-sans pb-20 ${embedded ? '' : 'bg-slate-50'}`}>
            {!embedded && (
                <div className="bg-[#FDB913] p-6 pt-12 rounded-b-[2rem] shadow-lg text-white mb-6">
                    <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-yellow-100 hover:text-white">← Back</button>
                    <h1 className="text-2xl font-bold text-[#004A99]">Project Monitoring</h1>
                    <p className="text-[#004A99]/80 text-sm">Update status of ongoing works.</p>
                </div>
            )}

            <form className={`px-6 space-y-4 ${embedded ? '' : ''}`}>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Project Title</label>
                        <input type="text" disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" placeholder="e.g. Roof Repair Bldg A" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Contractor Name</label>
                        <input type="text" disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" />
                    </div>

                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="block text-sm font-bold text-gray-700">Completion Status</label>
                            <span className="text-sm font-bold text-blue-600">{progress}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="100"
                            value={progress}
                            onChange={(e) => setProgress(e.target.value)}
                            disabled={isReadOnly}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#004A99]"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Start Date</label>
                            <input type="date" disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Target End</label>
                            <input type="date" disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" />
                        </div>
                    </div>
                </div>

                {!isReadOnly && (
                    <button type="button" onClick={() => alert("Progress Updated")} className="w-full bg-[#004A99] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-800 transition">
                        Update Progress
                    </button>
                )}
            </form>
        </div>
    );
};

export default ProjectMonitoring;