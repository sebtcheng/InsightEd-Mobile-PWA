import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import BottomNav from './BottomNav';
import { auth } from '../firebase'; // Ensure auth is imported to get the current user UID

const ProjectGallery = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(null);

    const API_BASE = 'http://localhost:3000'; 

    useEffect(() => {
        const fetchImages = async () => {
            try {
                const user = auth.currentUser;
                if (!user) {
                    console.error("No user logged in");
                    setLoading(false);
                    return;
                }

                // LOGIC: If we have a projectId in the URL, fetch project-specific images. 
                // Otherwise, fetch ALL images uploaded by this specific engineer.
                const endpoint = projectId 
                    ? `${API_BASE}/api/project-images/${projectId}`
                    : `${API_BASE}/api/engineer-images/${user.uid}`;

                const response = await fetch(endpoint);
                const data = await response.json();
                setImages(data);
            } catch (err) {
                console.error("Failed to load gallery:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchImages();
    }, [projectId]);

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 pb-24">
                {/* Header */}
                <div className="bg-[#004A99] p-6 pt-12 rounded-b-3xl shadow-lg mb-6">
                    <button onClick={() => navigate(-1)} className="text-white mb-4 flex items-center gap-2 text-sm">
                        ← Back to Dashboard
                    </button>
                    <h1 className="text-2xl font-bold text-white">
                        {projectId ? "Project Gallery" : "My Uploads"}
                    </h1>
                    <p className="text-blue-100 text-xs">
                        {projectId ? "Viewing site progress for this project" : "Viewing all your submitted site photos"}
                    </p>
                </div>

                <div className="px-5">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-slate-500 text-sm">Loading images...</p>
                        </div>
                    ) : images.length === 0 ? (
                        <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-slate-300">
                            <span className="text-4xl block mb-4">📷</span>
                            <p className="text-slate-600 font-medium">No photos found</p>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {projectId 
                                    ? "No photos have been uploaded for this specific project yet." 
                                    : "You haven't uploaded or taken any photos yet."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {images.map((img) => (
                                <div 
                                    key={img.id} 
                                    className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 active:scale-95 transition-transform"
                                    onClick={() => setSelectedImage(img)}
                                >
                                    <img 
                                        src={img.image_data} 
                                        alt="Site progress" 
                                        className="w-full h-40 object-cover cursor-pointer"
                                    />
                                    <div className="p-2 bg-white">
                                        {/* Display School Name if viewing general gallery */}
                                        {!projectId && img.school_name && (
                                            <p className="text-[10px] font-bold text-[#004A99] truncate uppercase mb-1">
                                                {img.school_name}
                                            </p>
                                        )}
                                        <p className="text-[9px] text-slate-400">
                                            {new Date(img.created_at).toLocaleDateString()} at {new Date(img.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FULLSCREEN IMAGE PREVIEW MODAL */}
                {selectedImage && (
                    <div 
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setSelectedImage(null)}
                    >
                        <button 
                            className="absolute top-10 right-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white text-2xl"
                            onClick={() => setSelectedImage(null)}
                        >
                            ✕
                        </button>

                        <div className="w-full max-w-4xl max-h-[70vh] flex items-center justify-center">
                            <img 
                                src={selectedImage.image_data} 
                                alt="Zoomed progress" 
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>

                        <div className="mt-6 text-center text-white">
                            {selectedImage.school_name && (
                                <p className="text-md font-bold text-blue-400 uppercase mb-2">{selectedImage.school_name}</p>
                            )}
                            <p className="text-sm font-bold">Captured on</p>
                            <p className="text-xs text-slate-400">
                                {new Date(selectedImage.created_at).toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                })}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                {new Date(selectedImage.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </p>
                        </div>
                    </div>
                )}

                <BottomNav userRole="Engineer" />
            </div>
        </PageTransition>
    );
};

export default ProjectGallery;