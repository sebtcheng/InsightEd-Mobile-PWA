import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiMapPin, FiCalendar, FiDollarSign, FiFileText, FiImage, FiBox, FiCheckCircle } from 'react-icons/fi';

import BottomNav from './BottomNav';

const LguProjectDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    // Fetch Project Data
    const fetchProject = async () => {
        try {
            const res = await fetch(`/api/lgu/project/${id}`);
            if (res.ok) {
                const data = await res.json();
                setProject(data);
            } else {
                alert("Project not found");
                navigate('/lgu-dashboard');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProject();
    }, [id]);

    if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
    if (!project) return null;

    // Helper for currency
    const fmtMoney = (val) => val ? `₱${Number(val).toLocaleString()}` : '₱0.00';
    // Helper for date
    const fmtDate = (val) => val ? new Date(val).toLocaleDateString() : 'N/A';

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24">
            {/* Header */}
            <div className="bg-[#004A99] text-white pt-8 pb-12 px-6 rounded-b-[2rem] shadow-xl relative">
                <button onClick={() => navigate('/lgu-dashboard')} className="absolute top-8 left-6 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                    <FiArrowLeft />
                </button>
                <div className="mt-8">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase mb-2 backdrop-blur-md border border-white/10">
                                {project.project_status || 'Pending'}
                            </span>
                            <h1 className="text-2xl font-bold leading-tight mb-1">{project.project_name}</h1>
                            <p className="text-blue-200 text-sm flex items-center gap-1">
                                <FiMapPin size={14} /> {project.school_name} ({project.school_id})
                            </p>
                        </div>

                    </div>
                    
                    {/* Key Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <div className="bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
                            <p className="text-blue-200 text-xs font-bold uppercase">Progress</p>
                            <p className="text-2xl font-bold">{project.accomplishment_percentage || 0}%</p>
                            <div className="w-full bg-black/20 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div className="bg-emerald-400 h-full rounded-full" style={{width: `${project.accomplishment_percentage || 0}%`}}></div>
                            </div>
                        </div>
                        <div className="bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
                            <p className="text-blue-200 text-xs font-bold uppercase">Funds Utilized</p>
                            <p className="text-xl font-bold truncate">{fmtMoney(project.amount_utilized)}</p>
                            <p className="text-[10px] text-blue-200 mt-1">of {fmtMoney(project.fund_released)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 -mt-6 relative z-10 space-y-6">
                
                {/* 1. Location & Classification */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-2">
                        <FiMapPin className="text-blue-500" /> Location Details
                    </div>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                        <div>
                            <p className="text-slate-400 text-xs uppercase font-bold">Region</p>
                            <p className="font-semibold text-slate-700">{project.region || '-'}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs uppercase font-bold">Division</p>
                            <p className="font-semibold text-slate-700">{project.division || '-'}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs uppercase font-bold">Municipality</p>
                            <p className="font-semibold text-slate-700">{project.municipality || '-'}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs uppercase font-bold">District</p>
                            <p className="font-semibold text-slate-700">{project.district || '-'}</p>
                        </div>
                        <div className="col-span-2">
                             <p className="text-slate-400 text-xs uppercase font-bold">Legislative District</p>
                             <p className="font-semibold text-slate-700">{project.legislative_district || '-'}</p>
                        </div>
                    </div>
                </div>

                {/* 2. Financial Overview */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-2">
                        <FiDollarSign className="text-emerald-500" /> Financials
                    </div>
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Total Allocation</span>
                            <span className="font-bold text-slate-800">{fmtMoney(project.project_allocation || project.total_funds)}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-slate-500">Batch of Funds</span>
                            <span className="font-bold text-slate-800">{project.batch_of_funds || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Funds Released</span>
                            <span className="font-bold text-emerald-600">{fmtMoney(project.fund_released)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 italic">
                            <span>Date Released</span>
                            <span>{fmtDate(project.date_of_release)}</span>
                        </div>
                        
                        <div className="pt-2 border-t border-slate-50">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Liquidated Amount</span>
                                <span className="font-bold text-blue-600">{fmtMoney(project.liquidated_amount)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 italic">
                                <span>Date Liquidated</span>
                                <span>{fmtDate(project.liquidation_date)}</span>
                            </div>
                            <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-blue-400 h-full" style={{width: `${project.percentage_liquidated || 0}%`}}></div>
                            </div>
                             <p className="text-[10px] text-right mt-1 text-blue-400 font-bold">{project.percentage_liquidated || 0}% Liquidated</p>
                        </div>

                         <div className="pt-2 border-t border-slate-50 grid grid-cols-2 gap-2">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Tranches</p>
                                <p className="font-bold text-slate-700">{project.number_of_tranches || 0}</p>
                            </div>
                             <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Amt/Tranche</p>
                                <p className="font-bold text-slate-700">{fmtMoney(project.amount_per_tranche)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Sched. Release</p>
                                <p className="font-bold text-slate-700">{project.schedule_of_fund_release || '-'}</p>
                            </div>
                         </div>
                    </div>
                </div>

                {/* 3. Procurement & Contract */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-2">
                        <FiBox className="text-amber-500" /> Procurement This
                    </div>
                    <div className="space-y-3 text-sm">
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Contractor</p>
                            <p className="font-bold text-slate-800 text-lg">{project.contractor_name || 'TBD'}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Mode</p>
                                <p className="font-medium text-slate-700">{project.mode_of_procurement || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">PhilGEPS Ref</p>
                                <p className="font-medium text-slate-700">{project.philgeps_ref_no || '-'}</p>
                            </div>
                             <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">PCAB License</p>
                                <p className="font-medium text-slate-700">{project.pcab_license_no || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Resolution No.</p>
                                <p className="font-medium text-slate-700">{project.lsb_resolution_no || '-'}</p>
                            </div>
                        </div>

                         <div className="bg-amber-50 p-3 rounded-lg mt-2 space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-amber-700 font-medium">Approved Budget</span>
                                <span className="font-bold text-amber-900">{fmtMoney(project.approved_contract_budget)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-amber-700 font-medium">Bid Amount</span>
                                <span className="font-bold text-amber-900">{fmtMoney(project.bid_amount)}</span>
                            </div>
                             <div className="flex justify-between text-xs">
                                <span className="text-amber-700 font-medium">Contract Duration</span>
                                <span className="font-bold text-amber-900">{project.contract_duration || '-'} Days</span>
                            </div>
                         </div>
                    </div>
                </div>

                {/* 4. Timeline */}
                 <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-2">
                        <FiCalendar className="text-purple-500" /> Key Dates
                    </div>
                    <div className="space-y-4 relative before:absolute before:left-1.5 before:top-2 before:h-full before:w-0.5 before:bg-slate-100 pl-6">
                        {[
                            { label: 'Notice of Award', date: project.date_notice_of_award },
                            { label: 'Contract Signing', date: project.date_contract_signing },
                            { label: 'Notice to Proceed', date: project.notice_to_proceed },
                            { label: 'Construction Start', date: project.construction_start_date },
                             { label: 'Target Completion', date: project.target_completion_date },
                        ].map((item, idx) => (
                            <div key={idx} className="relative">
                                <div className="absolute -left-[1.65rem] top-1.5 w-3 h-3 rounded-full bg-white border-2 border-slate-300"></div>
                                <p className="text-xs font-bold text-slate-500 uppercase">{item.label}</p>
                                <p className="text-sm font-bold text-slate-800">{fmtDate(item.date)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 5. Documents */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-2">
                        <FiFileText className="text-blue-500" /> Documents
                    </div>
                    <div className="space-y-2">
                        {[
                            { type: 'POW', url: project.pow_pdf },
                            { type: 'DUPA', url: project.dupa_pdf },
                            { type: 'CONTRACT', url: project.contract_pdf }
                        ].map((doc, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                <span className="text-sm font-medium text-slate-600">{doc.type}</span>
                                {doc.url ? (
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-200 transaction-colors">
                                        VIEW PDF
                                    </a>
                                ) : (
                                    <span className="text-xs font-bold text-slate-400 bg-slate-200 px-3 py-1.5 rounded-lg">MISSING</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 6. Remarks */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                     <p className="text-xs font-bold text-slate-400 uppercase mb-2">Other Remarks / Delay Nature</p>
                     <p className="text-sm text-slate-700 italic">
                        {project.other_remarks || project.nature_of_delay || "No remarks provided."}
                     </p>
                </div>

                <div className="h-6"></div>
            </div>

            <BottomNav userRole="Local Government Unit" />


        </div>
    );
};

export default LguProjectDetails;
