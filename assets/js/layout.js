/* =========================================================
   学習AIチャット
   layout.js
   サイドバー・ログアウト共通処理
   ========================================================= */

const NAV_ITEMS = [
  {
    href: "index.html",
    label: "ホーム"
  },
  {
    href: "question.html",
    label: "AIに質問"
  },
  {
    href: "history.html",
    label: "学習履歴"
  },
  {
    href: "announcements.html",
    label: "お知らせ"
  },
  {
    href: "settings.html",
    label: "設定"
  }
];

/* =========================================================
   パス判定
   ========================================================= */

function getStudentRootPath() {
  const pathname = location.pathname;

  if (
    pathname.includes("/student/")
  ) {
    return "";
  }

  return "student/";
}

/* =========================================================
   現在ページ判定
   ========================================================= */

function getCurrentPage() {
  const pathname =
    location.pathname
      .split("/")
      .pop();

  return pathname || "index.html";
}

/* =========================================================
   サイドバーHTML生成
   ========================================================= */

function createSidebarHTML() {
  const currentPage =
    getCurrentPage();

  const root =
    getStudentRootPath();

  const navHTML =
    NAV_ITEMS
      .map(item => {
        const href =
          root + item.href;

        const active =
          currentPage === item.href;

        return `
          <a
            class="sidebar-link${active ? " active" : ""}"
            href="${href}"
            ${active ? 'aria-current="page"' : ""}
          >
            <span class="sidebar-link-text">
              ${item.label}
            </span>
          </a>
        `;
      })
      .join("");

  return `
    <div class="sidebar-inner">

      <div class="sidebar-brand">
        <a
          class="sidebar-brand-link"
          href="${root}index.html"
        >
          <span class="sidebar-brand-title">
            学習AIチャット
          </span>
        </a>
      </div>

      <nav
        class="sidebar-nav"
        aria-label="メインメニュー"
      >
        ${navHTML}
      </nav>

      <div class="sidebar-bottom">

        <button
          type="button"
          id="sidebarLogoutButton"
          class="sidebar-logout"
        >
          ログアウト
        </button>

      </div>

    </div>
  `;
}

/* =========================================================
   サイドバーCSS
   JSから直接注入
   → common.css等の読み込み失敗でも白紙にならない
   ========================================================= */

