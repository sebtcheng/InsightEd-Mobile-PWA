import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';
import { FiTrendingUp, FiCheckCircle, FiClock, FiFileText, FiMapPin, FiArrowLeft, FiMenu, FiBell, FiSearch, FiFilter, FiAlertCircle, FiX, FiBarChart2, FiRefreshCw, FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight, FiPieChart } from 'react-icons/fi';
import { TbTrophy, TbSchool, TbChartBar } from 'react-icons/tb';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

import Papa from 'papaparse';
import locationData from '../locations.json';


// Helper for robust name matching (ignoring "Division", "District" suffixes)
const normalizeLocationName = (name) => {
    return name?.toString().toLowerCase().trim()
        .replace(/\s+division$/, '')
        .replace(/\s+district$/, '')
        .replace(/^division\s+of\s+/, '')
        .replace(/^district\s+of\s+/, '')
        .trim() || '';
};


import { useServiceWorker } from '../context/ServiceWorkerContext'; // Import Context

const MonitoringDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Service Worker Update Context
    const { isUpdateAvailable, updateApp } = useServiceWorker();
    const [userData, setUserData] = useState(null);
    const [stats, setStats] = useState(null);
    const [engStats, setEngStats] = useState(null);
    const [jurisdictionProjects, setJurisdictionProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('accomplishment'); // Default to InsightED Accomplishment

    // State for Central Office Filters
    const [coRegion, setCoRegion] = useState('');
    const [coDivision, setCoDivision] = useState('');
    const [coDistrict, setCoDistrict] = useState(''); // NEW: District Filter
    const [availableRegions, setAvailableRegions] = useState([]);
    const [availableDivisions, setAvailableDivisions] = useState([]);
    const [availableDistricts, setAvailableDistricts] = useState([]); // NEW: District State
    const [schoolData, setSchoolData] = useState([]); // Store raw CSV data

    // NEW: Regional Stats for National View
    const [regionalStats, setRegionalStats] = useState([]);
    const [divisionStats, setDivisionStats] = useState([]); // Per-division stats for RO
    const [districtStats, setDistrictStats] = useState([]); // Per-district stats for SDO
    const [districtSchools, setDistrictSchools] = useState([]); // Schools for Drill-down
    const [loadingDistrict, setLoadingDistrict] = useState(false);
    const [schoolSort, setSchoolSort] = useState('pct-desc'); // Sort state for schools
    const [schoolSearch, setSchoolSearch] = useState(''); // NEW: Search state
    const [schoolPage, setSchoolPage] = useState(1); // NEW: Pagination state

    // NEW: Store Aggregated CSV Totals
    const [csvRegionalTotals, setCsvRegionalTotals] = useState({});

    const [insightsMetric, setInsightsMetric] = useState('enrolment'); // Default to Enrolment for Insights Tab
    const [insightsSubMetric, setInsightsSubMetric] = useState('total'); // NEW: Sub-metric for Enrolment
    const [insightsAralGrade, setInsightsAralGrade] = useState('g1'); // NEW: Grade for ARAL
    const [insightsAralSubject, setInsightsAralSubject] = useState('read'); // NEW: Subject for ARAL
    const [insightsClassesGrade, setInsightsClassesGrade] = useState('classes_kinder'); // NEW: Grade for Organized Classes
    const [insightsClassSizeCategory, setInsightsClassSizeCategory] = useState('less'); // NEW: Category for Class Size
    const [insightsClassSizeGrade, setInsightsClassSizeGrade] = useState('kinder'); // NEW: Grade for Class Size
    const [insightsDemographicCategory, setInsightsDemographicCategory] = useState('sned'); // NEW: Demographic Category
    const [insightsDemographicGrade, setInsightsDemographicGrade] = useState('total'); // NEW: Demographic Grade - Default to Total
    const [insightsShiftingGrade, setInsightsShiftingGrade] = useState('k'); // NEW: Shifting Grade
    const [insightsShiftingCategory, setInsightsShiftingCategory] = useState('single'); // NEW: Shifting Category
    const [insightsDeliveryGrade, setInsightsDeliveryGrade] = useState('k'); // NEW: Delivery Grade
    const [insightsDeliveryCategory, setInsightsDeliveryCategory] = useState('inperson'); // NEW: Delivery Category
    const [insightsAdmType, setInsightsAdmType] = useState('mdl'); // NEW: ADM Type (mdl, odl, tvi, blended)
    const [insightsTeacherGrade, setInsightsTeacherGrade] = useState('total'); // NEW: Teacher Grade
    const [insightsMultigradeCategory, setInsightsMultigradeCategory] = useState('1_2'); // NEW: Multigrade Category
    const [insightsExperienceCategory, setInsightsExperienceCategory] = useState('0_1'); // NEW: Experience Category
    const [insightsSpecializationSubject, setInsightsSpecializationSubject] = useState('math'); // NEW: Specialization Subject
    const [insightsInventoryItem, setInsightsInventoryItem] = useState('ecart'); // NEW: Inventory Item
    const [insightsRoomType, setInsightsRoomType] = useState('sci'); // NEW: Room Type
    const [insightsClassroomCondition, setInsightsClassroomCondition] = useState('good'); // NEW: Classroom Condition
    const [insightsSiteCategory, setInsightsSiteCategory] = useState('elec'); // NEW: Site Category
    const [insightsSiteSubOption, setInsightsSiteSubOption] = useState('grid'); // NEW: Site Option
    const [insightsSeatsGrade, setInsightsSeatsGrade] = useState('k'); // NEW: Seats Grade
    const [insightsToiletType, setInsightsToiletType] = useState('common'); // NEW: Toilet Type

    const [projectListModal, setProjectListModal] = useState({ isOpen: false, title: '', projects: [], isLoading: false });

    // --- SUPER USER EFFECTIVE ROLE ---
    // Calculate derived role/region for rendering
    const isSuperUser = userData?.role === 'Super User';
    const impersonatedRole = sessionStorage.getItem('impersonatedRole');

    const effectiveRole = (isSuperUser && impersonatedRole)
        ? impersonatedRole
        : userData?.role;

    const effectiveRegion = (isSuperUser)
        ? (sessionStorage.getItem('impersonatedRegion') || sessionStorage.getItem('impersonatedLocation') || userData?.region)
        : userData?.region;

    const effectiveDivision = (isSuperUser && effectiveRole === 'School Division Office')
        ? sessionStorage.getItem('impersonatedLocation')
        : userData?.division;

    // Note: For SDO, we might need effectiveDivision too if we want to be precise, 
    // but the Selector sets 'impersonatedLocation' to the division name usually? 
    // Actually Selector sets:
    // Region -> impersonatedRegion
    // Division -> impersonatedDivision OR impersonatedLocation depending on logic.
    // Let's rely on standard logic below or update as needed.
    // For now, fixing Regional View is priority.

    // --- EFFECT: DATA FETCHING ---
    useEffect(() => {
        if (userData) {
            fetchData(userData.region || '', userData.division || '');
        }
    }, [userData]);

    const fetchProjectList = async (region, status) => {
        setProjectListModal({ isOpen: true, title: `${status} Projects in ${region}`, projects: [], isLoading: true });
        try {
            const res = await fetch(`/api/monitoring/engineer-projects?region=${encodeURIComponent(region)}`);
            if (res.ok) {
                const data = await res.json();
                // Filter by status on client side
                const filtered = data.filter(p => {
                    const s = p.status?.toString().toLowerCase().trim() || '';
                    const q = status.toString().toLowerCase().trim();

                    // Robust matching to align with backend "ILIKE %...%" for procurement
                    if (q.includes('under procurement')) {
                        return s.includes('under procurement');
                    }

                    return s === q;
                });
                setProjectListModal(prev => ({ ...prev, projects: filtered, isLoading: false }));
            } else {
                setProjectListModal(prev => ({ ...prev, isLoading: false }));
            }
        } catch (err) {
            console.error(err);
            setProjectListModal(prev => ({ ...prev, isLoading: false }));
        }
    };

    const handleProjectDrillDown = (region, status) => {
        fetchProjectList(region, status);
    };

    const fetchData = async (region, division, district) => {
        const user = auth.currentUser;
        if (!user) return;

        // If we already have userData, use it, otherwise fetch it
        let currentUserData = userData;
        if (!currentUserData) {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                currentUserData = docSnap.data();
                setUserData(currentUserData);
            }
        }


        if (!currentUserData) return;

        // --- SUPER USER OVERRIDE ---
        let effectiveRole = currentUserData.role;
        let effectiveRegion = currentUserData.region;
        let effectiveDivision = currentUserData.division;

        const impersonatedRole = sessionStorage.getItem('impersonatedRole');
        const isSuperUser = currentUserData.role === 'Super User';

        if (isSuperUser && impersonatedRole) {
            effectiveRole = impersonatedRole;
            const impLoc = sessionStorage.getItem('impersonatedLocation'); // e.g., "Region I" or "Region I - Ilocos Norte"

            // Allow Super User to act as these roles
            if (effectiveRole === 'Regional Office') {
                effectiveRegion = impLoc;
            } else if (effectiveRole === 'School Division Office') {
                // Assuming impLoc is "Region - Division" or just Division? selector logic says "Region" then "Division"
                // The selector saves specific Region and Division? 
                // Let's check Selector logic: `sessionStorage.setItem('impersonatedLocation', selectedDivision);` for SDO
                // But SDO needs Region too for queries. 
                // For now, let's assume filtering relies mostly on Division name which is usually unique enough or handled by backend.
                // Better: The selector should have saved region too. 
                // But `api/monitoring/stats` takes region/division params.
                effectiveDivision = impLoc;
                // We might need to look up the region for this division if backend requires it strictly.
                // However, most endpoints just filter by what's provided.
            }
        }

        try {
            // Determine params based on Role
            let queryRegion = region;
            let queryDivision = division;
            // Use passed district if defined (even empty string), otherwise fallback to state
            let queryDistrict = district !== undefined ? district : coDistrict;

            if (effectiveRole === 'Central Office') {
                // If in National View (no region selected), fetch Regional Overview
                // However, we only need to fetch detailed stats if a region IS selected.

                if (region || coRegion) {
                    queryRegion = region !== undefined ? region : coRegion;
                    queryDivision = division !== undefined ? division : (coDivision || '');
                } else {
                    // NATIONAL VIEW: Fetch Regional Stats
                    const regionRes = await fetch('/api/monitoring/regions');
                    if (regionRes.ok) setRegionalStats(await regionRes.json());
                    setLoading(false);
                    return; // Stop here, don't fetch detailed stats yet
                }
            } else if (effectiveRole === 'Regional Office') {
                // Force queries to respect the effective region
                queryRegion = effectiveRegion;
                queryDivision = division; // Allows filtering within the region if implemented, else usually null
            } else if (effectiveRole === 'School Division Office') {
                // Force queries to respect the effective division
                if (isSuperUser) {
                    effectiveRegion = sessionStorage.getItem('impersonatedRegion') || effectiveRegion;
                }
                queryDivision = effectiveDivision;
                queryRegion = effectiveRegion;
            } else {
                // Fallback / Original
                queryRegion = currentUserData.region;
                queryDivision = currentUserData.division;
            }

            // FIX: For SDO and RO, we want the "Top Stats" to remain as Jurisdiction Overview even when drilling down.
            // Create a separate params object for the main stats that EXCLUDES drill-down filters.

            // 1. Base Params (Region/Division/District) - Used for LISTS and DRILL-DOWN data
            const params = new URLSearchParams({
                region: queryRegion || '',
                ...(queryDivision && { division: queryDivision }),
                ...(queryDistrict && { district: queryDistrict })
            });

            // FIX: For SDO, we want the "Top Stats" to remain as Division Overview even when drilling down to a district.
            // Create a separate params object for the main stats that EXCLUDES district.
            const statsParams = new URLSearchParams();

            if (effectiveRole === 'Regional Office') {
                // FORCE Region Level Stats
                statsParams.append('region', effectiveRegion || '');
                // Explicitly DO NOT append division even if selected (drilled down)
            } else if (effectiveRole === 'School Division Office') {
                // FORCE Division Level Stats
                statsParams.append('region', effectiveRegion || ''); // Some endpoints might need region context
                statsParams.append('division', effectiveDivision || '');
                // Explicitly DO NOT append district
            } else {
                // Central Office / Super User Default: Follow the Drill Down
                if (queryRegion) statsParams.append('region', queryRegion);
                if (queryDivision) statsParams.append('division', queryDivision);
                // Note: CO usually wants to see stats for the drilled down level?
                // Request says "Regional Office and Schools Division Office dashboards... freeze". 
                // Implies CO might still want dynamic? 
                // "only show Regional summary for the Regional Office and then SDO summary the Schools Division Office"
                // So CO behavior remains dynamic (shows stats for what's viewed).
            }

            const fetchPromises = [
                // Use statsParams for the main stats (Top Card)
                fetch(`/api/monitoring/stats?${statsParams.toString()}`),
                fetch(`/api/monitoring/engineer-stats?${statsParams.toString()}`),
                // Projects List should probably respect the FILTER (Drill Down) or the CARD (Overview)?
                // "freeze the jurisdiction overview cards"
                // Usually the cards show "Completed Forms: X/Y". 
                // The list below shows "Accomplishment Rate per School/District".
                // The `engineer-projects` endpoint is for the project list? NO, it's for infra stats? 
                // Wait, `engineer-projects` returns a list. `engineer-stats` returns summary.
                // `jurisdictionProjects` state is set from `engineer-projects`. 
                // If we want the *list* to filter, we should use `params`. 
                // If we want the *cards* (Infra Matrix?) to freeze, we use `statsParams`.
                // "Infra Projects Matrix" is a table. "Jurisdiction Overview" is the top card.
                // Let's assume `engineer-projects` is for the matrix/list and should filter?
                // Actually `engineer-projects` seems to be used for the textual stats or matrix?
                // Let's look at usage. `engStats` used in "Infra Projects" card. 
                // `jurisdictionProjects`... is it used? 
                // Line 253: `setJurisdictionProjects`. 
                // Usage search: It's NOT USED in the rendered JSX in the snippet I read? 
                // Ah, wait. `engineer-projects` endpoint returns list of projects. 
                // `fetching` logic in `fetchData`:
                // `fetch('/api/monitoring/engineer-projects?${statsParams.toString()}')`
                // If "Jurisdiction Overview" includes Infra stats, then `engineer-stats` needs `statsParams`.
                // `engineer-projects`... might be heavy if getting all? 
                // Let's keep `engineer-projects` on `statsParams` if it feeds the "Infra Projects" card counts. 
                // If it feeds a list, it should be `params`.
                // Logic check: "Infra Projects Matrix" (Section 2) iterates `regionalStats` (from `/api/monitoring/regions`?). No.
                // Section 2 code (Line 826): Uses `regionalStats`. 
                // Where is `engStats` used? Line 745 (Delayed), Line 1169 (Infra Projects Card).
                // So `engStats` is for the CARD. It should be FROZEN. -> statsParams.
                // `jurisdictionProjects`... not seeing explicit usage in the cards? 
                // Let's stick to `statsParams` for `engineer-projects` to be safe/consistent with `engineer-stats`.

                fetch(`/api/monitoring/engineer-projects?${statsParams.toString()}`)
            ];

            // Fetch Division Stats for Regional Office OR Central Office (when drilling down to a region)
            // This populates the "Accomplishment Rate per School Division" list. 
            // This SHOULD change on drill down? 
            // Attempting to list Divisions. queryRegion is set.
            if (effectiveRole === 'Regional Office' || (effectiveRole === 'Central Office' && queryRegion && !queryDivision)) {
                // If RO drills to Division, this list (of divisions) might disappear or be replaced by school list.
                // The existing logic `!coDivision` (Line 1187) hides it when division selected.
                // So the specific fetch here (Division Stats) is for the LIST. 
                // It should use `params`. (Which includes region, excludes division if null).
                fetchPromises.push(fetch(`/api/monitoring/division-stats?${params.toString()}`));
            }

            // Fetch District Stats only for SDO or CO (when Division is selected)
            if (effectiveRole === 'School Division Office' || (effectiveRole === 'Central Office' && queryDivision)) {
                fetchPromises.push(fetch(`/api/monitoring/district-stats?${params.toString()}`));
            }

            const results = await Promise.all(fetchPromises);
            const statsRes = results[0];
            const engStatsRes = results[1];
            const projectsRes = results[2];
            // ... (rest is same)

            // ... (Variable assignments need to match the array indices, which didn't change order)
            // Re-mapping results to match original variable names for clarity in replacement

            const divStatsRes = effectiveRole === 'Regional Office' || (effectiveRole === 'Central Office' && queryRegion && !queryDivision) ? results[3] : null;
            const distStatsRes = effectiveRole === 'School Division Office' || (effectiveRole === 'Central Office' && queryDivision) ? results[3] : null;

            if (statsRes.ok) setStats(await statsRes.json());
            if (engStatsRes.ok) setEngStats(await engStatsRes.json());
            if (projectsRes.ok) setJurisdictionProjects(await projectsRes.json());
            if (divStatsRes && divStatsRes.ok) setDivisionStats(await divStatsRes.json());
            if (distStatsRes && distStatsRes.ok) setDistrictStats(await distStatsRes.json());
        } catch (err) {
            console.error("Dashboard Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Load Location Data for filters
        setAvailableRegions(Object.keys(locationData).sort());

        // Load Schools Data for Division filtering
        Papa.parse(`${import.meta.env.BASE_URL}schools.csv`, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.data && results.data.length > 0) {
                    setSchoolData(results.data);

                    // Aggregate Totals by Region
                    const totals = {};
                    results.data.forEach(row => {
                        if (row.region) {
                            totals[row.region] = (totals[row.region] || 0) + 1;
                        }
                    });
                    setCsvRegionalTotals(totals);
                }
            }
        });
    }, []);

    // NEW: Handle Active Tab from Navigation State
    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);

            if (location.state.resetFilters) {
                setCoRegion('');
                setCoDivision('');
                setCoDistrict('');
                // Fetch Data for National View (empty params)
                fetchData('', '');
            }
        }
    }, [location.state]);

    // Effect for Central Office: Update divisions when Region changes
    useEffect(() => {
        // REMOVED: Auto-select Region NCR. Now defaults to National View.

        if (userData?.role === 'Central Office' && coRegion && schoolData.length > 0) {
            const divisions = [...new Set(schoolData
                .filter(s => s.region === coRegion)
                .map(s => s.division))]
                .sort();
            setAvailableDivisions(divisions);
        } else {
            setAvailableDivisions([]);
        }
    }, [coRegion, schoolData, userData]);

    // NEW: Update Districts when Division changes
    useEffect(() => {
        // SUPER USER CHECK FOR EFFECTIVE ROLE
        const effectiveRole = (userData?.role === 'Super User' && sessionStorage.getItem('impersonatedRole'))
            ? sessionStorage.getItem('impersonatedRole')
            : userData?.role;

        if (effectiveRole === 'Central Office' && coDivision && schoolData.length > 0) {
            const districts = [...new Set(schoolData
                .filter(s => s.region === coRegion && s.division === coDivision)
                .map(s => s.district))]
                .sort();
            setAvailableDistricts(districts);
        } else {
            setAvailableDistricts([]);
        }
    }, [coDivision, coRegion, schoolData, userData]);

    const handleFilterChange = (region) => {
        setCoRegion(region); // Set empty string for National View
        setCoDivision(''); // Reset division when region changes
        setCoDistrict(''); // Reset district
        fetchData(region, '');
    };

    const handleDivisionChange = async (division) => {
        setCoDivision(division);
        setCoDistrict(''); // Reset district
        setSchoolSearch(''); // Reset search
        setSchoolPage(1); // Reset pagination

        // NEW: For Regional Office, fetch schools immediately (Skip District)
        // SUPER USER CHECK
        const effectiveRole = (userData?.role === 'Super User' && sessionStorage.getItem('impersonatedRole'))
            ? sessionStorage.getItem('impersonatedRole')
            : userData?.role;

        const effectiveRegion = (userData?.role === 'Super User' && effectiveRole === 'Regional Office')
            ? sessionStorage.getItem('impersonatedLocation')
            : (userData?.role === 'Regional Office' ? userData?.region : coRegion);

        // UNIFIED: Fetch Schools for both RO and CO when a division is selected
        if (effectiveRole === 'Regional Office' || (effectiveRole === 'Central Office' && division)) {
            setLoadingDistrict(true);
            try {
                // Determine Region
                const targetRegion = effectiveRole === 'Central Office' ? coRegion : effectiveRegion;

                // Fetch ALL schools in this division (API Data)
                const res = await fetch(`/api/monitoring/schools?region=${encodeURIComponent(targetRegion)}&division=${encodeURIComponent(division)}&limit=1000`);
                let apiSchools = [];
                if (res.ok) {
                    const data = await res.json();
                    apiSchools = Array.isArray(data) ? data : (data.data || []);
                }

                // MERGE: Combine CSV Master List with API Data
                // Filter CSV for this region/division
                const masterList = schoolData.filter(s =>
                    normalizeLocationName(s.region) === normalizeLocationName(targetRegion) &&
                    normalizeLocationName(s.division) === normalizeLocationName(division)
                );

                // 1. Map CSV Schools (Existing Logic)
                const csvMapped = masterList.map(csvSchool => {
                    // Find matching API record (by School ID preferred, or Name)
                    const apiMatch = apiSchools.find(api =>
                        api.school_id === csvSchool.school_id ||
                        normalizeLocationName(api.school_name) === normalizeLocationName(csvSchool.school_name)
                    );

                    if (apiMatch) {
                        return apiMatch; // Return the full API record if validation exists
                    } else {
                        // Return Mock Object for Missing Schools
                        return {
                            school_name: csvSchool.school_name,
                            school_id: csvSchool.school_id,
                            district: csvSchool.district,
                            division: csvSchool.division,
                            // Set all statuses to false
                            profile_status: false,
                            head_status: false,
                            enrollment_status: false,
                            classes_status: false,
                            shifting_status: false,
                            personnel_status: false,
                            specialization_status: false,
                            resources_status: false,
                            learner_stats_status: false,
                            facilities_status: false,
                            submitted_by: null
                        };
                    }
                });

                // 2. Add API Schools that were NOT in CSV
                const csvIds = new Set(masterList.map(s => s.school_id));
                const csvNames = new Set(masterList.map(s => normalizeLocationName(s.school_name)));

                const extraApiSchools = apiSchools.filter(api =>
                    !csvIds.has(api.school_id) &&
                    !csvNames.has(normalizeLocationName(api.school_name))
                ).map(api => ({
                    ...api,
                    district: api.district || 'Unassigned District'
                }));

                const mergedSchools = [...csvMapped, ...extraApiSchools];

                // Sort by name
                mergedSchools.sort((a, b) => a.school_name.localeCompare(b.school_name));
                setDistrictSchools(mergedSchools);

            } catch (err) {
                console.error(err);
            } finally {
                setLoadingDistrict(false);
            }

            // Update Global Stats
            if (userData?.role === 'Super User') {
                fetchData(effectiveRegion, division);
            } else {
                fetchData(effectiveRole === 'Central Office' ? coRegion : userData.region, division);
            }
        } else {
            fetchData(coRegion, division);
        }
    };

    const handleDistrictChange = async (district) => {
        setCoDistrict(district);
        setSchoolSearch(''); // Reset search
        setSchoolPage(1); // Reset pagination

        if (district) {
            setLoadingDistrict(true);
            try {
                // Determine params
                const effectiveRole = (userData?.role === 'Super User' && sessionStorage.getItem('impersonatedRole'))
                    ? sessionStorage.getItem('impersonatedRole')
                    : userData?.role;

                let region, division;

                if (effectiveRole === 'Central Office') {
                    region = coRegion;
                    division = coDivision;
                } else if (userData?.role === 'Super User') {
                    // Try to find region from schoolData for this division if possible, or assume user context
                    division = coDivision || sessionStorage.getItem('impersonatedLocation'); // if SDO
                    // Actually handleDistrictChange is likely called within context where params are clearer
                    // But simplified here...
                    region = coRegion;
                    if (!region && schoolData.length > 0) {
                        const match = schoolData.find(s => s.division === division);
                        if (match) region = match.region;
                    }
                } else {
                    region = userData.region;
                    division = userData.division;
                }

                const res = await fetch(`/api/monitoring/schools?region=${region}&division=${division}&district=${district}&limit=1000`);
                let apiSchools = [];
                if (res.ok) {
                    const data = await res.json();
                    apiSchools = Array.isArray(data) ? data : (data.data || []);
                }

                // MERGE: Combine CSV Master List with API Data
                const masterList = schoolData.filter(s =>
                    normalizeLocationName(s.region) === normalizeLocationName(region) &&
                    normalizeLocationName(s.division) === normalizeLocationName(division) &&
                    normalizeLocationName(s.district) === normalizeLocationName(district)
                );

                // 1. Map CSV Schools (Existing Logic)
                const csvMapped = masterList.map(csvSchool => {
                    const apiMatch = apiSchools.find(api =>
                        api.school_id === csvSchool.school_id ||
                        normalizeLocationName(api.school_name) === normalizeLocationName(csvSchool.school_name)
                    );

                    if (apiMatch) {
                        return apiMatch;
                    } else {
                        return {
                            school_name: csvSchool.school_name,
                            school_id: csvSchool.school_id,
                            district: csvSchool.district,
                            profile_status: false,
                            head_status: false,
                            enrollment_status: false,
                            classes_status: false,
                            shifting_status: false,
                            personnel_status: false,
                            specialization_status: false,
                            resources_status: false,
                            learner_stats_status: false,
                            facilities_status: false,
                            submitted_by: null
                        };
                    }
                });

                // 2. Add API Schools that were NOT in CSV (Fix for SDO View consistency)
                const csvIds = new Set(masterList.map(s => s.school_id));
                const csvNames = new Set(masterList.map(s => normalizeLocationName(s.school_name)));

                const extraApiSchools = apiSchools.filter(api =>
                    !csvIds.has(api.school_id) &&
                    !csvNames.has(normalizeLocationName(api.school_name))
                ).map(api => ({
                    ...api,
                    district: api.district || district
                }));

                const mergedSchools = [...csvMapped, ...extraApiSchools];
                mergedSchools.sort((a, b) => a.school_name.localeCompare(b.school_name));
                setDistrictSchools(mergedSchools);

            } catch (error) {
                console.error("Failed to fetch district schools:", error);
            } finally {
                setLoadingDistrict(false);
            }
        } else {
            setDistrictSchools([]);
        }

        // Trigger global stats fetch (pass explicit district to avoid stale state)
        setTimeout(() => fetchData(undefined, undefined, district), 0);
    };

    // Better: Add useEffect for Filters
    useEffect(() => {
        const effectiveRole = (userData?.role === 'Super User' && sessionStorage.getItem('impersonatedRole'))
            ? sessionStorage.getItem('impersonatedRole')
            : userData?.role;

        if (effectiveRole === 'Central Office' && (coDistrict || coDivision || coRegion)) {
            fetchData(coRegion, coDivision);
        }
    }, [coDistrict, coDivision, coRegion, userData]);

    const StatCard = ({ title, value, total, color, icon: Icon }) => {
        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl ${color} bg-opacity-10 dark:bg-opacity-20`}>
                        <Icon className={color.replace('bg-', 'text-')} size={24} />
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{percentage}%</span>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{value} / {total}</p>
                    </div>
                </div>
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300">{title}</h3>
                <div className="mt-3 w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${color} transition-all duration-1000`}
                        style={{ width: `${percentage}%` }}
                    ></div>
                </div>
            </div>
        );
    };

    // NEW: Calculate Jurisdiction Total (Memoized for reuse)
    // FIX: Freezing the total logic
    const jurisdictionTotal = useMemo(() => {
        let csvTotal = 0;
        if (schoolData.length > 0 && userData) {
            const effectiveRole = (userData?.role === 'Super User' && sessionStorage.getItem('impersonatedRole'))
                ? sessionStorage.getItem('impersonatedRole')
                : userData?.role;

            let targetRegion, targetDivision;

            // Determine Scope based on Role (Frozen for RO/SDO)
            if (effectiveRole === 'Central Office') {
                targetRegion = coRegion;
                targetDivision = coDivision;
            } else if (effectiveRole === 'Regional Office') {
                // FORCE Region Scope (Ignore coDivision drill-down)
                targetRegion = (userData?.role === 'Super User') ? sessionStorage.getItem('impersonatedLocation') : userData?.region;
                targetDivision = null; // Explicitly ignore division
            } else if (effectiveRole === 'School Division Office') {
                // FORCE Division Scope (Ignore coDistrict drill-down)
                targetDivision = (userData?.role === 'Super User') ? sessionStorage.getItem('impersonatedLocation') : userData?.division;
                // We likely need to find the region for this division from schoolData to filter accurately if needed, 
                // or just filter by division (usually unique enough). 
                // Ideally setup targetRegion too.
            } else {
                targetRegion = userData.region;
                targetDivision = userData.division;
            }

            const targetDistrict = effectiveRole === 'Central Office' ? coDistrict : null; // Ignore district for RO/SDO

            csvTotal = schoolData.filter(s => {
                const matchRegion = !targetRegion || normalizeLocationName(s.region) === normalizeLocationName(targetRegion);
                const matchDivision = !targetDivision || normalizeLocationName(s.division) === normalizeLocationName(targetDivision);
                // Use normalizeLocationName for safety if imported
                const matchDistrict = !targetDistrict || s.district === targetDistrict;
                return matchRegion && matchDivision && matchDistrict;
            }).length;
        }
        // FIX: Use MAX of CSV count or DB count. 
        const dbTotal = parseInt(stats?.total_schools || 0);
        return Math.max(csvTotal, dbTotal);
    }, [schoolData, userData, coRegion, coDivision, coDistrict, stats?.total_schools]);

    // NEW: Determine Insight Chart Data Source (Division vs District)
    const isDistrictView = useMemo(() => {
        // Log logic for debugging
        // console.log("Checking View Level:", { effectiveRole, coDivision });

        if (effectiveRole === 'School Division Office') return true;
        // Even if RO drill down isn't fully supported in UI yet, this logic prepares for it
        if (effectiveRole === 'Regional Office' && coDivision) return true;
        if (effectiveRole === 'Central Office' && coDivision) return true;
        return false;
    }, [effectiveRole, coDivision]);

    const insightChartData = useMemo(() => {
        return isDistrictView ? districtStats : divisionStats;
    }, [isDistrictView, districtStats, divisionStats]);

    const insightLabelKey = isDistrictView ? 'district' : 'division';

    const formatInsightLabel = (item) => {
        const val = item[insightLabelKey];
        if (!val) return 'Unknown';
        if (isDistrictView) {
            return val.toString().replace(/^District\s+of\s+/i, '').replace(/\s+District$/i, '').trim();
        }
        return val.toString().replace('Division of ', '').replace(' City', '').trim();
    };


    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    // --- RENDER NATIONAL VIEW (REGIONAL GRID) ---

    if (effectiveRole === 'Central Office' && !coRegion) {
        return (
            <PageTransition>
                <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 font-sans">
                    {/* --- NEW UPDATE MODAL --- */}
                    {isUpdateAvailable && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-5 relative overflow-hidden border border-emerald-200 dark:border-emerald-900/40">
                                {/* Glowing Background Effect */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>

                                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto text-emerald-500 mb-2 shadow-sm animate-pulse">
                                    <FiRefreshCw size={36} />
                                </div>

                                <div className="text-center space-y-2">
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">
                                        Update Available
                                    </h2>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                        A new version of InsightEd is ready. <br />Please reload to apply the latest changes.
                                    </p>
                                </div>

                                <button
                                    onClick={() => updateApp()}
                                    className="w-full py-3.5 bg-[#004A99] hover:bg-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:shadow-xl hover:scale-[1.02] transition-all active:scale-95"
                                >
                                    Reload Now
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Header */}
                    <div className="bg-gradient-to-br from-[#004A99] to-[#002D5C] p-8 pb-32 rounded-b-[3rem] shadow-2xl text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <FiTrendingUp size={200} />
                        </div>
                        <div className="relative z-10 max-w-7xl mx-auto">
                            <div className="flex justify-between items-end mb-6">
                                <div>
                                    <h1 className="text-4xl font-black tracking-tighter">{userData.bureau || 'Central Office'}</h1>
                                    <p className="text-blue-200 text-lg font-medium mt-1">
                                        {activeTab === 'infra' ? 'Infrastructure Project Monitoring' : 'National Accomplishment Overview'}
                                    </p>
                                </div>
                                <div className="hidden md:block text-right">
                                    <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">Current Scope</p>
                                    <p className="text-2xl font-bold">Philippines (National)</p>
                                </div>
                            </div>

                            {/* Global Quick Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">

                                {/* 1. InsightED Stats (Accomplishment Tab) */}
                                {activeTab === 'accomplishment' && (
                                    <>
                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 col-span-2">
                                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">National Accomplishment Rate</p>
                                            {/* Show Percentage */}
                                            {(() => {
                                                const csvSum = Object.values(csvRegionalTotals).length > 0
                                                    ? Object.values(csvRegionalTotals).reduce((a, b) => a + b, 0)
                                                    : 0;
                                                const dbSum = regionalStats.reduce((acc, curr) => acc + parseInt(curr.total_schools || 0), 0);

                                                // FIX: Use Max of CSV vs DB to ensure denominator >= numerator
                                                const totalSchools = Math.max(csvSum, dbSum);
                                                const completed = regionalStats.reduce((acc, curr) => acc + parseInt(curr.completed_schools || 0), 0);
                                                const pct = totalSchools > 0 ? ((completed / totalSchools) * 100).toFixed(1) : 0;
                                                return (
                                                    <div className="flex items-end gap-3">
                                                        <p className="text-4xl font-black mt-1">{pct}%</p>
                                                        <p className="text-sm opacity-70 mb-1 font-medium">{completed.toLocaleString()} of {totalSchools.toLocaleString()} Schools Complete</p>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </>
                                )}

                                {/* 2. Infra Stats (Infra Tab) */}
                                {activeTab === 'infra' && (
                                    <>
                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Total Projects</p>
                                            <p className="text-3xl font-black mt-1">{regionalStats.reduce((acc, curr) => acc + parseInt(curr.total_projects || 0), 0).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Ongoing Projects</p>
                                            <p className="text-3xl font-black mt-1 text-blue-400">{regionalStats.reduce((acc, curr) => acc + parseInt(curr.ongoing_projects || 0), 0).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Completed</p>
                                            <p className="text-3xl font-black mt-1 text-emerald-400">{regionalStats.reduce((acc, curr) => acc + parseInt(curr.completed_projects || 0), 0).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Delayed</p>
                                            <p className="text-3xl font-black mt-1 text-rose-400">
                                                {regionalStats && regionalStats.length > 0
                                                    ? regionalStats.reduce((acc, curr) => acc + parseInt(curr.delayed_projects || 0), 0).toLocaleString()
                                                    : (engStats?.delayed_count || 0)}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* --- SIMULATION MODE BUTTONS (Moved here for easier access) --- */}
                            {/* REMOVED: Replaced by context-specific buttons below as per user request */}
                        </div>
                    </div>

                    <div className="max-w-7xl mx-auto px-6 -mt-20 space-y-12 relative z-20 pb-20">
                        {regionalStats.length === 0 ? (
                            <div className="bg-white p-8 rounded-3xl text-center text-slate-400">Loading regional stats...</div>
                        ) : (
                            <>
                                {/* SECTION 1: REGIONAL PERFORMANCE (SCHOOL DATA) - INSIGHTED TAB */}
                                {activeTab === 'accomplishment' && (
                                    <div>
                                        <h2 className="text-black/60 dark:text-white/60 text-xs font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                            <FiCheckCircle className="text-blue-500" /> Regional Compliance Performance
                                        </h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {regionalStats.map((reg, idx) => {
                                                // REFACTOR: Use MAX of API total (DB) or CSV to prevent >100% overflow
                                                const apiTotal = parseInt(reg.total_schools || 0);
                                                const csvTotal = csvRegionalTotals[reg.region] || 0;
                                                const totalSchools = Math.max(apiTotal, csvTotal);

                                                const completedCount = reg.completed_schools || 0;

                                                // Handle edge case where backend total is 0 but we want to show 0/CSV_Total
                                                const completionRate = totalSchools > 0 ? Math.round((completedCount / totalSchools) * 100) : 0;

                                                return (
                                                    <div
                                                        key={idx}
                                                        onClick={() => handleFilterChange(reg.region)}
                                                        className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden"
                                                    >
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>

                                                        <div className="relative z-10">
                                                            <div className="flex justify-between items-start mb-6">
                                                                <div>
                                                                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-600 transition-colors">{reg.name || reg.region}</h2>
                                                                    {/* REMOVED: Total Schools sub-label if desired, but user said remove "Total Schools" metric. 
                                                                        Does that mean remove it from cards too? 
                                                                        "InsightED Accomplishment page should only feature (1) National Accomplishment Rate (2) Regional and division breakdown".
                                                                        Usually breakdown implies visualizing the counts or rate. I will keep the rate prominent.
                                                                        I will Hide the "X Schools" label if strictly interpreted, but it's useful context. 
                                                                        Let's keep the percentage prominent.
                                                                     */}
                                                                    <p className="text-xs font-bold text-slate-400 uppercase mt-1">Status Report</p>
                                                                </div>
                                                                <div className={`flex items-center justify-center w-12 h-12 rounded-full font-black text-sm border-4 ${completionRate >= 100 ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : (completionRate >= 50 ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-orange-500 text-orange-600 bg-orange-50')}`}>
                                                                    {completionRate}%
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3">
                                                                <div>
                                                                    <div className="flex justify-between text-xs font-bold mb-1">
                                                                        <span className="text-slate-500">Form Completion</span>
                                                                        <span className="text-slate-700 dark:text-slate-300">{completedCount} / {totalSchools.toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                                                        <div className={`h-full rounded-full ${completionRate >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${completionRate}%` }}></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* SECTION 2: INFRASTRUCTURE PROJECTS MATRIX - INFRA TAB */}
                                {activeTab === 'infra' && (
                                    <div>
                                        <div className="flex justify-between items-center mb-6">
                                            <h2 className="text-black/60 dark:text-white/60 text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                                <FiTrendingUp className="text-emerald-500" /> Infrastructure Projects Matrix
                                            </h2>
                                            <button
                                                onClick={() => navigate('/dummy-forms', { state: { type: 'engineer' } })}
                                                className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors flex items-center gap-2"
                                            >
                                                <FiCheckCircle size={14} className="text-amber-500" />
                                                Sample Engineer Forms
                                            </button>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden relative">
                                            <div className="overflow-x-auto custom-scrollbar">
                                                <table className="w-full text-left border-collapse min-w-[800px]">
                                                    <thead>
                                                        <tr className="text-[10px] uppercase font-black text-slate-400 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                                                            <th className="p-5 min-w-[180px] sticky left-0 bg-white dark:bg-slate-800 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Region</th>
                                                            <th className="p-5 text-center min-w-[100px]">Projects</th>
                                                            <th className="p-5 text-center min-w-[140px]">Total Allocation</th>
                                                            <th className="p-5 text-center text-slate-400 min-w-[100px]">Not Started</th>
                                                            <th className="p-5 text-center text-orange-400 min-w-[120px]">Under Proc.</th>
                                                            <th className="p-5 text-center text-blue-500 min-w-[100px]">Ongoing</th>
                                                            <th className="p-5 text-center text-emerald-500 min-w-[100px]">Completed</th>
                                                            <th className="p-5 text-center text-rose-500 min-w-[100px]">Delayed</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                        {regionalStats.map((reg, idx) => (
                                                            <tr key={idx} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-50 dark:border-slate-800 group">
                                                                <td className="p-5 sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors z-10 border-r border-slate-50 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] text-slate-700 dark:text-slate-100 font-extrabold">
                                                                    {reg.region}
                                                                </td>
                                                                <td className="p-5 text-center text-base">{reg.total_projects}</td>
                                                                <td className="p-5 text-center font-mono text-slate-500 text-[11px]">
                                                                    ₱{parseInt(reg.total_allocation || 0).toLocaleString()}
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleProjectDrillDown(reg.region, 'Not Yet Started'); }}
                                                                        className="w-full py-2 px-3 rounded-lg text-slate-500 bg-slate-50/50 hover:bg-slate-100/80 hover:scale-105 active:scale-95 transition-all font-black shadow-sm"
                                                                    >
                                                                        {reg.not_yet_started_projects || 0}
                                                                    </button>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleProjectDrillDown(reg.region, 'Under Procurement'); }}
                                                                        className="w-full py-2 px-3 rounded-lg text-orange-500 bg-orange-50/50 hover:bg-orange-100/80 hover:scale-105 active:scale-95 transition-all font-black shadow-sm"
                                                                    >
                                                                        {reg.under_procurement_projects || 0}
                                                                    </button>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleProjectDrillDown(reg.region, 'Ongoing'); }}
                                                                        className="w-full py-2 px-3 rounded-lg text-blue-600 bg-blue-50/50 hover:bg-blue-100/80 hover:scale-105 active:scale-95 transition-all font-black shadow-sm"
                                                                    >
                                                                        {reg.ongoing_projects}
                                                                    </button>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleProjectDrillDown(reg.region, 'Completed'); }}
                                                                        className="w-full py-2 px-3 rounded-lg text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100/80 hover:scale-105 active:scale-95 transition-all font-black shadow-sm"
                                                                    >
                                                                        {reg.completed_projects}
                                                                    </button>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleProjectDrillDown(reg.region, 'Delayed'); }}
                                                                        className="w-full py-2 px-3 rounded-lg text-rose-500 bg-rose-50/50 hover:bg-rose-100/80 hover:scale-105 active:scale-95 transition-all font-black shadow-sm"
                                                                    >
                                                                        {reg.delayed_projects}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <BottomNav userRole={userData?.role} />
                </div>
                {/* PROJECT LIST MODAL (NATIONAL VIEW) */}
                {projectListModal.isOpen && (
                    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white">{projectListModal.title}</h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{projectListModal.projects.length} Projects Found</p>
                                </div>
                                <button
                                    onClick={() => setProjectListModal(prev => ({ ...prev, isOpen: false }))}
                                    className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
                                >
                                    <FiX />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {projectListModal.isLoading ? (
                                    <div className="flex justify-center py-10">
                                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {projectListModal.projects.map((p) => (
                                            <div key={p.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:border-blue-200 transition-colors">
                                                <div>
                                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 transition-colors">{p.schoolName}</h4>
                                                    <p className="text-xs text-slate-500 italic">{p.projectName}</p>
                                                    {p.projectAllocation && (
                                                        <p className="text-[10px] font-mono text-slate-400 mt-1">
                                                            Alloc: ₱{Number(p.projectAllocation).toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase mb-1 ${p.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' :
                                                        p.status === 'Delayed' ? 'bg-rose-100 text-rose-600' :
                                                            'bg-blue-100 text-blue-600'
                                                        }`}>
                                                        {p.status}
                                                    </span>
                                                    <div className="text-xs font-black text-slate-700 dark:text-slate-300">
                                                        {p.accomplishmentPercentage}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {projectListModal.projects.length === 0 && (
                                            <p className="text-center text-slate-400 italic py-10">No projects found for this category.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </PageTransition>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 font-sans">
                {/* --- NEW UPDATE MODAL --- */}
                {isUpdateAvailable && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-5 relative overflow-hidden border border-emerald-200 dark:border-emerald-900/40">
                            {/* Glowing Background Effect */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>

                            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto text-emerald-500 mb-2 shadow-sm animate-pulse">
                                <FiRefreshCw size={36} />
                            </div>

                            <div className="text-center space-y-2">
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">
                                    Update Available
                                </h2>
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                    A new version of InsightEd is ready. <br />Please reload to apply the latest changes.
                                </p>
                            </div>

                            <button
                                onClick={() => updateApp()}
                                className="w-full py-3.5 bg-[#004A99] hover:bg-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:shadow-xl hover:scale-[1.02] transition-all active:scale-95"
                            >
                                Reload Now
                            </button>
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="bg-gradient-to-br from-[#004A99] to-[#002D5C] p-6 pb-20 rounded-b-[3rem] shadow-xl text-white relative overflow-hidden">
                    {/* REMOVED BACKGROUND ICON as per user request */}


                    <div className="relative z-10">
                        {effectiveRole === 'Central Office' ? (
                            <>
                                <div className="flex items-center gap-2 mb-4">
                                    {(coRegion || coDivision || coDistrict) && (
                                        <button
                                            onClick={() => {
                                                if (coDistrict) handleDistrictChange(''); // Back to Division View
                                                else if (coDivision) handleDivisionChange(''); // Back to Regional View
                                                else if (coRegion) handleFilterChange(''); // Back to National View
                                            }}
                                            className="mr-2 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition flex items-center justify-center group"
                                            title="Go Back"
                                        >
                                            <FiArrowLeft className="text-lg group-hover:-translate-x-0.5 transition-transform" />
                                        </button>
                                    )}

                                    <div>
                                        <h1 className="text-3xl font-black tracking-tight">{userData.bureau || 'Central Office'}</h1>
                                        <p className="text-blue-100/70 text-sm mt-1 font-bold uppercase tracking-widest">
                                            {coDistrict ? `${coDistrict}, ${coDivision}` : (coDivision ? `${coDivision} Division` : (coRegion ? `${coRegion}` : 'National View'))}
                                        </p>
                                    </div>
                                </div>

                                {/* --- REGIONAL VIEW ACTION: SCHOOL HEAD SIMULATION --- */}
                                {(coRegion || coDivision) && (
                                    <div className="mt-2 text-right md:absolute md:top-6 md:right-32 md:mt-0">
                                        <button
                                            onClick={() => navigate('/dummy-forms', { state: { type: 'school' } })}
                                            className="text-[10px] font-black text-blue-100 uppercase tracking-widest bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-400/30 hover:bg-blue-500/30 transition-colors flex items-center gap-2"
                                        >
                                            <TbSchool size={16} className="text-blue-200" />
                                            <span>Sample School Head Forms</span>
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-2 opacity-80">
                                    <FiMapPin size={14} />
                                    <span className="text-xs font-bold uppercase tracking-widest">
                                        {effectiveRole === 'Regional Office'
                                            ? (effectiveRegion?.toString().toLowerCase().includes('region') ? effectiveRegion : `Region ${effectiveRegion}`)
                                            : `SDO ${(effectiveDivision || userData?.division)?.toString().replace(/\s+Division$/i, '')}`
                                        }
                                    </span>
                                </div>
                                <h1 className="text-3xl font-black tracking-tight">Monitoring</h1>
                                <p className="text-blue-100/70 text-sm mt-1">Status of schools & infrastructure.</p>
                            </>
                        )}

                        {/* MANUAL REFRESH BUTTON (For RO/SDO/CO) */}
                        <div className="absolute bottom-1 right-0">
                            <button
                                onClick={() => { setLoading(true); fetchData(); }}
                                className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all hover:rotate-180 active:scale-95"
                                title="Refresh Data"
                            >
                                <FiRefreshCw size={18} />
                            </button>
                        </div>
                    </div>


                    {/* Tabs - Hidden for SDO AND RO as they use Bottom Nav. Also hidden for Central Office when drilling down to a region. */}
                    {effectiveRole !== 'School Division Office' && effectiveRole !== 'Regional Office' && !(effectiveRole === 'Central Office' && coRegion) && (
                        <div className="flex gap-2 mt-8 relative z-10">
                            {['all', 'school', 'engineer', 'insights'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab
                                        ? 'bg-white text-[#004A99] shadow-lg'
                                        : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-5 -mt-10 space-y-6 relative z-20">
                    {/* HOME TAB (Previously ALL) - NOW SHARED FOR REGIONAL/DIVISION VIEWS */}
                    {(activeTab === 'all' || activeTab === 'home' || activeTab === 'accomplishment' || activeTab === 'infra') && (
                        <>
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Jurisdiction Overview</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {(activeTab === 'all' || activeTab === 'home' || activeTab === 'accomplishment') && (
                                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl col-span-1">
                                            {(() => {
                                                // Use Memoized Jurisdiction Total
                                                const displayTotal = jurisdictionTotal;

                                                // Get Completed Schools Count (from API Update)
                                                const completedCount = parseInt(stats?.completed_schools_count || 0);

                                                // Calculate Percentage
                                                const percentage = displayTotal > 0 ? ((completedCount / displayTotal) * 100).toFixed(1) : 0;

                                                return (
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <span className="text-3xl font-black text-[#004A99] dark:text-blue-400">
                                                                {percentage}%
                                                            </span>
                                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">
                                                                Completed Forms <br />
                                                                <span className="text-[#004A99] dark:text-blue-300">({completedCount} / {displayTotal})</span>
                                                            </p>
                                                        </div>
                                                        {(activeTab === 'accomplishment' || activeTab === 'all' || activeTab === 'home') && <TbTrophy size={40} className="text-blue-200" />}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {/* NEW: System Validated % (Next to Accomplishment) */}
                                    {(activeTab === 'all' || activeTab === 'home' || activeTab === 'accomplishment') && (
                                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl col-span-1">
                                            {(() => {
                                                const displayTotal = jurisdictionTotal;
                                                const validatedCount = parseInt(stats?.validated_schools_count || 0);
                                                const percentage = displayTotal > 0 ? ((validatedCount / displayTotal) * 100).toFixed(1) : 0;

                                                return (
                                                    <div className="flex items-center justify-between h-full">
                                                        <div>
                                                            <span className="text-3xl font-black text-purple-600 dark:text-purple-400">
                                                                {percentage}%
                                                            </span>
                                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">
                                                                System Validated <br />
                                                                <span className="text-purple-600 dark:text-purple-300">({validatedCount} / {displayTotal})</span>
                                                            </p>
                                                        </div>
                                                        <FiCheckCircle size={40} className="text-purple-200" />
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {(activeTab === 'infra') && (
                                        <div className={`p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl ${activeTab === 'infra' ? 'col-span-2' : ''}`}>
                                            <div className="flex flex-col h-full justify-center">
                                                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{engStats?.total_projects || 0}</span>
                                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">Infra Projects</p>

                                                {/* Completed Projects % */}
                                                {engStats?.total_projects > 0 && (
                                                    <div className="mt-2 text-[10px] font-bold text-emerald-700/70 dark:text-emerald-300/70">
                                                        {Math.round(((engStats.completed_count || 0) / engStats.total_projects) * 100)}% Completed
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Accomplishment Rate per School Division (Regional Office Only OR Central Office Regional View) */}
                            {/* ONLY SHOW FOR INSIGHTED ACCOMPLISHMENT TAB */}
                            {(activeTab === 'all' || activeTab === 'home' || activeTab === 'accomplishment') &&
                                !coDivision &&
                                (effectiveRole === 'Regional Office' || (effectiveRole === 'Central Office' && coRegion)) && (
                                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700 mt-6">
                                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Accomplishment Rate per School Division</h2>
                                        {(() => {
                                            // 1. Get List of Divisions for Current Region from CSV Data
                                            const targetRegion = effectiveRole === 'Central Office' ? coRegion : effectiveRegion;

                                            // MERGE Divisions: Use both CSV and API to find all divisions
                                            const targetRegionName = normalizeLocationName(targetRegion);
                                            const csvDivisions = [...new Set(schoolData
                                                .filter(s => normalizeLocationName(s.region) === targetRegionName)
                                                .map(s => s.division))];

                                            const apiDivisions = divisionStats.map(d => d.division);
                                            const regionDivisions = [...new Set([...csvDivisions, ...apiDivisions])].sort();

                                            if (regionDivisions.length === 0) {
                                                return <p className="text-sm text-slate-400 italic">No division data available / No schools found.</p>;
                                            }

                                            return (
                                                <div className="space-y-4">
                                                    {regionDivisions.map((divName, idx) => {
                                                        // 3. Get Completed Count from Backend Stats
                                                        const startStat = divisionStats.find(d => normalizeLocationName(d.division) === normalizeLocationName(divName));
                                                        const completedCount = startStat ? parseInt(startStat.completed_schools || 0) : 0;
                                                        const validatedCount = startStat ? parseInt(startStat.validated_schools || 0) : 0;

                                                        // 2. Calculate Total Schools
                                                        // Use API Total if available and higher than CSV (to include new schools)
                                                        const apiTotal = startStat ? parseInt(startStat.total_schools || 0) : 0;

                                                        const csvTotal = schoolData.filter(s =>
                                                            s.region === targetRegion && s.division === divName
                                                        ).length;

                                                        // Fix: Use Math.max to avoid undercounting if API has fewer synced schools than CSV
                                                        const totalSchools = Math.max(csvTotal, apiTotal);

                                                        // 4. Calculate Percentage (User Logic: Completed Schools / Total Schools)
                                                        // Clamp to 100%
                                                        const rawPercentage = totalSchools > 0 ? (completedCount / totalSchools) * 100 : 0;
                                                        // Use toFixed(1) to avoid rounding up to 100%
                                                        const percentage = totalSchools > 0 ? Math.min(rawPercentage, 100).toFixed(1) : 0;

                                                        // Validation Percentages for Stacked Bar
                                                        const validatedPct = totalSchools > 0 ? (validatedCount / totalSchools) * 100 : 0;

                                                        // For Validation: Use the for_validation_schools field from API
                                                        const forValidationCount = parseInt(startStat?.for_validation_schools || 0);
                                                        const forValidationPct = totalSchools > 0 ? (forValidationCount / totalSchools) * 100 : 0;

                                                        // Define colors for progress bars (cycling)
                                                        const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500'];
                                                        const color = colors[idx % colors.length];

                                                        return (
                                                            <div
                                                                key={divName}
                                                                onClick={() => {
                                                                    // UNIFIED HANDLER: Both RO and CO use handleDivisionChange
                                                                    handleDivisionChange(divName);
                                                                }}
                                                                className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group"
                                                            >
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <div>
                                                                        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-blue-600 transition-colors">{divName}</h3>
                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                                                            {completedCount} / {totalSchools} Completed
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-lg font-black text-slate-700 dark:text-slate-200">{percentage}%</span>
                                                                        <p className="text-[9px] font-bold text-slate-400">({Math.round(validatedPct)}% Validated)</p>
                                                                    </div>
                                                                </div>
                                                                {/* Stacked Progress Bar */}
                                                                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden flex mb-2">
                                                                    <div
                                                                        className={`h-full ${color} transition-all duration-1000`}
                                                                        style={{ width: `${validatedPct}%` }}
                                                                        title={`System Validated: ${validatedCount}`}
                                                                    ></div>
                                                                    <div
                                                                        className={`h-full bg-rose-400/80 transition-all duration-1000`}
                                                                        style={{ width: `${forValidationPct}%` }}
                                                                        title={`Critical Issues: ${forValidationCount}`}
                                                                    ></div>
                                                                </div>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase">
                                                                    <span className="text-emerald-500">{validatedCount} Validated</span> • <span className="text-rose-500">{forValidationCount} For Validation</span>
                                                                </p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                            {/* NEW: District Accomplishment Rate for SDO OR Central Office Division View */}
                            {/* SHOW FOR INSIGHTED ACCOMPLISHMENT TAB */}
                            {(activeTab === 'all' || activeTab === 'home' || activeTab === 'accomplishment') &&
                                (effectiveRole === 'School Division Office' || (effectiveRole === 'Central Office' && coDivision) || (effectiveRole === 'Regional Office' && coDivision)) && (
                                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700 mt-6">
                                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                                            {(coDistrict || (effectiveRole === 'Regional Office' && coDivision) || (effectiveRole === 'Central Office' && coDivision)) ? 'Accomplishment Rate per School' : 'Accomplishment Rate per District'}
                                        </h2>
                                        {(() => {
                                            // Determine Target Region:
                                            // 1. CO: Use selected Region
                                            // 2. RO: Use effectiveRegion
                                            // 3. SDO: Use effectiveRegion (if normal user) OR derive from SchoolData (if Super User impersonating SDO)
                                            const targetRegion = effectiveRole === 'Central Office'
                                                ? coRegion
                                                : (effectiveRegion || schoolData.find(s => s.division === effectiveDivision)?.region);

                                            // Determine Target Division:
                                            const targetDivision = (effectiveRole === 'Central Office' || effectiveRole === 'Regional Office')
                                                ? coDivision
                                                : effectiveDivision;

                                            // IF DISTRICT SELECTED OR REGIONAL OFFICE DRILL-DOWN: SHOW SCHOOLS
                                            if (coDistrict || (effectiveRole === 'Regional Office' && coDivision) || (effectiveRole === 'Central Office' && coDivision)) {
                                                if (loadingDistrict) {
                                                    return <div className="p-8 text-center text-slate-400 animate-pulse">Loading schools...</div>;
                                                }

                                                // Calculate Accomplishment Percentage for ALL Schools
                                                const schoolsWithStats = districtSchools.map(s => {
                                                    const checks = [
                                                        s.profile_status, s.head_status, s.enrollment_status,
                                                        s.classes_status, s.personnel_status, s.specialization_status,
                                                        s.resources_status, s.shifting_status, s.learner_stats_status,
                                                        s.facilities_status
                                                    ];

                                                    // REFACTOR: Use backend 'completion_percentage' directly as requested by user.
                                                    // This ensures a 1:1 match with the DB state.
                                                    let percentage = 0;
                                                    if (s.completion_percentage !== undefined && s.completion_percentage !== null) {
                                                        percentage = parseInt(s.completion_percentage);
                                                    }
                                                    // Fallback REMOVED to strictly follow "project into the progress bar the completion_percentage"
                                                    // If DB is 0 or null (handled by API as 0), it shows 0.

                                                    // Identify missing for tooltip/subtitle if needed
                                                    const missing = [];
                                                    if (!s.profile_status) missing.push("Profile");
                                                    if (!s.head_status) missing.push("School Head");
                                                    if (!s.enrollment_status) missing.push("Enrollment");
                                                    if (!s.classes_status) missing.push("Classes");
                                                    if (!s.personnel_status) missing.push("Personnel");
                                                    if (!s.specialization_status) missing.push("Specialization");
                                                    if (!s.resources_status) missing.push("Resources");
                                                    if (!s.shifting_status) missing.push("Modalities");
                                                    if (!s.learner_stats_status) missing.push("Learner Stats");
                                                    if (!s.facilities_status) missing.push("Facilities");

                                                    return { ...s, percentage, missing };
                                                });

                                                // Sort State (Local to this block? No, better to be at component level, but for now lets default and allow toggle)
                                                // Since we are inside a render function (bad practice usually, but following existing pattern), 
                                                // we will use a simple sort based on a variable we can't easily change via state without moving specific state up.
                                                // Ideally, `sortOption` should be a state variable in the main component. 
                                                // I'll add `sortOption` to the main component state in a separate edit if needed, 
                                                // but to be safe and clean, I should declare `sortOption` at the top. 
                                                // FOR NOW: I'll assume I can add the state in the next step or use a default sort here and add UI controls.
                                                // Actually, the user asked for a sort feature. I must add state.
                                                // I will use a ref or just hardcode a default for this step and then add the state variable in `MonitoringDashboard` top level.

                                                // FILTER & SORT
                                                const filteredSchools = schoolsWithStats.filter(s =>
                                                    s.school_name?.toLowerCase().includes(schoolSearch.toLowerCase()) ||
                                                    s.school_id?.includes(schoolSearch)
                                                );

                                                const sortedSchools = [...filteredSchools].sort((a, b) => {
                                                    if (schoolSort === 'name-asc') return a.school_name.localeCompare(b.school_name);
                                                    if (schoolSort === 'pct-desc') return b.percentage - a.percentage;
                                                    if (schoolSort === 'pct-asc') return a.percentage - b.percentage;
                                                    return 0;
                                                });

                                                // PAGINATION
                                                const ITEMS_PER_PAGE = 10;
                                                const totalPages = Math.ceil(sortedSchools.length / ITEMS_PER_PAGE);
                                                const startIndex = (schoolPage - 1) * ITEMS_PER_PAGE;
                                                const paginatedSchools = sortedSchools.slice(startIndex, startIndex + ITEMS_PER_PAGE);

                                                return (
                                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                                        {/* Header with Back Button */}
                                                        <div className="flex flex-col gap-4">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <button
                                                                        onClick={() => {
                                                                            if (effectiveRole === 'Regional Office') {
                                                                                handleDivisionChange(''); // Back to Division List
                                                                            } else if (effectiveRole === 'Central Office') {
                                                                                handleDivisionChange(''); // Back to Division List for CO
                                                                            } else {
                                                                                handleDistrictChange(''); // Back to District List
                                                                            }
                                                                        }}
                                                                        className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 transition"
                                                                    >
                                                                        <FiArrowLeft size={18} className="text-slate-600 dark:text-slate-300" />
                                                                    </button>
                                                                    <div>
                                                                        <h3 className="font-black text-xl text-slate-800 dark:text-white">
                                                                            {effectiveRole === 'Regional Office' || effectiveRole === 'Central Office' ? coDivision : coDistrict}
                                                                        </h3>
                                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{sortedSchools.length} Schools</p>
                                                                    </div>
                                                                </div>

                                                                {/* Sort Controls */}
                                                                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                                                                    <button
                                                                        onClick={() => setSchoolSort('name-asc')}
                                                                        className={`p-1.5 rounded-md text-xs font-bold transition ${schoolSort === 'name-asc' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-400'}`}
                                                                        title="Sort A-Z"
                                                                    >
                                                                        A-Z
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setSchoolSort('pct-desc')}
                                                                        className={`p-1.5 rounded-md text-xs font-bold transition ${schoolSort === 'pct-desc' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-300' : 'text-slate-400'}`}
                                                                        title="Sort % High-Low"
                                                                    >
                                                                        % High
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setSchoolSort('pct-asc')}
                                                                        className={`p-1.5 rounded-md text-xs font-bold transition ${schoolSort === 'pct-asc' ? 'bg-white dark:bg-slate-600 shadow text-rose-600 dark:text-rose-300' : 'text-slate-400'}`}
                                                                        title="Sort % Low-High"
                                                                    >
                                                                        % Low
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Search Box */}
                                                            <div className="relative">
                                                                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search school name or ID..."
                                                                    value={schoolSearch}
                                                                    onChange={(e) => {
                                                                        setSchoolSearch(e.target.value);
                                                                        setSchoolPage(1); // Reset to page 1 on search
                                                                    }}
                                                                    className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:font-normal placeholder:text-slate-400"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Unified School List (Paginated) */}
                                                        <div className="space-y-3 min-h-[400px]">
                                                            {paginatedSchools.map((s) => (
                                                                <div
                                                                    key={s.school_id}
                                                                    onClick={() => {
                                                                        if (userData?.role === 'Super User') {
                                                                            sessionStorage.setItem('targetSchoolId', s.school_id);
                                                                            sessionStorage.setItem('targetSchoolName', s.school_name);
                                                                            navigate('/school-audit');
                                                                        }
                                                                    }}
                                                                    className={`bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:border-blue-200 transition-colors ${userData?.role === 'Super User' ? 'cursor-pointer ring-2 ring-transparent hover:ring-blue-400' : ''}`}
                                                                >
                                                                    <div className="flex-1 min-w-0 pr-4">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-blue-600 transition-colors truncate">{s.school_name}</h4>
                                                                            {s.percentage === 100 && <FiCheckCircle className="text-emerald-500 shrink-0" size={14} />}

                                                                            {s.percentage === 0 && <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-md font-bold uppercase shrink-0">No Data</span>}
                                                                        </div>

                                                                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all duration-500 ${s.percentage === 100 ? 'bg-emerald-500' :
                                                                                    s.percentage >= 50 ? 'bg-blue-500' :
                                                                                        s.percentage > 0 ? 'bg-amber-500' : 'bg-slate-300'
                                                                                    }`}
                                                                                style={{ width: `${s.percentage}%` }}
                                                                            ></div>
                                                                        </div>

                                                                        <div className="space-y-1">
                                                                            {/* DATA HEALTH SCORE DISPLAY - MOVED BELOW BAR */}
                                                                            {(() => {
                                                                                // Default to 0 if undefined
                                                                                const score = s.data_health_score !== undefined ? s.data_health_score : 0;

                                                                                let colorClass = 'bg-slate-100 text-slate-600';
                                                                                let label = '';

                                                                                // 1. Determine Label & Color based on Score
                                                                                if (score <= 50) {
                                                                                    colorClass = 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400';
                                                                                    label = 'Major Data Anomalies';
                                                                                } else if (score <= 85) {
                                                                                    colorClass = 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
                                                                                    label = 'Minor Data Anomalies';
                                                                                } else if (score <= 99) {
                                                                                    colorClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
                                                                                    label = 'Minimal Data Anomalies';
                                                                                } else { // 100 or higher
                                                                                    colorClass = 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
                                                                                    label = 'Excellent';
                                                                                }

                                                                                return (
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase shrink-0 flex items-center gap-1 ${colorClass}`}>
                                                                                            <FiAlertCircle size={10} />
                                                                                            <span className="opacity-75">Score: {score}</span> • {label}
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            })()}

                                                                            {s.missing.length > 0 && s.missing.length < 10 && (
                                                                                <p className="text-[10px] text-slate-400 truncate">
                                                                                    Missing: {s.missing.join(', ')}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="text-right shrink-0">
                                                                        <span className={`text-xl font-black ${s.percentage === 100 ? 'text-emerald-500' :
                                                                            s.percentage >= 50 ? 'text-blue-500' :
                                                                                s.percentage > 0 ? 'text-amber-500' : 'text-slate-300'
                                                                            }`}>
                                                                            {s.percentage}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {paginatedSchools.length === 0 && (
                                                                <div className="text-center py-10 text-slate-400 italic">
                                                                    No schools found.
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Pagination Controls */}
                                                        {totalPages > 1 && (
                                                            <div className="flex justify-center items-center gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                                                                <button
                                                                    onClick={() => setSchoolPage(1)}
                                                                    disabled={schoolPage === 1}
                                                                    className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg text-slate-500 hover:border-blue-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:border-slate-100 dark:disabled:hover:border-slate-700 disabled:cursor-not-allowed transition-all active:scale-90"
                                                                    title="First Page"
                                                                >
                                                                    <FiChevronsLeft size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setSchoolPage(prev => Math.max(prev - 1, 1))}
                                                                    disabled={schoolPage === 1}
                                                                    className="px-4 py-2 flex items-center gap-2 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:border-slate-100 dark:disabled:hover:border-slate-700 disabled:cursor-not-allowed transition-all active:scale-95"
                                                                >
                                                                    <FiChevronLeft size={14} />
                                                                    <span>Prev</span>
                                                                </button>

                                                                <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-lg text-xs font-black text-slate-600 dark:text-slate-300">
                                                                    {schoolPage} <span className="text-slate-400 font-bold mx-1">/</span> {totalPages}
                                                                </div>

                                                                <button
                                                                    onClick={() => setSchoolPage(prev => Math.min(prev + 1, totalPages))}
                                                                    disabled={schoolPage === totalPages}
                                                                    className="px-4 py-2 flex items-center gap-2 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:border-slate-100 dark:disabled:hover:border-slate-700 disabled:cursor-not-allowed transition-all active:scale-95"
                                                                >
                                                                    <span>Next</span>
                                                                    <FiChevronRight size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setSchoolPage(totalPages)}
                                                                    disabled={schoolPage === totalPages}
                                                                    className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg text-slate-500 hover:border-blue-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:border-slate-100 dark:disabled:hover:border-slate-700 disabled:cursor-not-allowed transition-all active:scale-90"
                                                                    title="Last Page"
                                                                >
                                                                    <FiChevronsRight size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setSchoolPage(totalPages)}
                                                                    disabled={schoolPage === totalPages}
                                                                    title="Go to Last Page"
                                                                    className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-slate-600 dark:text-slate-300"
                                                                >
                                                                    &gt;&gt;
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            // DEFAULT: LIST OF DISTRICTS
                                            // 1. Get unique districts from CSV
                                            const divisionDistricts = [...new Set(schoolData
                                                .filter(s => s.region === targetRegion && s.division === targetDivision)
                                                .map(s => s.district))]
                                                .sort();

                                            if (divisionDistricts.length === 0) {
                                                return <p className="text-sm text-slate-400 italic">No district data available in Master List (CSV).</p>;
                                            }

                                            return (
                                                <div className="space-y-4">
                                                    {divisionDistricts.map((distName, idx) => {
                                                        // 2. Count Total from CSV
                                                        const csvTotal = schoolData.filter(s =>
                                                            s.region === targetRegion &&
                                                            s.division === targetDivision &&
                                                            s.district === distName
                                                        ).length;

                                                        // 3. Get API Stats for this District
                                                        const startStat = districtStats.find(d => {
                                                            return normalizeLocationName(d.district) === normalizeLocationName(distName);
                                                        });

                                                        const completedCount = startStat ? parseInt(startStat.completed_schools || 0) : 0;
                                                        const validatedCount = startStat ? parseInt(startStat.validated_schools || 0) : 0;
                                                        const apiTotal = startStat ? parseInt(startStat.total_schools || 0) : 0;

                                                        // Fix >100% Bug: Ensure total includes API count if it's higher than CSV
                                                        const totalSchools = Math.max(csvTotal, apiTotal);

                                                        // 4. Calculate Percentage (User Logic: Completed Schools / Total Schools)
                                                        // Clamp to 100% to prevent edge cases
                                                        const rawPercentage = totalSchools > 0 ? (completedCount / totalSchools) * 100 : 0;
                                                        // Use toFixed(1) to avoid rounding up to 100%
                                                        const percentage = totalSchools > 0 ? Math.min(rawPercentage, 100).toFixed(1) : 0;

                                                        // Validation Percentages for Stacked Bar
                                                        const validatedPct = totalSchools > 0 ? (validatedCount / totalSchools) * 100 : 0;
                                                        const forValidationCount = Math.max(0, completedCount - validatedCount);
                                                        const forValidationPct = totalSchools > 0 ? (forValidationCount / totalSchools) * 100 : 0;

                                                        // Colors
                                                        const colors = ['bg-orange-500', 'bg-cyan-500', 'bg-lime-500', 'bg-fuchsia-500', 'bg-indigo-500'];
                                                        const color = colors[idx % colors.length];

                                                        return (
                                                            <div
                                                                key={distName}
                                                                onClick={() => handleDistrictChange(distName)}
                                                                className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group"
                                                            >
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <div>
                                                                        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-blue-600 transition-colors">{distName}</h3>
                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                                                            {completedCount} / {totalSchools} Completed
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-lg font-black text-slate-700 dark:text-slate-200">{percentage}%</span>
                                                                        <p className="text-[9px] font-bold text-slate-400">({Math.round(validatedPct)}% Validated)</p>
                                                                    </div>
                                                                </div>
                                                                {/* Stacked Progress Bar */}
                                                                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden flex mb-2">
                                                                    <div
                                                                        className={`h-full ${color} transition-all duration-1000`}
                                                                        style={{ width: `${validatedPct}%` }}
                                                                        title={`System Validated: ${validatedCount}`}
                                                                    ></div>
                                                                    <div
                                                                        className={`h-full bg-slate-400 transition-all duration-1000`}
                                                                        style={{ width: `${forValidationPct}%` }}
                                                                        title={`For Validation: ${forValidationCount}`}
                                                                    ></div>
                                                                </div>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase">
                                                                    <span className="text-emerald-500">{validatedCount} Validated</span> • <span className="text-rose-500">{forValidationCount} For Validation</span>
                                                                </p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )
                            }
                        </>
                    )}

                    {/* INSIGHTS TAB */}
                    {(activeTab === 'insights') && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex justify-between items-center">
                                <h2 className="text-black/60 dark:text-white/60 text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                    <TbChartBar className="text-purple-500" size={18} /> Regional Insights
                                </h2>

                                {/* Selector for Metric */}
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Metric:</span>
                                        <select
                                            value={insightsMetric}
                                            onChange={(e) => setInsightsMetric(e.target.value)}
                                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                        >
                                            <option value="enrolment">Enrolment</option>
                                            <option value="aral">ARAL Program</option>
                                            <option value="organized_classes">Organized Classes</option>
                                            <option value="class_size">Class Size Standard</option>
                                            <option value="demographic">Learner Demographic</option>
                                            <option value="shifting">Shifting</option>
                                            <option value="delivery">Learning Delivery</option>
                                            <option value="adm">Emergency ADM</option>
                                            <option value="teachers">Teacher Count</option>
                                            <option value="multigrade">Multigrade Teachers</option>
                                            <option value="experience">Teaching Experience</option>
                                            <option value="specialization">Specialization</option>
                                            <option value="inventory">Equipment & Inventory</option>
                                            <option value="rooms">Specialized Rooms</option>
                                            <option value="classrooms">Classrooms</option>
                                            <option value="site">Site & Utilities</option>
                                        </select>
                                    </div>

                                    {/* Sub-Metric: Enrolment Grade Level */}
                                    {insightsMetric === 'enrolment' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Data:</span>
                                            <select
                                                value={insightsSubMetric}
                                                onChange={(e) => setInsightsSubMetric(e.target.value)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                            >
                                                <option value="total">All Levels</option>
                                                <option value="grade_kinder">Kindergarten</option>
                                                <option value="grade_1">Grade 1</option>
                                                <option value="grade_2">Grade 2</option>
                                                <option value="grade_3">Grade 3</option>
                                                <option value="grade_4">Grade 4</option>
                                                <option value="grade_5">Grade 5</option>
                                                <option value="grade_6">Grade 6</option>
                                                <option value="grade_7">Grade 7</option>
                                                <option value="grade_8">Grade 8</option>
                                                <option value="grade_9">Grade 9</option>
                                                <option value="grade_10">Grade 10</option>
                                                <option value="grade_11">Grade 11</option>
                                                <option value="grade_12">Grade 12</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Sub-Metric: Organize Classes Grade Level */}
                                    {insightsMetric === 'organized_classes' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Grade:</span>
                                            <select
                                                value={insightsClassesGrade}
                                                onChange={(e) => setInsightsClassesGrade(e.target.value)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                            >
                                                <option value="classes_kinder">Kindergarten</option>
                                                <option value="classes_grade_1">Grade 1</option>
                                                <option value="classes_grade_2">Grade 2</option>
                                                <option value="classes_grade_3">Grade 3</option>
                                                <option value="classes_grade_4">Grade 4</option>
                                                <option value="classes_grade_5">Grade 5</option>
                                                <option value="classes_grade_6">Grade 6</option>
                                                <option value="classes_grade_7">Grade 7</option>
                                                <option value="classes_grade_8">Grade 8</option>
                                                <option value="classes_grade_9">Grade 9</option>
                                                <option value="classes_grade_10">Grade 10</option>
                                                <option value="classes_grade_11">Grade 11</option>
                                                <option value="classes_grade_12">Grade 12</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Sub-Metric: Class Size Standard */}
                                    {insightsMetric === 'class_size' && (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Standard:</span>
                                                <select
                                                    value={insightsClassSizeCategory}
                                                    onChange={(e) => setInsightsClassSizeCategory(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    <option value="less">Less than Standard</option>
                                                    <option value="within">Within Standard</option>
                                                    <option value="above">More than Standard</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Grade:</span>
                                                <select
                                                    value={insightsClassSizeGrade}
                                                    onChange={(e) => setInsightsClassSizeGrade(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    <option value="kinder">Kindergarten</option>
                                                    <option value="g1">Grade 1</option>
                                                    <option value="g2">Grade 2</option>
                                                    <option value="g3">Grade 3</option>
                                                    <option value="g4">Grade 4</option>
                                                    <option value="g5">Grade 5</option>
                                                    <option value="g6">Grade 6</option>
                                                    <option value="g7">Grade 7</option>
                                                    <option value="g8">Grade 8</option>
                                                    <option value="g9">Grade 9</option>
                                                    <option value="g10">Grade 10</option>
                                                    <option value="g11">Grade 11</option>
                                                    <option value="g12">Grade 12</option>
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    {/* Sub-Metric: Learner Demographic */}
                                    {insightsMetric === 'demographic' && (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Category:</span>
                                                <select
                                                    value={insightsDemographicCategory}
                                                    onChange={(e) => setInsightsDemographicCategory(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    <option value="sned">SNED</option>
                                                    <option value="disability">Learners with Disability</option>
                                                    <option value="als">ALS</option>
                                                    <option value="muslim">Muslim</option>
                                                    <option value="ip">Indigenous People (IP)</option>
                                                    <option value="displaced">Displaced</option>
                                                    <option value="repetition">Repetition</option>
                                                    <option value="overage">Overage</option>
                                                    <option value="dropout">Dropouts</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Grade:</span>
                                                <select
                                                    value={insightsDemographicGrade}
                                                    onChange={(e) => setInsightsDemographicGrade(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    <option value="total">Total</option>
                                                    <option value="es">Elementary</option>
                                                    <option value="jhs">Junior High</option>
                                                    <option value="shs">Senior High</option>
                                                    <option disabled>──────────</option>
                                                    <option value="k">Kindergarten</option>
                                                    <option value="g1">Grade 1</option>
                                                    <option value="g2">Grade 2</option>
                                                    <option value="g3">Grade 3</option>
                                                    <option value="g4">Grade 4</option>
                                                    <option value="g5">Grade 5</option>
                                                    <option value="g6">Grade 6</option>
                                                    <option value="g7">Grade 7</option>
                                                    <option value="g8">Grade 8</option>
                                                    <option value="g9">Grade 9</option>
                                                    <option value="g10">Grade 10</option>
                                                    <option value="g11">Grade 11</option>
                                                    <option value="g12">Grade 12</option>
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    {/* Sub-Metric: Shifting */}
                                    {insightsMetric === 'shifting' && (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Category:</span>
                                                <select
                                                    value={insightsShiftingCategory}
                                                    onChange={(e) => setInsightsShiftingCategory(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    <option value="single">Single Shift</option>
                                                    <option value="double">Double Shift</option>
                                                    <option value="triple">Triple Shift</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Grade:</span>
                                                <select
                                                    value={insightsShiftingGrade}
                                                    onChange={(e) => setInsightsShiftingGrade(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    <option value="k">Kindergarten</option>
                                                    <option value="g1">Grade 1</option>
                                                    <option value="g2">Grade 2</option>
                                                    <option value="g3">Grade 3</option>
                                                    <option value="g4">Grade 4</option>
                                                    <option value="g5">Grade 5</option>
                                                    <option value="g6">Grade 6</option>
                                                    <option value="g7">Grade 7</option>
                                                    <option value="g8">Grade 8</option>
                                                    <option value="g9">Grade 9</option>
                                                    <option value="g10">Grade 10</option>
                                                    <option value="g11">Grade 11</option>
                                                    <option value="g12">Grade 12</option>
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    {/* Sub-Metric: Learning Delivery */}
                                    {insightsMetric === 'delivery' && (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Category:</span>
                                                <select
                                                    value={insightsDeliveryCategory}
                                                    onChange={(e) => setInsightsDeliveryCategory(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    <option value="inperson">In-Person</option>
                                                    <option value="blended">Blended Learning</option>
                                                    <option value="distance">Distance Learning</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Grade:</span>
                                                <select
                                                    value={insightsDeliveryGrade}
                                                    onChange={(e) => setInsightsDeliveryGrade(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    <option value="k">Kindergarten</option>
                                                    <option value="g1">Grade 1</option>
                                                    <option value="g2">Grade 2</option>
                                                    <option value="g3">Grade 3</option>
                                                    <option value="g4">Grade 4</option>
                                                    <option value="g5">Grade 5</option>
                                                    <option value="g6">Grade 6</option>
                                                    <option value="g7">Grade 7</option>
                                                    <option value="g8">Grade 8</option>
                                                    <option value="g9">Grade 9</option>
                                                    <option value="g10">Grade 10</option>
                                                    <option value="g11">Grade 11</option>
                                                    <option value="g12">Grade 12</option>
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    {/* Sub-Metric: Emergency ADM */}
                                    {insightsMetric === 'adm' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Type:</span>
                                            <select
                                                value={insightsAdmType}
                                                onChange={(e) => setInsightsAdmType(e.target.value)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                            >
                                                <option value="mdl">MDL (Modular Distance)</option>
                                                <option value="odl">ODL (Online Distance)</option>
                                                <option value="tvi">TVI/RBI (TV/Radio)</option>
                                                <option value="blended">Blended Learning</option>
                                            </select>
                                        </div>
                                    )}
                                    {insightsMetric === 'aral' && (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Grade:</span>
                                                <select
                                                    value={insightsAralGrade}
                                                    onChange={(e) => setInsightsAralGrade(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    <option value="g1">Grade 1</option>
                                                    <option value="g2">Grade 2</option>
                                                    <option value="g3">Grade 3</option>
                                                    <option value="g4">Grade 4</option>
                                                    <option value="g5">Grade 5</option>
                                                    <option value="g6">Grade 6</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Subject:</span>
                                                <select
                                                    value={insightsAralSubject}
                                                    onChange={(e) => setInsightsAralSubject(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    <option value="read">Reading</option>
                                                    <option value="math">Mathematics</option>
                                                    <option value="sci">Science</option>
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    {/* Sub-Metric: Teacher Count */}
                                    {insightsMetric === 'teachers' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Grade:</span>
                                            <select
                                                value={insightsTeacherGrade}
                                                onChange={(e) => setInsightsTeacherGrade(e.target.value)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                            >
                                                <option value="total">All Grades</option>
                                                <option value="k">Kindergarten</option>
                                                <option value="g1">Grade 1</option>
                                                <option value="g2">Grade 2</option>
                                                <option value="g3">Grade 3</option>
                                                <option value="g4">Grade 4</option>
                                                <option value="g5">Grade 5</option>
                                                <option value="g6">Grade 6</option>
                                                <option value="g7">Grade 7</option>
                                                <option value="g8">Grade 8</option>
                                                <option value="g9">Grade 9</option>
                                                <option value="g10">Grade 10</option>
                                                <option value="g11">Grade 11</option>
                                                <option value="g12">Grade 12</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Sub-Metric: Multigrade */}
                                    {insightsMetric === 'multigrade' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Combination:</span>
                                            <select
                                                value={insightsMultigradeCategory}
                                                onChange={(e) => setInsightsMultigradeCategory(e.target.value)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                            >
                                                <option value="1_2">Grades 1 & 2</option>
                                                <option value="3_4">Grades 3 & 4</option>
                                                <option value="5_6">Grades 5 & 6</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Sub-Metric: Experience */}
                                    {insightsMetric === 'experience' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Years:</span>
                                            <select
                                                value={insightsExperienceCategory}
                                                onChange={(e) => setInsightsExperienceCategory(e.target.value)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                            >
                                                <option value="0_1">0-1 Years</option>
                                                <option value="2_5">2-5 Years</option>
                                                <option value="6_10">6-10 Years</option>
                                                <option value="11_15">11-15 Years</option>
                                                <option value="16_20">16-20 Years</option>
                                                <option value="21_25">21-25 Years</option>
                                                <option value="26_30">26-30 Years</option>
                                                <option value="31_35">31-35 Years</option>
                                                <option value="36_40">36-40 Years</option>
                                                <option value="40_45">40-45 Years</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Sub-Metric: Specialization */}
                                    {insightsMetric === 'specialization' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Subject:</span>
                                            <select
                                                value={insightsSpecializationSubject}
                                                onChange={(e) => setInsightsSpecializationSubject(e.target.value)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                            >
                                                <option value="math">Mathematics</option>
                                                <option value="sci">Science</option>
                                                <option value="eng">English</option>
                                                <option value="fil">Filipino</option>
                                                <option value="ap">Araling Panlipunan</option>
                                                <option value="mapeh">MAPEH</option>
                                                <option value="esp">Edukasyon sa Pagpapakatao</option>
                                                <option value="tle">TLE</option>
                                                <option value="gen">General Education</option>
                                                <option value="ece">Early Childhood</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Sub-Metric: Equipment & Inventory */}
                                    {insightsMetric === 'inventory' && (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Item:</span>
                                                <select
                                                    value={insightsInventoryItem}
                                                    onChange={(e) => setInsightsInventoryItem(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    <option value="ecart">E-Classroom Cart</option>
                                                    <option value="laptop">Laptops</option>
                                                    <option value="printer">Printers</option>
                                                    <option value="tv">Smart TVs</option>
                                                    <option value="seats">Seats</option>
                                                    <option value="toilets">Comfort Rooms</option>
                                                </select>
                                            </div>

                                            {/* Sub-Metric 2: Seats Grade */}
                                            {insightsInventoryItem === 'seats' && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Grade:</span>
                                                    <select
                                                        value={insightsSeatsGrade}
                                                        onChange={(e) => setInsightsSeatsGrade(e.target.value)}
                                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                    >
                                                        <option value="k">Kindergarten</option>
                                                        <option value="g1">Grade 1</option>
                                                        <option value="g2">Grade 2</option>
                                                        <option value="g3">Grade 3</option>
                                                        <option value="g4">Grade 4</option>
                                                        <option value="g5">Grade 5</option>
                                                        <option value="g6">Grade 6</option>
                                                        <option value="g7">Grade 7</option>
                                                        <option value="g8">Grade 8</option>
                                                        <option value="g9">Grade 9</option>
                                                        <option value="g10">Grade 10</option>
                                                        <option value="g11">Grade 11</option>
                                                        <option value="g12">Grade 12</option>
                                                    </select>
                                                </div>
                                            )}

                                            {/* Sub-Metric 2: Toilet Type */}
                                            {insightsInventoryItem === 'toilets' && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Type:</span>
                                                    <select
                                                        value={insightsToiletType}
                                                        onChange={(e) => setInsightsToiletType(e.target.value)}
                                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                    >
                                                        <option value="common">Common/Shared</option>
                                                        <option value="male">Male</option>
                                                        <option value="female">Female</option>
                                                        <option value="pwd">PWD</option>
                                                    </select>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Sub-Metric: Specialized Rooms */}
                                    {insightsMetric === 'rooms' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Type:</span>
                                            <select
                                                value={insightsRoomType}
                                                onChange={(e) => setInsightsRoomType(e.target.value)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                            >
                                                <option value="sci">Science Lab</option>
                                                <option value="com">Computer Lab</option>
                                                <option value="tvl">TVL Workshop</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Sub-Metric: Classrooms */}
                                    {insightsMetric === 'classrooms' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Condition:</span>
                                            <select
                                                value={insightsClassroomCondition}
                                                onChange={(e) => setInsightsClassroomCondition(e.target.value)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                            >
                                                <option value="good">Good Condition</option>
                                                <option value="new">Newly Built</option>
                                                <option value="repair">Needs Major Repairs</option>
                                                <option value="demolish">Condemned/Demolition</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Sub-Metric: Site & Utilities */}
                                    {insightsMetric === 'site' && (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Category:</span>
                                                <select
                                                    value={insightsSiteCategory}
                                                    onChange={(e) => {
                                                        const newVal = e.target.value;
                                                        setInsightsSiteCategory(newVal);
                                                        // Reset Option when category changes
                                                        if (newVal === 'elec') setInsightsSiteSubOption('grid');
                                                        else if (newVal === 'water') setInsightsSiteSubOption('piped');
                                                        else if (newVal === 'build') setInsightsSiteSubOption('yes');
                                                        else if (newVal === 'sha') setInsightsSiteSubOption('hardship');
                                                    }}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    <option value="elec">Electricity Supply</option>
                                                    <option value="water">Water Source</option>
                                                    <option value="build">Buildable Space</option>
                                                    <option value="sha">SHA / Hardship</option>
                                                </select>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Option:</span>
                                                <select
                                                    value={insightsSiteSubOption}
                                                    onChange={(e) => setInsightsSiteSubOption(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wide rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                >
                                                    {insightsSiteCategory === 'elec' && (
                                                        <>
                                                            <option value="grid">Grid Supply</option>
                                                            <option value="offgrid">Off-Grid</option>
                                                            <option value="none">No Electricity</option>
                                                        </>
                                                    )}
                                                    {insightsSiteCategory === 'water' && (
                                                        <>
                                                            <option value="piped">Piped Water</option>
                                                            <option value="natural">Natural Resources</option>
                                                            <option value="none">No Water Source</option>
                                                        </>
                                                    )}
                                                    {insightsSiteCategory === 'build' && (
                                                        <>
                                                            <option value="yes">With Buildable Space</option>
                                                            <option value="no">No Buildable Space</option>
                                                        </>
                                                    )}
                                                    {insightsSiteCategory === 'sha' && (
                                                        <>
                                                            <option value="hardship">Hardship Post</option>
                                                            <option value="multi">Pure Multigrade</option>
                                                        </>
                                                    )}
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Chart Container */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                                {insightsMetric === 'enrolment' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                                                <FiPieChart />
                                            </div>
                                            {insightsSubMetric === 'total' ? 'Total Enrolment' :
                                                insightsSubMetric === 'grade_kinder' ? 'Kindergarten Enrolment' :
                                                    `Grade ${insightsSubMetric.replace('grade_', '')} Enrolment`} per Division
                                        </h3>

                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => {
                                                        const key = insightsSubMetric === 'total' ? 'total_enrollment' : insightsSubMetric;
                                                        return {
                                                            name: formatInsightLabel(d),
                                                            fullName: d[insightLabelKey],
                                                            enrolment: parseInt(d[key] || 0)
                                                        };
                                                    })}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis
                                                        dataKey="name"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                        dy={10}
                                                        interval={0}
                                                        angle={-45}
                                                        textAnchor="end"
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                        tickFormatter={(value) => value.toLocaleString()}
                                                    />
                                                    <Tooltip
                                                        cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                                                        content={({ active, payload, label }) => {
                                                            if (active && payload && payload.length) {
                                                                return (
                                                                    <div className="bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl border border-slate-700">
                                                                        <p className="font-bold mb-1">{payload[0].payload.fullName}</p>
                                                                        <p className="font-mono text-purple-300">
                                                                            {payload[0].value.toLocaleString()} Learners
                                                                        </p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar
                                                        dataKey="enrolment"
                                                        fill="#8b5cf6"
                                                        radius={[4, 4, 0, 0]}
                                                        animationDuration={1500}
                                                        label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                                                    >
                                                        {divisionStats.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][index % 5]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'organized_classes' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                                <FiPieChart />
                                            </div>
                                            Organized Classes: {
                                                insightsClassesGrade === 'classes_kinder' ? 'Kindergarten' :
                                                    `Grade ${insightsClassesGrade.replace('classes_grade_', '')}`
                                            }
                                        </h3>

                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => {
                                                        const key = insightsClassesGrade;
                                                        return {
                                                            name: formatInsightLabel(d),
                                                            fullName: d[insightLabelKey],
                                                            value: parseInt(d[key] || 0)
                                                        };
                                                    })}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis
                                                        dataKey="name"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                        dy={10}
                                                        interval={0}
                                                        angle={-45}
                                                        textAnchor="end"
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                        tickFormatter={(value) => value.toLocaleString()}
                                                    />
                                                    <Tooltip
                                                        cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                return (
                                                                    <div className="bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl border border-slate-700">
                                                                        <p className="font-bold mb-1">{payload[0].payload.fullName}</p>
                                                                        <p className="font-mono text-blue-300">
                                                                            {payload[0].value.toLocaleString()} Classes
                                                                        </p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar
                                                        dataKey="value"
                                                        fill="#3b82f6"
                                                        radius={[4, 4, 0, 0]}
                                                        animationDuration={1500}
                                                        label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                                                    >
                                                        {divisionStats.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][index % 5]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'aral' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-600 dark:text-orange-400">
                                                <FiPieChart />
                                            </div>
                                            ARAL Program: Grade {insightsAralGrade.replace('g', '')} {
                                                insightsAralSubject === 'math' ? 'Mathematics' :
                                                    insightsAralSubject === 'sci' ? 'Science' : 'Reading'
                                            }
                                        </h3>

                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => {
                                                        // Construct dynamic key: aral_math_g1, aral_read_g2, etc.
                                                        const key = `aral_${insightsAralSubject}_${insightsAralGrade}`;
                                                        return {
                                                            name: formatInsightLabel(d),
                                                            fullName: d[insightLabelKey],
                                                            value: parseInt(d[key] || 0)
                                                        };
                                                    })}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis
                                                        dataKey="name"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                        dy={10}
                                                        interval={0}
                                                        angle={-45}
                                                        textAnchor="end"
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                        tickFormatter={(value) => value.toLocaleString()}
                                                    />
                                                    <Tooltip
                                                        cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                return (
                                                                    <div className="bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl border border-slate-700">
                                                                        <p className="font-bold mb-1">{payload[0].payload.fullName}</p>
                                                                        <p className="font-mono text-orange-300">
                                                                            {payload[0].value.toLocaleString()} Learners
                                                                        </p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar
                                                        dataKey="value"
                                                        fill="#f97316"
                                                        radius={[4, 4, 0, 0]}
                                                        animationDuration={1500}
                                                        label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                                                    >
                                                        {divisionStats.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={['#f97316', '#ea580c', '#c2410c', '#fb923c', '#fdba74'][index % 5]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'class_size' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                                                <FiPieChart />
                                            </div>
                                            Class Size: {
                                                insightsClassSizeCategory === 'less' ? 'Less than Standard' :
                                                    insightsClassSizeCategory === 'within' ? 'Within Standard' : 'More than Standard'
                                            } ({
                                                insightsClassSizeGrade === 'kinder' ? 'Kindergarten' :
                                                    `Grade ${insightsClassSizeGrade.replace('g', '')}`
                                            })
                                        </h3>

                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => {
                                                        const key = `cnt_${insightsClassSizeCategory === 'less' ? 'less' : insightsClassSizeCategory}_${insightsClassSizeGrade}`;
                                                        return {
                                                            name: formatInsightLabel(d),
                                                            fullName: d[insightLabelKey],
                                                            value: parseInt(d[key] || 0)
                                                        };
                                                    })}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis
                                                        dataKey="name"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                        dy={10}
                                                        interval={0}
                                                        angle={-45}
                                                        textAnchor="end"
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                        tickFormatter={(value) => value.toLocaleString()}
                                                    />
                                                    <Tooltip
                                                        cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                return (
                                                                    <div className="bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl border border-slate-700">
                                                                        <p className="font-bold mb-1">{payload[0].payload.fullName}</p>
                                                                        <p className="font-mono text-emerald-300">
                                                                            {payload[0].value.toLocaleString()} Classes
                                                                        </p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar
                                                        dataKey="value"
                                                        fill="#10b981"
                                                        radius={[4, 4, 0, 0]}
                                                        animationDuration={1500}
                                                        label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                                                    >
                                                        {divisionStats.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={['#10b981', '#34d399', '#059669', '#6ee7b7', '#047857'][index % 5]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'shifting' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                                                <FiPieChart />
                                            </div>
                                            Shifting: {
                                                insightsShiftingGrade === 'k' ? 'Kindergarten' : `Grade ${insightsShiftingGrade.replace('g', '')}`
                                            }
                                            {insightsShiftingCategory !== 'total' && ` (${insightsShiftingCategory === 'single' ? 'Single' : insightsShiftingCategory === 'double' ? 'Double' : 'Triple'} Shift)`}
                                        </h3>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => ({
                                                        ...d,
                                                        value: parseInt(d[`cnt_shift_${insightsShiftingCategory}_${insightsShiftingGrade}`] || 0),
                                                        displayDivision: formatInsightLabel(d)
                                                    }))}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="displayDivision" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={10} interval={0} angle={-45} textAnchor="end" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} contentStyle={{ backgroundColor: '#1e293b', color: '#fff' }} />
                                                    <Bar
                                                        dataKey="value"
                                                        name={`${insightsShiftingCategory === 'single' ? 'Single' : insightsShiftingCategory === 'double' ? 'Double' : 'Triple'} Shift`}
                                                        fill={insightsShiftingCategory === 'single' ? '#3b82f6' : insightsShiftingCategory === 'double' ? '#f59e0b' : '#ef4444'}
                                                        radius={[4, 4, 0, 0]}
                                                        label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'delivery' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg text-teal-600 dark:text-teal-400">
                                                <FiPieChart />
                                            </div>
                                            Learning Delivery: {
                                                insightsDeliveryGrade === 'k' ? 'Kindergarten' : `Grade ${insightsDeliveryGrade.replace('g', '')}`
                                            }
                                            {insightsDeliveryCategory !== 'total' && ` (${insightsDeliveryCategory === 'inperson' ? 'In-Person' : insightsDeliveryCategory === 'blended' ? 'Blended' : 'Distance'} Learning)`}
                                        </h3>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => ({
                                                        ...d,
                                                        value: parseInt(d[`cnt_mode_${insightsDeliveryCategory}_${insightsDeliveryGrade}`] || 0),
                                                        displayDivision: formatInsightLabel(d)
                                                    }))}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="displayDivision" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={10} interval={0} angle={-45} textAnchor="end" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} contentStyle={{ backgroundColor: '#1e293b', color: '#fff' }} />
                                                    <Bar
                                                        dataKey="value"
                                                        name={`${insightsDeliveryCategory === 'inperson' ? 'In-Person' : insightsDeliveryCategory === 'blended' ? 'Blended' : 'Distance'} Learning`}
                                                        fill={insightsDeliveryCategory === 'inperson' ? '#10b981' : insightsDeliveryCategory === 'blended' ? '#6366f1' : '#f43f5e'}
                                                        radius={[4, 4, 0, 0]}
                                                        label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'adm' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
                                                <FiPieChart />
                                            </div>
                                            Emergency ADM: {
                                                insightsAdmType === 'mdl' ? 'Modular Distance (MDL)' :
                                                    insightsAdmType === 'odl' ? 'Online Distance (ODL)' :
                                                        insightsAdmType === 'tvi' ? 'TV/Radio (TVI/RBI)' : 'Blended Learning'
                                            }
                                        </h3>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => ({
                                                        ...d,
                                                        value: parseInt(d[`cnt_adm_${insightsAdmType}`] || 0),
                                                        displayDivision: formatInsightLabel(d)
                                                    }))}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="displayDivision" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={10} interval={0} angle={-45} textAnchor="end" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} contentStyle={{ backgroundColor: '#1e293b', color: '#fff' }} />
                                                    <Bar dataKey="value" name="Schools" fill="#ef4444" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'teachers' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                                <FiPieChart />
                                            </div>
                                            Teacher Count: {insightsTeacherGrade === 'total' ? 'All Grades' : insightsTeacherGrade === 'k' ? 'Kindergarten' : `Grade ${insightsTeacherGrade.replace('g', '')}`}
                                        </h3>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => ({
                                                        ...d,
                                                        value: insightsTeacherGrade === 'total'
                                                            ? ['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].reduce((acc, g) => acc + parseInt(d[`cnt_teach_${g}`] || 0), 0)
                                                            : parseInt(d[`cnt_teach_${insightsTeacherGrade}`] || 0),
                                                        displayDivision: formatInsightLabel(d)
                                                    }))}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="displayDivision" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={10} interval={0} angle={-45} textAnchor="end" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} contentStyle={{ backgroundColor: '#1e293b', color: '#fff' }} />
                                                    <Bar dataKey="value" name="Teachers" fill="#3b82f6" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'multigrade' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400">
                                                <FiPieChart />
                                            </div>
                                            Multigrade Teachers: {insightsMultigradeCategory === '1_2' ? 'Grades 1 & 2' : insightsMultigradeCategory === '3_4' ? 'Grades 3 & 4' : 'Grades 5 & 6'}
                                        </h3>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => ({
                                                        ...d,
                                                        value: parseInt(d[`cnt_multi_${insightsMultigradeCategory}`] || 0),
                                                        displayDivision: formatInsightLabel(d)
                                                    }))}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="displayDivision" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={10} interval={0} angle={-45} textAnchor="end" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} contentStyle={{ backgroundColor: '#1e293b', color: '#fff' }} />
                                                    <Bar dataKey="value" name="Teachers" fill="#f59e0b" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'experience' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                                                <FiPieChart />
                                            </div>
                                            Teaching Experience: {insightsExperienceCategory.replace('_', '-')} Years
                                        </h3>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => ({
                                                        ...d,
                                                        value: parseInt(d[`cnt_exp_${insightsExperienceCategory}`] || 0),
                                                        displayDivision: formatInsightLabel(d)
                                                    }))}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="displayDivision" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={10} interval={0} angle={-45} textAnchor="end" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} contentStyle={{ backgroundColor: '#1e293b', color: '#fff' }} />
                                                    <Bar dataKey="value" name="Teachers" fill="#8b5cf6" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'specialization' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg text-pink-600 dark:text-pink-400">
                                                <FiPieChart />
                                            </div>
                                            Specialization: {
                                                insightsSpecializationSubject === 'math' ? 'Mathematics' :
                                                    insightsSpecializationSubject === 'sci' ? 'Science' :
                                                        insightsSpecializationSubject === 'eng' ? 'English' :
                                                            insightsSpecializationSubject === 'fil' ? 'Filipino' :
                                                                insightsSpecializationSubject === 'ap' ? 'Araling Panlipunan' :
                                                                    insightsSpecializationSubject === 'mapeh' ? 'MAPEH' :
                                                                        insightsSpecializationSubject === 'esp' ? 'Edukasyon sa Pagpapakatao' :
                                                                            insightsSpecializationSubject === 'tle' ? 'TLE' :
                                                                                insightsSpecializationSubject === 'gen' ? 'General Education' : 'Early Childhood'
                                            }
                                        </h3>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => ({
                                                        ...d,
                                                        value: parseInt(d[`cnt_spec_${insightsSpecializationSubject}`] || 0),
                                                        displayDivision: formatInsightLabel(d)
                                                    }))}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="displayDivision" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={10} interval={0} angle={-45} textAnchor="end" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} contentStyle={{ backgroundColor: '#1e293b', color: '#fff' }} />
                                                    <Bar dataKey="value" name="Teachers" fill="#ec4899" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'inventory' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg text-cyan-600 dark:text-cyan-400">
                                                <FiPieChart />
                                            </div>
                                            Inventory: {
                                                insightsInventoryItem === 'seats' ? `Seats (Grade ${insightsSeatsGrade.replace('g', '').replace('k', 'Kindergarten')})` :
                                                    insightsInventoryItem === 'toilets' ? `Comfort Rooms (${insightsToiletType === 'common' ? 'Common/Shared' :
                                                        insightsToiletType === 'male' ? 'Male' :
                                                            insightsToiletType === 'female' ? 'Female' : 'PWD'
                                                        })` :
                                                        insightsInventoryItem === 'ecart' ? 'E-Classroom Cart' :
                                                            insightsInventoryItem === 'laptop' ? 'Laptops' :
                                                                insightsInventoryItem === 'printer' ? 'Printers' : 'Smart TVs'
                                            } {insightsInventoryItem !== 'seats' && insightsInventoryItem !== 'toilets' && '(Functional)'}
                                        </h3>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => {
                                                        let val = 0;
                                                        if (insightsInventoryItem === 'seats') {
                                                            val = parseInt(d[`cnt_seats_${insightsSeatsGrade}`] || 0);
                                                        } else if (insightsInventoryItem === 'toilets') {
                                                            val = parseInt(d[`cnt_toilet_${insightsToiletType}`] || 0);
                                                        } else {
                                                            val = parseInt(d[`cnt_equip_${insightsInventoryItem}_func`] || 0);
                                                        }
                                                        return {
                                                            ...d,
                                                            value: val,
                                                            displayDivision: formatInsightLabel(d)
                                                        };
                                                    })}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="displayDivision" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={10} interval={0} angle={-45} textAnchor="end" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} contentStyle={{ backgroundColor: '#1e293b', color: '#fff' }} />
                                                    <Bar dataKey="value" name="Units" fill="#06b6d4" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'classrooms' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400">
                                                <FiPieChart />
                                            </div>
                                            Classrooms: {
                                                insightsClassroomCondition === 'good' ? 'Good Condition' :
                                                    insightsClassroomCondition === 'new' ? 'Newly Built' :
                                                        insightsClassroomCondition === 'repair' ? 'Needs Major Repairs' : 'For Demolition/Condemned'
                                            }
                                        </h3>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => ({
                                                        ...d,
                                                        value: parseInt(d[`cnt_class_${insightsClassroomCondition}`] || 0),
                                                        displayDivision: formatInsightLabel(d)
                                                    }))}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="displayDivision" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={10} interval={0} angle={-45} textAnchor="end" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} contentStyle={{ backgroundColor: '#1e293b', color: '#fff' }} />
                                                    <Bar dataKey="value" name="Classrooms" fill="#f59e0b" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'rooms' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg text-violet-600 dark:text-violet-400">
                                                <FiPieChart />
                                            </div>
                                            Specialized Rooms: {
                                                insightsRoomType === 'sci' ? 'Science Lab' :
                                                    insightsRoomType === 'com' ? 'Computer Lab' : 'TVL Workshop'
                                            }
                                        </h3>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => ({
                                                        ...d,
                                                        value: parseInt(d[`cnt_room_${insightsRoomType}`] || 0),
                                                        displayDivision: formatInsightLabel(d)
                                                    }))}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="displayDivision" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={10} interval={0} angle={-45} textAnchor="end" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} contentStyle={{ backgroundColor: '#1e293b', color: '#fff' }} />
                                                    <Bar dataKey="value" name="Rooms" fill="#8b5cf6" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'site' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg text-teal-600 dark:text-teal-400">
                                                <FiPieChart />
                                            </div>
                                            Site & Utilities: {
                                                (insightsSiteCategory === 'elec' ? 'Electricity' :
                                                    insightsSiteCategory === 'water' ? 'Water' :
                                                        insightsSiteCategory === 'build' ? 'Buildable Space' : 'SHA / Hardship') + ' - ' +
                                                (insightsSiteSubOption === 'grid' ? 'Grid Supply' :
                                                    insightsSiteSubOption === 'offgrid' ? 'Off-Grid' :
                                                        insightsSiteSubOption === 'piped' ? 'Piped Water' :
                                                            insightsSiteSubOption === 'natural' ? 'Natural Resources' :
                                                                insightsSiteSubOption === 'yes' ? 'Yes' :
                                                                    insightsSiteSubOption === 'no' ? 'No' :
                                                                        insightsSiteSubOption === 'hardship' ? 'Hardship Post' :
                                                                            insightsSiteSubOption === 'multi' ? 'Pure Multigrade' : 'None/No Source')
                                            }
                                        </h3>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => ({
                                                        ...d,
                                                        value: parseInt(d[`cnt_site_${insightsSiteCategory}_${insightsSiteSubOption}`] || 0),
                                                        displayDivision: formatInsightLabel(d)
                                                    }))}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="displayDivision" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={10} interval={0} angle={-45} textAnchor="end" />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} contentStyle={{ backgroundColor: '#1e293b', color: '#fff' }} />
                                                    <Bar dataKey="value" name="Schools" fill="#14b8a6" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}

                                {insightsMetric === 'demographic' && (
                                    <>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                            <div className="p-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg text-pink-600 dark:text-pink-400">
                                                <FiPieChart />
                                            </div>
                                            Learner Demographic: {
                                                insightsDemographicCategory === 'sned' ? 'SNED' :
                                                    insightsDemographicCategory === 'disability' ? 'Learners with Disability' :
                                                        insightsDemographicCategory === 'als' ? 'ALS' :
                                                            insightsDemographicCategory === 'muslim' ? 'Muslim' :
                                                                insightsDemographicCategory === 'ip' ? 'Indigenous People' :
                                                                    insightsDemographicCategory === 'displaced' ? 'Displaced' :
                                                                        insightsDemographicCategory === 'repetition' ? 'Repetition' :
                                                                            insightsDemographicCategory === 'overage' ? 'Overage' : 'Dropouts'
                                            } ({
                                                insightsDemographicGrade === 'total' ? 'Total' :
                                                    insightsDemographicGrade === 'es' ? 'Elementary' :
                                                        insightsDemographicGrade === 'jhs' ? 'Junior High' :
                                                            insightsDemographicGrade === 'shs' ? 'Senior High' :
                                                                insightsDemographicGrade === 'k' ? 'Kindergarten' :
                                                                    `Grade ${insightsDemographicGrade.replace('g', '')}`
                                            })
                                        </h3>

                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={insightChartData.map(d => {
                                                        const key = `stat_${insightsDemographicCategory}_${insightsDemographicGrade}`;
                                                        return {
                                                            name: formatInsightLabel(d),
                                                            fullName: d[insightLabelKey],
                                                            value: parseInt(d[key] || 0)
                                                        };
                                                    })}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis
                                                        dataKey="name"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                        dy={10}
                                                        interval={0}
                                                        angle={-45}
                                                        textAnchor="end"
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                        tickFormatter={(value) => value.toLocaleString()}
                                                    />
                                                    <Tooltip
                                                        cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                return (
                                                                    <div className="bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl border border-slate-700">
                                                                        <p className="font-bold mb-1">{payload[0].payload.fullName}</p>
                                                                        <p className="font-mono text-pink-300">
                                                                            {payload[0].value.toLocaleString()} Learners
                                                                        </p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar
                                                        dataKey="value"
                                                        fill="#ec4899"
                                                        radius={[4, 4, 0, 0]}
                                                        animationDuration={1500}
                                                        label={{ position: 'top', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                                                    >
                                                        {divisionStats.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={['#ec4899', '#db2777', '#be185d', '#9d174d', '#831843'][index % 5]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* SCHOOL TAB */}
                    {
                        activeTab === 'school' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Form Submissions</h2>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => navigate('/dummy-forms', { state: { type: 'school' } })}
                                            className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors"
                                        >
                                            View Sample Forms
                                        </button>
                                        <button
                                            onClick={() => {
                                                const params = new URLSearchParams();
                                                if (coRegion) params.append('region', coRegion);
                                                if (coDivision) params.append('division', coDivision);
                                                navigate(`/jurisdiction-schools?${params.toString()}`);
                                            }}
                                            className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-50 hover:bg-blue-100 transition-colors"
                                        >
                                            View All Schools
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Use jurisdictionTotal for ALL cards */}
                                    <StatCard title="Profiles" value={stats?.profile || 0} total={jurisdictionTotal} color="bg-blue-500" icon={FiFileText} />
                                    <StatCard title="School Head" value={stats?.head || 0} total={jurisdictionTotal} color="bg-indigo-500" icon={FiCheckCircle} />
                                    <StatCard title="Enrollment" value={stats?.enrollment || 0} total={jurisdictionTotal} color="bg-emerald-500" icon={FiTrendingUp} />
                                    <StatCard title="Classes" value={stats?.organizedclasses || 0} total={jurisdictionTotal} color="bg-cyan-500" icon={FiCheckCircle} />
                                    <StatCard title="Modalities" value={stats?.shifting || 0} total={jurisdictionTotal} color="bg-purple-500" icon={FiMapPin} />
                                    <StatCard title="Personnel" value={stats?.personnel || 0} total={jurisdictionTotal} color="bg-orange-500" icon={FiFileText} />
                                    <StatCard title="Specialization" value={stats?.specialization || 0} total={jurisdictionTotal} color="bg-pink-500" icon={FiTrendingUp} />
                                    <StatCard title="Resources" value={stats?.resources || 0} total={jurisdictionTotal} color="bg-amber-500" icon={FiClock} />
                                </div>
                            </div>
                        )
                    }

                    {/* ENGINEER TAB */}
                    {
                        activeTab === 'engineer' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Infrastructure Summary</h2>
                                    <button
                                        onClick={() => navigate('/dummy-forms', { state: { type: 'engineer' } })}
                                        className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors"
                                    >
                                        View Sample Forms
                                    </button>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="text-center">
                                            <p className="text-4xl font-black text-[#004A99] dark:text-blue-400">{engStats?.total_projects || 0}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Projects</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{engStats?.completed_count || 0}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Completed</p>
                                        </div>
                                        <div className="text-center col-span-2 pt-4 border-t border-slate-50 dark:border-slate-700">
                                            <p className="text-4xl font-black text-amber-500 dark:text-amber-400">{engStats?.avg_progress || 0}%</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Avg. Physical Accomplishment</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-1">Validated Project List</h2>
                                    {jurisdictionProjects.length === 0 ? (
                                        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400">
                                            No projects found in this jurisdiction.
                                        </div>
                                    ) : (
                                        <div className="space-y-3 pb-6">
                                            {jurisdictionProjects.map((project) => (
                                                <div
                                                    key={project.id}
                                                    onClick={() => navigate(`/project-details/${project.id}`)}
                                                    className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 active:scale-[0.98] transition-all cursor-pointer group"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex-1">
                                                            <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-blue-600 transition-colors">{project.projectName}</h3>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 flex items-center gap-1">
                                                                <FiMapPin size={10} /> {project.schoolName}
                                                            </p>
                                                        </div>
                                                        <div className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${project.validation_status === 'Validated' ? 'bg-emerald-50 text-emerald-600' :
                                                            project.validation_status === 'Rejected' ? 'bg-red-50 text-red-600' :
                                                                'bg-orange-50 text-orange-600'
                                                            }`}>
                                                            {project.validation_status || 'Pending'}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 rounded-full"
                                                                style={{ width: `${project.accomplishmentPercentage}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{project.accomplishmentPercentage}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }

                    {/* VALIDATION TAB (For SDO) */}
                    {
                        activeTab === 'validation' && (
                            <div className="space-y-6">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Data Validation</h2>

                                {/* School Validation Section */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
                                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">School Data Validation</h3>
                                    <p className="text-sm text-slate-500 mb-4">Validate school profiles and submitted forms.</p>
                                    <button
                                        onClick={() => navigate('/jurisdiction-schools')}
                                        className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-blue-100 transition-colors"
                                    >
                                        View Schools to Validate
                                    </button>
                                </div>

                                {/* Infrastructure Validation Section */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700">
                                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Infrastructure Validation</h3>
                                    <p className="text-sm text-slate-500 mb-4">Review and validate ongoing infrastructure projects.</p>

                                    {jurisdictionProjects.filter(p => p.validation_status !== 'Validated').length === 0 ? (
                                        <p className="text-center text-slate-400 text-sm py-4">No pending project validations.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {jurisdictionProjects
                                                .filter(p => p.validation_status !== 'Validated') // Show pending/rejected
                                                .map((project) => (
                                                    <div
                                                        key={project.id}
                                                        onClick={() => navigate(`/project-validation?schoolId=${project.schoolId}`)}
                                                        className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex justify-between items-center group"
                                                    >
                                                        <div>
                                                            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-blue-600">{project.projectName}</h4>
                                                            <p className="text-[10px] text-slate-400 uppercase mt-0.5">{project.schoolName}</p>
                                                        </div>
                                                        <div className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase">
                                                            {project.validation_status || 'Pending'}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }
                </div >

                <BottomNav userRole={userData?.role} />
            </div >
            {/* PROJECT LIST MODAL */}
            {
                projectListModal.isOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[1100] p-4">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[80vh] flex flex-col rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white">{projectListModal.title}</h3>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                                        {projectListModal.projects.length} Projects Found
                                    </p>
                                </div>
                                <button
                                    onClick={() => setProjectListModal(prev => ({ ...prev, isOpen: false }))}
                                    className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
                                >
                                    <FiX />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {projectListModal.isLoading ? (
                                    <div className="flex justify-center py-10">
                                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {projectListModal.projects.map((p) => (
                                            <div key={p.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:border-blue-200 transition-colors">
                                                <div>
                                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 transition-colors">{p.schoolName}</h4>
                                                    <p className="text-xs text-slate-500 italic">{p.projectName}</p>
                                                    {p.projectAllocation && (
                                                        <p className="text-[10px] font-mono text-slate-400 mt-1">
                                                            Alloc: ₱{Number(p.projectAllocation).toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase mb-1 ${p.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' :
                                                        p.status === 'Delayed' ? 'bg-rose-100 text-rose-600' :
                                                            'bg-blue-100 text-blue-600'
                                                        }`}>
                                                        {p.status}
                                                    </span>
                                                    <div className="text-xs font-black text-slate-700 dark:text-slate-300">
                                                        {p.accomplishmentPercentage}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {projectListModal.projects.length === 0 && (
                                            <p className="text-center text-slate-400 italic py-10">No projects found for this category.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </PageTransition >
    );
};

export default MonitoringDashboard;
