import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

// 1. Standard PWA Caching (Replaces your old INSTALL/FETCH listeners)
// This automatically loads the correct file list from Vite (index-XH23.js, etc.)
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Listen for the 'SKIP_WAITING' message from the client
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
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
    if (event.tag === 'sync-facility-repairs') {
        console.log('[ServiceWorker] Sync event fired: sync-facility-repairs');
        event.waitUntil(syncFacilityRepairs());
    }
});

// 5. Facility Repairs Background Sync
const REPAIR_DB_NAME = 'InsightEd_Outbox';
const REPAIR_DB_VERSION = 10;
const REPAIR_STORE_NAME = 'facility_repairs';

async function syncFacilityRepairs() {
    console.log('[ServiceWorker] Starting facility repairs sync...');
    try {
        const repairs = await getAllRepairsFromDB();
        if (!repairs || repairs.length === 0) {
            console.log('[ServiceWorker] No facility repairs to sync.');
            return;
        }
        console.log(`[ServiceWorker] Found ${repairs.length} facility repairs to sync.`);

        for (const repair of repairs) {
            try {
                const payload = { ...repair };
                const localId = payload.local_id;
                delete payload.local_id;
                delete payload.timestamp;
                delete payload.status;

                const response = await fetch('/api/save-facility-repair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (response.ok) {
                    console.log(`[ServiceWorker] Successfully synced repair local_id=${localId}`);
                    await deleteRepairFromDB(localId);
                } else {
                    console.error(`[ServiceWorker] Server error for repair local_id=${localId}. Status: ${response.status}`);
                }
            } catch (err) {
                console.error(`[ServiceWorker] Failed to sync repair:`, err);
            }
        }
        console.log('[ServiceWorker] Facility repairs sync complete.');
    } catch (err) {
        console.error('[ServiceWorker] Error during facility repairs sync:', err);
    }
}

function openRepairDB() {
    return new Promise((resolve, reject) => {
        const request = self.indexedDB.open(REPAIR_DB_NAME, REPAIR_DB_VERSION);
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(REPAIR_STORE_NAME)) {
                const store = db.createObjectStore(REPAIR_STORE_NAME, { keyPath: 'local_id', autoIncrement: true });
                store.createIndex('iern', 'iern', { unique: false });
            }
        };
    });
}

async function getAllRepairsFromDB() {
    const db = await openRepairDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([REPAIR_STORE_NAME], 'readonly');
        const store = transaction.objectStore(REPAIR_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function deleteRepairFromDB(id) {
    const db = await openRepairDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([REPAIR_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(REPAIR_STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

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