```javascript
/* =========================================================
   学習AIチャット 共通レイアウト
   layout.js
   ========================================================= */

import {
  auth,
  db,
  doc,
  getDoc
} from "./firebase-module.js";

/* =========================================================
   パス処理
   ========================================================= */

function getRootPath() {
  const path = location.pathname;

  if (
    path.includes("/student/") ||
    path.includes("/admin/")
  ) {
    return "../";
  }

  return "./";
}

/* =========================================================
   サイドバーHTML
   絵文字なし
   ========================================================= */

function createSidebarHTML(
  profile,
  user
) {
  const root =
    getRootPath();

  const displayName =
    profile?.displayName ||
    profile?.name ||
    user?.displayName ||
    "学習者";

  const role =
    profile?.role || "student";

  const isAdmin =
    role === "admin";

  const currentPath =
    location.pathname;

  const isActive =
    fileName => {
      return currentPath
        .endsWith(fileName);
    };

  const studentLinks = [
    {
      href: `${root}student/index.html`,
      file: "index.html",
      label: "ホーム"
    },
    {
      href: `${root}student/question.html`,
      file: "question.html",
      label: "AIに質問"
    },
    {
      href: `${root}student/history.html`,
      file: "history.html",
      label: "学習履歴"
    },
    {
      href: `${root}student/announcements.html`,
      file: "announcements.html",
      label: "お知らせ"
    },
    {
      href: `${root}student/settings.html`,
      file: "settings.html",
      label: "設定"
    }
  ];

  const adminLinks = [
    {
      href: `${root}admin/index.html`,
      file: "index.html",
      label: "管理ホーム"
    },
    {
      href: `${root}admin/users.html`,
      file: "users.html",
      label: "利用者管理"
    },
    {
      href: `${root}admin/announcements.html`,
      file: "announcements.html",
      label: "お知らせ管理"
    },
    {
      href: `${root}admin/settings.html`,
      file: "settings.html",
      label: "システム設定"
    }
  ];

  const links =
    isAdmin
      ? adminLinks
      : studentLinks;

  const navigation =
    links.map(link => {
      const active =
        isActive(
          link.file
        );

      return `
        <a
          class="sidebar-link${active ? " active" : ""}"
          href="${link.href}"
          ${active ? 'aria-current="page"' : ""}
        >
          <span class="sidebar-link-text">
            ${link.label}
          </span>
        </a>
      `;
    }).join("");

  return `
    <div class="sidebar-inner">

      <div class="sidebar-header">

        <a
          class="sidebar-brand"
          href="${
            isAdmin
              ? `${root}admin/index.html`
              : `${root}student/index.html`
          }"
        >
          <span class="sidebar-brand-title">
            学習AIチャット
          </span>
        </a>

        <button
          id="sidebarCloseButton"
          class="sidebar-close"
          type="button"
          aria-label="メニューを閉じる"
        >
          ×
        </button>

      </div>

      <div class="sidebar-user">

        <div class="sidebar-user-name">
          ${escapeHTML(displayName)}
        </div>

        <div class="sidebar-user-role">
          ${
            isAdmin
              ? "管理者"
              : "学習者"
          }
        </div>

      </div>

      <nav
        class="sidebar-nav"
        aria-label="メインメニュー"
      >
        ${navigation}
      </nav>

      <div class="sidebar-bottom">

        <button
          id="sidebarLogoutButton"
          class="sidebar-logout"
          type="button"
        >
          ログアウト
        </button>

      </div>

    </div>
  `;
}

/* =========================================================
   HTMLエスケープ
   ========================================================= */

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   CSSを必要に応じて追加
   ========================================================= */

function ensureSidebarStyles() {
  if (
    document.getElementById(
      "study-ai-layout-styles"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "study-ai-layout-styles";

  style.textContent = `
    .app-layout {
      min-height: 100vh;
      display: flex;
      width: 100%;
    }

    .sidebar {
      width: 250px;
      min-width: 250px;
      min-height: 100vh;
      background: #ffffff;
      border-right: 1px solid #e2e8f0;
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 1000;
      overflow-y: auto;
    }

    .sidebar-inner {
      min-height: 100%;
      display: flex;
      flex-direction: column;
    }

    .sidebar-header {
      min-height: 68px;
      padding: 0 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
    }

    .sidebar-brand {
      color: #111827;
      text-decoration: none;
      font-weight: 700;
      font-size: 17px;
    }

    .sidebar-brand:hover {
      color: #2563eb;
    }

    .sidebar-close {
      display: none;
      width: 36px;
      height: 36px;
      padding: 0;
      margin: 0;
      border: 1px solid #d1d5db;
      border-radius: 7px;
      background: #ffffff;
      color: #374151;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
    }

    .sidebar-user {
      padding: 20px 18px;
      border-bottom: 1px solid #e2e8f0;
    }

    .sidebar-user-name {
      color: #111827;
      font-size: 15px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .sidebar-user-role {
      margin-top: 5px;
      color: #64748b;
      font-size: 12px;
    }

    .sidebar-nav {
      padding: 14px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .sidebar-link {
      display: block;
      width: 100%;
      padding: 12px 13px;
      border-radius: 8px;
      color: #334155;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition:
        background-color .15s,
        color .15s;
    }

    .sidebar-link:hover {
      background: #f1f5f9;
      color: #1d4ed8;
    }

    .sidebar-link.active {
      background: #e8f0fe;
      color: #1d4ed8;
      font-weight: 700;
    }

    .sidebar-bottom {
      margin-top: auto;
      padding: 14px 10px 20px;
    }

    .sidebar-logout {
      width: 100%;
      padding: 11px 13px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      color: #334155;
      font-size: 14px;
      cursor: pointer;
    }

    .sidebar-logout:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    .app-main {
      flex: 1;
      min-width: 0;
      margin-left: 250px;
      min-height: 100vh;
    }

    .page-header {
      padding: 28px 32px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .page-title {
      margin: 0;
      color: #111827;
      font-size: 25px;
    }

    .page-header p {
      margin: 8px 0 0;
      color: #64748b;
    }

    .page-footer {
      padding: 30px 20px;
      color: #64748b;
      text-align: center;
      font-size: 11px;
      line-height: 1.7;
    }

    .mobile-sidebar-button {
      display: none;
      position: fixed;
      left: 14px;
      top: 14px;
      z-index: 1100;
      width: 42px;
      height: 42px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      color: #111827;
      cursor: pointer;
      font-size: 22px;
    }

    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 900;
      background: rgba(15, 23, 42, .35);
    }

    @media (max-width: 800px) {

      .sidebar {
        transform: translateX(-100%);
        transition: transform .2s ease;
        box-shadow: 8px 0 24px rgba(15, 23, 42, .12);
      }

      .sidebar.sidebar-open {
        transform: translateX(0);
      }

      .sidebar-close {
        display: block;
      }

      .app-main {
        margin-left: 0;
      }

      .mobile-sidebar-button {
        display: block;
      }

      .sidebar-overlay.sidebar-overlay-visible {
        display: block;
      }

      .page-header {
        padding-left: 70px;
      }
    }
  `;

  document.head.appendChild(style);
}

/* =========================================================
   モバイル用メニューボタン
   ========================================================= */

function ensureMobileMenuButton() {
  let button =
    document.getElementById(
      "mobileSidebarButton"
    );

  if (button) {
    return button;
  }

  button =
    document.createElement("button");

  button.id =
    "mobileSidebarButton";

  button.className =
    "mobile-sidebar-button";

  button.type = "button";

  button.setAttribute(
    "aria-label",
    "メニューを開く"
  );

  button.textContent = "☰";

  button.addEventListener(
    "click",
    () => {
      const sidebar =
        document.getElementById(
          "appSidebar"
        );

      const overlay =
        document.getElementById(
          "sidebarOverlay"
        );

      if (!sidebar) {
        return;
      }

      sidebar.classList.add(
        "sidebar-open"
      );

      overlay?.classList.add(
        "sidebar-overlay-visible"
      );
    }
  );

  document.body.appendChild(
    button
  );

  return button;
}

/* =========================================================
   オーバーレイ
   ========================================================= */

function ensureSidebarOverlay() {
  let overlay =
    document.getElementById(
      "sidebarOverlay"
    );

  if (overlay) {
    return overlay;
  }

  overlay =
    document.createElement("div");

  overlay.id =
    "sidebarOverlay";

  overlay.className =
    "sidebar-overlay";

  overlay.addEventListener(
    "click",
    closeSidebar
  );

  document.body.appendChild(
    overlay
  );

  return overlay;
}

/* =========================================================
   サイドバーを閉じる
   ========================================================= */

function closeSidebar() {
  const sidebar =
    document.getElementById(
      "appSidebar"
    );

  const overlay =
    document.getElementById(
      "sidebarOverlay"
    );

  sidebar?.classList.remove(
    "sidebar-open"
  );

  overlay?.classList.remove(
    "sidebar-overlay-visible"
  );
}

/* =========================================================
   サイドバーを開く
   ========================================================= */

function openSidebar() {
  const sidebar =
    document.getElementById(
      "appSidebar"
    );

  const overlay =
    document.getElementById(
      "sidebarOverlay"
    );

  if (!sidebar) {
    return;
  }

  sidebar.classList.add(
    "sidebar-open"
  );

  overlay?.classList.add(
    "sidebar-overlay-visible"
  );
}

/* =========================================================
   サイドバー設定
   ========================================================= */

export async function setupSidebar(
  options = {}
) {
  const sidebar =
    document.getElementById(
      "appSidebar"
    );

  if (!sidebar) {
    console.error(
      "setupSidebar: #appSidebar が見つかりません。"
    );

    return false;
  }

  try {
    /*
      Firebaseのログインユーザーを取得。
      ページ側で protectPage() が成功している
      場合でも念のため確認する。
    */

    const user =
      auth.currentUser;

    if (!user) {
      console.warn(
        "setupSidebar: ログインユーザーが確認できません。"
      );

      return false;
    }

    /* -----------------------------------------
       プロフィール取得
       ----------------------------------------- */

    let profile =
      options.profile || null;

    if (!profile) {
      const snapshot =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );

      if (!snapshot.exists()) {
        throw new Error(
          "ユーザープロフィールが見つかりません。"
        );
      }

      profile =
        snapshot.data();
    }

    /* -----------------------------------------
       サイドバー描画
       ----------------------------------------- */

    ensureSidebarStyles();

    sidebar.innerHTML =
      createSidebarHTML(
        profile,
        user
      );

    sidebar.hidden = false;

    /* -----------------------------------------
       モバイル機能
       ----------------------------------------- */

    ensureSidebarOverlay();

    ensureMobileMenuButton();

    const closeButton =
      document.getElementById(
        "sidebarCloseButton"
      );

    if (closeButton) {
      closeButton.addEventListener(
        "click",
        closeSidebar
      );
    }

    /* -----------------------------------------
       ナビゲーションクリック
       ----------------------------------------- */

    sidebar
      .querySelectorAll(
        ".sidebar-link"
      )
      .forEach(link => {
        link.addEventListener(
          "click",
          () => {
            closeSidebar();
          }
        );
      });

    /* -----------------------------------------
       ログアウト
       ----------------------------------------- */

    const logoutButton =
      document.getElementById(
        "sidebarLogoutButton"
      );

    if (logoutButton) {
      logoutButton.addEventListener(
        "click",
        async () => {
          if (
            logoutButton.disabled
          ) {
            return;
          }

          logoutButton.disabled =
            true;

          logoutButton.textContent =
            "ログアウト中...";

          try {
            await signOutUser();

          } catch (error) {
            console.error(
              "ログアウトエラー:",
              error
            );

            logoutButton.disabled =
              false;

            logoutButton.textContent =
              "ログアウト";

            alert(
              "ログアウトに失敗しました。"
            );
          }
        }
      );
    }

    /*
      重要：
      サイドバー描画完了をイベントとして通知。
    */

    document.dispatchEvent(
      new CustomEvent(
        "study-ai-sidebar-ready",
        {
          detail: {
            user,
            profile
          }
        }
      )
    );

    return true;

  } catch (error) {
    console.error(
      "サイドバー初期化エラー:",
      error
    );

    sidebar.innerHTML = `
      <div
        style="
          padding:20px;
          color:#b91c1c;
          font-size:14px;
          line-height:1.7;
        "
      >
        サイドバーを読み込めませんでした。
      </div>
    `;

    return false;
  }
}

/* =========================================================
   ログアウト
   ========================================================= */

async function signOutUser() {
  await auth.signOut();

  location.replace(
    rootPath("login.html")
  );
}

/* =========================================================
   外部からログアウト設定
   ========================================================= */

export function setupLogout(
  authInstance = auth,
  signOutFunction = null
) {
  const button =
    document.getElementById(
      "sidebarLogoutButton"
    );

  if (!button) {
    return false;
  }

  /*
    既にイベントが設定されている場合は
    二重登録を防止。
  */

  if (
    button.dataset.logoutReady ===
    "true"
  ) {
    return true;
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

      button.disabled =
        true;

      button.textContent =
        "ログアウト中...";

      try {
        if (
          typeof signOutFunction ===
          "function"
        ) {
          await signOutFunction(
            authInstance
          );
        } else {
          await authInstance.signOut();
        }

        location.replace(
          rootPath(
            "login.html"
          )
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
      }
    }
  );

  return true;
}

/* =========================================================
   現在ページのサイドバー表示
   ========================================================= */

export function refreshSidebar() {
  const sidebar =
    document.getElementById(
      "appSidebar"
    );

  if (!sidebar) {
    return;
  }

  sidebar
    .querySelectorAll(
      ".sidebar-link"
    )
    .forEach(link => {
      const href =
        link.getAttribute(
          "href"
        );

      if (!href) {
        return;
      }

      try {
        const url =
          new URL(
            href,
            location.href
          );

        const current =
          new URL(
            location.href
          );

        const active =
          url.pathname ===
          current.pathname;

        link.classList.toggle(
          "active",
          active
        );

        if (active) {
          link.setAttribute(
            "aria-current",
            "page"
          );
        } else {
          link.removeAttribute(
            "aria-current"
          );
        }

      } catch {
        /* 無効なURLは無視 */
      }
    });
}

/* =========================================================
   自動初期化
   ========================================================= */

export async function initializeLayout(
  options = {}
) {
  /*
    ページ読み込み時に #appSidebar が
    既に存在する場合だけ初期化。
  */

  const sidebar =
    document.getElementById(
      "appSidebar"
    );

  if (!sidebar) {
    return false;
  }

  return await setupSidebar(
    options
  );
}

/* =========================================================
   グローバル公開
   ========================================================= */

window.StudyAILayout = {
  setupSidebar,
  setupLogout,
  refreshSidebar,
  initializeLayout,
  openSidebar,
  closeSidebar
};
```
