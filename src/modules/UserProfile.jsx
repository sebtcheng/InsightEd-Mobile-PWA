// src/modules/UserProfile.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'; // Added addDoc, collection, serverTimestamp
import BottomNav from './BottomNav';

import PageTransition from '../components/PageTransition';
import { useTheme } from '../context/ThemeContext'; // Import Hook
import { useServiceWorker } from '../context/ServiceWorkerContext'; // Import SW Hook

// Icons
import { FiUser, FiInfo, FiMoon, FiLogOut, FiChevronRight, FiChevronLeft, FiSave, FiEdit3, FiHelpCircle, FiChevronDown, FiChevronUp, FiStar, FiMessageSquare, FiCheckCircle, FiRefreshCw, FiDownloadCloud } from "react-icons/fi";


const FAQ_DATA = [
    {
        question: "How do I sync my data when back online?",
        answer: "The app automatically syncs when it detects an internet connection. If 'Pending Sync' persists, pull down on your dashboard to force a refresh.",
        roles: ['School Head', 'Engineer', 'Admin']
    },
    {
        question: "Why is the 'Submit' button disabled?",
        answer: "Ensure all required fields (marked with *) are filled. Also, check if your geolocation is enabled, as some forms require location tagging.",
        roles: ['School Head', 'Engineer']
    },
    {
        question: "How do I attach photos to a report?",
        answer: "Tap the 'Upload Photo' icon in the form. You can select from your gallery or take a new photo. Please use landscape mode for better visibility.",
        roles: ['Engineer', 'School Head']
    },
    {
        question: "Can I edit a report after submission?",
        answer: "Submitted reports enter a 'Processing' state. You cannot edit them directly. Please contact your Division Office Admin to request changes.",
        roles: ['School Head', 'Engineer']
    },
    {
        question: "Where can I see the status of my funding request?",
        answer: "Navigate to the 'Projects' tab. The status bar (Proposed → Approved → Ongoing) shows the current stage of your request.",
        roles: ['School Head', 'Admin']
    }
];

