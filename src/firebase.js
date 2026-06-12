import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCFyovgS3BH02ifme7wpyQyJR7CgR6nqos",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "roomfinder-34671.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://roomfinder-34671-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "roomfinder-34671",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "roomfinder-34671.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "50696371399",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:50696371399:web:f8428844e41be7a34292e2",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-LSSQZYTFL8"
};

export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
