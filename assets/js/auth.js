
/* assets/js/auth.js */
(function () {
  "use strict";

  let currentUser = null;
  let currentProfile = null;
  let authReady = false;
  let resolveReady;

  let authEventVersion = 0;

  const ready = new Promise(function (resolve) {
    resolveReady = resolve;
  });

  function getPaths() {
    return window.AppPaths || {};
  }

  function getPath() {
    return window.location.pathname;
  }

  function isPage(name) {
    return new RegExp("/" + name.replace(".", "\\.") + "$").test(getPath());
  }

  function isLoginPage() {
    return isPage("login.html");
  }

  function isResetPage() {
    return isPage("reset.html");
  }

  function isForbiddenPage() {
    return isPage("403.html");
  }

  function is404Page() {
    return isPage("404.html");
  }

  function isPublicPage() {
    return isLoginPage() ||
      isResetPage() ||
      isForbiddenPage() ||
      is404Page();
  }

  function isAdminPage() {
    return getPath().includes("/admin/");
  }

  function isStudentPage() {
    return getPath().includes("/student/");
  }

  function forbiddenUrl() {
    const paths = getPaths();
    return paths.forbidden || "./403.html";
  }

  function loginUrl() {
    const paths = getPaths();
    return paths.login || "./login.html";
  }

  function redirectTo(url) {
    if (!url) {
      console.error("リダイレクト先URLが定義されていません。");
      return;
    }

    const target = new URL(url, window.location.href);

    if (target.origin !== window.location.origin) {
      console.error("不正なリダイレクト先を拒否しました。");
      return;
    }

    if (target.href !== window.location.href) {
      window.location.replace(target.href);
    }
  }

  async function loadProfile(user) {
    if (!window.db || !user) return null;

    const snapshot = await window.db
      .collection("users")
      .doc(user.uid)
      .get();

    if (!snapshot.exists) return null;

    return snapshot.data();
  }

  function destinationFor(profile) {
    const paths = getPaths();

    if (!profile || profile.status !== "active") {
      return forbiddenUrl();
    }

    if (profile.role === "admin") {
      return paths.adminHome || paths.url?.("admin/index.html") ||
        "./admin/index.html";
    }

    if (profile.role === "student") {
      return paths.studentHome || paths.url?.("student/index.html") ||
        "./student/index.html";
    }

    return forbiddenUrl();
  }

  function isValidProfile(profile) {
    return Boolean(
      profile &&
      profile.status === "active" &&
      ["admin", "student"].includes(profile.role)
    );
  }

  function settleReady() {
    if (authReady) return;

    authReady = true;
    resolveReady();
  }

  function getState() {
    return {
      user: currentUser,
      profile: currentProfile,
      isReady: authReady
    };
  }

  window.authState = {
    get user() {
      return currentUser;
    },
    get profile() {
      return currentProfile;
    },
    get ready() {
      return ready;
    },
    get isReady() {
      return authReady;
    }
  };

  /*
   * 既存ページとの互換性を維持する。
   * 戻り値は boolean。
   */
  window.requireAuth = async function (requiredRole) {
    await ready;

    if (!currentUser) {
      redirectTo(loginUrl());
      return false;
    }

    if (!isValidProfile(currentProfile)) {
      redirectTo(forbiddenUrl());
      return false;
    }

    if (requiredRole && currentProfile.role !== requiredRole) {
      redirectTo(destinationFor(currentProfile));
      return false;
    }

    return true;
  };

  window.getCurrentProfile = async function () {
    await ready;
    return currentProfile;
  };

  window.getCurrentUser = async function () {
    await ready;
    return currentUser;
  };

  /*
   * ページ起動側が boolean の戻り値とプロフィールを
   * 別々に取得できるようにする。
   */
  window.getAuthState = async function () {
    await ready;
    return getState();
  };

  if (!window.auth) {
    console.error(
      "Firebase Authenticationが初期化されていません。firebase.jsを確認してください。"
    );
    settleReady();
    return;
  }

  window.auth.onAuthStateChanged(async function (user) {
    const thisVersion = ++authEventVersion;

    currentUser = user || null;
    currentProfile = null;

    if (user) {
      try {
        currentProfile = await loadProfile(user);
      } catch (error) {
        console.error("ユーザープロフィールの取得に失敗:", error);
        currentProfile = null;
      }
    }

    /*
     * 古い非同期プロフィール取得が後から完了しても、
     * 新しい認証状態を上書きしない。
     */
    if (thisVersion !== authEventVersion) return;

    settleReady();

    /*
     * 公開ページでは自動リダイレクトしない。
     * とくにreset.htmlは未ログインでも利用可能。
     */
    if (isPublicPage()) {
      /*
       * ログイン画面では、有効なプロフィールが確認できた場合のみ
       * 対応する画面へ移動する。プロフィール未登録ならログイン画面に
       * とどまり、登録状態を確認できるようにする。
       */
      if (
        isLoginPage() &&
        user &&
        isValidProfile(currentProfile)
      ) {
        redirectTo(destinationFor(currentProfile));
      }

      return;
    }

    /*
     * 保護対象ページでは未ログイン時のみログインへ誘導する。
     */
    if (!user) {
      redirectTo(loginUrl());
      return;
    }

    /*
     * 未登録または停止アカウントは403へ。
     */
    if (!isValidProfile(currentProfile)) {
      redirectTo(forbiddenUrl());
      return;
    }

    /*
     * 管理者と生徒の領域を分離する。
     */
    if (isAdminPage() && currentProfile.role !== "admin") {
      redirectTo(destinationFor(currentProfile));
      return;
    }

    if (isStudentPage() && currentProfile.role !== "student") {
      redirectTo(destinationFor(currentProfile));
    }
  });
})();
