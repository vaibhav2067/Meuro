// Load Firebase modules from a CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect, push, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Paste your Firebase config here
const firebaseConfig = {
    apiKey: "eNTER yOUR api key",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "https://meuro-16819-default-rtdb.firebaseio.com/",
    projectId: "meuro-16819",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Sign in anonymously (no login required)
signInAnonymously(auth)
    .then(() => {
        console.log("Signed in as a guest!");
    })
    .catch((error) => {
        console.error("Authentication failed:", error);
    });

// Export database & Firebase functions to use in other files
export { db, ref, set, onValue, onDisconnect, push, remove, get };