function injectSidebarStyle() {
  if (
    document.getElementById(
      "study-ai-sidebar-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "study-ai-sidebar-style";

  style.textContent = `
    /* =====================================================
       学習AIチャット サイドバー
       ===================================================== */

    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      width: 250px;
      height: 100vh;

      display: flex;
      flex-direction: column;

      background: #ffffff;
      border-right: 1px solid #e2e8f0;

      z-index: 1000;

      overflow-y: auto;
      overflow-x: hidden;
    }

    .sidebar-inner {
      min-height: 100%;
      display: flex;
      flex-direction: column;
    }

    .sidebar-brand {
      padding: 24px 20px 20px;
      border-bottom: 1px solid #e2e8f0;
    }

    .sidebar-brand-link {
      display: block;

      color: #172033;
      text-decoration: none;

      border-radius: 8px;
    }

    .sidebar-brand-title {
      display: block;

      font-size: 18px;
      line-height: 1.4;
      font-weight: 800;
      letter-spacing: -.02em;
    }

    .sidebar-nav {
      display: flex;
      flex-direction: column;

      padding: 14px 12px;

      gap: 4px;
    }

    .sidebar-link {
      display: flex;
      align-items: center;

      min-height: 46px;

      padding: 0 14px;

      border-radius: 9px;

      color: #475569;
      background: transparent;

      text-decoration: none;

      font-size: 14px;
      font-weight: 600;

      transition:
        background-color .15s ease,
        color .15s ease;
    }

    .sidebar-link:hover {
      background: #f1f5f9;
      color: #172033;
    }

    .sidebar-link.active {
      background: #eff6ff;
      color: #1d4ed8;
    }

    .sidebar-link-text {
      display: block;
      width: 100%;
    }

    .sidebar-bottom {
      margin-top: auto;

      padding: 16px 12px 20px;

      border-top: 1px solid #e2e8f0;
    }

    .sidebar-logout {
      display: flex;
      align-items: center;
      justify-content: center;

      width: 100%;
      min-height: 44px;

      padding: 0 14px;

      border: 1px solid #cbd5e1;
      border-radius: 8px;

      background: #ffffff;
      color: #334155;

      cursor: pointer;

      font: inherit;
      font-size: 14px;
      font-weight: 700;

      transition:
        background-color .15s ease,
        border-color .15s ease,
        color .15s ease;
    }

    .sidebar-logout:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    .sidebar-logout:disabled {
      cursor: wait;
      opacity: .6;
    }

    /* =====================================================
       メインコンテンツ
       ===================================================== */

    .app-main {
      min-height: 100vh;
      margin-left: 250px;
    }

    /* =====================================================
       モバイル
       ===================================================== */

    @media (max-width: 760px) {

      .sidebar {
        position: relative;

        width: 100%;
        height: auto;

        min-height: auto;

        border-right: 0;
        border-bottom: 1px solid #e2e8f0;
      }

      .sidebar-inner {
        min-height: auto;
      }

      .sidebar-brand {
        padding: 18px 16px;
      }

      .sidebar-nav {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));

        padding: 10px 12px;
      }

      .sidebar-link {
        min-height: 44px;
      }

      .sidebar-bottom {
        margin-top: 0;

        padding: 10px 12px 14px;
      }

      .app-main {
        margin-left: 0;
      }
    }

    @media (max-width: 420px) {

      .sidebar-nav {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

/* =========================================================
   サイドバー設置
   ========================================================= */

export function setupSidebar() {
  try {
    injectSidebarStyle();

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

    /*
      すでに生成済みでも一度完全に作り直す。
      空白状態を残さない。
    */

    sidebar.innerHTML =
      createSidebarHTML();

    sidebar.hidden = false;

    sidebar.removeAttribute(
      "aria-hidden"
    );

    /*
      念のためdisplay:none系を解除
    */

    sidebar.style.display = "block";

    /*
      ログアウトボタンを必ず取得
    */

    const logoutButton =
      document.getElementById(
        "sidebarLogoutButton"
      );

    if (!logoutButton) {
      console.error(
        "setupSidebar: ログアウトボタンの生成に失敗しました。"
      );

      return false;
    }

    /*
      二重イベント登録防止
    */

    logoutButton.onclick = null;

    return true;

  } catch (error) {

    console.error(
      "サイドバー初期化エラー:",
      error
    );

    return false;
  }
}

/* =========================================================
   ログアウト処理
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
    console.warn(
      "setupLogout: ログアウトボタンがありません。"
    );

    return false;
  }

  button.onclick =
    async () => {

      if (
        button.disabled
      ) {
        return;
      }

      button.disabled = true;
      button.textContent =
        "ログアウト中...";

      try {

        await signOutFunction(
          auth
        );

        /*
          ログイン画面へ戻す
        */

        const pathname =
          location.pathname;

        if (
          pathname.includes(
            "/student/"
          )
        ) {
          location.replace(
            "../login.html"
          );
        } else if (
          pathname.includes(
            "/admin/"
          )
        ) {
          location.replace(
            "../login.html"
          );
        } else {
          location.replace(
            "./login.html"
          );
        }

      } catch (error) {

        console.error(
          "ログアウトエラー:",
          error
        );

        button.disabled = false;
        button.textContent =
          "ログアウト";

        alert(
          "ログアウトできませんでした。\n" +
          (
            error?.message ||
            String(error)
          )
        );
      }
    };

  return true;
}

/* =========================================================
   ログイン後の画面を確実に準備
   ========================================================= */

export function initializeLayout(
  auth,
  signOutFunction
) {
  /*
    先にサイドバーを作る。
    Firestoreを待たない。
    AIサーバーを待たない。
    Supabaseを待たない。
  */

  const sidebarReady =
    setupSidebar();

  if (!sidebarReady) {
    console.error(
      "サイドバーを生成できませんでした。"
    );
  }

  setupLogout(
    auth,
    signOutFunction
  );

  return sidebarReady;
}
