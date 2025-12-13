import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import 'swiper/css';
import 'swiper/css/pagination';

// Components
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition'; 
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

// --- CONSTANTS ---
const ProjectStatus = {
  UnderProcurement: 'Under Procurement',
  NotYetStarted: 'Not Yet Started',
  Ongoing: 'Ongoing',
  ForFinalInspection: 'For Final Inspection',
  Completed: 'Completed',
};

// --- SUB-COMPONENTS ---

const DashboardStats = ({ projects }) => {
  const stats = {
    total: projects.length,
    completed: projects.filter(p => p.status === ProjectStatus.Completed).length,
    ongoing: projects.filter(p => p.status === ProjectStatus.Ongoing).length,
    delayed: projects.filter(p => {
       if (p.status === ProjectStatus.Completed) return false;
       if (!p.targetCompletionDate) return false; 
       const target = new Date(p.targetCompletionDate);
       const now = new Date();
       return now > target && p.accomplishmentPercentage < 100;
    }).length,
    totalAllocation: projects.reduce((acc, curr) => acc + (Number(curr.projectAllocation) || 0), 0)
  };

  const data = [
    { name: 'Completed', value: stats.completed, color: '#10B981' }, 
    { name: 'Ongoing', value: stats.ongoing, color: '#3B82F6' }, 
    { name: 'Delayed', value: stats.delayed, color: '#EF4444' }, 
    { name: 'Others', value: stats.total - (stats.completed + stats.ongoing + stats.delayed), color: '#94A3B8' } 
  ].filter(d => d.value > 0);

  return (
    <div className="mb-6 space-y-3">
      {/* Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Allocation</p>
            <p className="text-sm font-bold text-[#004A99] mt-1">
                ₱{(stats.totalAllocation / 1000000).toFixed(1)}M
            </p>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Projects</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{stats.total}</p>
        </div>
        <div className={`p-3 rounded-xl shadow-sm border flex flex-col justify-center items-center text-center ${stats.delayed > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wide ${stats.delayed > 0 ? 'text-red-500' : 'text-slate-500'}`}>Delayed</p>
            <div className="flex items-center gap-1 mt-1">
                <p className={`text-xl font-bold ${stats.delayed > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {stats.delayed}
                </p>
                {stats.delayed > 0 && <span className="text-[10px] animate-pulse">⚠️</span>}
            </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
         <div className="flex flex-col justify-center ml-2">
             <p className="text-xs font-bold text-slate-700 mb-2">Project Status Mix</p>
             <div className="text-[10px] text-slate-500 space-y-1">
                 {data.map(d => (
                     <div key={d.name} className="flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}></span>
                         <span>{d.name}: {d.value}</span>
                     </div>
                 ))}
             </div>
         </div>
         <div className="w-24 h-24 mr-2">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={data} cx="50%" cy="50%" innerRadius={18} outerRadius={35} paddingAngle={5} dataKey="value">
                        {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                </PieChart>
            </ResponsiveContainer>
         </div>
      </div>
    </div>
  );
};

const ProjectTable = ({ projects, onEdit, onAnalyze, onView, isLoading }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case ProjectStatus.Completed: return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case ProjectStatus.Ongoing: return 'bg-blue-100 text-blue-800 border-blue-200';
      case ProjectStatus.UnderProcurement: return 'bg-amber-100 text-amber-800 border-amber-200';
      case ProjectStatus.ForFinalInspection: return 'bg-purple-100 text-purple-800 border-purple-200'; // Added color for new status
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow border border-slate-200 h-[450px] flex items-center justify-center flex-col">
         <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
         <p className="text-xs text-slate-400">Loading projects...</p>
      </div>
    )
  }

  if (projects.length === 0) {
      return (
        <div className="bg-white rounded-xl shadow border border-slate-200 h-[200px] flex items-center justify-center flex-col p-6 text-center">
            <p className="text-2xl mb-2">📂</p>
            <p className="text-sm font-bold text-slate-700">No Projects Found</p>
            <p className="text-xs text-slate-500">Tap "+ New Project" to add your first entry.</p>
        </div>
      )
  }

  return (
    <div className="bg-white rounded-xl shadow border border-slate-200 flex flex-col h-[450px] overflow-hidden">
      <div className="overflow-auto flex-1 relative">
        <table className="w-full text-left border-collapse">
          {/* COMPACT HEADER WIDTHS */}
          <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm text-[10px] uppercase font-semibold text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 z-30 p-2 border-b border-r border-slate-200 min-w-[130px]">Project Info</th>
              <th className="p-2 border-b border-slate-200 min-w-[100px]">Status</th>
              <th className="p-2 border-b border-slate-200 min-w-[90px]">Timeline</th>
              <th className="sticky right-0 bg-slate-50 z-30 p-2 border-b border-l border-slate-200 min-w-[80px] text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-slate-50 transition-colors group">
                {/* Project Info */}
                <td className="sticky left-0 bg-white group-hover:bg-slate-50 z-10 p-2 border-r border-slate-200 align-top">
                  <div className="font-bold text-[#004A99] mb-1 line-clamp-2 leading-tight">{project.schoolName}</div>
                  <div className="text-[9px] text-slate-500 mb-1 line-clamp-1">{project.projectName}</div>
                  <div className="text-[9px] font-mono bg-slate-100 inline-block px-1 rounded text-slate-500">
                    ID: {project.schoolId}
                  </div>
                </td>
                
                {/* Status - UPDATED SECTION */}
                <td className="p-2 align-top">
                  <div className="mb-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${getStatusColor(project.status)}`}>
                        {project.status === 'Not Yet Started' ? 'Not Started' : project.status}
                    </span>
                  </div>
                  
                  {/* --- CONDITIONAL PROGRESS BAR --- */}
                  {(project.status === ProjectStatus.Ongoing || project.status === ProjectStatus.Completed) ? (
                    <>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                            <div 
                                className={`h-1.5 rounded-full ${project.accomplishmentPercentage === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} 
                                style={{ width: `${project.accomplishmentPercentage}%` }}></div>
                        </div>
                        <div className="text-[9px] text-right mt-0.5 font-mono text-slate-500">{project.accomplishmentPercentage || 0}%</div>
                    </>
                  ) : (
                    <div className="text-[9px] text-slate-400 mt-2 italic opacity-60">
                        {/* Display "For Final Inspection" status clearly when not showing percentage */}
                        {project.status === ProjectStatus.ForFinalInspection ? 'Project Physical Completion' : '-- No Progress --'}
                    </div>
                  )}
                </td>

                {/* Timeline */}
                <td className="p-2 align-top text-[10px]">
                  <div className="mb-1">
                      <span className="text-slate-400 block text-[9px] uppercase">Target</span> 
                      <span className="font-medium whitespace-nowrap">{formatDateShort(project.targetCompletionDate)}</span>
                  </div>
                  <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Budget</span> 
                      <span className="font-mono text-[#004A99]">₱{((project.projectAllocation || 0)/1000000).toFixed(1)}M</span>
                  </div>
                </td>

                {/* Actions */}
                <td className="sticky right-0 bg-white group-hover:bg-slate-50 z-10 p-2 border-l border-slate-200 align-top text-center flex flex-col gap-1.5">
                  <button onClick={() => onView(project)} className="w-full px-1 py-1 bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-bold rounded hover:bg-slate-200 transition">
                    VIEW
                  </button>
                  <button onClick={() => onEdit(project)} className="w-full px-1 py-1 bg-[#004A99] text-white text-[9px] font-bold rounded hover:bg-blue-800 transition">
                    UPDATE
                  </button>
                  <button onClick={() => onAnalyze(project)} className="w-full px-1 py-1 bg-purple-50 border border-purple-200 text-purple-600 text-[10px] font-bold rounded hover:bg-purple-100 transition">
                     ✨
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const EditProjectModal = ({ project, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (project) setFormData({ ...project });
  }, [project]);

  if (!isOpen || !formData) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
        let newData = { ...prev, [name]: value };

        // 1. If User changes Percentage manually 
        if (name === 'accomplishmentPercentage') {
            const percent = parseFloat(value);
            
            if (percent === 100) {
                // If user enters 100%, status can be Completed or For Final Inspection
                if (prev.status !== ProjectStatus.Completed) {
                    // Assume if it was not completed, 100% means it's ready for inspection
                    newData.status = ProjectStatus.ForFinalInspection; 
                }
            } 
            // If they change 100% to < 100%, it reverts to Ongoing
            else if (percent >= 1 && percent < 100) {
                 // Only change status back to Ongoing if it was Completed or For Final Inspection
                 if (prev.status === ProjectStatus.Completed || prev.status === ProjectStatus.ForFinalInspection) {
                    newData.status = ProjectStatus.Ongoing;
                 }
            }
            // If they change 90% to 0%, it reverts to Not Yet Started
            else if (percent === 0) {
                 newData.status = ProjectStatus.NotYetStarted;
            }
        }

        // 2. If User changes Status manually (Auto-set logic)
        if (name === 'status') {
            if (value === ProjectStatus.NotYetStarted || value === ProjectStatus.UnderProcurement) {
                newData.accomplishmentPercentage = 0;
            } 
            // Force 100% when status is manually set to Completed OR ForFinalInspection (UPDATED)
            else if (value === ProjectStatus.Completed || value === ProjectStatus.ForFinalInspection) {
                 newData.accomplishmentPercentage = 100;
            }
            // If changing to Ongoing, the current percentage is preserved by default.
        }

        return newData;
    });
  };

  const handleGenerateAI = async () => {
      setIsGenerating(true);
      setTimeout(() => {
        setFormData(prev => ({ ...prev, otherRemarks: "Based on the 85% progress and current weather patterns in Bulacan, minor delays are expected. Recommendation: Expedite roof installation." }));
        setIsGenerating(false);
      }, 1500);
  };
  
  // Disable percentage input if status is Not Started, Under Procurement, Completed, OR For Final Inspection
  const isDisabledPercentageInput = formData.status === ProjectStatus.NotYetStarted || 
                                    formData.status === ProjectStatus.UnderProcurement ||
                                    formData.status === ProjectStatus.Completed ||
                                    formData.status === ProjectStatus.ForFinalInspection;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-2xl animate-slide-up">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-800">Update Project</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50">
                        {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Accomplishment (%)</label>
                    <input 
                        type="number" 
                        name="accomplishmentPercentage" 
                        value={formData.accomplishmentPercentage} 
                        onChange={handleChange} 
                        min="0" max="100"
                        // Input is disabled if percentage is automatically managed by status
                        disabled={isDisabledPercentageInput}
                        className={`w-full p-2 border border-slate-300 rounded-lg text-sm font-bold ${isDisabledPercentageInput ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'text-[#004A99]'}`}
                    />
                </div>
            </div>
            <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date As Of</label>
                 <input type="date" name="statusAsOfDate" value={formData.statusAsOfDate} onChange={handleChange} className="w-full p-2 border rounded-lg text-sm" />
            </div>
            <div>
                 <div className="flex justify-between items-center mb-1">
                     <label className="block text-xs font-bold text-slate-500 uppercase">Remarks</label>
                     <button type="button" onClick={handleGenerateAI} className="text-[10px] text-purple-600 font-bold flex items-center gap-1">
                        {isGenerating ? <span className="animate-pulse">Generating...</span> : <>✨ Auto-Generate with AI</>}
                     </button>
                 </div>
                 <textarea name="otherRemarks" value={formData.otherRemarks || ''} onChange={handleChange} rows={3} className="w-full p-2 border rounded-lg text-sm" />
            </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex gap-3">
             <button onClick={onClose} className="flex-1 py-3 text-slate-600 font-bold text-sm bg-slate-100 rounded-xl">Cancel</button>
             <button onClick={() => { onSave(formData); onClose(); }} className="flex-1 py-3 text-white font-bold text-sm bg-[#004A99] rounded-xl shadow-lg shadow-blue-900/20">Save Updates</button>
        </div>
      </div>
    </div>
  );
};

// ... (rest of EngineerDashboard.jsx is unchanged)
// ... (The main component EngineerDashboard and the ProjectTable are unchanged from the previous step as their logic for displaying/hiding the percentage was already correct based on the new requirements)

const AIInsightModal = ({ isOpen, onClose, projectName, analysis, isLoading }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl animate-pulse">✨</span>
                        <h3 className="font-bold">Gemini Risk Assessment</h3>
                    </div>
                    <p className="text-purple-100 text-xs truncate">Analyzing: {projectName}</p>
                </div>
                <div className="p-6 min-h-[200px] flex items-center justify-center">
                    {isLoading ? (
                         <div className="text-center">
                            <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
                            <p className="text-slate-500 text-sm">Consulting Gemini models...</p>
                         </div>
                    ) : (
                        <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{analysis}</p>
                    )}
                </div>
                <button onClick={onClose} className="w-full py-4 bg-slate-50 text-slate-600 font-bold text-sm border-t border-slate-100 hover:bg-slate-100">Close Analysis</button>
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD COMPONENT ---

const EngineerDashboard = () => {
    const navigate = useNavigate();
    const [userName, setUserName] = useState('Engineer');
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    
    // AI Modal State
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState('');

    // --- EFFECT: Fetch User & Projects ---
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

        const fetchProjects = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('http://localhost:3000/api/projects');
                if (!response.ok) throw new Error("Failed to fetch projects");
                
                const data = await response.json();
                setProjects(data);
            } catch (err) {
                console.error("Error loading projects:", err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchUserData();
        fetchProjects();
    }, []);

    // Handlers
    const handleViewProject = (project) => {
        navigate(`/project-details/${project.id}`);
    };

    const handleEditProject = (project) => {
        setSelectedProject(project);
        setEditModalOpen(true);
    };

    const handleSaveProject = async (updatedProject) => {
        // Optimistic UI Update
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));

        try {
            const response = await fetch(`http://localhost:3000/api/update-project/${updatedProject.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedProject),
            });

            if (!response.ok) {
                throw new Error("Failed to update in database");
            }

            const result = await response.json();
            console.log("Database updated:", result);

        } catch (err) {
            console.error("❌ Update Error:", err);
            alert("Failed to save changes to the database. Please check your connection.");
        }
    };

    const handleAnalyzeRisk = (project) => {
        setSelectedProject(project);
        setAiModalOpen(true);
        setAiLoading(true);
        
        setTimeout(() => {
            setAiAnalysis(`RISK ASSESSMENT: HIGH\n\n1. **Delay Risk**: The project is ${100 - (project.accomplishmentPercentage || 0)}% remaining vs timeline.\n2. **Budget**: Allocation of ₱${((project.projectAllocation||0)/1000000).toFixed(1)}M is under review.`);
            setAiLoading(false);
        }, 2000);
    };

    const sliderContent = [
        { id: 1, title: `Welcome, Engr. ${userName}!`, emoji: "👷", description: "Your dashboard is ready. Track ongoing construction and validate school infrastructure data." },
        { id: 2, title: "Site Inspection", emoji: "🏗️", description: "Scheduled inspection for Building A is due this Thursday. Please review the checklist." },
    ];

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 font-sans pb-24">
                
                {/* --- TOP HEADER --- */}
                <div className="relative bg-[#004A99] pt-12 pb-24 px-6 rounded-b-[2.5rem] shadow-xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-blue-200 text-xs font-bold tracking-wider uppercase">DepEd Infrastructure</p>
                            <h1 className="text-2xl font-bold text-white mt-1">Dashboard</h1>
                            <p className="text-blue-100 mt-1 text-sm">Overview of {projects.length} active projects.</p>
                        </div>
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white shadow-inner">
                            👷‍♂️
                        </div>
                    </div>
                </div>

                {/* --- MAIN CONTENT CONTAINER --- */}
                <div className="px-5 -mt-16 relative z-10 space-y-6">

                    {/* 1. Statistics Section */}
                    <DashboardStats projects={projects} />

                    {/* 2. Announcements Slider */}
                    <div className="w-full">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <h2 className="text-slate-700 font-bold text-sm">Updates & Reminders</h2>
                        </div>
                        <Swiper
                            modules={[Pagination, Autoplay]}
                            spaceBetween={15}
                            slidesPerView={1}
                            pagination={{ clickable: true, dynamicBullets: true }}
                            autoplay={{ delay: 5000 }}
                            className="w-full"
                        >
                            {sliderContent.map((item) => (
                                <SwiperSlide key={item.id} className="pb-8">
                                    <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-[#FDB913] flex flex-col justify-center min-h-[120px]">
                                        <h3 className="text-[#004A99] font-bold text-sm flex items-center mb-1">
                                            <span className="text-xl mr-2">{item.emoji}</span>
                                            {item.title}
                                        </h3>
                                        <p className="text-slate-500 text-xs leading-relaxed ml-7">
                                            {item.description}
                                        </p>
                                    </div>
                                </SwiperSlide>
                            ))}
                        </Swiper>
                    </div>

                    {/* 3. Project Table Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h2 className="text-slate-700 font-bold text-lg">Project Monitoring</h2>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => navigate('/new-project')} 
                                    className="text-[10px] bg-[#004A99] text-white px-3 py-1 rounded-full font-medium shadow-sm hover:bg-blue-800 transition flex items-center gap-1"
                                >
                                    <span className="text-base leading-none">+</span> New Project
                                </button>
                                <button className="text-[10px] bg-white border border-slate-200 px-3 py-1 rounded-full text-slate-600 font-medium shadow-sm">
                                    Filter ▾
                                </button>
                            </div>

                        </div>
                        <ProjectTable 
                            projects={projects} 
                            onEdit={handleEditProject} 
                            onAnalyze={handleAnalyzeRisk} 
                            onView={handleViewProject}
                            isLoading={isLoading}
                        />
                        <p className="text-[10px] text-slate-400 text-center mt-2 italic">
                            Swipe table horizontally to view more details
                        </p>
                    </div>

                </div>

                {/* --- MODALS --- */}
                <EditProjectModal 
                    project={selectedProject} 
                    isOpen={editModalOpen} 
                    onClose={() => setEditModalOpen(false)} 
                    onSave={handleSaveProject} 
                />

                <AIInsightModal 
                    isOpen={aiModalOpen}
                    onClose={() => setAiModalOpen(false)}
                    projectName={selectedProject?.schoolName}
                    analysis={aiAnalysis}
                    isLoading={aiLoading}
                />

                {/* Bottom Navigation */}
                <BottomNav homeRoute="/engineer-dashboard" />
            </div>
        </PageTransition>
    );
};

export default EngineerDashboard;