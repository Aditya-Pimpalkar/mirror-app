const admin = require("firebase-admin");
let initialized = false;

function initFirebase() {
  if (initialized) return admin;
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  initialized = true;
  console.log(`✓ Firebase initialized [project: ${process.env.FIREBASE_PROJECT_ID}]`);
  return admin;
}

function getFirestore() { initFirebase(); return admin.firestore(); }
function getAuth() { initFirebase(); return admin.auth(); }

module.exports = { initFirebase, getFirestore, getAuth };
