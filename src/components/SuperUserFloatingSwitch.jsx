import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TbArrowsLeftRight } from "react-icons/tb";

const SuperUserFloatingSwitch = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const checkUser = () => {
            const isSuperUser = localStorage.getItem('userRole') === 'Super User';
            // Hide on login/register/selector pages to avoid clutter/redundancy
            const hiddenPaths = ['/', '/register', '/super-user-selector', '/adminlogin'];
            const shouldHide = hiddenPaths.includes(location.pathname);

            setIsVisible(isSuperUser && !shouldHide);
        };
        checkUser();
    }, [location]);

    if (!isVisible) return null;

    return (
        <button
            onClick={() => navigate('/super-user-selector')}
            style={{
                position: 'fixed',
                bottom: '100px', // Above the 70px BottomNav
                right: '20px',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                backgroundColor: '#2563eb', // blue-600
                color: 'white',
                border: 'none',
                borderRadius: '50px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
            <TbArrowsLeftRight size={20} />
            <span>Switch View</span>
        </button>
    );
};

export default SuperUserFloatingSwitch;
