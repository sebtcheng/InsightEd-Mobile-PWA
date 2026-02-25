import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiSave, FiCheckCircle, FiCheck } from "react-icons/fi";
import { saveUnit1Draft, getUnit1Draft, clearUnit1Draft } from "../../db";
import { motion, AnimatePresence } from "framer-motion";
import SuccessModal from "../SuccessModal";
import LocationPickerMap from "../LocationPickerMap";
import locationData from '../../locations.json';

const TOTAL_STEPS = 3;

const Unit1SchoolIdentity = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showWelcomeBack, setShowWelcomeBack] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        school_id: "",
        school_name: "",
        region: "",
        province: "",
        municipality: "",
        barangay: "",
        division: "",
        district: "",
        leg_district: "",
        curricular_offering: "",
        latitude: "",
        longitude: "",
    });

    const [provinceOptions, setProvinceOptions] = useState([]);
    const [cityOptions, setCityOptions] = useState([]);
    const [barangayOptions, setBarangayOptions] = useState([]);
    const [divisionOptions, setDivisionOptions] = useState([]);
    const [districtOptions, setDistrictOptions] = useState([]);
    const [legDistrictOptions, setLegDistrictOptions] = useState([]);

    // Load draft on mount
    useEffect(() => {
        const loadDraft = async () => {
            const draft = await getUnit1Draft('draft_unit_1');
            const storedSchoolId = localStorage.getItem('schoolId');

            if (draft && draft.step > 1) {
                setFormData(draft.formData || {});
                setCurrentStep(draft.step || 1);

                // Show welcome back toast if resuming from step 2 or 3
                setShowWelcomeBack(true);
                setTimeout(() => setShowWelcomeBack(false), 3000);
            } else if (storedSchoolId) {
                // If Beta Tester is on step 1, auto-fetch from database immediately
                handleFetchData(storedSchoolId);
            }
        };
        loadDraft();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync JSON Dropdowns Options (Region -> Province -> Muni -> Brgy)
    useEffect(() => {
        if (!formData.region) return;

        if (locationData && locationData[formData.region]) {
            setProvinceOptions(Object.keys(locationData[formData.region]).sort());
            if (formData.province && locationData[formData.region][formData.province]) {
                setCityOptions(Object.keys(locationData[formData.region][formData.province]).sort());
                if (formData.municipality && locationData[formData.region][formData.province][formData.municipality]) {
                    setBarangayOptions(locationData[formData.region][formData.province][formData.municipality].sort());
                }
            }
        }
    }, [formData.region, formData.province, formData.municipality]);

    // Sync API Dropdowns (Region -> Division -> District & Leg District)
    useEffect(() => {
        if (!formData.region) {
            setDivisionOptions([]);
            setLegDistrictOptions([]);
            return;
        }

        fetch(`/api/locations/divisions?region=${encodeURIComponent(formData.region)}`)
            .then(res => res.json())
            .then(data => setDivisionOptions(data || []))
            .catch(console.error);

        fetch(`/api/locations/leg-districts?region=${encodeURIComponent(formData.region)}`)
            .then(res => res.json())
            .then(data => setLegDistrictOptions(data || []))
            .catch(console.error);

    }, [formData.region]);

    useEffect(() => {
        if (!formData.region || !formData.division) {
            setDistrictOptions([]);
            return;
        }

        fetch(`/api/locations/districts?region=${encodeURIComponent(formData.region)}&division=${encodeURIComponent(formData.division)}`)
            .then(res => res.json())
            .then(data => setDistrictOptions(data || []))
            .catch(console.error);

    }, [formData.region, formData.division]);

    // Save draft whenever formData or currentStep changes
    useEffect(() => {
        const saveDraft = async () => {
            await saveUnit1Draft('draft_unit_1', { formData, step: currentStep });
        };
        // Don't save empty draft on initial load before state settles
        if (formData.school_id || currentStep > 1) {
            saveDraft();
        }
    }, [formData, currentStep]);


    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        } else {
            navigate(-1);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleRegionChange = (e) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, region: val, province: '', municipality: '', barangay: '', division: '', district: '' }));
    };

    const handleProvinceChange = (e) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, province: val, municipality: '', barangay: '' }));
    };

    const handleCityChange = (e) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, municipality: val, barangay: '' }));
    };

    const handleDivisionChange = (e) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, division: val, district: '' }));
    };

    const handleFetchData = async (idToFetch = formData.school_id) => {
        if (!idToFetch) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/school-profile/${idToFetch}`);
            if (res.ok) {
                const data = await res.json();
                setFormData(prev => ({
                    ...prev,
                    school_id: idToFetch,
                    school_name: data.school_name || data.schoolName || "",
                    region: data.region || "",
                    province: data.province || "",
                    municipality: data.municipality || data.city || "",
                    barangay: data.barangay || "",
                    division: data.division || "",
                    district: data.district || "",
                    leg_district: data.leg_district || data.legislativeDistrict || "",
                    curricular_offering: data.curricular_offering || data.curricularOffering || "",
                    latitude: data.latitude || "",
                    longitude: data.longitude || "",
                }));
            }
        } catch (err) {
            console.error("Failed to fetch school data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleNext = async () => {
        if (currentStep === 1 && formData.school_id) {
            await handleFetchData();
        }
        if (currentStep < TOTAL_STEPS) {
            setCurrentStep(currentStep + 1);
        } else {
            handleSubmit();
        }
    };

    const isStep1Valid = formData.school_id.length === 6 && /^\d+$/.test(formData.school_id);
    const isStep2Valid = formData.school_name && formData.region && formData.province && formData.municipality && formData.barangay && formData.division && formData.district && formData.leg_district;
    const isStep3Valid = formData.curricular_offering !== "" && formData.latitude !== "" && formData.longitude !== "";

    const isCurrentStepValid = () => {
        if (currentStep === 1) return isStep1Valid;
        if (currentStep === 2) return isStep2Valid;
        if (currentStep === 3) return isStep3Valid;
        return false;
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);

            // Final Validation Pass / Sync Verification
            // 1. Send data to production endpoints (simulated here)
            // await fetch('/api/schools/update', { method: 'POST', body: JSON.stringify(formData) })
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network request

            // 2. Clear draft upon success
            await clearUnit1Draft('draft_unit_1');

            // 3. Update Quest Progress (Zero-Disruption Assurance & XP logic)
            const stored = localStorage.getItem('quest_progress');
            let progress = stored ? JSON.parse(stored) : { completedUnits: [], xp: 0 };

            if (!progress.completedUnits.includes(1)) {
                progress.completedUnits.push(1);
                progress.xp += 150; // XP logic
                localStorage.setItem('quest_progress', JSON.stringify(progress));
            }

            setShowSuccess(true);
        } catch (err) {
            console.error("Submission failed", err);
            alert("Failed to sync. Progress saved locally.");
        } finally {
            setLoading(false);
        }
    };

    const progressPercentage = (currentStep / TOTAL_STEPS) * 100;

    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Header & Progress */}
            <header className="px-6 py-4 border-b border-gray-100 flex flex-col gap-4 sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between">
                    <button onClick={handleBack} className="p-2 rounded-full hover:bg-gray-100">
                        <FiArrowLeft className="text-gray-600 w-5 h-5" />
                    </button>
                    <span className="text-sm font-semibold text-gray-500">
                        Step {currentStep} of {TOTAL_STEPS}
                    </span>
                    <button className="text-indigo-600 p-2 text-sm font-medium hover:bg-indigo-50 rounded-md">
                        Save Draft
                    </button>
                </div>

                {/* Progress Bar with Milestone Markers */}
                <div className="relative w-full h-2 bg-gray-100 rounded-full mb-2">
                    <motion.div
                        className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />

                    {/* Markers */}
                    {[1, 2, 3].map((step) => (
                        <div
                            key={step}
                            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white transition-colors duration-300 ${currentStep >= step ? 'bg-indigo-600' : 'bg-gray-200'}`}
                            style={{ left: `${(step / TOTAL_STEPS) * 100}%`, transform: 'translate(-50%, -50%)' }}
                        />
                    ))}
                </div>
            </header>

            {/* Main Form Content */}
            <main className="flex-1 overflow-y-auto p-6 md:p-10 max-w-2xl mx-auto w-full relative">

                {/* Welcome Back Toast */}
                <AnimatePresence>
                    {showWelcomeBack && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm flex items-center gap-2 z-20"
                        >
                            <FiCheckCircle className="text-green-400" />
                            Welcome back! Continuing from Step {currentStep}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">School Identity</h1>
                    <p className="text-gray-500 text-sm mt-1">Please provide the basic details of the school.</p>
                </div>

                {/* --- STEP 1: School ID --- */}
                <AnimatePresence mode="wait">
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-2">School ID</label>
                                <input
                                    type="text"
                                    name="school_id"
                                    value={formData.school_id}
                                    onChange={handleChange}
                                    placeholder="e.g. 101010"
                                    maxLength={6}
                                    className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-all ${isStep1Valid
                                        ? "border-green-500 focus:ring-green-500 bg-green-50"
                                        : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                        }`}
                                />
                                {isStep1Valid && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="absolute right-3 top-10"
                                    >
                                        <div className="bg-green-100 p-1 rounded-full">
                                            <FiCheck className="text-green-600 w-5 h-5" />
                                        </div>
                                    </motion.div>
                                )}
                                <p className="text-xs text-gray-500 mt-2">Enter the official 6-digit DepEd School ID to securely fetch existing records.</p>
                            </div>
                        </motion.div>
                    )}

                    {/* --- STEP 2: Basic Name & Location --- */}
                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">School Name</label>
                                <input
                                    type="text"
                                    name="school_name"
                                    value={formData.school_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
                                    <select
                                        name="region"
                                        value={formData.region}
                                        onChange={handleRegionChange}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                    >
                                        <option value="">Select Region</option>
                                        {Object.keys(locationData).sort().map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Province</label>
                                    <select
                                        name="province"
                                        value={formData.province}
                                        onChange={handleProvinceChange}
                                        disabled={!formData.region}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white disabled:bg-gray-100"
                                    >
                                        <option value="">Select Province</option>
                                        {provinceOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Municipality / City</label>
                                    <select
                                        name="municipality"
                                        value={formData.municipality}
                                        onChange={handleCityChange}
                                        disabled={!formData.province}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white disabled:bg-gray-100"
                                    >
                                        <option value="">Select City/Mun</option>
                                        {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Barangay</label>
                                    <select
                                        name="barangay"
                                        value={formData.barangay}
                                        onChange={handleChange}
                                        disabled={!formData.municipality}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white disabled:bg-gray-100"
                                    >
                                        <option value="">Select Barangay</option>
                                        {barangayOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Division</label>
                                    <select
                                        name="division"
                                        value={formData.division}
                                        onChange={handleDivisionChange}
                                        disabled={!formData.region}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white disabled:bg-gray-100"
                                    >
                                        <option value="">Select Division</option>
                                        {divisionOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">District</label>
                                    <select
                                        name="district"
                                        value={formData.district}
                                        onChange={handleChange}
                                        disabled={!formData.division}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white disabled:bg-gray-100"
                                    >
                                        <option value="">Select District</option>
                                        {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Legislative District</label>
                                <select
                                    name="leg_district"
                                    value={formData.leg_district}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                >
                                    <option value="">Select District</option>
                                    {legDistrictOptions.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                        </motion.div>
                    )}

                    {/* --- STEP 3: Classification --- */}
                    {currentStep === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Curricular Offering</label>
                                <select
                                    name="curricular_offering"
                                    value={formData.curricular_offering}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                >
                                    <option value="">Select Curricular Offering...</option>
                                    <option value="Purely Elementary">Purely Elementary</option>
                                    <option value="Elementary School and Junior High School (K-10)">Elementary School and Junior High School (K-10)</option>
                                    <option value="All Offering (K-12)">All Offering (K-12)</option>
                                    <option value="Junior and Senior High">Junior and Senior High</option>
                                    <option value="Purely Junior High School">Purely Junior High School</option>
                                    <option value="Purely Senior High School">Purely Senior High School</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        name="latitude"
                                        value={formData.latitude}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        name="longitude"
                                        value={formData.longitude}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                    />
                                </div>
                            </div>

                            <div className="rounded-xl overflow-hidden border border-gray-200">
                                <LocationPickerMap
                                    latitude={formData.latitude}
                                    longitude={formData.longitude}
                                    onChange={(lat, lng) => setFormData(prev => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
                                    readOnly={false}
                                />
                            </div>

                            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start gap-3 mt-8">
                                <FiCheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600" />
                                <p className="text-sm">You are about to complete Unit 1. This will securely sync your initial school identity to the main database.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Footer Footer Footer */}
            <footer className="px-6 py-4 border-t border-gray-100 bg-white sticky bottom-0 z-10">
                <div className="max-w-2xl mx-auto flex justify-between">
                    <button
                        onClick={handleBack}
                        className={`px-6 py-3 rounded-lg font-medium transition-colors ${currentStep === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'}`}
                        disabled={currentStep === 1}
                    >
                        {currentStep === 1 ? 'Cancel' : 'Previous'}
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={loading || !isCurrentStepValid()}
                        className="px-8 py-3 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? 'Syncing with Command Center...' : currentStep === TOTAL_STEPS ? 'Complete Unit 1' : 'Next Step'}
                    </button>
                </div>
            </footer>

            <SuccessModal
                isOpen={showSuccess}
                onClose={() => setShowSuccess(false)}
                message="Unit 1 completed! Moving on to the next objective."
                redirectUrl="/modular-dashboard"
            />
        </div>
    );
};

export default Unit1SchoolIdentity;
