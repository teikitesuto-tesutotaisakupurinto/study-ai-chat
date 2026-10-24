import {
  requireRole,
  auth
} from "./auth.js";

import {
  signOut
} from "./firebase.js";

import {
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from "./firebase.js";

const STUDENT_LINKS = [
  {
    label: "ホーム",
    icon: "⌂",
    href: "index.html"
  },
  {
    label: "AIに質問",
    icon: "?",
    href: "question.html"
  },
  {
    label: "学習履歴",
    icon: "≡",
    href: "history.html"
  },
  {
    label: "お知らせ",
    icon: "▤",
    href: "announcements.html"
  },
  {
    label: "設定",
    icon: "⚙",
    href: "settings.html"
  }
];

const ADMIN_LINKS = [
  {
    label: "管理者ホーム",
    icon: "⌂",
    href: "index.html"
  },
  {
    label: "ユーザー管理",
    icon: "♙",
    href: "users.html"
  },
  {
    label: "お知らせ管理",
    icon: "▤",
    href: "announcements.html"
  },
  {
    label: "メンテナンス",
    icon: "⚙",
    href: "maintenance.html"
  },
  {
    label: "AI設定",
    icon: "◇",
    href: "ai-settings.html"
  },
  {
    label: "操作ログ",
    icon: "≡",
    href: "logs.html"
  },
  {
    label: "システム状態",
    icon: "▦",
    href: "system.html"
  },
  {
    label: "管理者設定",
    icon: "⚙",
    href: "settings.html"
  }
];

let layoutStarted = false;

function makeElement(
  tag,
  className = "",
  text = ""
) {
  const element =
    document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== "") {
    element.textContent = text;
  }

  return element;
}

function showLayoutError(
  message,
  error = null
) {
  let box =
    document.getElementById(
      "layoutError"
    );

  if (!box) {
    box =
      makeElement(
        "div",
        "layout-error"
      );

    box.id =
      "layoutError";

    const main =
      document.querySelector("main");

    (
      main ||
      document.body
    ).prepend(box);
  }

  box.textContent =
    error?.message
      ? `${message} ${error.message}`
      : message;
}

function isMobile() {
  return window.matchMedia(
    "(max-width: 700px)"
  ).matches;
}

function toggleSidebar() {
  if (isMobile()) {
    document.body.classList.toggle(
      "sidebar-expanded"
    );
  } else {
    document.body.classList.toggle(
      "sidebar-collapsed"
    );
  }

  updateToggleStates();
}

function updateToggleStates() {
  const expanded =
    isMobile()
      ? document.body.classList.contains(
          "sidebar-expanded"
        )
      : !document.body.classList.contains(
          "sidebar-collapsed"
        );

  document
    .querySelectorAll(
      ".sidebar-toggle"
    )
    .forEach(button => {
      button.setAttribute(
        "aria-expanded",
        String(expanded)
      );
    });
}

function bindSidebarToggle(
  button
) {
  if (
    button.dataset.sidebarBound ===
    "true"
  ) {
    return;
  }

  button.dataset.sidebarBound =
    "true";

  button.type = "button";

  button.setAttribute(
    "aria-label",
    "サイドメニューを開閉"
  );

  button.addEventListener(
    "click",
    toggleSidebar
  );
}

function setActiveNavigation() {
  const currentFile =
    location.pathname
      .split("/")
      .pop() ||
    "index.html";

  document
    .querySelectorAll(
      ".sidebar .nav-link, .sidebar .sidebar-link"
    )
    .forEach(link => {
      const href =
        link.getAttribute(
          "href"
        ) || "";

      const targetFile =
        href
          .split("?")[0]
          .split("#")[0]
          .split("/")
          .pop();

      const active =
        targetFile ===
        currentFile;

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
    });
}

export function setupSidebar() {
  document
    .querySelectorAll(
      ".sidebar-toggle"
    )
    .forEach(
      bindSidebarToggle
    );

  setActiveNavigation();
}

export function setupLogout() {
  document
    .querySelectorAll(
      "[data-logout], .logout-button"
    )
    .forEach(button => {
      if (
        button.dataset.logoutBound ===
        "true"
      ) {
        return;
      }

      button.dataset.logoutBound =
        "true";

      button.type = "button";

      button.addEventListener(
        "click",
        async () => {
          button.disabled = true;

          try {
            await signOut(auth);

            const nested =
              location.pathname.includes(
                "/student/"
              ) ||
              location.pathname.includes(
                "/admin/"
              );

            location.replace(
              nested
                ? "../login.html"
                : "./login.html"
            );

          } catch (error) {
            console.error(
              "ログアウトエラー:",
              error
            );

            button.disabled = false;

            showLayoutError(
              "ログアウトに失敗しました。",
              error
            );
          }
        }
      );
    });
}

