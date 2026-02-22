import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronRight, FiLayers, FiMap, FiUser, FiTv, FiSettings, FiDatabase, FiTrendingUp, FiDollarSign, FiBarChart2, FiTarget, FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiClock, FiLoader, FiCpu, FiSend, FiX } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LabelList } from 'recharts';
import BottomNav from './BottomNav';

const API_BASE = "";

// Storey colors for pie chart
const STOREY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#FB923C'];

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

const KpiDrilldownModal = ({ kpi, onClose }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewBy, setViewBy] = useState('region'); // Default to Region, but allows Municipality or Leg District
    const [localRegion, setLocalRegion] = useState('');
    const [localDivision, setLocalDivision] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                params.append('groupBy', viewBy);
                if (localRegion) params.append('region', localRegion);
                if (localDivision) params.append('division', localDivision);

                const res = await fetch(`${API_BASE}/api/masterlist/distribution?${params.toString()}`);
                const json = await res.json();

                // Sort descending based on chosen KPI
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

    const handleBarClick = (entry) => {
        if (!entry || !entry.name) return;
        if (viewBy === 'region') {
            setLocalRegion(entry.name);
            setViewBy('division');
        } else if (viewBy === 'division') {
            setLocalDivision(entry.name);
            setViewBy('municipality');
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

                    {/* View By Selector - Only show in Municipality/Legislative District view */}
                    {(viewBy === 'municipality' || viewBy === 'legislative_district') && (
                        <div className="flex items-center gap-3 sm:pr-8">
                            <label className="text-xs font-bold text-slate-500 uppercase">View By:</label>
                            <select
                                value={viewBy}
                                onChange={(e) => setViewBy(e.target.value)}
                                className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer"
                            >
                                <option value="municipality">Municipality</option>
                                <option value="legislative_district">Legislative District</option>
                            </select>
                        </div>
                    )}

                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors absolute top-6 right-6">
                        <FiX size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto bg-white min-h-[400px]">
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
                        <ResponsiveContainer width="100%" height={380}>
                            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-45} textAnchor="end" height={80} />
                                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => Number(v).toLocaleString()} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    formatter={(value) => [Number(value).toLocaleString(), kpi.title]}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 'bold' }}
                                />
                                <Bar
                                    dataKey={kpi.key}
                                    fill={kpi.color}
                                    radius={[6, 6, 0, 0]}
                                    cursor={(viewBy === 'region' || viewBy === 'division') ? 'pointer' : 'default'}
                                    onClick={handleBarClick}
                                >
                                    <LabelList
                                        dataKey={kpi.key}
                                        position="top"
                                        offset={10}
                                        style={{ fontSize: '10px', fontWeight: 'bold', fill: '#64748b' }}
                                        formatter={(val) => Math.round(val).toLocaleString()}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </motion.div>
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

    // ── KPI Drilldown State ──
    const [selectedKpi, setSelectedKpi] = useState(null); // { key: 'shortage', title: '...', color: '...' }

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

        const partnershipCards = partnerships ? [
            {
                id: 'PGO', title: 'PGO (Provincial Gov)',
                icon: <FiMap className="w-6 h-6" />, color: 'bg-teal-100 text-teal-600',
                count: partnerships.totals ? Number(partnerships.totals.governor_count) || 0 : partnerships.pgo?.length || 0,
                drilldown: partnerships.pgo || []
            },
            {
                id: 'MGO', title: 'MGO (Municipal Gov)',
                icon: <FiUser className="w-6 h-6" />, color: 'bg-blue-100 text-blue-600',
                count: partnerships.mgo?.length || 0,
                drilldown: partnerships.mgo || []
            },
            {
                id: 'CGO', title: 'CGO (City Gov)',
                icon: <FiTv className="w-6 h-6" />, color: 'bg-purple-100 text-purple-600',
                count: partnerships.cgo?.length || 0,
                drilldown: partnerships.cgo || []
            },
            {
                id: 'DPWH', title: 'DPWH',
                icon: <FiSettings className="w-6 h-6" />, color: 'bg-orange-100 text-orange-600',
                count: partnerships.dpwh?.length > 0 ? Number(partnerships.dpwh[0].projects) : 0,
                drilldown: partnerships.dpwh || []
            },
            {
                id: 'DEPED', title: 'DepEd',
                icon: <FiCheckCircle className="w-6 h-6" />, color: 'bg-emerald-100 text-emerald-600',
                count: partnerships.deped?.length > 0 ? Number(partnerships.deped[0].projects) : 0,
                drilldown: partnerships.deped || []
            },
            {
                id: 'CSO', title: 'CSO',
                icon: <FiLayers className="w-6 h-6" />, color: 'bg-rose-100 text-rose-600',
                count: partnerships.cso?.length > 0 ? Number(partnerships.cso[0].projects) : 0,
                drilldown: partnerships.cso || []
            },
            {
                id: 'FOR_DECISION', title: 'For Decision',
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

        // New Resolution Handler
        const handleResolve = async (school_id, resolved_partnership) => {
            if (!resolved_partnership) return;
            try {
                await fetch(`${API_BASE}/api/masterlist/resolve-partnership`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ school_id, resolved_partnership })
                });

                // Remove the school from current view immediately
                setPartnerSchools(prev => ({
                    ...prev,
                    data: prev.data.filter(s => s.school_id !== school_id)
                }));

                // Refresh the partnership tally cards completely
                const qs = getQueryString();
                const res = await fetch(`${API_BASE}/api/masterlist/partnerships${qs}`);
                const data = await res.json();
                setPartnerships(data);
            } catch (err) {
                console.error("Failed to resolve partnership:", err);
            }
        };

        const handlePartnerClick = async (type, name) => {
            setSelectedPartner({ type, name });
            setPartnerSchools({ loading: true, data: [] });
            const qs = getQueryString();
            const delimiter = qs ? '&' : '?';
            try {
                const res = await fetch(`${API_BASE}/api/masterlist/partnership-schools${qs}${delimiter}type=${type}&name=${encodeURIComponent(name)}`);
                const data = await res.json();
                setPartnerSchools({ loading: false, data });
            } catch (err) {
                console.error("Failed to fetch partner schools:", err);
                setPartnerSchools({ loading: false, data: [] });
            }
        };

        const handlePrototypeClick = async (sty, cl) => {
            setSelectedPrototype({ sty, cl });
            setPrototypeSchools({ loading: true, data: [] });
            const qs = getQueryString();
            const delimiter = qs ? '&' : '?';
            try {
                const res = await fetch(`${API_BASE}/api/masterlist/prototype-schools${qs}${delimiter}sty=${sty}&cl=${cl}`);
                const data = await res.json();
                setPrototypeSchools({ loading: false, data });
            } catch (err) {
                console.error("Failed to fetch prototype schools:", err);
                setPrototypeSchools({ loading: false, data: [] });
            }
        };

        if (drilldownPath.length > 0) {
            const currentLevel = drilldownPath[drilldownPath.length - 1];
            return (
                <div className="space-y-6 pb-32 animate-fadeIn">
                    <button onClick={handleBack} className="text-sm text-blue-600 font-bold flex items-center gap-2 mb-4 hover:translate-x-[-4px] transition-transform">
                        <FiChevronRight className="rotate-180" /> Back to Overview
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800 mb-6">{currentLevel.title} — Top Partners</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {currentLevel.drilldown.length === 0 && (
                            <div className="text-slate-400 italic text-sm">No organizations categorized under {currentLevel.title} yet.</div>
                        )}
                        {currentLevel.drilldown.map((item, idx) => (
                            <div key={idx}
                                onClick={() => handlePartnerClick(currentLevel.id, item.name)}
                                className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
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
                {/* [RELOCATED] Prototypes & Filters - Now at the Top */}
                <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><FiMap className="w-5 h-5" /></div>
                        Focus Area Selection
                    </h2>

                    {/* Geographic Breakdown Cards & Cascading Filters */}
                    <div className="space-y-4 mb-2">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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

                        {/* Geographic breakdown cards removed per request */}
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
                            <motion.div
                                onClick={() => handleKpiClick({ key: 'shortage', title: 'Estimated Classroom Shortage', color: '#f59e0b' })}
                                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                whileTap={{ scale: 0.98 }}
                                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 inline-block min-w-[280px] cursor-pointer hover:bg-white/20 transition-colors"
                            >
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
                            </motion.div>

                            <motion.div
                                onClick={() => handleKpiClick({ key: 'projects', title: 'Total Projects', color: '#3b82f6' })}
                                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                whileTap={{ scale: 0.98 }}
                                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 inline-block min-w-[280px] cursor-pointer hover:bg-white/20 transition-colors"
                            >
                                <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Total Projects</p>
                                <div className="text-5xl font-black tracking-tighter text-blue-200">{summary && summary.total_projects ? Number(summary.total_projects).toLocaleString() : '...'}</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center gap-2 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-400/30 text-xs font-bold text-blue-100">
                                        Overall Total
                                    </span>
                                </div>
                            </motion.div>

                            <motion.div
                                onClick={() => handleKpiClick({ key: 'sites', title: 'Total Number of Sites', color: '#a855f7' })}
                                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                whileTap={{ scale: 0.98 }}
                                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 inline-block min-w-[280px] cursor-pointer hover:bg-white/20 transition-colors"
                            >
                                <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Total Number of Sites</p>
                                <div className="text-5xl font-black tracking-tighter text-purple-200">{summary && summary.total_sites ? Number(summary.total_sites).toLocaleString() : '...'}</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center gap-2 bg-purple-500/20 px-3 py-1 rounded-full border border-purple-400/30 text-xs font-bold text-purple-100">
                                        Overall Total
                                    </span>
                                </div>
                            </motion.div>

                            <motion.div
                                onClick={() => handleKpiClick({ key: 'classrooms', title: 'Proposed No of Classroom', color: '#10b981' })}
                                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                whileTap={{ scale: 0.98 }}
                                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 inline-block min-w-[280px] cursor-pointer hover:bg-white/20 transition-colors"
                            >
                                <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Proposed No of Classroom</p>
                                <div className="text-5xl font-black tracking-tighter text-emerald-300">{summary && summary.total_classrooms ? Number(summary.total_classrooms).toLocaleString() : '...'}</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center gap-2 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 text-xs font-bold text-emerald-100">
                                        Overall Total
                                    </span>
                                </div>
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
                                        <p className="text-sm text-slate-500">{p.count} {p.id === 'FOR_DECISION' ? 'multiple agencies' : 'unique partners'}</p>
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
                                                                <div className="text-[10px] text-slate-400 font-bold group-hover:text-blue-500 flex items-center gap-1">
                                                                    {item.classrooms} Classrooms Configuration <FiChevronRight />
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
