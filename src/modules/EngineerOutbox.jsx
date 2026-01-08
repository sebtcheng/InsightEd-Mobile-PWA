import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEngineerOutbox, deleteEngineerFromOutbox } from '../db';
import BottomNav from './BottomNav';

const EngineerOutbox = () => {
    const navigate = useNavigate();
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
        
        // If savedUrl is absolute (starts with http), strip the domain to make it relative
        if (savedUrl.startsWith('http')) {
            try {
                const urlObj = new URL(savedUrl);
                path = urlObj.pathname;
            } catch (e) {
                console.error("URL parsing error:", e);
            }
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
        <div className="pb-24 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="bg-[#004A99] p-6 rounded-b-3xl shadow-lg">
                <h1 className="text-white text-xl font-bold flex items-center gap-2">
                    <span>🔄</span> Sync Center
                </h1>
                <p className="text-blue-200 text-sm mt-1">Upload your offline data</p>
            </div>

            <div className="p-4">
                {items.length > 0 ? (
                    <div className="bg-white rounded-xl shadow-md p-4 border border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-bold text-slate-700">{items.length} Pending Items</span>
                            {isSyncing && <span className="text-xs font-bold text-blue-600 animate-pulse">SYNCING...</span>}
                        </div>

                        <button 
                            onClick={handleSyncAll} 
                            disabled={isSyncing}
                            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                                isSyncing ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#FDB913] hover:bg-yellow-500 text-blue-900'
                            }`}
                        >
                            {isSyncing ? "Syncing..." : "Sync All Data Now"}
                        </button>

                        <div className="mt-4 space-y-3">
                            {items.map(item => (
                                <div key={item.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                                    {/* Left side: Info */}
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-700 text-sm">{item.formName || 'Engineer Form'}</h3>
                                        <p className="text-xs text-slate-400">
                                            {new Date(item.timestamp).toLocaleTimeString()} • {new Date(item.timestamp).toLocaleDateString()}
                                        </p>
                                    </div>
                                    
                                    {/* Right side: Status Icon & Delete Button */}
                                    <div className="flex items-center gap-3">
                                        <div className="text-xl">
                                            {statusMap[item.id] === 'syncing' && <span className="animate-spin inline-block">⏳</span>}
                                            {statusMap[item.id] === 'success' && <span>✅</span>}
                                            {statusMap[item.id] === 'error' && <span>❌</span>}
                                            {!statusMap[item.id] && <span className="text-slate-400">☁️</span>}
                                        </div>

                                        {/* DELETE BUTTON */}
                                        <button 
                                            onClick={() => handleDelete(item.id)}
                                            disabled={isSyncing || statusMap[item.id] === 'syncing'}
                                            className={`p-2 rounded-full transition-colors ${
                                                isSyncing 
                                                    ? 'opacity-30 cursor-not-allowed' 
                                                    : 'bg-red-50 text-red-500 hover:bg-red-100'
                                            }`}
                                            title="Delete this item"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center mt-20 text-slate-400 gap-4">
                        <span className="text-6xl">🎉</span>
                        <p className="font-bold">You're all caught up!</p>
                        <p className="text-xs">No pending data to sync.</p>
                    </div>
                )}
            </div>

            <BottomNav userRole="Engineer" />
        </div>
    );
};

export default EngineerOutbox;