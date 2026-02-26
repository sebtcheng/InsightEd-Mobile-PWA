import admin from 'firebase-admin';
import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;
const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf-8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const pool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function diagnoseAndFix() {
  const schoolId = '111484';
  let firebaseUid = null;
  
  console.log(`--- DIAGNOSING ${schoolId} ---`);
  
  // 1. Get from Firebase
  try {
    const user1 = await admin.auth().getUserByEmail(`${schoolId}@insighted.app`);
    console.log(`Firebase User Found (${schoolId}@insighted.app):`, user1.uid);
    firebaseUid = user1.uid;
  } catch(e) {
    console.log(`Firebase User Not Found (${schoolId}@insighted.app)`);
  }

  if (!firebaseUid) {
    try {
      const user2 = await admin.auth().getUserByEmail(`${schoolId}@deped.gov.ph`);
      console.log(`Firebase User Found (${schoolId}@deped.gov.ph):`, user2.uid);
      firebaseUid = user2.uid;
    } catch(e) {
      console.log(`Firebase User Not Found (${schoolId}@deped.gov.ph)`);
    }
  }
  
  // 2. Query Postgres
  try {
    const schoolRes = await pool.query("SELECT school_id, school_name, submitted_by FROM school_profiles WHERE school_id = $1", [schoolId]);
    console.log('School Profile Submitters:', schoolRes.rows);
    
    if (firebaseUid) {
      const userRes = await pool.query("SELECT uid, email, role, disabled FROM users WHERE uid = $1", [firebaseUid]);
      console.log(`Postgres User table for ${firebaseUid}:`, userRes.rows);
      
      console.log('--- FIXING ---');
      // If user does not exist in postgres, insert it
      if (userRes.rows.length === 0) {
         console.log('User not in Postgres. Inserting...');
         await pool.query(`
            INSERT INTO users (uid, email, role, first_name, last_name, created_at, disabled)
            VALUES ($1, $2, $3, $4, $5, NOW(), false)
            ON CONFLICT (uid) DO UPDATE SET disabled = false
         `, [firebaseUid, `${schoolId}@insighted.app`, 'School Head', 'School', 'Head']);
         console.log('User inserted.');
      } else {
         console.log('User already exists in Postgres. Ensuring disabled is false.');
         await pool.query("UPDATE users SET disabled = false WHERE uid = $1", [firebaseUid]);
      }
      
      // Update school profile
      console.log('Updating school_profiles to point to correct UID.');
      await pool.query("UPDATE school_profiles SET submitted_by = $1 WHERE school_id = $2", [firebaseUid, schoolId]);
      
      // Also ensure Firestore has the user document
      const db = admin.firestore();
      const userRef = db.collection('users').doc(firebaseUid);
      const doc = await userRef.get();
      if (!doc.exists) {
         console.log('User missing in Firestore. Creating...');
         await userRef.set({
           email: `${schoolId}@insighted.app`,
           role: 'School Head',
           firstName: 'School',
           lastName: 'Head',
           createdAt: admin.firestore.FieldValue.serverTimestamp(),
           disabled: false
         });
         console.log('Firestore user created.');
      } else {
         console.log('Firestore user exists. Ensuring role properly set.');
         await userRef.update({
           role: 'School Head',
           disabled: false
         });
      }
      console.log('Fix complete.');
      
    } else {
      console.log('No Firebase UID found. Cannot fix.');
    }
  } catch (e) {
    console.error('Error during DB fix:', e);
  } finally {
    pool.end();
  }
}

diagnoseAndFix();
