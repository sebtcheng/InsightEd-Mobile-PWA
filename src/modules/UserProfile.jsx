// src/modules/UserProfile.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase'; 
import { doc, getDoc, updateDoc } from 'firebase/firestore'; // Added updateDoc
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition'; 

// Icons
import { FiUser, FiInfo, FiMoon, FiLogOut, FiChevronRight, FiChevronLeft, FiSave, FiEdit3 } from "react-icons/fi";

const UserProfile = () => {
    const navigate = useNavigate();
    
    // --- STATE MANAGEMENT ---
    const [userData, setUserData] = useState(null);
    const [schoolId, setSchoolId] = useState(null);
    const [homeRoute, setHomeRoute] = useState('/');
    
    // UI State
    const [activeTab, setActiveTab] = useState('settings'); // 'settings', 'profile', 'about'
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State for Editing (Restricted to specific fields)
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        region: '',
        province: '',
        city: '',
        barangay: ''
    });

    // --- INITIAL FETCH ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
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
                    // Fetch extended user info from Firestore (Users collection)
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        setUserData(userDoc.data());
                    } else {
                        // Fallback to Auth data if Firestore doc isn't found
                        setUserData({
                            firstName: user.displayName?.split(' ')[0] || 'User',
                            lastName: user.displayName?.split(' ')[1] || '',
                            email: user.email,
                            role: 'School Head'
                        });
                    }
                } catch (error) {
                    console.error("Error fetching profile:", error);
                }
            } else {
                navigate('/login');
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
    try {
        await signOut(auth);
        localStorage.clear();
        sessionStorage.clear();
        // Use window.location.href to force a full browser reload to the login page
        // This clears any "stuck" React states that cause white screens
        window.location.href = '/login'; 
    } catch (error) {
        console.error("Logout Error:", error);
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

    // --- SUB-VIEWS RENDERERS ---

    // 1. EDIT PROFILE VIEW
    const renderProfileEdit = () => (
        <div style={styles.subPageContainer}>
            <div style={styles.card}>
                <div style={styles.cardHeader}>
                    <h3 style={styles.sectionTitle}>Personal Information</h3>
                    {!isEditing ? (
                        <button onClick={() => setIsEditing(true)} style={styles.iconButton}>
                            <FiEdit3 size={18} color="#004A99" />
                        </button>
                    ) : (
                        <button onClick={handleSaveProfile} style={styles.saveButton} disabled={loading}>
                            {loading ? "..." : <FiSave size={18} />}
                        </button>
                    )}
                </div>
            </div>

                {/* --- READ ONLY FIELDS (Cannot be edited) --- */}
                <div style={styles.readOnlyGroup}>
                    <div style={styles.row}>
                        <span style={styles.label}>Role</span>
                        <span style={styles.readOnlyValue}>{userData?.role}</span>
                    </div>
                    <div style={styles.row}>
                        <span style={styles.label}>Email</span>
                        <span style={styles.readOnlyValue}>{userData?.email}</span>
                    </div>
                    <div style={styles.row}>
                        <span style={styles.label}>School ID</span>
                        <span style={{...styles.readOnlyValue, color: schoolId ? '#004A99' : '#999'}}>
                            {schoolId || "Not Assigned"}
                        </span>
                    </div>
                </div>

                <div style={styles.divider}></div>

                {/* --- EDITABLE FIELDS --- */}
                
                {/* NAME SECTION */}
                <h4 style={styles.subTitle}>Identity</h4>
                <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>First Name</label>
                    <input 
                        style={isEditing ? styles.input : styles.inputDisabled}
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                    />
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>Last Name</label>
                    <input 
                        style={isEditing ? styles.input : styles.inputDisabled}
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                    />
                </div>

                <div style={styles.divider}></div>
                
                {/* ADDRESS SECTION */}
                <h4 style={styles.subTitle}>Address</h4>
                <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>Region</label>
                    <input 
                        style={isEditing ? styles.input : styles.inputDisabled}
                        name="region"
                        value={formData.region}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                    />
                </div>
                 <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>Province</label>
                    <input 
                        style={isEditing ? styles.input : styles.inputDisabled}
                        name="province"
                        value={formData.province}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                    />
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>City/Municipality</label>
                    <input 
                        style={isEditing ? styles.input : styles.inputDisabled}
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                    />
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>Barangay</label>
                    <input 
                        style={isEditing ? styles.input : styles.inputDisabled}
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
        <div style={styles.subPageContainer}>
            <div style={styles.card}>
                <div style={{textAlign: 'center', marginBottom: '20px'}}>
                     {/* Placeholder Logo / Brand */}
                    <div style={{width: '60px', height: '60px', background: '#004A99', borderRadius: '15px', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '24px'}}>
                        IE
                    </div>
                    <h2 style={{color: '#004A99', marginBottom: '5px'}}>InsightEd</h2>
                    <p style={{color: '#888', fontSize: '12px'}}>Version 1.0.0 (Beta)</p>
                </div>
                
                <p style={styles.paragraph}>
                    <strong>InsightEd</strong> is a comprehensive monitoring and management tool designed for the Department of Education. 
                    It bridges the gap between School Heads, Engineers, HR, and Admin by providing real-time data on school infrastructure, resources, and personnel.
                </p>
                <p style={styles.paragraph}>
                    Our mission is to empower decision-makers with accurate, on-the-ground data to ensure safer and more conducive learning environments for students.
                </p>

                <div style={styles.divider}></div>
                <p style={{textAlign: 'center', fontSize: '11px', color: '#aaa'}}>
                    © 2024 InsightEd Development Team. <br/>All rights reserved.
                </p>
            </div>
        </div>
    );

    // 3. MAIN SETTINGS MENU
    const renderSettingsMenu = () => (
        <div style={styles.menuContainer}>
            {/* User Mini Summary */}
            <div style={styles.miniProfile}>
                <div style={styles.miniAvatar}>
                    {userData ? getInitials(userData.firstName, userData.lastName) : "..."}
                </div>
                <div style={styles.miniDetails}>
                    <h3 style={styles.miniName}>
                        {userData ? `${userData.firstName} ${userData.lastName}` : "Loading..."}
                    </h3>
                    <span style={styles.miniRole}>{userData?.role || "User"}</span>
                </div>
            </div>

            {/* Menu Items */}
            <div style={styles.menuGroup}>
                <h4 style={styles.groupTitle}>Account</h4>
                <button style={styles.menuItem} onClick={() => setActiveTab('profile')}>
                    <div style={styles.menuItemLeft}>
                        <div style={{...styles.iconBox, background: '#E3F2FD', color: '#004A99'}}>
                            <FiUser size={20} />
                        </div>
                        <span style={styles.menuText}>My Profile</span>
                    </div>
                    <FiChevronRight size={20} color="#ccc" />
                </button>
            </div>

            <div style={styles.menuGroup}>
                <h4 style={styles.groupTitle}>General</h4>
                
                {/* Dark Mode Toggle */}
                <div style={styles.menuItem}>
                    <div style={styles.menuItemLeft}>
                        <div style={{...styles.iconBox, background: '#F3E5F5', color: '#7B1FA2'}}>
                            <FiMoon size={20} />
                        </div>
                        <span style={styles.menuText}>Dark Mode</span>
                    </div>
                    {/* Toggle Switch UI */}
                    <div 
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        style={{
                            width: '44px', height: '24px', 
                            background: isDarkMode ? '#004A99' : '#e0e0e0', 
                            borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s'
                        }}
                    >
                        <div style={{
                            width: '18px', height: '18px', background: 'white', borderRadius: '50%',
                            position: 'absolute', top: '3px', 
                            left: isDarkMode ? '23px' : '3px', 
                            transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                    </div>
                </div>

                <button style={styles.menuItem} onClick={() => setActiveTab('about')}>
                    <div style={styles.menuItemLeft}>
                        <div style={{...styles.iconBox, background: '#FFF3E0', color: '#E65100'}}>
                            <FiInfo size={20} />
                        </div>
                        <span style={styles.menuText}>About InsightEd</span>
                    </div>
                    <FiChevronRight size={20} color="#ccc" />
                </button>
            </div>

            <div style={styles.menuGroup}>
                <button style={{...styles.menuItem, color: '#D32F2F'}} onClick={handleLogout}>
                    <div style={styles.menuItemLeft}>
                        <div style={{...styles.iconBox, background: '#FFEBEE', color: '#D32F2F'}}>
                            <FiLogOut size={20} />
                        </div>
                        <span style={{...styles.menuText, color: '#D32F2F', fontWeight: '600'}}>Logout</span>
                    </div>
                </button>
            </div>
        </div>
    );

    // --- MAIN RENDER ---
    return (
        <PageTransition>
            <div style={{...styles.container, backgroundColor: isDarkMode ? '#1a202c' : '#f5f7fa'}}>
                
                {/* DYNAMIC HEADER */}
                <div style={styles.header}>
                    {activeTab !== 'settings' && (
                        <button style={styles.backButton} onClick={() => {
                            setActiveTab('settings');
                            setIsEditing(false); // Reset edit mode on back
                        }}>
                            <FiChevronLeft size={24} />
                        </button>
                    )}
                    <h2 style={styles.headerTitle}>
                        {activeTab === 'settings' ? 'Settings' : 
                         activeTab === 'profile' ? 'Edit Profile' : 'About'}
                    </h2>
                    {/* Spacer to balance header if back button exists */}
                    {activeTab !== 'settings' && <div style={{width: '24px'}}></div>}
                </div>

                {/* CONTENT AREA */}
                <div style={styles.content}>
                    {activeTab === 'settings' && renderSettingsMenu()}
                    {activeTab === 'profile' && renderProfileEdit()}
                    {activeTab === 'about' && renderAbout()}
                </div>

                <BottomNav homeRoute={homeRoute} userRole={userData?.role} />
            </div>

// --- STYLING ---
const styles = {
    container: { minHeight: '100vh', paddingBottom: '80px', fontFamily: 'Poppins, sans-serif', transition: 'background-color 0.3s' },
    header: { 
        background: 'linear-gradient(135deg, #004A99 0%, #003366 100%)', 
        padding: '20px', 
        height: '80px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        color: 'white', 
        borderBottomLeftRadius: '20px', 
        borderBottomRightRadius: '20px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)' 
    },
    headerTitle: { margin: 0, fontSize: '20px', fontWeight: '600', flex: 1, textAlign: 'center' },
    backButton: { background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    
    // Menu Styles
    menuContainer: { padding: '20px' },
    miniProfile: { 
        backgroundColor: 'white', padding: '15px', borderRadius: '15px', 
        display: 'flex', alignItems: 'center', marginBottom: '25px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    },
    miniAvatar: { 
        width: '50px', height: '50px', backgroundColor: '#004A99', color: 'white', 
        borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', 
        fontSize: '20px', fontWeight: 'bold', marginRight: '15px' 
    },
    miniDetails: { display: 'flex', flexDirection: 'column' },
    miniName: { margin: 0, fontSize: '16px', fontWeight: '600', color: '#333' },
    miniRole: { fontSize: '12px', color: '#666' },

    groupTitle: { fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '10px', paddingLeft: '5px', fontWeight: '700' },
    menuGroup: { backgroundColor: 'white', borderRadius: '15px', padding: '5px 0', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' },
    menuItem: { 
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '15px 20px', border: 'none', background: 'white', cursor: 'pointer',
        borderBottom: '1px solid #f0f0f0'
    },
    menuItemLeft: { display: 'flex', alignItems: 'center', gap: '15px' },
    iconBox: { width: '36px', height: '36px', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' },
    menuText: { fontSize: '15px', fontWeight: '500', color: '#333' },

    // Sub-Page Styles
    subPageContainer: { padding: '20px' },
    card: { backgroundColor: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    sectionTitle: { fontSize: '16px', color: '#004A99', fontWeight: '700', margin: 0 },
    subTitle: { fontSize: '12px', color: '#888', textTransform: 'uppercase', fontWeight: '700', marginTop: '10px', marginBottom: '10px' },
    iconButton: { background: 'none', border: 'none', cursor: 'pointer', padding: '5px' },
    saveButton: { background: '#004A99', color: 'white', border: 'none', borderRadius: '5px', padding: '5px 10px', cursor: 'pointer' },
    
    // Read Only Section
    readOnlyGroup: { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '10px', marginBottom: '15px' },
    row: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' },
    label: { color: '#666', fontWeight: '500' },
    readOnlyValue: { color: '#333', fontWeight: '600' },
    
    divider: { height: '1px', backgroundColor: '#eee', margin: '20px 0' },
    paragraph: { fontSize: '14px', color: '#555', lineHeight: '1.6', marginBottom: '15px' },

    // Forms
    inputGroup: { marginBottom: '15px' },
    inputLabel: { display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' },
    input: { 
        width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #004A99', 
        fontSize: '14px', outline: 'none', transition: '0.3s', backgroundColor: '#fff' 
    },
    inputDisabled: { 
        width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid transparent', 
        fontSize: '14px', backgroundColor: '#f5f5f5', color: '#555'
    }
};

export default UserProfile;