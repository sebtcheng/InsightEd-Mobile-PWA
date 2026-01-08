import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiCheck } from "react-icons/fi";

const StyledSelect = ({
    label,
    value,
    onChange,
    options = [],
    disabled = false,
    placeholder = "Select an option",
    name,
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Handle clicking outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        const selectedValue = typeof option === 'string' ? option : option.value;
        setIsOpen(false);

        // Mock event for compatibility with standard handleChange
        if (onChange) {
            onChange({
                target: {
                    name: name,
                    value: selectedValue
                }
            });
        }
    };

    // Find label for display
    const getDisplayLabel = () => {
        if (!value) return placeholder;
        const found = options.find(opt => (typeof opt === 'string' ? opt : opt.value) === value);
        if (!found) return value; // Fallback to value if no option match
        return typeof found === 'string' ? found : found.label;
    };

    const displayLabel = getDisplayLabel();

    return (
        <div className={`mb-4 relative ${className}`} ref={containerRef}>
            {label && (
                <label className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 ml-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {label}
                </label>
            )}

            <div className="relative">
                {/* Trigger Button */}
                <div
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className={`
                        w-full p-3.5 pr-10 rounded-2xl border-2 cursor-pointer
                        text-sm font-semibold transition-all duration-200 flex items-center justify-between
                        ${disabled
                            ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
                            : isOpen
                                ? 'bg-white border-blue-400 ring-4 ring-blue-50 shadow-lg'
                                : 'bg-white border-blue-50 text-gray-700 hover:border-blue-200 hover:shadow-md'
                        }
                    `}
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                    <span className={`truncate ${!value ? 'text-gray-400 font-normal' : ''}`}>
                        {displayLabel}
                    </span>

                    {/* Arrow Icon */}
                    <div className={`
                        absolute right-4 transition-transform duration-300
                        ${isOpen ? 'rotate-180' : ''}
                        ${disabled ? 'text-gray-300' : 'text-blue-400'}
                    `}>
                        <FiChevronDown size={22} strokeWidth={3} />
                    </div>
                </div>

                {/* Dropdown Menu */}
                {isOpen && !disabled && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200 origin-top">
                        <div className="max-h-[250px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-blue-100 scrollbar-track-transparent">
                            {options.length > 0 ? options.map((opt, idx) => {
                                const optValue = typeof opt === 'string' ? opt : opt.value;
                                const optLabel = typeof opt === 'string' ? opt : opt.label;
                                const isSelected = optValue === value;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => handleSelect(opt)}
                                        className={`
                                            p-3 rounded-xl cursor-pointer text-sm mb-1 transition-all flex items-center justify-between
                                            ${isSelected
                                                ? 'bg-blue-50 text-[#004A99] font-bold'
                                                : 'text-gray-600 hover:bg-gray-50 hover:pl-4 hover:text-gray-900'
                                            }
                                        `}
                                    >
                                        <span>{optLabel}</span>
                                        {isSelected && <FiCheck size={16} />}
                                    </div>
                                );
                            }) : (
                                <div className="p-4 text-center text-gray-400 text-xs italic">
                                    No options available
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StyledSelect;
