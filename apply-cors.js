import admin from 'firebase-admin';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);

// 1. Load Service Account
let serviceAccount;
try {
    // Try root
    serviceAccount = require('./service-account.json');
    console.log("Found service-account.json in root.");
} catch (e) {
    try {
        // Try api folder
        serviceAccount = require('./api/service-account.json');
        console.log("Found service-account.json in api/.");
    } catch (e2) {
        console.error("❌ Error: Could not find 'service-account.json' in root or 'api/' folder.");
        process.exit(1);
    }
}

// 2. Load CORS Config
let corsConfig;
try {
    corsConfig = require('./cors.json');
    console.log("Loaded cors.json configuration.");
} catch (e) {
    console.error("❌ Error: Could not find 'cors.json'.");
    process.exit(1);
}

// 3. Initialize App
try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin initialized.");
} catch (error) {
    console.error("❌ Error initializing Firebase Admin:", error.message);
    process.exit(1);
}

const bucketName = 'insighted-6ba10.firebasestorage.app';
const bucket = admin.storage().bucket(bucketName);

// 4. Set CORS
async function setCors() {
    try {
        console.log(`Setting CORS for bucket: ${bucketName}...`);
        await bucket.setCorsConfiguration(corsConfig);
        console.log("✅ CORS configuration applied successfully!");
        console.log("You can now verify by uploading a file in the app.");
    } catch (error) {
        console.error("❌ Failed to set CORS:", error);
    }
}

setCors();
