import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { FiSearch, FiChevronLeft, FiChevronRight, FiRefreshCw, FiGrid, FiList, FiActivity, FiBriefcase, FiUser, FiTrash2, FiSlash, FiCheckCircle } from "react-icons/fi";

// --- REUSABLE STAT COMPONENT ---
const StatCard = ({ label, value, icon, color }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
            <p className="text-xl font-extrabold text-gray-800 mt-0.5">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${color}`}>
            {icon}
        </div>
    </div>
);

const AdminDashboard = () => {
    // --- STATE ---
    const [userName, setUserName] = useState('Admin');
    const [activeTab, setActiveTab] = useState('overview'); // overview, schools, projects, audit

    // Data States
    const [schools, setSchools] = useState([]);
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);

    // Loading States
    const [loading, setLoading] = useState(false);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');

    // Deadline State
    const [deadlineDate, setDeadlineDate] = useState('');
    const [updatingDeadline, setUpdatingDeadline] = useState(false);

    // --- FETCH DATA ---
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [usersAuthRes, schoolsRes, projectsRes, auditRes, deadlineRes, usersRes] = await Promise.all([
                // checking user role/name
                (async () => {
                    const user = auth.currentUser;
                    if (user) {
                        const snap = await getDoc(doc(db, "users", user.uid));
                        if (snap.exists()) setUserName(snap.data().firstName || 'Admin');
                    }
                })(),
                fetch('/api/schools').then(r => r.json()),
                fetch('/api/projects').then(r => r.json()), // Changed to /api/projects
                fetch('/api/activities').then(r => r.json()),
                fetch('/api/settings/enrolment_deadline').then(r => r.json()),
                fetch('/api/admin/users').then(r => r.json())
            ]);

            // Handle Schools
            if (Array.isArray(schoolsRes)) setSchools(schoolsRes);

            // Handle Projects
            if (Array.isArray(projectsRes)) setProjects(projectsRes);

            // Handle Audits
            if (Array.isArray(auditRes)) setAuditLogs(auditRes);

            // Handle Deadline
            if (deadlineRes && deadlineRes.value) {
                setDeadlineDate(deadlineRes.value);
            }

            // Handle Users
            if (Array.isArray(usersRes)) setUsers(usersRes);

        } catch (error) {
            console.error("Dashboard Sync Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // --- DERIVED STATS ---
    const totalSchools = schools.length;
    const submittedSchools = schools.filter(s => s.status === 'Submitted').length;

    // Projects Stats
    const totalProjects = projects.length;
    const completedProjects = projects.filter(p => p.status === 'Completed').length;
    const delayedProjects = projects.filter(p => {
        if (p.status === 'Completed') return false;
        if (!p.targetCompletionDate) return false;
        const target = new Date(p.targetCompletionDate);
        return new Date() > target;
    }).length;

    // --- HANDLERS ---
    const handleUpdateDeadline = async () => {
        setUpdatingDeadline(true);
        try {
            const user = auth.currentUser;
            const res = await fetch('/api/settings/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'enrolment_deadline',
                    value: deadlineDate,
                    userUid: user ? user.uid : 'admin_override' // fallback if not auth'd properly (should be)
                })
            });

            if (res.ok) {
                alert("✅ Deadline updated successfully!");
                fetchAllData(); // refresh logs
            } else {
                alert("❌ Failed to update deadline.");
            }
        } catch (error) {
            console.error(error);
            alert("❌ Error updating deadline.");
        } finally {
            setUpdatingDeadline(false);
        }
    };

    const handleDisableUser = async (uid, currentStatus) => {
        if (!window.confirm(`Are you sure you want to ${currentStatus ? 'ENABLE' : 'DISABLE'} this user?`)) return;
        
        try {
            const res = await fetch(`/api/admin/users/${uid}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ disabled: !currentStatus })
            });
            if (res.ok) {
                alert(`✅ User ${currentStatus ? 'enabled' : 'disabled'} successfully!`);
                fetchAllData();
            } else {
                alert("❌ Action failed.");
            }
        } catch (err) {
            alert("❌ Error updating user status.");
        }
    };

    const handleDeleteUser = async (uid) => {
        if (!window.confirm("Are you sure you want to PERMANENTLY DELETE this user? This action cannot be undone.")) return;

        try {
            const res = await fetch(`/api/admin/users/${uid}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                alert("✅ User deleted successfully!");
                fetchAllData();
            } else {
                alert("❌ Delete failed.");
            }
        } catch (err) {
            alert("❌ Error deleting user.");
        }
    };

    // --- RENDERERS ---

    const renderOverview = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Quick Stats Grid */}
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">System Health</h3>
            <div className="grid grid-cols-2 gap-3">
                <StatCard
                    label="Schools Data"
                    value={`${submittedSchools}/${totalSchools}`}
                    icon="🏫"
                    color="bg-blue-50 text-blue-600"
                />
                <StatCard
                    label="Projects"
                    value={totalProjects}
                    icon="🏗️"
                    color="bg-orange-50 text-orange-600"
                />
                <StatCard
                    label="Completion"
                    value={`${totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0}%`}
                    icon="✅"
                    color="bg-green-50 text-green-600"
                />
                <StatCard
                    label="Recent Logs"
                    value={auditLogs.length}
                    icon="📋"
                    color="bg-purple-50 text-purple-600"
                />
            </div>

            {/* DEADLINE MANAGER CARD */}
            <div className="mt-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Submission Deadline</h3>
                    <p className="text-xs text-gray-500 mb-2">Set the global due date for Enrolment</p>
                    <input
                        type="date"
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500 transition-colors"
                        value={deadlineDate || ''}
                        onChange={(e) => setDeadlineDate(e.target.value)}
                    />
                </div>
                <button
                    onClick={handleUpdateDeadline}
                    disabled={updatingDeadline}
                    className="bg-[#004A99] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                    {updatingDeadline ? 'Updating...' : 'Update Deadline'}
                </button>
            </div>

            {/* Recent Activity Mini-Feed */}
            <div className='flex justify-between items-end mt-6 mb-2'>
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Recent Activity</h3>
                <button onClick={() => setActiveTab('audit')} className="text-xs text-[#004A99] font-bold">View All</button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {auditLogs.slice(0, 5).map((log, idx) => (
                    <div key={log.log_id || idx} className="p-3 border-b border-gray-50 last:border-0 flex gap-3 hover:bg-slate-50 transition-colors">
                        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${log.action_type === 'CREATE' ? 'bg-green-500' :
                            log.action_type === 'DELETE' ? 'bg-red-500' : 'bg-blue-500'
                            }`} />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{log.details}</p>
                            <div className="flex justify-between mt-0.5">
                                <p className="text-[10px] text-gray-500">{log.user_name} • {log.role}</p>
                                <p className="text-[10px] text-gray-400">{log.formatted_time}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderSchoolsList = () => (
        <div className="space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 mb-4 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                <FiSearch className="text-gray-400 ml-2" />
                <input
                    type="text"
                    placeholder="Search schools..."
                    className="flex-1 text-sm outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {schools.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map((school) => (
                <div key={school.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm">{school.name}</h4>
                        <p className="text-[10px] text-gray-500">{school.district || 'District N/A'}</p>
                    </div>
                    {school.status === 'Submitted' ? (
                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full">Submitted</span>
                    ) : (
                        <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-full">Pending</span>
                    )}
                </div>
            ))}
        </div>
    );

    const renderProjectsList = () => (
        <div className="space-y-3 animate-in fade-in duration-300">
            {/* Stats Check */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-green-50 p-2 rounded-lg text-center border border-green-100">
                    <p className="text-[10px] text-green-600 font-bold uppercase">Completed</p>
                    <p className="text-lg font-bold text-green-700">{completedProjects}</p>
                </div>
                <div className="bg-red-50 p-2 rounded-lg text-center border border-red-100">
                    <p className="text-[10px] text-red-600 font-bold uppercase">Delayed</p>
                    <p className="text-lg font-bold text-red-700">{delayedProjects}</p>
                </div>
                <div className="bg-blue-50 p-2 rounded-lg text-center border border-blue-100">
                    <p className="text-[10px] text-blue-600 font-bold uppercase">Total</p>
                    <p className="text-lg font-bold text-blue-700">{totalProjects}</p>
                </div>
            </div>

            {projects.map((project) => (
                <div key={project.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{project.schoolName}</h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${project.status === 'Completed' ? 'bg-green-50 text-green-600 border-green-100' :
                            'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                            {project.status}
                        </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{project.projectName}</p>
                    {project.accomplishmentPercentage !== undefined && (
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                            <div className="bg-[#004A99] h-1.5 rounded-full" style={{ width: `${project.accomplishmentPercentage}%` }}></div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    const renderAuditTable = () => {
        // Reusing the table logic from previous step, but simplified for this view
        const filtered = auditLogs.filter(log =>
            log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.user_name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            <div className="animate-in fade-in duration-300">
                <div className="flex items-center gap-2 mb-4 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                    <FiSearch className="text-gray-400 ml-2" />
                    <input
                        type="text"
                        placeholder="Search audit logs..."
                        className="flex-1 text-sm outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                    {filtered.map((log) => (
                        <div key={log.log_id} className="p-4 flex gap-3 hover:bg-slate-50 transition-colors">
                            <div className={`mt-1 font-mono text-[10px] px-1.5 py-0.5 rounded h-fit ${log.action_type === 'LOGIN' ? 'bg-green-100 text-green-700' :
                                log.action_type === 'DELETE' ? 'bg-red-100 text-red-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                {log.action_type}
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-gray-800">{log.target_entity}</p>
                                <p className="text-[11px] text-gray-500 leading-relaxed">{log.details}</p>
                                <p className="text-[9px] text-gray-400 mt-1">{log.user_name} • {log.formatted_time}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderAccountManagement = () => {
        const filteredUsers = users.filter(u => 
            (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (u.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.last_name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
             <div className="animate-in fade-in duration-300">
                <div className="flex items-center gap-2 mb-4 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                    <FiSearch className="text-gray-400 ml-2" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="flex-1 text-sm outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-gray-400">
                            <tr>
                                <th className="p-3">User</th>
                                <th className="p-3">Role</th>
                                <th className="p-3 hidden md:table-cell">Jurisdiction</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredUsers.map(user => (
                                <tr key={user.uid} className="hover:bg-blue-50/50 transition-colors group">
                                    <td className="p-3">
                                        <p className="font-bold text-gray-800 text-sm">{user.first_name} {user.last_name}</p>
                                        <p className="text-[10px] text-gray-500">{user.email}</p>
                                    </td>
                                    <td className="p-3">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                            user.role === 'Admin' ? 'bg-purple-100 text-purple-600 border-purple-200' :
                                            user.role === 'Central Office' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                                            'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-3 hidden md:table-cell">
                                        <p className="text-[10px] text-gray-600">
                                            {user.region && `Reg: ${user.region}`}
                                            {user.division && ` • Div: ${user.division}`}
                                        </p>
                                    </td>
                                    <td className="p-3 text-center">
                                       {user.disabled ? (
                                           <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-[9px] font-black px-1.5 py-0.5 rounded">
                                               <FiSlash size={8} /> DISABLED
                                           </span>
                                       ) : (
                                           <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-600 text-[9px] font-black px-1.5 py-0.5 rounded">
                                               <FiCheckCircle size={8} /> ACTIVE
                                           </span>
                                       )}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleDisableUser(user.uid, user.disabled)}
                                                className={`p-1.5 rounded-lg transition-colors ${user.disabled ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                                                title={user.disabled ? "Enable User" : "Disable User"}
                                            >
                                                {user.disabled ? <FiCheckCircle size={14} /> : <FiSlash size={14} />}
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteUser(user.uid)}
                                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                title="Delete User"
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-xs italic">
                            No users found.
                        </div>
                    )}
                </div>
             </div>
        );
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 font-sans pb-24 relative">

                {/* --- HEADER --- */}
                <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden transition-all duration-500 ease-in-out">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="relative z-10">
                        <p className="text-blue-200 text-xs font-bold tracking-widest uppercase mb-1">Administrator</p>
                        <h1 className="text-2xl font-bold text-white leading-tight mb-2">My Dashboard</h1>
                        <div className="flex items-center gap-3 text-blue-100/80 text-xs">
                            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> System Online</div>
                            <button onClick={fetchAllData} className="flex items-center gap-1 hover:text-white"><FiRefreshCw size={10} /> Sync</button>
                        </div>
                    </div>
                </div>

                {/* --- MAIN CARD --- */}
                <div className="px-4 -mt-16 relative z-20">
                    <div className="bg-white/50 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 overflow-hidden min-h-[60vh] flex flex-col">

                        {/* TAB NAVIGATION */}
                        <div className="flex p-2 bg-white/80 border-b border-gray-100 overflow-x-auto gap-2 no-scrollbar">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === 'overview' ? 'bg-[#004A99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => { setActiveTab('schools'); setSearchTerm(''); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === 'schools' ? 'bg-[#004A99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                Schools
                            </button>
                            <button
                                onClick={() => { setActiveTab('projects'); setSearchTerm(''); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === 'projects' ? 'bg-[#004A99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                Projects
                            </button>
                            <button
                                onClick={() => { setActiveTab('audit'); setSearchTerm(''); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === 'audit' ? 'bg-[#004A99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                Audit Trail
                            </button>
                            <button
                                onClick={() => { setActiveTab('accounts'); setSearchTerm(''); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === 'accounts' ? 'bg-[#004A99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                Account Management
                            </button>
                        </div>

                        {/* CONTENT AREA */}
                        <div className="p-4 bg-slate-50/50 flex-1">
                            {loading ? (
                                <div className="h-40 flex items-center justify-center">
                                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <>
                                    {activeTab === 'overview' && renderOverview()}
                                    {activeTab === 'schools' && renderSchoolsList()}
                                    {activeTab === 'projects' && renderProjectsList()}
                                    {activeTab === 'audit' && renderAuditTable()}
                                    {activeTab === 'accounts' && renderAccountManagement()}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <BottomNav userRole="Admin" />
            </div>
        </PageTransition>
    );
};

export default AdminDashboard;