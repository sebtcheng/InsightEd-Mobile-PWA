import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Icons 
import { TbHomeEdit, TbCloudUpload, TbClipboardList } from "react-icons/tb";
import { LuCompass } from "react-icons/lu";
import { FiSettings } from "react-icons/fi"; // Changed to Gear icon

const BottomNav = ({ userRole = 'Engineer' }) => { 
    const navigate = useNavigate();
    const location = useLocation();

    // --- CONFIGURATION BY ROLE ---
    const navConfigs = {
        'Engineer': [
            { label: 'Home', path: '/engineer-dashboard', icon: TbHomeEdit }, 
            { label: 'Projects', path: '/engineer-projects', icon: TbClipboardList },
            { label: 'Sync', path: '/engineer-outbox', icon: TbCloudUpload },
            { label: 'Settings', path: '/profile', icon: FiSettings }, 
        ],
        'School Head': [
            { label: 'Home', path: '/schoolhead-dashboard', icon: TbHomeEdit },
            { label: 'Forms', path: '/school-forms', icon: TbClipboardList },
            { label: 'Sync', path: '/outbox', icon: TbCloudUpload },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'Admin': [
            { label: 'Home', path: '/admin-dashboard', icon: TbHomeEdit },
           // { label: 'Activity', path: '/activity', icon: TbClipboardList },
          //  { label: 'Sync', path: '/outbox', icon: TbCloudUpload },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'Human Resource': [
            { label: 'Home', path: '/hr-dashboard', icon: TbHomeEdit },
            { label: 'Sync', path: '/outbox', icon: TbCloudUpload },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ]
    };

    const currentNavItems = navConfigs[userRole] || navConfigs['Engineer'];

    return (
        <div style={styles.wrapper}>
            <div style={styles.navContainer}>
                {currentNavItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;

                    return (
                        <button 
                            key={item.label}
                            style={styles.navButton} 
                            onClick={() => navigate(item.path)}
                        >
                            <Icon
                                size={24}
                                color={isActive ? '#004A99' : '#B0B0B0'}
                                style={styles.icon}
                            />
                            <span style={{ 
                                ...styles.label, 
                                color: isActive ? '#004A99' : '#B0B0B0' 
                            }}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

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

export default BottomNav;