// assets/js/firebase.js
(function () {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyByt8kGALyS8AU8SR6P8zWFEPXfgHY5iyn",
    authDomain: "studychat-1b39d.firebaseapp.com",
    projectId: "studychat-1b39d",
    storageBucket: "studychat-1b39d.firebasestorage.app",
    messagingSenderId: "982302014286",
    appId: "1:982302014286:web:abf319aadb1ed919727c1f"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  window.firebaseApp = firebase.app();
  window.auth = firebase.auth();
  window.db = firebase.firestore();

  window.auth.setPersistence(
    firebase.auth.Auth.Persistence.LOCAL
  ).catch(function (error) {
    console.error("認証の保存設定に失敗しました:", error);
  });
})();
