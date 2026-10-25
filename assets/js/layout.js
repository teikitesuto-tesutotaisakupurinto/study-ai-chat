/* =========================================================
   学習AIチャット 共通レイアウト
   サイドバーは Firestore / Supabase / AI通信に依存しない
   ========================================================= */

function getRootPrefix() {
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
   ========================================================= */

function createSidebarHTML() {
  const root = getRootPrefix();

  return `
    <div class="sidebar-inner">

      <div class="sidebar-brand">
        <a href="${root}student/index.html">
          <span class="sidebar-brand-title">学習AIチャット</span>
          <span class="sidebar-brand-subtitle">
            定期テスト対策プリント運営事務局
          </span>
        </a>
      </div>

      <nav class="sidebar-nav" aria-label="メインメニュー">

        <a
          class="sidebar-link"
          href="${root}student/index.html"
          data-nav="home"
        >
          <span class="sidebar-icon">⌂</span>
          <span>学習ホーム</span>
        </a>

        <a
          class="sidebar-link"
          href="${root}student/question.html"
          data-nav="question"
        >
          <span class="sidebar-icon">＋</span>
          <span>AI学習チャット</span>
        </a>

      </nav>

      <div class="sidebar-spacer"></div>

      <div class="sidebar-bottom">

        <a
          class="sidebar-link sidebar-secondary"
          href="${root}student/settings.html"
          data-nav="settings"
        >
          <span class="sidebar-icon">⚙</span>
          <span>設定</span>
        </a>

        <button
          id="sidebarLogoutButton"
          class="sidebar-logout"
          type="button"
        >
          <span class="sidebar-icon">↪</span>
          <span>ログアウト</span>
        </button>

      </div>

    </div>
  `;
}

/* =========================================================
   スタイル
   ========================================================= */

function injectSidebarStyles() {
  if (document.getElementById("commonSidebarStyles")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "commonSidebarStyles";

  style.textContent = `
    .app-layout {
      display: flex;
      min-height: 100vh;
      width: 100%;
      background: #f4f7fb;
    }

    .sidebar {
      flex: 0 0 250px;
      width: 250px;
      min-height: 100vh;
      background: #ffffff;
      border-right: 1px solid #e2e8f0;
      position: sticky;
      top: 0;
      height: 100vh;
      z-index: 100;
    }

    .sidebar-inner {
      height: 100%;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 20px 14px;
    }

    .sidebar-brand {
      padding: 6px 8px 22px;
      border-bottom: 1px solid #eef2f7;
    }

    .sidebar-brand a {
      display: block;
      color: inherit;
      text-decoration: none;
    }

    .sidebar-brand-title {
      display: block;
      color: #172033;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -.025em;
    }

    .sidebar-brand-subtitle {
      display: block;
      margin-top: 6px;
      color: #64748b;
      font-size: 10px;
      line-height: 1.6;
    }

    .sidebar-nav {
      display: grid;
      gap: 5px;
      margin-top: 18px;
    }

    .sidebar-link,
    .sidebar-logout {
      width: 100%;
      min-height: 46px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: #475569;
      text-decoration: none;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
      transition:
        background .15s ease,
        color .15s ease;
    }

    .sidebar-link:hover,
    .sidebar-logout:hover {
      background: #f1f5f9;
      color: #172033;
    }

    .sidebar-link.active {
      background: #eaf2ff;
      color: #2563eb;
    }

    .sidebar-icon {
      width: 22px;
      min-width: 22px;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      font-size: 17px;
      line-height: 1;
    }

    .sidebar-spacer {
      flex: 1;
    }

    .sidebar-bottom {
      display: grid;
      gap: 5px;
      padding-top: 14px;
      border-top: 1px solid #eef2f7;
    }

    .sidebar-secondary {
      color: #64748b;
    }

    .sidebar-logout {
      color: #64748b;
    }

    .sidebar-logout:hover {
      background: #fff1f2;
      color: #be123c;
    }

    .app-main {
      flex: 1;
      min-width: 0;
      width: calc(100% - 250px);
    }

    .mobile-sidebar-button {
      display: none;
    }

    @media (max-width: 760px) {
      .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        width: 250px;
        transform: translateX(-100%);
        transition: transform .2s ease;
        box-shadow: 12px 0 30px rgb(15 23 42 / 10%);
      }

      .sidebar.mobile-open {
        transform: translateX(0);
      }

      .app-main {
        width: 100%;
      }

      .mobile-sidebar-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border: 1px solid #dbe3ef;
        border-radius: 10px;
        background: #fff;
        cursor: pointer;
      }

      .sidebar-overlay {
        position: fixed;
        inset: 0;
        background: rgb(15 23 42 / 35%);
        z-index: 90;
      }
    }
  `;

  document.head.appendChild(style);
}

/* =========================================================
   現在ページ判定
   ========================================================= */

function getCurrentNavigation() {
  const path = location.pathname.toLowerCase();

  if (
    path.endsWith("/student/index.html") ||
    path.endsWith("/student/") ||
    path.endsWith("/index.html")
  ) {
    return "home";
  }

  if (
    path.includes("/question.html")
  ) {
    return "question";
  }

  if (
    path.includes("/settings.html")
  ) {
    return "settings";
  }

  return "";
}

/* =========================================================
   アクティブメニュー
   ========================================================= */

function setActiveSidebarLink() {
  const current =
    getCurrentNavigation();

  document
    .querySelectorAll(
      ".sidebar-link[data-nav]"
    )
    .forEach(link => {
      link.classList.toggle(
        "active",
        link.dataset.nav === current
      );
    });
}

/* =========================================================
   モバイル操作
   ========================================================= */

function setupMobileSidebar() {
  if (
    document.getElementById(
      "mobileSidebarButton"
    )
  ) {
    return;
  }

  const sidebar =
    document.getElementById(
      "appSidebar"
    );

  if (!sidebar) {
    return;
  }

  const main =
    document.getElementById(
      "appMain"
    );

  if (!main) {
    return;
  }

  const button =
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

  const header =
    main.querySelector(
      ".page-header"
    );

  if (header) {
    header.prepend(button);
  } else {
    main.prepend(button);
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    "sidebar-overlay";

  overlay.hidden = true;

  document.body.appendChild(
    overlay
  );

  function open() {
    sidebar.classList.add(
      "mobile-open"
    );

    overlay.hidden = false;
  }

  function close() {
    sidebar.classList.remove(
      "mobile-open"
    );

    overlay.hidden = true;
  }

  button.addEventListener(
    "click",
    open
  );

  overlay.addEventListener(
    "click",
    close
  );

  sidebar
    .querySelectorAll(
      "a"
    )
    .forEach(link => {
      link.addEventListener(
        "click",
        close
      );
    });
}

/* =========================================================
   サイドバー初期化
   ========================================================= */

export function setupSidebar() {
  injectSidebarStyles();

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

  /*
    重要：
    Firestore・Supabase・AI通信はここでは一切行わない。
  */

  sidebar.innerHTML =
    createSidebarHTML();

  sidebar.style.display =
    "block";

  setActiveSidebarLink();

  setupMobileSidebar();
}

/* =========================================================
   ログアウト
   ========================================================= */

export function setupLogout(
  auth,
  signOutFunction
) {
  const button =
    document.getElementById(
      "sidebarLogoutButton"
    );

  if (!button) {
    return;
  }

  button.addEventListener(
    "click",
    async () => {
      if (
        button.dataset.busy ===
        "true"
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

      button.dataset.busy =
        "true";

      button.disabled = true;

      button.textContent =
        "ログアウト中...";

      try {
        await signOutFunction(
          auth
        );

        const root =
          getRootPrefix();

        location.replace(
          `${root}login.html`
        );

      } catch (error) {
        console.error(
          "ログアウトエラー:",
          error
        );

        button.dataset.busy =
          "false";

        button.disabled =
          false;

        button.textContent =
          "ログアウト";

        window.alert(
          "ログアウトできませんでした。もう一度お試しください。"
        );
      }
    }
  );
}
