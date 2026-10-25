/* =========================================================
   学習AIチャット 共通レイアウト
   ========================================================= */

const NAV_ITEMS = [
  {
    href: "index.html",
    label: "ホーム",
    icon: "⌂"
  },
  {
    href: "question.html",
    label: "AIに質問",
    icon: "?"
  },
  {
    href: "history.html",
    label: "学習履歴",
    icon: "▤"
  },
  {
    href: "announcements.html",
    label: "お知らせ",
    icon: "!"
  },
  {
    href: "settings.html",
    label: "設定",
    icon: "⚙"
  }
];

function isStudentPage() {
  return location.pathname.includes("/student/");
}

function getStudentRoot() {
  return isStudentPage() ? "./" : "./student/";
}

function getCurrentFile() {
  const pathname = location.pathname;
  const file = pathname.split("/").pop();

  return file || "index.html";
}

function createElement(tag, options = {}) {
  const element = document.createElement(tag);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text) {
    element.textContent = options.text;
  }

  if (options.id) {
    element.id = options.id;
  }

  return element;
}

function createSidebar() {
  const sidebar = createElement("aside", {
    className: "student-sidebar"
  });

  const brand = createElement("div", {
    className: "sidebar-brand"
  });

  const brandTitle = createElement("div", {
    className: "sidebar-brand-title",
    text: "学習AIチャット"
  });

  const brandSubtitle = createElement("div", {
    className: "sidebar-brand-subtitle",
    text: "中学生向け学習サポート"
  });

  brand.append(
    brandTitle,
    brandSubtitle
  );

  const navigation = createElement("nav", {
    className: "sidebar-nav"
  });

  navigation.setAttribute(
    "aria-label",
    "メインメニュー"
  );

  const currentFile =
    getCurrentFile();

  for (const item of NAV_ITEMS) {
    const link = document.createElement("a");

    link.className =
      "sidebar-nav-item";

    link.href =
      `${getStudentRoot()}${item.href}`;

    link.dataset.page =
      item.href;

    if (
      currentFile === item.href
    ) {
      link.classList.add("active");
      link.setAttribute(
        "aria-current",
        "page"
      );
    }

    const icon =
      createElement("span", {
        className:
          "sidebar-nav-icon",
        text: item.icon
      });

    const label =
      createElement("span", {
        className:
          "sidebar-nav-label",
        text: item.label
      });

    link.append(
      icon,
      label
    );

    navigation.append(link);
  }

  const bottom =
    createElement("div", {
      className:
        "sidebar-bottom"
    });

  const logout =
    createElement("button", {
      className:
        "sidebar-logout",
      text: "ログアウト"
    });

  logout.type = "button";
  logout.id = "sidebarLogout";

  bottom.append(logout);

  sidebar.append(
    brand,
    navigation,
    bottom
  );

  return sidebar;
}

export function setupSidebar() {
  const oldSidebar =
    document.getElementById(
      "appSidebar"
    );

  if (!oldSidebar) {
    return null;
  }

  oldSidebar.replaceChildren();

  const sidebar =
    createSidebar();

  oldSidebar.appendChild(sidebar);

  return sidebar;
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
        button.dataset.busy === "true"
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
        await signOutFunction(auth);

        location.replace(
          "../login.html"
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
          "ログアウトに失敗しました。もう一度お試しください。"
        );
      }
    }
  );
}
