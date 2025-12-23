// src/modules/EngineerDashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import "swiper/css";
import "swiper/css/pagination";

// Components
import BottomNav from "./BottomNav";
import PageTransition from "../components/PageTransition";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

// --- CONSTANTS ---
const ProjectStatus = {
  UnderProcurement: "Under Procurement",
  NotYetStarted: "Not Yet Started",
  Ongoing: "Ongoing",
  ForFinalInspection: "For Final Inspection",
  Completed: "Completed",
};

// --- HELPERS ---
/**
 * Formats a number into a currency string with 1 decimal place.
 * e.g., 2,000,000 -> ₱2.0M
 * e.g., 50,000 -> ₱50.0k
 */
const formatAllocation = (value) => {
  const num = Number(value) || 0;
  if (num >= 1000000) {
    return `₱${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `₱${(num / 1000).toFixed(1)}k`;
  }
  return `₱${num.toLocaleString()}`;
};

// --- SUB-COMPONENTS ---

const DashboardStats = ({ projects }) => {
  const stats = {
    total: projects.length,
    completed: projects.filter((p) => p.status === ProjectStatus.Completed)
      .length,
    ongoing: projects.filter((p) => p.status === ProjectStatus.Ongoing).length,
    delayed: projects.filter((p) => {
      if (p.status === ProjectStatus.Completed) return false;
      if (!p.targetCompletionDate) return false;
      const target = new Date(p.targetCompletionDate);
      const now = new Date();
      return now > target && p.accomplishmentPercentage < 100;
    }).length,
    totalAllocation: projects.reduce(
      (acc, curr) => acc + (Number(curr.projectAllocation) || 0),
      0
    ),
  };

  const data = [
    { name: "Completed", value: stats.completed, color: "#10B981" },
    { name: "Ongoing", value: stats.ongoing, color: "#3B82F6" },
    { name: "Delayed", value: stats.delayed, color: "#EF4444" },
    {
      name: "Others",
      value: stats.total - (stats.completed + stats.ongoing + stats.delayed),
      color: "#94A3B8",
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="mb-6 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
            Allocation
          </p>
          <p className="text-sm font-bold text-[#004A99] mt-1">
            {formatAllocation(stats.totalAllocation)}
          </p>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
            Projects
          </p>
          <p className="text-xl font-bold text-slate-800 mt-1">{stats.total}</p>
        </div>
        <div
          className={`p-3 rounded-xl shadow-sm border flex flex-col justify-center items-center text-center ${
            stats.delayed > 0
              ? "bg-red-50 border-red-100"
              : "bg-white border-slate-200"
          }`}
        >
          <p
            className={`text-[10px] font-bold uppercase tracking-wide ${
              stats.delayed > 0 ? "text-red-500" : "text-slate-500"
            }`}
          >
            Delayed
          </p>
          <div className="flex items-center gap-1 mt-1">
            <p
              className={`text-xl font-bold ${
                stats.delayed > 0 ? "text-red-600" : "text-slate-800"
              }`}
            >
              {stats.delayed}
            </p>
            {stats.delayed > 0 && (
              <span className="text-[10px] animate-pulse">⚠️</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div className="flex flex-col justify-center ml-2">
          <p className="text-xs font-bold text-slate-700 mb-2">
            Project Status Mix
          </p>
          <div className="text-[10px] text-slate-500 space-y-1">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: d.color }}
                ></span>
                <span>
                  {d.name}: {d.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="w-24 h-24 mr-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={18}
                outerRadius={35}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
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
  const navigate = useNavigate();
  const getStatusColor = (status) => {
    switch (status) {
      case ProjectStatus.Completed:
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case ProjectStatus.Ongoing:
        return "bg-blue-100 text-blue-800 border-blue-200";
      case ProjectStatus.UnderProcurement:
        return "bg-amber-100 text-amber-800 border-amber-200";
      case ProjectStatus.ForFinalInspection:
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-slate-100 text-slate-800";
    }
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

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow border border-slate-200 h-[450px] flex items-center justify-center flex-col">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
        <p className="text-xs text-slate-400">Loading projects...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow border border-slate-200 h-[200px] flex items-center justify-center flex-col p-6 text-center">
        <p className="text-2xl mb-2">📂</p>
        <p className="text-sm font-bold text-slate-700">No Projects Found</p>
        <p className="text-xs text-slate-500">
          Tap "+ New Project" to add your first entry.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow border border-slate-200 flex flex-col h-[450px] overflow-hidden">
      <div className="overflow-auto flex-1 relative">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm text-[10px] uppercase font-semibold text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 z-30 p-2 border-b border-r border-slate-200 min-w-[130px]">
                Project Info
              </th>
              <th className="p-2 border-b border-slate-200 min-w-[100px]">
                Status
              </th>
              <th className="p-2 border-b border-slate-200 min-w-[90px]">
                Timeline
              </th>
              <th className="sticky right-0 bg-slate-50 z-30 p-2 border-b border-l border-slate-200 min-w-[80px] text-center">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {projects.map((project) => {
              const isLocked = project.status === ProjectStatus.Completed;

              return (
                <tr
                  key={project.id}
                  className="hover:bg-slate-50 transition-colors group"
                >
                  <td className="sticky left-0 bg-white group-hover:bg-slate-50 z-10 p-2 border-r border-slate-200 align-top">
                    <div className="font-bold text-[#004A99] mb-1 line-clamp-2 leading-tight">
                      {project.schoolName}
                    </div>
                    <div className="text-[9px] text-slate-500 mb-1 line-clamp-1">
                      {project.projectName}
                    </div>
                    <div className="text-[9px] font-mono bg-slate-100 inline-block px-1 rounded text-slate-500">
                      ID: {project.schoolId}
                    </div>
                  </td>

                  <td className="p-2 align-top">
                    <div className="mb-2">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${getStatusColor(
                          project.status
                        )}`}
                      >
                        {project.status === "Not Yet Started"
                          ? "Not Started"
                          : project.status}
                      </span>
                    </div>

                    {project.status === ProjectStatus.Ongoing ||
                    project.status === ProjectStatus.Completed ? (
                      <>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                          <div
                            className={`h-1.5 rounded-full ${
                              project.accomplishmentPercentage === 100
                                ? "bg-emerald-500"
                                : "bg-blue-600"
                            }`}
                            style={{
                              width: `${project.accomplishmentPercentage}%`,
                            }}
                          ></div>
                        </div>
                        <div className="text-[9px] text-right mt-0.5 font-mono text-slate-500">
                          {project.accomplishmentPercentage || 0}%
                        </div>
                      </>
                    ) : (
                      <div className="text-[9px] text-slate-400 mt-2 italic opacity-60">
                        {project.status === ProjectStatus.ForFinalInspection
                          ? "Project Physical Completion"
                          : "-- No Progress --"}
                      </div>
                    )}
                  </td>

                  <td className="p-2 align-top text-[10px]">
                    <div className="mb-1">
                      <span className="text-slate-400 block text-[9px] uppercase">
                        Target
                      </span>
                      <span className="font-medium whitespace-nowrap">
                        {formatDateShort(project.targetCompletionDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">
                        Budget
                      </span>
                      <span className="font-mono text-[#004A99]">
                        {formatAllocation(project.projectAllocation)}
                      </span>
                    </div>
                  </td>

                  <td className="sticky right-0 bg-white group-hover:bg-slate-50 z-10 p-2 border-l border-slate-200 align-top text-center flex flex-col gap-1.5">
                    <button
                      onClick={() => onView(project)}
                      className="w-full px-1 py-1 bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-bold rounded hover:bg-slate-200 transition"
                    >
                      VIEW
                    </button>
            <button 
    onClick={() => navigate(`/project-gallery/${project.id}`)} // Use .id here
    className="w-full px-1 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold rounded hover:bg-amber-100 transition"
>
    GALLERY
</button>
                    <button
                      onClick={() => onEdit(project)}
                      disabled={isLocked}
                      className={`w-full px-1 py-1 text-[9px] font-bold rounded transition ${
                        isLocked
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                          : "bg-[#004A99] text-white hover:bg-blue-800"
                      }`}
                    >
                      {isLocked ? "LOCKED" : "UPDATE"}
                    </button>
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


const EditProjectModal = ({ project, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    if (project) setFormData({ ...project });
  }, [project]);

  if (!isOpen || !formData) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      let newData = { ...prev, [name]: value };
      if (name === "accomplishmentPercentage") {
        const percent = parseFloat(value);
        if (percent === 100) {
          if (prev.status !== ProjectStatus.Completed)
            newData.status = ProjectStatus.ForFinalInspection;
        } else if (percent >= 1 && percent < 100) {
          if (
            prev.status === ProjectStatus.Completed ||
            prev.status === ProjectStatus.ForFinalInspection
          )
            newData.status = ProjectStatus.Ongoing;
        } else if (percent === 0) newData.status = ProjectStatus.NotYetStarted;
      }
      if (name === "status") {
        if (
          value === ProjectStatus.NotYetStarted ||
          value === ProjectStatus.UnderProcurement
        )
          newData.accomplishmentPercentage = 0;
        else if (
          value === ProjectStatus.Completed ||
          value === ProjectStatus.ForFinalInspection
        )
          newData.accomplishmentPercentage = 100;
      }
      return newData;
    });
  };

  const isDisabledPercentageInput =
    formData.status === ProjectStatus.NotYetStarted ||
    formData.status === ProjectStatus.UnderProcurement ||
    formData.status === ProjectStatus.Completed ||
    formData.status === ProjectStatus.ForFinalInspection;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-2xl animate-slide-up">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-800">Update Project</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
              >
                {Object.values(ProjectStatus).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Accomplishment (%)
              </label>
              <input
                type="number"
                name="accomplishmentPercentage"
                value={formData.accomplishmentPercentage}
                onChange={handleChange}
                min="0"
                max="100"
                disabled={isDisabledPercentageInput}
                className={`w-full p-2 border border-slate-300 rounded-lg text-sm font-bold ${
                  isDisabledPercentageInput
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "text-[#004A99]"
                }`}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Date As Of
            </label>
            <input
              type="date"
              name="statusAsOfDate"
              value={formData.statusAsOfDate}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Remarks
            </label>
            <textarea
              name="otherRemarks"
              value={formData.otherRemarks || ""}
              onChange={handleChange}
              rows={3}
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-slate-600 font-bold text-sm bg-slate-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(formData);
              onClose();
            }}
            className="flex-1 py-3 text-white font-bold text-sm bg-[#004A99] rounded-xl shadow-lg shadow-blue-900/20"
          >
            Save Updates
          </button>
        </div>
      </div>
    </div>
  );
};

