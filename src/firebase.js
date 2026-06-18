import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBFVrP2qrbqkLup1eDSLSqy6pPwAGYifKw",
  authDomain: "pool-finder-db91d.firebaseapp.com",
  projectId: "pool-finder-db91d",
  storageBucket: "pool-finder-db91d.firebasestorage.app",
  messagingSenderId: "888074000449",
  appId: "1:888074000449:web:a9569d33508ce43a1f8ec0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
