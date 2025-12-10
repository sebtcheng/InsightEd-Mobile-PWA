import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition'; 
import { auth, db } from '../firebase'; 
import { doc, getDoc } from 'firebase/firestore';

const AdminDashboard = () => {
    // --- USER STATE ---
    const [userName, setUserName] = useState('Admin');

    // --- DATA STATE ---
    const [schools, setSchools] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- 1. FETCH USER (Firebase) ---
    useEffect(() => {
        const fetchUserData = async () => {
            const user = auth.currentUser;
            if (user) {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setUserName(docSnap.data().firstName);
                }
            }
        };
        fetchUserData();
    }, []);

    // --- 2. FETCH SCHOOL DATA (Real Data Only) ---
    useEffect(() => {
        const fetchSchools = async () => {
            try {
                // Connect to your backend
                const response = await fetch('http://localhost:3001/api/schools'); 
                
                if (!response.ok) {
                    throw new Error('Failed to connect to server'); 
                }
                const data = await response.json();
                setSchools(data);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching schools:", err);
                // NO FAKE DATA. Just show an error state.
                setError("Could not load school data. Is the server running?");
                setSchools([]); // Empty list
                setLoading(false);
            }
        };
        fetchSchools();
    }, []);

    const handleView = (school) => setSelectedSchool(school);
    const handleBack = () => setSelectedSchool(null);

    return (
        <PageTransition>
            <div className="min-h-screen bg-[#E6F4FF] p-5 pb-24 md:p-10 font-sans">
                
                <div className="max-w-4xl mx-auto">
                    {/* HEADER */}
                    <div className="mb-6 flex justify-between items-end">
                        <div>
                            <h1 className="text-[#004A99] text-3xl font-bold">
                                Admin {userName} 👑
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">
                                Monitoring Dashboard
                            </p>
                        </div>
                        {/* Summary Badges */}
                        <div className="flex gap-2">
                             <div className="bg-white px-3 py-1 rounded-lg shadow-sm text-xs font-bold text-gray-600 border border-gray-100">
                                Total: {schools.length}
                             </div>
                        </div>
                    </div>

                    {/* MAIN CONTENT AREA */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
                        
                        {/* STATE 1: LOADING */}
                        {loading && (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                                <p>Loading data...</p>
                            </div>
                        )}

                        {/* STATE 2: ERROR (If server is down) */}
                        {!loading && error && (
                            <div className="flex flex-col items-center justify-center h-64 text-red-400 p-5 text-center">
                                <div className="text-2xl mb-2">⚠️</div>
                                <p>{error}</p>
                            </div>
                        )}

                        {/* STATE 3: EMPTY LIST (No schools yet) */}
                        {!loading && !error && schools.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <p>No school submissions found yet.</p>
                            </div>
                        )}

                        {/* STATE 4: MASTER LIST VIEW */}
                        {!loading && !error && !selectedSchool && schools.length > 0 && (
                            <div className="p-0">
                                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h3 className="font-bold text-gray-700">School Submissions</h3>
                                    <span className="text-xs text-gray-400">Live Data</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-gray-500">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-4">School</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {schools.map((school) => (
                                                <tr key={school.id} className="bg-white border-b hover:bg-gray-50">
                                                    <td className="px-6 py-4 font-medium text-gray-900">
                                                        {school.name}
                                                        <div className="text-xs text-gray-400 font-normal">ID: {school.id}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                            school.status === 'Submitted' 
                                                            ? 'bg-green-100 text-green-800 border-green-200' 
                                                            : 'bg-red-100 text-red-800 border-red-200'
                                                        }`}>
                                                            {school.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {school.status === 'Submitted' ? (
                                                            <button 
                                                                onClick={() => handleView(school)}
                                                                className="text-white bg-[#004A99] hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-xs px-3 py-1.5 focus:outline-none transition-colors"
                                                            >
                                                                View
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-300 italic text-xs">Waiting</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* STATE 5: DETAIL VIEW */}
                        {!loading && selectedSchool && (
                            <div className="p-6">
                                <button 
                                    onClick={handleBack}
                                    className="mb-4 text-xs font-semibold text-gray-500 hover:text-[#004A99] flex items-center gap-1 transition-colors"
                                >
                                    ← Back to List
                                </button>
                                
                                <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-800">{selectedSchool.name}</h2>
                                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-0.5 rounded border border-gray-200">
                                            ID: {selectedSchool.id}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-gray-400">Date Submitted</div>
                                        <div className="font-semibold text-gray-700">{selectedSchool.date}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Card 1: Enrollment */}
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">Total Enrollment</h4>
                                        <div className="text-3xl font-extrabold text-[#004A99] mb-2">
                                            {selectedSchool.data?.enrollment?.total || 0}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-sm text-blue-900 border-b border-blue-100 pb-1">
                                                <span>Male</span>
                                                <span className="font-bold">{selectedSchool.data?.enrollment?.male || 0}</span>
                                            </div>
                                            <div className="flex justify-between text-sm text-blue-900 pb-1">
                                                <span>Female</span>
                                                <span className="font-bold">{selectedSchool.data?.enrollment?.female || 0}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 2: Faculty */}
                                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                        <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-2">Faculty</h4>
                                        <div className="text-3xl font-extrabold text-indigo-900 mb-2">
                                            {selectedSchool.data?.faculty?.total || 0}
                                        </div>
                                        <div className="text-xs text-indigo-700">
                                            Active teaching personnel
                                        </div>
                                    </div>

                                    {/* Card 3: Performance */}
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                        <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-2">Performance</h4>
                                        <div className="space-y-3 mt-2">
                                            <div>
                                                <div className="flex justify-between text-xs font-semibold text-emerald-900 mb-1">
                                                    <span>Promotion Rate</span>
                                                    <span>{selectedSchool.data?.performance?.promotion || '0%'}</span>
                                                </div>
                                                <div className="w-full bg-emerald-200 rounded-full h-1.5">
                                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{width: selectedSchool.data?.performance?.promotion}}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <BottomNav homeRoute="/admin-dashboard" />
            </div>
        </PageTransition>
    );
};

export default AdminDashboard;