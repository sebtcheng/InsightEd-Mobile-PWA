import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function checkUsers() {
  let result = {};
  try {
    const user1 = await admin.auth().getUserByEmail('110211@insighted.app');
    result['insighted.app'] = user1.uid;
  } catch(e) {
    result['insighted.app'] = 'Not found';
  }

  try {
    const user2 = await admin.auth().getUserByEmail('110211@deped.gov.ph');
    result['deped.gov.ph'] = user2.uid;
  } catch(e) {
    result['deped.gov.ph'] = 'Not found';
  }
  
  fs.writeFileSync('firebase_uid_result.json', JSON.stringify(result, null, 2));
}

checkUsers();
