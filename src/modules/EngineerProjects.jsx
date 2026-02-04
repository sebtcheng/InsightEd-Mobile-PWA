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
                        onClick={() => onEdit(p)}
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


const EditProjectModal = ({
  project,
  isOpen,
  onClose,
  onSave,
  onCameraClick,
  onGalleryClick,
  previews,
  onRemoveFile,
  isUploading
}) => {
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    if (project) {
        setFormData({ 
            ...project,
            // Ensure fields exist to control inputs
            latitude: project.latitude || '',
            longitude: project.longitude || ''
        });
    }
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

  const handleUpdatePercentage = (newVal) => {
    const percent = Math.min(100, Math.max(0, Number(newVal)));
    setFormData((prev) => {
      let newData = { ...prev, accomplishmentPercentage: percent };

      if (percent === 100) {
        if (prev.status !== ProjectStatus.Completed)
          newData.status = ProjectStatus.ForFinalInspection;
      } else if (percent >= 1 && percent < 100) {
        if (
          prev.status === ProjectStatus.Completed ||
          prev.status === ProjectStatus.ForFinalInspection
        )
          newData.status = ProjectStatus.Ongoing;
      } else if (percent === 0) {
        newData.status = ProjectStatus.NotYetStarted;
      }
      return newData;
    });
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
        alert("❌ Geolocation is not supported by your browser.");
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude.toFixed(6);
            const long = position.coords.longitude.toFixed(6);
            
            setFormData(prev => ({
                ...prev,
                latitude: lat,
                longitude: long
            }));
            // alert(`✅ Coordinates Captured!\nLat: ${lat}\nLong: ${long}`);
        },
        (error) => {
            console.warn("Geolocation warning:", error);
            let msg = "Unable to retrieve location.";
            if (error.code === 1) msg = "❌ Location permission denied.";
            else if (error.code === 2) msg = "❌ Position unavailable.";
            else if (error.code === 3) msg = "❌ Timeout.";
            alert(msg);
        },
        options
    );
  };

  const handleLocationSelect = (lat, lng) => {
      setFormData(prev => ({
          ...prev,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6)
      }));
  };

  const isDisabledPercentageInput =
    formData.status === ProjectStatus.NotYetStarted ||
    formData.status === ProjectStatus.UnderProcurement ||
    formData.status === ProjectStatus.Completed ||
    formData.status === ProjectStatus.ForFinalInspection;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center z-[1100] p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* --- HEADER --- */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Update Project</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Physical Status Entry</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* --- BODY --- */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Status</label>
              <div className="relative">
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                >
                  {Object.values(ProjectStatus).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <FiSettings className="text-slate-400" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Percentage (%)</label>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => handleUpdatePercentage(Number(formData.accomplishmentPercentage || 0) + 5)} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded hover:bg-blue-100 transition">+5%</button>
                  <button type="button" onClick={() => handleUpdatePercentage(Number(formData.accomplishmentPercentage || 0) + 10)} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded hover:bg-blue-100 transition">+10%</button>
                </div>
              </div>
              <input
                type="number"
                name="accomplishmentPercentage"
                value={formData.accomplishmentPercentage}
                onChange={handleChange}
                min="0"
                max="100"
                disabled={isDisabledPercentageInput}
                className={`w-full p-3 border rounded-2xl text-sm font-black text-center ${isDisabledPercentageInput
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-blue-50 text-[#004A99] border-blue-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  }`}
              />
            </div>
          </div>

          
          {/* --- LOCATION SECTION --- */}
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-3">
             <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-1">
                   <span>📍</span> Project Coordinates
                </label>
                {!formData.latitude && <span className="text-[9px] text-red-500 font-bold animate-pulse">REQUIRED</span>}
             </div>

             <div className="rounded-xl overflow-hidden shadow-sm border border-blue-200">
                <LocationPickerMap 
                    latitude={formData.latitude} 
                    longitude={formData.longitude} 
                    onLocationSelect={handleLocationSelect}
                />
             </div>
             
             <div className="flex gap-3">
                <div className="flex-1">
                   <input 
                      name="latitude" 
                      value={formData.latitude} 
                      readOnly 
                      placeholder="Lat"
                      className="w-full p-2 bg-white text-slate-700 font-mono text-xs border border-blue-200 rounded-lg focus:outline-none" 
                   />
                </div>
                <div className="flex-1">
                   <input 
                      name="longitude" 
                      value={formData.longitude} 
                      readOnly 
                      placeholder="Long"
                      className="w-full p-2 bg-white text-slate-700 font-mono text-xs border border-blue-200 rounded-lg focus:outline-none" 
                   />
                </div>
             </div>

             <button 
                 type="button" 
                 onClick={handleGetLocation}
                 className="w-full py-2 bg-blue-600 text-white font-bold text-[10px] uppercase rounded-lg shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
             >
                 <span>📡</span> {formData.latitude ? 'Refine with GPS' : 'Get Current Location'}
             </button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Date</label>
            <input
              type="date"
              name="statusAsOfDate"
              value={formData.statusAsOfDate}
              onChange={handleChange}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* CHECK: Conditional Actual Completion Date for Completed Status */}
          {formData.status === ProjectStatus.Completed && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actual Completion Date</label>
                {formData.actualCompletionDate && formData.targetCompletionDate && new Date(formData.actualCompletionDate) > new Date(formData.targetCompletionDate) && (
                  <span className="text-[9px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase tracking-widest animate-pulse">
                    ⚠️ Late Completion
                  </span>
                )}
              </div>
              <input
                type="date"
                name="actualCompletionDate"
                value={formData.actualCompletionDate || ""}
                onChange={handleChange}
                className={`w-full p-3 border rounded-2xl text-sm font-bold shadow-sm transition-all outline-none ${formData.actualCompletionDate && formData.targetCompletionDate && new Date(formData.actualCompletionDate) > new Date(formData.targetCompletionDate)
                  ? "bg-red-50 border-red-200 text-red-700 focus:ring-2 focus:ring-red-200"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-2 focus:ring-emerald-200"
                  }`}
              />
              <p className="text-[9px] text-slate-400 ml-1 italic">
                Target was: {formatDateShort(formData.targetCompletionDate)}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Engineering Remarks</label>
            <textarea
              name="otherRemarks"
              value={formData.otherRemarks || ""}
              onChange={handleChange}
              rows={3}
              placeholder="Enter site observations or issues..."
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Site Photos</label>
              <span className="text-[10px] font-bold text-blue-500">{previews?.length || 0} Added</span>
            </div>

            <div className="flex gap-4">
              <button
                onClick={onCameraClick}
                className="flex-1 py-4 bg-white border-2 border-dashed border-slate-200 text-slate-600 rounded-2xl flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:text-blue-500 transition-all active:scale-95"
              >
                <FiCamera size={20} />
                <span className="text-[10px] font-black uppercase tracking-tighter">Snap Photo</span>
              </button>
              <button
                onClick={onGalleryClick}
                className="flex-1 py-4 bg-white border-2 border-dashed border-slate-200 text-slate-600 rounded-2xl flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:text-blue-500 transition-all active:scale-95"
              >
                <FiImage size={20} />
                <span className="text-[10px] font-black uppercase tracking-tighter">Upload Lab</span>
              </button>
            </div>

            {previews && previews.length > 0 && (
              <div className="grid grid-cols-4 gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                {previews.map((url, index) => (
                  <div key={index} className="relative group aspect-square rounded-xl overflow-hidden shadow-sm ring-2 ring-white">
                    <img src={url} alt="preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => onRemoveFile(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- FOOTER --- */}
        <div className="p-6 border-t border-slate-100 flex gap-4 bg-white">
          <button
            onClick={onClose}
            className="flex-1 py-4 text-slate-500 font-black text-xs uppercase tracking-widest bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // VALIDATION
              const requiredFields = [
                  { key: 'statusAsOfDate', label: 'Status Date' },
                  { key: 'accomplishmentPercentage', label: 'Accomplishment %' },
                  { key: 'otherRemarks', label: 'Remarks' }
              ];
              // Add more if needed based on what's editable. 
              // Looking at the form, status, pct, date, remarks, photos are main.
              // We already validate photos and location in handleSaveProject, but doing it here prevents closing the modal prematurely if we were to move logic.
              // However, handleSaveProject in the parent handles the actual saving and has checking logic too.
              // Let's rely on the parent's check for Photos/Location, but check form fields here.
              
              for (const field of requiredFields) {
                   if (formData[field.key] === "" || formData[field.key] === null || formData[field.key] === undefined) {
                       alert(`⚠️ MISSING FIELD\n\nPlease enter the ${field.label}.`);
                       return;
                   }
              }
              onSave(formData);
            }}
            disabled={isUploading}
            className="flex-[2] py-4 text-white font-black text-xs uppercase tracking-widest bg-gradient-to-r from-[#004A99] to-[#003366] rounded-2xl shadow-xl shadow-blue-900/20 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Syncing Data...
              </>
            ) : "Confirm & Save"}
          </button>
        </div>
      </div>
    </div>
  );
};


