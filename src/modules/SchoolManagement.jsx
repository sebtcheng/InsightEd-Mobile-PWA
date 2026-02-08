import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiMapPin, FiCheck, FiX, FiClock, FiSave, FiList } from 'react-icons/fi';
import { TbSchool } from 'react-icons/tb';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper for map recentering - Defined before usage
const MapAutoCenter = ({ position, zoom }) => {
    const map = useMapEvents({});
    useEffect(() => {
        if (position) {
            console.log("Flying to:", position, "Zoom:", zoom);
            map.flyTo(position, zoom || 13);
        }
    }, [position, zoom, map]);
    return null;
};

// Nominatim Search Helper (Fallback)
const searchNominatim = async (query) => {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            }
        }
    } catch (error) {
        console.error("Nominatim search failed:", error);
    }
    return null;
};

const SchoolManagement = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('form'); // 'form' or 'requests'

    // Form State - matching exact schools table schema
    const [formData, setFormData] = useState({
        school_id: '',
        school_name: '',
        district: '',
        province: '',
        municipality: '',
        leg_district: '',
        barangay: '',
        street_address: '',
        mother_school_id: 'NA',
        curricular_offering: '',
    });

    const [mapPosition, setMapPosition] = useState([14.5995, 120.9842]); // Default: Manila
    const [mapZoom, setMapZoom] = useState(13);
    const [mapStatus, setMapStatus] = useState(''); // Idle, Searching..., Found
    const [submitting, setSubmitting] = useState(false);
    const [pendingSchools, setPendingSchools] = useState([]);

    // Confirmation Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmTimer, setConfirmTimer] = useState(20);
    const [canConfirm, setCanConfirm] = useState(false);

    useEffect(() => {
        let interval;
        if (showConfirmModal && confirmTimer > 0) {
            interval = setInterval(() => {
                setConfirmTimer((prev) => prev - 1);
            }, 1000);
        } else if (confirmTimer === 0) {
            setCanConfirm(true);
        }
        return () => clearInterval(interval);
    }, [showConfirmModal, confirmTimer]);

    // Location Options & Coordinates State
    const [locationOptions, setLocationOptions] = useState([]);
    const [locationCoordinates, setLocationCoordinates] = useState([]); // Array of { municipality, barangay, lat, lng }

    const curricularOfferingOptions = [
        'Purely ES',
        'ES with SHS',
        'Purely JHS',
        'JHS with SHS',
        'Purely SHS',
        'K-12 (ES, JHS, SHS)'
    ];

    useEffect(() => {
        const fetchUserData = async () => {
            const user = auth.currentUser;
            if (!user) {
                navigate('/login');
                return;
            }

            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);

                // Pre-set map center based on region if possible (simplified)
                if (data.region === 'NCR') {
                    setMapPosition([14.5995, 120.9842]);
                } else if (data.region === 'Region III') {
                    setMapPosition([15.4818, 120.7121]); // Central Luzon
                }

                // Fetch location options for this user's region/division
                fetchLocationOptions(data.region, data.division);
                fetchLocationCoordinates(data.region, data.division);
            }
            setLoading(false);
        };

        fetchUserData();
        fetchPendingSchools();
    }, [navigate]);

    const fetchLocationOptions = async (region, division) => {
        try {
            const res = await fetch(`/api/sdo/location-options?region=${encodeURIComponent(region)}&division=${encodeURIComponent(division)}`);
            if (res.ok) {
                const data = await res.json();
                setLocationOptions(data);
            }
        } catch (err) {
            console.error('Failed to fetch location options:', err);
        }
    };

    const fetchLocationCoordinates = async (region, division) => {
        try {
            console.log(`fetching coords for ${region}, ${division}`);
            const res = await fetch(`/api/sdo/location-coordinates?region=${encodeURIComponent(region)}&division=${encodeURIComponent(division)}`);
            if (res.ok) {
                const data = await res.json();
                console.log("📍 API Data Received:", data.length, "rows");
                if (data.length > 0) {
                    console.log("📍 Sample Row:", data[0]);
                    console.log("📍 Sample lat type:", typeof data[0].lat, data[0].lat);
                }
                setLocationCoordinates(data);
            }
        } catch (err) {
            console.error('Failed to fetch location coordinates:', err);
        }
    };

    const fetchPendingSchools = async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const res = await fetch(`/api/sdo/pending-schools?sdo_uid=${user.uid}`);
            if (res.ok) {
                const data = await res.json();
                setPendingSchools(data);
            }
        } catch (err) {
            console.error('Failed to fetch pending schools:', err);
        }
    };

    // Derived Options based on selections
    const provinceOptions = useMemo(() => {
        return [...new Set(locationOptions.map(item => item.province).filter(Boolean))].sort();
    }, [locationOptions]);

    const municipalityOptions = useMemo(() => {
        if (!formData.province) return [];
        return [...new Set(locationOptions
            .filter(item => item.province === formData.province)
            .map(item => item.municipality)
            .filter(Boolean)
        )].sort();
    }, [locationOptions, formData.province]);

    const districtOptions = useMemo(() => {
        if (!formData.municipality) return [];
        return [...new Set(locationOptions
            .filter(item => item.municipality === formData.municipality)
            .map(item => item.district)
            .filter(Boolean)
        )].sort();
    }, [locationOptions, formData.municipality]);

    const barangayOptions = useMemo(() => {
        // Filter by municipality AND district if selected, else just municipality
        // Actually, just municipality is usually enough for barangays, but let's be safe
        if (!formData.municipality) return [];
        let filtered = locationOptions.filter(item => item.municipality === formData.municipality);

        // If district is selected, further filter? 
        // Some datasets might not strict link barangay to district in the table row, but usually they are.
        // Let's stick to municipality filter for barangays to be safe, unless the list is huge.
        // Actually, let's include district filter if available to narrow it down if desired, 
        // but often barangay is the child of municipality.
        // Let's check if the user selected a district.
        if (formData.district) {
            const withDistrict = filtered.filter(item => item.district === formData.district);
            if (withDistrict.length > 0) {
                filtered = withDistrict;
            }
        }

        return [...new Set(filtered.map(item => item.barangay).filter(Boolean))].sort();
    }, [locationOptions, formData.municipality, formData.district]);

    const legDistrictOptions = useMemo(() => {
        if (!formData.municipality) return [];
        return [...new Set(locationOptions
            .filter(item => item.municipality === formData.municipality)
            .map(item => item.leg_district)
            .filter(Boolean)
        )].sort();
    }, [locationOptions, formData.municipality]);


    const MapClickHandler = () => {
        useMapEvents({
            click(e) {
                setMapPosition([e.latlng.lat, e.latlng.lng]);
            }
        });
        return null;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Limit school_id to 6 characters
        if (name === 'school_id' && value.length > 6) return;

        setFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Cascading resets
            if (name === 'province') {
                newData.municipality = '';
                newData.district = '';
                newData.barangay = '';
                newData.leg_district = '';
            } else if (name === 'municipality') {
                newData.district = '';
                newData.barangay = '';
                newData.leg_district = '';
            }
            return newData;
        });

        // Map Auto-Pan Logic (First School in Area)
        if (['province', 'municipality', 'district', 'leg_district', 'barangay'].includes(name) && value) {
            // Construct filters using the NEW value (state update is async, so use local 'value')
            const filters = {
                ...formData,
                [name]: value
            };

            // Requirement: "When i select a province, municipality, district..." -> trigger pan
            // We need at least a Province to start filtering effectively, but usually Municipality is the key.
            // Let's trigger if ANY of these are set.

            if (userData?.region && userData?.division) {
                setMapStatus('Locating area...');
                console.log('Cleaning up map interface and adding instructions...'); // Confirming cleanup

                const params = new URLSearchParams({
                    region: userData.region,
                    division: userData.division,
                    province: filters.province || '',
                    municipality: filters.municipality || '',
                    district: filters.district || '',
                    leg_district: filters.leg_district || '',
                    barangay: filters.barangay || ''
                });

                fetch(`/api/sdo/first-school-location?${params}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.lat && data.lng) {
                            console.log("📍 Pan to:", data);
                            setMapPosition([parseFloat(data.lat), parseFloat(data.lng)]);
                            setMapZoom(15);
                            setMapStatus('Centered on area');
                        } else {
                            setMapStatus('No schools found in this area');
                        }
                    })
                    .catch(err => {
                        console.error("Failed to map auto-pan", err);
                        setMapStatus('Error locating area');
                    });
            }
        }
    };

    const handleInitialSubmit = (e) => {
        e.preventDefault();

        // Validate all required fields
        const requiredFields = ['school_id', 'school_name', 'district', 'province', 'municipality', 'barangay', 'curricular_offering'];
        const missing = requiredFields.filter(field => !formData[field]);

        if (missing.length > 0) {
            alert(`Please fill in all required fields: ${missing.join(', ')}`);
            return;
        }

        // Validate School ID is exactly 6 characters
        if (formData.school_id.length !== 6) {
            alert('School ID must be exactly 6 characters');
            return;
        }

        // Validate User Profile (Region/Division must be set)
        if (!userData.region || !userData.division) {
            alert('Your account profile is missing Region/Division information. Please update your profile before submitting a school.');
            return;
        }

        // Open Confirmation Modal
        setConfirmTimer(20);
        setCanConfirm(false);
        setShowConfirmModal(true);
    };

    const handleConfirmSubmit = async () => {
        setSubmitting(true);
        setShowConfirmModal(false); // Close modal

        try {
            const user = auth.currentUser;
            const res = await fetch('/api/sdo/submit-school', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    region: userData.region,
                    division: userData.division,
                    latitude: mapPosition[0],
                    longitude: mapPosition[1],
                    submitted_by: user.uid,
                    submitted_by_name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
                })
            });

            const data = await res.json();

            if (res.ok) {
                alert('School submitted successfully! Awaiting admin approval.');
                // Reset form
                setFormData({
                    school_id: '',
                    school_name: '',
                    district: '',
                    province: '',
                    municipality: '',
                    leg_district: '',
                    barangay: '',
                    street_address: '',
                    mother_school_id: 'NA',
                    curricular_offering: '',
                });
                setMapPosition([14.5995, 120.9842]);
                fetchPendingSchools(); // Refresh list
                setActiveView('requests'); // Switch to requests view
            } else {
                alert('Submission failed: ' + data.error);
            }
        } catch (err) {
            console.error('Submission error:', err);
            alert('Failed to submit school. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-32">
                {/* Header */}
                <div className="bg-gradient-to-br from-[#004A99] to-[#002D5C] p-8 pb-20 rounded-b-[3rem] shadow-2xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <TbSchool size={200} />
                    </div>
                    <div className="relative z-20 mb-4">
                        <button
                            onClick={() => navigate('/monitoring-dashboard')}
                            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider"
                        >
                            <FiX size={18} /> Back to Dashboard
                        </button>
                    </div>
                    <div className="relative z-10">
                        <h1 className="text-4xl font-black tracking-tighter">School Management</h1>
                        <p className="text-blue-200 text-lg font-medium mt-1">
                            {userData?.division || 'Division Office'}
                        </p>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto px-6 -mt-12 space-y-6 relative z-30">
                    {/* Tab Switcher */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-2 flex gap-2">
                        <button
                            onClick={() => setActiveView('form')}
                            className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeView === 'form'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            <FiSave size={20} />
                            Add New School
                        </button>
                        <button
                            onClick={() => setActiveView('requests')}
                            className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeView === 'requests'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            <FiList size={20} />
                            Requests ({pendingSchools.length})
                        </button>
                    </div>

                    {/* Form View */}
                    {activeView === 'form' && (
                        <form onSubmit={handleInitialSubmit} className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-6">Submit New School</h2>

                            {/* Grid Layout for Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                        School ID * <span className="text-xs text-slate-500">(6 digits)</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="school_id"
                                        value={formData.school_id}
                                        onChange={handleInputChange}
                                        maxLength="6"
                                        pattern="[0-9]{6}"
                                        placeholder="e.g. 100000"
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                                        required
                                    />
                                    <p className="text-xs text-slate-500 mt-1">{formData.school_id.length}/6 characters</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">School Name *</label>
                                    <input
                                        type="text"
                                        name="school_name"
                                        value={formData.school_name}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                                        required
                                    />
                                </div>

                                {/* Province Dropdown */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Province *</label>
                                    <select
                                        name="province"
                                        value={formData.province}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                                        required
                                    >
                                        <option value="">Select Province</option>
                                        {provinceOptions.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Municipality Dropdown */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Municipality/City *</label>
                                    <select
                                        name="municipality"
                                        value={formData.municipality}
                                        onChange={handleInputChange}
                                        disabled={!formData.province}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white disabled:opacity-50"
                                        required
                                    >
                                        <option value="">Select Municipality/City</option>
                                        {municipalityOptions.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* District Dropdown */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">District *</label>
                                    <select
                                        name="district"
                                        value={formData.district}
                                        onChange={handleInputChange}
                                        disabled={!formData.municipality}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white disabled:opacity-50"
                                        required
                                    >
                                        <option value="">Select District</option>
                                        {districtOptions.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Legislative District Dropdown */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Legislative District</label>
                                    <select
                                        name="leg_district"
                                        value={formData.leg_district}
                                        onChange={handleInputChange}
                                        disabled={!formData.municipality}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white disabled:opacity-50"
                                    >
                                        <option value="">Select Leg. District</option>
                                        {legDistrictOptions.map(ld => (
                                            <option key={ld} value={ld}>{ld}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Barangay Dropdown */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Barangay *</label>
                                    <select
                                        name="barangay"
                                        value={formData.barangay}
                                        onChange={handleInputChange}
                                        disabled={!formData.municipality}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white disabled:opacity-50"
                                        required
                                    >
                                        <option value="">Select Barangay</option>
                                        {barangayOptions.map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Street Address</label>
                                    <input
                                        type="text"
                                        name="street_address"
                                        value={formData.street_address}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Brgy. 21, Libtong"
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Mother School ID</label>
                                    <input
                                        type="text"
                                        name="mother_school_id"
                                        value={formData.mother_school_id}
                                        onChange={handleInputChange}
                                        placeholder="NA or 6-digit ID"
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Curricular Offering *</label>
                                    <select
                                        name="curricular_offering"
                                        value={formData.curricular_offering}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                                        required
                                    >
                                        <option value="">Select Offering</option>
                                        {curricularOfferingOptions.map(option => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Map Section */}
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                                    <FiMapPin className="inline mr-2" />
                                    School Location *
                                </label>

                                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 rounded-xl text-sm flex items-start gap-2 border border-blue-100 dark:border-blue-800">
                                    <FiCheck className="mt-0.5 shrink-0" />
                                    <span>
                                        The map has been centered on the general area.
                                        <strong> Please drag the blue pin </strong> to the exact location of the school you are registering.
                                    </span>
                                </div>

                                <div className="rounded-2xl overflow-hidden shadow-md ring-4 ring-slate-100 dark:ring-slate-700" style={{ height: '400px' }}>
                                    <MapContainer
                                        center={mapPosition}
                                        zoom={mapZoom}
                                        style={{ height: '100%', width: '100%' }}
                                    >
                                        <MapAutoCenter position={mapPosition} zoom={mapZoom} />
                                        <TileLayer
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        />
                                        <Marker
                                            position={mapPosition}
                                            draggable={true}
                                            eventHandlers={{
                                                dragend: (e) => {
                                                    const marker = e.target;
                                                    const pos = marker.getLatLng();
                                                    setMapPosition([pos.lat, pos.lng]);
                                                }
                                            }}
                                        />
                                        <MapClickHandler />
                                    </MapContainer>
                                </div>

                                <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-xl flex flex-wrap justify-between items-center gap-4 text-sm font-mono">
                                    <div className="flex items-center gap-6">
                                        <span className="font-bold text-slate-600 dark:text-slate-300">
                                            Lat: <span className="text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 px-2 py-1 rounded ml-2">{mapPosition[0].toFixed(6)}</span>
                                        </span>
                                        <span className="font-bold text-slate-600 dark:text-slate-300">
                                            Lng: <span className="text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 px-2 py-1 rounded ml-2">{mapPosition[1].toFixed(6)}</span>
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-400 dark:text-slate-500 italic">
                                        {mapStatus}
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <FiCheck size={20} />
                                        Submit for Approval
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Requests (formerly Pending Schools) List */}
                    {activeView === 'requests' && (
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-6">Request Log</h2>

                            {pendingSchools.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <FiClock size={48} className="mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-bold">No requests found</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {pendingSchools.map((school) => (
                                        <div
                                            key={school.pending_id}
                                            className="border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 hover:shadow-lg transition-all"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-xl font-black text-slate-800 dark:text-white">{school.school_name}</h3>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{school.school_id}</p>
                                                    <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                                                        {school.municipality}, {school.district}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-2">
                                                        Submitted: {new Date(school.submitted_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    {school.status === 'pending' && (
                                                        <span className="px-4 py-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl text-sm font-bold flex items-center gap-2">
                                                            <FiClock size={16} />
                                                            Pending
                                                        </span>
                                                    )}
                                                    {school.status === 'approved' && (
                                                        <span className="px-4 py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl text-sm font-bold flex items-center gap-2">
                                                            <FiCheck size={16} />
                                                            Approved
                                                        </span>
                                                    )}
                                                    {school.status === 'rejected' && (
                                                        <div className="flex flex-col items-end">
                                                            <span className="px-4 py-2 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-xl text-sm font-bold flex items-center gap-2">
                                                                <FiX size={16} />
                                                                Rejected
                                                            </span>
                                                            {school.rejection_reason && (
                                                                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 text-right max-w-[150px]">
                                                                    Reason: {school.rejection_reason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* MODAL: Confirmation */}
                {showConfirmModal && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl transform scale-100 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
                            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-6 shadow-sm">
                                <FiClock size={32} />
                            </div>

                            <h3 className="text-center text-2xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-wide">VERIFICATION</h3>

                            <p className="text-center text-slate-600 dark:text-slate-300 font-medium mb-6 leading-relaxed">
                                By submitting this form, you confirm that this school is <br />
                                <span className="text-rose-600 dark:text-rose-400 font-black text-lg uppercase mt-1 block">NEWLY ESTABLISHED and NOT CONVERTED</span>.
                            </p>

                            <div className="text-center mb-8">
                                <span className={`text-4xl font-black tabular-nums tracking-tighter ${confirmTimer > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {confirmTimer > 0 ? confirmTimer : <FiCheck className="inline" />}
                                </span>
                                {confirmTimer > 0 && <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mt-1">Seconds remaining</span>}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmSubmit}
                                    disabled={!canConfirm}
                                    className={`flex-1 py-3.5 rounded-xl font-bold text-white transition-all shadow-lg ${canConfirm
                                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 transform hover:-translate-y-1'
                                        : 'bg-slate-300 dark:bg-slate-600 cursor-not-allowed opacity-70'
                                        }`}
                                >
                                    Confirm Submit
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <BottomNav userRole={userData?.role} />
            </div>
        </PageTransition >
    );
};

export default SchoolManagement;
