
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
        console.error("Init failed:", e);
        process.exit(1);
    }
}

async function listUsers() {
    try {
        const listUsersResult = await admin.auth().listUsers(10);
        listUsersResult.users.forEach((userRecord) => {
            console.log('user', userRecord.email, userRecord.uid);
        });
    } catch (error) {
        console.log('Error listing users:', error);
    }
}

listUsers();