// --- MAIN PROJECT LIST COMPONENT ---

const EngineerProjects = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Engineer");
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
                    latitude: item.latitude, // Added Latitude
                    longitude: item.longitude // Added Longitude
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
  const handleEditProject = (project) => {
    setSelectedProject(project);
    setPreviews([]); // Clear old previews
    setEditModalOpen(true);
  };

  const handleSaveProject = async (updatedProject) => {
    const user = auth.currentUser;
    if (!user) return;
    
    // CHECK: Mandatory Photo Upload
    if (selectedFiles.length === 0) {
        alert("⚠️ PROOF REQUIRED\n\nAccording to COA requirements, you must attach at least one site photo for every project update.");
        return;
    }

    // CHECK: Mandatory Location
    if (!updatedProject.latitude || !updatedProject.longitude) {
        alert("⚠️ LOCATION REQUIRED\n\nPlease capture the project coordinates (Latitude/Longitude) before saving.");
        return;
    }

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
        if (selectedFiles.length > 0) {
          for (const file of selectedFiles) {
            try {
              const base64Image = await compressImage(file);
              await addEngineerToOutbox({
                url: `${API_BASE}/api/upload-image`,
                method: 'POST',
                body: { projectId: updatedProject.id, imageData: base64Image, uploadedBy: user.uid },
                formName: `Photo: ${updatedProject.schoolName}`
              });
            } catch (err) {
              console.error("Compression failed for file:", file.name, err);
            }
          }
        }
        alert("⚠️ Offline: Changes cached to Sync Center.");
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        setEditModalOpen(false);
        return;
      }
      const response = await fetch(`${API_BASE}/api/update-project/${updatedProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Update failed");
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          try {
            const base64Image = await compressImage(file);
            await fetch(`${API_BASE}/api/upload-image`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: updatedProject.id, imageData: base64Image, uploadedBy: user.uid }),
            });
          } catch (err) {
            console.error("Compression failed for file:", file.name, err);
          }
        }
      }
      setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      alert("Success: Changes synced to database!");
      setSelectedFiles([]);
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

    // CHECK: Limit to 2 photos max
    if (selectedFiles.length + files.length > 2) {
      alert("You can only upload a maximum of 2 photos.");
      return;
    }

    const validFiles = files.filter(file => file.size <= 5 * 1024 * 1024);
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    setSelectedFiles(prev => [...prev, ...validFiles]);
    setPreviews(prev => [...prev, ...newPreviews]);
    e.target.value = null;
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
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
          onClose={() => setEditModalOpen(false)}
          onSave={handleSaveProject}
          onCameraClick={() => cameraInputRef.current?.click()}
          onGalleryClick={() => fileInputRef.current?.click()}
          previews={previews}
          onRemoveFile={removeFile}
          isUploading={isUploading}
        />

        <BottomNav userRole="Engineer" />
      </div>
    </PageTransition>
  );
};

export default EngineerProjects;
