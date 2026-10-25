/* =========================================================
   学習AIチャット 独立サイドバー
   ---------------------------------------------------------
   Firebase
   Firestore
   Supabase
   AI API
   認証状態

   ↑ すべてに依存しない
   ========================================================= */

(function () {
  "use strict";

  const SIDEBAR_ID = "independentSidebar";

  const MENU_ITEMS = [
    {
      href: "index.html",
      label: "学習ホーム",
      icon: "⌂"
    },
    {
      href: "question.html",
      label: "AI学習チャット",
      icon: "＋"
    }
  ];

  function getBasePath() {
    const path = window.location.pathname;

    if (path.includes("/student/")) {
      return "./";
    }

    return "./student/";
  }

  function getCurrentFile() {
    const pathname =
      window.location.pathname;

    const file =
      pathname.substring(
        pathname.lastIndexOf("/") + 1
      );

    return file || "index.html";
  }

  function createElement(tag, className) {
    const element =
      document.createElement(tag);

    if (className) {
      element.className = className;
    }

    return element;
  }

  function createSidebar() {
    const existing =
      document.getElementById(
        SIDEBAR_ID
      );

    if (existing) {
      return existing;
    }

    const sidebar =
      createElement(
        "aside",
        "app-sidebar"
      );

    sidebar.id = SIDEBAR_ID;

    sidebar.setAttribute(
      "aria-label",
      "メインメニュー"
    );

    /* -------------------------------------------------------
       ブランド
       ------------------------------------------------------- */

    const brand =
      createElement(
        "div",
        "sidebar-brand"
      );

    const brandLink =
      document.createElement("a");

    brandLink.href =
      getBasePath() + "index.html";

    brandLink.textContent =
      "学習AIチャット";

    brand.appendChild(
      brandLink
    );

    sidebar.appendChild(
      brand
    );

    /* -------------------------------------------------------
       ナビゲーション
       ------------------------------------------------------- */

    const nav =
      createElement(
        "nav",
        "sidebar-nav"
      );

    const sectionTitle =
      createElement(
        "div",
        "sidebar-section-title"
      );

    sectionTitle.textContent =
      "学習メニュー";

    nav.appendChild(
      sectionTitle
    );

    const currentFile =
      getCurrentFile();

    for (
      const item of MENU_ITEMS
    ) {
      const link =
        document.createElement("a");

      link.className =
        "sidebar-link";

      const target =
        item.href;

      link.href =
        getBasePath() + target;

      if (
        currentFile === target
      ) {
        link.classList.add(
          "active"
        );

        link.setAttribute(
          "aria-current",
          "page"
        );
      }

      const icon =
        createElement(
          "span",
          "sidebar-icon"
        );

      icon.setAttribute(
        "aria-hidden",
        "true"
      );

      icon.textContent =
        item.icon;

      const label =
        createElement(
          "span",
          "sidebar-label"
        );

      label.textContent =
        item.label;

      link.append(
        icon,
        label
      );

      nav.appendChild(
        link
      );
    }

    sidebar.appendChild(
      nav
    );

    /* -------------------------------------------------------
       空き領域
       ------------------------------------------------------- */

    const spacer =
      createElement(
        "div",
        "sidebar-spacer"
      );

    sidebar.appendChild(
      spacer
    );

    /* -------------------------------------------------------
       フッター
       ------------------------------------------------------- */

    const footer =
      createElement(
        "footer",
        "sidebar-footer"
      );

    const footerText =
      createElement(
        "p",
        "sidebar-footer-text"
      );

    footerText.textContent =
      "© 2026 定期テスト対策プリント運営事務局";

    footer.appendChild(
      footerText
    );

    sidebar.appendChild(
      footer
    );

    return sidebar;
  }

  function createMobileControls() {
    if (
      document.getElementById(
        "sidebarMenuButton"
      )
    ) {
      return;
    }

    const button =
      createElement(
        "button",
        "sidebar-menu-button"
      );

    button.id =
      "sidebarMenuButton";

    button.type =
      "button";

    button.setAttribute(
      "aria-label",
      "メニューを開く"
    );

    button.setAttribute(
      "aria-expanded",
      "false"
    );

    button.textContent =
      "☰";

    const overlay =
      createElement(
        "div",
        "sidebar-overlay"
      );

    overlay.id =
      "sidebarOverlay";

    function closeMenu() {
      const sidebar =
        document.getElementById(
          SIDEBAR_ID
        );

      if (!sidebar) {
        return;
      }

      sidebar.classList.remove(
        "open"
      );

      overlay.classList.remove(
        "open"
      );

      button.setAttribute(
        "aria-expanded",
        "false"
      );
    }

    function openMenu() {
      const sidebar =
        document.getElementById(
          SIDEBAR_ID
        );

      if (!sidebar) {
        return;
      }

      sidebar.classList.add(
        "open"
      );

      overlay.classList.add(
        "open"
      );

      button.setAttribute(
        "aria-expanded",
        "true"
      );
    }

    button.addEventListener(
      "click",
      function () {
        const sidebar =
          document.getElementById(
            SIDEBAR_ID
          );

        if (
          sidebar?.classList.contains(
            "open"
          )
        ) {
          closeMenu();
        } else {
          openMenu();
        }
      }
    );

    overlay.addEventListener(
      "click",
      closeMenu
    );

    document.body.appendChild(
      button
    );

    document.body.appendChild(
      overlay
    );
  }

  function initSidebar() {
    /*
      DOMContentLoadedを待つだけ。

      Firebase等の初期化を待たない。
      したがって Firebase が落ちても
      サイドバーは生成される。
    */

    const sidebar =
      createSidebar();

    document.body.prepend(
      sidebar
    );

    document.body.classList.add(
      "has-independent-sidebar"
    );

    createMobileControls();
  }

  /*
    できるだけ早く実行
  */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initSidebar,
      {
        once: true
      }
    );
  } else {
    initSidebar();
  }

  /*
    外部から再描画可能
  */

  window.IndependentSidebar = {
    init: initSidebar
  };
})();
