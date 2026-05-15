import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export async function signIn() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in", error);
    throw error;
  }
}

export async function logOut() {
  await signOut(auth);
}

async function testConnection() {
  try {
    // Attempt to get a dummy doc to verify connection
    await getDocFromServer(doc(db, 'system', 'connection_test'));
    console.log("Firebase connection established successfully");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client appears to be offline.");
    } else {
      // Normal error if the doc doesn't exist, which is fine
      console.log("Firebase connection test performed");
    }
  }
}

testConnection();
