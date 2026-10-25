(function () {
  "use strict";

  const firebaseConfig = {
  apiKey: "AIzaSyByt8kGALyS8AU8SR6PzWFEPXfgHY5iynk",
  authDomain: "studychat-1b39d.firebaseapp.com",
  projectId: "studychat-1b39d",
  storageBucket: "studychat-1b39d.firebasestorage.app",
  messagingSenderId: "982302014286",
  appId: "1:982302014286:web:abf319aadb1ed919727c1f"
};

  window.FIREBASE_CONFIG = firebaseConfig;

  if (!window.firebase) {
    throw new Error(
      "Firebase SDKが読み込まれていません。"
    );
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  window.firebaseApp = firebase.app();
  window.firebaseAuth = firebase.auth();
  window.firebaseDb = firebase.firestore();

  window.auth = window.firebaseAuth;
  window.db = window.firebaseDb;
})();
