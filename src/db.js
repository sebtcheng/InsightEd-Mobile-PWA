// src/db.js
import { openDB } from 'idb';

const DB_NAME = 'InsightEd_Outbox';
// Store names to distinguish between user roles
const SH_STORE = 'pending_requests'; // Original store for School Head
const ENG_STORE = 'engineer_pending'; // New store for Engineer
const PROJECTS_STORE = 'projects_cache'; // New store for caching projects
const GALLERY_STORE = 'gallery_cache'; // New store for caching gallery images

// 1. Initialize the Database
export async function initDB() {
  // Version bumped to 6 to add gallery store
  return openDB(DB_NAME, 6, {
    upgrade(db) {
      // Ensure School Head store exists
      if (!db.objectStoreNames.contains(SH_STORE)) {
        db.createObjectStore(SH_STORE, { keyPath: 'id', autoIncrement: true });
      }
      // Create Engineer-specific store
      if (!db.objectStoreNames.contains(ENG_STORE)) {
        db.createObjectStore(ENG_STORE, { keyPath: 'id', autoIncrement: true });
      }
      // Create Projects cache store
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
      // Create Gallery cache store
      if (!db.objectStoreNames.contains(GALLERY_STORE)) {
        db.createObjectStore(GALLERY_STORE, { keyPath: 'projectId' });
      }
    },
  });
}

// ==========================================
//        SCHOOL HEAD FUNCTIONS (Original)
// ==========================================

export async function addToOutbox(requestData) {
  const db = await initDB();
  return db.add(SH_STORE, {
    ...requestData,
    timestamp: new Date().toISOString(),
    status: 'pending'
  });
}

export async function getOutbox() {
  const db = await initDB();
  return db.getAll(SH_STORE);
}

export async function deleteFromOutbox(id) {
  const db = await initDB();
  return db.delete(SH_STORE, id);
}

// ==========================================
//        ENGINEER FUNCTIONS (New)
// ==========================================

/**
 * Saves an Engineer form request to the dedicated engineer outbox
 * @param {Object} requestData - contains { url, method, body, formName }
 */
export async function addEngineerToOutbox(requestData) {
  const db = await initDB();
  return db.add(ENG_STORE, {
    ...requestData,
    timestamp: new Date().toISOString(),
    status: 'pending'
  });
}

/**
 * Retrieves all pending forms specifically for the Engineer Sync Center
 */
export async function getEngineerOutbox() {
  const db = await initDB();
  return db.getAll(ENG_STORE);
}

/**
 * Deletes an Engineer request after successful sync to NeonSQL
 */
export async function deleteEngineerFromOutbox(id) {
  const db = await initDB();
  return db.delete(ENG_STORE, id);
}

// ==========================================
//        PROJECT CACHING FUNCTIONS
// ==========================================

/**
 * Caches the fetched projects list to IndexedDB
 * @param {Array} projects - List of project objects
 */
export async function cacheProjects(projects) {
  const db = await initDB();
  const tx = db.transaction(PROJECTS_STORE, 'readwrite');
  const store = tx.objectStore(PROJECTS_STORE);

  // Clear existing cache to ensure we have fresh data
  await store.clear();

  for (const project of projects) {
    await store.put(project);
  }

  return tx.done;
}

/**
 * Retrieves cached projects from IndexedDB
 */
export async function getCachedProjects() {
  const db = await initDB();
  return db.getAll(PROJECTS_STORE);
}

/**
 * Caches gallery images for a specific project
 * @param {string} projectId 
 * @param {Array} images - List of image objects/urls
 */
export async function cacheGallery(projectId, images) {
  const db = await initDB();
  return db.put(GALLERY_STORE, { projectId, images, timestamp: Date.now() });
}

/**
 * Retrieves cached gallery images for a specific project
 * @param {string} projectId
 */
export async function getCachedGallery(projectId) {
  const db = await initDB();
  let entry = await db.get(GALLERY_STORE, projectId);
  if (!entry) entry = await db.get(GALLERY_STORE, String(projectId));
  if (!entry && !isNaN(projectId)) entry = await db.get(GALLERY_STORE, Number(projectId));
  return entry ? entry.images : [];
}
