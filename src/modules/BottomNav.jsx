import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Icons - Using FiUser as a more stable alternative for Profile
import { TbHomeEdit, TbCloudUpload } from "react-icons/tb";
import { LuCompass } from "react-icons/lu";
import { FiUser } from "react-icons/fi"; 

const BottomNav = ({ userRole = 'Engineer' }) => { 
    const navigate = useNavigate();
    const location = useLocation();

    // --- CONFIGURATION BY ROLE ---
    // Engineer: Explore | Home | Profile
    // Others: Sync | Home | Profile
    const navConfigs = {
        'Engineer': [
            { label: 'Explore', path: '/new-project', icon: LuCompass },
            { label: 'Home', path: '/engineer-dashboard', icon: TbHomeEdit }, 
            { label: 'Profile', path: '/profile', icon: FiUser }, 
        ],
        'School Head': [
            { label: 'Sync', path: '/outbox', icon: TbCloudUpload },
            { label: 'Home', path: '/schoolhead-dashboard', icon: TbHomeEdit },
            { label: 'Profile', path: '/profile', icon: FiUser },
        ],
        'Admin': [
            { label: 'Sync', path: '/outbox', icon: TbCloudUpload },
            { label: 'Home', path: '/admin-dashboard', icon: TbHomeEdit },
            { label: 'Profile', path: '/profile', icon: FiUser },
        ],
        'Human Resource': [
            { label: 'Sync', path: '/outbox', icon: TbCloudUpload },
            { label: 'Home', path: '/hr-dashboard', icon: TbHomeEdit },
            { label: 'Profile', path: '/profile', icon: FiUser },
        ]
    };

    const currentNavItems = navConfigs[userRole] || navConfigs['Engineer'];

    const renderIcon = (IconComponent, isActive) => (
        <IconComponent
            size={24}
            color={isActive ? '#004A99' : '#B0B0B0'}
            style={styles.icon}
        />
    );

    const [leftItem, centerItem, rightItem] = currentNavItems;

    return (
        <div style={styles.wrapper}>
            <div style={styles.curveContainer}>
                <svg viewBox="0 0 375 70" preserveAspectRatio="none" style={styles.svg}>
                    <path 
                        d="M0,0 L137,0 C145,0 150,5 152,12 C157,35 180,45 187.5,45 C195,45 218,35 223,12 C225,5 230,0 238,0 L375,0 L375,70 L0,70 Z" 
                        fill="white" 
                    />
                </svg>
            </div>

            <div style={styles.navItems}>
                {/* 1. LEFT BUTTON */}
                <button style={styles.sideButton} onClick={() => navigate(leftItem.path)}>
                    {renderIcon(leftItem.icon, location.pathname === leftItem.path)}
                    <span style={{ ...styles.label, color: location.pathname === leftItem.path ? '#004A99' : '#B0B0B0' }}>
                        {leftItem.label}
                    </span>
                </button>

                {/* 2. CENTER BUTTON (Home) */}
                <div style={styles.centerButtonContainer}>
                    <button 
                        style={{
                            ...styles.floatingButton,
                            backgroundColor: location.pathname === centerItem.path ? '#004A99' : '#0c4885'
                        }} 
                        onClick={() => navigate(centerItem.path)}
                    >
                        <centerItem.icon size={30} color="#ffffff" />
                    </button>
                    <span style={{ 
                        ...styles.label, 
                        color: location.pathname === centerItem.path ? '#004A99' : '#B0B0B0',
                        marginTop: '40px' 
                    }}>
                        Home
                    </span>
                </div>

                {/* 3. RIGHT BUTTON (Profile) */}
                <button style={styles.sideButton} onClick={() => navigate(rightItem.path)}>
                    {renderIcon(rightItem.icon, location.pathname === rightItem.path)}
                    <span style={{ ...styles.label, color: location.pathname === rightItem.path ? '#004A99' : '#B0B0B0' }}>
                        {rightItem.label}
                    </span>
                </button>
            </div>
        </div>
    );
};

const styles = {
    wrapper: { position: 'fixed', bottom: 0, left: 0, width: '100%', height: '75px', zIndex: 1000, display: 'flex', justifyContent: 'center', pointerEvents: 'none' },
    curveContainer: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: '75px', zIndex: 1, pointerEvents: 'none' },
    svg: { width: '100%', height: '100%', display: 'block', filter: 'drop-shadow(0px -5px 10px rgba(0,0,0,0.08))' },
    navItems: { position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '8px', pointerEvents: 'auto' },
    sideButton: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' },
    centerButtonContainer: { width: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' },
    floatingButton: { position: 'absolute', top: '-45px', width: '56px', height: '56px', borderRadius: '50%', border: '4px solid #ffffff', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' },
    icon: { marginBottom: '2px' },
    label: { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.02em' }
};

export default BottomNav;