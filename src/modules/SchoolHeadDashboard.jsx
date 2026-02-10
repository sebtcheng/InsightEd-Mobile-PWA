// src/modules/SchoolHeadDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

// Icons (Using the libraries you already have installed)
import { TbSearch, TbX, TbChevronRight, TbSchool, TbUsers, TbBooks, TbActivity, TbBell, TbTrophy, TbReportAnalytics } from "react-icons/tb";
import { LuLayoutDashboard, LuFileCheck, LuHistory } from "react-icons/lu";
import { FiUser, FiBox, FiLayers, FiAlertCircle, FiAlertTriangle, FiCheckSquare } from "react-icons/fi";

import { auth, db, app } from '../firebase'; // Import app
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";
import { getMessaging, getToken, onMessage } from "firebase/messaging"; // Import Messaging

import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import NotificationCenter from '../components/NotificationCenter';
import { useServiceWorker } from '../context/ServiceWorkerContext'; // Import Context

const SchoolHeadDashboard = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('School Head');
    const [schoolProfile, setSchoolProfile] = useState(null);
    const [headProfile, setHeadProfile] = useState(null);

    // Service Worker Update Context
    const { isUpdateAvailable, updateApp } = useServiceWorker();

    // Stats State
    const [stats, setStats] = useState({
        completedForms: 0,
        totalForms: 10,
        enrollment: 0,
        teachers: 0
    });

    // --- SEARCH STATE ---
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);



    // --- DEADLINE STATE ---
    const [deadlineDate, setDeadlineDate] = useState(null);
    const [showBanner, setShowBanner] = useState(true);
    const [showDeadlineAlert, setShowDeadlineAlert] = useState(false);

    // --- VALIDATION MODAL STATE ---
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [validationTimer, setValidationTimer] = useState(30);
    const [canValidate, setCanValidate] = useState(false);

    useEffect(() => {
        let timer;
        if (showValidationModal && validationTimer > 0) {
            timer = setInterval(() => {
                setValidationTimer((prev) => prev - 1);
            }, 1000);
        } else if (validationTimer === 0) {
            setCanValidate(true);
        }
        return () => clearInterval(timer);
    }, [showValidationModal, validationTimer]);

    const handleOpenValidation = () => {
        setShowValidationModal(true);
        setValidationTimer(30); // Reset timer
        setCanValidate(false);
    };

    const handleConfirmValidation = async () => {
        if (!auth.currentUser || !schoolProfile) return;

        try {
            const response = await fetch('/api/school/validate-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    schoolId: schoolProfile.school_id,
                    uid: auth.currentUser.uid
                })
            });

            const data = await response.json();
            if (data.success) {
                setShowValidationModal(false);
                // Optimistically update UI
                setSchoolProfile(prev => ({ ...prev, school_head_validation: true }));
                // Reuse notification logic or simple alert
                alert("Data validated successfully. Thank you for your affirmation.");
            } else {
                alert("Validation failed: " + data.message);
            }
        } catch (error) {
            console.error("Validation Error:", error);
            alert("An error occurred during validation.");
        }
    };

    // --- SEARCH & QUICK ACTION ITEMS (10 FORMS) ---
    const SEARCHABLE_ITEMS = [
        // IDENTITY
        { name: "School Profile", route: "/school-profile", icon: TbSchool, color: "bg-blue-100 text-blue-600" },
        { name: "School Head Info", route: "/school-information", icon: FiUser, color: "bg-indigo-100 text-indigo-600" },

        // LEARNERS
        { name: "Enrollment", route: "/enrolment", icon: TbUsers, color: "bg-orange-100 text-orange-600" },
        { name: "Organized Classes", route: "/organized-classes", icon: FiLayers, color: "bg-purple-100 text-purple-600" },
        { name: "Learner Statistics", route: "/learner-statistics", icon: TbActivity, color: "bg-pink-100 text-pink-600" },
        { name: "Shifting & Modality", route: "/shifting-modalities", icon: TbReportAnalytics, color: "bg-cyan-100 text-cyan-600" },

        // FACULTY
        { name: "Teaching Personnel", route: "/teaching-personnel", icon: FiUser, color: "bg-teal-100 text-teal-600" },
        { name: "Specialization", route: "/teacher-specialization", icon: FiLayers, color: "bg-lime-100 text-lime-600" },

        // ASSETS
        { name: "School Resources", route: "/school-resources", icon: FiBox, color: "bg-emerald-100 text-emerald-600" },
        { name: "Physical Facilities", route: "/physical-facilities", icon: FiLayers, color: "bg-amber-100 text-amber-600" },
    ];

    // Reuse SEARCHABLE_ITEMS for search logic to keep them in sync
    const ALL_ITEMS = SEARCHABLE_ITEMS;

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (query.trim() === '') {
            setSearchResults([]);
            return;
        }

        const filtered = ALL_ITEMS.filter(item =>
            item.name.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(filtered);
    };

    // ... [Keep your useEffects for Stats/Auth exactly as they were] ...
    const [completedItems, setCompletedItems] = useState([]);

    useEffect(() => {
        if (!schoolProfile) return;

        // Use values directly from DB (calculated by backend)
        const dbCompleted = schoolProfile.forms_completed_count || 0;
        const dbTotal = 10; // Fixed total

        setStats(prev => ({
            ...prev,
            completedForms: dbCompleted,
            totalForms: dbTotal,
            enrollment: schoolProfile.total_enrollment || 0
        }));

        // construct completedItems list based on f1-f10 flags for UI highligthing if needed
        // (Optional: You can keep the list logic if you use it for highlighting specific buttons, 
        //  but for the progress bar, we MUST use the DB value)
        const completedList = [];
        if (schoolProfile.f1_profile) completedList.push("School Profile");
        if (schoolProfile.f2_head) completedList.push("School Head Info");
        if (schoolProfile.f3_enrollment) completedList.push("Enrollment");
        if (schoolProfile.f4_classes) completedList.push("Organized Classes");
        if (schoolProfile.f5_teachers) completedList.push("Teaching Personnel");
        if (schoolProfile.f6_specialization) completedList.push("Specialization");
        if (schoolProfile.f7_resources) completedList.push("School Resources");
        if (schoolProfile.f8_facilities) completedList.push("Physical Facilities");
        if (schoolProfile.f9_shifting) completedList.push("Shifting & Modality");
        if (schoolProfile.f10_stats) completedList.push("Learner Statistics");

        setCompletedItems(completedList);

    }, [schoolProfile]);

    const [searchParams] = useSearchParams(); // Get query params
    const impersonatedUid = searchParams.get('uid');

    useEffect(() => {
        // Fetch Deadline
        fetch('/api/settings/enrolment_deadline')
            .then(res => res.json())
            .then(data => {
                if (data.value) {
                    const dDate = new Date(data.value);
                    setDeadlineDate(dDate);

                    // --- PUSH NOTIFICATION LOGIC ---
                    const now = new Date();
                    const diffTime = dDate - now;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays <= 3) {
                        // TRIGGER MODAL if 0-3 days (inclusive)
                        if (diffDays >= 0) {
                            // Check previous session flag
                            const hasShown = sessionStorage.getItem('deadlineAlertShown');
                            if (!hasShown) {
                                setShowDeadlineAlert(true);
                                sessionStorage.setItem('deadlineAlertShown', 'true');
                            }
                        }

                        // Request permission and show notification
                        if (Notification.permission === "granted") {
                            sendDeadlineNotification(diffDays, dDate);
                        } else if (Notification.permission !== "denied") {
                            Notification.requestPermission().then(permission => {
                                if (permission === "granted") {
                                    sendDeadlineNotification(diffDays, dDate);
                                }
                            });
                        }
                    }
                }
            })
            .catch(err => console.error("Failed to fetch deadline:", err));

        const sendDeadlineNotification = (daysLeft, dateObj) => {
            let title = "";
            let body = "";

            if (daysLeft < 0) {
                title = "Submission Overdue!";
                body = `The enrolment deadline was ${dateObj.toLocaleDateString()}. Submissions may be closed.`;
            } else if (daysLeft === 0) {
                title = "Deadline is Today!";
                body = "Please complete your enrolment forms by the end of the day.";
            } else {
                title = `Deadline Approaching: ${daysLeft} Days Left`;
                body = `Don't forget to submit your reports by ${dateObj.toLocaleDateString()}.`;
            }

            try {
                new Notification(title, {
                    body: body,
                    icon: '/pwa-192x192.png', // Fallback to standard pwa icon
                    tag: 'deadline-alert' // Prevent duplicate notifications stacking
                });
            } catch (e) {
                console.warn("Notification trigger failed", e);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setUserName(userData.firstName);

                        let targetUid = user.uid;
                        // Impersonation Logic
                        if (userData.role === 'Super User' && impersonatedUid) {
                            targetUid = impersonatedUid;
                            setUserName(`Super User (Viewing: ${targetUid.slice(0, 5)}...)`); // Optional: indicate view mode
                        }

                        const profileRes = await fetch(`/api/school-by-user/${targetUid}`);
                        const profileJson = await profileRes.json();
                        if (profileJson.exists) {
                            setSchoolProfile(profileJson.data);

                        }

                        const headRes = await fetch(`/api/school-head/${targetUid}`);
                        const headJson = await headRes.json();
                        if (headJson.exists) setHeadProfile(headJson.data);

                        // --- FCM TOKEN REGISTRATION (ROBUST) ---
                        try {
                            const messaging = getMessaging(app);
                            const permission = await Notification.requestPermission();

                            if (permission === 'granted') {
                                // Ensure Service Worker is ready (Required for Mobile PWA)
                                let swRegistration = await navigator.serviceWorker.getRegistration();
                                if (!swRegistration) {
                                    swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                                }

                                const currentToken = await getToken(messaging, {
                                    vapidKey: 'BDuZsrGgFnp6Iwm6dVXxVGeppwi40LyNw48VdVOizotxUZ45BGlGHogswLUq82Q3G8UjhnUit-yW8z3dYISorcQ',
                                    serviceWorkerRegistration: swRegistration
                                });

                                if (currentToken) {
                                    console.log("📲 FCM Token Generated:", currentToken.slice(0, 10) + "...");
                                    // SAVE TO SERVER
                                    await fetch('/api/save-token', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ uid: user.uid, token: currentToken })
                                    });
                                    console.log("✅ FCM Token Sent to Server");
                                    // Debug removed for production clarity
                                } else {
                                    console.warn("⚠️ No registration token available. Request permission to generate one.");
                                }
                            } else {
                                // Permission not granted, do nothing or log
                            }
                        } catch (msgErr) {
                            console.log("ℹ️ FCM Token Logic Error:", msgErr);
                        }

                        // --- FOREGROUND LISTENER ---
                        // Triggers if notification arrives while app is OPEN
                        onMessage(messaging, (payload) => {
                            console.log('🔔 Foreground Message:', payload);
                            const { title, body } = payload.notification;

                            // You can replace this with a nice custom toast/modal
                            // For now, simpler is better to prove it works
                            new Notification(title, { body, icon: '/pwa-192x192.png' });
                        });
                    }

                } catch (error) {
                    console.error("Dashboard Load Error:", error);
                }
                setTimeout(() => setLoading(false), 800);
            } else {
                // Not authenticated, redirect to login
                navigate('/');
            }
        });
        return () => unsubscribe();
    }, [impersonatedUid]); // Re-run if query param changes

    const { completedForms, totalForms } = stats;
    // Prefer DB percentage if available to ensure consistency
    const progress = schoolProfile?.completion_percentage ?? (totalForms > 0 ? Math.round((completedForms / totalForms) * 100) : 0);

    return (
        <>
            <PageTransition>
                <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-28 relative">

                    {/* --- HEADER SECTION --- */}
                    <div className="relative bg-[#004A99] pt-14 pb-20 px-6 rounded-b-[3rem] shadow-2xl z-0 overflow-hidden">
                        {impersonatedUid && (
                            <div className="absolute top-6 right-6 z-50">
                                <button
                                    onClick={() => navigate('/super-admin')}
                                    className="px-3 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg text-xs font-bold text-white transition"
                                >
                                    ← Back to Hub
                                </button>
                            </div>
                        )}
                        {/* Background Decorative Circles */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>

                        <div className="relative flex justify-between items-start z-10">
                            <div>
                                <div className="inline-flex items-center gap-2 bg-blue-800/50 px-3 py-1 rounded-full border border-blue-400/20 backdrop-blur-sm mb-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                    <p className="text-blue-100 text-[10px] font-bold tracking-wider uppercase">
                                        {(headProfile?.head_first_name || headProfile?.first_name) ? 'School Head' : userName}
                                    </p>
                                </div>
                                <h1 className="text-3xl font-bold text-white tracking-tight">
                                    {(headProfile?.head_first_name || headProfile?.first_name) || (schoolProfile ? schoolProfile.school_id : '---')}
                                </h1>
                                <p className="text-blue-200 text-sm mt-1 opacity-90">
                                    {(headProfile?.head_first_name || headProfile?.first_name) && schoolProfile
                                        ? `${schoolProfile.school_id} • ${schoolProfile.school_name}`
                                        : (schoolProfile ? schoolProfile.school_name : 'School Principal')}
                                </p>
                                {schoolProfile?.iern && (
                                    <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/30 rounded-md px-2 py-0.5">
                                        <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">IERN</span>
                                        <span className="text-xs font-bold text-white tracking-wide">{schoolProfile.iern}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <NotificationCenter />
                                <button onClick={() => navigate('/leaderboard')} className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white shadow-lg hover:bg-white/20 transition-all active:scale-95 group">
                                    <TbTrophy size={20} className="text-yellow-300 group-hover:scale-110 transition-transform" />
                                </button>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="mt-8 relative z-50">
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1 flex items-center shadow-lg transition-all focus-within:bg-white/20 focus-within:border-white/40">
                                <div className="pl-4 pr-3 text-blue-200">
                                    <TbSearch size={20} />
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={handleSearch}
                                    placeholder="Find a form or report..."
                                    className="bg-transparent border-none text-white text-sm w-full placeholder-blue-200/60 focus:outline-none py-3"
                                />
                                {searchQuery && (
                                    <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="pr-4 text-blue-200 hover:text-white transition-colors">
                                        <TbX size={18} />
                                    </button>
                                )}
                            </div>

                            {/* Search Dropdown */}
                            {searchQuery && (
                                <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[60] animate-in fade-in zoom-in-95 duration-200">
                                    {searchResults.length > 0 ? (
                                        <ul className="max-h-60 overflow-y-auto dark:bg-slate-800">
                                            {searchResults.map((item, idx) => (
                                                <li key={idx}>
                                                    <button
                                                        onClick={() => navigate(item.route)}
                                                        className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between group border-b border-slate-50 dark:border-slate-700 last:border-none"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-[#004A99] dark:text-blue-400 flex items-center justify-center">
                                                                <LuFileCheck size={16} />
                                                            </div>
                                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-[#004A99] dark:group-hover:text-blue-400 transition-colors">{item.name}</span>
                                                        </div>
                                                        <TbChevronRight size={16} className="text-slate-300 dark:text-slate-500 group-hover:text-[#004A99] dark:group-hover:text-blue-400 transition-colors" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs italic dark:bg-slate-800">
                                            No forms found matching "{searchQuery}"
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- DASHBOARD CONTENT --- */}
                    <div className="px-6 -mt-12 relative z-10 space-y-8">

                        {/* --- DATA QUALITY ALERT (FROM SCHOOL_SUMMARY) --- */}
                        {/* Show if Health is NOT Excellent, BUT hide if School Head has already manually validated it. */}
                        {(schoolProfile?.data_health_description && schoolProfile?.data_health_description !== 'Excellent' && !schoolProfile?.school_head_validation) && (
                            <div className={`relative w-full p-4 rounded-2xl border flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-top-4 mb-4 ${schoolProfile.data_health_description === 'Critical'
                                ? 'bg-red-100 border-red-200 text-red-800'
                                : schoolProfile.data_health_description === 'Fair'
                                    ? 'bg-amber-100 border-amber-200 text-amber-800'
                                    : 'bg-blue-100 border-blue-200 text-blue-800'
                                }`}>
                                <div className="p-2 bg-white/50 rounded-full shrink-0">
                                    <FiAlertTriangle className={`animate-pulse ${schoolProfile.data_health_description === 'Critical' ? 'text-red-600' :
                                        schoolProfile.data_health_description === 'Fair' ? 'text-amber-600' :
                                            'text-blue-600'
                                        }`} size={20} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm flex items-center gap-2">
                                        {schoolProfile.data_health_description === 'Critical' ? 'Critical Data Quality Issues' :
                                            schoolProfile.data_health_description === 'Fair' ? 'Data Quality Issues Need Attention' :
                                                'Minor Data Quality Issues Detected'}
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${schoolProfile.data_health_description === 'Critical' ? 'bg-red-200 text-red-800' :
                                            schoolProfile.data_health_description === 'Fair' ? 'bg-amber-200 text-amber-800' :
                                                'bg-blue-200 text-blue-800'
                                            }`}>
                                            {schoolProfile.data_health_description === 'Critical' ? 'Action Needed' : 'Please Review'}
                                        </span>
                                    </h4>
                                    <p className="text-xs opacity-90 leading-relaxed mt-1 mb-2">
                                        Our system detected the following data quality issues:
                                    </p>
                                    {schoolProfile.data_quality_issues && schoolProfile.data_quality_issues !== 'None' && (
                                        <div className="bg-white/60 rounded-lg p-3 text-xs font-semibold border border-opacity-50 mb-2">
                                            {schoolProfile.data_quality_issues}
                                        </div>
                                    )}
                                    {/* Note Removed from here */}

                                    <div className="mt-2 p-2 bg-white/50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Data Health Score:</span>
                                            <span className={`text-sm font-black ${schoolProfile.data_health_score <= 50 ? 'text-red-700' :
                                                schoolProfile.data_health_score <= 85 ? 'text-amber-700' :
                                                    'text-green-700'
                                                }`}>
                                                {schoolProfile.data_health_score}
                                            </span>
                                        </div>
                                        <p className="text-xs font-medium leading-snug">
                                            {schoolProfile.data_health_score <= 50
                                                ? "Major data anomaly/inconsistency detected. Requires major data overhaul"
                                                : schoolProfile.data_health_score <= 85
                                                    ? "Minor inconsistencies found. Please review flagged items."
                                                    : "Data is accurate and consistent."}
                                        </p>
                                        <div className="flex justify-end mt-2">
                                            <span className="text-[10px] opacity-75 italic text-right">
                                                Note: Data Health Score computation may take several minutes to refresh due to volume of updates. Please check back again in a few moments.
                                            </span>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- DEADLINE BANNER (THE WAGAYWAY) --- */}
                        {deadlineDate && showBanner && (() => {
                            const now = new Date();
                            const diffTime = deadlineDate - now;
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            let bannerStyle = "bg-blue-100 border-blue-200 text-blue-800";
                            let icon = <TbActivity className="animate-pulse" />;
                            let title = "Submission Deadline";
                            let message = `Enrolment submission is due on ${deadlineDate.toLocaleDateString()}.`;

                            if (diffDays < 0) {
                                // OVERDUE
                                bannerStyle = "bg-red-100 border-red-200 text-red-800";
                                icon = <FiAlertCircle className="text-red-600 animate-bounce" />;
                                title = "Submission Overdue";
                                message = `The deadline was ${deadlineDate.toLocaleDateString()}. Submissions may be locked.`;
                            } else if (diffDays <= 3) {
                                // CRITICAL
                                bannerStyle = "bg-amber-100 border-amber-200 text-amber-800";
                                icon = <FiAlertCircle className="text-amber-600 animate-pulse" />;
                                title = `Action Required: ${diffDays === 0 ? 'Due Today' : `${diffDays} Days Left`}`;
                                message = `Please complete your forms before ${deadlineDate.toLocaleDateString()}.`;
                            }

                            return (
                                <div className={`relative w-full p-4 rounded-2xl border flex items-start gap-3 shadow-lg ${bannerStyle} animate-in fade-in slide-in-from-top-4`}>
                                    <div className="p-2 bg-white/50 rounded-full shrink-0">
                                        {icon}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-sm">{title}</h4>
                                        <p className="text-xs opacity-90 leading-relaxed mt-0.5">{message}</p>
                                    </div>
                                    <button
                                        onClick={() => setShowBanner(false)}
                                        className="p-1 hover:bg-black/5 rounded-full transition"
                                    >
                                        <TbX size={16} />
                                    </button>
                                </div>
                            );
                        })()}

                        {/* --- NEW UPDATE MODAL --- */}
                        {isUpdateAvailable && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-5 relative overflow-hidden border border-emerald-200 dark:border-emerald-900/40">
                                    {/* Glowing Background Effect */}
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>

                                    <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto text-emerald-500 mb-2 shadow-sm animate-pulse">
                                        <FiCheckSquare size={36} />
                                    </div>

                                    <div className="text-center space-y-2">
                                        <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">
                                            Update Available
                                        </h2>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                            A new version of the app is ready. <br />Please reload to apply the latest changes.
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => updateApp()}
                                        className="w-full py-3.5 bg-[#004A99] hover:bg-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:shadow-xl hover:scale-[1.02] transition-all active:scale-95"
                                    >
                                        Reload Now
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 1. Quick Stats Row */}
                        <div className="grid grid-cols-3 gap-3">
                            {/* Progress Card */}
                            <div className="col-span-1 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-700 flex flex-col justify-center items-center text-center">
                                <div className="relative w-12 h-12 flex items-center justify-center mb-2">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                        <path className="text-slate-100 dark:text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                        <path className={`${progress === 100 ? 'text-green-500' : 'text-[#004A99] dark:text-blue-400'} transition-all duration-1000 ease-out`} strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                    </svg>
                                    <span className="absolute text-[10px] font-bold text-slate-700 dark:text-slate-200">{progress}%</span>
                                </div>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide">Overall</p>
                            </div>

                            {/* Forms Count */}
                            <div className="col-span-1 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-700 flex flex-col justify-center items-center text-center">
                                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[#004A99] dark:text-blue-400 flex items-center justify-center mb-2">
                                    <LuFileCheck size={20} />
                                </div>
                                <p className="text-xl font-bold text-slate-800 dark:text-white leading-none">{completedForms}<span className="text-slate-300 dark:text-slate-600 text-sm">/{totalForms}</span></p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide mt-1">Forms</p>
                            </div>

                            {/* Learners Highlight */}
                            <div className="col-span-1 bg-gradient-to-br from-[#004A99] to-[#003377] dark:from-blue-600 dark:to-blue-800 p-4 rounded-2xl shadow-xl shadow-blue-900/20 flex flex-col justify-center items-center text-center text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <TbUsers size={40} />
                                </div>
                                <p className="text-2xl font-bold leading-none">{stats.enrollment || 0}</p>
                                <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wide mt-1">Learners</p>
                            </div>
                        </div>

                        {/* 2. Swiper / Highlights */}
                        <div className="w-full">
                            <Swiper
                                modules={[Pagination, Autoplay]}
                                spaceBetween={20}
                                slidesPerView={1}
                                pagination={{ clickable: true, dynamicBullets: true }}
                                autoplay={{ delay: 5000 }}
                                className="w-full rounded-2xl"
                            >
                                <SwiperSlide>
                                    <div
                                        onClick={() => navigate('/school-forms')}
                                        className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border-l-4 border-[#FDB913] min-h-[140px] flex flex-col justify-center relative overflow-hidden cursor-pointer active:scale-[0.98] transition-all hover:shadow-md"
                                    >
                                        <div className="absolute right-[-10px] top-[-10px] opacity-5 dark:opacity-10">
                                            <TbSchool size={100} className="dark:text-white" />
                                        </div>
                                        <h3 className="text-[#004A99] dark:text-blue-400 font-bold text-lg flex items-center mb-2 z-10">
                                            Welcome, Principal!
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-[85%] z-10">
                                            Ensure all school forms are up to date before the division deadline. Tap here to view forms.
                                        </p>
                                    </div>
                                </SwiperSlide>
                                <SwiperSlide>
                                    <div
                                        onClick={() => navigate('/project-validation')}
                                        className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border-l-4 border-green-500 min-h-[140px] flex flex-col justify-center relative overflow-hidden cursor-pointer active:scale-[0.98] transition-all hover:shadow-md"
                                    >
                                        <div className="absolute right-[-10px] top-[-10px] opacity-5 dark:opacity-10">
                                            <FiCheckSquare size={100} className="text-green-500 dark:text-green-400" />
                                        </div>
                                        <h3 className="text-green-600 dark:text-green-400 font-bold text-lg flex items-center mb-2 z-10">
                                            Project Validation
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-[85%] z-10">
                                            Validate completed projects and infrastructure reports. Tap to start validation.
                                        </p>
                                    </div>
                                </SwiperSlide>
                                {/* Add more slides if needed */}
                            </Swiper>
                        </div>

                        {/* 3. Quick Actions Grid (NEW) */}
                        <div>
                            <div className="flex justify-between items-end mb-4 px-1">
                                <h3 className="text-slate-700 dark:text-slate-300 font-bold text-sm uppercase tracking-wider">Pending Forms</h3>
                                <button onClick={() => navigate('/school-forms')} className="text-[#004A99] dark:text-blue-400 text-xs font-semibold">View All</button>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                                {SEARCHABLE_ITEMS.filter(item => !completedItems.includes(item.name)).map((item, index) => (
                                    <button
                                        key={index}
                                        onClick={() => navigate(item.route)}
                                        className="flex flex-col items-center gap-2 group relative z-20 cursor-pointer"
                                    >
                                        <div className={`w-14 h-14 rounded-2xl ${item.color} dark:bg-slate-800 dark:text-blue-400 flex items-center justify-center shadow-sm group-active:scale-95 transition-all border border-transparent dark:border-slate-700 group-hover:border-slate-200 dark:group-hover:border-slate-600`}>
                                            <item.icon size={24} />
                                        </div>
                                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center leading-tight max-w-[60px]">
                                            {item.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 4. Recent Activity Timeline */}
                        {/* <div className="pb-4">
                            <h3 className="text-slate-700 dark:text-slate-300 font-bold text-sm uppercase tracking-wider mb-4 px-1">Recent History</h3>
                            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
                                {schoolProfile?.history_logs && schoolProfile.history_logs.length > 0 ? (
                                    <div className="relative border-l-2 border-slate-100 dark:border-slate-700 ml-2 space-y-6 my-2">
                                        {[...schoolProfile.history_logs].reverse().slice(0, 5).map((log, idx) => (
                                            <div key={idx} className="relative pl-6">
                                                
                                                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-4 border-blue-500"></div>

                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{log.action}</p>
                                                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-full w-fit">
                                                        {new Date(log.timestamp).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    Updated by <span className="text-[#004A99] dark:text-blue-400 font-medium">{userName}</span>
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-8 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 opacity-60">
                                        <LuHistory size={32} className="mb-2" />
                                        <p className="text-xs">No recent activity recorded</p>
                                    </div>
                                )}
                            </div>
                        </div> */}

                    </div>

                </div>
            </PageTransition >

            {
                showDeadlineAlert && deadlineDate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-5 relative overflow-hidden border border-amber-200 dark:border-amber-900/40">
                            {/* Glowing Background Effect */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-red-500"></div>
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl"></div>

                            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-2 shadow-sm animate-pulse">
                                <FiAlertTriangle size={36} />
                            </div>

                            <div className="text-center space-y-2">
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">
                                    ⚠️ Action Required:<br />Deadline Approaching
                                </h2>
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                    The submission deadline for Enrolment Forms is in <strong className="text-amber-600 dark:text-amber-400">{Math.ceil((deadlineDate - new Date()) / (1000 * 60 * 60 * 24))} days</strong> ({deadlineDate.toLocaleDateString()}). <br />Please finalize your data.
                                </p>
                            </div>

                            <button
                                onClick={() => setShowDeadlineAlert(false)}
                                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 hover:shadow-xl hover:scale-[1.02] transition-all active:scale-95"
                            >
                                I Understand
                            </button>
                        </div>
                    </div>
                )
            }

            {/* --- DATA VALIDATION MODAL --- */}
            {showValidationModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6 relative overflow-hidden border border-red-200 dark:border-red-900/40">
                        {/* Header */}
                        <div className="text-center">
                            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto text-red-600 mb-4 shadow-sm">
                                <FiCheckSquare size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                                Affirm Data Accuracy
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Please read the following statement carefully.
                            </p>
                        </div>

                        {/* Statement */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium text-justify">
                            "I affirm that despite the data inconsistencies detected by the system, the data submitted are <strong className="text-slate-900 dark:text-white">TRUE</strong> and <strong className="text-slate-900 dark:text-white">ACCURATE</strong>. I accept full responsibility for the integrity of this report."
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            <button
                                onClick={handleConfirmValidation}
                                disabled={!canValidate}
                                className={`w-full py-3.5 font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2
                                    ${canValidate
                                        ? 'bg-red-600 hover:bg-red-700 text-white hover:shadow-red-600/30 active:scale-[0.98]'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'}`}
                            >
                                {canValidate ? "I Affirm & Validate" : `Please wait ${validationTimer}s...`}
                            </button>

                            <button
                                onClick={() => setShowValidationModal(false)}
                                className="w-full py-3 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-semibold rounded-xl transition-colors"
                            >
                                Go Back / Review Data
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BottomNav userRole="School Head" />


        </>
    );
};

export default SchoolHeadDashboard;