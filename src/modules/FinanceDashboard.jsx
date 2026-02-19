import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiSearch, FiDollarSign, FiCalendar, FiArrowLeft, FiEdit2 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from './BottomNav';

const FinanceDashboard = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedId, setSelectedId] = useState(null);

    const [formData, setFormData] = useState({
        region: '', division: '', district: '', legislative_district: '', municipality: '',
        school_id: '', school_name: '', project_name: '',
        total_funds: '', fund_released: '', date_of_release: ''
    });
    const [isLookingUp, setIsLookingUp] = useState(false);
    
    // Search State
    const [searchTerm, setSearchTerm] = useState('');

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

    // Filter Projects
    const filteredProjects = projects.filter(p => 
        p.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.school_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.school_id?.includes(searchTerm)
    );

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (['total_funds', 'fund_released'].includes(name)) {
            // Remove non-digits/decimals first
            const rawValue = value.replace(/[^0-9.]/g, '');
            // Format for display
            const formatted = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            setFormData({ ...formData, [name]: formatted });
        } else {
            setFormData({ ...formData, [name]: value });
        }
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
                    district: school.district || '',
                    municipality: school.municipality || school.city || school.town || '', // Try multiple common keys
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
                    municipality: '',
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

    const openCreateModal = () => {
        setIsEditing(false);
        setSelectedId(null);
        setFormData({
            region: '', division: '', district: '', legislative_district: '', municipality: '',
            school_id: '', school_name: '', project_name: '',
            total_funds: '', fund_released: '', date_of_release: ''
        });
        setShowModal(true);
    };

    const openEditModal = (p) => {
        setIsEditing(true);
        setSelectedId(p.finance_id);
        const dateStr = p.date_of_release ? new Date(p.date_of_release).toISOString().split('T')[0] : '';
        setFormData({
            ...p,
            total_funds: p.total_funds ? Number(p.total_funds).toLocaleString() : '',
            fund_released: p.fund_released ? Number(p.fund_released).toLocaleString() : '',
            date_of_release: dateStr
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = isEditing 
                ? `/api/finance/project/${selectedId}`
                : '/api/finance/projects';
            
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                alert(isEditing ? "Project Updated!" : "Project Created & Synced to LGU!");
                setShowModal(false);
                fetchProjects();
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

                    {/* Search Bar */}
                    <div className="relative hidden md:block ml-6">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-full border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 transition-all"
                        />
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-[#004A99] hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg shadow-blue-500/30 transition-transform active:scale-95 flex items-center gap-2 text-sm font-bold"
                >
                    <FiPlus /> Add Project
                </button>
            </div>

            <div className="p-6">
                {/* Mobile Search - Visible only on small screens */}
                <div className="md:hidden mb-4 relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search projects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* List - Card Grid */}
                {isLoading ? (
                    <div className="text-center py-20">Loading...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProjects.map((p) => (
                            <motion.div 
                                key={p.finance_id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow p-6 relative group"
                            >
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => openEditModal(p)}
                                        className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-full transition-colors"
                                    >
                                        <FiEdit2 size={16} />
                                    </button>
                                </div>

                                <div className="mb-4">
                                    <div className="text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">{p.school_id}</div>
                                    <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">{p.project_name}</h3>
                                    <p className="text-sm text-slate-500">{p.school_name}</p>
                                </div>
                                
                                <div className="space-y-3 mb-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">Location</span>
                                        <span className="font-medium text-slate-700">{p.municipality || '-'}, {p.division || '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">Total Funds</span>
                                        <span className="font-mono font-bold text-[#004A99]">₱{Number(p.total_funds).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">Released</span>
                                        <span className="font-mono font-bold text-emerald-600">₱{Number(p.fund_released).toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-1 rounded-md">
                                        Released: {p.date_of_release ? new Date(p.date_of_release).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                        
                        {filteredProjects.length === 0 && (
                            <div className="col-span-full py-20 text-center text-slate-400">
                                {searchTerm ? 'No projects match your search.' : 'No finance projects found. Click "Add Project" to start.'}
                            </div>
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
                                <h2 className="text-lg font-bold text-slate-800">
                                    {isEditing ? 'Update Project' : 'Add New Finance Project'}
                                </h2>
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
                                                            // Keep as text but regex restrict
                                                            const val = e.target.value.replace(/\D/g, '');
                                                            setFormData({ ...formData, school_id: val });
                                                        }}
                                                        disabled={isEditing} // Disable ID edit
                                                        className={`w-full p-3 border border-slate-200 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none ${isEditing ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleSchoolLookup}
                                                    disabled={isLookingUp || !formData.school_id || isEditing}
                                                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 rounded-xl transition-colors disabled:opacity-50 text-sm"
                                                >
                                                    {isEditing ? 'Locked' : 'Validate'}
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
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Municipality</label>
                                        <input name="municipality" value={formData.municipality} readOnly className="w-full bg-transparent font-bold text-slate-700 text-sm outline-none" placeholder="-" />
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
                                        <input type="text" name="total_funds" required value={formData.total_funds} onChange={handleInputChange} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Fund Released</label>
                                        <input type="text" name="fund_released" required value={formData.fund_released} onChange={handleInputChange} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Date Released</label>
                                        <input type="date" name="date_of_release" required value={formData.date_of_release} onChange={handleInputChange} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold">Cancel</button>
                                    <button type="submit" className="px-6 py-2 bg-[#004A99] text-white font-bold rounded-xl hover:bg-blue-800 shadow-lg shadow-blue-900/20">
                                        {isEditing ? 'Update Changes' : 'Create & Sync'}
                                    </button>
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
