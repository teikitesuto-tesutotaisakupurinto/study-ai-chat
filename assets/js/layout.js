import {
  auth,
  signOut
} from "./firebase.js";

/* =========================================================
   パス
   ========================================================= */

function getRootPath() {
  const path =
    location.pathname;

  if (
    path.includes("/student/") ||
    path.includes("/admin/")
  ) {
    return "../";
  }

  return "./";
}

/* =========================================================
   サイドバー
   ========================================================= */

export function setupSidebar(
  options = {}
) {
  const sidebar =
    document.getElementById(
      "appSidebar"
    );

  if (!sidebar) {
    console.warn(
      "appSidebar が見つかりません。"
    );

    return;
  }

  const root =
    getRootPath();

  const profile =
    options.profile || null;

  const displayName =
    profile?.displayName ||
    profile?.name ||
    auth.currentUser?.displayName ||
    "学習者";

  /*
    絵文字なし。
    学習AIチャット専用の正式なメニュー。
  */

  sidebar.innerHTML = "";

  const inner =
    document.createElement(
      "div"
    );

  inner.className =
    "sidebar-inner";

  /* ブランド */

  const brand =
    document.createElement(
      "div"
    );

  brand.className =
    "sidebar-brand";

  const brandLink =
    document.createElement(
      "a"
    );

  brandLink.href =
    `${root}student/index.html`;

  brandLink.textContent =
    "学習AIチャット";

  brand.append(
    brandLink
  );

  inner.append(
    brand
  );

  /* 利用者 */

  const userBox =
    document.createElement(
      "div"
    );

  userBox.className =
    "sidebar-user";

  const userLabel =
    document.createElement(
      "div"
    );

  userLabel.className =
    "sidebar-user-label";

  userLabel.textContent =
    "ログイン中";

  const userName =
    document.createElement(
      "div"
    );

  userName.className =
    "sidebar-user-name";

  userName.textContent =
    displayName;

  userBox.append(
    userLabel,
    userName
  );

  inner.append(
    userBox
  );

  /* ナビゲーション */

  const nav =
    document.createElement(
      "nav"
    );

  nav.className =
    "sidebar-nav";

  nav.setAttribute(
    "aria-label",
    "メインメニュー"
  );

  const items = [
    {
      label: "ホーム",
      href: `${root}student/index.html`
    },
    {
      label: "AIに質問",
      href: `${root}student/question.html`
    },
    {
      label: "学習履歴",
      href: `${root}student/history.html`
    },
    {
      label: "お知らせ",
      href: `${root}student/announcements.html`
    },
    {
      label: "設定",
      href: `${root}student/settings.html`
    }
  ];

  for (
    const item of items
  ) {
    const link =
      document.createElement(
        "a"
      );

    link.className =
      "sidebar-link";

    link.href =
      item.href;

    link.textContent =
      item.label;

    const currentPath =
      location.pathname;

    const targetPath =
      new URL(
        item.href,
        location.href
      ).pathname;

    if (
      currentPath ===
      targetPath
    ) {
      link.classList.add(
        "active"
      );

      link.setAttribute(
        "aria-current",
        "page"
      );
    }

    nav.append(
      link
    );
  }

  inner.append(
    nav
  );

  /* 下部 */

  const bottom =
    document.createElement(
      "div"
    );

  bottom.className =
    "sidebar-bottom";

  const logout =
    document.createElement(
      "button"
    );

  logout.type =
    "button";

  logout.className =
    "sidebar-logout";

  logout.id =
    "sidebarLogout";

  logout.textContent =
    "ログアウト";

  bottom.append(
    logout
  );

  inner.append(
    bottom
  );

  sidebar.append(
    inner
  );
}

/* =========================================================
   ログアウト
   ========================================================= */

export function setupLogout(
  firebaseAuth = auth,
  firebaseSignOut = signOut
) {
  const button =
    document.getElementById(
      "sidebarLogout"
    );

  if (!button) {
    return;
  }

  if (
    button.dataset.logoutReady ===
    "true"
  ) {
    return;
  }

  button.dataset.logoutReady =
    "true";

  button.addEventListener(
    "click",
    async () => {
      if (
        button.disabled
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          "ログアウトしますか？"
        );

      if (!confirmed) {
        return;
      }

      button.disabled =
        true;

      button.textContent =
        "ログアウト中...";

      try {
        await firebaseSignOut(
          firebaseAuth
        );

        location.replace(
          `${getRootPath()}login.html`
        );
      } catch (error) {
        console.error(
          "ログアウトエラー:",
          error
        );

        button.disabled =
          false;

        button.textContent =
          "ログアウト";

        window.alert(
          "ログアウトに失敗しました。もう一度お試しください。"
        );
      }
    }
  );
}
