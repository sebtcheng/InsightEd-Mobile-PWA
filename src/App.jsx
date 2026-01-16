import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion'; // <--- IMPORT THIS

// Auth
import Login from './Login';
import Register from './Register';

// Dashboards
import EngineerDashboard from './modules/EngineerDashboard';
import EngineerProjects from './modules/EngineerProjects';
import SchoolHeadDashboard from './modules/SchoolHeadDashboard';
import HRDashboard from './modules/HRDashboard';
import AdminDashboard from './modules/AdminDashboard';
import MonitoringDashboard from './modules/MonitoringDashboard';
import SchoolJurisdictionList from './modules/SchoolJurisdictionList';
import UserProfile from './modules/UserProfile';
import Activity from './modules/Activity';
import ProjectGallery from './modules/ProjectGallery';
import Outbox from './modules/Outbox';
import EngineerOutbox from './modules/EngineerOutbox';

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

// Form Imports (Engineer)
import EngineerSchoolResources from './forms/EngineerSchoolResources';
import DamageAssessment from './forms/DamageAssessment';
import ProjectMonitoring from './forms/ProjectMonitoring';
import SiteInspection from './forms/SiteInspection';
import MaterialInventory from './forms/MaterialInventory';
import NewProjects from './modules/NewProjects';
import DetailedProjInfo from './modules/DetailedProjInfo';
import ProjectValidation from './modules/ProjectValidation';

// --- WRAPPER COMPONENT TO HANDLE LOCATION ---
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    // 'mode="wait"' ensures the old page leaves before the new one enters
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Authentication */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Dashboards */}
        <Route path="/engineer-dashboard" element={<EngineerDashboard />} />
        <Route path="/engineer-projects" element={<EngineerProjects />} />
        <Route path="/schoolhead-dashboard" element={<SchoolHeadDashboard />} />
        <Route path="/hr-dashboard" element={<HRDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/monitoring-dashboard" element={<MonitoringDashboard />} />
        <Route path="/jurisdiction-schools" element={<SchoolJurisdictionList />} />

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
        <Route path="/teacher-specialization" element={<TeacherSpecialization />} />
        <Route path="/shifting-modality" element={<ShiftingModalities />} />
        <Route path="/project-validation" element={<ProjectValidation />} />

        {/* Engineer Forms */}
        <Route path="/engineer-school-resources" element={<EngineerSchoolResources />} />
        <Route path="/damage-assessment" element={<DamageAssessment />} />
        <Route path="/project-monitoring" element={<ProjectMonitoring />} />
        <Route path="/site-inspection" element={<SiteInspection />} />
        <Route path="/material-inventory" element={<MaterialInventory />} />
        <Route path="/new-project" element={<NewProjects />} />
        <Route path="/project-details/:id" element={<DetailedProjInfo />} />
        <Route path="/project-gallery" element={<ProjectGallery />} />
        <Route path="/project-gallery/:projectId" element={<ProjectGallery />} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}

export default App;