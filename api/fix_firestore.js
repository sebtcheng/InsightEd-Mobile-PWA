import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixFirestoreUser() {
  const correctUid = 'f8mbQBKfwcgyDfTHeb8cRqRDNwE2';

  try {
    const userRef = db.collection('users').doc(correctUid);
    const doc = await userRef.get();
    
    if (!doc.exists) {
      console.log('User document missing in Firestore. Creating...');
      await userRef.set({
        email: '110211@insighted.app',
        role: 'School Head',
        firstName: 'Claudia',
        lastName: 'Elementary School',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        disabled: false
      });
      console.log('User document created successfully.');
    } else {
      console.log('User document already exists in Firestore:', doc.data());
      
      // Update it just in case
      await userRef.update({
        role: 'School Head',
        disabled: false
      });
      console.log('User document updated successfully.');
    }
    
    // Check for the bad UID and delete it
    const badUid = 'f8mbQQBKfwcgyDfTHeb8cRqRDNwE2';
    const badUserRef = db.collection('users').doc(badUid);
    const badDoc = await badUserRef.get();
    
    if (badDoc.exists) {
      console.log('Found bad UID document. Deleting...');
      await badUserRef.delete();
      console.log('Bad UID document deleted.');
    }
  } catch(e) {
    console.log('Error:', e.message);
  }
}

fixFirestoreUser();