function createNavigationLink(
  item,
  currentFile
) {
  const link =
    makeElement(
      "a",
      "sidebar-link"
    );

  link.href =
    item.href;

  const targetFile =
    item.href
      .split("/")
      .pop();

  if (
    targetFile ===
    currentFile
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
    makeElement(
      "span",
      "sidebar-icon",
      item.icon
    );

  icon.setAttribute(
    "aria-hidden",
    "true"
  );

  const label =
    makeElement(
      "span",
      "sidebar-label",
      item.label
    );

  link.append(
    icon,
    label
  );

  return link;
}

function formatDate(
  value
) {
  if (!value) {
    return "";
  }

  let date;

  try {
    date =
      typeof value.toDate ===
      "function"
        ? value.toDate()
        : new Date(value);
  } catch {
    return "";
  }

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}

async function renderRecentConversations(
  sidebar,
  user
) {
  const section =
    makeElement(
      "section",
      "sidebar-history"
    );

  const heading =
    makeElement(
      "h2",
      "sidebar-history-heading",
      "最近の会話"
    );

  const list =
    makeElement(
      "div",
      "sidebar-history-list"
    );

  list.id =
    "sidebarRecentHistory";

  list.textContent =
    "履歴を読み込んでいます...";

  section.append(
    heading,
    list
  );

  sidebar.append(section);

  try {
    const historyQuery =
      query(
        collection(
          db,
          "chatHistories"
        ),
        where(
          "userId",
          "==",
          user.uid
        ),
        orderBy(
          "updatedAt",
          "desc"
        ),
        limit(8)
      );

    const snapshot =
      await getDocs(
        historyQuery
      );

    list.replaceChildren();

    if (snapshot.empty) {
      list.textContent =
        "まだ会話履歴はありません。";

      return;
    }

    snapshot.forEach(
      conversationDoc => {
        const data =
          conversationDoc.data();

        const link =
          makeElement(
            "a",
            "sidebar-history-link"
          );

        link.href =
          `question.html?conversationId=${encodeURIComponent(
            conversationDoc.id
          )}`;

        const title =
          makeElement(
            "span",
            "sidebar-history-title",
            data.title ||
              data.lastQuestion ||
              "会話"
          );

        const date =
          makeElement(
            "small",
            "sidebar-history-date",
            formatDate(
              data.updatedAt
            )
          );

        link.append(
          title,
          date
        );

        list.append(link);
      }
    );

  } catch (error) {
    console.error(
      "会話履歴取得エラー:",
      error
    );

    list.textContent =
      "履歴を読み込めませんでした。";
  }
}

async function renderSidebar(
  role,
  user,
  profile
) {
  const sidebar =
    document.getElementById(
      "appSidebar"
    );

  if (!sidebar) {
    return;
  }

  sidebar.replaceChildren();

  const brand =
    makeElement(
      "div",
      "sidebar-header"
    );

  const brandTitle =
    makeElement(
      "strong",
      "sidebar-brand-title",
      role === "admin"
        ? "運営管理コンソール"
        : "学習AIチャット"
    );

  brand.append(
    brandTitle
  );

  sidebar.append(
    brand
  );

  const toggleRow =
    makeElement(
      "div",
      "sidebar-toggle-row"
    );

  const toggle =
    makeElement(
      "button",
      "sidebar-toggle",
      "☰"
    );

  bindSidebarToggle(
    toggle
  );

  toggleRow.append(
    toggle
  );

  sidebar.append(
    toggleRow
  );

  const userName =
    profile.displayName ||
    user.displayName ||
    user.email ||
    "ユーザー";

  const name =
    makeElement(
      "div",
      "sidebar-user",
      userName
    );

  sidebar.append(
    name
  );

  const nav =
    makeElement(
      "nav",
      "sidebar-nav"
    );

  nav.setAttribute(
    "aria-label",
    "メインメニュー"
  );

  const currentFile =
    location.pathname
      .split("/")
      .pop() ||
    "index.html";

  const links =
    role === "admin"
      ? ADMIN_LINKS
      : STUDENT_LINKS;

  links.forEach(item => {
    nav.append(
      createNavigationLink(
        item,
        currentFile
      )
    );
  });

  sidebar.append(
    nav
  );

  if (role === "student") {
    await renderRecentConversations(
      sidebar,
      user
    );
  }

  const logout =
    makeElement(
      "button",
      "sidebar-link logout-button",
      "ログアウト"
    );

  logout.type =
    "button";

  logout.dataset.logout =
    "";

  sidebar.append(
    logout
  );

  setupSidebar();
  setupLogout();
}

async function startLayout() {
  if (layoutStarted) {
    return;
  }

  const role =
    document.body.dataset.role;

  if (
    role !== "student" &&
    role !== "admin"
  ) {
    setupSidebar();
    setupLogout();
    return;
  }

  layoutStarted = true;

  try {
    const result =
      await requireRole(
        role,
        {
          allowMaintenance:
            role === "admin"
        }
      );

    if (!result) {
      return;
    }

    await renderSidebar(
      role,
      result.user,
      result.profile
    );

    const nameElement =
      document.getElementById(
        "currentUserName"
      );

    if (nameElement) {
      nameElement.textContent =
        result.profile.displayName ||
        result.user.displayName ||
        result.user.email ||
        "ユーザー";
    }

    const footer =
      document.querySelector(
        ".app-footer"
      );

    if (footer) {
      footer.textContent =
        "© 2026 Regular Test Preparation Worksheet Administration Office. All Rights Reserved.";
    }

    document.documentElement.classList.remove(
      "auth-pending"
    );

  } catch (error) {
    console.error(
      "画面初期化エラー:",
      error
    );

    showLayoutError(
      "画面を初期化できませんでした。",
      error
    );

    document.documentElement.classList.remove(
      "auth-pending"
    );
  }
}

if (
  typeof document !==
  "undefined"
) {
  if (
    document.body &&
    (
      document.body.dataset.role ===
        "student" ||
      document.body.dataset.role ===
        "admin"
    )
  ) {
    startLayout();
  } else {
    setupSidebar();
    setupLogout();
  }
}
