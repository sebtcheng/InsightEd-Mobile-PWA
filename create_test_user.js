
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { createRequire } from "module";
const require = createRequire(import.meta.url);

dotenv.config();

if (!admin.apps.length) {
    try {
        const serviceAccount = require("./api/service-account.json");
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        process.exit(1);
    }
}

async function createTestUser() {
    const email = 'test_master_login@example.com';
    try {
        // Create user
        const user = await admin.auth().createUser({
            email: email,
            password: 'TestPassword123!',
            displayName: 'Test User'
        });
        console.log(`Created user: ${user.email} (${user.uid})`);

        // Add to Firestore to simulate the scenario
        await admin.firestore().collection('users').doc(user.uid).set({
            email: email,
            role: 'Super Admin',
            firstName: 'Test',
            lastName: 'User'
        });
        console.log('Added to Firestore.');

    } catch (error) {
        if (error.code === 'auth/email-already-exists') {
            const user = await admin.auth().getUserByEmail(email);
            console.log(`User already exists: ${user.email} (${user.uid})`);
            // Ensure Firestore doc exists
            await admin.firestore().collection('users').doc(user.uid).set({
                email: email,
                role: 'Super Admin',
                firstName: 'Test',
                lastName: 'User'
            }, { merge: true });
            console.log('Updated Firestore.');
        } else {
            console.error('Error creating user:', error);
        }
    }
}

createTestUser();
