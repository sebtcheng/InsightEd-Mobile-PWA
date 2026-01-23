import React, { useState, useEffect, useRef } from 'react';
import { FiBell, FiX, FiCheck } from 'react-icons/fi';
import { auth } from '../firebase';

const NotificationCenter = () => {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef(null);

    // Fetch Notifications
    const fetchNotifications = async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const res = await fetch(`/api/notifications/${user.uid}`);
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
                setUnreadCount(data.filter(n => !n.is_read).length);
            }
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    // Poll for new notifications
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    // Mark as Read
    const markAsRead = async (id) => {
        try {
            await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error(err);
        }
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                title="Notifications"
            >
                <FiBell className="text-white w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-[#004A99]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-12 right-0 w-80 max-h-[400px] overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur z-10">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">Notifications</h3>
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">
                            {unreadCount} New
                        </span>
                    </div>

                    <div className="p-2 space-y-1">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                <FiBell className="mx-auto mb-2 opacity-50" size={24} />
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <div 
                                    key={notification.id}
                                    className={`p-3 rounded-xl transition-colors relative group ${notification.is_read ? 'bg-white dark:bg-slate-800 opacity-70' : 'bg-blue-50 dark:bg-blue-900/20'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className={`text-sm font-bold ${notification.is_read ? 'text-slate-600 dark:text-slate-400' : 'text-blue-700 dark:text-blue-300'}`}>
                                            {notification.title}
                                        </h4>
                                        {!notification.is_read && (
                                            <button 
                                                onClick={() => markAsRead(notification.id)}
                                                className="text-blue-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-100 transition-colors"
                                                title="Mark as read"
                                            >
                                                <FiCheck size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mb-1">
                                        {notification.message}
                                    </p>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-[9px] text-slate-400 font-medium">
                                            {new Date(notification.created_at).toLocaleDateString()} • {new Date(notification.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                        {notification.sender_name && (
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                From: {notification.sender_name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
