// src/db.js
import { openDB } from 'idb';

const DB_NAME = 'InsightEd_Outbox';
// Store names to distinguish between user roles
const SH_STORE = 'pending_requests'; // Original store for School Head
const ENG_STORE = 'engineer_pending'; // New store for Engineer

// 1. Initialize the Database
export async function initDB() {
  // Version bumped to 2 to trigger the upgrade and create the new store
  return openDB(DB_NAME, 2, {
    upgrade(db) {
      // Ensure School Head store exists
      if (!db.objectStoreNames.contains(SH_STORE)) {
        db.createObjectStore(SH_STORE, { keyPath: 'id', autoIncrement: true });
      }
      // Create Engineer-specific store
      if (!db.objectStoreNames.contains(ENG_STORE)) {
        db.createObjectStore(ENG_STORE, { keyPath: 'id', autoIncrement: true });
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