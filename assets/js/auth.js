/* =========================================================
   assets/js/auth.js
   認証・権限・画面遷移 共通処理

   重要:
   - auth-router.js は使用しない
   - このファイルを認証処理の中心にする
   - ログイン画面以外では、ログイン成功後に再リダイレクトしない
   - 現在いるページが正しい権限なら、そのまま表示する
   - 管理者と生徒のページを相互に行き来させない
========================================================= */

import {
  auth,
  googleProvider,
  db
} from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";


/* =========================================================
   ページ設定
========================================================= */

const PAGE = {
  LOGIN: "/login.html",
  STUDENT: "/student/index.html",
  ADMIN: "/admin/index.html"
};


/* =========================================================
   現在のページを取得
========================================================= */

function normalizePath(path) {
  if (!path) {
    return "/";
  }

  const cleaned = path
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");

  return cleaned || "/";
}


function currentPath() {
  return normalizePath(location.pathname);
}


/* =========================================================
   ページ判定
========================================================= */

function isLoginPage() {
  const path = currentPath();

  return (
    path === PAGE.LOGIN ||
    path.endsWith("/login.html")
  );
}


function isStudentPage() {
  const path = currentPath();

  return (
    path === PAGE.STUDENT ||
    path.endsWith("/student/index.html")
  );
}


function isAdminPage() {
  const path = currentPath();

  return (
    path === PAGE.ADMIN ||
    path.endsWith("/admin/index.html")
  );
}


/* =========================================================
   相対URL生成
   GitHub Pagesのサブディレクトリでも動くようにする
========================================================= */

function getBasePath() {

  const path = location.pathname;

  /*
    GitHub Pages:
    /TestLink/login.html
    /TestLink/student/index.html

    のような構成にも対応する。
  */

  const markerIndex = path.indexOf("/student/");
  if (markerIndex !== -1) {
    return path.substring(0, markerIndex);
  }

  const adminIndex = path.indexOf("/admin/");
  if (adminIndex !== -1) {
    return path.substring(0, adminIndex);
  }

  const loginIndex = path.indexOf("/login.html");
  if (loginIndex !== -1) {
    return path.substring(0, loginIndex);
  }

  const indexIndex = path.indexOf("/index.html");
  if (indexIndex !== -1) {
    return path.substring(0, indexIndex);
  }

  /*
    GitHub Pagesのリポジトリ直下にある場合
  */
  const segments = path.split("/").filter(Boolean);

  if (segments.length > 0) {
    return "/" + segments[0];
  }

  return "";
}


/* =========================================================
   ページURL
========================================================= */

function pageUrl(type) {

  const base = getBasePath();

  if (type === "login") {
    return `${base}/login.html`;
  }

  if (type === "student") {
    return `${base}/student/index.html`;
  }

  if (type === "admin") {
    return `${base}/admin/index.html`;
  }

  return `${base}/login.html`;
}


/* =========================================================
   権限取得
========================================================= */

export async function getUserRole(user) {

  if (!user) {
    return null;
  }

  try {

    const reference = doc(
      db,
      "users",
      user.uid
    );

    const snapshot = await getDoc(reference);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();

    return data.role || null;

  } catch (error) {

    console.error(
      "ユーザー権限取得エラー:",
      error
    );

    return null;
  }
}


/* =========================================================
   ユーザー情報取得
========================================================= */

export async function getUserData(user) {

  if (!user) {
    return null;
  }

  try {

    const reference = doc(
      db,
      "users",
      user.uid
    );

    const snapshot = await getDoc(reference);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    };

  } catch (error) {

    console.error(
      "ユーザー情報取得エラー:",
      error
    );

    return null;
  }
}


/* =========================================================
   ユーザーの有効性確認
========================================================= */

export async function validateUser(user) {

  if (!user) {
    return {
      valid: false,
      reason: "not-signed-in",
      data: null
    };
  }

  const data = await getUserData(user);

  if (!data) {
    return {
      valid: false,
      reason: "profile-not-found",
      data: null
    };
  }

  if (data.status !== "active") {
    return {
      valid: false,
      reason: "inactive",
      data
    };
  }

  if (
    data.role !== "admin" &&
    data.role !== "student"
  ) {
    return {
      valid: false,
      reason: "invalid-role",
      data
    };
  }

  return {
    valid: true,
    reason: null,
    data
  };
}


/* =========================================================
   安全な画面遷移
========================================================= */

