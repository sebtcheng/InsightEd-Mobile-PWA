import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TbArrowsLeftRight, TbFileExport } from "react-icons/tb";
import { generateMonitoringReport, generateEngineerReport } from '../utils/ReportGenerator';

const SuperUserFloatingSwitch = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isVisible, setIsVisible] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Pages where the Export button should appear
    const exportPages = ['/monitoring-dashboard', '/engineer-dashboard', '/lgu-projects'];

    useEffect(() => {
        const checkUser = () => {
            const isSuperUser = localStorage.getItem('userRole') === 'Super User';
            // Hide on login/register/selector pages to avoid clutter/redundancy
            const hiddenPaths = ['/', '/register', '/super-user-selector', '/adminlogin'];
            const shouldHide = hiddenPaths.includes(location.pathname);

            setIsVisible(isSuperUser && !shouldHide);
            setShowExport(isSuperUser && exportPages.includes(location.pathname));
        };
        checkUser();
    }, [location]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const role = sessionStorage.getItem('impersonatedRole') || 'Central Office';
            const region = sessionStorage.getItem('impersonatedRegion') || '';
            const division = sessionStorage.getItem('impersonatedDivision') || '';

            if (location.pathname === '/engineer-dashboard') {
                // Engineer export — fetch projects and generate PDF
                let url = '/api/projects';
                if (division) url += `?division=${encodeURIComponent(division)}`;
                const res = await fetch(url);
                const projects = await res.json();

                const mappedProjects = projects.map(p => ({
                    projectName: p.projectName || p.project_name || '',
                    schoolName: p.schoolName || p.school_name || '',
                    status: p.status || '',
                    accomplishmentPercentage: p.accomplishmentPercentage || p.accomplishment_percentage || 0,
                    projectAllocation: p.projectAllocation || p.project_allocation || 0,
                    targetCompletionDate: p.targetCompletionDate || p.target_completion_date || '',
                }));

                generateEngineerReport(mappedProjects, division || 'All Divisions');
            } else {
                // Monitoring export — fetch KPI summary from backend
                const params = new URLSearchParams();
                params.set('role', role);
                if (region) params.set('region', region);
                if (division) params.set('division', division);

                const res = await fetch(`/api/super-user/export-summary?${params.toString()}`);
                const kpiData = await res.json();
                generateMonitoringReport(kpiData);
            }
        } catch (err) {
            console.error("Export failed:", err);
            alert("Export failed. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div style={{ position: 'fixed', bottom: '100px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
            {/* Export Button (conditionally visible) */}
            {showExport && (
                <button
                    onClick={handleExport}
                    disabled={exporting}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        backgroundColor: exporting ? '#94a3b8' : '#059669', // emerald-600
                        color: 'white',
                        border: 'none',
                        borderRadius: '50px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                        cursor: exporting ? 'wait' : 'pointer',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        transition: 'transform 0.2s, background-color 0.2s',
                    }}
                    onMouseOver={(e) => !exporting && (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                    <TbFileExport size={18} />
                    <span>{exporting ? 'Generating...' : 'Export PDF'}</span>
                </button>
            )}

            {/* Switch View Button */}
            <button
                onClick={() => navigate('/super-user-selector')}
                style={{
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
        </div>
    );
};

export default SuperUserFloatingSwitch;
