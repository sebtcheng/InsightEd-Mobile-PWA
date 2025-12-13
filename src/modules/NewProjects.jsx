import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';

// Helper component for Section Headers
const SectionHeader = ({ title, icon }) => (
    <div className="flex items-center gap-3 text-slate-700 font-bold text-sm uppercase mt-6 mb-3">
        <span className="text-xl">{icon}</span>
        <h2>{title}</h2>
    </div>
);

const NewProjects = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false); 

    const [formData, setFormData] = useState({
        // Basic Info
        region: '',
        division: '',
        schoolName: '',
        projectName: '', 
        schoolId: '',
        
        // Status & Progress
        status: 'Not Yet Started',
        accomplishmentPercentage: 0, 
        statusAsOfDate: '',

        // Timelines
        targetCompletionDate: '',
        actualCompletionDate: '',
        noticeToProceed: '',

        // Contractors & Funds
        contractorName: '',
        projectAllocation: '', 
        batchOfFunds: '',

        // Remarks
        otherRemarks: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        setFormData(prev => {
            let newData = { ...prev, [name]: value };

            // --- LOGIC CHANGE: AUTO-SET PERCENTAGE ---
            if (name === 'status') {
                if (value === 'Not Yet Started' || value === 'Under Procurement') {
                    // Reset to 0 for pre-construction statuses
                    newData.accomplishmentPercentage = 0;
                } else if (value === 'Completed' || value === 'For Final Inspection') {
                    // SET TO 100 for Completed and For Final Inspection (UPDATED)
                    newData.accomplishmentPercentage = 100;
                }
                // When status is set to 'Ongoing', the accomplishmentPercentage is naturally 
                // preserved from the previous state via the spread operator.
            }
            
            // School ID Validation/Handling
            if (name === 'schoolId') {
                // Ensure it's an integer and limit length to 6 digits
                const integerValue = value.replace(/\D/g, ''); // Remove non-digits
                // Only update the value if it's 6 digits or less
                newData.schoolId = integerValue.slice(0, 6);
            }

            return newData;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Final validation check before submitting
        if (formData.schoolId.length !== 6 || isNaN(parseInt(formData.schoolId, 10))) {
            alert("School ID must be exactly 6 digits.");
            setIsSubmitting(false);
            return;
        }

        console.log("Attempting to save new project with data:", formData);

        try {
            const response = await fetch('http://localhost:3000/api/save-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Server error: Failed to save project.');
            }

            const result = await response.json();
            console.log('Project saved successfully!', result.project);
            alert('Project saved successfully!');
            navigate('/engineer-dashboard');
            
        } catch (error) {
            console.error('Submission Error:', error);
            alert(`Failed to save project. Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper to check if percentage input should be disabled
    const isPercentageInputDisabled = formData.status === 'Not Yet Started' || 
                                      formData.status === 'Under Procurement' ||
                                      formData.status === 'Completed' ||
                                      formData.status === 'For Final Inspection';

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 font-sans pb-24">
                
                {/* Header */}
                <div className="bg-[#004A99] pt-8 pb-16 px-6 rounded-b-[2rem] shadow-xl">
                    <div className="flex items-center gap-3 text-white mb-4">
                        <button onClick={() => navigate(-1)} className="p-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-bold">New Project Entry</h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 -mt-10">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">

                        {/* 1. Project Identification */}
                        <SectionHeader title="Project Identification" icon="🏷️" />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name <span className="text-red-500">*</span></label>
                                <input name="projectName" value={formData.projectName} onChange={handleChange} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">School Name <span className="text-red-500">*</span></label>
                                <input name="schoolName" value={formData.schoolName} onChange={handleChange} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">School ID (6 Digits) <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    inputMode="numeric"
                                    name="schoolId" 
                                    value={formData.schoolId} 
                                    onChange={handleChange} 
                                    required 
                                    maxLength="6" 
                                    pattern="\d{6}" 
                                    title="School ID must be exactly 6 digits"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" 
                                />
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Region</label>
                                    <input name="region" value={formData.region} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Division</label>
                                    <input name="division" value={formData.division} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                                </div>
                            </div>
                        </div>

                        {/* 2. Status and Progress */}
                        <SectionHeader title="Status and Progress" icon="🚧" />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Status</label>
                                <select name="status" value={formData.status} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500">
                                    <option value="Not Yet Started">Not Yet Started</option>
                                    <option value="Under Procurement">Under Procurement</option>
                                    <option value="Ongoing">Ongoing</option>
                                    <option value="For Final Inspection">For Final Inspection</option> 
                                    <option value="Completed">Completed</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Accomplishment Percentage (%)</label>
                                <input 
                                    type="number" 
                                    name="accomplishmentPercentage" 
                                    value={formData.accomplishmentPercentage} 
                                    onChange={handleChange} 
                                    min="0" 
                                    max="100" 
                                    // Disable when pre-construction, completed, or for final inspection
                                    disabled={isPercentageInputDisabled}
                                    placeholder={isPercentageInputDisabled ? "" : "e.g. 50"}
                                    className={`w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors ${
                                        isPercentageInputDisabled ? 'bg-slate-200 text-slate-500 font-bold cursor-not-allowed' : 'bg-slate-50'
                                    }`} 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status As Of Date</label>
                                <input type="date" name="statusAsOfDate" value={formData.statusAsOfDate} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>

                        {/* 3. Timelines */}
                        <SectionHeader title="Timelines" icon="📅" />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Completion Date</label>
                                <input type="date" name="targetCompletionDate" value={formData.targetCompletionDate} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Actual Completion Date</label>
                                <input type="date" name="actualCompletionDate" value={formData.actualCompletionDate} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notice to Proceed Date</label>
                                <input type="date" name="noticeToProceed" value={formData.noticeToProceed} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>

                        {/* 4. Funds and Contractor */}
                        <SectionHeader title="Funds and Contractor" icon="💰" />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Allocation (PHP)</label>
                                <input type="number" name="projectAllocation" value={formData.projectAllocation} onChange={handleChange} placeholder="e.g. 15000000" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Batch of Funds</label>
                                <input name="batchOfFunds" value={formData.batchOfFunds} onChange={handleChange} placeholder="e.g. Batch 1" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contractor Name</label>
                                <input name="contractorName" value={formData.contractorName} onChange={handleChange} placeholder="e.g. ABC Builders" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>

                        {/* 5. Other Remarks */}
                        <SectionHeader title="Other Remarks" icon="💬" />
                        <div>
                            <textarea 
                                name="otherRemarks" 
                                rows="3" 
                                value={formData.otherRemarks} 
                                onChange={handleChange} 
                                placeholder="Any specific issues or notes..." 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" 
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2 border-t border-slate-50">
                        <button type="button" onClick={() => navigate(-1)} className="flex-1 py-3 text-slate-600 font-bold text-sm bg-slate-100 rounded-xl hover:bg-slate-200 transition">
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting} 
                            className="flex-1 py-3 text-white font-bold text-sm bg-[#004A99] rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </PageTransition>
    );
};

export default NewProjects;