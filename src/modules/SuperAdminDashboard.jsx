import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import PageTransition from '../components/PageTransition';

const SuperAdminDashboard = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- FETCH ALL USERS ---
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "users"));
                const userList = querySnapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data()
                }));
                setUsers(userList);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching users:", error);
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    // --- IMPERSONATION LOGIC ---
    // A simplified "View As" that navigates to their dashboard.
    // NOTE: Real impersonation usually requires token swapping or context override.
    // For this MVP: specific dashboards will be updated to show "All Data" if Current User is Super Admin.
    // But to "View as School Head", we need to set the school context.
    
    const handleViewAsSchoolHead = (uid) => {
        if (!uid) {
            alert("Warning: User ID is missing.");
            return;
        }
        // Navigate with UID query param to trigger impersonation in SchoolHeadDashboard
        navigate(`/schoolhead-dashboard?uid=${uid}`);
    };

    const handleViewAllProjects = () => {
        // Engineer Dashboard usually filters by engineer UID.
        // We will modify EngineerDashboard to check if role == Super Admin => Show ALL.
        navigate('/engineer-dashboard');
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-24">
                
                {/* --- HEADER --- */}
                <div className="bg-gradient-to-br from-[#004A99] to-[#002D5C] p-6 pb-24 rounded-b-[3rem] shadow-2xl relative overflow-hidden text-white">
                     <div className="absolute top-0 right-0 p-8 opacity-10">
                        {/* Huge decorative icon */}
                        <svg className="w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>

                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <div className="inline-block px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 backdrop-blur-sm mb-3">
                                <span className="text-[10px] font-bold tracking-widest uppercase text-blue-200">System Command Center</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tight">Super Admin</h1>
                            <p className="text-blue-100/80 text-sm mt-1 max-w-xs">
                                Full access control and monitoring of the entire DepEd infrastructure system.
                            </p>
                        </div>
                        <button 
                            onClick={() => auth.signOut()} 
                            className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 p-3 rounded-xl transition-all shadow-lg active:scale-95 text-white"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        </button>
                    </div>
                </div>

                {/* --- CONTENT CONTAINER --- */}
                <div className="px-5 -mt-16 relative z-10 space-y-8">
                    
                    {/* DASHBOARD SHORTCUTS */}
                    <div>
                        <h2 className="text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider mb-4 ml-1">System Dashboards</h2>
                        <div className="grid grid-cols-2 gap-3">
                            
                            {/* Monitoring */}
                            <button 
                                onClick={() => navigate('/monitoring-dashboard')}
                                className="group relative overflow-hidden bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 text-left hover:shadow-md transition-all active:scale-[0.98]"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full -mr-10 -mt-10 group-hover:bg-purple-500/20 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3 group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                                    </div>
                                    <h3 className="font-bold text-slate-800 dark:text-white leading-tight">Monitoring</h3>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1">Regional & National Stats</p>
                                </div>
                            </button>

                            {/* Engineer */}
                            <button 
                                onClick={handleViewAllProjects}
                                className="group relative overflow-hidden bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 text-left hover:shadow-md transition-all active:scale-[0.98]"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-10 -mt-10 group-hover:bg-blue-500/20 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3 group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                    </div>
                                    <h3 className="font-bold text-slate-800 dark:text-white leading-tight">Engineering</h3>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1">All Projects View</p>
                                </div>
                            </button>

                            {/* Admin */}
                            <button 
                                onClick={() => navigate('/admin-dashboard')}
                                className="group relative overflow-hidden bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 text-left hover:shadow-md transition-all active:scale-[0.98]"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full -mr-10 -mt-10 group-hover:bg-red-500/20 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-3 group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                                    </div>
                                    <h3 className="font-bold text-slate-800 dark:text-white leading-tight">User Admin</h3>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1">Manage Users</p>
                                </div>
                            </button>

                             {/* HR */}
                             <button 
                                onClick={() => navigate('/hr-dashboard')}
                                className="group relative overflow-hidden bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 text-left hover:shadow-md transition-all active:scale-[0.98]"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/10 rounded-full -mr-10 -mt-10 group-hover:bg-pink-500/20 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="w-10 h-10 rounded-2xl bg-pink-50 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400 mb-3 group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                    </div>
                                    <h3 className="font-bold text-slate-800 dark:text-white leading-tight">HR</h3>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1">Personnel</p>
                                </div>
                            </button>

                             {/* Regional Office (Shortcuts to Monitoring) */}
                             <button 
                                onClick={() => navigate('/monitoring-dashboard')}
                                className="group relative overflow-hidden bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 text-left hover:shadow-md transition-all active:scale-[0.98]"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -mr-10 -mt-10 group-hover:bg-emerald-500/20 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </div>
                                    <h3 className="font-bold text-slate-800 dark:text-white leading-tight">Regional</h3>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1">Office View</p>
                                </div>
                            </button>

                            {/* SDO (Shortcuts to Monitoring) */}
                            <button 
                                onClick={() => navigate('/monitoring-dashboard')}
                                className="group relative overflow-hidden bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 text-left hover:shadow-md transition-all active:scale-[0.98]"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full -mr-10 -mt-10 group-hover:bg-orange-500/20 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-3 group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                    </div>
                                    <h3 className="font-bold text-slate-800 dark:text-white leading-tight">Division</h3>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1">Office View</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* USER MANAGEMENT */}
                    <div>
                        <h2 className="text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider mb-4 ml-1">User Management</h2>
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                            {loading ? (
                                <div className="p-12 text-center">
                                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                    <p className="text-xs text-slate-400 font-medium">Loading users...</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                                            <tr>
                                                <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">User Details</th>
                                                <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">Role</th>
                                                <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                            {users.map(user => (
                                                <tr key={user.uid} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                    <td className="p-4">
                                                        <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{user.firstName} {user.lastName}</div>
                                                        <div className="text-xs text-slate-400">{user.email}</div>
                                                        {user.school_id && <div className="text-[10px] text-blue-400 mt-0.5">ID: {user.school_id}</div>}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                                            user.role === 'Super User' ? 'bg-purple-100 text-purple-600 border-purple-200' :
                                                            user.role === 'Admin' ? 'bg-red-100 text-red-600 border-red-200' : 
                                                            user.role === 'Engineer' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                                                            user.role === 'School Head' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 
                                                            'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {user.role === 'School Head' ? (
                                                            <button 
                                                                onClick={() => handleViewAsSchoolHead(user.uid)} 
                                                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm active:scale-95"
                                                            >
                                                                Login As
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-300 italic">View Only</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default SuperAdminDashboard;
