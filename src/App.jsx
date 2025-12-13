import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Auth
import Login from './Login';
import Register from './Register';

// Dashboards
import EngineerDashboard from './modules/EngineerDashboard'; 
import SchoolHeadDashboard from './modules/SchoolHeadDashboard';
import HRDashboard from './modules/HRDashboard';
import AdminDashboard from './modules/AdminDashboard'; 
import UserProfile from './modules/UserProfile'; 
import Activity from './modules/Activity';    

// Forms Menus
import SchoolForms from './modules/SchoolForms';
import EngineerForms from './modules/EngineerForms'; 

// --- FORMS IMPORTS ---

// 1. School Head Forms
import SchoolProfile from './forms/SchoolProfile';
import SchoolInformation from './forms/SchoolInformation';
import Enrolement from './forms/Enrolment';
import OrganizedClasses from './forms/OrganizedClasses';
import TeachingPersonnel from './forms/TeachingPersonnel';
import SchoolInfrastructure from './forms/SchoolInfrastructure';
import TeacherSpecialization from './forms/TeacherSpecialization';

// 2. Engineer Forms (Updated Names & New Files)
import EngineerSchoolInfrastructure from './forms/EngineerSchoolInfrastructure'; // <--- Renamed
import EngineerSchoolResources from './forms/EngineerSchoolResources';           // <--- Renamed
import DamageAssessment from './forms/DamageAssessment';
import ProjectMonitoring from './forms/ProjectMonitoring';
import SiteInspection from './forms/SiteInspection';
import MaterialInventory from './forms/MaterialInventory';import NewProjects from './modules/NewProjects';
import DetailedProjInfo from './modules/DetailedProjInfo'; // <--- NEW IMPORT HERE


function App() {
  return (
    <Router>
      <Routes>
        {/* Authentication */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Dashboards */}
        <Route path="/engineer-dashboard" element={<EngineerDashboard />} />
        <Route path="/schoolhead-dashboard" element={<SchoolHeadDashboard />} />
        <Route path="/hr-dashboard" element={<HRDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        
        {/* Form Menus */}
        <Route path="/school-forms" element={<SchoolForms />} />
        <Route path="/engineer-forms" element={<EngineerForms />} />
        
        {/* User Utilities */}
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/activities" element={<Activity />} />
          
        {/* --- INDIVIDUAL FORM ROUTES --- */}
        
        {/* School Head Specific */}
        <Route path="/school-profile" element={<SchoolProfile />} />
        <Route path="/school-information" element={<SchoolInformation />} />
        <Route path="/enrolment" element={<Enrolement />} />
        <Route path="/organized-classes" element={<OrganizedClasses />} />
        <Route path="/teaching-personnel" element={<TeachingPersonnel />} />
        <Route path="/teacher-specialization" element={<TeacherSpecialization />} />

        {/* Engineer Specific (Updated) */}
        <Route path="/school-infrastructure" element={<EngineerSchoolInfrastructure />} />
        <Route path="/school-resources" element={<EngineerSchoolResources />} />
        <Route path="/damage-assessment" element={<DamageAssessment />} />
        <Route path="/project-monitoring" element={<ProjectMonitoring />} />
        <Route path="/site-inspection" element={<SiteInspection />} />
        <Route path="/material-inventory" element={<MaterialInventory />} />
        <Route path="/new-project" element={<NewProjects />} /> 
        <Route path="/project-details/:id" element={<DetailedProjInfo />} /> 

      </Routes>
    </Router>
  );
}

export default App;