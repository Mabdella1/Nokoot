import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDocFromServer } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBzjgdlkeLwiK3o8gInA0tX3VOgf94LzpM",
  authDomain: "inductive-rigging-q5xj8.firebaseapp.com",
  projectId: "inductive-rigging-q5xj8",
  storageBucket: "inductive-rigging-q5xj8.firebasestorage.app",
  messagingSenderId: "985595875996",
  appId: "1:985595875996:web:278440b0f594653ed39359"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Explicitly set browser local persistence
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Auth persistence setup failed:", err);
});

// Initialize Firestore with custom database ID and persistent offline multi-tab cache
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, "ai-studio-439e8edd-f629-4919-a932-e94a37625dbc");

export { app, auth, db };

// Validate Connection to Firestore as per SKILL instructions
async function testConnection() {
  try {
    // Attempting a quick fetch to verify connection
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Firestore connected successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client is offline. Operating in cache/offline mode.");
    } else {
      console.warn("Firestore connection check info:", error);
    }
  }
}

testConnection();
