import React, { useEffect } from 'react';
import { FiWifiOff, FiCheck } from 'react-icons/fi';

const OfflineSuccessModal = ({ isOpen, onClose }) => {

    // Auto-close after 3 seconds for convenience
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl w-full max-w-sm shadow-2xl transform scale-100 transition-all text-center relative overflow-hidden">

                {/* Decorative Background Blob */}
                <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-amber-100 rounded-full blur-3xl opacity-50"></div>
                <div className="absolute bottom-[-50px] left-[-50px] w-32 h-32 bg-blue-100 rounded-full blur-3xl opacity-50"></div>

                <div className="relative z-10">
                    <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500 shadow-inner">
                        <div className="relative">
                            <FiWifiOff size={32} />
                            <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-800">
                                <FiCheck size={10} />
                            </div>
                        </div>
                    </div>

                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Saved to Outbox!</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                        You are currently offline. Your changes have been securely saved and will automatically sync when you reconnect.
                    </p>

                    <button
                        onClick={onClose}
                        className="w-full bg-[#004A99] hover:bg-blue-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
                    >
                        Got it
                    </button>

                    <p className="text-[10px] text-slate-400 mt-4 uppercase tracking-widest font-semibold">
                        Auto-closing in 3s...
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OfflineSuccessModal;
