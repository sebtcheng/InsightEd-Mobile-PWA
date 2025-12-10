import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase'; 
import { onAuthStateChanged } from "firebase/auth";
import LoadingScreen from '../components/LoadingScreen'; 

const Enrolment = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    
    // School Identity
    const [schoolId, setSchoolId] = useState(null);
    const [schoolName, setSchoolName] = useState('');

    // Modals
    const [showSaveModal, setShowSaveModal] = useState(false); 
    const [showEditModal, setShowEditModal] = useState(false); 
    const [editAgreement, setEditAgreement] = useState(false);

    // Form Data
    const [curricularOffering, setCurricularOffering] = useState('');
    
    // BASIC GRADES (Kinder - G10)
    const [basicGrades, setBasicGrades] = useState({
        gradeKinder: 0, grade1: 0, grade2: 0, grade3: 0, 
        grade4: 0, grade5: 0, grade6: 0,
        grade7: 0, grade8: 0, grade9: 0, grade10: 0
    });

    // SHS STRANDS (G11 - G12)
    const [shsStrands, setShsStrands] = useState({
        abm11: 0, abm12: 0, stem11: 0, stem12: 0,
        humss11: 0, humss12: 0, gas11: 0, gas12: 0,
        ict11: 0, ict12: 0, he11: 0, he12: 0,
        ia11: 0, ia12: 0, afa11: 0, afa12: 0,
        arts11: 0, arts12: 0, sports11: 0, sports12: 0
    });

    const [originalData, setOriginalData] = useState(null);
    const goBack = () => navigate('/school-forms');

    // --- CALCULATIONS ---
    const getG11Total = () => {
        const { abm11, stem11, humss11, gas11, ict11, he11, ia11, afa11, arts11, sports11 } = shsStrands;
        return (abm11||0) + (stem11||0) + (humss11||0) + (gas11||0) + (ict11||0) + (he11||0) + (ia11||0) + (afa11||0) + (arts11||0) + (sports11||0);
    };

    const getG12Total = () => {
        const { abm12, stem12, humss12, gas12, ict12, he12, ia12, afa12, arts12, sports12 } = shsStrands;
        return (abm12||0) + (stem12||0) + (humss12||0) + (gas12||0) + (ict12||0) + (he12||0) + (ia12||0) + (afa12||0) + (arts12||0) + (sports12||0);
    };

    const getESTotal = () => {
        const { gradeKinder, grade1, grade2, grade3, grade4, grade5, grade6 } = basicGrades;
        return (gradeKinder||0) + (grade1||0) + (grade2||0) + (grade3||0) + (grade4||0) + (grade5||0) + (grade6||0);
    };

    const getJHSTotal = () => {
        const { grade7, grade8, grade9, grade10 } = basicGrades;
        return (grade7||0) + (grade8||0) + (grade9||0) + (grade10||0);
    };

    const getSHSTotal = () => getG11Total() + getG12Total();
    const getGrandTotal = () => getESTotal() + getJHSTotal() + getSHSTotal();

    // --- VISIBILITY LOGIC ---
    const showElem = () => curricularOffering.includes("Elementary") || curricularOffering.includes("K-12") || curricularOffering.includes("K-10");
    const showJHS = () => curricularOffering.includes("Junior") || curricularOffering.includes("K-12") || curricularOffering.includes("K-10");
    const showSHS = () => curricularOffering.includes("Senior") || curricularOffering.includes("K-12");

    // --- LOAD DATA ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const response = await fetch(`http://localhost:3000/api/school-by-user/${user.uid}`);
                    if (response.ok) {
                        const result = await response.json();
                        if (result.exists) {
                            const data = result.data;
                            setSchoolId(data.school_id);
                            setSchoolName(data.school_name);
                            setCurricularOffering(data.curricular_offering || '');

                            setBasicGrades({
                                gradeKinder: data.grade_kinder || 0,
                                grade1: data.grade_1 || 0, grade2: data.grade_2 || 0,
                                grade3: data.grade_3 || 0, grade4: data.grade_4 || 0,
                                grade5: data.grade_5 || 0, grade6: data.grade_6 || 0,
                                grade7: data.grade_7 || 0, grade8: data.grade_8 || 0,
                                grade9: data.grade_9 || 0, grade10: data.grade_10 || 0
                            });

                            setShsStrands({
                                abm11: data.abm_11||0, abm12: data.abm_12||0,
                                stem11: data.stem_11||0, stem12: data.stem_12||0,
                                humss11: data.humss_11||0, humss12: data.humss_12||0,
                                gas11: data.gas_11||0, gas12: data.gas_12||0,
                                ict11: data.tvl_ict_11||0, ict12: data.tvl_ict_12||0,
                                he11: data.tvl_he_11||0, he12: data.tvl_he_12||0,
                                ia11: data.tvl_ia_11||0, ia12: data.tvl_ia_12||0,
                                afa11: data.tvl_afa_11||0, afa12: data.tvl_afa_12||0,
                                arts11: data.arts_11||0, arts12: data.arts_12||0,
                                sports11: data.sports_11||0, sports12: data.sports_12||0
                            });

                            if (data.curricular_offering) setIsLocked(true);
                        }
                    }
                } catch (error) { console.error("Load error:", error); }
            }
            setTimeout(() => { setLoading(false); }, 1000);
        });
        return () => unsubscribe();
    }, []);

    // --- HANDLERS ---
    const handleBasicChange = (e) => setBasicGrades({ ...basicGrades, [e.target.name]: parseInt(e.target.value) || 0 });
    const handleStrandChange = (e) => setShsStrands({ ...shsStrands, [e.target.name]: parseInt(e.target.value) || 0 });

    const handleUpdateClick = () => { setEditAgreement(false); setShowEditModal(true); };
    const handleConfirmEdit = () => { 
        setOriginalData({ offering: curricularOffering, basic: {...basicGrades}, strands: {...shsStrands} }); 
        setIsLocked(false); 
        setShowEditModal(false); 
    };
    const handleCancelEdit = () => { 
        if (originalData) {
            setCurricularOffering(originalData.offering);
            setBasicGrades(originalData.basic);
            setShsStrands(originalData.strands);
        }
        setIsLocked(true); 
    };

    // --- SAVE ---
    const confirmSave = async () => {
        setShowSaveModal(false);
        setIsSaving(true);
        const user = auth.currentUser;

        // Clean Data based on Visibility
        const finalESTotal = showElem() ? getESTotal() : 0;
        const finalJHSTotal = showJHS() ? getJHSTotal() : 0;
        const finalSHSTotal = showSHS() ? getSHSTotal() : 0;
        const finalGrandTotal = finalESTotal + finalJHSTotal + finalSHSTotal;

        const cleanBasic = { ...basicGrades };
        if (!showElem()) ["gradeKinder","grade1","grade2","grade3","grade4","grade5","grade6"].forEach(k => cleanBasic[k] = 0);
        if (!showJHS()) ["grade7","grade8","grade9","grade10"].forEach(k => cleanBasic[k] = 0);
        
        const cleanStrands = { ...shsStrands };
        if (!showSHS()) Object.keys(cleanStrands).forEach(k => cleanStrands[k] = 0);

        const payload = {
            schoolId, submittedBy: user.uid, curricularOffering,
            ...cleanBasic, ...cleanStrands,
            grade11: showSHS() ? getG11Total() : 0, 
            grade12: showSHS() ? getG12Total() : 0,
            esTotal: finalESTotal,
            jhsTotal: finalJHSTotal,
            shsTotal: finalSHSTotal,
            grandTotal: finalGrandTotal
        };

        try {
            const response = await fetch('http://localhost:3000/api/save-enrolment', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (response.ok) {
                alert('Saved successfully!');
                setBasicGrades(cleanBasic);
                setShsStrands(cleanStrands);
                setIsLocked(true);
            } else { alert('Error saving.'); }
        } catch (error) { alert("Connection failed."); } 
        finally { setIsSaving(false); }
    };

    if (loading) return <LoadingScreen message="Loading Enrolment..." />;

    // Helper Input Component
    const Input = ({ label, name, val, onChange }) => (
        <div className="w-full">
            {label && <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{label}</label>}
            <input type="number" min="0" name={name} value={val} onChange={onChange} disabled={isLocked}
                className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:ring-2 focus:ring-[#004A99] transition-all 
                ${isLocked ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-white border-gray-300'}`} />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-32 relative">
            
            {/* --- TOP HEADER --- */}
            <div className="bg-[#004A99] px-6 pt-12 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <button onClick={goBack} className="text-white/80 hover:text-white text-2xl transition">&larr;</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Enrolment Data</h1>
                        <p className="text-blue-200 text-xs mt-1">
                            {schoolName || 'Manage learner counts'}
                        </p>
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="px-5 -mt-12 relative z-20 max-w-4xl mx-auto">
                <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-lg border transition-all ${!isLocked ? 'border-blue-400 ring-4 ring-blue-50' : 'border-gray-100'}`}>
                    
                    {/* 1. CURRICULAR OFFERING */}
                    <div className="mb-8">
                        <label className="block text-gray-800 text-sm font-bold mb-2">Curricular Offering</label>
                        <select value={curricularOffering} onChange={(e) => setCurricularOffering(e.target.value)} disabled={isLocked} 
                            className={`w-full px-4 py-3 border rounded-xl font-medium text-gray-700 focus:ring-2 focus:ring-[#004A99] ${isLocked ? 'bg-gray-100' : 'bg-white'}`}>
                            <option value="">-- Select Offering --</option>
                            <option>Purely Elementary</option>
                            <option>Elementary School and Junior High School (K-10)</option>
                            <option>All Offering (K-12)</option>
                            <option>Junior and Senior High</option>
                            <option>Purely Junior High School</option>
                            <option>Purely Senior High School</option>
                        </select>
                        {!isLocked && <p className="text-[10px] text-gray-400 mt-2 ml-1">Selecting an offering will show relevant grade levels.</p>}
                    </div>

                    {/* 2. ELEMENTARY SECTION */}
                    {showElem() && (
                        <div className="mb-8 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-700">Elementary School</h3>
                                <span className="bg-white px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold text-blue-600 shadow-sm">Total: {getESTotal()}</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Input label="Kinder" name="gradeKinder" val={basicGrades.gradeKinder} onChange={handleBasicChange} />
                                <Input label="Grade 1" name="grade1" val={basicGrades.grade1} onChange={handleBasicChange} />
                                <Input label="Grade 2" name="grade2" val={basicGrades.grade2} onChange={handleBasicChange} />
                                <Input label="Grade 3" name="grade3" val={basicGrades.grade3} onChange={handleBasicChange} />
                                <Input label="Grade 4" name="grade4" val={basicGrades.grade4} onChange={handleBasicChange} />
                                <Input label="Grade 5" name="grade5" val={basicGrades.grade5} onChange={handleBasicChange} />
                                <Input label="Grade 6" name="grade6" val={basicGrades.grade6} onChange={handleBasicChange} />
                            </div>
                        </div>
                    )}

                    {/* 3. JHS SECTION */}
                    {showJHS() && (
                        <div className="mb-8 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-700">Junior High School</h3>
                                <span className="bg-white px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold text-blue-600 shadow-sm">Total: {getJHSTotal()}</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Input label="Grade 7" name="grade7" val={basicGrades.grade7} onChange={handleBasicChange} />
                                <Input label="Grade 8" name="grade8" val={basicGrades.grade8} onChange={handleBasicChange} />
                                <Input label="Grade 9" name="grade9" val={basicGrades.grade9} onChange={handleBasicChange} />
                                <Input label="Grade 10" name="grade10" val={basicGrades.grade10} onChange={handleBasicChange} />
                            </div>
                        </div>
                    )}

                    {/* 4. SHS SECTION */}
                    {showSHS() && (
                        <div className="mb-8 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="font-bold text-gray-700">Senior High School</h3>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Please encode per strand.</p>
                                </div>
                                <span className="bg-white px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold text-blue-600 shadow-sm">Total: {getSHSTotal()}</span>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] text-gray-500 uppercase bg-gray-100 font-bold tracking-wider">
                                        <tr><th className="px-4 py-3">Track / Strand</th><th className="px-2 py-3 w-24">Grade 11</th><th className="px-2 py-3 w-24">Grade 12</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {/* ACADEMIC */}
                                        <tr><td className="px-4 py-2 font-bold text-gray-700 bg-gray-50" colSpan="3">Academic Track</td></tr>
                                        <tr><td className="px-4 py-2 font-medium text-gray-600">ABM</td><td className="p-2"><Input name="abm11" val={shsStrands.abm11} onChange={handleStrandChange}/></td><td className="p-2"><Input name="abm12" val={shsStrands.abm12} onChange={handleStrandChange}/></td></tr>
                                        <tr><td className="px-4 py-2 font-medium text-gray-600">STEM</td><td className="p-2"><Input name="stem11" val={shsStrands.stem11} onChange={handleStrandChange}/></td><td className="p-2"><Input name="stem12" val={shsStrands.stem12} onChange={handleStrandChange}/></td></tr>
                                        <tr><td className="px-4 py-2 font-medium text-gray-600">HUMSS</td><td className="p-2"><Input name="humss11" val={shsStrands.humss11} onChange={handleStrandChange}/></td><td className="p-2"><Input name="humss12" val={shsStrands.humss12} onChange={handleStrandChange}/></td></tr>
                                        <tr><td className="px-4 py-2 font-medium text-gray-600">GAS</td><td className="p-2"><Input name="gas11" val={shsStrands.gas11} onChange={handleStrandChange}/></td><td className="p-2"><Input name="gas12" val={shsStrands.gas12} onChange={handleStrandChange}/></td></tr>

                                        {/* TVL */}
                                        <tr><td className="px-4 py-2 font-bold text-gray-700 bg-gray-50" colSpan="3">TVL Track</td></tr>
                                        <tr><td className="px-4 py-2"><div className="font-medium text-gray-600">ICT</div><div className="text-[10px] text-gray-400">Prog, CSS, Animation</div></td><td className="p-2"><Input name="ict11" val={shsStrands.ict11} onChange={handleStrandChange}/></td><td className="p-2"><Input name="ict12" val={shsStrands.ict12} onChange={handleStrandChange}/></td></tr>
                                        <tr><td className="px-4 py-2"><div className="font-medium text-gray-600">Home Economics</div><div className="text-[10px] text-gray-400">Beauty, Cookery, etc.</div></td><td className="p-2"><Input name="he11" val={shsStrands.he11} onChange={handleStrandChange}/></td><td className="p-2"><Input name="he12" val={shsStrands.he12} onChange={handleStrandChange}/></td></tr>
                                        <tr><td className="px-4 py-2"><div className="font-medium text-gray-600">Industrial Arts</div><div className="text-[10px] text-gray-400">Auto, SMAW, EIM</div></td><td className="p-2"><Input name="ia11" val={shsStrands.ia11} onChange={handleStrandChange}/></td><td className="p-2"><Input name="ia12" val={shsStrands.ia12} onChange={handleStrandChange}/></td></tr>
                                        <tr><td className="px-4 py-2"><div className="font-medium text-gray-600">Agri-Fishery</div><div className="text-[10px] text-gray-400">Agri, Fishing</div></td><td className="p-2"><Input name="afa11" val={shsStrands.afa11} onChange={handleStrandChange}/></td><td className="p-2"><Input name="afa12" val={shsStrands.afa12} onChange={handleStrandChange}/></td></tr>

                                        {/* OTHERS */}
                                        <tr><td className="px-4 py-2 font-bold text-gray-700 bg-gray-50" colSpan="3">Other Tracks</td></tr>
                                        <tr><td className="px-4 py-2 font-medium text-gray-600">Arts & Design</td><td className="p-2"><Input name="arts11" val={shsStrands.arts11} onChange={handleStrandChange}/></td><td className="p-2"><Input name="arts12" val={shsStrands.arts12} onChange={handleStrandChange}/></td></tr>
                                        <tr><td className="px-4 py-2 font-medium text-gray-600">Sports</td><td className="p-2"><Input name="sports11" val={shsStrands.sports11} onChange={handleStrandChange}/></td><td className="p-2"><Input name="sports12" val={shsStrands.sports12} onChange={handleStrandChange}/></td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* GRAND TOTAL */}
                    <div className="bg-[#004A99] text-white p-6 rounded-2xl flex justify-between items-center mt-6 shadow-md">
                        <div>
                            <span className="font-bold uppercase tracking-widest text-xs opacity-70">Total Enrolment</span>
                            <h2 className="text-3xl font-extrabold">{getGrandTotal()}</h2>
                        </div>
                        <div className="text-4xl opacity-20">📊</div>
                    </div>

                </div>
            </div>

            {/* --- FLOATING ACTION BAR (BOTTOM) --- */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 pb-8 z-50 flex gap-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                {isLocked ? (
                    <button 
                        onClick={handleUpdateClick}
                        className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-amber-600 active:scale-[0.98] transition flex items-center justify-center gap-2"
                    >
                        <span>✏️</span> Update Enrolment
                    </button>
                ) : (
                    <>
                        <button onClick={handleCancelEdit} className="flex-1 bg-gray-100 text-gray-600 font-bold py-4 rounded-xl hover:bg-gray-200">Cancel</button>
                        <button onClick={() => setShowSaveModal(true)} disabled={isSaving} className="flex-[2] bg-[#CC0000] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-[#A30000] flex items-center justify-center gap-2">
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </>
                )}
            </div>

            {/* --- MODALS --- */}
            {/* EDIT WARNING */}
            {showEditModal && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4"><span className="text-2xl">⚠️</span></div><h3 className="font-bold text-lg text-gray-900">Edit Enrolment?</h3><p className="text-sm text-gray-500 mt-2 mb-4">Changes to "Curricular Offering" may reset data for hidden grade levels to zero.</p><label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer mb-6 border border-transparent hover:border-gray-200 transition"><input type="checkbox" checked={editAgreement} onChange={(e) => setEditAgreement(e.target.checked)} className="mt-1 w-4 h-4 text-amber-600 rounded focus:ring-amber-600" /><span className="text-xs font-bold text-gray-700 select-none">I understand and wish to proceed.</span></label><div className="flex gap-2"><button onClick={()=>setShowEditModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-600">Cancel</button><button onClick={handleConfirmEdit} disabled={!editAgreement} className={`flex-1 py-3 rounded-xl text-white font-bold shadow-sm ${editAgreement ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gray-300 cursor-not-allowed'}`}>Proceed</button></div></div></div>}
            
            {/* SAVE CONFIRMATION */}
            {showSaveModal && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4"><span className="text-2xl">💾</span></div><h3 className="font-bold text-lg text-gray-900">Confirm Submission</h3><div className="bg-blue-50 p-4 rounded-xl border border-blue-100 my-4 flex justify-between items-center"><span className="text-sm font-bold text-blue-800">Grand Total:</span><span className="text-xl font-extrabold text-blue-900">{getGrandTotal()}</span></div><div className="flex gap-2"><button onClick={()=>setShowSaveModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-gray-600">Cancel</button><button onClick={confirmSave} className="flex-1 py-3 bg-[#CC0000] text-white rounded-xl font-bold shadow-lg hover:bg-[#A30000]">Submit</button></div></div></div>}

        </div>
    );
};

export default Enrolment;