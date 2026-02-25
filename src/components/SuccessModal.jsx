import React, { useEffect } from 'react';
import { FiCheck, FiCheckCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const SuccessModal = ({ isOpen, onClose, message = "Changes Saved Successfully!", redirectUrl = '/school-forms' }) => {
    const navigate = useNavigate();
    const [countdown, setCountdown] = React.useState(3);

    // Auto-redirect after 3 seconds with visible countdown
    useEffect(() => {
        if (isOpen) {
            setCountdown(3); // Reset countdown on open

            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        navigate(redirectUrl);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [isOpen, navigate]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl w-full max-w-sm shadow-2xl transform scale-100 transition-all text-center relative overflow-hidden">

                {/* Decorative Background Blob */}
                <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-green-100 rounded-full blur-3xl opacity-50"></div>
                <div className="absolute bottom-[-50px] left-[-50px] w-32 h-32 bg-blue-100 rounded-full blur-3xl opacity-50"></div>

                <div className="relative z-10">
                    <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500 shadow-inner">
                        <FiCheckCircle size={40} className="animate-in zoom-in duration-300" />
                    </div>

                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Success!</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                        {message}
                    </p>
                    <p className="text-xs text-slate-400 mb-6 font-medium animate-pulse">
                        Redirecting in {countdown}s...
                    </p>

                    <button
                        onClick={() => navigate(redirectUrl)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-[0.98]"
                    >
                        Great!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SuccessModal;
