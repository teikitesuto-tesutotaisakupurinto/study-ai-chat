const NAV_ITEMS = [
  {
    label: "ホーム",
    href: "index.html",
    key: "home"
  },
  {
    label: "AIに質問",
    href: "question.html",
    key: "question"
  },
  {
    label: "学習履歴",
    href: "history.html",
    key: "history"
  },
  {
    label: "お知らせ",
    href: "announcements.html",
    key: "announcements"
  },
  {
    label: "設定",
    href: "settings.html",
    key: "settings"
  }
];

function isStudentPage() {
  return location.pathname.includes(
    "/student/"
  );
}

function studentPath(file) {
  if (isStudentPage()) {
    return `./${file}`;
  }

  return `./student/${file}`;
}

function getCurrentKey() {
  const file =
    location.pathname
      .split("/")
      .pop()
      ?.toLowerCase() || "";

  if (file === "index.html") {
    return "home";
  }

  if (
    file === "question.html"
  ) {
    return "question";
  }

  if (
    file === "history.html"
  ) {
    return "history";
  }

  if (
    file === "announcements.html"
  ) {
    return "announcements";
  }

  if (
    file === "settings.html"
  ) {
    return "settings";
  }

  return "";
}

function createSidebar() {
  const sidebar =
    document.createElement("aside");

  sidebar.id = "studySidebar";
  sidebar.className =
    "study-sidebar";

  sidebar.innerHTML = `
    <div class="sidebar-inner">

      <div class="sidebar-brand">
        <a href="${studentPath(
          "index.html"
        )}">
          <span class="brand-title">
            学習AIチャット
          </span>
          <span class="brand-subtitle">
            学習専用AI
          </span>
        </a>
      </div>

      <nav
        class="sidebar-nav"
        aria-label="メインメニュー"
      >
        ${NAV_ITEMS.map(item => `
          <a
            class="sidebar-link"
            data-nav-key="${item.key}"
            href="${studentPath(
              item.href
            )}"
          >
            <span class="sidebar-link-text">
              ${item.label}
            </span>
          </a>
        `).join("")}
      </nav>

      <div class="sidebar-bottom">

        <div
          class="sidebar-user"
          id="sidebarUser"
        >
          <div
            class="sidebar-user-label"
          >
            ログイン中
          </div>

          <div
            class="sidebar-user-name"
            id="sidebarUserName"
          >
            読み込み中
          </div>
        </div>

        <button
          id="sidebarLogout"
          class="sidebar-logout"
          type="button"
        >
          ログアウト
        </button>

      </div>

    </div>
  `;

  return sidebar;
}

