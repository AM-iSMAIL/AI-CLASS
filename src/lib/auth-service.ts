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

// 1. Sign in with Google
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user
    if (user) {
      await saveUserProfile(user.uid, user.email, user.displayName, "teacher")
    }
    return user
  } catch (error: any) {
    if (error.code === "auth/popup-blocked") {
      console.warn("Popup blocked, falling back to redirect...")
      await signInWithRedirect(auth, googleProvider)
      return null
    }

    if (error.code === "auth/unauthorized-domain") {
      const customErr = new Error(
        "Google Sign-In domain authorization pending in Firebase. Please use 'Instant 1-Tap Sign In' or Email below!"
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
        "Google Sign-In is restricted in mobile WebViews. Please use 'Instant 1-Tap Sign In' or Email below!"
      )
      ;(customErr as any).code = "auth/disallowed-useragent"
      throw customErr
    }

    console.error("Google Sign-In Error:", error)
    throw error
  }
}

// 1b. Instant 1-Tap Demo Sign In (Works natively on Android, iOS & Web)
export const signInOrSignUpDemo = async (
  role: "teacher" | "student" = "teacher"
): Promise<User> => {
  const email = role === "teacher" ? "demo.teacher@aiclass.edu" : "demo.student@aiclass.edu"
  const password = "DemoPassword123!"
  const displayName = role === "teacher" ? "Prof. Sarah Jenkins" : "Alex Johnson"

  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    await saveUserProfile(result.user.uid, result.user.email, result.user.displayName || displayName, role)
    return result.user
  } catch (err: any) {
    if (
      err.code === "auth/user-not-found" ||
      err.code === "auth/invalid-credential" ||
      err.code === "auth/invalid-login-credentials"
    ) {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(result.user, { displayName })
      await saveUserProfile(result.user.uid, email, displayName, role)
      return result.user
    }
    throw err
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

