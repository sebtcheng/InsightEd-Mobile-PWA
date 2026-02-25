import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { auth } from '../firebase'; // Import auth
import { FiLogOut } from 'react-icons/fi'; // Import Icon

const SuperUserSelector = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(false);

    // Regional / SDO State
    const [selectedRegion, setSelectedRegion] = useState('');
    const [selectedDivision, setSelectedDivision] = useState('');

    // Engineer State
    const [engRegion, setEngRegion] = useState('');
    const [engDivision, setEngDivision] = useState('');

    // LGU State
    const [lguRegion, setLguRegion] = useState('');
    const [lguProvince, setLguProvince] = useState('');
    const [lguMunicipality, setLguMunicipality] = useState('');

    // --- API-DRIVEN LIST STATE ---
    const [regions, setRegions] = useState([]);
    const [sdoDivisions, setSdoDivisions] = useState([]);
    const [engDivisions, setEngDivisions] = useState([]);
    const [lguProvinces, setLguProvinces] = useState([]);
    const [lguMunicipalities, setLguMunicipalities] = useState([]);

    // --- FETCH REGIONS ON MOUNT (from schools table) ---
    useEffect(() => {
        fetch('/api/locations/regions')
            .then(res => res.json())
            .then(data => setRegions(data || []))
            .catch(err => console.error("Failed to load regions:", err));
    }, []);

    // --- FETCH SDO DIVISIONS when selectedRegion changes ---
    useEffect(() => {
        setSdoDivisions([]);
        setSelectedDivision('');
        if (selectedRegion) {
            fetch(`/api/locations/divisions?region=${encodeURIComponent(selectedRegion)}`)
                .then(res => res.json())
                .then(data => setSdoDivisions(data || []))
                .catch(console.error);
        }
    }, [selectedRegion]);

    // --- FETCH ENGINEER DIVISIONS when engRegion changes ---
    useEffect(() => {
        setEngDivisions([]);
        setEngDivision('');
        if (engRegion) {
            fetch(`/api/locations/divisions?region=${encodeURIComponent(engRegion)}`)
                .then(res => res.json())
                .then(data => setEngDivisions(data || []))
                .catch(console.error);
        }
    }, [engRegion]);

    // --- FETCH LGU PROVINCES when lguRegion changes ---
    useEffect(() => {
        setLguProvinces([]);
        setLguProvince('');
        setLguMunicipality('');
        if (lguRegion) {
            fetch(`/api/locations/provinces?region=${encodeURIComponent(lguRegion)}`)
                .then(res => res.json())
                .then(data => setLguProvinces(data || []))
                .catch(console.error);
        }
    }, [lguRegion]);

    // --- FETCH LGU MUNICIPALITIES when lguProvince changes ---
    useEffect(() => {
        setLguMunicipalities([]);
        setLguMunicipality('');
        if (lguRegion && lguProvince) {
            fetch(`/api/locations/municipalities-by-province?region=${encodeURIComponent(lguRegion)}&province=${encodeURIComponent(lguProvince)}`)
                .then(res => res.json())
                .then(data => setLguMunicipalities(data || []))
                .catch(console.error);
        }
    }, [lguRegion, lguProvince]);

    const handleSelection = async (role, specificLocation = null, extraData = {}) => {
        setLoading(true);

        // 1. Set Context
        sessionStorage.setItem('impersonatedRole', role);
        sessionStorage.setItem('isViewingAsSuperUser', 'true');

        // Clear previous impersonation keys to avoid pollution
        sessionStorage.removeItem('impersonatedRegion');
        sessionStorage.removeItem('impersonatedDivision');
        sessionStorage.removeItem('impersonatedLocation');
        sessionStorage.removeItem('impersonatedProvince');
        sessionStorage.removeItem('impersonatedMunicipality');

        // 2. Role Specific Logic
        if (role === 'Regional Office') {
            sessionStorage.setItem('impersonatedLocation', specificLocation); // "Region I"
            sessionStorage.setItem('impersonatedRegion', specificLocation);
        } else if (role === 'School Division Office') {
            sessionStorage.setItem('impersonatedRegion', extraData.region);
            sessionStorage.setItem('impersonatedLocation', specificLocation); // Division
            sessionStorage.setItem('impersonatedDivision', specificLocation);
        } else if (role === 'Division Engineer') {
            // For Engineer, we treat them like SDO but with different dashboard
            sessionStorage.setItem('impersonatedRegion', extraData.region);
            sessionStorage.setItem('impersonatedLocation', specificLocation); // Division
            sessionStorage.setItem('impersonatedDivision', specificLocation);
        } else if (role === 'Local Government Unit') {
            sessionStorage.setItem('impersonatedRegion', extraData.region);
            sessionStorage.setItem('impersonatedProvince', extraData.province);
            sessionStorage.setItem('impersonatedMunicipality', specificLocation); // Municipality
            sessionStorage.setItem('impersonatedLocation', specificLocation); // Primary location
        } else if (role === 'School Head') {
            sessionStorage.setItem('isGenericMode', 'true');
        }

        // 3. Navigate
        setTimeout(() => {
            switch (role) {
                case 'Central Office':
                    navigate('/monitoring-dashboard');
                    break;
                case 'Regional Office':
                case 'School Division Office':
                    navigate('/monitoring-dashboard');
                    break;
                case 'School Head':
                    navigate('/schoolhead-dashboard');
                    break;
                case 'Division Engineer':
                    navigate('/engineer-dashboard');
                    break;
                case 'Local Government Unit':
                    navigate('/lgu-projects'); // Direct to LGU Project List
                    break;
                case 'Masterlist':
                    navigate('/psip');
                    break;
                default:
                    break;
            }
            setLoading(false);
        }, 500);
    };

    const handleLogout = async () => {
        try {
            await auth.signOut();
            localStorage.clear();
            sessionStorage.clear();
            navigate('/', { replace: true });
        } catch (error) {
            console.error("Logout Failed:", error);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-slate-200 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-100 opacity-90"></div>
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-[100px]"></div>

            {/* Logout Button */}
            <button
                onClick={handleLogout}
                className="absolute top-4 right-4 md:top-6 md:right-6 flex items-center gap-2 bg-white/80 backdrop-blur-md text-slate-600 px-3 py-1.5 md:px-4 md:py-2 rounded-xl shadow-sm hover:bg-slate-100 hover:text-red-500 transition-all font-medium z-50 border border-slate-200 text-xs md:text-sm"
            >
                <FiLogOut />
                <span>Log Out</span>
            </button>

            <div className="relative z-10 max-w-6xl w-full">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">Super User Access</h1>
                    <p className="text-slate-500 mt-2 font-medium">Select a role to impersonate or view.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* CARD 1: Central Office */}
                    <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Central Office</h3>
                        <p className="text-sm text-slate-500 mb-6 flex-grow">View National Aggregated Data</p>
                        <button onClick={() => handleSelection('Central Office')} className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">
                            Select
                        </button>
                    </motion.div>

                    {/* CARD 2: Regional Office */}
                    <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Regional Office</h3>
                        <p className="text-sm text-slate-500 mb-4">View Regional Data</p>
                        <select
                            className="w-full p-2 mb-4 border rounded-lg bg-slate-50 text-sm"
                            value={selectedRegion}
                            onChange={(e) => { setSelectedRegion(e.target.value); setSelectedDivision(''); }}
                        >
                            <option value="">Select Region</option>
                            {regions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button
                            onClick={() => handleSelection('Regional Office', selectedRegion)}
                            disabled={!selectedRegion}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition disabled:opacity-50"
                        >
                            Go to Region
                        </button>
                    </motion.div>

                    {/* CARD 3: SDO */}
                    <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 text-purple-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">SDO</h3>
                        <p className="text-sm text-slate-500 mb-4">View Division Data</p>

                        <select
                            className="w-full p-2 mb-2 border rounded-lg bg-slate-50 text-sm"
                            value={selectedRegion}
                            onChange={(e) => { setSelectedRegion(e.target.value); setSelectedDivision(''); }}
                        >
                            <option value="">Select Region First</option>
                            {regions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>

                        <select
                            className="w-full p-2 mb-4 border rounded-lg bg-slate-50 text-sm"
                            value={selectedDivision}
                            onChange={(e) => setSelectedDivision(e.target.value)}
                            disabled={!selectedRegion || sdoDivisions.length === 0}
                        >
                            <option value="">Select Division</option>
                            {sdoDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>

                        <button
                            onClick={() => handleSelection('School Division Office', selectedDivision, { region: selectedRegion })}
                            disabled={!selectedDivision}
                            className="w-full py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition disabled:opacity-50"
                        >
                            Go to Division
                        </button>
                    </motion.div>

                    {/* CARD 4: School Head */}
                    <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">School Head</h3>
                        <p className="text-sm text-slate-500 mb-6 flex-grow">View Generic School Dashboard</p>
                        <button onClick={() => handleSelection('School Head')} className="w-full py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition">
                            Enter View
                        </button>
                    </motion.div>

                    {/* CARD 5: Division Engineer (Separated) */}
                    <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center min-h-[300px]">
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-orange-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Division Engineer</h3>
                        <p className="text-sm text-slate-500 mb-4">View Infra Projects</p>

                        {/* Engineer Dropdowns */}
                        <select
                            className="w-full p-2 mb-2 border rounded-lg bg-slate-50 text-sm"
                            value={engRegion}
                            onChange={(e) => { setEngRegion(e.target.value); setEngDivision(''); }}
                        >
                            <option value="">Select Region</option>
                            {regions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>

                        <select
                            className="w-full p-2 mb-6 border rounded-lg bg-slate-50 text-sm"
                            value={engDivision}
                            onChange={(e) => setEngDivision(e.target.value)}
                            disabled={!engRegion || engDivisions.length === 0}
                        >
                            <option value="">Select Division</option>
                            {engDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>

                        <div className="mt-auto w-full">
                            <button
                                onClick={() => handleSelection('Division Engineer', engDivision, { region: engRegion })}
                                disabled={!engDivision}
                                className="w-full py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition disabled:opacity-50"
                            >
                                Enter Dashboard
                            </button>
                        </div>
                    </motion.div>

                    {/* CARD 6: LGU (Separated) */}
                    <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center col-span-1 min-h-[300px]">
                        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mb-4 text-teal-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">LGU</h3>
                        <p className="text-sm text-slate-500 mb-4">View Local Projects</p>

                        <div className="w-full space-y-2 mb-4">
                            {/* 1. Region Dropdown */}
                            <select
                                className="w-full p-2 border rounded-lg bg-slate-50 text-sm"
                                value={lguRegion}
                                onChange={(e) => {
                                    setLguRegion(e.target.value);
                                    setLguProvince('');
                                    setLguMunicipality('');
                                }}
                            >
                                <option value="">Select Region</option>
                                {regions.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>

                            {/* 2. Province Dropdown */}
                            <select
                                className="w-full p-2 border rounded-lg bg-slate-50 text-sm"
                                value={lguProvince}
                                onChange={(e) => {
                                    setLguProvince(e.target.value);
                                    setLguMunicipality('');
                                }}
                                disabled={!lguRegion || lguProvinces.length === 0}
                            >
                                <option value="">Select Province</option>
                                {lguProvinces.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>

                            {/* 3. Municipality Dropdown */}
                            <select
                                className="w-full p-2 border rounded-lg bg-slate-50 text-sm"
                                value={lguMunicipality}
                                onChange={(e) => setLguMunicipality(e.target.value)}
                                disabled={!lguProvince || lguMunicipalities.length === 0}
                            >
                                <option value="">Select Municipality</option>
                                {lguMunicipalities.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-auto w-full">
                            <button
                                onClick={() => handleSelection('Local Government Unit', lguMunicipality, { region: lguRegion, province: lguProvince })}
                                disabled={!lguMunicipality}
                                className="w-full py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition disabled:opacity-50"
                            >
                                Enter LGU View
                            </button>
                        </div>
                    </motion.div>

                    {/* CARD 7: Masterlist */}
                    <motion.div whileHover={{ scale: 1.02 }} className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col items-center text-center col-span-1 min-h-[300px]">
                        <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mb-4 text-pink-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Masterlist</h3>
                        <p className="text-sm text-slate-500 mb-4 flex-grow">Partnership Projects Prototype</p>

                        <div className="mt-auto w-full">
                            <button
                                onClick={() => handleSelection('Masterlist')}
                                className="w-full py-2 bg-pink-600 text-white rounded-lg font-bold hover:bg-pink-700 transition"
                            >
                                Enter Masterlist View
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default SuperUserSelector;
