import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEngineerOutbox, deleteEngineerFromOutbox } from '../db';
import BottomNav from './BottomNav';

const EngineerOutbox = () => {
    const navigate = useNavigate();
    const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || "Engineer");
    const [items, setItems] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [statusMap, setStatusMap] = useState({});

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        const data = await getEngineerOutbox();
        // Sort by newest first
        setItems(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    };

    // --- NEW: DELETE HANDLER ---
    const handleDelete = async (id) => {
        const confirmDelete = window.confirm("Are you sure you want to delete this item? This data will be lost permanently.");

        if (confirmDelete) {
            try {
                await deleteEngineerFromOutbox(id);
                // Refresh list immediately after deleting
                loadItems();
            } catch (error) {
                console.error("Error deleting item:", error);
                alert("Failed to delete item.");
            }
        }
    };

    // --- HELPER TO FIX URLS AUTOMATICALLY ---
    const getCorrectEndpoint = (savedUrl) => {
        let path = savedUrl;

        // 1. If absolute URL, extract path
        if (savedUrl && savedUrl.startsWith('http')) {
            try {
                const urlObj = new URL(savedUrl);
                path = urlObj.pathname;
            } catch (e) {
                console.error("URL parsing error:", e);
                // If parsing fails, we keep path = savedUrl and hope for the best
            }
        }

        // 2. Normalize: Ensure it starts with /api
        // We check 'path' here, not 'savedUrl'
        if (path && !path.startsWith('/api')) {
            // Handle cases like "projects" -> "/api/projects" or "/projects" -> "/api/projects"
            return `/api${path.startsWith('/') ? '' : '/'}${path}`;
        }

        return path;
    };

    const handleSyncAll = async () => {
        if (!navigator.onLine) {
            alert("⚠️ You are offline. Cannot sync now.");
            return;
        }

        setIsSyncing(true);

        for (const item of items) {
            setStatusMap(prev => ({ ...prev, [item.id]: 'syncing' }));

            try {
                const targetUrl = getCorrectEndpoint(item.url);
                console.log(`Syncing item ${item.id} to: ${targetUrl}`);

                const response = await fetch(targetUrl, {
                    method: item.method || 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.body)
                });

                if (response.ok) {
                    setStatusMap(prev => ({ ...prev, [item.id]: 'success' }));
                    await new Promise(r => setTimeout(r, 500));
                    await deleteEngineerFromOutbox(item.id);
                } else {
                    console.error(`Server error for item ${item.id}:`, response.status);
                    setStatusMap(prev => ({ ...prev, [item.id]: 'error' }));
                }

            } catch (err) {
                console.error(`Network error for item ${item.id}:`, err);
                setStatusMap(prev => ({ ...prev, [item.id]: 'error' }));
            }
        }

        setIsSyncing(false);
        loadItems();
    };


    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-32 relative">

            {/* HEADER SECTION (Themed) */}
            <div className="relative bg-[#004A99] pt-12 pb-24 px-6 rounded-b-[3rem] shadow-2xl z-0 overflow-hidden">
                {/* Background Decorative Circles */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>

                <div className="relative z-10 flex items-center gap-3 text-white mb-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <span className="text-2xl">&larr;</span>
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Sync Center</h1>
                        <p className="text-blue-100 text-sm opacity-90">
                            Upload your project reports and site data.
                        </p>
                    </div>
                </div>
            </div>

            {/* --- CONTENT --- */}
            <div className="px-6 -mt-12 relative z-10">

                {/* STATUS CARD / SYNC BUTTON */}
                <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 mb-6">
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Queue Status</p>
                            <h2 className="text-2xl font-bold text-slate-800">
                                {items.length} <span className="text-base font-normal text-slate-500">Pending</span>
                            </h2>
                        </div>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${items.length > 0 ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                            }`}>
                            {items.length > 0 ? '☁️' : '✅'}
                        </div>
                    </div>

                    {items.length > 0 ? (
                        <button
                            onClick={handleSyncAll}
                            disabled={isSyncing}
                            className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-95
                            ${isSyncing ? 'bg-blue-400 cursor-progress' : 'bg-[#004A99] hover:bg-blue-800'}
                            `}
                        >
                            {isSyncing ? (
                                <>
                                    <span className="animate-spin text-xl">⏳</span> Syncing Data...
                                </>
                            ) : (
                                <>
                                    <span className="text-xl">🚀</span> Sync All Now
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="bg-slate-50 rounded-xl p-4 text-center border border-dashed border-slate-200">
                            <p className="text-slate-400 text-sm">You're all caught up! No pending data.</p>
                        </div>
                    )}
                </div>

                {/* LIST header */}
                {items.length > 0 && (
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 pl-2">Pending Items</h3>
                )}

                {/* List */}
                <div className="space-y-3 pb-6">
                    {items.map((item) => (
                        <div key={item.id} className="bg-white p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex items-center justify-between group relative overflow-hidden">
                            {/* Progress Bar Background for Syncing */}
                            {statusMap[item.id] === 'syncing' && (
                                <div className="absolute bottom-0 left-0 h-1 bg-blue-500 animate-pulse w-full"></div>
                            )}

                            <div className="flex items-center gap-4 relative z-10">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 transition-colors
                                    ${statusMap[item.id] === 'success' ? 'bg-green-100 text-green-600' :
                                        statusMap[item.id] === 'error' ? 'bg-red-100 text-red-600' :
                                            'bg-slate-50 text-blue-600 group-hover:bg-blue-50'}
                                `}>
                                    {/* Engineer Icons */}
                                    {statusMap[item.id] === 'success' ? '✅' :
                                        statusMap[item.id] === 'error' ? '❌' :
                                            '👷'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1">{item.formName || 'Engineer Form'}</h3>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        {new Date(item.timestamp).toLocaleString()}
                                    </p>

                                    {statusMap[item.id] === 'syncing' && <p className="text-[10px] text-blue-500 font-bold mt-1">Uploading...</p>}
                                    {statusMap[item.id] === 'success' && <p className="text-[10px] text-green-500 font-bold mt-1">Synced Successfully</p>}
                                    {statusMap[item.id] === 'error' && <p className="text-[10px] text-red-500 font-bold mt-1">Failed. Please retry.</p>}
                                </div>
                            </div>

                            <div className="relative z-10 pl-2">
                                {statusMap[item.id] === 'success' ? (
                                    <div className="w-8 h-8 rounded-full bg-green-50 text-green-500 flex items-center justify-center">
                                        <span className="text-sm">✓</span>
                                    </div>
                                ) : (
                                    <>
                                        {!isSyncing && (
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                title="Delete Item"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <BottomNav userRole={userRole} />
        </div>
    );
};

export default EngineerOutbox;