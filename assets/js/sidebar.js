(() => {
  "use strict";

  const SIDEBAR_FILE =
    "assets/html/sidebar.html";

  const SIDEBAR_CSS =
    "assets/css/sidebar.css";

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

  function getCurrentPage() {
    const path =
      location.pathname
        .replace(/\\/g, "/")
        .toLowerCase();

    if (
      path.endsWith("/student/index.html") ||
      path.endsWith("/student/") ||
      path.endsWith("/index.html")
    ) {
      return "home";
    }

    if (
      path.endsWith("/student/question.html") ||
      path.endsWith("/question.html")
    ) {
      return "question";
    }

    return "";
  }

  function loadCss() {
    if (
      document.querySelector(
        'link[data-sidebar-css="true"]'
      )
    ) {
      return;
    }

    const link =
      document.createElement("link");

    link.rel = "stylesheet";

    link.href =
      getRootPath() +
      SIDEBAR_CSS;

    link.dataset.sidebarCss = "true";

    document.head.appendChild(link);
  }

  async function loadSidebarHtml() {
    const response =
      await fetch(
        getRootPath() +
        SIDEBAR_FILE,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `サイドバーの読み込みに失敗しました。HTTP ${response.status}`
      );
    }

    return await response.text();
  }

  function setActivePage() {
    const current =
      getCurrentPage();

    const links =
      document.querySelectorAll(
        "[data-sidebar-page]"
      );

    links.forEach(link => {
      const page =
        link.dataset.sidebarPage;

      link.classList.toggle(
        "active",
        page === current
      );

      if (page === current) {
        link.setAttribute(
          "aria-current",
          "page"
        );
      } else {
        link.removeAttribute(
          "aria-current"
        );
      }
    });
  }

  function setupLogout() {
    const button =
      document.getElementById(
        "sidebarLogoutButton"
      );

    if (!button) {
      return;
    }

    /*
      Firebaseをここでは直接importしない。

      logoutが必要な場合だけ、
      既存のlogout処理が存在すれば呼び出す。
    */

    button.addEventListener(
      "click",
      async () => {

        if (
          button.dataset.busy === "true"
        ) {
          return;
        }

        button.dataset.busy =
          "true";

        const original =
          button.querySelector(
            ".sidebar-label"
          )?.textContent ||
          "ログアウト";

        const label =
          button.querySelector(
            ".sidebar-label"
          );

        if (label) {
          label.textContent =
            "ログアウト中...";
        }

        try {

          /*
            logout処理は、
            ページ側から登録できる。

            window.studyChatLogout
            があれば実行する。
          */

          if (
            typeof window.studyChatLogout ===
            "function"
          ) {
            await window.studyChatLogout();
          } else {
            /*
              ログアウト処理が登録されていない場合は、
              ログイン画面へ移動するだけにする。
            */

            location.href =
              getRootPath() +
              "login.html";
          }

        } catch (error) {

          console.error(
            "サイドバーのログアウトエラー:",
            error
          );

          alert(
            "ログアウトに失敗しました。\n" +
            (
              error?.message ||
              String(error)
            )
          );

        } finally {

          button.dataset.busy =
            "false";

          if (label) {
            label.textContent =
              original;
          }
        }
      }
    );
  }

  async function init() {

    /*
      既に存在する場合は二重生成しない。
    */

    let container =
      document.getElementById(
        "appSidebar"
      );

    if (!container) {
      return;
    }

    /*
      サイドバー表示に必要なのは
      HTML + CSSだけ。
    */

    loadCss();

    /*
      先にローディング表示。
    */

    container.innerHTML = `
      <div class="sidebar-loading">
        メニューを読み込んでいます...
      </div>
    `;

    try {

      const html =
        await loadSidebarHtml();

      container.innerHTML =
        html;

      setActivePage();

      setupLogout();

    } catch (error) {

      console.error(
        "サイドバー読み込みエラー:",
        error
      );

      /*
        エラーでも真っ白にしない。
      */

      container.innerHTML = `
        <aside class="app-sidebar">
          <div class="sidebar-inner">

            <div class="sidebar-brand">
              <div class="sidebar-brand-title">
                学習AIチャット
              </div>

              <div class="sidebar-brand-subtitle">
                定期テスト対策プリント運営事務局
              </div>
            </div>

            <nav class="sidebar-nav">

              <a
                class="sidebar-link"
                href="${getRootPath()}student/index.html"
              >
                <span class="sidebar-icon">⌂</span>
                <span class="sidebar-label">
                  学習ホーム
                </span>
              </a>

              <a
                class="sidebar-link"
                href="${getRootPath()}student/question.html"
              >
                <span class="sidebar-icon">＋</span>
                <span class="sidebar-label">
                  AI学習チャット
                </span>
              </a>

            </nav>

          </div>
        </aside>
      `;

      setActivePage();
      setupLogout();
    }
  }

  /*
    他のJavaScriptからも利用可能。
  */

  window.StudyChatSidebar = {
    init,
    setActivePage
  };

  /*
    DOM完成後に起動。
  */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }

})();
