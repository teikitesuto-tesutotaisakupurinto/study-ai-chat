/* assets/js/firebase.js */
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

  try {
    if (!window.firebase) {
      throw new Error("Firebase App SDKが読み込まれていません。");
    }

    if (typeof window.firebase.auth !== "function") {
      throw new Error("Firebase Authentication SDKが読み込まれていません。");
    }

    if (typeof window.firebase.firestore !== "function") {
      throw new Error("Firebase Firestore SDKが読み込まれていません。");
    }

    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }

    window.firebaseApp = window.firebase.app();
    window.auth = window.firebase.auth();
    window.db = window.firebase.firestore();
    window.firebaseInitError = null;

    window.authReadyPromise = window.auth
      .setPersistence(
        window.firebase.auth.Auth.Persistence.LOCAL
      )
      .catch(function (error) {
        console.error(
          "認証の保存設定に失敗しました:",
          error
        );

        window.firebaseInitError = error;
        throw error;
      });

    // 呼び出し元でエラーを処理できるようにする。
    window.authReadyPromise.catch(function () {});
  } catch (error) {
    console.error("Firebase初期化エラー:", error);
    window.firebaseInitError = error;
  }
})();
