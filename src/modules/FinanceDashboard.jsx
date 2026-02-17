import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiSearch, FiDollarSign, FiCalendar, FiArrowLeft } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';


import BottomNav from './BottomNav';

const FinanceDashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    region: '', division: '', district: '', legislative_district: '',
    school_id: '', school_name: '', project_name: '',
    total_funds: '', fund_released: '', date_of_release: ''
  });
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Fetch Projects
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/finance/projects');
      const data = await res.json();
      if (res.ok) setProjects(data);
    } catch (err) {
      console.error("Failed to fetch finance projects", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSchoolLookup = async () => {
    // 1. Basic Validation (6 digits)
    if (!formData.school_id) {
        alert("Please enter a School ID.");
        return;
    }
    if (!/^\d{6}$/.test(formData.school_id)) {
        alert("Invalid School ID. It must be exactly 6 digits.");
        return;
    }
    
    setIsLookingUp(true);
    try {
        // 2. Fetch from Master List (Using existing Engineer Endpoint)
        const res = await fetch(`/api/school-profile/${formData.school_id}`);
        
        if (res.ok) {
            const school = await res.json(); // returns the row directly
            setFormData(prev => ({
                ...prev,
                school_name: school.school_name || '',
                region: school.region || '',
                division: school.division || '',
                district: school.district || school.municipality || '', // Fallback to municipality if district is missing
                legislative_district: school.leg_district || school.legislative_district || '' 
            }));
        } else {
            alert("School not found in the master database.");
            // Clear fields if invalid?
            setFormData(prev => ({
                ...prev,
                school_name: '',
                region: '',
                division: '',
                district: '',
                legislative_district: ''
            }));
        }
    } catch (err) {
        console.error("School lookup failed", err);
        alert("Connection error during lookup.");
    } finally {
        setIsLookingUp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/finance/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        alert("Project Created & Synced to LGU!");
        setShowModal(false);
        fetchProjects();
        setFormData({
            region: '', division: '', district: '', legislative_district: '',
            school_id: '', school_name: '', project_name: '',
            total_funds: '', fund_released: '', date_of_release: ''
        });
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      console.error("Submission error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div>
                <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                    Finance Dashboard
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                    Central Office Finance Monitoring
                </p>
            </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#004A99] hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg shadow-blue-500/30 transition-transform active:scale-95 flex items-center gap-2 text-sm font-bold"
        >
          <FiPlus /> Add Project
        </button>
      </div>

      <div className="p-6">
        {/* List */}
        {isLoading ? (
          <div className="text-center py-20">Loading...</div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold">
                <tr>
                  <th className="p-4">Project / School</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Funds</th>
                  <th className="p-4">Release Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {projects.map((p) => (
                  <tr key={p.finance_id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{p.project_name}</div>
                      <div className="text-slate-500 text-xs">{p.school_name} ({p.school_id})</div>
                    </td>
                    <td className="p-4 text-slate-600">
                        {p.region}, {p.division}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-400">Total</span>
                        <span className="font-mono text-[#004A99] font-bold">₱{Number(p.total_funds).toLocaleString()}</span>
                        <span className="text-xs text-slate-400 mt-1">Released</span>
                        <span className="font-mono text-emerald-600 font-bold">₱{Number(p.fund_released).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600">
                      {p.date_of_release ? new Date(p.date_of_release).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {projects.length === 0 && (
                <div className="p-10 text-center text-slate-400">No finance projects found.</div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
                initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
                <h2 className="text-lg font-bold text-slate-800">Add New Finance Project</h2>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                
                {/* 1. Project Request Info (Priority) */}
                <div className="space-y-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Project Name</label>
                        <input 
                            name="project_name" 
                            placeholder="Enter Project Name" 
                            required 
                            value={formData.project_name} 
                            onChange={handleInputChange} 
                            className="w-full p-3 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" 
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">School ID {isLookingUp && <span className="text-blue-500 animate-pulse">(Validating...)</span>}</label>
                            <div className="flex gap-2">
                                <div className="relative w-full">
                                    <input 
                                        name="school_id" 
                                        placeholder="6-Digit ID" 
                                        required 
                                        maxLength={6}
                                        value={formData.school_id} 
                                        onChange={(e) => {
                                            // Allow only numbers
                                            const val = e.target.value.replace(/\D/g, '');
                                            setFormData({ ...formData, school_id: val });
                                        }} 
                                        className="w-full p-3 border border-slate-200 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" 
                                    />
                                </div>
                                <button 
                                    type="button"
                                    onClick={handleSchoolLookup}
                                    disabled={isLookingUp || !formData.school_id}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 rounded-xl transition-colors disabled:opacity-50 text-sm"
                                >
                                    Validate
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">School Name</label>
                            <input 
                                name="school_name" 
                                placeholder="Auto-populated" 
                                readOnly
                                value={formData.school_name} 
                                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-100 text-slate-600 font-bold focus:outline-none cursor-not-allowed" 
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Auto-Populated Location Info */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Region</label>
                        <input name="region" value={formData.region} readOnly className="w-full bg-transparent font-bold text-slate-700 text-sm outline-none" placeholder="-" />
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Division</label>
                        <input name="division" value={formData.division} readOnly className="w-full bg-transparent font-bold text-slate-700 text-sm outline-none" placeholder="-" />
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">District</label>
                        <input name="district" value={formData.district} readOnly className="w-full bg-transparent font-bold text-slate-700 text-sm outline-none" placeholder="-" />
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Legislative Dist.</label>
                        <input name="legislative_district" value={formData.legislative_district} readOnly className="w-full bg-transparent font-bold text-slate-700 text-sm outline-none" placeholder="-" />
                     </div>
                </div>

                {/* 3. Funding Info */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Total Funds</label>
                        <input type="number" name="total_funds" required value={formData.total_funds} onChange={handleInputChange} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Fund Released</label>
                        <input type="number" name="fund_released" required value={formData.fund_released} onChange={handleInputChange} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Date Released</label>
                        <input type="date" name="date_of_release" required value={formData.date_of_release} onChange={handleInputChange} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-[#004A99] text-white font-bold rounded-xl hover:bg-blue-800 shadow-lg shadow-blue-900/20">Create & Sync</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav userRole="Central Office Finance" />
    </div>
  );
};

export default FinanceDashboard;
