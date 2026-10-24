/* assets/js/firebase.js
 * Firebase compat SDK の初期化
 * 他の画面からは window.auth / window.db を利用する
 */
(function () {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyByt8kGALyS8AU8SR6P8zWFEPXfgHY5iynk",
    authDomain: "studychat-1b39d.firebaseapp.com",
    projectId: "studychat-1b39d",
    storageBucket: "studychat-1b39d.firebasestorage.app",
    messagingSenderId: "982302014286",
    appId: "1:982302014286:web:abf319aadb1ed919727c1f"
  };

  try {
    if (!window.firebase) {
      throw new Error(
        "Firebase SDK が読み込まれていません。"
      );
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    window.firebaseApp = firebase.app();
    window.auth = firebase.auth();
    window.db = firebase.firestore();

    window.authReadyPromise = window.auth
      .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(function (error) {
        console.error(
          "Firebase 認証の保存設定に失敗しました:",
          error
        );

        throw error;
      });

    // 未処理の Promise rejection を防ぐ。
    // authReadyPromise 自体は保持するため、
    // 利用側でもエラーを取得できる。
    window.authReadyPromise.catch(function () {});

    window.firebaseInitError = null;
  } catch (error) {
    console.error("Firebase 初期化エラー:", error);
    window.firebaseInitError = error;
  }
})();