const UserProfile = () => {
    const navigate = useNavigate();
    const { isDarkMode, toggleTheme } = useTheme();
    const { checkForUpdates, isUpdateAvailable, updateApp } = useServiceWorker();

    // --- STATE MANAGEMENT ---
    const [userData, setUserData] = useState(null);
    const [schoolId, setSchoolId] = useState(null);
    const [iern, setIern] = useState(null);
    const [homeRoute, setHomeRoute] = useState('/');

    // UI State
    const [activeTab, setActiveTab] = useState('settings'); // 'settings', 'profile', 'about', 'faq'
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // Update Check State
    const [checkingForUpdate, setCheckingForUpdate] = useState(false);
    const [showUpdateModal, setShowUpdateModal] = useState(false);

    // FAQ Accordion State
    const [openFaqIndex, setOpenFaqIndex] = useState(null);

    // Form State for Editing (Restricted to specific fields)
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        region: '',
        province: '',
        city: '',
        barangay: ''
    });

    // Feedback State
    const [feedbackRatings, setFeedbackRatings] = useState({
        easeOfUse: 0,
        aesthetics: 0,
        functionality: 0
    });
    const [feedbackComment, setFeedbackComment] = useState('');


    // --- INITIAL FETCH ---
    useEffect(() => {
        const fetchData = async () => {
            const user = auth.currentUser;
            if (user) {
                // 1. Fetch Basic Info from Firebase
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData(data);
                    setHomeRoute(getDashboardPath(data.role));

                    // Initialize form data with existing values
                    setFormData({
                        firstName: data.firstName || '',
                        lastName: data.lastName || '',
                        region: data.region || '',
                        province: data.province || '',
                        city: data.city || '',
                        barangay: data.barangay || ''
                    });
                }

                // 2. Fetch Assigned School from Neon
                try {
                    const response = await fetch(`/api/school-by-user/${user.uid}`);
                    const result = await response.json();
                    if (result.exists) {
                        setSchoolId(result.data.school_id);
                        setIern(result.data.iern);
                    }
                } catch (error) {
                    // console.error("Failed to fetch school ID:", error);
                }
            }
        };
        fetchData();
    }, []);

    // --- HELPERS ---
    const getDashboardPath = (role) => {
        const roleMap = {
            'Engineer': '/engineer-dashboard',
            'School Head': '/schoolhead-dashboard',
            'Human Resource': '/hr-dashboard',
            'Admin': '/admin-dashboard',
        };
        return roleMap[role] || '/';
    };

    const getInitials = (first, last) => {
        return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase();
    };

    // --- HANDLERS ---
    const handleLogout = async () => {
        if (window.confirm("Are you sure you want to log out?")) {
            // 1. Log safely without blocking user (Fire & Forget)
            try {
                fetch('/api/log-activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userUid: auth.currentUser?.uid || 'unknown',
                        userName: userData?.firstName || 'User',
                        role: userData?.role || 'User',
                        actionType: 'LOGOUT',
                        targetEntity: 'System',
                        details: 'User logged out'
                    })
                });
            } catch (e) { console.warn("Logout Log Failed", e); }

            // 2. Perform Logout
            try {
                await auth.signOut();
                localStorage.clear(); // Clear all session data
                navigate('/');
            } catch (error) {
                console.error("Logout Error:", error);
                // Fallback: Force reload to login if firebase fails
                localStorage.clear();
                window.location.href = '/';
            }
        }
    };

    const handleSaveProfile = async () => {
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) return;

            const docRef = doc(db, "users", user.uid);

            // Only update the allowed fields in Firestore
            await updateDoc(docRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                region: formData.region,
                province: formData.province,
                city: formData.city,
                barangay: formData.barangay
            });

            // Update local state to reflect changes immediately without refetching
            setUserData(prev => ({ ...prev, ...formData }));
            setIsEditing(false);
            alert("Profile updated successfully!");
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmitFeedback = async () => {
        if (feedbackRatings.easeOfUse === 0 || feedbackRatings.aesthetics === 0 || feedbackRatings.functionality === 0) {
            alert("Please rate all categories before submitting.");
            return;
        }

        setLoading(true);
        try {
            await addDoc(collection(db, "app_feedback"), {
                userId: auth.currentUser?.uid || 'anonymous',
                userName: userData?.firstName ? `${userData.firstName} ${userData.lastName}` : 'Anonymous',
                role: userData?.role || 'User',
                ratings: feedbackRatings,
                comment: feedbackComment,
                timestamp: serverTimestamp(),
                appVersion: '1.0.1'
            });

            alert("Thank you for your feedback! We appreciate your input.");
            // Reset form and go back
            setFeedbackRatings({ easeOfUse: 0, aesthetics: 0, functionality: 0 });
            setFeedbackComment('');
            setActiveTab('settings');
        } catch (error) {
            console.error("Error submitting feedback:", error);
            alert(`Failed to submit feedback: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckUpdate = async () => {
        setCheckingForUpdate(true);
        // Simulate a small delay for UX so the user sees the "Checking..." state
        setTimeout(async () => {
            const updateFound = await checkForUpdates();
            setCheckingForUpdate(false);

            // Always show the modal - the render function will decide what to show based on isUpdateAvailable
            // If updateFound is true, isUpdateAvailable should eventually become true via context listeners
            setShowUpdateModal(true);
        }, 1500);
    };

    const renderUpdateModal = () => {
        if (!showUpdateModal) return null;

        // Determine content based on whether an update is waiting
        // We use isUpdateAvailable from context which should be true if an update is waiting/installed
        const updateReady = isUpdateAvailable;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-xs shadow-2xl transform transition-all scale-100">
                    <div className="text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${updateReady ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-50 text-[#004A99] dark:bg-blue-900/30 dark:text-blue-300'}`}>
                            {updateReady ? <FiDownloadCloud size={32} /> : <FiCheckCircle size={32} />}
                        </div>

                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                            {updateReady ? "Update Available!" : "You're up to date!"}
                        </h3>

                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 w-full">
                            {updateReady
                                ? "A new version of InsightEd is ready. Reload to apply changes."
                                : "You are currently using the latest version of InsightEd."}
                        </p>

                        {updateReady ? (
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => {
                                        updateApp();
                                        setShowUpdateModal(false);
                                    }}
                                    className="w-full py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg shadow-green-900/20"
                                >
                                    Update Now
                                </button>
                                <button
                                    onClick={() => setShowUpdateModal(false)}
                                    className="w-full py-2.5 bg-transparent text-gray-500 rounded-xl font-medium hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Later
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowUpdateModal(false)}
                                className="w-full py-2.5 bg-[#004A99] text-white rounded-xl font-semibold hover:bg-blue-800 transition-colors"
                            >
                                Awesome!
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };


    // --- SUB-VIEWS RENDERERS ---

    // 1. EDIT PROFILE VIEW
    const renderProfileEdit = () => (
        <div className="p-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-base text-[#004A99] dark:text-blue-300 font-bold m-0">Personal Information</h3>
                    {!isEditing ? (
                        <button onClick={() => setIsEditing(true)} className="p-1 bg-transparent border-0 cursor-pointer">
                            <FiEdit3 size={18} className="text-[#004A99] dark:text-blue-300" />
                        </button>
                    ) : (
                        <button onClick={handleSaveProfile} className="bg-[#004A99] text-white border-0 rounded px-3 py-1.5 cursor-pointer disabled:opacity-50" disabled={loading}>
                            {loading ? "..." : <FiSave size={18} />}
                        </button>
                    )}
                </div>

                {/* --- READ ONLY FIELDS (Cannot be edited) --- */}
                <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl mb-4">
                    <div className="flex justify-between mb-2 text-sm last:mb-0">
                        <span className="text-gray-500 dark:text-gray-300 font-medium">Role</span>
                        <span className="text-gray-800 dark:text-gray-100 font-bold">{userData?.role}</span>
                    </div>
                    <div className="flex justify-between mb-2 text-sm last:mb-0">
                        <span className="text-gray-500 dark:text-gray-300 font-medium">Email</span>
                        <span className="text-gray-800 dark:text-gray-100 font-bold">{userData?.email}</span>
                    </div>
                    <div className="flex justify-between mb-2 text-sm last:mb-0">
                        <span className="text-gray-500 dark:text-gray-300 font-medium">School ID</span>
                        <span className={`font-bold ${schoolId ? 'text-[#004A99] dark:text-blue-300' : 'text-gray-400'}`}>
                            {schoolId || "Not Assigned"}
                        </span>
                    </div>
                    <div className="flex justify-between mb-2 text-sm last:mb-0">
                        <span className="text-gray-500 dark:text-gray-300 font-medium">IERN</span>
                        <span className={`font-bold ${iern ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                            {iern || "Not Generated"}
                        </span>
                    </div>
                </div>

                <div className="h-px bg-gray-100 dark:bg-slate-600 my-5"></div>

                {/* --- EDITABLE FIELDS --- */}

                {/* NAME SECTION */}
                <h4 className="text-xs text-gray-400 uppercase font-bold mt-2.5 mb-2.5">Identity</h4>
                <div className="mb-4">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">First Name</label>
                    <input
                        className={`w-full p-2.5 rounded-lg text-sm outline-none transition-all ${isEditing
                            ? "border border-[#004A99] bg-white dark:bg-slate-800 dark:text-white dark:border-blue-400"
                            : "border border-transparent bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                            }`}
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Last Name</label>
                    <input
                        className={`w-full p-2.5 rounded-lg text-sm outline-none transition-all ${isEditing
                            ? "border border-[#004A99] bg-white dark:bg-slate-800 dark:text-white dark:border-blue-400"
                            : "border border-transparent bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                            }`}
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                    />
                </div>

                <div className="h-px bg-gray-100 dark:bg-slate-600 my-5"></div>

                {/* ADDRESS SECTION */}
                <h4 className="text-xs text-gray-400 uppercase font-bold mt-2.5 mb-2.5">Address</h4>
                <div className="mb-4">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Region</label>
                    <input
                        className={`w-full p-2.5 rounded-lg text-sm outline-none transition-all ${isEditing
                            ? "border border-[#004A99] bg-white dark:bg-slate-800 dark:text-white dark:border-blue-400"
                            : "border border-transparent bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                            }`}
                        name="region"
                        value={formData.region}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Province</label>
                    <input
                        className={`w-full p-2.5 rounded-lg text-sm outline-none transition-all ${isEditing
                            ? "border border-[#004A99] bg-white dark:bg-slate-800 dark:text-white dark:border-blue-400"
                            : "border border-transparent bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                            }`}
                        name="province"
                        value={formData.province}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">City/Municipality</label>
                    <input
                        className={`w-full p-2.5 rounded-lg text-sm outline-none transition-all ${isEditing
                            ? "border border-[#004A99] bg-white dark:bg-slate-800 dark:text-white dark:border-blue-400"
                            : "border border-transparent bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                            }`}
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Barangay</label>
                    <input
                        className={`w-full p-2.5 rounded-lg text-sm outline-none transition-all ${isEditing
                            ? "border border-[#004A99] bg-white dark:bg-slate-800 dark:text-white dark:border-blue-400"
                            : "border border-transparent bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                            }`}
                        name="barangay"
                        value={formData.barangay}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                    />
                </div>
            </div>
        </div>
    );

    // 2. ABOUT VIEW
    const renderAbout = () => (
        <div className="p-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm text-center">
                {/* Placeholder Logo / Brand */}
                <div className="w-[60px] h-[60px] bg-[#004A99] rounded-2xl mx-auto mb-4 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    IE
                </div>
                <h2 className="text-[#004A99] dark:text-blue-300 mb-1.5 text-xl font-bold">InsightEd</h2>
                <p className="text-gray-400 dark:text-gray-500 text-xs text-center">Version 1.0.0 (Beta)</p>

                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed my-5 text-left">
                    <strong>InsightEd</strong> is a comprehensive monitoring and management tool designed for the Department of Education.
                    It bridges the gap between School Heads, Engineers, HR, and Admin by providing real-time data on school infrastructure, resources, and personnel.
                </p>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4 text-left">
                    Our mission is to empower decision-makers with accurate, on-the-ground data to ensure safer and more conducive learning environments for students.
                </p>

                <div className="h-px bg-gray-100 dark:bg-slate-600 my-5"></div>
                <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest">
                    © 2024 InsightEd Development Team. <br />All rights reserved.
                </p>
            </div>
        </div>
    );

    // 4. FAQ VIEW (NEW)
    const renderFAQ = () => {
        const userRole = userData?.role || 'User';
        const filteredQuestions = FAQ_DATA.filter(q => q.roles.includes(userRole));

        return (
            <div className="p-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-slate-700 pb-4">
                        <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/40 flex items-center justify-center text-orange-500 dark:text-orange-400">
                            <FiHelpCircle size={20} />
                        </div>
                        <div>
                            <h3 className="text-base text-gray-800 dark:text-white font-bold m-0">Help Center</h3>
                            <p className="text-xs text-gray-400 dark:text-gray-500 m-0">Showing FAQs for {userRole}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {filteredQuestions.map((item, idx) => {
                            const isOpen = openFaqIndex === idx;
                            return (
                                <div key={idx} className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden transition-all">
                                    <button
                                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                                        className={`w-full p-4 flex justify-between items-center bg-transparent border-0 cursor-pointer text-left transition-colors ${isOpen ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                    >
                                        <span className={`text-sm font-semibold ${isOpen ? 'text-orange-700 dark:text-orange-300' : 'text-gray-700 dark:text-gray-200'}`}>
                                            {item.question}
                                        </span>
                                        {isOpen ? <FiChevronUp className="text-orange-500" /> : <FiChevronDown className="text-gray-400" />}
                                    </button>

                                    {isOpen && (
                                        <div className="p-4 pt-2 bg-orange-50/50 dark:bg-slate-800/50 text-sm text-gray-600 dark:text-gray-300 leading-relaxed animate-in fade-in duration-200">
                                            {item.answer}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredQuestions.length === 0 && (
                            <p className="text-center text-gray-400 text-sm py-8">No specific questions found for your role.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // 5. FEEDBACK VIEW (NEW)
    const renderFeedback = () => {
        const categories = [
            { id: 'easeOfUse', label: 'Ease of Use' },
            { id: 'aesthetics', label: 'Aesthetics / Design' },
            { id: 'functionality', label: 'Functionality' }
        ];

        return (
            <div className="p-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-pink-50 dark:bg-pink-900/30 rounded-full flex items-center justify-center text-pink-500 mx-auto mb-3">
                            <FiStar size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Rate Our App</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Your feedback helps us improve.</p>
                    </div>

                    <div className="space-y-6 mb-6">
                        {categories.map((cat) => (
                            <div key={cat.id} className="text-center">
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">{cat.label}</label>
                                <div className="flex justify-center gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setFeedbackRatings(prev => ({ ...prev, [cat.id]: star }))}
                                            className="bg-transparent border-0 cursor-pointer focus:outline-none transition-transform active:scale-90 hover:scale-110"
                                        >
                                            <FiStar
                                                size={28}
                                                className={`transition-colors duration-200 ${star <= feedbackRatings[cat.id]
                                                    ? 'fill-amber-400 text-amber-400'
                                                    : 'text-slate-200 dark:text-slate-600'
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Comments & Suggestions</label>
                        <textarea
                            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                            rows="4"
                            placeholder="Tell us what you like or what needs improvement..."
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleSubmitFeedback}
                        disabled={loading}
                        className="w-full py-3 bg-[#004A99] hover:bg-blue-800 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-70 flex justify-center items-center gap-2"
                    >
                        {loading ? 'Submitting...' : (
                            <>
                                <FiMessageSquare /> Submit Feedback
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    };


    // 3. MAIN SETTINGS MENU
    const renderSettingsMenu = () => (
        <div className="p-5">
            {/* User Mini Summary */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl flex items-center mb-6 shadow-sm transition-colors border border-transparent dark:border-slate-700">
                <div className="w-12 h-12 bg-[#004A99] text-white rounded-full flex justify-center items-center text-xl font-bold mr-4 shrink-0 shadow-md">
                    {userData ? getInitials(userData.firstName, userData.lastName) : "..."}
                </div>
                <div className="flex flex-col">
                    <h3 className="m-0 text-base font-bold text-gray-800 dark:text-white">
                        {userData ? `${userData.firstName} ${userData.lastName}` : "Loading..."}
                    </h3>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{userData?.role || "User"}</span>
                        {iern && (
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter mt-0.5">
                                IERN: {iern}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <div className="bg-white dark:bg-slate-800 rounded-xl py-2 mb-5 shadow-sm overflow-hidden transition-colors border border-transparent dark:border-slate-700">
                <h4 className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5 px-5 pt-3 font-bold">Account</h4>
                <button className="w-full flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => setActiveTab('profile')}>
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-blue-50 dark:bg-blue-900/30 text-[#004A99] dark:text-blue-300">
                            <FiUser size={20} />
                        </div>
                        <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200">My Profile</span>
                    </div>
                    <FiChevronRight size={20} className="text-gray-300 dark:text-gray-500" />
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl py-2 mb-5 shadow-sm overflow-hidden transition-colors border border-transparent dark:border-slate-700">
                <h4 className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5 px-5 pt-3 font-bold">General</h4>

                {/* Dark Mode Toggle */}
                <div className="w-full flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700 bg-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            <FiMoon size={20} />
                        </div>
                        <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200">Dark Mode</span>
                    </div>
                    {/* Toggle Switch UI */}
                    <div
                        onClick={toggleTheme}
                        className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors duration-300 ${isDarkMode ? 'bg-[#004A99] dark:bg-blue-600' : 'bg-gray-300'}`}
                    >
                        <div className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[3px] transition-all duration-300 shadow-sm ${isDarkMode ? 'left-[23px]' : 'left-[3px]'}`} />
                    </div>
                </div>

                {/* Check for Updates */}
                <button
                    disabled={checkingForUpdate}
                    onClick={isUpdateAvailable ? updateApp : handleCheckUpdate}
                    className="w-full flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-9 h-9 rounded-lg flex justify-center items-center ${isUpdateAvailable ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300'}`}>
                            {checkingForUpdate ? (
                                <FiRefreshCw size={20} className="animate-spin" />
                            ) : isUpdateAvailable ? (
                                <FiDownloadCloud size={20} />
                            ) : (
                                <FiRefreshCw size={20} />
                            )}
                        </div>
                        <div className="text-left">
                            <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200 block">
                                {isUpdateAvailable ? "Update Available" : "Check for Updates"}
                            </span>
                            {isUpdateAvailable && (
                                <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold uppercase tracking-wide">
                                    Tap to Install
                                </span>
                            )}
                        </div>
                    </div>
                    {checkingForUpdate ? (
                        <span className="text-xs text-gray-400">Checking...</span>
                    ) : (
                        <FiChevronRight size={20} className="text-gray-300 dark:text-gray-500" />
                    )}
                </button>

                {/* FAQ Menu Item */}
                <button className="w-full flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => setActiveTab('faq')}>
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300">
                            <FiHelpCircle size={20} />
                        </div>
                        <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200">FAQ & Help</span>
                    </div>
                    <FiChevronRight size={20} className="text-gray-300 dark:text-gray-500" />
                </button>

                <button className="w-full flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => setActiveTab('feedback')}>
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300">
                            <FiStar size={20} />
                        </div>
                        <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200">Rate & Feedback</span>
                    </div>
                    <FiChevronRight size={20} className="text-gray-300 dark:text-gray-500" />
                </button>

                <button className="w-full flex justify-between items-center px-5 py-4 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => setActiveTab('about')}>
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300">
                            <FiInfo size={20} />
                        </div>
                        <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200">About InsightEd</span>
                    </div>
                    <FiChevronRight size={20} className="text-gray-300 dark:text-gray-500" />
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl py-2 mb-5 shadow-sm overflow-hidden border border-transparent dark:border-slate-700">
                <button className="w-full flex justify-between items-center px-5 py-4 bg-transparent cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" onClick={handleLogout}>
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg flex justify-center items-center bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            <FiLogOut size={20} />
                        </div>
                        <span className="text-[15px] font-bold text-red-600 dark:text-red-400">Logout</span>
                    </div>
                </button>
            </div>

            <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-8">InsightEd Mobile app v1.0.2</p>
        </div>
    );

    // --- MAIN RENDER ---
    return (
        <PageTransition>
            <div className={`min-h-screen font-sans pb-20 transition-colors duration-300 ${isDarkMode ? 'bg-[#1a202c]' : 'bg-[#f5f7fa]'}`}>

                {/* DYNAMIC HEADER */}
                <div className="bg-gradient-to-br from-[#004A99] to-[#003366] dark:from-slate-900 dark:to-slate-800 p-5 h-20 flex items-center justify-between text-white rounded-b-3xl shadow-lg transition-all duration-300">
                    {activeTab !== 'settings' && (
                        <button className="bg-transparent border-0 text-white cursor-pointer flex items-center" onClick={() => {
                            setActiveTab('settings');
                            setIsEditing(false); // Reset edit mode on back
                        }}>
                            <FiChevronLeft size={24} />
                        </button>
                    )}
                    <h2 className="m-0 text-lg font-semibold flex-1 text-center">
                        {activeTab === 'settings' ? 'Settings' :
                            activeTab === 'profile' ? 'Edit Profile' :
                                activeTab === 'faq' ? 'FAQ' : 'About'}
                    </h2>
                    {/* Spacer to balance header if back button exists */}
                    {activeTab !== 'settings' && <div className="w-6"></div>}
                </div>

                {/* CONTENT AREA */}
                <div className="">
                    {activeTab === 'settings' && renderSettingsMenu()}
                    {activeTab === 'profile' && renderProfileEdit()}
                    {activeTab === 'faq' && renderFAQ()}
                    {activeTab === 'feedback' && renderFeedback()}
                    {activeTab === 'about' && renderAbout()}

                    {renderUpdateModal()}

                </div>

                <BottomNav homeRoute={homeRoute} userRole={userData?.role} />
            </div>
        </PageTransition>
    );
};

// --- STYLING (Converting to classes for easier dark mode maintenance) ---
// Note: I have replaced inline styles with Tailwind classes in the render methods above
// for better maintainability and cleaner code.

export default UserProfile;