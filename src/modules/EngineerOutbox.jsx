import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEngineerOutbox, deleteEngineerFromOutbox } from '../db';
import BottomNav from './BottomNav';

const EngineerOutbox = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [statusMap, setStatusMap] = useState({});

    useEffect(() => { loadItems(); }, []);

    const loadItems = async () => {
        const data = await getEngineerOutbox();
        setItems(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    };

    const handleSyncAll = async () => {
        if (!navigator.onLine) {
            alert("⚠️ You are offline.");
            return;
        }
        setIsSyncing(true);
        for (const item of items) {
            setStatusMap(prev => ({ ...prev, [item.id]: 'syncing' }));
            try {
                const response = await fetch(item.url, {
                    method: item.method || 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.body)
                });
                if (response.ok) {
                    setStatusMap(prev => ({ ...prev, [item.id]: 'success' }));
                    await deleteEngineerFromOutbox(item.id);
                }
            } catch (err) { console.error(err); }
        }
        setIsSyncing(false);
        loadItems();
    };

    return (
        <div className="pb-24">
            <div className="p-4 bg-white shadow-md font-bold text-lg">Engineer Sync Center</div>
            <div className="p-4">
                {items.length > 0 ? (
                    <button onClick={handleSyncAll} className="w-full bg-[#004A99] text-white p-3 rounded-lg mb-4">
                        {isSyncing ? "Syncing..." : `Sync ${items.length} Forms`}
                    </button>
                ) : <p className="text-center text-gray-500">No pending engineer forms.</p>}
                
                {items.map(item => (
                    <div key={item.id} className="p-3 border rounded-lg mb-2 flex justify-between">
                        <span>{item.formName || 'Engineer Form'}</span>
                        <span>{statusMap[item.id] === 'success' ? '✅' : '⏳'}</span>
                    </div>
                ))}
            </div>
            <BottomNav userRole="Engineer" />
        </div>
    );
};

export default EngineerOutbox;