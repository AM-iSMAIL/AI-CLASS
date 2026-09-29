import {
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth"
import { auth, googleProvider, db } from "./firebase"
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"

// Helper: Save user profile to Firestore
export const saveUserProfile = async (
  uid: string,
  email: string | null,
  displayName: string | null,
  role: string
) => {
  try {
    const userRef = doc(db, "users", uid)
    const userSnap = await getDoc(userRef)
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid,
        email,
        displayName,
        role,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      })
    } else {
      await updateDoc(userRef, {
        lastLogin: serverTimestamp(),
        ...(displayName && { displayName }),
      })
    }
  } catch (error) {
    console.error("Error saving user profile to Firestore:", error)
  }
}

// Helper to detect mobile browser or native Capacitor environment
export const isMobileOrNative = (): boolean => {
  if (typeof window === "undefined") return false
  const ua = (navigator.userAgent || navigator.vendor || "").toLowerCase()
  const isCapacitor = Boolean((window as any).Capacitor?.isNativePlatform?.())
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua)
  return isCapacitor || isMobile
}

// 1. Sign in with Google
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    // In mobile devices and native WebViews, popups lack window.opener communication,
    // which causes the Firebase auth handler to get stuck on a blank page.
    // Calling signInWithRedirect provides a clean full-page navigation.
    if (isMobileOrNative()) {
      await signInWithRedirect(auth, googleProvider)
      return null
    }

    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user
    if (user) {
      await saveUserProfile(user.uid, user.email, user.displayName, "teacher")
    }
    return user
  } catch (error: any) {
    if (
      error.code === "auth/popup-blocked" ||
      error.code === "auth/cancelled-popup-request" ||
      error.code === "auth/popup-closed-by-user"
    ) {
      console.warn("Popup blocked or closed, falling back to redirect...")
      await signInWithRedirect(auth, googleProvider)
      return null
    }

    if (error.code === "auth/unauthorized-domain") {
      const customErr = new Error(
        "Google Sign-In requires 'aiclass-six.vercel.app' to be authorized in Firebase Console > Authentication > Settings > Authorized Domains."
      )
      ;(customErr as any).code = "auth/unauthorized-domain"
      throw customErr
    }

    if (
      error.code === "auth/operation-not-supported-in-this-environment" ||
      error.code === "auth/disallowed-useragent" ||
      error.message?.includes("disallowed_useragent")
    ) {
      const customErr = new Error(
        "Google blocks sign-in inside embedded mobile WebViews. Please sign in with email & password."
      )
      ;(customErr as any).code = "auth/disallowed-useragent"
      throw customErr
    }

    console.error("Google Sign-In Error:", error)
    throw error
  }
}

// 2. Sign in with Email and Password
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    const user = result.user
    await saveUserProfile(user.uid, user.email, user.displayName, "teacher")
    return user
  } catch (error) {
    console.error("Email Sign-In Error:", error)
    throw error
  }
}

// 3. Sign up with Email and Password (and set display name)
export const signUpWithEmail = async (
  email: string,
  password: string,
  fullName: string
): Promise<User> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    const user = result.user
    // Update display name
    await updateProfile(user, {
      displayName: fullName,
    })
    // Save to Firestore under 'users' collection
    await saveUserProfile(user.uid, email, fullName, "teacher")
    return user
  } catch (error) {
    console.error("Email Sign-Up Error:", error)
    throw error
  }
}

// 4. Sign out
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth)
  } catch (error) {
    console.error("Sign-Out Error:", error)
    throw error
  }
}

// 5. Auth State Subscriber
export const subscribeToAuthChanges = (
  callback: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, callback)
}
export type { User }

