import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiPlus, FiFilter, FiCamera, FiImage, FiSettings, FiChevronRight } from "react-icons/fi";
import { LuClipboardList, LuCalendar, LuDollarSign, LuActivity } from "react-icons/lu";

import BottomNav from "./BottomNav";
import PageTransition from "../components/PageTransition";
import { auth, db } from "../firebase";
import { doc, getDoc, query, collection, where, getDocs } from "firebase/firestore";
import { addEngineerToOutbox, cacheProjects, getCachedProjects } from "../db";
import { compressImage } from "../utils/imageCompression";

import LocationPickerMap from '../components/LocationPickerMap';

// --- CONSTANTS ---
const ProjectStatus = {
  UnderProcurement: "Under Procurement",
  NotYetStarted: "Not Yet Started",
  Ongoing: "Ongoing",
  ForFinalInspection: "For Final Inspection",
  Completed: "Completed",
};

const DOC_TYPES = {
  POW: "Program of Works",
  DUPA: "DUPA",
  CONTRACT: "Signed Contract"
};

const convertFullFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
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

// --- SUB-COMPONENTS ---

const ProjectTable = ({ projects, onEdit, onAnalyze, onView, isLoading, searchQuery }) => {
  const navigate = useNavigate();

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

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-[450px] flex items-center justify-center flex-col">
        <div className="w-10 h-10 border-4 border-slate-100 dark:border-slate-700 border-t-[#004A99] dark:border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-medium text-slate-400">Loading your projects...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-[300px] flex items-center justify-center flex-col p-8 text-center">
        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
          <LuClipboardList size={32} className="text-slate-300 dark:text-slate-500" />
        </div>
        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
          {searchQuery ? "No matching projects" : "No Projects Yet"}
        </p>
        <p className="text-sm text-slate-400 mt-1 max-w-[200px]">
          {searchQuery ? "Try adjusting your search terms." : "Start by adding your first school infrastructure project."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 flex flex-col h-[calc(100vh-220px)] overflow-hidden">
      <div className="overflow-auto flex-1 relative custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-slate-700">
            <tr>
              <th className="sticky left-0 bg-slate-50 dark:bg-slate-900 z-30 p-4 min-w-[150px]">
                Project Info
              </th>
              <th className="p-4 min-w-[120px]">
                Status & Progress
              </th>
              <th className="p-4 min-w-[100px]">
                Details
              </th>
              <th className="sticky right-0 bg-slate-50 dark:bg-slate-900 z-30 p-4 min-w-[100px] text-center">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700 text-xs text-slate-600 dark:text-slate-300">
            {projects.map((p, idx) => {
              const isLocked = p.status === ProjectStatus.Completed;
              const progress = p.accomplishmentPercentage || 0;

              return (
                <tr
                  key={p.id}
                  className="hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-all duration-200 group animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <td className="sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 z-10 p-4 border-r border-slate-50 dark:border-slate-700">
                    <div className="font-bold text-slate-800 dark:text-slate-100 mb-1 line-clamp-2 leading-tight group-hover:text-[#004A99] dark:group-hover:text-blue-400 transition-colors">
                      {p.schoolName}
                    </div>
                    {/* ID Badges Row */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {/* IPC Badge */}
                      {p.ipc && (
                        <div className="group/ipc flex items-center gap-1.5 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 px-2 py-1 rounded-md border border-blue-100 dark:border-blue-800 transition-colors cursor-help" title="InsightEd Project Code">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#004A99] dark:bg-blue-400 group-hover/ipc:animate-pulse"></div>
                          <span className="text-[8px] font-black uppercase tracking-wider text-[#004A99]/70 dark:text-blue-300/70">IPC</span>
                          <span className="text-[9px] font-bold font-mono text-[#004A99] dark:text-blue-300">{p.ipc}</span>
                        </div>
                      )}

                      {/* School ID Badge */}
                      <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-700/50 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600">
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">ID</span>
                        <span className="text-[9px] font-bold font-mono text-slate-600 dark:text-slate-300">{p.schoolId}</span>
                      </div>
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="mb-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusColor(
                          p.status
                        )}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse"></span>
                        {p.status}
                      </span>
                    </div>

                    {(p.status === ProjectStatus.Ongoing || p.status === ProjectStatus.Completed || progress > 0) ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                          <div className="flex items-center gap-1">
                            <span>PROGRESS</span>
                            {/* LATE BADGE */}
                            {p.status === ProjectStatus.Completed && p.actualCompletionDate && p.targetCompletionDate && new Date(p.actualCompletionDate) > new Date(p.targetCompletionDate) && (
                              <span className="text-[7px] bg-red-100 text-red-600 px-1 py-0.5 rounded border border-red-200">LATE</span>
                            )}
                          </div>
                          <span className={progress === 100 ? "text-emerald-500 dark:text-emerald-400" : "text-[#004A99] dark:text-blue-400"}>
                            {progress}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden border border-slate-50 dark:border-slate-600">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${progress === 100 ? "bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                              }`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[9px] text-slate-300 dark:text-slate-500 italic flex items-center gap-1">
                        <LuActivity size={10} /> Pending Start
                      </div>
                    )}
                  </td>

                  <td className="p-4 text-[10px]">
                    <div className="space-y-3">
                      <div className="flex flex-col">
                        <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          <LuCalendar size={10} /> Target
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {formatDateShort(p.targetCompletionDate)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          <LuDollarSign size={10} /> Budget
                        </span>
                        <span className="font-mono font-bold text-[#004A99] dark:text-blue-400">
                          {formatAllocation(p.projectAllocation)}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="sticky right-0 bg-white dark:bg-slate-800 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 z-10 p-4 border-l border-slate-50 dark:border-slate-700 text-center">
                    <div className="flex flex-col gap-2">
                      {/* CONDITIONAL ACTION: Upload Docs */}
                      {(!p.pow_pdf || !p.dupa_pdf || !p.contract_pdf) && (
                        <button
                          onClick={() => onEdit(p, 'docs_only')}
                          className="w-full py-1.5 bg-red-500 text-white text-[10px] font-bold rounded-lg shadow-md shadow-red-500/30 hover:bg-red-600 transition-all active:scale-95 flex items-center justify-center gap-1 animate-pulse"
                        >
                          ⚠️ UPLOAD DOCS
                        </button>
                      )}

                      <button
                        onClick={() => onView(p)}
                        className="w-full py-1.5 bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-bold rounded-lg border border-slate-100 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-600 hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-1"
                      >
                        VIEW <FiChevronRight size={12} />
                      </button>
                      <button
                        onClick={() => navigate(`/project-gallery/${p.id}`)}
                        className="w-full py-1.5 bg-amber-50/50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-lg border border-amber-100 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/50 hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-1"
                      >
                        <FiImage size={12} /> GALLERY
                      </button>
                      <button
                        onClick={() => onEdit(p, 'quick')}
                        disabled={isLocked}
                        className={`w-full py-2 text-[10px] font-bold rounded-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1 ${isLocked
                          ? "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-600"
                          : "bg-[#004A99] dark:bg-blue-600 text-white hover:bg-blue-800 dark:hover:bg-blue-700 shadow-blue-500/20"
                          }`}
                      >
                        {isLocked ? "LOCKED" : "UPDATE"}
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
  );
};


import EditProjectModal from "../components/EditProjectModal";


// --- MAIN PROJECT LIST COMPONENT ---

const EngineerProjects = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Division Engineer");
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || "Division Engineer");
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [modalMode, setModalMode] = useState('quick');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Categorized State
  const [internalFiles, setInternalFiles] = useState([]);
  const [internalPreviews, setInternalPreviews] = useState([]);
  const [externalFiles, setExternalFiles] = useState([]);
  const [externalPreviews, setExternalPreviews] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Internal');


  // AI Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");

  // --- Image Upload State & Refs ---
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const API_BASE = "";

  // Fetch User & Projects
  useEffect(() => {
    const fetchUserDataAndProjects = async () => {
      const user = auth.currentUser;
      if (user) {
        // 1. Get User Name
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserName(docSnap.data().firstName);
          }
        } catch (e) {
          console.error("Error fetching user profile:", e);
        }

        try {
          setIsLoading(true);
          const userRole = localStorage.getItem('userRole');
          let currentProjects = [];

          if (userRole === 'Super Admin') {
            // SUPER ADMIN: Firestore Query (ALL)
            const q = query(collection(db, 'projects'));
            const querySnapshot = await getDocs(q);
            const mappedData = querySnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data()
            }));

            currentProjects = mappedData.map(item => ({
              id: item.id,
              projectName: item.projectName || "Untitled",
              schoolName: item.schoolName || "Unknown School",
              schoolId: item.schoolId,
              status: item.status,
              accomplishmentPercentage: item.accomplishmentPercentage,
              projectAllocation: item.projectAllocation,
              targetCompletionDate: item.targetCompletionDate,
              statusAsOfDate: item.statusAsOfDate,
              otherRemarks: item.otherRemarks,
              contractorName: item.contractorName,
              uid: item.uid
            }));

          } else {

            // ENGINEER: Stale-While-Revalidate Strategy

            // 1. Immediate Cache Load (Fast Render)
            try {
              const cachedData = await getCachedProjects();
              if (cachedData && cachedData.length > 0) {
                setProjects(cachedData);
                currentProjects = cachedData; // Prevent overwrite by empty array later
                setIsLoading(false); // Stop spinner if we have data
              }
            } catch (err) {
              console.warn("Cache read failed", err);
            }

            // 2. Network Request (Background Sync)
            try {
              const response = await fetch(`${API_BASE}/api/projects?engineer_id=${user.uid}`);
              if (!response.ok) throw new Error("Failed to fetch projects");
              const data = await response.json();

              currentProjects = data.map(item => ({
                id: item.id,
                projectName: item.projectName,
                schoolName: item.schoolName,
                schoolId: item.schoolId,
                status: item.status,
                accomplishmentPercentage: item.accomplishmentPercentage,
                projectAllocation: item.projectAllocation,
                targetCompletionDate: item.targetCompletionDate,
                statusAsOfDate: item.statusAsOfDate,
                otherRemarks: item.otherRemarks,
                contractorName: item.contractorName,
                ipc: item.ipc,
                latitude: item.latitude,
                longitude: item.longitude,
                projectCategory: item.projectCategory,
                scopeOfWork: item.scopeOfWork,
                numberOfClassrooms: item.numberOfClassrooms,
                numberOfStoreys: item.numberOfStoreys,
                numberOfSites: item.numberOfSites,
                fundsUtilized: item.fundsUtilized,
                constructionStartDate: item.constructionStartDate,
                noticeToProceed: item.noticeToProceed,
                batchOfFunds: item.batchOfFunds
              }));

              // Update Cache on success
              await cacheProjects(currentProjects);

              // Update state with fresh data
              setProjects(currentProjects);

            } catch (networkError) {
              console.warn("Network request failed:", networkError);
              // If we didn't have cached data before, we rely on the fallback above or show empty state if truly offline & no cache
            }
          }

          setProjects(currentProjects);

        } catch (err) {
          console.error("Error loading projects:", err);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchUserDataAndProjects();
  }, []);

  // Filtered list
  const filteredProjects = projects.filter(p =>
    p.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(p.schoolId).includes(searchQuery)
  );

  // Handlers
  const handleViewProject = (project) => navigate(`/project-details/${project.id}`);
  const handleEditProject = (project, mode = 'quick') => {
    setSelectedProject(project);
    setModalMode(mode);
    setInternalFiles([]);
    setInternalPreviews([]);
    setExternalFiles([]);
    setExternalPreviews([]); // Clear old previews
    setEditModalOpen(true);
  };

  const handleSaveProject = async (updatedProject) => {
    const user = auth.currentUser;
    if (!user) return;

    // CHECK: Mandatory Photo Upload (Skipped for Docs Only)
    if (modalMode !== 'docs_only' && internalFiles.length === 0 && externalFiles.length === 0) {
      alert("⚠️ PROOF REQUIRED\n\nAccording to COA requirements, you must attach at least one site photo for every project update.");
      return;
    }

    // CHECK: Mandatory Location REMOVED per user request
    // if (!updatedProject.latitude || !updatedProject.longitude) {
    //   alert("⚠️ LOCATION REQUIRED\n\nPlease capture the project coordinates (Latitude/Longitude) before saving.");
    //   return;
    // }

    setIsUploading(true);
    try {
      const body = { ...updatedProject, uid: user.uid, modifiedBy: userName };
      if (!navigator.onLine) {
        await addEngineerToOutbox({
          url: `${API_BASE}/api/update-project/${updatedProject.id}`,
          method: 'PUT',
          body: body,
          formName: `Update: ${updatedProject.schoolName}`
        });

        // Save images offline
        const allFiles = [
          ...internalFiles.map(f => ({ file: f, category: 'Internal' })),
          ...externalFiles.map(f => ({ file: f, category: 'External' }))
        ];

        if (allFiles.length > 0) {
          for (const item of allFiles) {
            try {
              const base64Image = await compressImage(item.file);
              await addEngineerToOutbox({
                url: `${API_BASE}/api/upload-image`,
                method: 'POST',
                body: { projectId: updatedProject.id, imageData: base64Image, uploadedBy: user.uid, category: item.category },
                formName: `Photo (${item.category}): ${updatedProject.schoolName}`
              });
            } catch (err) {
              console.error("Compression failed for file:", item.file.name, err);
            }
          }
        }
        alert("⚠️ Offline: Changes cached to Sync Center.");
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        setEditModalOpen(false);
        return;
      }

      // Online Save Project
      const response = await fetch(`${API_BASE}/api/update-project/${updatedProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Update failed");

      // Online Upload Images
      const allFiles = [
        ...internalFiles.map(f => ({ file: f, category: 'Internal' })),
        ...externalFiles.map(f => ({ file: f, category: 'External' }))
      ];

      if (allFiles.length > 0) {
        for (const item of allFiles) {
          try {
            const base64Image = await compressImage(item.file);
            await fetch(`${API_BASE}/api/upload-image`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: updatedProject.id, imageData: base64Image, uploadedBy: user.uid, category: item.category }),
            });
          } catch (err) {
            console.error("Compression failed for file:", item.file.name, err);
          }
        }
      }
      setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      alert("Success: Changes synced to database!");
      setInternalFiles([]);
      setExternalFiles([]);
      setEditModalOpen(false);
    } catch (err) {
      console.error("Save Error:", err);
      alert("Sync error. Try again later.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Limit removed
    const validFiles = files.filter(file => file.size <= 5 * 1024 * 1024);
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));

    if (activeCategory === 'Internal') {
      setInternalFiles(prev => [...prev, ...validFiles]);
      setInternalPreviews(prev => [...prev, ...newPreviews]);
    } else {
      setExternalFiles(prev => [...prev, ...validFiles]);
      setExternalPreviews(prev => [...prev, ...newPreviews]);
    }

    e.target.value = null;
  };

  const removeFile = (index, category) => {
    if (category === 'Internal') {
      setInternalFiles(prev => prev.filter((_, i) => i !== index));
      setInternalPreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      setExternalFiles(prev => prev.filter((_, i) => i !== index));
      setExternalPreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-24">
        {/* --- DYNAMIC PREMIUM HEADER --- */}
        <div className="bg-gradient-to-br from-[#004A99] via-[#003366] to-[#001D3D] p-6 pb-28 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden transition-all duration-500">
          {/* Decorative Elements */}
          <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-blue-400/10 rounded-full blur-2xl"></div>

          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] leading-none">
                    Infrastructure Live
                  </p>
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
                  Projects <span className="text-blue-400/60 font-medium">/</span> {projects.length}
                </h1>
              </div>
              <button
                onClick={() => navigate("/new-project")}
                className="group bg-white text-[#004A99] px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <FiPlus size={16} className="group-hover:rotate-90 transition-transform" />
                New Project
              </button>
            </div>

            {/* --- GLASSMORPHISM SEARCH BAR --- */}
            <div className="relative group transition-all duration-300">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <FiSearch className="text-white/40 group-focus-within:text-white transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Query schools, projects or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder:text-white/30 text-xs px-12 py-4 rounded-2xl outline-none focus:ring-4 focus:ring-white/10 focus:bg-white/15 transition-all shadow-inner"
              />
              <div className="absolute inset-y-0 right-4 flex items-center">
                <div className="h-6 w-[1px] bg-white/10 mx-2"></div>
                <FiFilter className="text-white/40 hover:text-white cursor-pointer transition-colors" />
              </div>
            </div>
          </div>
        </div>

        {/* --- PROJECT LISTING --- */}
        <div className="px-5 -mt-12 relative z-20">
          <ProjectTable
            projects={filteredProjects}
            onEdit={handleEditProject}
            onView={handleViewProject}
            isLoading={isLoading}
            searchQuery={searchQuery}
          />

          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-[#004A99] rounded-full"></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Swipe Details</span>
            </div>
            <div className="w-[1px] h-3 bg-slate-200"></div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Live Updates</span>
            </div>
          </div>
        </div>

        {/* --- HIDDEN INPUTS & MODALS --- */}
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
        <input type="file" ref={cameraInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />

        <EditProjectModal
          project={selectedProject}
          isOpen={editModalOpen}
          mode={modalMode}
          onClose={() => setEditModalOpen(false)}
          onSave={handleSaveProject}
          onCameraClick={(category) => {
            setActiveCategory(category);
            cameraInputRef.current?.click();
          }}
          onGalleryClick={(category) => {
            setActiveCategory(category);
            fileInputRef.current?.click();
          }}
          internalPreviews={internalPreviews}
          externalPreviews={externalPreviews}
          onRemoveFile={removeFile}
          isUploading={isUploading}
        />

        <BottomNav userRole={userRole} />
      </div>
    </PageTransition>
  );
};

export default EngineerProjects;
