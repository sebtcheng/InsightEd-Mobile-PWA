// src/db.js
import { openDB } from 'idb';

const DB_NAME = 'InsightEd_Outbox';
// Store names to distinguish between user roles
const SH_STORE = 'pending_requests'; // Original store for School Head
const ENG_STORE = 'engineer_pending'; // New store for Engineer
const PROJECTS_STORE = 'projects_cache'; // New store for caching projects
const GALLERY_STORE = 'gallery_cache'; // New store for caching gallery images
const DRAFT_SPACES_STORE = 'buildable_spaces_drafts'; // New store for draft spaces
const REPAIRS_STORE = 'facility_repairs'; // Store for offline facility repairs

const SCHOOLS_STORE = 'schools_cache'; // Define constant at top

// UNIFIED DB VERSION — all functions must use THIS version 
const DB_VERSION = 10;

// 1. Initialize the Database
export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
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
      // Create Schools cache store
      if (!db.objectStoreNames.contains(SCHOOLS_STORE)) {
        db.createObjectStore(SCHOOLS_STORE, { keyPath: 'school_id' });
      }
      // Create Draft Spaces store
      if (!db.objectStoreNames.contains(DRAFT_SPACES_STORE)) {
        db.createObjectStore(DRAFT_SPACES_STORE, { keyPath: 'uid' });
      }
      // Create Facility Repairs store (offline queue)
      if (!db.objectStoreNames.contains(REPAIRS_STORE)) {
        const repairStore = db.createObjectStore(REPAIRS_STORE, { keyPath: 'local_id', autoIncrement: true });
        repairStore.createIndex('iern', 'iern', { unique: false });
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

// ==========================================
//        SCHOOL CACHING FUNCTIONS (Offline Validation)
// ==========================================
// SCHOOLS_STORE is defined at the top of the file

/**
 * Caches the schools list for offline validation
 * @param {Array} schools - List of school objects
 */
export async function cacheSchools(schools) {
  const db = await initDB(); // Use unified initDB — same version, same upgrade

  const tx = db.transaction(SCHOOLS_STORE, 'readwrite');
  const store = tx.objectStore(SCHOOLS_STORE);

  // Clear old data and replace with fresh server data
  await store.clear();

  for (const school of schools) {
    await store.put(school);
  }

  await tx.done;
  console.log(`✅ [db.js] Cached ${schools.length} schools to IndexedDB.`);
}

/**
 * Retrieves a cached school by ID
 * @param {string} schoolId
 */
export async function getCachedSchool(schoolId) {
  const db = await initDB(); // Use unified initDB

  // Try exact match first
  let school = await db.get(SCHOOLS_STORE, schoolId);

  // Fallback: Try as string if it was a number, or vice versa
  if (!school && typeof schoolId === 'string') {
    school = await db.get(SCHOOLS_STORE, Number(schoolId));
  } else if (!school && typeof schoolId === 'number') {
    school = await db.get(SCHOOLS_STORE, String(schoolId));
  }

  return school;
}

/**
 * Returns count of cached schools (for debugging)
 */
export async function getCachedSchoolCount() {
  const db = await initDB();
  return db.count(SCHOOLS_STORE);
}

// ==========================================
//        BUILDABLE SPACES DRAFTS (IndexedDB)
// ==========================================
// DRAFT_SPACES_STORE is defined at the top

/**
 * Saves the current list of buildable spaces as a draft for the user
 * @param {string} uid - User ID
 * @param {Array} spaces - Array of space objects
 */
export async function saveSpaceDraft(uid, spaces) {
  const db = await initDB();
  return db.put(DRAFT_SPACES_STORE, { uid, spaces, timestamp: Date.now() });
}

/**
 * Retrieves the draft buildable spaces for the user
 * @param {string} uid
 */
export async function getSpaceDrafts(uid) {
  const db = await initDB();
  const entry = await db.get(DRAFT_SPACES_STORE, uid);
  return entry ? entry.spaces : [];
}

/**
 * Clears the draft buildable spaces for the user (e.g., after successful save)
 * @param {string} uid
 */
export async function clearSpaceDrafts(uid) {
  const db = await initDB();
  return db.delete(DRAFT_SPACES_STORE, uid);
}

// ==========================================
//        FACILITY REPAIRS (Offline Queue)
// ==========================================

/**
 * Saves a facility repair assessment locally for offline sync
 * @param {Object} repairData - The repair payload
 */
export async function addRepairToLocal(repairData) {
  const db = await initDB();
  return db.add(REPAIRS_STORE, {
    ...repairData,
    timestamp: new Date().toISOString(),
    status: 'pending'
  });
}

/**
 * Retrieves all pending repairs from IndexedDB
 */
export async function getLocalRepairs() {
  const db = await initDB();
  return db.getAll(REPAIRS_STORE);
}

/**
 * Deletes a repair from IndexedDB after successful sync
 * @param {number} localId - The local_id key
 */
export async function deleteLocalRepair(localId) {
  const db = await initDB();
  return db.delete(REPAIRS_STORE, localId);
}
