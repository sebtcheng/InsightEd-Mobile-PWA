import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import { FiPlus, FiFilter, FiSearch, FiEdit2, FiEye, FiMoreVertical, FiCheckCircle } from 'react-icons/fi';
import { auth } from '../firebase';
import LguEditModal from '../components/LguEditModal';
import BottomNav from './BottomNav';

const LguDashboard = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [selectedProject, setSelectedProject] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const handleUpdateClick = (project) => {
        setSelectedProject(project);
        setIsEditModalOpen(true);
    };

    const handleUpdateSuccess = () => {
        setIsEditModalOpen(false);
        // Refresh projects (simple reload of fetch)
        window.location.reload(); 
        // Or re-fetch if we extracted fetchProjects. For now, reload is safest for history updates.
    };

    // --- FETCH PROJECTS ---
    useEffect(() => {
        const fetchProjects = async () => {
            if (!auth.currentUser) return;
            try {
                const res = await fetch(`/api/lgu/projects?uid=${auth.currentUser.uid}`);
                if (res.ok) {
                    const data = await res.json();
                    setProjects(data);
                }
            } catch (err) {
                console.error("Failed to fetch projects:", err);
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) fetchProjects();
            else setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- FILTER ---
    const filteredProjects = projects.filter(p => {
        const matchesSearch = p.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.school_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || p.project_status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const getStatusColor = (status) => {
        switch(status) {
            case 'Completed': return 'bg-emerald-100 text-emerald-700';
            case 'Ongoing': return 'bg-blue-100 text-blue-700';
            case 'For Final Inspection': return 'bg-amber-100 text-amber-700';
            default: return 'bg-slate-100 text-slate-500';
        }
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 pb-24 font-sans">
                {/* Header */}
                <div className="bg-[#004A99] pt-8 pb-12 px-6 rounded-b-[2rem] shadow-xl relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-white">LGU Projects</h1>
                            <p className="text-blue-200 text-sm">Manage and monitor project implementations</p>
                        </div>
                        <button 
                            onClick={() => navigate('/lgu-form')}
                            className="bg-white/10 p-3 rounded-xl text-white backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all font-bold flex items-center gap-2"
                        >
                            <FiPlus className="text-xl" />
                        </button>
                    </div>

                    {/* Search & Filter */}
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" />
                            <input 
                                type="text" 
                                placeholder="Search projects..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-blue-900/30 border border-blue-400/30 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:bg-blue-900/50 transition-all"
                            />
                        </div>
                        <div className="relative">
                            <select 
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="appearance-none pl-4 pr-10 py-3 bg-blue-900/30 border border-blue-400/30 rounded-xl text-white focus:outline-none"
                            >
                                <option value="All">All Status</option>
                                <option value="Ongoing">Ongoing</option>
                                <option value="Completed">Completed</option>
                            </select>
                            <FiFilter className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 -mt-6 relative z-20 space-y-4">
                    {loading ? (
                        <div className="text-center py-10 text-slate-400">Loading projects...</div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
                            <div className="text-6xl mb-4">📂</div>
                            <h3 className="text-slate-800 font-bold text-lg">No Projects Found</h3>
                            <p className="text-slate-400 text-sm mb-6 max-w-[200px] mx-auto">Start by adding your first LGU project.</p>
                            <button onClick={() => navigate('/lgu-form')} className="bg-[#004A99] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20">
                                + Create New Project
                            </button>
                        </div>
                    ) : (
                        filteredProjects.map((project) => (
                        <div key={project.lgu_project_id || project.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${getStatusColor(project.project_status)}`}>
                                            {project.project_status || 'Pending'}
                                        </span>
                                        <h3 className="text-slate-800 font-bold mt-2 text-lg leading-tight line-clamp-2">
                                            {project.project_name}
                                        </h3>
                                        <p className="text-slate-500 text-xs mt-1 font-medium">{project.school_name} {project.school_id && `(${project.school_id})`}</p>
                                    </div>
                                    <button className="text-slate-300 hover:text-blue-600 transition-colors p-1">
                                        <FiMoreVertical />
                                    </button>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                                        <span>Progress</span>
                                        <span className="text-[#004A99]">{project.accomplishment_percentage || 0}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-blue-500 to-[#004A99] rounded-full transition-all duration-500"
                                            style={{ width: `${project.accomplishment_percentage || 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-100 pt-3">
                                    <div>
                                        <div className="text-slate-400 font-medium mb-0.5">Fund Released</div>
                                        <div className="text-slate-700 font-bold font-mono">
                                            ₱{parseFloat(project.fund_released || 0).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-slate-400 font-medium mb-0.5">Utilized</div>
                                        <div className="text-slate-700 font-bold font-mono">
                                            ₱{parseFloat(project.amount_utilized || 0).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="mt-4 flex gap-2">
                                    <button 
                                        onClick={() => navigate(`/lgu-project-details/${project.lgu_project_id || project.id}`)}
                                        className="flex-1 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors"
                                    >
                                        View Details
                                    </button>
                                    {/* Update button directs to details page too, where the edit button is */}
                                    <button 
                                        onClick={() => handleUpdateClick(project)}
                                        className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                                    >
                                        Update Progress
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>



                 {/* Edit Modal */}
                <LguEditModal 
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    project={selectedProject}
                    onUpdateSuccess={handleUpdateSuccess}
                />

                <BottomNav userRole={localStorage.getItem('userRole')} />
            </div>
        </PageTransition>
    );
};

export default LguDashboard;
