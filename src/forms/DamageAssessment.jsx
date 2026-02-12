import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DamageAssessment = ({ embedded }) => {
    const navigate = useNavigate();

    // Super User / Audit Context
    const isSuperUser = localStorage.getItem('userRole') === 'Super User';
    const auditTargetId = sessionStorage.getItem('targetSchoolId');
    const isAuditMode = isSuperUser && !!auditTargetId;

    const [formData, setFormData] = useState({
        incidentDate: '',
        damageType: 'Natural Disaster',
        severity: 'Minor',
        description: '',
        estimatedCost: ''
    });

    const isReadOnly = isAuditMode;

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    return (
        <div className={`min-h-screen font-sans pb-20 ${embedded ? '' : 'bg-slate-50'}`}>
            {!embedded && (
                <div className="bg-red-700 p-6 pt-12 rounded-b-[2rem] shadow-lg text-white mb-6">
                    <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-red-200 hover:text-white">← Back</button>
                    <h1 className="text-2xl font-bold">Damage Assessment</h1>
                    <p className="text-red-200 text-sm">Report infrastructure damages immediately.</p>
                </div>
            )}

            <form className={`px-6 space-y-4 ${embedded ? '' : ''}`}>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Date of Incident</label>
                        <input type="date" name="incidentDate" onChange={handleChange} disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                            <select name="damageType" onChange={handleChange} disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200">
                                <option>Natural Disaster</option>
                                <option>Fire</option>
                                <option>Vandalism</option>
                                <option>Wear & Tear</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Severity</label>
                            <select name="severity" onChange={handleChange} disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200">
                                <option>Minor</option>
                                <option>Major</option>
                                <option>Critical</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Estimated Cost (PHP)</label>
                        <input type="number" name="estimatedCost" onChange={handleChange} disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" placeholder="0.00" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Description of Damage</label>
                        <textarea name="description" rows="3" onChange={handleChange} disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" placeholder="Describe the affected area..."></textarea>
                    </div>

                    {!isReadOnly && (
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center text-gray-400">
                            <span>📷 Upload Photo Evidence</span>
                        </div>
                    )}
                </div>

                {!isReadOnly && (
                    <button type="button" onClick={() => alert("Report Submitted!")} className="w-full bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-red-800 transition">
                        Submit Damage Report
                    </button>
                )}
            </form>
        </div>
    );
};

export default DamageAssessment;