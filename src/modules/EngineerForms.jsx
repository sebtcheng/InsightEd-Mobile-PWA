import React from 'react';
import { useNavigate } from 'react-router-dom';
// --- NEW IMPORT FOR OFFLINE SYNC ---
import { addEngineerToOutbox } from '../db';

const EngineerForms = () => {
    const navigate = useNavigate();

    // --- NEW HANDLESUBMIT LOGIC ---
    // This function can be called by your forms to handle online/offline logic
    const handleSubmit = async (formData, endpoint, formDisplayName) => {
        const payload = {
            url: `http://localhost:5000/api/${endpoint}`, // Your NeonSQL endpoint
            method: 'POST',
            body: formData,
            formName: formDisplayName
        };

        if (navigator.onLine) {
            try {
                // Direct save to Neon via index.js routes
                const response = await fetch(payload.url, {
                    method: 'POST',
                    body: JSON.stringify(formData),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (response.ok) {
                    alert(`${formDisplayName} submitted successfully!`);
                }
            } catch (error) {
                console.error("Online submission failed, saving to outbox:", error);
                await addEngineerToOutbox(payload);
                alert("Saved to Sync Center due to connection error.");
            }
        } else {
            // Save to offline outbox
            await addEngineerToOutbox(payload);
            alert("Offline: Form saved to your Sync Center.");
        }
    };

    // --- CONFIGURATION: Engineer Specific Data ---
    // Note: I have linked 'School Infrastructure' and 'Resources' to your existing routes.
    // You can add new routes for the other specific engineering forms later.
    const formsData = [
        // { 
        //     id: 1, 
        //     name: "School Infrastructure", 
        //     emoji: "🏗️",
        //     description: "Detailed status of classrooms, buildings, and buildable space.",
        //     route: "/school-infrastructure", // Existing route
        // },
        { 
            id: 2, 
            name: "Damage Assessment", 
            emoji: "🏚️",
            description: "Log major/minor damages needing immediate repair or funding.",
            route: "/damage-assessment", // Placeholder for future form
        },
        { 
            id: 3, 
            name: "Project Monitoring", 
            emoji: "🚧",
            description: "Track progress of ongoing construction and repair projects.",
            route: "/project-monitoring", // Placeholder for future form
        },
        { 
            id: 4, 
            name: "Site Inspection", 
            emoji: "📋",
            description: "Safety checklists and site validation reports.",
            route: "/site-inspection", // Placeholder for future form
        },
        { 
            id: 5, 
            name: "Material Inventory", 
            emoji: "🧱",
            description: "Audit of construction materials available on-site.",
            route: "/material-inventory", // Placeholder for future form
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-[#004A99] text-white p-6 rounded-b-3xl shadow-lg mb-6">
                <h1 className="text-2xl font-bold">Engineering Forms</h1>
                <p className="text-blue-100 text-sm opacity-90">Select a form to fill out and submit.</p>
            </div>

            <div className="px-5">
                <div className="grid gap-4">
                    {formsData.map((form) => (
                        <div 
                            key={form.id}
                            onClick={() => navigate(form.route)}
                            className="group bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4 active:scale-[0.98] transition-all duration-200 hover:shadow-md hover:border-blue-200"
                        >
                            {/* Icon/Emoji Container */}
                            <div className="flex-shrink-0">
                                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl group-hover:bg-blue-50 transition-all duration-300">
                                    {form.emoji}
                                </div>
                                
                                {/* Arrow Indicator */}
                                <div className="text-gray-300 group-hover:text-[#CC0000] transition-colors duration-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                                    </svg>
                                </div>
                            </div>
                            
                            {/* Text Content */}
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 leading-tight mb-2 group-hover:text-[#004A99] transition-colors">
                                    {form.name}
                                </h2>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    {form.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EngineerForms;