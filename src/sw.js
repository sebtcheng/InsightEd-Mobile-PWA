import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

// 1. Standard PWA Caching (Replaces your old INSTALL/FETCH listeners)
// This automatically loads the correct file list from Vite (index-XH23.js, etc.)
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
self.skipWaiting();
clientsClaim();

// Register a navigation route that returns the cached 'index.html'
// This handles requests for URLs like /dashboard or /profile when offline
registerRoute(
    new NavigationRoute(createHandlerBoundToURL('index.html'))
);

// 2. Your Custom Configuration
// (I kept your exact Google Script URL)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxD8SxFbX_6FlAgUdk0jCSrqhkCrGs645sKJNgrjme4zJkSEiNOfpu53RxqOd0HeOTeiQ/exec";
const DB_NAME = 'surveyDB';
const STORE_NAME = 'surveys';

// 3. Your Background Sync Logic
// (This remains exactly the same as your original code)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-surveys') {
        console.log('[ServiceWorker] Sync event fired: sync-surveys');
        event.waitUntil(syncSurveys());
    }
});

async function syncSurveys() {
    console.log('[ServiceWorker] Starting survey sync...');
    try {
        const surveys = await getAllSurveysFromDB();

        if (!surveys || surveys.length === 0) {
            console.log('[ServiceWorker] No surveys to sync.');
            return;
        }

        console.log(`[ServiceWorker] Found ${surveys.length} surveys to sync.`);

        const syncPromises = surveys.map(survey => {
            const dataToSend = { ...survey };
            delete dataToSend.id;

            return fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(dataToSend),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            })
                .then(response => {
                    if (response.ok) {
                        console.log(`[ServiceWorker] Successfully synced survey ID ${survey.id}`);
                        return deleteSurveyFromDB(survey.id);
                    } else {
                        console.error(`[ServiceWorker] Server error for survey ID ${survey.id}. Status: ${response.status}`);
                        return Promise.reject(new Error(`Server error: ${response.status}`));
                    }
                })
                .catch(err => {
                    console.error(`[ServiceWorker] Failed to sync survey ID ${survey.id}`, err);
                });
        });

        await Promise.all(syncPromises);
        console.log('[ServiceWorker] Survey sync complete.');

    } catch (err) {
        console.error('[ServiceWorker] Error during sync:', err);
    }
}

// 4. IndexedDB Helpers (Unchanged)
function openDB() {
    return new Promise((resolve, reject) => {
        const request = self.indexedDB.open(DB_NAME, 1);
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function getAllSurveysFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function deleteSurveyFromDB(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}