const AIInsightModal = ({
  isOpen,
  onClose,
  projectName,
  analysis,
  isLoading,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl animate-pulse">✨</span>
            <h3 className="font-bold">Gemini Risk Assessment</h3>
          </div>
          <p className="text-purple-100 text-xs truncate">
            Analyzing: {projectName}
          </p>
        </div>
        <div className="p-6 min-h-[200px] flex items-center justify-center">
          {isLoading ? (
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-slate-500 text-sm">
                Consulting Gemini models...
              </p>
            </div>
          ) : (
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
              {analysis}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-full py-4 bg-slate-50 text-slate-600 font-bold text-sm border-t border-slate-100 hover:bg-slate-100"
        >
          Close Analysis
        </button>
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD COMPONENT ---

const EngineerDashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Engineer");
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  // AI Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");

  // --- Image Upload State & Refs ---
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // API Base URL
  const API_BASE = "http://localhost:3000";

  // Fetch User & Projects
  useEffect(() => {
    const fetchUserDataAndProjects = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserName(docSnap.data().firstName);
        }

        try {
          setIsLoading(true);
          const response = await fetch(
            `${API_BASE}/api/projects?engineer_id=${user.uid}`
          );
          if (!response.ok) throw new Error("Failed to fetch projects");
          const data = await response.json();

          const mappedData = data.map((item) => ({
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
          }));
          setProjects(mappedData);
        } catch (err) {
          console.error("Error loading projects:", err);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchUserDataAndProjects();
  }, []);

  // Handlers
  const handleViewProject = (project) =>
    navigate(`/project-details/${project.id}`);
  const handleEditProject = (project) => {
    setSelectedProject(project);
    setEditModalOpen(true);
  };

  const handleSaveProject = async (updatedProject) => {
    const user = auth.currentUser;
    if (!user) return;

    setIsUploading(true); 

    try {
        // Step A: Save the text fields (Status, %, etc.)
        const body = { ...updatedProject, uid: user.uid, modifiedBy: userName };
        const response = await fetch(`${API_BASE}/api/update-project/${updatedProject.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error("Failed to update project data");

        // Step B: Upload any photos picked during this update session
        // This loop is copied from your NewProjects.jsx logic
        if (selectedFiles.length > 0) {
            for (const file of selectedFiles) {
                const reader = new FileReader();
                const base64Promise = new Promise(resolve => {
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });
                const base64Image = await base64Promise;

                await fetch(`${API_BASE}/api/upload-image`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        projectId: updatedProject.id, // Links photo to this project
                        imageData: base64Image,
                        uploadedBy: user.uid,
                    }),
                });
            }
        }

        // Update the local list so the changes appear immediately
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        
        alert("Project updates and photos saved successfully!");
        
        // IMPORTANT: Clear the staging area so the next project update starts fresh
        setSelectedFiles([]); 
        setEditModalOpen(false);
    } catch (err) {
        console.error("Save Error:", err);
        alert("An error occurred while saving.");
    } finally {
        setIsUploading(false);
    }
};
  const handleAnalyzeRisk = (project) => {
    setSelectedProject(project);
    setAiModalOpen(true);
    setAiLoading(true);
    setTimeout(() => {
      setAiAnalysis(
        `RISK ASSESSMENT: HIGH\n\n1. **Delay Risk**: The project is ${
          100 - (project.accomplishmentPercentage || 0)
        }% remaining vs timeline.\n2. **Budget**: Allocation of ${formatAllocation(
          project.projectAllocation
        )} is under review.`
      );
      setAiLoading(false);
    }, 2000);
  };

  // --- handleFileUpload logic ---
const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Filter by size
    const validFiles = files.filter(file => file.size <= 5 * 1024 * 1024);

    // Create Previews (This is the 'Effect' you want)
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
    setPreviews(prev => [...prev, ...newPreviews]); // Add to the visual list
    setShowUploadOptions(false);
    e.target.value = null;
};

// Function to remove a photo if the engineer picked the wrong one
const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
};

  const sliderContent = [
    {
      id: 1,
      title: `Welcome, Engr. ${userName}!`,
      emoji: "👷",
      description:
        "Your dashboard is ready. Track ongoing construction and validate school infrastructure data.",
    },
    {
      id: 2,
      title: "Site Inspection",
      emoji: "🏗️",
      description:
        "Scheduled inspection for Building A is due this Thursday. Please review the checklist.",
    },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-50 font-sans pb-24">
        {/* --- TOP HEADER --- */}
        <div className="relative bg-[#004A99] pt-12 pb-24 px-6 rounded-b-[2.5rem] shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-200 text-xs font-bold tracking-wider uppercase">
                DepEd Infrastructure
              </p>
              <h1 className="text-2xl font-bold text-white mt-1">Dashboard</h1>
              <p className="text-blue-100 mt-1 text-sm">
                Overview of {projects.length} active projects.
              </p>
            </div>
            <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white shadow-inner">
              👷‍♂️
            </div>
          </div>
        </div>

        {/* --- MAIN CONTENT CONTAINER --- */}
        <div className="px-5 -mt-16 relative z-10 space-y-6">
          <DashboardStats projects={projects} />

          <div className="w-full">
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

          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-slate-700 font-bold text-lg">
                Project Monitoring
              </h2>

              <div className="flex gap-2">
                {/*<button
                  onClick={() => navigate("/project-gallery")}
                  className="text-[10px] bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-full font-bold shadow-sm hover:bg-slate-50 transition flex items-center gap-1"
                >
                  <span className="text-sm">🖼️</span> My Gallery
                </button>*/}

                <button
                  onClick={() => navigate("/new-project")}
                  className="text-[10px] bg-[#004A99] text-white px-3 py-1 rounded-full font-medium shadow-sm hover:bg-blue-800 transition flex items-center gap-1"
                >
                  <span className="text-base leading-none">+</span> New Project
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

        {/* --- FLOATING IMAGE UPLOAD SECTION --- */}
       {/* --- NEW FLOATING IMAGE UPLOAD SECTION --- */}
        {editModalOpen && selectedProject && (
          <div className="fixed bottom-28 right-6 z-[100] flex flex-col items-end">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            <input type="file" ref={cameraInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />

{/* --- PHOTO PREVIEW LIST --- */}
{previews.length > 0 && (
    <div className="mb-4 flex flex-col gap-2 items-end max-h-48 overflow-y-auto p-2">
        {previews.map((url, index) => (
            <div key={index} className="relative group animate-slide-in">
                <img 
                    src={url} 
                    alt="preview" 
                    className="w-16 h-16 object-cover rounded-lg border-2 border-white shadow-md"
                />
                <button 
                    onClick={() => removeFile(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                >
                    ✕
                </button>
            </div>
        ))}
    </div>
)}
            {showUploadOptions && (
              <div className="mb-4 flex flex-col gap-3 animate-bounce-in">
                <button 
                  onClick={() => { cameraInputRef.current.click(); setShowUploadOptions(false); }} 
                  className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-full shadow-2xl border border-slate-200 text-slate-700 active:scale-95 transition-transform"
                >
                  <span className="text-xl">📷</span>
                  <span className="text-[10px] font-black uppercase tracking-wider">Take Site Photo</span>
                </button>
                <button 
                  onClick={() => { fileInputRef.current.click(); setShowUploadOptions(false); }} 
                  className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-full shadow-2xl border border-slate-200 text-slate-700 active:scale-95 transition-transform"
                >
                  <span className="text-xl">🖼️</span>
                  <span className="text-[10px] font-black uppercase tracking-wider">Upload Gallery</span>
                </button>
              </div>
            )}

            <button 
              onClick={() => setShowUploadOptions(!showUploadOptions)} 
              disabled={isUploading} 
              className={`${isUploading ? 'bg-slate-400' : 'bg-[#FDB913]'} w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-white transition-all border-4 border-white active:scale-90`}
            >
              {isUploading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-2xl">{showUploadOptions ? '✕' : '📸'}</span>
                  {!showUploadOptions && <span className="text-[8px] font-bold">ADD PHOTO</span>}
                </div>
              )}
            </button>
          </div>
        )}

        {/* --- MODALS --- */}
        <EditProjectModal
          project={selectedProject}
          isOpen={editModalOpen}
          onClose={() => {
             setEditModalOpen(false);
             setShowUploadOptions(false); // Clean up FAB state when closing
          }}
          onSave={handleSaveProject}
        />
        <AIInsightModal
          isOpen={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          projectName={selectedProject?.schoolName}
          analysis={aiAnalysis}
          isLoading={aiLoading}
        />
        <BottomNav userRole="Engineer" />
      </div>
    </PageTransition>
  );
};

export default EngineerDashboard;