function redirectToLogin() {

  const target = pageUrl("login");

  if (
    currentPath() !==
    normalizePath(new URL(target, location.origin).pathname)
  ) {
    location.replace(target);
  }
}


function redirectToStudent() {

  const target = pageUrl("student");

  const targetPath =
    normalizePath(
      new URL(
        target,
        location.origin
      ).pathname
    );

  if (currentPath() !== targetPath) {
    location.replace(target);
  }
}


function redirectToAdmin() {

  const target = pageUrl("admin");

  const targetPath =
    normalizePath(
      new URL(
        target,
        location.origin
      ).pathname
    );

  if (currentPath() !== targetPath) {
    location.replace(target);
  }
}


/* =========================================================
   権限に応じた画面遷移

   ここが今回の重要部分。

   「ログインした瞬間」以外では、
   現在のページを毎回別ページへ飛ばさない。
========================================================= */

async function routeAfterAuthentication(user) {

  if (!user) {
    redirectToLogin();
    return;
  }

  const validation =
    await validateUser(user);

  if (!validation.valid) {

    console.warn(
      "ユーザー認証情報が無効:",
      validation.reason
    );

    try {
      await signOut(auth);
    } catch (error) {
      console.error(
        "無効ユーザーのログアウト失敗:",
        error
      );
    }

    if (
      validation.reason ===
      "profile-not-found"
    ) {

      alert(
        "ユーザー情報が登録されていません。\n" +
        "管理者に確認してください。"
      );

    } else if (
      validation.reason ===
      "inactive"
    ) {

      alert(
        "このアカウントは現在利用できません。"
      );

    } else if (
      validation.reason ===
      "invalid-role"
    ) {

      alert(
        "ユーザー権限が正しく設定されていません。"
      );
    }

    redirectToLogin();

    return;
  }


  const role =
    validation.data.role;


  /* =====================================================
     ログイン画面にいる場合だけ遷移する
  ===================================================== */

  if (isLoginPage()) {

    if (role === "admin") {

      redirectToAdmin();

      return;
    }


    if (role === "student") {

      redirectToStudent();

      return;
    }


    return;
  }


  /* =====================================================
     管理者ページ
  ===================================================== */

  if (isAdminPage()) {

    if (role === "admin") {

      /*
        正しいページなので何もしない。
        これが無限リダイレクト防止の重要部分。
      */

      return;
    }


    /*
      生徒が管理画面へ来た場合のみ
      生徒画面へ戻す。
    */

    if (role === "student") {

      redirectToStudent();

      return;
    }
  }


  /* =====================================================
     生徒ページ
  ===================================================== */

  if (isStudentPage()) {

    if (role === "student") {

      /*
        正しいページなので何もしない。
      */

      return;
    }


    /*
      管理者が生徒画面へ来た場合のみ
      管理画面へ戻す。
    */

    if (role === "admin") {

      redirectToAdmin();

      return;
    }
  }


  /* =====================================================
     その他のページ
  ===================================================== */

  /*
    notice.html
    document.html
    scoreForm.html
    など、ログイン後に使用するページでは
    roleを確認したうえで勝手に別ページへ飛ばさない。

    ただし未ログインならloginへ戻す。
  */

}


/* =========================================================
   メールログイン
========================================================= */

window.login = async function () {

  const emailElement =
    document.getElementById("email");

  const passwordElement =
    document.getElementById("password");


  if (!emailElement) {

    console.error(
      "email要素が見つかりません。"
    );

    return;
  }


  if (!passwordElement) {

    console.error(
      "password要素が見つかりません。"
    );

    return;
  }


  const email =
    emailElement.value.trim();

  const password =
    passwordElement.value;


  if (!email) {

    alert(
      "メールアドレスを入力してください。"
    );

    emailElement.focus();

    return;
  }


  if (!password) {

    alert(
      "パスワードを入力してください。"
    );

    passwordElement.focus();

    return;
  }


  const button =
    document.querySelector(
      '[onclick="login()"]'
    );


  if (button) {
    button.disabled = true;
    button.dataset.originalText =
      button.textContent;
    button.textContent =
      "ログイン中...";
  }


  try {

    const result =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );


    /*
      ここでは直接location.hrefを実行しない。

      onAuthStateChanged → routeAfterAuthentication
      に統一する。
    */

    await routeAfterAuthentication(
      result.user
    );


  } catch (error) {

    console.error(
      "メールログインエラー:",
      error
    );


    let message =
      "ログインに失敗しました。";


    if (
      error.code ===
      "auth/invalid-credential"
    ) {

      message =
        "メールアドレスまたはパスワードが正しくありません。";

    } else if (
      error.code ===
      "auth/user-disabled"
    ) {

      message =
        "このFirebaseアカウントは無効化されています。";

    } else if (
      error.code ===
      "auth/too-many-requests"
    ) {

      message =
        "ログイン試行が多すぎます。しばらく待ってから再試行してください。";

    } else if (
      error.code ===
      "auth/network-request-failed"
    ) {

      message =
        "ネットワークエラーが発生しました。";

    }


    alert(message);


  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        button.dataset.originalText ||
        "ログイン";
    }
  }
};


