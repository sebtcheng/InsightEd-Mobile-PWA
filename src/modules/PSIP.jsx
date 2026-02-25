import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronRight, FiLayers, FiMap, FiUser, FiTv, FiSettings, FiDatabase, FiTrendingUp, FiDollarSign, FiBarChart2, FiTarget, FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiClock, FiLoader, FiCpu, FiSend, FiX, FiInfo, FiList, FiSearch } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LabelList } from 'recharts';
import BottomNav from './BottomNav';

const API_BASE = "";

// Storey colors for pie chart
const STOREY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#FB923C'];

// ─────────────────────────────────────────────
// HELPERS & SUB-COMPONENTS
// ─────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, color, bgColor }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${bgColor || 'bg-white'} rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4`}
    >
        <div className={`p-3 rounded-xl ${color} bg-opacity-20 shrink-0`}>
            <Icon className={`w-6 h-6 ${color?.replace('bg-', 'text-')}`} />
        </div>
        <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
    </motion.div>
);

const LoadingSpinner = () => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <FiLoader className="w-12 h-12 animate-spin text-blue-400 mb-4" />
        <p className="font-bold">Loading Masterlist Data...</p>
    </div>
);

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 font-medium">
        <div className="p-6 bg-white rounded-full shadow-sm mb-4">
            <FiDatabase className="w-12 h-12 text-blue-200" />
        </div>
        <h3 className="text-lg font-bold text-slate-600">No Data Yet</h3>
        <p className="text-sm mt-2 max-w-md text-center">
            The PSIP Masterlist has not been imported yet. Hit <code className="bg-slate-100 px-2 py-1 rounded text-xs">/api/psip/import</code> to load the data.
        </p>
    </div>
);

