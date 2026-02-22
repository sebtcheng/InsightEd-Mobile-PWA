import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronRight, FiLayers, FiMap, FiUser, FiTv, FiSettings, FiDatabase, FiTrendingUp, FiDollarSign, FiBarChart2, FiTarget, FiAlertTriangle, FiCheckCircle, FiClock, FiLoader, FiCpu, FiSend } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import BottomNav from './BottomNav';

const API_BASE = "";

// Storey colors for pie chart
const STOREY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#FB923C'];

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

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

    // ── Advanced Filtering State ──
    const [filters, setFilters] = useState({
        region: '',
        division: '',
        municipality: '',
        leg_district: ''
    });
    const [filterOptions, setFilterOptions] = useState({
        regions: [],
        divisions: [],
        municipalities: [],
        legDistricts: []
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
        if (filters.leg_district) params.append('leg_district', filters.leg_district);
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
            setFilterOptions(prev => ({ ...prev, divisions: [], municipalities: [], legDistricts: [] }));
            setFilters(prev => ({ ...prev, division: '', municipality: '', leg_district: '' }));
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
            setFilterOptions(prev => ({ ...prev, municipalities: [], legDistricts: [] }));
            setFilters(prev => ({ ...prev, municipality: '', leg_district: '' }));
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
            setFilterOptions(prev => ({ ...prev, legDistricts: [] }));
            setFilters(prev => ({ ...prev, leg_district: '' }));
            return;
        }
        fetch(`${API_BASE}/api/masterlist/filters?municipality=${encodeURIComponent(filters.municipality)}`)
            .then(r => r.json())
            .then(d => setFilterOptions(prev => ({ ...prev, legDistricts: d })))
            .catch(console.error);
    }, [filters.municipality]);

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
                    const firstSty = [...new Set(breakdownData.map(i => i.storey))].sort((a,b) => Number(a)-Number(b))[0];
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

    // ── Sub-components ──
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

    // ───────────────────────
    // HOME VIEW
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
                        <div className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${
                            m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
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
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleSend()}
                        placeholder="e.g. List top 5 schools in Region I by shortage..."
                        className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isAILoading}
                        className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <FiSend />
                    </button>
                </div>
            </div>
        </div>
    );
};

