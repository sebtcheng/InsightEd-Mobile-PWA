import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiChevronRight, FiImage, FiPlus } from "react-icons/fi";
import { LuClipboardList, LuCalendar, LuDollarSign, LuActivity } from "react-icons/lu";

import PageTransition from "../components/PageTransition";
import BottomNav from "./BottomNav";
import { auth } from "../firebase";

// --- CONSTANTS ---
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const ProjectStatus = {
  UnderProcurement: "Under Procurement",
  NotYetStarted: "Not Yet Started",
  Ongoing: "Ongoing",
  ForFinalInspection: "For Final Inspection",
  Completed: "Completed",
};

// --- HELPERS ---
const formatAllocation = (value) => {
  const num = Number(value) || 0;
  return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateShort = (dateString) => {
  if (!dateString) return "TBD";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
};

const LguProjects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const fetchUserAndProjects = async () => {
      try {
        const user = auth.currentUser;
        // Super User Bypass: If impersonating, we might not need auth.currentUser strictly for the FETCH, 
        // but we need it for the initial check. 
        // Actually, if Super User, user is logged in as Super User.

        const isSuperUser = localStorage.getItem('userRole') === 'Super User';
        const impRole = sessionStorage.getItem('impersonatedRole');
        const impMuni = sessionStorage.getItem('impersonatedMunicipality');

        let fetchUrl = "";

        if (isSuperUser && impRole === 'Local Government Unit' && impMuni) {
          // Super User Impersonation Mode
          fetchUrl = `${API_BASE}/api/lgu/projects?municipality=${encodeURIComponent(impMuni)}`;
        } else if (user) {
          // Normal LGU User Mode
          // 1. Get User Details
          const resUser = await fetch(`${API_BASE}/api/user-info/${user.uid}`);
          const dataUser = await resUser.json();
          setUserData(dataUser);

          fetchUrl = `${API_BASE}/api/lgu/projects?uid=${user.uid}`;
        } else {
          return; // Not logged in
        }

        // 2. Fetch Projects
        if (fetchUrl) {
          const resProjects = await fetch(fetchUrl);
          if (resProjects.ok) {
            const dataProjects = await resProjects.json();
            setProjects(dataProjects);
          } else {
            console.error("Failed to fetch LGU projects");
          }
        }

      } catch (error) {
        console.error("Error loading LGU projects:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserAndProjects();
  }, []);

  const filteredProjects = projects.filter(p =>
    p.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.school_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.ipc?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUpdate = (project) => {
    navigate(`/lgu-form?id=${project.project_id}`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case ProjectStatus.Completed:
        return "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800";
      case ProjectStatus.Ongoing:
        return "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800";
      case ProjectStatus.UnderProcurement:
        return "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800";
      case ProjectStatus.ForFinalInspection:
        return "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800";
      default:
        return "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-700";
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-24">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
              My Projects
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Manage and track your LGU infrastructure projects
            </p>
          </div>
          <button
            onClick={() => navigate("/lgu-form")}
            className="bg-[#004A99] hover:bg-blue-700 text-white p-2 rounded-full shadow-lg shadow-blue-500/30 transition-transform active:scale-95"
          >
            <FiPlus size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Search */}
          <div className="relative group z-10">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-slate-400 group-focus-within:text-[#004A99] transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004A99]/20 focus:border-[#004A99] dark:text-white transition-all"
              placeholder="Search projects, schools, or IPC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Project List */}
          {isLoading ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-[300px] flex items-center justify-center flex-col">
              <div className="w-10 h-10 border-4 border-slate-100 dark:border-slate-700 border-t-[#004A99] dark:border-t-blue-500 rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-medium text-slate-400">Loading projects...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-[300px] flex items-center justify-center flex-col p-8 text-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                <LuClipboardList size={32} className="text-slate-300 dark:text-slate-500" />
              </div>
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
                {searchQuery ? "No matching projects" : "No Projects Found"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {searchQuery ? "Try adjusting your search terms." : "Create your first project using the + button."}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <tr>
                      <th className="p-4 min-w-[200px]">Project Info</th>
                      <th className="p-4 min-w-[150px]">Status & Progress</th>
                      <th className="p-4 min-w-[150px]">Details</th>
                      <th className="p-4 min-w-[100px] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700 text-xs text-slate-600 dark:text-slate-300">
                    {filteredProjects.map((p, idx) => {
                      const progress = p.accomplishment_percentage || 0;
                      return (
                        <tr key={p.project_id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-slate-800 dark:text-slate-100 mb-1">
                              {p.project_name}
                            </div>
                            <div className="text-slate-500 mb-2">{p.school_name}</div>

                            <div className="flex flex-wrap gap-2">
                              {p.ipc && (
                                <div className="flex items-center gap-1.5 bg-blue-50/80 px-2 py-1 rounded-md border border-blue-100 cursor-help" title="IPC">
                                  <span className="text-[8px] font-black uppercase tracking-wider text-[#004A99]/70">IPC</span>
                                  <span className="text-[9px] font-bold font-mono text-[#004A99]">{p.ipc}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 bg-slate-100/80 px-2 py-1 rounded-md border border-slate-200">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">ID</span>
                                <span className="text-[9px] font-bold font-mono text-slate-600">{p.school_id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="mb-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusColor(p.status)}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse"></span>
                                {p.status}
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                                <span>PROGRESS</span>
                                <span className={progress === 100 ? "text-emerald-500" : "text-[#004A99]"}>{progress}%</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden border border-slate-50">
                                <div
                                  className={`h-full rounded-full transition-all duration-1000 ease-out ${progress === 100 ? "bg-emerald-500" : "bg-[#004A99]"}`}
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                              <div className="text-[9px] text-slate-400 text-right">
                                As of: {formatDateShort(p.status_as_of)}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-[10px]">
                            <div className="space-y-3">
                              <div className="flex flex-col">
                                <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                  <LuCalendar size={10} /> Target
                                </span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {formatDateShort(p.target_completion_date)}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                  <LuDollarSign size={10} /> Allocation
                                </span>
                                <span className="font-mono font-bold text-[#004A99] dark:text-blue-400">
                                  {formatAllocation(p.project_allocation)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => navigate(`/detailed-project-info?projectId=${p.project_id}&isLgu=true`)} // Assuming reusable component
                                className="w-full py-1.5 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg border border-slate-100 hover:bg-white hover:shadow-md transition-all flex items-center justify-center gap-1"
                              >
                                VIEW <FiChevronRight size={12} />
                              </button>
                              <button
                                onClick={() => handleUpdate(p)}
                                className="w-full py-2 bg-[#004A99] text-white text-[10px] font-bold rounded-lg hover:bg-blue-800 shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-1"
                              >
                                UPDATE
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <BottomNav userRole="Local Government Unit" />
      </div>
    </PageTransition>
  );
};

export default LguProjects;