const KpiDrilldownModal = ({ kpi, onClose }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'projects'
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [viewBy, setViewBy] = useState('region'); // Default to Region, but allows Municipality or Leg District
    const [localRegion, setLocalRegion] = useState('');
    const [localDivision, setLocalDivision] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    
    // Pagination and Search state
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const recordsPerPage = 10;

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                params.append('groupBy', viewBy);
                if (localRegion) params.append('region', localRegion);
                if (localDivision) params.append('division', localDivision);

                const endpoint = kpi.source === 'congress' 
                    ? `${API_BASE}/api/deped-infrariorities/distribution`
                    : `${API_BASE}/api/masterlist/distribution`;

                const url = `${endpoint}?${params.toString()}`;
                const res = await fetch(url);
                
                if (!res.ok) {
                    setData([]);
                    return;
                }

                const json = await res.json();
                const sorted = json.sort((a, b) => Number(b[kpi.key]) - Number(a[kpi.key]));
                setData(sorted);
            } catch (err) {
                console.error("Modal fetch error", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [kpi, viewBy, localRegion, localDivision]);

    useEffect(() => {
        const fetchProjects = async () => {
            if (activeTab !== 'projects') return;
            setProjectsLoading(true);
            try {
                const params = new URLSearchParams();
                if (localRegion) params.append('region', localRegion);
                if (localDivision) params.append('division', localDivision);
                if (viewBy === 'municipality') params.append('municipality', localDivision); // Approximation or handle properly
                // If the user specificially chose a municipality/dist in the dropdown, we'd need that too
                
                const endpoint = kpi.source === 'congress'
                    ? `${API_BASE}/api/deped-infrariorities/distribution-projects`
                    : `${API_BASE}/api/masterlist/distribution-projects`;
                
                const res = await fetch(`${endpoint}?${params.toString()}`);
                const json = await res.json();
                setProjects(json);
            } catch (err) {
                console.error("Projects fetch error", err);
            } finally {
                setProjectsLoading(false);
            }
        };
        fetchProjects();
    }, [activeTab, localRegion, localDivision, kpi.source]);

    // Reset page on filters, tab change, or search
    useEffect(() => {
        setCurrentPage(1);
    }, [localRegion, localDivision, activeTab, viewBy, searchQuery]);

    // Search and Pagination logic
    const filteredProjects = projects.filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (p.school_id || '').toLowerCase().includes(q) ||
            (p.school_name || '').toLowerCase().includes(q) ||
            (p.project_name || '').toLowerCase().includes(q)
        );
    });

    const indexOfLastProject = currentPage * recordsPerPage;
    const indexOfFirstProject = indexOfLastProject - recordsPerPage;
    const currentProjects = filteredProjects.slice(indexOfFirstProject, indexOfLastProject);
    const totalPages = Math.ceil(filteredProjects.length / recordsPerPage);

    const handleBarClick = (entry) => {
        if (!entry || !entry.name) return;
        if (viewBy === 'region') {
            setLocalRegion(entry.name);
            setViewBy('division');
        } else if (viewBy === 'division') {
            setLocalDivision(entry.name);
            setViewBy('legislative_district'); // Priority: Legislative District
        }
    };

    const handleResetDrilldown = (level) => {
        if (level === 'region') {
            setLocalRegion('');
            setLocalDivision('');
            setViewBy('region');
        } else if (level === 'division') {
            setLocalDivision('');
            setViewBy('division');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 sm:p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white w-full sm:max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center relative gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3" style={{ backgroundColor: `${kpi.color}20`, color: kpi.color }}>
                            KPI Drilldown
                        </div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-slate-800">{kpi.title}</h2>
                            <div className="flex items-center gap-2">
                                {localRegion && (
                                    <button
                                        onClick={() => handleResetDrilldown('region')}
                                        className="px-3 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors flex items-center gap-1"
                                    >
                                        &larr; Regions
                                    </button>
                                )}
                                {localDivision && (
                                    <button
                                        onClick={() => handleResetDrilldown('division')}
                                        className="px-3 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors flex items-center gap-1"
                                    >
                                        &larr; Divisions
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="text-slate-500 text-sm mt-1">
                            Geographic distribution of {kpi.title.toLowerCase()}
                            {localRegion && <span className="font-bold text-blue-600"> &mdash; {localRegion}</span>}
                            {localDivision && <span className="font-bold text-emerald-600"> &mdash; {localDivision}</span>}
                        </p>
                    </div>

                    {/* View By Selector - Simplified to prioritize Legislative District */}
                    {(viewBy === 'municipality' || viewBy === 'legislative_district') && (
                        <div className="flex items-center gap-3 sm:pr-8">
                            <label className="text-xs font-bold text-slate-500 uppercase">View By:</label>
                            <select
                                value={viewBy}
                                onChange={(e) => setViewBy(e.target.value)}
                                className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer"
                            >
                                <option value="legislative_district">Legislative District</option>
                                <option value="municipality">Municipality</option>
                            </select>
                        </div>
                    )}

                    <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                        <button 
                            onClick={() => setActiveTab('chart')}
                            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FiBarChart2 size={14} /> Summary Chart
                        </button>
                        <button 
                            onClick={() => setActiveTab('projects')}
                            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'projects' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FiList size={14} /> Projects Tab
                        </button>
                    </div>

                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors absolute top-6 right-6">
                        <FiX size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto bg-white min-h-[450px]">
                    {activeTab === 'chart' ? (
                        <>
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-4">
                                    <FiLoader className="w-8 h-8 text-blue-500 animate-spin" />
                                    <p className="text-slate-500 font-medium text-sm">Crunching KPI data...</p>
                                </div>
                            ) : data.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-slate-500 font-medium">No distribution data available.</p>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={isMobile ? data.length * 40 + 100 : 380}>
                                    <BarChart 
                                        data={data} 
                                        layout={isMobile ? "vertical" : "horizontal"}
                                        margin={isMobile ? { top: 20, right: 30, left: 100, bottom: 20 } : { top: 20, right: 30, left: 20, bottom: 60 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={!isMobile} vertical={isMobile} />
                                        {isMobile ? (
                                            <>
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} width={90} />
                                            </>
                                        ) : (
                                            <>
                                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-45} textAnchor="end" height={80} />
                                                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => Number(v).toLocaleString()} />
                                            </>
                                        )}
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            formatter={(value) => [Number(value).toLocaleString(), kpi.title]}
                                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
                                        />
                                        <Bar
                                            dataKey={kpi.key}
                                            fill={kpi.color}
                                            radius={isMobile ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                                            cursor={(viewBy === 'region' || viewBy === 'division') ? 'pointer' : 'default'}
                                            onClick={handleBarClick}
                                            barSize={isMobile ? 25 : undefined}
                                        >
                                            <LabelList
                                                dataKey={kpi.key}
                                                position={isMobile ? "right" : "top"}
                                                offset={10}
                                                style={{ fontSize: '10px', fontWeight: 'bold', fill: '#64748b' }}
                                                formatter={(val) => {
                                                    if (kpi.key === 'amount') {
                                                        if (val >= 1_000_000_000) return `₱${(val / 1_000_000_000).toFixed(1)}B`;
                                                        return `₱${(val / 1_000_000).toFixed(1)}M`;
                                                    }
                                                    return Math.round(val).toLocaleString();
                                                }}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </>
                    ) : (
                        <div className="animate-in fade-in duration-500">
                             {projectsLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                    <FiLoader className="w-8 h-8 text-blue-500 animate-spin" />
                                    <p className="text-slate-500 font-medium text-sm">Fetching projects list...</p>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full space-y-4">
                                    {/* Search Bar UI */}
                                    <div className="relative group max-w-md">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <FiSearch className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search by school ID, name, or project..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 pl-11 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        />
                                    </div>

                                    {filteredProjects.length === 0 ? (
                                        <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                            <FiTarget className="mx-auto w-12 h-12 text-slate-300 mb-4" />
                                            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">No projects found for "{searchQuery}"</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-6 py-4 font-black uppercase text-slate-500 tracking-wider">School ID</th>
                                                    <th className="px-6 py-4 font-black uppercase text-slate-500 tracking-wider">School Name</th>
                                                    {kpi.source === 'congress' && <th className="px-6 py-4 font-black uppercase text-slate-500 tracking-wider">Project</th>}
                                                    <th className="px-6 py-4 font-black uppercase text-slate-500 tracking-wider">Region</th>
                                                    <th className="px-6 py-4 font-black uppercase text-slate-500 tracking-wider">Division</th>
                                                    <th className="px-6 py-4 font-black uppercase text-slate-500 tracking-wider text-right">Value</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {currentProjects.map((p, idx) => (
                                                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                                                        <td className="px-6 py-4 font-mono text-slate-500 group-hover:text-blue-600 transition-colors">{p.school_id}</td>
                                                        <td className="px-6 py-4 font-bold text-slate-800 truncate max-w-[220px]" title={p.school_name}>{p.school_name}</td>
                                                        {kpi.source === 'congress' && <td className="px-6 py-4 font-medium text-slate-600 truncate max-w-[220px]" title={p.project_name}>{p.project_name}</td>}
                                                        <td className="px-6 py-4 text-slate-500">{p.region}</td>
                                                        <td className="px-6 py-4 text-slate-500">{p.division}</td>
                                                        <td className="px-6 py-4 font-black text-slate-900 text-right">
                                                            <span className="px-3 py-1 bg-slate-100 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-700 transition-all">
                                                                {kpi.source === 'congress' 
                                                                    ? `₱${(Number(p.amount) / 1_000_000).toFixed(1)}M` 
                                                                    : `${Number(p.classrooms).toLocaleString()} CL`
                                                                }
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                            {/* Pagination Controls */}
                                            {totalPages > 1 && (
                                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 border-t border-slate-50">
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                        Showing <span className="text-slate-700">{indexOfFirstProject + 1}</span> to <span className="text-slate-700">{Math.min(indexOfLastProject, filteredProjects.length)}</span> of <span className="text-slate-700">{filteredProjects.length}</span> projects
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                            disabled={currentPage === 1}
                                                            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            <FiChevronRight className="rotate-180" size={18} />
                                                        </button>
                                                        
                                                        <div className="flex items-center gap-1">
                                                            {[...Array(totalPages)].map((_, i) => {
                                                                const p = i + 1;
                                                                // Simple pagination logic: show first, last, and current +/- 1
                                                                if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                                                                    return (
                                                                        <button
                                                                            key={p}
                                                                            onClick={() => setCurrentPage(p)}
                                                                            className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${currentPage === p ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-100'}`}
                                                                        >
                                                                            {p}
                                                                        </button>
                                                                    );
                                                                } else if (p === currentPage - 2 || p === currentPage + 2) {
                                                                    return <span key={p} className="text-slate-300 px-1">...</span>;
                                                                }
                                                                return null;
                                                            })}
                                                        </div>

                                                        <button 
                                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                            disabled={currentPage === totalPages}
                                                            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            <FiChevronRight size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

const CongressView = ({ isVisible, onClose, rows, loading, onImport, importMsg, onSearch, search, loadData, reloadPartnerships, handleKpiClick }) => {
    const [activeTab, setActiveTab] = useState('info'); // 'info' | 'details'
    const [currentPage, setCurrentPage] = useState(1);
    const [recordsPerPage, setRecordsPerPage] = useState(10);
    
    // Auto-load data if empty when active
    useEffect(() => {
        if (isVisible && rows.length === 0) loadData();
    }, [isVisible, rows.length]); // Added rows.length for stability

    // Reset pagination on search
    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    if (!isVisible) return null;

    const handleAssign = async (id, agency) => {
        try {
            const res = await fetch(`${API_BASE}/api/deped-infrariorities/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, assigned_to: agency })
            });
            if (res.ok) {
                loadData(); // Refresh rows
                reloadPartnerships(); // Refresh summary cards
            }
        } catch (err) {
            console.error("Assignment error:", err);
        }
    };

    const filteredRows = rows.filter(r => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (r.school_id || '').toLowerCase().includes(q) ||
            (r.school_name || '').toLowerCase().includes(q) ||
            (r.project_name || '').toLowerCase().includes(q) ||
            (r.region || '').toLowerCase().includes(q) ||
            (r.legislative_district || '').toLowerCase().includes(q) ||
            (r.division || '').toLowerCase().includes(q)
        );
    });

    const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const filteredAmount = filteredRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const duplicatedRows = rows.filter(r => (r.masterlist_status || '').toLowerCase().includes('found in masterlist'));
    const duplicatedCount = duplicatedRows.length;
    const duplicatedAmount = duplicatedRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const psip3Budget = duplicatedAmount;

    // Pagination logic
    const indexOfLastRow = currentPage * recordsPerPage;
    const indexOfFirstRow = indexOfLastRow - recordsPerPage;
    const currentRows = filteredRows.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredRows.length / recordsPerPage);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full flex flex-col min-h-[80vh]"
        >
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-2 mb-6 text-sm">
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold transition-colors">Dashboard</button>
                <FiChevronRight className="text-slate-300" />
                <span className="text-amber-600 font-black uppercase tracking-widest">DepEd Priorities 2026 Infrastructure</span>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col flex-1">
                {/* Panel Header */}
                <div className="bg-gradient-to-r from-amber-500 to-yellow-500 px-8 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl text-white">
                            <FiAlertCircle size={24} />
                        </div>
                        <div>
                            <h3 className="text-white font-black text-2xl">DepEd Priorities 2026 Infrastructure</h3>
                            <p className="text-amber-100 text-[10px] font-black uppercase tracking-widest">{rows.length} Total Projects Tracked</p>
                        </div>
                    </div>
                    <div className="flex bg-white/20 rounded-2xl p-1.5 gap-1.5 backdrop-blur-sm">
                        <button onClick={() => setActiveTab('info')} className={`px-6 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'info' ? 'bg-white text-amber-600 shadow-lg' : 'text-white hover:bg-white/20'}`}>
                            <FiInfo size={16} /> Summary Information
                        </button>
                        <button onClick={() => setActiveTab('details')} className={`px-6 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'details' ? 'bg-white text-amber-600 shadow-lg' : 'text-white hover:bg-white/20'}`}>
                            <FiList size={16} /> Project details
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-8 bg-white">
                    {activeTab === 'info' ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {loading ? (
                                <div className="text-center py-20 text-slate-400 font-bold">Loading summary statistics…</div>
                            ) : rows.length === 0 ? (
                                <div className="text-center py-24 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                    <FiDatabase className="mx-auto w-16 h-16 mb-6 opacity-20 text-slate-400" />
                                    <h4 className="text-xl font-bold text-slate-800">No initiatives data found</h4>
                                    <p className="text-slate-500 mt-2 mb-8">Please import the latest CSV file to begin tracking.</p>
                                    <button onClick={onImport} className="bg-amber-500 text-white font-black px-10 py-4 rounded-2xl hover:bg-amber-600 shadow-lg shadow-amber-200 transition-all active:scale-95">Import Priorities 2026 Infrastructure Data</button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 gap-6 snap-x snap-mandatory">
                                        <div 
                                            onClick={() => onSearch('') || handleKpiClick({ key: 'projects', title: 'Total Readily Implementable Projects', color: '#f59e0b', source: 'congress' })}
                                            className="min-w-[280px] md:min-w-0 snap-center bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-3xl p-8 shadow-sm cursor-pointer hover:shadow-md transition-all active:scale-95 group"
                                        >
                                            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 group-hover:text-amber-500">Total Readily Implementable Projects</p>
                                            <p className="text-5xl font-black text-amber-700">{rows.length.toLocaleString()}</p>
                                        </div>
                                        <div 
                                            onClick={() => onSearch('') || handleKpiClick({ key: 'amount', title: 'Total Budget Distribution', color: '#10b981', source: 'congress' })}
                                            className="min-w-[280px] md:min-w-0 snap-center bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-3xl p-8 shadow-sm cursor-pointer hover:shadow-md transition-all active:scale-95 group"
                                        >
                                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 group-hover:text-emerald-500">Total Budget</p>
                                            <p className="text-5xl font-black text-emerald-700">₱{(totalAmount / 1_000_000_000).toFixed(2)}B</p>
                                        </div>
                                        {/* 
                                        <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-3xl p-8 shadow-sm">
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Number of Projects Duplicated from PSIP III</p>
                                            <p className="text-5xl font-black text-blue-700">{duplicatedCount.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-3xl p-8 shadow-sm">
                                            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">Total Budget for PSIP III</p>
                                            <p className="text-5xl font-black text-purple-700">₱{(psip3Budget / 1_000_000_000).toFixed(2)}B</p>
                                        </div> 
                                        */}
                                    </div>
                                    
                                     <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex items-start gap-4">
                                        <FiInfo className="text-amber-500 shrink-0 mt-1" size={20} />
                                        <div className="text-slate-600 leading-relaxed">
                                            <p className="font-bold text-slate-800 mb-1">About DepEd Priorities 2026 Infrastructure</p>
                                            <p className="text-sm italic">DepEd Priorities 2026 Infrastructure represent high-priority school infrastructure projects identified for strategic implementation. These projects are specifically allocated and can be assigned to various implementing agencies for streamlined monitoring and progression. Accurate tracking here ensures that critical infrastructure gaps are addressed efficiently through our partnership network.</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest text-right italic">data displayed is as of February 23, 2026. 5:45 pm</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
                                <div className="relative flex-1 w-full sm:max-w-md">
                                    <FiInfo className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search by ID, name, region, or district…"
                                        value={search}
                                        onChange={e => onSearch(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-amber-100 focus:border-amber-400 outline-none transition-all"
                                    />
                                </div>
                                {importMsg && <span className="text-[10px] font-black text-amber-600 bg-amber-100/50 px-3 py-1 rounded-full">{importMsg}</span>}
                            </div>

                            <div className="flex-1 overflow-auto rounded-3xl border border-slate-100 shadow-inner bg-slate-50/30">
                                <table className="w-full text-xs border-separate border-spacing-0">
                                    <thead className="bg-slate-100/80 backdrop-blur-md sticky top-0 z-20">
                                        <tr>
                                            {['School ID', 'School Name', 'Project Name', 'Amount', 'Status', 'Region', 'Division', 'Leg. District', 'Ownership (Pre)', 'Ownership (Conf)', 'Accessibility', 'Dimensions', 'Buildable?'].map(h => (
                                                <th key={h} className="px-6 py-5 text-left font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 whitespace-nowrap">{h}</th>
                                            ))}
                                            <th className="px-6 py-5 text-left font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 whitespace-nowrap sticky right-[160px] bg-slate-100/80 z-20">Implementing Office</th>
                                            <th className="px-6 py-5 text-left font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 whitespace-nowrap sticky right-0 bg-slate-100/80 z-20">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {currentRows.map((r, i) => (
                                            <tr key={i} className={`group hover:bg-white transition-colors ${i % 2 === 0 ? 'bg-white/40' : 'bg-slate-50/40'}`}>
                                                <td className="px-6 py-4 font-mono font-bold text-slate-600 border-b border-white">{r.school_id || '—'}</td>
                                                <td className="px-6 py-4 font-black text-slate-800 max-w-[250px] truncate border-b border-white" title={r.school_name}>{r.school_name || '—'}</td>
                                                <td className="px-6 py-4 font-medium text-slate-600 max-w-[250px] truncate border-b border-white" title={r.project_name}>{r.project_name || '—'}</td>
                                                <td className="px-6 py-4 font-black text-emerald-700 whitespace-nowrap border-b border-white">₱{(Number(r.amount)/1_000_000).toFixed(1)}M</td>
                                                <td className="px-6 py-4 border-b border-white">
                                                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-wider">{r.masterlist_status || '—'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 font-bold border-b border-white whitespace-nowrap">{r.region || '—'}</td>
                                                <td className="px-6 py-4 text-slate-500 font-bold border-b border-white whitespace-nowrap">{r.division || '—'}</td>
                                                <td className="px-6 py-4 text-slate-500 font-bold border-b border-white whitespace-nowrap">{r.legislative_district || '—'}</td>
                                                <td className="px-6 py-4 text-slate-400 border-b border-white max-w-[150px] truncate" title={r.ownership_type_preloaded}>{r.ownership_type_preloaded || '—'}</td>
                                                <td className="px-6 py-4 text-slate-400 border-b border-white max-w-[150px] truncate" title={r.ownership_type_confirmed}>{r.ownership_type_confirmed || '—'}</td>
                                                <td className="px-6 py-4 border-b border-white text-center">
                                                    <span className={`px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-wider ${r.accessibility_rating?.includes('4') ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {r.accessibility_rating || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 font-medium border-b border-white whitespace-nowrap">{r.buildable_space_dimensions || '—'}</td>
                                                <td className="px-6 py-4 text-center font-bold border-b border-white">
                                                    <span className={`font-black text-[10px] ${(r.has_buildable_space||'').toUpperCase()==='YES' ? 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded' : 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded'}`}>
                                                        {(r.has_buildable_space || '—').toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 border-b border-white sticky right-[160px] bg-blue-50/80 group-hover:bg-blue-50 transition-colors z-10 backdrop-blur-sm">
                                                    {r.assigned_to ? (
                                                        <span className="bg-indigo-600 text-white px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-wider shadow-sm">{r.assigned_to}</span>
                                                    ) : (
                                                        <span className="text-slate-300 italic font-medium">Not Assigned</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 border-b border-white sticky right-0 bg-blue-50/80 group-hover:bg-blue-50 transition-colors z-10 backdrop-blur-sm min-w-[160px]">
                                                    <select 
                                                        className="bg-white border-2 border-slate-100 rounded-xl px-2 py-1.5 text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-amber-400 transition-all cursor-pointer hover:border-amber-200"
                                                        value={r.assigned_to || ''}
                                                        onChange={(e) => handleAssign(r.id, e.target.value)}
                                                    >
                                                        <option value="">Implementing Office</option>
                                                        <option value="PGO">PGO</option>
                                                        <option value="MGO">MGO</option>
                                                        <option value="CGO">CGO</option>
                                                        <option value="DPWH">DPWH</option>
                                                        <option value="DEPED">DepEd</option>
                                                        <option value="CSO">CSO</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 px-2">
                                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex flex-wrap items-center gap-6">
                                    <span>Showing {indexOfFirstRow + 1}-{Math.min(indexOfLastRow, filteredRows.length)} of {filteredRows.length} filtered ({rows.length} total)</span>
                                    <span className="h-1 w-1 bg-slate-200 rounded-full" />
                                    <span>Filtered Budget: <span className="text-emerald-600">₱{(filteredAmount / 1_000_000_000).toFixed(2)}B</span></span>
                                    <div className="flex items-center gap-2">
                                        <span>Show:</span>
                                        <select 
                                            value={recordsPerPage}
                                            onChange={(e) => { setRecordsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none"
                                        >
                                            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-all"
                                    >
                                        <FiChevronRight className="rotate-180" />
                                    </button>
                                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-4 py-2 rounded-xl">Page {currentPage} of {totalPages}</span>
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-all"
                                    >
                                        <FiChevronRight />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};


// ───────────────────────
// HOME VIEW
// ───────────────────────
const HomeView = ({ 
    summary, storeyBreakdown, partnerships, storeyOption, setStoreyOption,
    showCongressView, setShowCongressView, congressRows, setCongressRows,
    congressLoading, setCongressLoading, congressImportMsg, setCongressImportMsg,
    congressSearch, setCongressSearch, loadCongressData, handleCongressImport,
    getQueryString, drilldownPath, setDrilldownPath, handleBack,
    handlePartnerClick, handlePrototypeClick, filters, setFilters, filterOptions,
    handleKpiClick, setPartnerships, setSelectedPartner, setPartnerSchools,
    setSelectedPrototype, setPrototypeSchools, handleDrilldown
}) => {
    const totalClassrooms = summary ? Number(summary.total_classrooms) : 0;

    // [NEW] Derive unique storeys dynamically
    const uniqueStoreys = [...new Set(storeyBreakdown.map(item => item.storey))].sort((a, b) => a - b);

    const partnershipCards = partnerships ? [
        {
            id: 'PGO', title: 'PGO (Provincial Gov)',
            icon: <FiMap className="w-6 h-6" />, color: 'bg-teal-100 text-teal-600',
            count: partnerships.totals ? Number(partnerships.totals.governor_count) || 0 : partnerships.pgo?.length || 0,
            assigned_projects: partnerships.pgo?.[0]?.assigned_projects || 0,
            drilldown: partnerships.pgo || []
        },
        {
            id: 'MGO', title: 'MGO (Municipal Gov)',
            icon: <FiUser className="w-6 h-6" />, color: 'bg-blue-100 text-blue-600',
            count: partnerships.mgo?.length || 0,
            assigned_projects: partnerships.mgo?.[0]?.assigned_projects || 0,
            drilldown: partnerships.mgo || []
        },
        {
            id: 'CGO', title: 'CGO (City Gov)',
            icon: <FiTv className="w-6 h-6" />, color: 'bg-purple-100 text-purple-600',
            count: partnerships.cgo?.length || 0,
            assigned_projects: partnerships.cgo?.[0]?.assigned_projects || 0,
            drilldown: partnerships.cgo || []
        },
        {
            id: 'DPWH', title: 'DPWH',
            icon: <FiSettings className="w-6 h-6" />, color: 'bg-orange-100 text-orange-600',
            count: partnerships.dpwh?.length > 0 ? Number(partnerships.dpwh[0].projects) : 0,
            assigned_projects: partnerships.dpwh?.[0]?.assigned_projects || 0,
            drilldown: partnerships.dpwh || []
        },
        {
            id: 'DEPED', title: 'DepEd',
            icon: <FiCheckCircle className="w-6 h-6" />, color: 'bg-emerald-100 text-emerald-600',
            count: partnerships.deped?.length > 0 ? Number(partnerships.deped[0].projects) : 0,
            assigned_projects: partnerships.deped?.[0]?.assigned_projects || 0,
            drilldown: partnerships.deped || []
        },
        {
            id: 'CSO', title: 'CSO',
            icon: <FiLayers className="w-6 h-6" />, color: 'bg-rose-100 text-rose-600',
            count: partnerships.cso?.length > 0 ? Number(partnerships.cso[0].projects) : 0,
            assigned_projects: partnerships.cso?.[0]?.assigned_projects || 0,
            drilldown: partnerships.cso || []
        },
        {
            id: 'FOR_DECISION', title: 'DepEd Priorities 2026 Infrastructure',
            icon: <FiAlertCircle className="w-6 h-6" />, color: 'bg-yellow-100 text-yellow-600',
            count: partnerships.forDecision?.length > 0 ? Number(partnerships.forDecision[0].projects) : 0,
            drilldown: partnerships.forDecision || []
        },
    ] : [];

    // Fetch partnerships for drilldown if not yet loaded
    useEffect(() => {
        if (!partnerships) {
            const qs = getQueryString();
            fetch(`${API_BASE}/api/masterlist/partnerships${qs}`)
                .then(r => r.json())
                .then(d => setPartnerships(d))
                .catch(() => { });
        }
    }, [partnerships]);

    const congressFilteredRows = congressRows.filter(r => {
        if (!congressSearch) return true;
        const q = congressSearch.toLowerCase();
        return (
            (r.school_id || '').toLowerCase().includes(q) ||
            (r.school_name || '').toLowerCase().includes(q) ||
            (r.project_name || '').toLowerCase().includes(q) ||
            (r.region || '').toLowerCase().includes(q) ||
            (r.legislative_district || '').toLowerCase().includes(q)
        );
    });

    if (drilldownPath.length > 0) {
        const currentLevel = drilldownPath[drilldownPath.length - 1];
        return (
            <div className="space-y-6 pb-32 animate-fadeIn">
                <button onClick={handleBack} className="text-sm text-blue-600 font-bold flex items-center gap-2 mb-4 hover:translate-x-[-4px] transition-transform">
                    <FiChevronRight className="rotate-180" /> Back to Overview
                </button>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">{currentLevel.title} — Top Partners</h2>
                <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 gap-4 snap-x snap-mandatory">
                    {currentLevel.drilldown.length === 0 && (
                        <div className="text-slate-400 italic text-sm">No organizations categorized under {currentLevel.title} yet.</div>
                    )}
                    {currentLevel.drilldown.map((item, idx) => (
                        <div key={idx}
                            onClick={() => handlePartnerClick(currentLevel.id, item.name)}
                            className="min-w-[260px] md:min-w-0 snap-center bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
                            <span className="font-bold text-slate-700 text-base block mb-1 group-hover:text-blue-700">{item.name}</span>
                            <div className="flex items-center gap-4 text-sm text-slate-500 mb-2">
                                <span>{Number(item.projects).toLocaleString()} projects</span>
                                <span className="text-blue-600 font-bold">{Number(item.classrooms).toLocaleString()} classrooms</span>
                            </div>
                            <div className="text-[10px] items-center text-blue-500 font-bold uppercase tracking-widest flex gap-1 group-hover:underline">
                                View Handled Schools <FiChevronRight />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-32">
            <CongressView 
                isVisible={showCongressView} 
                onClose={() => setShowCongressView(false)}
                rows={congressRows}
                loading={congressLoading}
                importMsg={congressImportMsg}
                onImport={handleCongressImport}
                search={congressSearch}
                onSearch={setCongressSearch}
                loadData={loadCongressData}
                reloadPartnerships={() => {
                    const qs = getQueryString();
                    fetch(`${API_BASE}/api/masterlist/partnerships${qs}`).then(r=>r.json()).then(d=>setPartnerships(d));
                }}
                handleKpiClick={handleKpiClick}
            />

            {!showCongressView && (
                <>
                    {/* Focus Area Selection */}
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><FiMap className="w-5 h-5" /></div>
                            Focus Area Selection
                        </h2>

                        <div className="space-y-4 mb-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <select value={filters.region} onChange={e => setFilters({ ...filters, region: e.target.value })}
                                    className="bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm">
                                    <option value="">All Regions</option>
                                    {filterOptions.regions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <select value={filters.division} onChange={e => setFilters({ ...filters, division: e.target.value })}
                                    disabled={!filters.region}
                                    className="bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 shadow-sm">
                                    <option value="">All Divisions</option>
                                    {filterOptions.divisions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <select value={filters.municipality} onChange={e => setFilters({ ...filters, municipality: e.target.value })}
                                    disabled={!filters.division}
                                    className="bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 shadow-sm">
                                    <option value="">All Municipalities</option>
                                    {filterOptions.municipalities.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <select value={filters.legislative_district} onChange={e => setFilters({ ...filters, legislative_district: e.target.value })}
                                    disabled={!filters.municipality}
                                    className="bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 shadow-sm">
                                    <option value="">All Leg. Districts</option>
                                    {filterOptions.legislativeDistricts.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Hero / KPIs */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/30 rounded-full blur-2xl -ml-10 -mb-10"></div>
                        <div className="relative z-10">
                            <h1 className="text-3xl lg:text-5xl font-extrabold mb-3 tracking-tight">Masterlist Dashboard</h1>
                            <p className="opacity-90 text-sm md:text-lg mb-8 max-w-lg">Strategic Overview and Classroom Provision Planning</p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                                {/* Hardcoded Shortage Card */}
                                <motion.div
                                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                    whileTap={{ scale: 0.98 }}
                                    className="bg-rose-500/30 backdrop-blur-md rounded-3xl p-6 border border-rose-400/40 shadow-lg flex flex-col justify-center"
                                >
                                    <div className="text-5xl md:text-6xl font-black tracking-tighter text-white">144,000</div>
                                    <div className="mt-2 text-[10px] md:text-xs font-bold text-rose-100 uppercase tracking-[0.2em]">Classroom Shortage</div>
                                </motion.div>

                                {/* Dynamic Shortage Card */}
                                <motion.div
                                    onClick={() => handleKpiClick({ key: 'shortage', title: 'Estimated Classroom Shortage', color: '#f59e0b' })}
                                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                    whileTap={{ scale: 0.98 }}
                                    className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 cursor-pointer hover:bg-white/20 transition-all flex flex-col justify-center"
                                >
                                    <div className="text-5xl md:text-6xl font-black tracking-tighter">{summary && summary.total_shortage ? Number(summary.total_shortage).toLocaleString() : '...'}</div>
                                    <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] opacity-80 mt-2">Estimated Shortage</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/20 text-[10px] font-bold">
                                            {summary ? Number(summary.total_schools).toLocaleString() : '...'} Schools
                                        </span>
                                        <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/20 text-[10px] font-bold">
                                            {summary ? Number(summary.total_regions) : '...'} Regions
                                        </span>
                                    </div>
                                </motion.div>

                                {/* Total Projects Card */}
                                <motion.div
                                    onClick={() => handleKpiClick({ key: 'projects', title: 'Total Projects', color: '#3b82f6' })}
                                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                    whileTap={{ scale: 0.98 }}
                                    className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 cursor-pointer hover:bg-white/20 transition-all flex flex-col justify-center"
                                >
                                    <div className="text-5xl md:text-6xl font-black tracking-tighter text-blue-200">{summary && summary.total_projects ? Number(summary.total_projects).toLocaleString() : '...'}</div>
                                    <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] opacity-80 mt-2">Total Projects</p>
                                </motion.div>

                                {/* Total Sites Card */}
                                <motion.div
                                    onClick={() => handleKpiClick({ key: 'sites', title: 'Total Number of Sites', color: '#a855f7' })}
                                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                    whileTap={{ scale: 0.98 }}
                                    className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 cursor-pointer hover:bg-white/20 transition-all flex flex-col justify-center"
                                >
                                    <div className="text-5xl md:text-6xl font-black tracking-tighter text-purple-200">{summary && summary.total_sites ? Number(summary.total_sites).toLocaleString() : '...'}</div>
                                    <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] opacity-80 mt-2">Total Sites</p>
                                </motion.div>

                                {/* Proposed Classrooms Card */}
                                <motion.div
                                    onClick={() => handleKpiClick({ key: 'classrooms', title: 'Proposed No of Classroom', color: '#10b981' })}
                                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                    whileTap={{ scale: 0.98 }}
                                    className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 cursor-pointer hover:bg-white/20 transition-all flex flex-col justify-center"
                                >
                                    <div className="text-5xl md:text-6xl font-black tracking-tighter text-emerald-300">{summary && summary.total_classrooms ? Number(summary.total_classrooms).toLocaleString() : '...'}</div>
                                    <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] opacity-80 mt-2">Proposed Classrooms</p>
                                </motion.div>
                            </div>
                        </div>
                    </div>

                    {/* Partnerships */}
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><FiLayers className="w-5 h-5" /></div>
                            Partnerships Projects
                        </h2>
                        <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 overflow-x-auto md:overflow-x-visible pb-6 md:pb-0 gap-6 snap-x snap-mandatory no-scrollbar -mx-2 px-2">
                            {partnershipCards.map((p) => (
                                <motion.div
                                    key={p.id}
                                    whileHover={{ y: -5 }}
                                    onClick={() => {
                                        if (p.id === 'FOR_DECISION') {
                                            setShowCongressView(true);
                                        } else {
                                            handleDrilldown(p);
                                        }
                                    }}
                                    className="min-w-[280px] md:min-w-0 snap-center bg-white rounded-3xl p-5 md:p-6 shadow-md border border-slate-100 cursor-pointer group transition-all flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4"
                                >
                                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 w-full">
                                        <div className={`p-4 rounded-full ${p.color} shrink-0`}>{p.icon}</div>
                                        <div className="text-center sm:text-left">
                                            <h3 className="text-base md:text-lg font-bold text-slate-800">{p.title}</h3>
                                            <p className="text-xs md:text-sm text-slate-500 mt-1">
                                                {Number(p.count).toLocaleString()} {p.id === 'FOR_DECISION' ? 'initiatives' : 'partners'}
                                                {p.assigned_projects > 0 && (
                                                    <span className="block mt-1 text-blue-600 font-black tracking-widest text-[9px] bg-blue-50 px-1.5 py-0.5 rounded w-fit mx-auto sm:mx-0">+{p.assigned_projects} ASSIGNED</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="hidden lg:block"><FiChevronRight className="text-slate-300 group-hover:text-blue-500 transition-colors w-5 h-5" /></div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Design Prototypes */}
                    <div className="bg-white rounded-2xl p-8 shadow-md border border-slate-100">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Standard Building Configurations</h3>
                                <p className="text-sm text-slate-500">Filtered view based on above selections.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Storey:</div>
                                <select
                                    value={storeyOption || ''}
                                    onChange={(e) => setStoreyOption(Number(e.target.value))}
                                    className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all min-w-[120px]"
                                >
                                    <option value="" disabled>Select...</option>
                                    {uniqueStoreys.map(s => (
                                        <option key={s} value={s}>{s} Storey</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {storeyOption ? (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="bg-slate-50 rounded-2xl p-10 border-2 border-slate-100 border-dashed flex flex-col items-center justify-center text-center">
                                    <div className="relative mb-6">
                                        <div className="w-32 h-32 bg-blue-100/50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner rotate-3 transition-transform hover:rotate-0">
                                            <span className="text-6xl font-black">{storeyOption}</span>
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center border-4 border-white font-bold text-xs">
                                            LVL
                                        </div>
                                    </div>

                                    <h4 className="text-2xl font-black text-slate-900 mb-2">{storeyOption}-Storey Classroom Prototypes</h4>
                                    <p className="text-slate-500 text-sm max-w-md mx-auto mb-8">
                                        Standard DepEd Building Design Prototype for {storeyOption}-Storey structures.
                                    </p>

                                    <div className="w-full max-w-2xl">
                                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 text-center">Implementation Matrix</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {storeyBreakdown
                                                .filter(item => item.storey === storeyOption)
                                                .map((item, idx) => (
                                                    <div key={idx}
                                                        onClick={() => handlePrototypeClick(item.storey, item.classrooms)}
                                                        className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between group hover:border-blue-500 transition-colors cursor-pointer">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center font-bold text-blue-600 border border-slate-100 group-hover:bg-blue-50">
                                                                {item.classrooms}
                                                            </div>
                                                            <div className="text-left">
                                                                <div className="text-xs font-black text-slate-800 uppercase tracking-tighter group-hover:text-blue-700">
                                                                    {storeyOption}sty{item.classrooms}cl
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-lg font-black text-slate-900 leading-none group-hover:text-blue-600">
                                                                {Number(item.count).toLocaleString()}
                                                            </div>
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase">Projects</div>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-2xl p-20 border-2 border-slate-100 border-dashed flex flex-col items-center justify-center text-center">
                                <h4 className="text-xl font-bold text-slate-400">Select a storey to view data</h4>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// ───────────────────────
// DATA VIEW
// ───────────────────────
const DataView = ({ loading, summary, filters, formatCost, byRegion, byYear, byStorey }) => {
    // ── Distribution Drilldown State ──
    const [distHistory, setDistHistory] = useState([{ level: 'region', filter: {} }]);
    const [distData, setDistData] = useState([]);
    const [distLoading, setDistLoading] = useState(false);

    const currentDist = distHistory[distHistory.length - 1];

    useEffect(() => {
        const fetchDist = async () => {
            setDistLoading(true);
            try {
                let qs = `?groupBy=${currentDist.level}`;

                // Apply global filters
                if (filters.region) qs += `&region=${encodeURIComponent(filters.region)}`;
                if (filters.division) qs += `&division=${encodeURIComponent(filters.division)}`;
                if (filters.municipality && filters.municipality !== 'undefined') qs += `&municipality=${encodeURIComponent(filters.municipality)}`;
                if (filters.legislative_district && filters.legislative_district !== 'undefined') qs += `&legislative_district=${encodeURIComponent(filters.legislative_district)}`;

                // Apply drilldown history filters OVERRIDING global if needed
                if (currentDist.filter.region) qs += `&region=${encodeURIComponent(currentDist.filter.region)}`;
                if (currentDist.filter.division) qs += `&division=${encodeURIComponent(currentDist.filter.division)}`;

                const res = await fetch(`${API_BASE}/api/masterlist/distribution${qs}`);
                const data = await res.json();

                // Sort by projects descending
                const sorted = data.sort((a, b) => Number(b.projects) - Number(a.projects));
                setDistData(sorted);
            } catch (err) {
                console.error("Distribution fetch error", err);
            } finally {
                setDistLoading(false);
            }
        };
        fetchDist();
    }, [currentDist, filters]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 font-medium space-y-4">
            <FiLoader className="w-10 h-10 text-blue-400 animate-spin" />
            <p className="text-lg">Preparing data engine...</p>
        </div>
    );
    if (!summary || Number(summary.total_projects) === 0) return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 font-medium">
            <div className="p-6 bg-white rounded-full shadow-sm mb-4">
                <FiDatabase className="w-12 h-12 text-slate-200" />
            </div>
            <h3 className="text-lg font-bold text-slate-600">No Masterlist Data</h3>
            <p>Please check your filters or try again later.</p>
        </div>
    );

    const totalCost = Number(summary.total_cost);
    const totalProjects = Number(summary.total_projects);
    const totalClassrooms = Number(summary.total_classrooms);
    const totalSchools = Number(summary.total_schools);
    const totalShortage = Number(summary.total_shortage);

    const handleDistClick = (entry) => {
        if (currentDist.level === 'region') {
            setDistHistory([...distHistory, { level: 'division', filter: { region: entry.name } }]);
        } else if (currentDist.level === 'division') {
            setDistHistory([...distHistory, { level: 'municipality', filter: { ...currentDist.filter, division: entry.name } }]);
        }
    };

    const handleDistBack = () => {
        if (distHistory.length > 1) {
            setDistHistory(distHistory.slice(0, -1));
        }
    };

    // Prepare chart data
    const yearChartData = byYear.map(y => ({
        year: `FY ${y.funding_year}`,
        classrooms: Number(y.classrooms),
        cost: Number(y.cost),
        projects: Number(y.projects)
    }));

    const storeyChartData = byStorey.map(s => ({
        name: `${s.storeys}-Storey`,
        value: Number(s.projects),
        classrooms: Number(s.classrooms),
        cost: Number(s.cost)
    }));

    const totalStoreyProjects = storeyChartData.reduce((a, c) => a + c.value, 0);

    return (
        <div className="space-y-8 pb-32">
            {/* Header */}
            <div>
                <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight">PSIP Masterlist Data</h1>
                <p className="text-slate-500 mt-1">School Infrastructure Program — FY 2026-2030 Masterlist Overview</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={FiDollarSign} label="Total Est. Cost" value={formatCost(totalCost)} sub={`${totalProjects.toLocaleString()} line items`} color="bg-emerald-500" />
                <StatCard icon={FiCheckCircle} label="Total Classrooms" value={totalClassrooms.toLocaleString()} sub={`Across ${Number(summary.total_regions)} regions`} color="bg-blue-500" />
                <StatCard icon={FiTarget} label="Schools Covered" value={totalSchools.toLocaleString()} sub={`${Number(summary.total_congressmen)} Congressmen`} color="bg-indigo-500" />
                <StatCard icon={FiAlertTriangle} label="Total Shortage" value={Number(summary.total_shortage).toLocaleString()} sub={`${Number(summary.total_governors)} Governors, ${Number(summary.total_mayors)} Mayors`} color="bg-amber-500" />
            </div>

            {/* Funding Year Bar Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FiBarChart2 className="text-blue-500" /> Investment by Funding Year
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Proposed classrooms and estimated cost per fiscal year</p>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={yearChartData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => formatCost(v)} />
                        <Tooltip formatter={(v, name) => [name === 'cost' ? formatCost(v) : Number(v).toLocaleString(), name === 'cost' ? 'Est. Cost' : 'Classrooms']}
                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar yAxisId="left" dataKey="classrooms" name="Classrooms" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                        <Bar yAxisId="right" dataKey="cost" name="Est. Cost" fill="#10B981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Two-column: Storey Pie + Top Regions */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Storey Distribution Pie */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                        <FiTarget className="text-indigo-500" /> Distribution by Storey Type
                    </h2>
                    <p className="text-xs text-slate-400 mb-4">{totalStoreyProjects.toLocaleString()} total project entries</p>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <ResponsiveContainer width={200} height={200}>
                            <PieChart>
                                <Pie data={storeyChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
                                    {storeyChartData.map((_, i) => <Cell key={i} fill={STOREY_COLORS[i % STOREY_COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v) => [v.toLocaleString(), undefined]} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-2 w-full max-h-[200px] overflow-y-auto">
                            {storeyChartData.map((s, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: STOREY_COLORS[i % STOREY_COLORS.length] }}></span>
                                        <span className="text-sm text-slate-600 font-medium">{s.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-bold text-slate-800">{s.value.toLocaleString()}</span>
                                        <span className="text-xs text-slate-400 ml-1">({((s.value / totalStoreyProjects) * 100).toFixed(1)}%)</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top Regions (quick view) */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                        <FiTrendingUp className="text-emerald-500" /> Top Regions by Classrooms
                    </h2>
                    <p className="text-xs text-slate-400 mb-4">Ranked by proposed classroom count</p>
                    <div className="space-y-3 max-h-[260px] overflow-y-auto">
                        {byRegion.slice(0, 10).map((r, i) => {
                            const pct = totalClassrooms > 0 ? ((Number(r.classrooms) / totalClassrooms) * 100).toFixed(1) : 0;
                            return (
                                <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-bold text-slate-700">{r.region}</span>
                                        <span className="text-sm font-black text-slate-800">{Number(r.classrooms).toLocaleString()} CL</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 1, delay: i * 0.1 }}
                                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                                        <span>{Number(r.schools).toLocaleString()} schools</span>
                                        <span>{pct}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Regional/Division/Municipality Distribution Drilldown Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <FiMap className="text-purple-500" /> Geographic Distribution
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            {currentDist.level === 'region' && "Projects distributed across Regions. Click a bar to drill down to Divisions."}
                            {currentDist.level === 'division' && `Divisions in ${currentDist.filter.region}. Click a bar to drill down to Municipalities.`}
                            {currentDist.level === 'municipality' && `Municipalities in ${currentDist.filter.division}.`}
                        </p>
                    </div>
                    {distHistory.length > 1 && (
                        <button
                            onClick={handleDistBack}
                            className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            <FiChevronRight className="rotate-180" /> Back
                        </button>
                    )}
                </div>

                {distLoading ? (
                    <div className="h-[320px] flex flex-col items-center justify-center">
                        <FiLoader className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                        <p className="text-sm font-medium text-slate-400">Loading distribution data...</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={distData} barGap={4} onClick={(e) => {
                            if (e && e.activePayload && e.activePayload.length > 0) {
                                handleDistClick(e.activePayload[0].payload);
                            }
                        }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-45} textAnchor="end" height={80} />
                            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                formatter={(v, name) => [Number(v).toLocaleString(), name === 'projects' ? 'Projects' : 'Classrooms']}
                                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                            />
                            <Bar yAxisId="left" dataKey="projects" name="projects" fill="#8B5CF6" radius={[4, 4, 0, 0]} className={currentDist.level !== 'municipality' ? "cursor-pointer hover:opacity-80 transition-opacity" : ""} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Regional Breakdown Table */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <FiMap className="text-rose-500" /> Full Regional Breakdown
                </h2>
                <p className="text-xs text-slate-400 mb-4">All regions with classroom and cost details</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Region</th>
                                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Projects</th>
                                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Schools</th>
                                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Classrooms</th>
                                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Est. Cost</th>
                                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider" style={{ minWidth: '140px' }}>Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {byRegion.map((r, i) => {
                                const pct = totalClassrooms > 0 ? ((Number(r.classrooms) / totalClassrooms) * 100).toFixed(1) : 0;
                                return (
                                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="py-3 px-4 text-sm font-bold text-slate-700">{r.region}</td>
                                        <td className="py-3 px-4 text-sm text-slate-600 text-right">{Number(r.projects).toLocaleString()}</td>
                                        <td className="py-3 px-4 text-sm text-slate-600 text-right">{Number(r.schools).toLocaleString()}</td>
                                        <td className="py-3 px-4 text-sm text-blue-600 font-bold text-right">{Number(r.classrooms).toLocaleString()}</td>
                                        <td className="py-3 px-4 text-sm text-emerald-600 font-bold text-right">{formatCost(r.cost)}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="text-xs font-bold text-slate-500 w-12 text-right">{pct}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


// ───────────────────────
// AI CHATBOT
// ───────────────────────
const MasterlistAIChat = ({ onClose }) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Hello! I am your Masterlist Assistant. Ask me anything about the 2026-2030 Masterlist data!' }
    ]);
    const [isAILoading, setIsAILoading] = useState(false);
    const [queryResult, setQueryResult] = useState(null);
    const chatEndRef = useRef(null);

    const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(() => { scrollToBottom(); }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsAILoading(true);
        setQueryResult(null);

        try {
            const res = await fetch(`${API_BASE}/api/masterlist/ai-query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: userMsg })
            });
            const data = await res.json();

            if (data.error) {
                setMessages(prev => [...prev, { role: 'ai', text: `Sorry, I hit a snag: ${data.error}` }]);
            } else if (data.data) {
                setMessages(prev => [...prev, { role: 'ai', text: `I found ${data.data.length} results for you.` }]);
                setQueryResult(data.data);
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'ai', text: 'Connection error. Please try again.' }]);
        } finally {
            setIsAILoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-[550px]">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg text-white"><FiCpu /></div>
                    <div>
                        <h3 className="text-white font-bold text-sm">AI Assistant</h3>
                        <p className="text-blue-100 text-[10px] uppercase font-bold tracking-wider">Masterlist Helper</p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <FiLayers className="w-5 h-5 rotate-45" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                            }`}>
                            {m.text}
                        </div>
                    </div>
                ))}
                {isAILoading && (
                    <div className="flex justify-start">
                        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75"></div>
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-150"></div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {queryResult && queryResult.length > 0 && (
                <div className="max-h-48 overflow-auto border-t border-slate-100 bg-white p-2">
                    <table className="w-full text-[10px] text-left">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                {Object.keys(queryResult[0]).map(k => <th key={k} className="p-2 font-black uppercase text-slate-400">{k}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {queryResult.map((r, i) => (
                                <tr key={i} className="border-b border-slate-50 hover:bg-blue-50/50">
                                    {Object.values(r).map((v, j) => <td key={j} className="p-2 text-slate-600 font-medium">{v}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="p-4 bg-white border-t border-slate-100">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about proposed projects..."
                        className="w-full bg-slate-100 border-none rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                        onClick={handleSend}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                        <FiSend />
                    </button>
                </div>
            </div>
        </div>
    );
};

const PSIP = () => {
    const location = useLocation();
    const activeTab = location.state?.activeTab || 'home';
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);

    // ── Home State ──
    const [drilldownPath, setDrilldownPath] = useState([]);
    const [storeyOption, setStoreyOption] = useState(null); // Changed default to null (will set after fetch)

    // ── Data State (from API) ──
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState(null);
    const [byRegion, setByRegion] = useState([]);
    const [byYear, setByYear] = useState([]);
    const [byStorey, setByStorey] = useState([]);
    const [storeyBreakdown, setStoreyBreakdown] = useState([]); // [NEW] Breakdown state
    const [partnerships, setPartnerships] = useState(null);

    // ── Organization Modal State ──
    const [selectedPartner, setSelectedPartner] = useState(null); // { type: 'PGO', name: 'Gov. Dalipog' }
    const [partnerSchools, setPartnerSchools] = useState({ loading: false, data: [] });

    // ── Prototype Modal State ──
    const [selectedPrototype, setSelectedPrototype] = useState(null); // { sty: 1, cl: 2 }
    const [prototypeSchools, setPrototypeSchools] = useState({ loading: false, data: [] });

    const [selectedKpi, setSelectedKpi] = useState(null);
    const [showCongressView, setShowCongressView] = useState(false);
    const [congressView, setCongressView] = useState('info'); // 'info' | 'details'
    const [congressRows, setCongressRows] = useState([]);
    const [congressLoading, setCongressLoading] = useState(false);
    const [congressImportMsg, setCongressImportMsg] = useState('');
    const [congressSearch, setCongressSearch] = useState('');

    const handleKpiClick = (kpi) => {
        setSelectedKpi(kpi);
    };

    // ── Advanced Filtering State ──
    const [filters, setFilters] = useState({
        region: '',
        division: '',
        municipality: '',
        legislative_district: ''
    });
    const [filterOptions, setFilterOptions] = useState({
        regions: [],
        divisions: [],
        municipalities: [],
        legislativeDistricts: []
    });

    const handleDrilldown = (item) => setDrilldownPath([...drilldownPath, item]);
    const handleBack = () => setDrilldownPath(drilldownPath.slice(0, -1));

    useEffect(() => { setDrilldownPath([]); }, [activeTab]);

    // ── Helper to build query string ──
    const getQueryString = () => {
        const params = new URLSearchParams();
        if (filters.region) params.append('region', filters.region);
        if (filters.division) params.append('division', filters.division);
        if (filters.municipality) params.append('municipality', filters.municipality);
        if (filters.legislative_district) params.append('legislative_district', filters.legislative_district);
        const qs = params.toString();
        return qs ? `?${qs}` : '';
    };

    // ── Fetch Filter Options ──
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                // Fetch basic regions
                const res = await fetch(`${API_BASE}/api/masterlist/filters`);
                const data = await res.json();
                setFilterOptions(prev => ({ ...prev, regions: data }));
            } catch (err) { console.error('Filter Fetch Error:', err); }
        };
        fetchFilters();
    }, []);

    // Cascade: Fetch Divisions when Region changes
    useEffect(() => {
        if (!filters.region) {
            setFilterOptions(prev => ({ ...prev, divisions: [], municipalities: [], legislativeDistricts: [] }));
            setFilters(prev => ({ ...prev, division: '', municipality: '', legislative_district: '' }));
            return;
        }
        fetch(`${API_BASE}/api/masterlist/filters?region=${encodeURIComponent(filters.region)}`)
            .then(r => r.json())
            .then(d => setFilterOptions(prev => ({ ...prev, divisions: d })))
            .catch(console.error);
    }, [filters.region]);

    // Cascade: Fetch Municipalities when Division changes
    useEffect(() => {
        if (!filters.division) {
            setFilterOptions(prev => ({ ...prev, municipalities: [], legislativeDistricts: [] }));
            setFilters(prev => ({ ...prev, municipality: '', legislative_district: '' }));
            return;
        }
        fetch(`${API_BASE}/api/masterlist/filters?division=${encodeURIComponent(filters.division)}`)
            .then(r => r.json())
            .then(d => setFilterOptions(prev => ({ ...prev, municipalities: d })))
            .catch(console.error);
    }, [filters.division]);

    // Cascade: Fetch Leg Districts when Municipality changes
    useEffect(() => {
        if (!filters.municipality) {
            setFilterOptions(prev => ({ ...prev, legislativeDistricts: [] }));
            setFilters(prev => ({ ...prev, legislative_district: '' }));
            return;
        }
        fetch(`${API_BASE}/api/masterlist/filters?municipality=${encodeURIComponent(filters.municipality)}`)
            .then(r => r.json())
            .then(d => setFilterOptions(prev => ({ ...prev, legislativeDistricts: d })))
            .catch(console.error);
    }, [filters.municipality]);

    // ── Restore Missing Handlers ──
    const loadCongressData = async () => {
        setCongressLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/deped-infrariorities`);
            const data = await res.json();
            setCongressRows(data);
        } catch (err) {
            console.error("Load Congress Data Error:", err);
        } finally {
            setCongressLoading(false);
        }
    };

    const handleCongressImport = async () => {
        try {
            setCongressLoading(true);
            const res = await fetch(`${API_BASE}/api/deped-infrariorities/import`, { method: 'POST' });
            const data = await res.json();
            setCongressImportMsg(data.message);
            loadCongressData();
        } catch (err) {
            console.error("Import error:", err);
            setCongressImportMsg("Import failed");
        } finally {
            setCongressLoading(false);
        }
    };

    const handlePartnerClick = async (partner) => {
        setSelectedPartner(partner);
        setPartnerSchools({ loading: true, data: [] });
        try {
            const qs = getQueryString();
            const res = await fetch(`${API_BASE}/api/masterlist/partnership-schools${qs}${qs ? '&' : '?'}type=${partner.type}&name=${encodeURIComponent(partner.name)}`);
            const data = await res.json();
            setPartnerSchools({ loading: false, data });
        } catch (err) {
            console.error("Partner Schools Fetch Error:", err);
            setPartnerSchools({ loading: false, data: [] });
        }
    };

    const handlePrototypeClick = async (sty, cl) => {
        setSelectedPrototype({ sty, cl });
        setPrototypeSchools({ loading: true, data: [] });
        try {
            const qs = getQueryString();
            const res = await fetch(`${API_BASE}/api/masterlist/prototype-schools${qs}${qs ? '&' : '?'}sty=${sty}&cl=${cl}`);
            const data = await res.json();
            setPrototypeSchools({ loading: false, data });
        } catch (err) {
            console.error("Prototype Schools Fetch Error:", err);
            setPrototypeSchools({ loading: false, data: [] });
        }
    };

    const handleResolve = async (schoolId, agency) => {
        try {
            const res = await fetch(`${API_BASE}/api/masterlist/resolve-partnership`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ school_id: schoolId, resolved_partnership: agency })
            });
            if (res.ok) {
                if (selectedPartner) handlePartnerClick(selectedPartner);
            }
        } catch (err) {
            console.error("Resolve Error:", err);
        }
    };

    // ── Fetch data when activeTab or filters change ──
    useEffect(() => {
        if (activeTab !== 'data' && activeTab !== 'home') return;

        const fetchData = async () => {
            setLoading(true);
            const qs = getQueryString();
            try {
                const [sumRes, regRes, yearRes, stRes, breakdownRes, partRes] = await Promise.all([
                    fetch(`${API_BASE}/api/masterlist/summary${qs}`),
                    fetch(`${API_BASE}/api/masterlist/by-region${qs}`),
                    fetch(`${API_BASE}/api/masterlist/by-funding-year${qs}`),
                    fetch(`${API_BASE}/api/masterlist/by-storey${qs}`),
                    fetch(`${API_BASE}/api/masterlist/storey-breakdown${qs}`),
                    fetch(`${API_BASE}/api/masterlist/partnerships${qs}`)
                ]);

                const summaryData = await sumRes.json();
                setSummary(summaryData);
                setByRegion(await regRes.json());
                setByYear(await yearRes.json());
                setByStorey(await stRes.json());

                const breakdownData = await breakdownRes.json();
                setStoreyBreakdown(breakdownData);

                if (breakdownData.length > 0 && !storeyOption) {
                    const firstSty = [...new Set(breakdownData.map(i => i.storey))].sort((a, b) => Number(a) - Number(b))[0];
                    if (firstSty) setStoreyOption(firstSty);
                }

                setPartnerships(await partRes.json());
            } catch (err) {
                console.error('Masterlist Data Fetch Error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [activeTab, filters]);

    // ── Helpers ──
    const formatCost = (v) => {
        const num = Number(v);
        if (num >= 1e9) return `₱${(num / 1e9).toFixed(1)}B`;
        if (num >= 1e6) return `₱${(num / 1e6).toFixed(1)}M`;
        return `₱${num.toLocaleString()}`;
    };


    // ───────────────────────
    // DATA VIEW (REAL DATA!)
    // ───────────────────────


    // ───────────────────────
    // RENDER
    // ───────────────────────
    return (
        <div className="min-h-screen bg-slate-50/50 font-sans text-slate-900 pb-20">
            <main className="container mx-auto px-4 md:px-8 lg:px-16 pt-6 max-w-7xl">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'home' && <HomeView 
                            summary={summary}
                            storeyBreakdown={storeyBreakdown}
                            partnerships={partnerships}
                            storeyOption={storeyOption}
                            setStoreyOption={setStoreyOption}
                            showCongressView={showCongressView}
                            setShowCongressView={setShowCongressView}
                            congressRows={congressRows}
                            setCongressRows={setCongressRows}
                            congressLoading={congressLoading}
                            setCongressLoading={setCongressLoading}
                            congressImportMsg={congressImportMsg}
                            setCongressImportMsg={setCongressImportMsg}
                            congressSearch={congressSearch}
                            setCongressSearch={setCongressSearch}
                            loadCongressData={loadCongressData}
                            handleCongressImport={handleCongressImport}
                            getQueryString={getQueryString}
                            drilldownPath={drilldownPath}
                            setDrilldownPath={setDrilldownPath}
                            handleBack={handleBack}
                            handlePartnerClick={handlePartnerClick}
                            handlePrototypeClick={handlePrototypeClick}
                            filters={filters}
                            setFilters={setFilters}
                            filterOptions={filterOptions}
                            handleKpiClick={handleKpiClick}
                            setPartnerships={setPartnerships}
                            setSelectedPartner={setSelectedPartner}
                            setPartnerSchools={setPartnerSchools}
                            setSelectedPrototype={setSelectedPrototype}
                            setPrototypeSchools={setPrototypeSchools}
                            handleDrilldown={handleDrilldown}
                        />}
                        {activeTab === 'data' && <DataView 
                            loading={loading}
                            summary={summary}
                            filters={filters}
                            formatCost={formatCost}
                            byRegion={byRegion}
                            byYear={byYear}
                            byStorey={byStorey}
                        />}
                        {activeTab === 'settings' && (
                            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 font-medium">
                                <div className="p-6 bg-white rounded-full shadow-sm mb-4">
                                    <FiSettings className="w-12 h-12 text-blue-200" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-600">Settings View</h3>
                                <p>Configuration options coming soon.</p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* KPI Drilldown Modal */}
                <AnimatePresence>
                    {selectedKpi && (
                        <KpiDrilldownModal
                            kpi={selectedKpi}
                            onClose={() => setSelectedKpi(null)}
                            globalFilters={filters}
                        />
                    )}
                </AnimatePresence>

                {/* Organization Schools Modal */}
                <AnimatePresence>
                    {selectedPartner && (
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:px-6">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 50 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 50 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                            >
                                <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 relative">
                                    <button onClick={() => setSelectedPartner(null)} className="absolute top-4 right-4 text-white/70 hover:text-white p-2">
                                        <FiX size={24} />
                                    </button>
                                    <div className="inline-flex items-center gap-2 bg-blue-900/40 px-3 py-1 rounded-full border border-blue-400/30 text-[10px] font-black uppercase text-blue-200 tracking-widest mb-3">
                                        {selectedPartner.type} Partner
                                    </div>
                                    <h2 className="text-2xl font-black text-white">{selectedPartner.name}</h2>
                                    <p className="text-blue-100/80 text-sm mt-1">Showing all proposed school infrastructure projects handled by this entity.</p>
                                </div>

                                <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                                    {partnerSchools.loading ? (
                                        <div className="flex flex-col items-center justify-center space-y-4 py-12">
                                            <FiLoader className="w-8 h-8 text-blue-500 animate-spin" />
                                            <p className="text-slate-500 font-medium text-sm">Fetching school projects...</p>
                                        </div>
                                    ) : partnerSchools.data.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
                                                <FiMap size={32} />
                                            </div>
                                            <p className="text-slate-500 font-medium">No projects found for this organization.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {partnerSchools.data.map((school, i) => (
                                                <div key={i} className="bg-white border text-left border-slate-200 p-4 rounded-xl shadow-sm hover:border-blue-300 transition-colors">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div>
                                                            <div className="text-xs font-mono font-bold text-slate-400 mb-1">{school.school_id}</div>
                                                            <h4 className="text-base font-bold text-slate-800 leading-tight">{school.school_name}</h4>
                                                            {selectedPartner?.type === 'FOR_DECISION' && (
                                                                <div className="mt-2 flex flex-wrap gap-1">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block w-full mb-1">Implementers:</span>
                                                                    {[
                                                                        { key: 'prov_implemented', label: 'PGO', color: 'bg-teal-50 text-teal-600 border-teal-100' },
                                                                        { key: 'muni_implemented', label: 'MGO', color: 'bg-blue-50 text-blue-600 border-blue-100' },
                                                                        { key: 'city_implemented', label: 'CGO', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
                                                                        { key: 'dpwh_implemented', label: 'DPWH', color: 'bg-orange-50 text-orange-600 border-orange-100' },
                                                                        { key: 'deped_implemented', label: 'DepEd', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                                                                        { key: 'cso_ngo_implemented', label: 'CSO', color: 'bg-rose-50 text-rose-600 border-rose-100' }
                                                                    ].filter(imp => school[imp.key]).map(imp => (
                                                                        <span key={imp.label} className={`px-2 py-0.5 rounded text-[9px] font-black border ${imp.color}`}>
                                                                            {imp.label}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-4 sm:text-right shrink-0">
                                                            <div className="bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 flex flex-col justify-center">
                                                                <span className="text-[10px] uppercase font-bold text-amber-500">Shortage</span>
                                                                <span className="font-black text-amber-700">{school.shortage}</span>
                                                            </div>
                                                            <div className="bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 flex flex-col justify-center">
                                                                <span className="text-[10px] uppercase font-bold text-emerald-500">Proposed CL</span>
                                                                <span className="font-black text-emerald-700">{school.classrooms}</span>
                                                            </div>
                                                            <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 flex flex-col justify-center min-w-[100px]">
                                                                <span className="text-[10px] uppercase font-bold text-blue-500">Est. Cost</span>
                                                                <span className="font-black text-blue-700">{formatCost(school.cost)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {selectedPartner?.type === 'FOR_DECISION' && (
                                                        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><FiAlertCircle /> Resolve to:</span>
                                                            <select
                                                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 block w-full sm:w-48 cursor-pointer"
                                                                onChange={(e) => handleResolve(school.school_id, e.target.value)}
                                                                defaultValue=""
                                                            >
                                                                <option value="" disabled>Select Agency...</option>
                                                                <option value="PGO">PGO (Provincial Gov)</option>
                                                                <option value="MGO">MGO (Municipal Gov)</option>
                                                                <option value="CGO">CGO (City Gov)</option>
                                                                <option value="DPWH">DPWH</option>
                                                                <option value="DEPED">DepEd</option>
                                                                <option value="CSO">CSO</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {!partnerSchools.loading && (
                                    <div className="bg-white border-t border-slate-100 p-4 flex justify-between items-center text-sm">
                                        <span className="font-bold text-slate-500">{partnerSchools.data.length} Schools Listed</span>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Prototype Schools Modal */}
                <AnimatePresence>
                    {selectedPrototype && (
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:px-6">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 50 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 50 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                            >
                                <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 relative">
                                    <button onClick={() => setSelectedPrototype(null)} className="absolute top-4 right-4 text-white/70 hover:text-white p-2">
                                        <FiX size={24} />
                                    </button>
                                    <div className="inline-flex items-center gap-2 bg-blue-900/40 px-3 py-1 rounded-full border border-blue-400/30 text-[10px] font-black uppercase text-blue-200 tracking-widest mb-3">
                                        Prototype {selectedPrototype.sty}STY{selectedPrototype.cl}CL
                                    </div>
                                    <h2 className="text-2xl font-black text-white">{selectedPrototype.sty}-Storey, {selectedPrototype.cl}-Classroom</h2>
                                    <p className="text-blue-100/80 text-sm mt-1">Showing all proposed school infrastructure projects utilizing this design prototype.</p>
                                </div>

                                <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                                    {prototypeSchools.loading ? (
                                        <div className="flex flex-col items-center justify-center space-y-4 py-12">
                                            <FiLoader className="w-8 h-8 text-blue-500 animate-spin" />
                                            <p className="text-slate-500 font-medium text-sm">Fetching school projects...</p>
                                        </div>
                                    ) : prototypeSchools.data.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
                                                <FiMap size={32} />
                                            </div>
                                            <p className="text-slate-500 font-medium">No projects found for this prototype.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {prototypeSchools.data.map((school, i) => (
                                                <div key={i} className="bg-white border text-left border-slate-200 p-4 rounded-xl shadow-sm hover:border-blue-300 transition-colors">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div>
                                                            <div className="text-xs font-mono font-bold text-slate-400 mb-1">{school.school_id}</div>
                                                            <h4 className="text-base font-bold text-slate-800 leading-tight">{school.school_name}</h4>
                                                        </div>
                                                        <div className="flex gap-4 sm:text-right shrink-0">
                                                            <div className="bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 flex flex-col justify-center">
                                                                <span className="text-[10px] uppercase font-bold text-amber-500">Shortage</span>
                                                                <span className="font-black text-amber-700">{school.shortage}</span>
                                                            </div>
                                                            <div className="bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 flex flex-col justify-center">
                                                                <span className="text-[10px] uppercase font-bold text-emerald-500">Proposed CL</span>
                                                                <span className="font-black text-emerald-700">{school.classrooms}</span>
                                                            </div>
                                                            <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 flex flex-col justify-center min-w-[100px]">
                                                                <span className="text-[10px] uppercase font-bold text-blue-500">Est. Cost</span>
                                                                <span className="font-black text-blue-700">{formatCost(school.cost)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {!prototypeSchools.loading && (
                                    <div className="bg-white border-t border-slate-100 p-4 flex justify-between items-center text-sm">
                                        <span className="font-bold text-slate-500">{prototypeSchools.data.length} Schools Listed</span>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </main>
            <BottomNav userRole="Masterlist" />

            {/* FLOATING AI CHATBOT */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4 pointer-events-none">
                <AnimatePresence>
                    {isAIChatOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="w-[350px] md:w-[400px] shadow-2xl rounded-2xl overflow-hidden pointer-events-auto border border-slate-200"
                        >
                            <MasterlistAIChat onClose={() => setIsAIChatOpen(false)} />
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    onClick={() => setIsAIChatOpen(!isAIChatOpen)}
                    className="w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all pointer-events-auto group"
                >
                    {isAIChatOpen ? <FiCheckCircle className="w-8 h-8" /> : (
                        <div className="relative">
                            <FiCpu className="w-8 h-8" />
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-blue-600 animate-pulse"></div>
                        </div>
                    )}
                    <span className="absolute right-20 bg-slate-800 text-white text-[10px] px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-widest pointer-events-none whitespace-nowrap">
                        AI Assistant
                    </span>
                </button>
            </div>
        </div>
    );
};

export default PSIP;
