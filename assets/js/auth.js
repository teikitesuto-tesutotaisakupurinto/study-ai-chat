// assets/js/auth.js
(function () {
  "use strict";

  let currentUser = null;
  let currentProfile = null;
  let authReady = false;
  let resolveReady;

  const ready = new Promise(function (resolve) {
    resolveReady = resolve;
  });

  async function loadProfile(user) {
    const snapshot = await window.db
      .collection("users")
      .doc(user.uid)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data();
  }

  function destinationFor(profile) {
    if (!profile || profile.status !== "active") {
      return window.AppPaths.forbidden;
    }

    if (profile.role === "admin") {
      return window.AppPaths.url("admin/index.html");
    }

    if (profile.role === "student") {
      return window.AppPaths.url("student/index.html");
    }

    return window.AppPaths.forbidden;
  }

  function isAdminPage() {
    return window.location.pathname.includes("/admin/");
  }

  function isStudentPage() {
    return window.location.pathname.includes("/student/");
  }

  function redirectTo(url) {
    const target = new URL(url, window.location.origin);
    const current = window.location.pathname + window.location.search;

    if (target.pathname !== window.location.pathname ||
        target.search !== window.location.search) {
      if (target.pathname + target.search !== current) {
        window.location.replace(target.href);
      }
    }
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

  window.requireAuth = async function (requiredRole) {
    await ready;

    if (!currentUser) {
      redirectTo(window.AppPaths.login);
      return false;
    }

    if (!currentProfile || currentProfile.status !== "active") {
      redirectTo(window.AppPaths.forbidden);
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

  window.auth.onAuthStateChanged(async function (user) {
    currentUser = user;
    currentProfile = null;

    if (user) {
      try {
        currentProfile = await loadProfile(user);
      } catch (error) {
        console.error("ユーザープロフィールの取得に失敗:", error);
      }
    }

    authReady = true;
    resolveReady();

    const path = window.location.pathname;
    const isLoginPage = /\/login\.html$/.test(path);
    const isResetPage = /\/reset\.html$/.test(path);
    const isForbiddenPage = /\/403\.html$/.test(path);

    if (!user) {
      if (!isLoginPage && !isResetPage && !isForbiddenPage) {
        redirectTo(window.AppPaths.login);
      }
      return;
    }

    if (isLoginPage || path.endsWith("/index.html") &&
        !isAdminPage() && !isStudentPage()) {
      redirectTo(destinationFor(currentProfile));
      return;
    }

    if (isAdminPage() &&
        (!currentProfile || currentProfile.role !== "admin")) {
      redirectTo(destinationFor(currentProfile));
      return;
    }

    if (isStudentPage() &&
        (!currentProfile || currentProfile.role !== "student")) {
      redirectTo(destinationFor(currentProfile));
    }
  });
})();
