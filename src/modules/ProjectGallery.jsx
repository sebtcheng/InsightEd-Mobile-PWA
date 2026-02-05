import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import BottomNav from './BottomNav';
import { auth } from '../firebase';
import { cacheGallery, getCachedGallery } from '../db';

// --- LAZY IMAGE COMPONENT ---
const LazyImage = ({ imageId, meta, onClick }) => {
    const [src, setSrc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchImage = async () => {
            // 1. Try Cache First (Optional optimization for offline if implemented)
            // For now, straight fetch
            try {
                const res = await fetch(`/api/image/${imageId}`);
                if (res.ok) {
                    const data = await res.json();
                    // normalize base64
                    let base64 = data.image_data || "";
                    if (!base64.startsWith("http") && !base64.startsWith("data:")) {
                        base64 = `data:image/jpeg;base64,${base64}`;
                    }
                    if (isMounted) {
                        setSrc(base64);
                        setLoading(false);
                    }
                } else {
                    throw new Error("Failed to load");
                }
            } catch (err) {
                console.warn(`Failed to load image ${imageId}`, err);
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            }
        };

        // If we already passed data (e.g. from cache if we decide to cache full objects), use it
        // But the parent is now sending metadata only.
        fetchImage();

        return () => { isMounted = false; };
    }, [imageId]);

    if (loading) {
        return (
            <div className="bg-slate-50 w-full h-40 flex flex-col items-center justify-center animate-pulse border border-slate-100">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !src) {
        return (
            <div className="bg-slate-50 w-full h-40 flex flex-col items-center justify-center text-slate-300">
                <span>⚠️ Failed</span>
            </div>
        );
    }

    return (
        <div
            className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 active:scale-95 transition-transform"
            onClick={() => onClick({ ...meta, image_data: src })}
        >
            <img
                src={src}
                alt="Site progress"
                className="w-full h-40 object-cover cursor-pointer bg-slate-100"
                loading="lazy"
            />
            <div className="p-2 bg-white">
                {!meta.projectId && meta.school_name && (
                    <p className="text-[10px] font-bold text-[#004A99] truncate uppercase mb-1">
                        {meta.school_name}
                    </p>
                )}
                <p className="text-[9px] text-slate-400">
                    {new Date(meta.created_at).toLocaleDateString()} at {new Date(meta.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );
};

const ProjectGallery = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [images, setImages] = useState([]); // Now this will hold METADATA only
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(null);

    const API_BASE = '';

    useEffect(() => {
        const fetchImages = async () => {
            const user = auth.currentUser;
            if (!user) {
                setLoading(false);
                return;
            }

            // Load Metadata List
            try {
                const endpoint = projectId
                    ? `${API_BASE}/api/project-images/${projectId}`
                    : `${API_BASE}/api/engineer-images/${user.uid}`;

                const response = await fetch(endpoint);
                const data = await response.json();

                if (Array.isArray(data)) {
                    console.log("Loaded image list:", data.length);
                    setImages(data);
                } else {
                    console.warn("API did not return an array:", data);
                    setImages([]);
                }

            } catch (err) {
                console.warn("Network gallery load failed:", err);
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
                <div className="bg-[#004A99] p-6 pt-12 rounded-b-3xl shadow-lg mb-6 sticky top-0 z-10">
                    <button onClick={() => navigate(-1)} className="text-white mb-4 flex items-center gap-2 text-sm hover:text-blue-200 transition-colors">
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
                            <p className="text-slate-500 text-sm">Loading gallery...</p>
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
                            {images.map((meta) => (
                                <LazyImage
                                    key={meta.id}
                                    imageId={meta.id}
                                    meta={meta}
                                    onClick={(fullData) => setSelectedImage(fullData)}
                                />
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
                            className="absolute top-10 right-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white text-2xl hover:bg-white/20 transition"
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
                                {new Date(selectedImage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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