const HomeView = () => {
        const totalClassrooms = summary ? Number(summary.total_classrooms) : 0;
        
        // [NEW] Derive unique storeys dynamically
        const uniqueStoreys = [...new Set(storeyBreakdown.map(item => item.storey))].sort((a, b) => a - b);

        const partnershipCards = [
            {
                id: 'NGO', title: 'NGO',
                icon: <FiUser className="w-6 h-6" />, color: 'bg-blue-100 text-blue-600',
                count: 12,
                drilldown: [
                    { name: 'Gawad Kalinga', projects: 5, classrooms: 12 },
                    { name: 'ABS-CBN Foundation', projects: 3, classrooms: 8 },
                    { name: 'Coca-Cola Foundation', projects: 4, classrooms: 10 }
                ]
            },
            {
                id: 'PGO', title: 'PGO',
                icon: <FiMap className="w-6 h-6" />, color: 'bg-teal-100 text-teal-600',
                count: 8,
                drilldown: [
                    { name: 'Provincial Gov of Pangasinan', projects: 12, classrooms: 24 },
                    { name: 'Provincial Gov of Cebu', projects: 15, classrooms: 30 }
                ]
            },
            {
                id: 'CGO', title: 'CGO',
                icon: <FiTv className="w-6 h-6" />, color: 'bg-purple-100 text-purple-600',
                count: 24,
                drilldown: [
                    { name: 'City Gov of Manila', projects: 8, classrooms: 20 },
                    { name: 'City Gov of Davao', projects: 10, classrooms: 25 }
                ]
            },
            {
                id: 'DPWH', title: 'DPWH',
                icon: <FiSettings className="w-6 h-6" />, color: 'bg-orange-100 text-orange-600',
                count: 45,
                drilldown: [
                    { name: 'Region III DPWH', projects: 20, classrooms: 60 },
                    { name: 'Region IV-A DPWH', projects: 25, classrooms: 75 }
                ]
            },
            {
                id: 'DEPED', title: 'DEPED',
                icon: <FiCheckCircle className="w-6 h-6" />, color: 'bg-emerald-100 text-emerald-600',
                count: 120,
                drilldown: [
                    { name: 'Central Office Provision', projects: 100, classrooms: 300 },
                    { name: 'Quick Response Fund', projects: 20, classrooms: 50 }
                ]
            },
            {
                id: 'CSO', title: 'CSO',
                icon: <FiLayers className="w-6 h-6" />, color: 'bg-rose-100 text-rose-600',
                count: 15,
                drilldown: [
                    { name: 'PTA Aggregates', projects: 10, classrooms: 15 },
                    { name: 'Local Community Groups', projects: 5, classrooms: 8 }
                ]
            },
        ];

        // Fetch partnerships for drilldown if not yet loaded
        useEffect(() => {
            if (!partnerships) {
                fetch(`${API_BASE}/api/masterlist/partnerships`)
                    .then(r => r.json())
                    .then(d => setPartnerships(d))
                    .catch(() => {});
            }
        }, []);

        if (drilldownPath.length > 0) {
            const currentLevel = drilldownPath[drilldownPath.length - 1];
            return (
                <div className="space-y-6 pb-32 animate-fadeIn">
                    <button onClick={handleBack} className="text-sm text-blue-600 font-bold flex items-center gap-2 mb-4 hover:translate-x-[-4px] transition-transform">
                        <FiChevronRight className="rotate-180" /> Back to Overview
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800 mb-6">{currentLevel.title} — Top Partners</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {currentLevel.drilldown.map((item, idx) => (
                            <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all">
                                <span className="font-bold text-slate-700 text-base block mb-1">{item.name}</span>
                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <span>{Number(item.projects).toLocaleString()} projects</span>
                                    <span className="text-blue-600 font-bold">{Number(item.classrooms).toLocaleString()} classrooms</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-8 pb-32">
                {/* [RELOCATED] Prototypes & Filters - Now at the Top */}
                <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><FiMap className="w-5 h-5" /></div>
                        Focus Area Selection
                    </h2>

                    {/* Geographic Breakdown Cards & Cascading Filters */}
                    <div className="space-y-4 mb-2">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <select value={filters.region} onChange={e => setFilters({...filters, region: e.target.value})}
                                className="bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm">
                                <option value="">All Regions</option>
                                {filterOptions.regions.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <select value={filters.division} onChange={e => setFilters({...filters, division: e.target.value})}
                                disabled={!filters.region}
                                className="bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 shadow-sm">
                                <option value="">All Divisions</option>
                                {filterOptions.divisions.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select value={filters.municipality} onChange={e => setFilters({...filters, municipality: e.target.value})}
                                disabled={!filters.division}
                                className="bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 shadow-sm">
                                <option value="">All Municipalities</option>
                                {filterOptions.municipalities.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select value={filters.leg_district} onChange={e => setFilters({...filters, leg_district: e.target.value})}
                                disabled={!filters.municipality}
                                className="bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 shadow-sm">
                                <option value="">All Leg. Districts</option>
                                {filterOptions.legDistricts.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {[
                                { label: 'Nationwide', icon: <FiDatabase />, count: summary ? Number(summary.total_projects) : '...', color: 'text-blue-600', sub: 'Total Projects' },
                                { label: 'Region', icon: <FiMap />, count: filters.region ? 1 : (summary ? Number(summary.total_regions) : '...') },
                                { label: 'Division', icon: <FiLayers />, count: filters.division ? 1 : (byRegion.length || '...') },
                                { label: 'Municipality', icon: <FiTarget />, count: filters.municipality ? 1 : (summary && !filters.division ? 1500 : '...') },
                                { label: 'Leg. District', icon: <FiBarChart2 />, count: filters.leg_district ? 1 : (summary && !filters.municipality ? 250 : '...') },
                            ].map((card, i) => (
                                <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center hover:shadow-md transition-all">
                                    <div className={`${card.color || 'text-indigo-500'} mb-2 text-xl`}>{card.icon}</div>
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{card.label}</div>
                                    <div className="text-xl font-black text-slate-800">{card.count}</div>
                                    {card.sub && <div className="text-[8px] text-slate-400 uppercase font-black">{card.sub}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Hero */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/30 rounded-full blur-2xl -ml-10 -mb-10"></div>
                    <div className="relative z-10">
                        <h1 className="text-3xl lg:text-4xl font-extrabold mb-2 tracking-tight">Masterlist Dashboard</h1>
                        <p className="opacity-90 text-base mb-8 max-w-lg">Strategic Overview and Classroom Provision Planning</p>
                        <div className="flex flex-wrap gap-4">
                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 inline-block min-w-[280px]">
                                <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Estimated Classroom Shortage</p>
                                <div className="text-5xl font-black tracking-tighter">{summary && summary.total_shortage ? Number(summary.total_shortage).toLocaleString() : '...'}</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full border border-white/30 text-xs font-bold">
                                        {summary ? Number(summary.total_schools).toLocaleString() : '...'} Schools
                                    </span>
                                    <span className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full border border-white/30 text-xs font-bold">
                                        {summary ? Number(summary.total_regions) : '...'} Regions
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 inline-block min-w-[280px]">
                                <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Proposed No of Classroom</p>
                                <div className="text-5xl font-black tracking-tighter text-emerald-300">{summary && summary.total_classrooms ? Number(summary.total_classrooms).toLocaleString() : '...'}</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center gap-2 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 text-xs font-bold text-emerald-100">
                                        Overall Total
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Partnerships */}
                <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><FiLayers className="w-5 h-5" /></div>
                        Partnerships Projects
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {partnershipCards.map(p => (
                            <motion.div key={p.id}
                                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleDrilldown(p)}
                                className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center sm:justify-between gap-4 cursor-pointer hover:shadow-lg transition-all h-full"
                            >
                                <div className="flex items-center gap-4 w-full">
                                    <div className={`p-4 rounded-full ${p.color} shrink-0`}>{p.icon}</div>
                                    <div className="text-center sm:text-left">
                                        <h3 className="text-lg font-bold text-slate-800">{p.title}</h3>
                                        <p className="text-sm text-slate-500">{p.count} unique partners</p>
                                    </div>
                                </div>
                                <div className="hidden sm:block"><FiChevronRight className="text-slate-400 w-5 h-5" /></div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Prototypes */}
                <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><FiSettings className="w-5 h-5" /></div>
                        Design Prototypes
                    </h2>

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
                                        Below are the specific variations implemented across various school sites.
                                    </p>
                                    
                                    {/* [NEW] Interactive Variation Matrix */}
                                    <div className="w-full max-w-2xl">
                                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 text-center">Implementation Matrix</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {storeyBreakdown
                                                .filter(item => item.storey === storeyOption)
                                                .map((item, idx) => (
                                                    <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between group hover:border-blue-500 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center font-bold text-blue-600 border border-slate-100">
                                                                {item.classrooms}
                                                            </div>
                                                            <div className="text-left">
                                                                <div className="text-xs font-black text-slate-800 uppercase tracking-tighter">
                                                                    {storeyOption}sty{item.classrooms}cl
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 font-bold">
                                                                    {item.classrooms} Classrooms Configuration
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-lg font-black text-slate-900 leading-none">
                                                                {Number(item.count).toLocaleString()}
                                                            </div>
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase">Projects</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            {storeyBreakdown.filter(item => item.storey === storeyOption).length === 0 && (
                                                <div className="col-span-full py-10 text-slate-400 italic text-sm">
                                                    No configuration data found for this storey level.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-2xl p-20 border-2 border-slate-100 border-dashed flex flex-col items-center justify-center text-center">
                                <div className="text-slate-300 text-6xl mb-4 opacity-20">📊</div>
                                <h4 className="text-xl font-bold text-slate-400">Select a storey to view data</h4>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ───────────────────────
    // DATA VIEW (REAL DATA!)
    // ───────────────────────
    const DataView = () => {
        if (loading) return <LoadingSpinner />;
        if (!summary || Number(summary.total_projects) === 0) return <EmptyState />;

        const totalCost = Number(summary.total_cost);
        const totalProjects = Number(summary.total_projects);
        const totalClassrooms = Number(summary.total_classrooms);
        const totalSchools = Number(summary.total_schools);

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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        {activeTab === 'home' && <HomeView />}
                        {activeTab === 'data' && <DataView />}
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
