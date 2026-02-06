import React from 'react';
import { FiTool, FiAlertTriangle } from 'react-icons/fi';

const MaintenanceScreen = () => {
    return (
        <div className="fixed inset-0 z-[9999] bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-gray-100 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <FiTool size={48} />
                </div>

                <h1 className="text-2xl font-extrabold text-[#004A99] mb-2">System Maintenance</h1>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                    We're currently performing some maintenance to improve your experience.
                </p>

                <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3 text-left w-full mb-6">
                    <FiAlertTriangle className="text-blue-500 mt-1 shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-blue-800">Please standby for a short maintenance. Thank you for your patience.</p>
                    </div>
                </div>



                <div className="flex gap-2 text-[10px] items-center text-gray-400 font-bold uppercase tracking-widest">
                    <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                    Maintenance in Progress
                </div>
            </div>


        </div>
    );
};

export default MaintenanceScreen;
