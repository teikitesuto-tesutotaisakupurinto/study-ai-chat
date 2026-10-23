// assets/js/layout.js
(function () {
  "use strict";

  const footerText =
    "© 2026 Regular Test Preparation Worksheet Administration Office. All Rights Reserved.";

  const studentItems = [
    ["ホーム", "student/index.html"],
    ["AI学習チャット", "student/question.html"],
    ["学習履歴", "student/history.html"],
    ["お知らせ", "student/announcements.html"],
    ["設定", "student/settings.html"]
  ];

  const adminItems = [
    ["管理者ホーム", "admin/index.html"],
    ["ユーザー管理", "admin/users.html"],
    ["お知らせ管理", "admin/announcements.html"],
    ["メンテナンス", "admin/maintenance.html"],
    ["AI設定", "admin/ai-settings.html"],
    ["操作ログ", "admin/logs.html"],
    ["システム状態", "admin/system.html"],
    ["管理設定", "admin/settings.html"]
  ];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  window.escapeHtml = escapeHtml;

  window.renderLayout = function (options) {
    const config = options || {};
    const role = config.role || "student";
    const title = config.title || "学習AIチャット";
    const items = role === "admin" ? adminItems : studentItems;
    const currentPath = window.location.pathname;

    const menu = items.map(function (item) {
      const href = window.AppPaths.url(item[1]);
      const active = currentPath === new URL(
        href,
        window.location.origin
      ).pathname;

      return `
        <a class="nav-link ${active ? "active" : ""}"
           href="${escapeHtml(href)}">
          ${escapeHtml(item[0])}
        </a>
      `;
    }).join("");

    const host = document.getElementById("app");
    if (!host) return;

    host.innerHTML = `
      <div class="app-shell ${role === "admin" ? "admin-shell" : "student-shell"}">
        <aside class="sidebar" id="sidebar">
          <div class="brand">
            <div class="brand-mark">学</div>
            <div>
              <strong>学習AIチャット</strong>
              <small>${role === "admin" ? "管理者コンソール" : "学習ポータル"}</small>
            </div>
          </div>
          <nav class="side-nav">${menu}</nav>
          <div class="sidebar-bottom">
            <button class="nav-link logout-button" id="logoutButton" type="button">
              ログアウト
            </button>
          </div>
        </aside>

        <div class="main-column">
          <header class="topbar">
            <button type="button" id="menuToggle"
              class="menu-toggle" aria-label="メニューを開閉">☰</button>
            <div class="topbar-title">${escapeHtml(title)}</div>
            <div class="user-label" id="userLabel">読み込み中</div>
          </header>

          <main class="page-content" id="pageContent">
            ${config.content || ""}
          </main>

          <footer class="app-footer">${footerText}</footer>
        </div>
      </div>
    `;

    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");

    menuToggle.addEventListener("click", function () {
      sidebar.classList.toggle("sidebar-open");
    });

    document.getElementById("logoutButton").addEventListener(
      "click",
      async function () {
        const button = this;
        button.disabled = true;

        try {
          await window.auth.signOut();
          window.location.replace(window.AppPaths.login);
        } catch (error) {
          console.error(error);
          alert("ログアウトできませんでした。もう一度お試しください。");
          button.disabled = false;
        }
      }
    );

    window.getCurrentProfile().then(function (profile) {
      const user = window.authState.user;
      const label = document.getElementById("userLabel");

      if (label) {
        label.textContent =
          (profile && profile.displayName) ||
          (user && user.email) ||
          "ユーザー";
      }
    });
  };
})();
