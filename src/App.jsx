import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

// ... (lines 3-118 remain same, but I can't express that in one chunk easily if imports are at top and usage at bottom. I'll use 2 chunks)

import { AnimatePresence } from 'framer-motion'; // <--- IMPORT THIS
import MaintenanceScreen from './components/MaintenanceScreen'; // <--- IMPORT MAINTENANCE SCREEN
import SuperUserFloatingSwitch from './components/SuperUserFloatingSwitch'; // Super User Switch
import { useState, useEffect } from 'react'; // Ensure React hooks are imported

// Auth
import Login from './Login';
import Register from './Register';

// Dashboards
import EngineerDashboard from './modules/EngineerDashboard';
import EngineerProjects from './modules/EngineerProjects';

// import LguDashboard from './modules/lgu'; // Import LguDashboard
// import LguProjects from './modules/LguProjects';
import SchoolHeadDashboard from './modules/SchoolHeadDashboard';
import HRDashboard from './modules/HRDashboard';
import AdminDashboard from './modules/AdminDashboard';
import MonitoringDashboard from './modules/MonitoringDashboard';
import SchoolManagement from './modules/SchoolManagement';
import DummyDashboard from './modules/DummyDashboard';
import SchoolJurisdictionList from './modules/SchoolJurisdictionList';
import SchoolAuditView from './modules/SchoolAuditView';
import UserProfile from './modules/UserProfile';
import Activity from './modules/Activity';
import ProjectGallery from './modules/ProjectGallery';
import Outbox from './modules/Outbox';
import EngineerOutbox from './modules/EngineerOutbox';
import SuperAdminDashboard from './modules/SuperAdminDashboard';
import SuperUserSelector from './modules/SuperUserSelector';
import FinanceDashboard from './modules/FinanceDashboard'; // Import FinanceDashboard
import LguDashboard from './modules/LguDashboard'; // Import LguDashboard
import LguForms from './modules/LguForms'; // Import newly created LguForms
import LguProjectDetails from './modules/LguProjectDetails'; // Import LguProjectDetails
import PSIP from './modules/PSIP'; // Import PSIP
import ProtectedRoute from './components/ProtectedRoute'; // Import ProtectedRoute


// Forms
import SchoolForms from './modules/SchoolForms';
import EngineerForms from './modules/EngineerForms';

// Form Imports (School Head)
import SchoolProfile from './forms/SchoolProfile';
import SchoolInformation from './forms/SchoolInformation';
import Enrolement from './forms/Enrolment';
import OrganizedClasses from './forms/OrganizedClasses';
import TeachingPersonnel from './forms/TeachingPersonnel';
import ShiftingModalities from './forms/ShiftingModalities';
import SchoolResources from './forms/SchoolResources';
import TeacherSpecialization from './forms/TeacherSpecialization';
import PhysicalFacilities from './forms/PhysicalFacilities';
import LearnerStatistics from './forms/LearnerStatistics';

// Form Imports (Division Engineer)
import EngineerSchoolResources from './forms/EngineerSchoolResources';
import DamageAssessment from './forms/DamageAssessment';
import ProjectMonitoring from './forms/ProjectMonitoring';
import SiteInspection from './forms/SiteInspection';
import MaterialInventory from './forms/MaterialInventory';
import NewProjects from './modules/NewProjects';
import DetailedProjInfo from './modules/DetailedProjInfo';
import ProjectValidation from './modules/ProjectValidation';
import Leaderboard from './modules/Leaderboard';

