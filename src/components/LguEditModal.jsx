import React, { useState, useEffect } from 'react';
import { FiSave, FiX, FiSearch, FiUpload, FiFileText } from 'react-icons/fi';

const LguEditModal = ({ isOpen, onClose, project, onUpdateSuccess }) => {
    const [formData, setFormData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false);

    useEffect(() => {
        if (project) {
            // Apply formatting to initial numeric values
            const formatted = { ...project };
            ['total_funds', 'fund_released', 'amount_utilized', 'approved_contract_budget', 'bid_amount', 'amount_per_tranche', 'liquidated_amount'].forEach(key => {
                if (formatted[key]) {
                     formatted[key] = formatted[key].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                }
            });
            setFormData(formatted);
        }
    }, [project, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNumberChange = (e) => {
        const { name, value } = e.target;
        // Allow numbers and decimal points only
        const rawVal = value.replace(/[^0-9.]/g, '');
        // Format with commas
        const formatted = rawVal.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        setFormData(prev => ({ ...prev, [name]: formatted }));
    };

    const handleFileChange = async (e, fieldName) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert("File is too large (Max 5MB)");
                return;
            }
             // Convert to Base64
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, [fieldName]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

     const handleSchoolLookup = async () => {
        if (!formData.school_id || formData.school_id.length !== 6) {
            alert("Please enter a valid 6-digit School ID.");
            return;
        }

        setIsLookingUp(true);
        try {
            const res = await fetch(`/api/school-profile/${formData.school_id}`);
            if (res.ok) {
                const school = await res.json();
                setFormData(prev => ({
                    ...prev,
                    school_name: school.school_name || '',
                    region: school.region || '',
                    division: school.division || '',
                    district: school.district || school.municipality || '',
                    latitude: school.latitude || prev.latitude,
                    longitude: school.longitude || prev.longitude
                }));
                alert(`✅ School Found: ${school.school_name}`);
            } else {
                alert("❌ School ID not found in master list.");
            }
        } catch (err) {
            console.error("School lookup failed", err);
            alert("Connection error during lookup.");
        } finally {
            setIsLookingUp(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
             // Clean numbers before sending
            const cleanData = { ...formData };
            ['total_funds', 'fund_released', 'amount_utilized', 'approved_contract_budget', 'bid_amount', 'amount_per_tranche', 'liquidated_amount'].forEach(key => {
                if (cleanData[key]) {
                    cleanData[key] = cleanData[key].toString().replace(/,/g, '');
                }
            });

            // Append-only logic: backend handles the new ID creation.
            const payload = {
                ...cleanData,
                root_project_id: formData.root_project_id || formData.lgu_project_id || formData.project_id
            };

            const res = await fetch('/api/lgu/project/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                alert('Project Updated Successfully!');
                onUpdateSuccess(data.new_project_id);
            } else {
                alert('Failed to update project.');
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    // Helper to render input fields
    const renderInput = (label, name, type = "text", placeholder = "") => {
        if (type === "number") {
             return (
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
                    <input 
                        type="text" // Treat as text for formatting
                        name={name} 
                        value={formData[name] || ''} 
                        onChange={handleNumberChange}
                        placeholder={placeholder}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004A99] focus:border-transparent transition-all"
                    />
                </div>
            );
        }
        return (
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
                <input 
                    type={type} 
                    name={name} 
                    value={formData[name] || ''} 
                    onChange={handleChange}
                    placeholder={placeholder}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004A99] focus:border-transparent transition-all"
                />
            </div>
        );
    };

     const renderTextarea = (label, name) => (
        <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
            <textarea 
                name={name} 
                value={formData[name] || ''} 
                onChange={handleChange}
                rows={3}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004A99] focus:border-transparent transition-all resize-none"
            />
        </div>
    );
    const renderSelect = (label, name, options) => (
        <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
            <select
                 name={name} 
                 value={formData[name] || ''} 
                 onChange={handleChange}
                 className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004A99] focus:border-transparent transition-all"
            >
                <option value="">Select...</option>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );

    const renderFileUpload = (label, name) => (
        <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
            <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer">
                    <div className="w-full p-2 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                        <FiUpload />
                        <span className="truncate">{formData[name] ? (formData[name].startsWith('data:') ? 'New File Selected' : 'File Attached') : 'Upload PDF'}</span>
                    </div>
                    <input 
                        type="file" 
                        accept="application/pdf"
                        onChange={(e) => handleFileChange(e, name)}
                        className="hidden"
                    />
                </label>
                {formData[name] && !formData[name].startsWith('data:') && (
                    <a href={formData[name]} target="_blank" rel="noreferrer" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="View Current">
                        <FiFileText />
                    </a>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-[#004A99] text-white">
                    <div>
                        <h2 className="font-bold text-lg">Update Project</h2>
                        <p className="text-[10px] opacity-80 uppercase tracking-wide">Append-Only History Mode</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <FiX />
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* 1. Status Section (Highlighted) */}
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                        <h3 className="text-xs font-bold text-blue-800 uppercase flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            Current Status & Progress
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {renderSelect("Project Status", "project_status", ["Not Yet Started", "Ongoing", "Completed", "Suspended"])}
                            {renderInput("Accomplishment (%)", "accomplishment_percentage", "number")}
                            {renderInput("Status Date", "status_as_of_date", "date")}
                            {renderInput("Amount Utilized", "amount_utilized", "number")}
                        </div>
                         {renderTextarea("Remarks / Update Context", "other_remarks")}
                    </div>

                    {/* 2. Project Identification & Location */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase mb-3 border-b pb-2">Project Identity</h3>
                        <div className="space-y-4">
                            {renderInput("Project Name", "project_name")}
                            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                                {renderInput("School ID", "school_id")}
                                <button 
                                    onClick={handleSchoolLookup}
                                    disabled={isLookingUp}
                                    className="mb-[1px] p-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                                    title="Search School"
                                >
                                    {isLookingUp ? '...' : <FiSearch />}
                                </button>
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                {renderInput("School Name", "school_name")}
                                {renderInput("Source Agency", "source_agency")}
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {renderInput("Region", "region")}
                                {renderInput("Division", "division")}
                                {renderInput("Municipality", "municipality")}
                                {renderInput("District", "district")}
                                {renderInput("Legislative District", "legislative_district")}
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                {renderInput("Latitude", "latitude")}
                                {renderInput("Longitude", "longitude")}
                            </div>
                        </div>
                    </div>

                    {/* 3. Financial Details */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase mb-3 border-b pb-2">Financials</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            {renderInput("Total Allocation (Funds)", "total_funds", "number")}
                            {renderInput("Source of Funds", "batch_of_funds")}
                        </div>
                        
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Fund Release & Liquidation</h4>
                         <div className="grid grid-cols-2 gap-4 mb-4">
                             {renderInput("Fund Released", "fund_released", "number")}
                             {renderInput("Date Released", "date_of_release", "date")}
                             {renderInput("Liquidated Amount", "liquidated_amount", "number")}
                             {renderInput("Date Liquidated", "liquidation_date", "date")}
                         </div>

                         <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Tranches & MOA</h4>
                         <div className="grid grid-cols-3 gap-4">
                             {renderInput("MOA Ref No.", "moa_ref_no")}
                             {renderInput("MOA Date", "moa_date", "date")}
                             {renderInput("Validity Period", "validity_period")}
                             {renderInput("Sched. of Release", "schedule_of_fund_release")}
                             {renderInput("No. of Tranches", "number_of_tranches", "number")}
                             {renderInput("Amount / Tranche", "amount_per_tranche", "number")}
                         </div>
                    </div>

                    {/* 4. Timeline (Dates) */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase mb-3 border-b pb-2">Critical Dates</h3>
                        <div className="grid grid-cols-3 gap-4">
                             {renderInput("Date Approved POW", "date_approved_pow", "date")}
                             {renderInput("Notice of Award", "date_notice_of_award", "date")}
                             {renderInput("Contract Signing", "date_contract_signing", "date")}
                             {renderInput("Notice to Proceed", "notice_to_proceed", "date")}
                             {renderInput("Construction Start", "construction_start_date", "date")}
                             {renderInput("Target Completion", "target_completion_date", "date")}
                             {renderInput("Actual Completion", "actual_completion_date", "date")}
                        </div>
                    </div>

                     {/* 5. Procurement */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase mb-3 border-b pb-2">Procurement & Contractor</h3>
                         <div className="grid grid-cols-2 gap-4 mb-4">
                             {renderSelect("Mode of Procurement", "mode_of_procurement", ["Public Bidding", "Negotiated Procurement", "Shopping", "Direct Contracting"])}
                             {renderInput("Contractor Name", "contractor_name")}
                         </div>
                         <div className="grid grid-cols-3 gap-4">
                             {renderInput("PhilGEPS Ref", "philgeps_ref_no")}
                             {renderInput("PCAB License", "pcab_license_no")}
                             {renderInput("LSB Resolution", "lsb_resolution_no")}
                             {renderInput("Contract Duration", "contract_duration")}
                             {renderInput("Approved Budget", "approved_contract_budget", "number")}
                             {renderInput("Bid Amount", "bid_amount", "number")}
                         </div>
                    </div>

                    {/* 6. Documents (PDFs) */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase mb-3 border-b pb-2">Document Attachments (PDF)</h3>
                        <div className="space-y-3">
                            {renderFileUpload("Program of Work (POW)", "pow_pdf")}
                            {renderFileUpload("Detailed Unit Price Analysis (DUPA)", "dupa_pdf")}
                            {renderFileUpload("Contract Agreement", "contract_pdf")}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors uppercase tracking-wider">Cancel</button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#004A99] hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider flex items-center gap-2"
                    >
                         {isSaving ? 'Saving...' : <><FiSave size={14} /> Update Project</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LguEditModal;
