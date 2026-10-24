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
      throw new Error("Firebase SDKが読み込まれていません。");
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    window.firebaseApp = firebase.app();
    window.auth = firebase.auth();
    window.db = firebase.firestore();

    /*
     * 他の画面から await window.authReadyPromise で
     * 認証設定の完了を待てるようにする。
     */
    window.authReadyPromise = window.auth
      .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(function (error) {
        console.error("認証の保存設定に失敗しました:", error);
        throw error;
      });

    window.authReadyPromise.catch(function () {
      /* 個別画面でもエラーを表示できるよう、ここでは再throwしない */
    });
  } catch (error) {
    console.error("Firebase初期化エラー:", error);
    window.firebaseInitError = error;
  }
})();
