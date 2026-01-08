// src/modules/SchoolHeadBottomNav.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TbHomeEdit, TbCloudUpload } from "react-icons/tb";
import { LuClipboardList } from "react-icons/lu"; 
import { FiSettings } from "react-icons/fi";

const SchoolHeadBottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { label: 'Home', path: '/schoolhead-dashboard', icon: TbHomeEdit },
        { label: 'Sync', path: '/outbox', icon: TbCloudUpload },
        { label: 'Forms', path: '/school-forms', icon: LuClipboardList },
        { label: 'Settings', path: '/profile', icon: FiSettings },
    ];

    return (
        <div className="fixed bottom-0 left-0 w-full h-[70px] z-[1000] bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] flex items-center justify-around">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                    <button 
                        key={item.label}
                        onClick={() => navigate(item.path)}
                        className="flex-1 flex flex-col items-center justify-center bg-transparent border-none cursor-pointer h-full transition-all duration-200"
                    >
                        <Icon
                            size={24}
                            className={`mb-1 transition-colors ${isActive ? 'text-[#004A99]' : 'text-[#B0B0B0]'}`}
                        />
                        <span className={`text-[10px] font-bold uppercase tracking-tighter ${isActive ? 'text-[#004A99]' : 'text-[#B0B0B0]'}`}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

// Styling consistent with your current BottomNav
const styles = {
    wrapper: { 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        width: '100%', 
        height: '70px', 
        zIndex: 1000, 
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        alignItems: 'center'
    },
    navContainer: { 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        justifyContent: 'space-around', 
        alignItems: 'center' 
    },
    navButton: { 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'none', 
        border: 'none', 
        cursor: 'pointer',
        height: '100%'
    },
    icon: { 
        marginBottom: '4px',
        transition: 'all 0.2s ease'
    },
    label: { 
        fontSize: '10px', 
        fontWeight: '700', 
        textTransform: 'uppercase', 
        letterSpacing: '0.02em' 
    }
};

export default SchoolHeadBottomNav;