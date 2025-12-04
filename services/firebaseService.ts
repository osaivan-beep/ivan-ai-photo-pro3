
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail,
    type User as FirebaseUser 
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    increment, 
    collection, 
    query, 
    where, 
    getDocs 
} from 'firebase/firestore';
// Import App Check
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import type { FirebaseConfig, UserProfile } from '../types';
import { embeddedConfig } from '../lib/firebaseConfig';

let app: FirebaseApp | undefined;
let db: any;
let auth: any;
let adminEmail: string = '';

export const isFirebaseConfigured = () => {
    // Check embedded config first (for GitHub Pages sharing)
    if (embeddedConfig) return true;
    
    // Fallback to local storage (for local dev/setup)
    const storedConfig = localStorage.getItem('firebaseConfig');
    return !!storedConfig;
};

export const initializeFirebase = (config?: FirebaseConfig) => {
    let finalConfig: FirebaseConfig | null = config || null;

    if (!finalConfig) {
        // 1. Try embedded config (Hardcoded for deployment)
        if (embeddedConfig) {
            finalConfig = embeddedConfig;
            // Allow admin email override via embedded config if needed, otherwise default to known admin
            if (embeddedConfig.adminEmail) {
                adminEmail = embeddedConfig.adminEmail;
            } else {
                // Hardcode your email if strictly needed, or rely on setup
                adminEmail = 'osa.ivan@gmail.com'; 
            }
        } 
        // 2. Try LocalStorage
        else {
            const stored = localStorage.getItem('firebaseConfig');
            if (stored) {
                finalConfig = JSON.parse(stored);
            }
        }
    }

    if (!finalConfig) {
         // If we are here, it means neither embedded nor stored config exists.
         // We cannot initialize app, but we don't throw error yet to allow LandingScreen to show "Setup" tab.
         return false;
    }

    // Validate config structure
    if (!finalConfig.apiKey || !finalConfig.authDomain || !finalConfig.projectId) {
        throw new Error("Invalid Firebase Configuration: Missing required fields (apiKey, authDomain, projectId).");
    }

    // Persist to local storage if it came from manual entry, so refresh works
    if (!embeddedConfig) {
        localStorage.setItem('firebaseConfig', JSON.stringify(finalConfig));
    }

    if (finalConfig.adminEmail) {
        adminEmail = finalConfig.adminEmail;
    } else if (!adminEmail) {
        adminEmail = 'osa.ivan@gmail.com';
    }

    if (!getApps().length) {
        app = initializeApp(finalConfig as any);
        
        // --- SECURITY IMPROVEMENT: APP CHECK ---
        // 注意：要啟用此功能，您需要在 Firebase Console 註冊您的網站，
        // 並取得 ReCAPTCHA v3 site key。
        // 當您準備好後，取消下方的註解並填入您的 Site Key。
        /*
        if (typeof window !== 'undefined') {
            try {
                // const appCheck = initializeAppCheck(app, {
                //     provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_V3_SITE_KEY'),
                //     isTokenAutoRefreshEnabled: true
                // });
                // console.log("Firebase App Check initialized.");
            } catch (e) {
                console.warn("App Check initialization failed:", e);
            }
        }
        */
        
    } else {
        app = getApp();
    }
    db = getFirestore(app);
    auth = getAuth(app);
    return true;
};

export const getAuthInstance = () => auth;

export const login = async (email: string, pass: string) => {
    if (!auth) throw new Error("Firebase not initialized");
    return await signInWithEmailAndPassword(auth, email, pass);
};

export const register = async (email: string, pass: string) => {
    if (!auth) throw new Error("Firebase not initialized");
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    // Initialize user profile with 20 credits
    await setDoc(doc(db, "users", userCredential.user.uid), {
        email: email,
        credits: 20
    });
    return userCredential;
};

export const logout = async () => {
    if (!auth) return;
    await signOut(auth);
};

export const sendPasswordReset = async (email: string) => {
    if (!auth) throw new Error("Firebase not initialized");
    await sendPasswordResetEmail(auth, email);
}

export const getUserProfile = async (uid: string): Promise<UserProfile> => {
    if (!db) throw new Error("Firebase not initialized");
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            uid,
            email: data.email,
            credits: data.credits || 0,
            isAdmin: data.email === adminEmail
        };
    } else {
        // Create if doesn't exist (fallback)
        await setDoc(doc(db, "users", uid), { email: auth.currentUser?.email, credits: 20 });
        return { uid, email: auth.currentUser?.email || '', credits: 20, isAdmin: auth.currentUser?.email === adminEmail };
    }
};

export const deductCredits = async (uid: string, amount: number) => {
    if (!db) throw new Error("Firebase not initialized");
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, {
        credits: increment(-amount)
    });
};

export const addCreditsByEmail = async (targetEmail: string, amount: number) => {
    if (!db) throw new Error("Firebase not initialized");
    // Find user by email
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", targetEmail));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("User not found");
    }

    const userDoc = querySnapshot.docs[0];
    await updateDoc(userDoc.ref, {
        credits: increment(amount)
    });
};

export const updateCreditsByUid = async (uid: string, amount: number) => {
    if (!db) throw new Error("Firebase not initialized");
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, {
        credits: increment(amount)
    });
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
    if (!db) throw new Error("Firebase not initialized");
    const usersRef = collection(db, "users");
    const querySnapshot = await getDocs(usersRef);
    const users: UserProfile[] = [];
    
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
            uid: doc.id,
            email: data.email,
            credits: data.credits || 0,
            isAdmin: data.email === adminEmail
        });
    });
    
    return users;
};