function injectStyles() {
  if (
    document.getElementById(
      "study-layout-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "study-layout-style";

  style.textContent = `
    .study-sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      width: 240px;
      background: #ffffff;
      border-right: 1px solid #e2e8f0;
      z-index: 1000;
      overflow-y: auto;
    }

    .sidebar-inner {
      min-height: 100%;
      display: flex;
      flex-direction: column;
    }

    .sidebar-brand {
      padding: 24px 20px 20px;
      border-bottom: 1px solid #edf1f5;
    }

    .sidebar-brand a {
      display: block;
      color: #0f172a;
      text-decoration: none;
    }

    .brand-title {
      display: block;
      font-size: 19px;
      font-weight: 700;
      letter-spacing: .01em;
    }

    .brand-subtitle {
      display: block;
      margin-top: 5px;
      color: #64748b;
      font-size: 12px;
    }

    .sidebar-nav {
      display: grid;
      gap: 4px;
      padding: 16px 12px;
    }

    .sidebar-link {
      display: flex;
      align-items: center;
      min-height: 46px;
      padding: 0 14px;
      border-radius: 8px;
      color: #334155;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      transition:
        background-color .15s ease,
        color .15s ease;
    }

    .sidebar-link:hover {
      background: #f1f5f9;
      color: #0f172a;
    }

    .sidebar-link.active {
      background: #e8f0fe;
      color: #1d4ed8;
    }

    .sidebar-bottom {
      margin-top: auto;
      padding: 16px;
      border-top: 1px solid #edf1f5;
    }

    .sidebar-user {
      padding: 12px;
      border-radius: 8px;
      background: #f8fafc;
    }

    .sidebar-user-label {
      color: #64748b;
      font-size: 11px;
    }

    .sidebar-user-name {
      margin-top: 4px;
      color: #0f172a;
      font-size: 13px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .sidebar-logout {
      width: 100%;
      margin-top: 10px;
      min-height: 42px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      color: #334155;
      font-size: 13px;
      cursor: pointer;
    }

    .sidebar-logout:hover {
      background: #f8fafc;
    }

    .app-layout {
      min-height: 100vh;
    }

    .app-main {
      min-height: 100vh;
      margin-left: 240px;
      padding: 0;
    }

    .page-header {
      padding: 34px 42px 24px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
    }

    .page-title {
      margin: 0;
      color: #0f172a;
      font-size: 26px;
      line-height: 1.35;
    }

    .page-header p {
      margin: 8px 0 0;
      color: #64748b;
      font-size: 14px;
    }

    .page-footer {
      margin-top: 50px;
      padding: 24px;
      color: #94a3b8;
      text-align: center;
      font-size: 11px;
    }

    @media (max-width: 760px) {
      .study-sidebar {
        position: fixed;
        width: 220px;
        transform: translateX(-100%);
        transition: transform .2s ease;
      }

      .study-sidebar.mobile-open {
        transform: translateX(0);
      }

      .app-main {
        margin-left: 0;
      }

      .page-header {
        padding: 28px 20px 20px;
      }

      .page-title {
        font-size: 22px;
      }
    }
  `;

  document.head.appendChild(style);
}

export function setupSidebar(
  profile = null,
  options = {}
) {
  injectStyles();

  let sidebar =
    document.getElementById(
      "appSidebar"
    );

  if (!sidebar) {
    sidebar =
      document.createElement("aside");

    sidebar.id = "appSidebar";

    const main =
      document.querySelector(
        "main"
      );

    if (
      main &&
      main.parentElement
    ) {
      main.parentElement.insertBefore(
        sidebar,
        main
      );
    } else {
      document.body.prepend(
        sidebar
      );
    }
  }

  sidebar.replaceWith(
    createSidebar()
  );

  const newSidebar =
    document.getElementById(
      "studySidebar"
    );

  const currentKey =
    getCurrentKey();

  newSidebar
    .querySelectorAll(
      ".sidebar-link"
    )
    .forEach(link => {
      if (
        link.dataset.navKey ===
        currentKey
      ) {
        link.classList.add(
          "active"
        );
        link.setAttribute(
          "aria-current",
          "page"
        );
      }
    });

  if (profile) {
    setSidebarUser(profile);
  }

  if (
    options.mobileButton !== false
  ) {
    setupMobileMenu();
  }

  return newSidebar;
}

export function setSidebarUser(
  profile
) {
  const name =
    profile?.displayName ||
    profile?.name ||
    "学習者";

  const element =
    document.getElementById(
      "sidebarUserName"
    );

  if (element) {
    element.textContent = name;
  }
}

export function setupLogout(
  auth,
  signOutFunction
) {
  const button =
    document.getElementById(
      "sidebarLogout"
    );

  if (!button) {
    return;
  }

  button.addEventListener(
    "click",
    async () => {
      if (
        !confirm(
          "ログアウトしますか？"
        )
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

        location.replace(
          isStudentPage()
            ? "../login.html"
            : "./login.html"
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

        alert(
          "ログアウトに失敗しました。もう一度お試しください。"
        );
      }
    }
  );
}

function setupMobileMenu() {
  if (
    document.getElementById(
      "mobileMenuButton"
    )
  ) {
    return;
  }

  const button =
    document.createElement(
      "button"
    );

  button.id =
    "mobileMenuButton";

  button.type =
    "button";

  button.textContent =
    "メニュー";

  button.setAttribute(
    "aria-label",
    "メニューを開く"
  );

  button.style.cssText = `
    position: fixed;
    top: 14px;
    left: 14px;
    z-index: 1100;
    display: none;
    min-width: 82px;
    height: 40px;
    padding: 0 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #334155;
    font-size: 13px;
    font-weight: 600;
  `;

  document.body.appendChild(
    button
  );

  const update =
    () => {
      button.style.display =
        window.innerWidth <= 760
          ? "block"
          : "none";
    };

  update();

  window.addEventListener(
    "resize",
    update
  );

  button.addEventListener(
    "click",
    () => {
      const sidebar =
        document.getElementById(
          "studySidebar"
        );

      sidebar?.classList.toggle(
        "mobile-open"
      );
    }
  );
}