/* =========================================================
   Googleログイン
========================================================= */

window.googleLogin = async function () {

  const button =
    document.querySelector(
      '[onclick="googleLogin()"]'
    );


  if (button) {

    button.disabled = true;

    button.dataset.originalText =
      button.textContent;

    button.textContent =
      "Googleログイン中...";
  }


  try {

    const result =
      await signInWithPopup(
        auth,
        googleProvider
      );


    /*
      Googleログイン後も
      ここから直接遷移しない。

      onAuthStateChangedに統一する。
    */

    await routeAfterAuthentication(
      result.user
    );


  } catch (error) {

    console.error(
      "Googleログインエラー:",
      error
    );


    /*
      ユーザー自身によるキャンセルは
      大きなエラー表示を出さない。
    */

    if (
      error.code ===
      "auth/popup-closed-by-user"
    ) {

      return;
    }


    let message =
      "Googleログインに失敗しました。";


    if (
      error.code ===
      "auth/popup-blocked"
    ) {

      message =
        "ポップアップがブロックされています。ブラウザの設定を確認してください。";

    } else if (
      error.code ===
      "auth/unauthorized-domain"
    ) {

      message =
        "このWebサイトのドメインがFirebase Authenticationで許可されていません。";

    } else if (
      error.code ===
      "auth/account-exists-with-different-credential"
    ) {

      message =
        "このメールアドレスには別のログイン方法が登録されています。";

    }


    alert(message);


  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        button.dataset.originalText ||
        "Googleでログイン";
    }
  }
};


/* =========================================================
   ログアウト
========================================================= */

window.logout = async function () {

  try {

    await signOut(auth);

    /*
      signOut後の遷移もここだけ。
    */

    redirectToLogin();


  } catch (error) {

    console.error(
      "ログアウトエラー:",
      error
    );

    alert(
      "ログアウトに失敗しました。"
    );
  }
};


/* =========================================================
   Firebase Authentication 状態監視
========================================================= */

let routingInProgress = false;


onAuthStateChanged(
  auth,
  async (user) => {

    /*
      同時に複数回ルーティングしない。
    */

    if (routingInProgress) {
      return;
    }


    routingInProgress = true;


    try {

      await routeAfterAuthentication(
        user
      );

    } catch (error) {

      console.error(
        "認証状態確認エラー:",
        error
      );

    } finally {

      routingInProgress = false;
    }
  }
);


/* =========================================================
   ログイン状態取得用
========================================================= */

export function getCurrentUser() {

  return auth.currentUser;
}


/* =========================================================
   ログイン必須ページ用

   他のJSから呼び出せる。
========================================================= */

export async function requireAuth() {

  const user =
    auth.currentUser;


  if (!user) {

    redirectToLogin();

    return null;
  }


  const validation =
    await validateUser(user);


  if (!validation.valid) {

    await signOut(auth);

    redirectToLogin();

    return null;
  }


  return {
    user,
    data: validation.data,
    role: validation.data.role
  };
}


/* =========================================================
   管理者専用ページ用
========================================================= */

export async function requireAdmin() {

  const result =
    await requireAuth();


  if (!result) {
    return null;
  }


  if (result.role !== "admin") {

    alert(
      "管理者権限が必要です。"
    );

    redirectToStudent();

    return null;
  }


  return result;
}


/* =========================================================
   生徒専用ページ用
========================================================= */

export async function requireStudent() {

  const result =
    await requireAuth();


  if (!result) {
    return null;
  }


  if (result.role !== "student") {

    alert(
      "生徒権限が必要です。"
    );

    redirectToAdmin();

    return null;
  }


  return result;
}


/* =========================================================
   デバッグ用
========================================================= */

console.log(
  "[auth.js] 認証システム読み込み完了"
);

console.log(
  "[auth.js] 現在のパス:",
  currentPath()
);
