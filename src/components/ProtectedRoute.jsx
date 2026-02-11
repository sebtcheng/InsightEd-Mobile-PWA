import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const role = localStorage.getItem('userRole');

    // If not logged in, redirect to login
    if (!role) {
        return <Navigate to="/" replace />;
    }

    // If role is not allowed, redirect to home (or unauthorized page)
    if (allowedRoles && !allowedRoles.includes(role)) {
        // If super user tries to access normal routes? 
        // Or if normal user tries to access super user route?
        // Fallback to home for now.
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;
