import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';

// Icons 
import { TbHomeEdit, TbCloudUpload, TbClipboardList, TbSchool, TbArrowsLeftRight, TbChartBar } from "react-icons/tb";
import { LuCompass } from "react-icons/lu";
import { FiSettings, FiCheckSquare } from "react-icons/fi"; // Changed to Gear icon

const BottomNav = ({ userRole }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // If no role is provided yet (loading), don't show the nav bar
    if (!userRole) return null;

    // --- SUPER USER OVERRIDE ---
    let effectiveRole = userRole;
    if (localStorage.getItem('userRole') === 'Super User') {
        const impRole = sessionStorage.getItem('impersonatedRole');
        if (impRole) effectiveRole = impRole;
    }

    // --- CONFIGURATION BY ROLE ---
    const navConfigs = {
        'Division Engineer': [
            { label: 'Home', path: '/engineer-dashboard', icon: TbHomeEdit },
            { label: 'Projects', path: '/engineer-projects', icon: TbClipboardList },
            { label: 'Sync', path: '/engineer-outbox', icon: TbCloudUpload },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'Local Government Unit': [
            { label: 'Projects', path: '/lgu-projects', icon: TbClipboardList },
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
        ],
        'Regional Office': [
            { label: 'InsightED', path: '/monitoring-dashboard', state: { activeTab: 'home' }, icon: TbHomeEdit },
            { label: 'Infrastructure', path: '/monitoring-dashboard', state: { activeTab: 'engineer' }, icon: TbClipboardList },
            { label: 'Insights', path: '/monitoring-dashboard', state: { activeTab: 'insights' }, icon: TbChartBar },
            // { label: 'Validation', path: '/monitoring-dashboard', state: { activeTab: 'validation' }, icon: FiCheckSquare },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'School Division Office': [
            { label: 'InsightED', path: '/monitoring-dashboard', state: { activeTab: 'all' }, icon: TbHomeEdit },
            { label: 'Infrastructure', path: '/monitoring-dashboard', state: { activeTab: 'engineer' }, icon: TbClipboardList },
            { label: 'Insights', path: '/monitoring-dashboard', state: { activeTab: 'insights' }, icon: TbChartBar },
            { label: 'Management', path: '/school-management', icon: TbSchool },
            //{ label: 'Validation', path: '/monitoring-dashboard', state: { activeTab: 'validation' }, icon: FiCheckSquare }, 
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'Central Office': [
            { label: 'InsightED', path: '/monitoring-dashboard', state: { activeTab: 'accomplishment', resetFilters: true }, icon: TbHomeEdit },
            { label: 'Infra Projects', path: '/monitoring-dashboard', state: { activeTab: 'infra', resetFilters: true }, icon: TbClipboardList },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ]
    };

    const currentNavItems = navConfigs[effectiveRole];

    // --- SUPER USER INJECTION ---
    // REMOVED: Moved to Floating Button
    const finalNavItems = currentNavItems;

    // If role exists but not in config (unexpected), don't show anything or show safe fallback
    if (!finalNavItems) return null;

    return createPortal(
        <div style={styles.wrapper}>
            <div style={styles.navContainer}>
                {finalNavItems.map((item) => {
                    const isActive = location.pathname === item.path &&
                        (!item.state || location.state?.activeTab === item.state.activeTab || (!location.state?.activeTab && item.state.activeTab === 'all'));

                    const Icon = item.icon;

                    return (
                        <button
                            key={item.label}
                            style={styles.navButton}
                            onClick={() => navigate(item.path, { state: item.state })}
                        >
                            <Icon
                                size={24}
                                color={isActive ? '#004A99' : '#B0B0B0'}
                                style={styles.icon}
                            />
                            <span style={{
                                ...styles.label,
                                ...styles.label,
                                color: isActive ? '#004A99' : '#B0B0B0'
                            }}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>,
        document.body
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