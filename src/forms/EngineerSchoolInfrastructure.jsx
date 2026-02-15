import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SchoolInfrastructure = ({ embedded }) => {
    const navigate = useNavigate();

    // Super User / Audit Context
    const isSuperUser = localStorage.getItem('userRole') === 'Super User';
    const auditTargetId = sessionStorage.getItem('targetSchoolId');
    const isAuditMode = isSuperUser && !!auditTargetId;
    const isReadOnly = isAuditMode;

    // Dummy State
    const [formData, setFormData] = useState({
        buildingName: '',
        constructionYear: '',
        totalClassrooms: '',
        condition: 'Good',
        hasElectricity: true,
        hasWater: true
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        alert("Infrastructure Data Saved (Dummy)");
        console.log(formData);
        navigate(-1); // Go back
    };

    return (
        <div className={`min-h-screen font-sans pb-20 ${embedded ? '' : 'bg-slate-50'}`}>
            {/* Header */}
            {!embedded && (
                <div className="bg-[#004A99] p-6 pt-12 rounded-b-[2rem] shadow-lg text-white mb-6">
                    <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-blue-200 hover:text-white">
                        ← Back
                    </button>
                    <h1 className="text-2xl font-bold">School Infrastructure</h1>
                    <p className="text-blue-200 text-sm">Log building and classroom details.</p>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className={`px-6 space-y-4 ${embedded ? '' : ''}`}>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Building Name / Number</label>
                        <input type="text" name="buildingName" value={formData.buildingName} onChange={handleChange} disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500" placeholder="e.g. Marcos Building" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Year Built</label>
                            <input type="number" name="constructionYear" value={formData.constructionYear} onChange={handleChange} disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" placeholder="2005" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Classrooms</label>
                            <input type="number" name="totalClassrooms" value={formData.totalClassrooms} onChange={handleChange} disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200" placeholder="0" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Building Condition</label>
                        <select name="condition" value={formData.condition} onChange={handleChange} disabled={isReadOnly} className="w-full p-3 bg-slate-50 rounded-xl border border-gray-200">
                            <option value="Good">Good (Safe)</option>
                            <option value="Minor Repair">Needs Minor Repair</option>
                            <option value="Major Repair">Needs Major Repair</option>
                            <option value="Condemned">Condemned (Unsafe)</option>
                        </select>
                    </div>

                    <div className="flex gap-6 mt-2">
                        <label className="flex items-center gap-2 text-gray-700">
                            <input type="checkbox" name="hasElectricity" checked={formData.hasElectricity} onChange={handleChange} disabled={isReadOnly} className="w-5 h-5 accent-blue-600" />
                            Has Electricity
                        </label>
                        <label className="flex items-center gap-2 text-gray-700">
                            <input type="checkbox" name="hasWater" checked={formData.hasWater} onChange={handleChange} disabled={isReadOnly} className="w-5 h-5 accent-blue-600" />
                            Has Water Access
                        </label>
                    </div>
                </div>

                {!isReadOnly && (
                    <button type="submit" className="w-full bg-[#004A99] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-800 transition">
                        Save Record
                    </button>
                )}
            </form>
        </div>
    );
};

export default SchoolInfrastructure;