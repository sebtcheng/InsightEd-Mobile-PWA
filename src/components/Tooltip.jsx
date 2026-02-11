import React, { useState } from 'react';

const Tooltip = ({ text }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div 
            className="relative inline-block ml-1"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            <span className="cursor-help text-blue-400 hover:text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 inline">
  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
</svg>
            </span>
            
            {isVisible && (
                <div className="absolute z-50 w-64 p-2 mt-1 text-xs text-white bg-slate-700 rounded-lg shadow-lg -left-1/2 transform -translate-x-1/2">
                    {text}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-700 rotate-45"></div>
                </div>
            )}
        </div>
    );
};

export default Tooltip;