// --- WRAPPER COMPONENT TO HANDLE LOCATION ---
const AnimatedRoutes = () => {
  const location = useLocation();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);

  // Check Maintenance Status on Route Change
  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await fetch('/api/settings/maintenance_mode');
        const data = await res.json();
        setMaintenanceMode(data.value === 'true');
      } catch (err) {
        console.error("Maintenance Check Failed:", err);
      } finally {
        setCheckingMaintenance(false);
      }
    };
    checkMaintenance();
  }, [location.pathname]); // Re-check on nav

  if (checkingMaintenance) return null; // Or a mini loader

  const role = localStorage.getItem('userRole');
  const isProtected = location.pathname !== '/' && location.pathname !== '/register';
  const isAdmin = role === 'Admin' || role === 'Super Admin';

  // if (maintenanceMode && isProtected && !isAdmin) {
  //   return <MaintenanceScreen />;
  // }

  return (
    // 'mode="wait"' ensures the old page leaves before the new one enters
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Authentication */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Dashboards */}
        <Route path="/engineer-dashboard" element={<EngineerDashboard />} />
        {/* <Route path="/lgu" element={<LguDashboard />} /> */}
        {/* <Route path="/lgu-form" element={<LguForm />} /> */}
        {/* <Route path="/lgu-projects" element={<LguProjects />} /> */}
        <Route path="/engineer-projects" element={<EngineerProjects />} />
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="/finance-dashboard" element={<FinanceDashboard />} />
        <Route path="/lgu-dashboard" element={<LguDashboard />} />
        <Route path="/lgu-form" element={<LguForms />} /> {/* Mapped to LguForms */}
        <Route path="/lgu-project-details/:id" element={<LguProjectDetails />} />

        {/* Super User Selector (Protected) */}
        <Route
          path="/super-user-selector"
          element={
            <ProtectedRoute allowedRoles={['Super User']}>
              <SuperUserSelector />
            </ProtectedRoute>
          }
        />

        <Route path="/schoolhead-dashboard" element={<SchoolHeadDashboard />} />
        <Route path="/hr-dashboard" element={<HRDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/monitoring-dashboard" element={<MonitoringDashboard />} />
        <Route path="/school-management" element={<SchoolManagement />} />
        <Route path="/jurisdiction-schools" element={<SchoolJurisdictionList />} />
        <Route path="/school-audit" element={<SchoolAuditView />} />
        <Route path="/dummy-forms" element={<DummyDashboard />} />

        <Route path="/dummy-forms" element={<DummyDashboard />} />
        <Route path="/psip" element={<PSIP />} />

        {/* Menus */}
        <Route path="/school-forms" element={<SchoolForms />} />
        <Route path="/engineer-forms" element={<EngineerForms />} />

        {/* Utilities */}
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/activities" element={<Activity />} />
        <Route path="/outbox" element={<Outbox />} />
        <Route path="/engineer-outbox" element={<EngineerOutbox />} />

        {/* School Head Forms */}
        <Route path="/school-profile" element={<SchoolProfile />} />
        <Route path="/school-information" element={<SchoolInformation />} />
        <Route path="/enrolment" element={<Enrolement />} />
        <Route path="/organized-classes" element={<OrganizedClasses />} />
        <Route path="/teaching-personnel" element={<TeachingPersonnel />} />
        <Route path="/school-resources" element={<SchoolResources />} />
        <Route path="/physical-facilities" element={<PhysicalFacilities />} />
        <Route path="/teacher-specialization" element={<TeacherSpecialization />} />
        <Route path="/shifting-modalities" element={<ShiftingModalities />} />
        <Route path="/learner-statistics" element={<LearnerStatistics />} />
        <Route path="/project-validation" element={<ProjectValidation />} />
        <Route path="/leaderboard" element={<Leaderboard />} />

        {/* Division Engineer Forms */}
        <Route path="/engineer-school-resources" element={<EngineerSchoolResources />} />
        <Route path="/damage-assessment" element={<DamageAssessment />} />
        <Route path="/project-monitoring" element={<ProjectMonitoring />} />
        <Route path="/site-inspection" element={<SiteInspection />} />
        <Route path="/material-inventory" element={<MaterialInventory />} />
        <Route path="/new-project" element={<NewProjects />} />
        <Route path="/project-details/:id" element={<DetailedProjInfo />} />
        <Route path="/project-gallery" element={<ProjectGallery />} />
        <Route path="/project-gallery/:projectId" element={<ProjectGallery />} />
        <Route path="/project-gallery/:projectId" element={<ProjectGallery />} />

        {/* Hidden Admin Login Route */}
        <Route path="/adminlogin" element={<Login />} />
      </Routes>

      {/* MAINTENANCE OVERLAY (Blocks interaction if active) */}
      {/* EXEMPT: Authenticated users (protected routes) and Admin Login */}
      {/* FIX: Only show on Login Page ('/') if not Admin. Logged-in users are effectively exempt by being on other routes. */}
      {maintenanceMode && !isAdmin && location.pathname === '/' && (
        <MaintenanceScreen />
      )}
    </AnimatePresence>
  );
};

import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import ScrollToTop from './components/ScrollToTop';

function App() {
  return (
    <GlobalErrorBoundary>
      <Router>
        <ScrollToTop />
        <SuperUserFloatingSwitch />
        <AnimatedRoutes />
      </Router>
    </GlobalErrorBoundary>
  );
}

export default App;