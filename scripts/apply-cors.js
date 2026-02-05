
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Load environment variables from parent directory (where .env usually is)
dotenv.config();

const BUCKET_NAME = "insighted-6ba10.firebasestorage.app"; // Defined in your config

const initFirebase = () => {
    if (!admin.apps.length) {
        try {
            let credential;
            // 1. Try Environment Variable
            if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                credential = admin.credential.cert(serviceAccount);
                console.log("✅ Firebase Admin Initialized from ENV");
            }
            // 2. Try Local File (Check standard locations)
            else {
                const paths = ["./api/service-account.json", "./service-account.json"];
                for (const p of paths) {
                    try {
                        const serviceAccount = require(p);
                        credential = admin.credential.cert(serviceAccount);
                        console.log(`✅ Firebase Admin Initialized from Local File: ${p}`);
                        break;
                    } catch (e) {
                        // Continue
                    }
                }
            }

            if (credential) {
                admin.initializeApp({
                    credential,
                    storageBucket: BUCKET_NAME
                });
            } else {
                console.error("❌ FATAL: Could not find service-account.json or FIREBASE_SERVICE_ACCOUNT env var.");
                console.error("Please place 'service-account.json' in the 'api' folder or root folder.");
                process.exit(1);
            }
        } catch (e) {
            console.error("⚠️ Firebase Admin Init Failed:", e.message);
            process.exit(1);
        }
    }
};

const applyCors = async () => {
    initFirebase();

    const bucket = admin.storage().bucket();

    console.log(`Configuring CORS for bucket: ${bucket.name}...`);

    try {
        await bucket.setCorsConfiguration([
            {
                "origin": ["*"], // Allow all origins (localhost, vercel, etc.)
                "method": ["GET", "PUT", "POST", "DELETE", "HEAD", "OPTIONS"],
                "responseHeader": ["Content-Type", "x-goog-resumable"],
                "maxAgeSeconds": 3600
            }
        ]);

        console.log("✅ CORS Configuration Applied Successfully!");
        console.log("You can now try uploading files again.");
    } catch (error) {
        console.error("❌ Failed to set CORS config:", error);
    }
};

applyCors();
