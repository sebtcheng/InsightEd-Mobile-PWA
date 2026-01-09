import React from 'react';
import logo from '../assets/InsightEd1.png';

const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm transition-opacity">
            <img
                src={logo}
                alt="Loading..."
                className="w-24 h-24 object-contain animate-pop-up"
            />
        </div>
    );
};

export default LoadingScreen;