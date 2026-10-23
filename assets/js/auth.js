import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onAuthStateChanged,
  signOut
} from "./firebase.js";

export async function getCurrentUserData(user) {
  if (!user) return null;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  return {
    uid: user.uid,
    ...snap.data()
  };
}

export async function ensureStudentProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      role: "student",
      status: "active",
      grade: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    });

    return;
  }

  const data = snap.data();

  if (data.status === "disabled") {
    await signOut(auth);
    throw new Error("このアカウントは利用停止されています。");
  }

  await updateDoc(ref, {
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export function protectPage(requiredRole) {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        location.replace(
          `/study-ai-chat/login.html?return=${encodeURIComponent(location.pathname)}`
        );
        return;
      }

      try {
        const data = await getCurrentUserData(user);

        if (!data) {
          location.replace("/study-ai-chat/403.html");
          return;
        }

        if (data.status !== "active") {
          await signOut(auth);
          location.replace("/study-ai-chat/login.html");
          return;
        }

        if (requiredRole && data.role !== requiredRole) {
          location.replace("/study-ai-chat/403.html");
          return;
        }

        resolve({
          user,
          data
        });
      } catch (error) {
        console.error(error);
        location.replace("/study-ai-chat/403.html");
      }
    });
  });
}
