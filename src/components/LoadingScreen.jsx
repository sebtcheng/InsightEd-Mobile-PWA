import React from 'react';

// 1. IMPORT THE GIF FROM ASSETS
// (Adjust the path '../assets/' if your folder structure is different)
import loadingGif from '../assets/loading.gif'; 

const LoadingScreen = ({ message = "Loading..." }) => {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm transition-opacity">
            
            {/* 2. USE THE IMPORTED VARIABLE HERE */}
            <img 
                src={loadingGif} 
                alt="Loading animation" 
                className="w-24 h-24 mb-4 object-contain"
            />

            <h2 className="text-[#004A99] font-bold text-lg animate-pulse tracking-wide">
                {message}
            </h2>
            
            <p className="text-gray-400 text-xs mt-1 font-medium">
                Please wait...
            </p>
        </div>
    );
};

export default LoadingScreen;