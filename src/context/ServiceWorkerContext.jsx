import React, { createContext, useContext, useState, useEffect } from 'react';

const ServiceWorkerContext = createContext(null);

export const useServiceWorker = () => {
    return useContext(ServiceWorkerContext);
};

export const ServiceWorkerProvider = ({ children }) => {
    const [wb, setWb] = useState(null);
    const [registration, setRegistration] = useState(null);
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            // Dynamically determine the base path from Vite's import.meta.env
            const basePath = import.meta.env.BASE_URL || '/';
            // Construct the SW path. If base is '/', path is '/sw.js'. If base is '/foo/', path is '/foo/sw.js'
            const swUrl = `${basePath}sw.js`.replace('//', '/');

            const registerSW = async () => {
                try {
                    const reg = await navigator.serviceWorker.register(swUrl, { scope: basePath });
                    setRegistration(reg);
                    console.log('InsightEd PWA Registered at:', reg.scope);

                    // Check for updates periodically (optional, but good practice)
                    setInterval(() => {
                        reg.update();
                    }, 60 * 60 * 1000); // Check every hour

                    // 1. Check if there's ALREADY a waiting worker (update ready)
                    if (reg.waiting) {
                        setIsUpdateAvailable(true);
                    }

                    // 2. Check if there's an installing worker (update in progress)
                    // If the page loads while SW is installing, we must listen to it here.
                    if (reg.installing) {
                        const sw = reg.installing;
                        sw.addEventListener('statechange', () => {
                            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                                setIsUpdateAvailable(true);
                            }
                        });
                    }

                    // 3. Listen for future updates
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        console.log('New service worker installing...');

                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('New service worker installed and waiting.');
                                setIsUpdateAvailable(true);
                            }
                        });
                    });


                    // 4. Check for updates on Window Focus / Visibility Change
                    // This ensures if the user comes back to the app, we check for updates immediately
                    document.addEventListener('visibilitychange', () => {
                        if (document.visibilityState === 'visible') {
                            console.log('App visible, checking for SW updates...');
                            reg.update();
                        }
                    });

                    window.addEventListener('focus', () => {
                        console.log('Window focused, checking for SW updates...');
                        reg.update();
                    });
                } catch (err) {
                    console.error('PWA Registration Failed:', err);
                }
            };

            registerSW();

            // Listen for controller change (reload happened)

            // Listen for controller change (reload happened)
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    window.location.reload();
                    refreshing = true;
                }
            });
        }
    }, []);

    const updateApp = async () => {
        if (registration && registration.waiting) {
            try {
                // HARD RESET: Clear all caches before updating
                console.log('Clearing all caches for hard reset...');
                const cacheKeys = await caches.keys();
                await Promise.all(
                    cacheKeys.map(key => caches.delete(key))
                );
                console.log('All caches cleared.');

                // Send message to SW to skip waiting
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });

                // Note: The 'controllerchange' listener above will handle the actual reload
            } catch (error) {
                console.error('Error during hard reset update:', error);
                // Fallback: try to update anyway even if cache clear fails
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        }
    };

    const checkForUpdates = async () => {
        if (!registration) {
            console.log('No SW registration found, cannot check for updates.');
            return false;
        }
        try {
            console.log('Manual update check triggered...');
            await registration.update();

            // Check immediately after update() if there's a new worker installing or waiting
            if (registration.installing || registration.waiting) {
                console.log('Update found!');
                return true;
            }

            console.log('No update found.');
            return false;
        } catch (error) {
            console.error('Error checking for updates:', error);
            return false;
        }
    };

    const hardReset = async () => {
        try {
            console.log('Manual hard reset triggered.');
            // 1. Clear Caches
            const cacheKeys = await caches.keys();
            await Promise.all(
                cacheKeys.map(key => caches.delete(key))
            );
            console.log('Caches cleared.');

            // 2. Unregister SW to force fresh fetch
            if (registration) {
                await registration.unregister();
                console.log('Service Worker unregistered.');
            }

            // 3. Reload
            window.location.reload(true);
        } catch (error) {
            console.error('Hard reset failed:', error);
            window.location.reload(); // Force reload anyway
        }
    };

    const value = {
        isUpdateAvailable,
        updateApp,
        checkForUpdates,
        registration,
        hardReset // Exposed
    };

    return (
        <ServiceWorkerContext.Provider value={value}>
            {children}
        </ServiceWorkerContext.Provider>
    );
};
