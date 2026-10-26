
/*
 * assets/js/layout.js
 *
 * サイドバー専用
 *
 * Firebase / Firestore / Supabase / AI通信から完全独立
 *
 * student/question.html
 * admin/index.html
 * その他の画面から共通利用可能
 */

(() => {

  "use strict";


  /* =========================================
     設定
  ========================================= */

  const SIDEBAR_ID =
    "appSidebar";


  /* =========================================
     メニュー
  ========================================= */

  const STUDENT_MENU = [

    {
      label: "ホーム",
      href: "./index.html"
    },

    {
      label: "学習AI",
      href: "./question.html"
    },

    {
      label: "学習履歴",
      href: "./history.html"
    },

    {
      label: "お知らせ",
      href: "./information.html"
    },

    {
      label: "設定",
      href: "./settings.html"
    }

  ];


  const ADMIN_MENU = [

    {
      label: "ホーム",
      href: "./index.html"
    },

    {
      label: "生徒管理",
      href: "./students.html"
    },

    {
      label: "問題管理",
      href: "./questions.html"
    },

    {
      label: "テスト管理",
      href: "./tests.html"
    },

    {
      label: "成績管理",
      href: "./grades.html"
    },

    {
      label: "お知らせ",
      href: "./information.html"
    },

    {
      label: "設定",
      href: "./settings.html"
    }

  ];


  /* =========================================
     現在ページ
  ========================================= */

  function getCurrentPath() {

    return location.pathname
      .replace(/\/+$/, "");

  }


  function isCurrentPage(
    href
  ) {

    try {

      const url =
        new URL(
          href,
          location.href
        );


      return (
        url.pathname.replace(/\/+$/, "") ===
        getCurrentPath()
      );

    } catch {

      return false;

    }

  }


  /* =========================================
     相対パス調整
  ========================================= */

  function resolveHref(
    href
  ) {

    try {

      return new URL(
        href,
        location.href
      ).href;

    } catch {

      return href;

    }

  }


  /* =========================================
     ロール判定
  ========================================= */

  function detectRole() {

    const bodyRole =
      document.body.dataset.role;


    if (
      bodyRole === "admin" ||
      bodyRole === "teacher"
    ) {

      return "admin";

    }


    const path =
      location.pathname.toLowerCase();


    if (
      path.includes("/admin/")
    ) {

      return "admin";

    }


    return "student";

  }


  /* =========================================
     メニュー取得
  ========================================= */

  function getMenu() {

    return detectRole() === "admin"
      ? ADMIN_MENU
      : STUDENT_MENU;

  }


  /* =========================================
     サイドバーHTML
  ========================================= */

  function createSidebar() {

    const sidebar =
      document.getElementById(
        SIDEBAR_ID
      );


    if (!sidebar) {

      return null;

    }


    sidebar.classList.add(
      "app-sidebar"
    );


    sidebar.innerHTML = "";


    /* =======================================
       ロゴ
    ======================================= */

    const brand =
      document.createElement(
        "div"
      );


    brand.className =
      "layout-brand";


    const brandTitle =
      document.createElement(
        "div"
      );


    brandTitle.className =
      "layout-brand-title";


    brandTitle.textContent =
      "学習AI";


    const brandSub =
      document.createElement(
        "div"
      );


    brandSub.className =
      "layout-brand-sub";


    brandSub.textContent =
      "Study AI Chat";


    brand.append(
      brandTitle,
      brandSub
    );


    sidebar.append(
      brand
    );


    /* =======================================
       メニュー
    ======================================= */

    const nav =
      document.createElement(
        "nav"
      );


    nav.className =
      "layout-nav";


    nav.setAttribute(
      "aria-label",
      "メインメニュー"
    );


    const menu =
      getMenu();


    for (
      const item of menu
    ) {

      const link =
        document.createElement(
          "a"
        );


      link.className =
        "layout-nav-link";


      link.href =
        resolveHref(
          item.href
        );


      link.textContent =
        item.label;


      if (
        isCurrentPage(
          item.href
        )
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


    sidebar.append(
      nav
    );


    /* =======================================
       下部
    ======================================= */

    const bottom =
      document.createElement(
        "div"
      );


    bottom.className =
      "layout-bottom";


    /* 設定 */
    const settings =
      document.createElement(
        "a"
      );


    settings.className =
      "layout-bottom-link";


    settings.href =
      resolveHref(
        detectRole() === "admin"
          ? "./settings.html"
          : "./settings.html"
      );


    settings.textContent =
      "設定";


    if (
      isCurrentPage(
        settings.href
      )
    ) {

      settings.classList.add(
        "active"
      );

    }


    bottom.append(
      settings
    );


    /* ログアウト */
    const logout =
      document.createElement(
        "button"
      );


    logout.type =
      "button";


    logout.className =
      "layout-logout";


    logout.textContent =
      "ログアウト";


    logout.addEventListener(
      "click",
      () => {

        performLogout();

      }
    );


    bottom.append(
      logout
    );


    sidebar.append(
      bottom
    );


    applySidebarStyle(
      sidebar
    );


    return sidebar;

  }


  /* =========================================
     ログアウト
     
     Firebaseをここでは読み込まない。
     他のコードが logout 処理を提供できる。
  ========================================= */

  function performLogout() {

    const customLogout =
      window.StudyAILogout;


    if (
      typeof customLogout ===
      "function"
    ) {

      Promise.resolve(
        customLogout()
      )
      .catch(
        error => {

          console.error(
            "ログアウトエラー:",
            error
          );

          location.replace(
            "../login.html"
          );

        }
      );

      return;

    }


    /*
     * Firebaseをここで直接初期化しない。
     *
     * 既存の認証処理が
     * window.StudyAILogout
     * を提供していればそれを使用する。
     *
     * 何も提供されていない場合は
     * ログイン画面へ戻す。
     */

    location.replace(
      "../login.html"
    );

  }


  /* =========================================
     サイドバーCSS
  ========================================= */

  function applySidebarStyle(
    sidebar
  ) {

    if (
      document.getElementById(
        "layoutSidebarStyle"
      )
    ) {

      return;

    }


    const style =
      document.createElement(
        "style"
      );


    style.id =
      "layoutSidebarStyle";


    style.textContent = `

      .app-sidebar {

        width: 240px;

        min-width: 240px;

        min-height: 100vh;

        display: flex;

        flex-direction: column;

        background: #ffffff;

        border-right: 1px solid #e5e7eb;

        color: #1f2937;

        z-index: 100;

      }


      .layout-brand {

        flex: 0 0 auto;

        padding: 22px 20px 20px;

        border-bottom: 1px solid #eef0f3;

        background: #ffffff;

      }


      .layout-brand-title {

        color: #111827;

        font-size: 19px;

        font-weight: 700;

        line-height: 1.4;

      }


      .layout-brand-sub {

        margin-top: 3px;

        color: #94a3b8;

        font-size: 10px;

        line-height: 1.4;

      }


      .layout-nav {

        flex: 1;

        display: flex;

        flex-direction: column;

        gap: 3px;

        padding: 14px 10px;

      }


      .layout-nav-link {

        display: flex;

        align-items: center;

        min-height: 43px;

        padding: 8px 12px;

        border-radius: 8px;

        color: #475569;

        background: transparent;

        text-decoration: none;

        font-size: 14px;

        font-weight: 500;

        transition:

          background-color .15s ease,

          color .15s ease;

      }


      .layout-nav-link:hover {

        background: #f1f5f9;

        color: #1e293b;

      }


      .layout-nav-link.active {

        background: #eef4ff;

        color: #2563eb;

        font-weight: 650;

      }


      .layout-bottom {

        flex: 0 0 auto;

        display: flex;

        flex-direction: column;

        gap: 3px;

        padding: 10px;

        border-top: 1px solid #eef0f3;

        background: #ffffff;

      }


      .layout-bottom-link,

      .layout-logout {

        width: 100%;

        min-height: 43px;

        display: flex;

        align-items: center;

        padding: 8px 12px;

        border: 0;

        border-radius: 8px;

        background: transparent;

        color: #475569;

        text-decoration: none;

        font-size: 14px;

        font-weight: 500;

        text-align: left;

        cursor: pointer;

      }


      .layout-bottom-link:hover,

      .layout-logout:hover {

        background: #f1f5f9;

        color: #1e293b;

      }


      .layout-bottom-link.active {

        background: #eef4ff;

        color: #2563eb;

      }


      @media (max-width: 760px) {

        .app-sidebar {

          width: 205px;

          min-width: 205px;

        }

      }


      @media (max-width: 560px) {

        .app-sidebar {

          width: 185px;

          min-width: 185px;

        }


        .layout-brand {

          padding: 18px 15px;

        }


        .layout-nav,

        .layout-bottom {

          padding-left: 7px;

          padding-right: 7px;

        }


        .layout-nav-link,

        .layout-bottom-link,

        .layout-logout {

          font-size: 13px;

        }

      }

    `;


    document.head.append(
      style
    );

  }


  /* =========================================
     公開API
  ========================================= */

  window.StudyAILayout = {

    render() {

      return createSidebar();

    },

    logout() {

      performLogout();

    }

  };


  /*
   * ページ読み込み後に即描画
   */
  function boot() {

    createSidebar();

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      boot,
      {
        once: true
      }
    );

  } else {

    boot();

  }

})();
