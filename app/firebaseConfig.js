import { initializeApp } from "firebase/app";
// 1. UPDATED IMPORTS for Persistence
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCnv7NGWI6v0ewTIRa_XrDlzf3oN_a7y-U",
  authDomain: "final-future-d1547.firebaseapp.com",
  projectId: "final-future-d1547",
  storageBucket: "final-future-d1547.firebasestorage.app",
  messagingSenderId: "850139505584",
  appId: "1:850139505584:web:bcb8ff6fb33c502a06ac75",
  databaseURL: "https://final-future-d1547-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 2. INITIALIZE AUTH WITH PERSISTENCE
// This tells Firebase to save the user session to the phone's storage
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getDatabase(app);

// Export instances
export { auth, db };
export default app;