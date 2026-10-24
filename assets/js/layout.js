// assets/js/layout.js

import {
  requireRole,
  auth,
  db
} from "./auth.js";

import {
  signOut,
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
    href: "index.html",
    icon: "⌂"
  },
  {
    label: "AIに質問",
    href: "question.html",
    icon: "?"
  },
  {
    label: "学習履歴",
    href: "history.html",
    icon: "≡"
  },
  {
    label: "お知らせ",
    href: "announcements.html",
    icon: "▤"
  },
  {
    label: "設定",
    href: "settings.html",
    icon: "⚙"
  }
];

const ADMIN_LINKS = [
  {
    label: "管理者ホーム",
    href: "index.html",
    icon: "⌂"
  },
  {
    label: "ユーザー管理",
    href: "users.html",
    icon: "♙"
  },
  {
    label: "お知らせ管理",
    href: "announcements.html",
    icon: "▤"
  },
  {
    label: "メンテナンス",
    href: "maintenance.html",
    icon: "⚙"
  },
  {
    label: "AI設定",
    href: "ai-settings.html",
    icon: "◇"
  },
  {
    label: "操作ログ",
    href: "logs.html",
    icon: "≡"
  },
  {
    label: "システム状態",
    href: "system.html",
    icon: "▦"
  },
  {
    label: "管理者設定",
    href: "settings.html",
    icon: "⚙"
  }
];

let started = false;

function el(
  tag,
  className = "",
  text = ""
) {
  const node =
    document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (text !== "") {
    node.textContent = text;
  }

  return node;
}

function currentFile() {
  return (
    window.location.pathname
      .split("/")
      .pop() ||
    "index.html"
  );
}

function isMobile() {
  return window.matchMedia(
    "(max-width: 700px)"
  ).matches;
}

function updateToggleState() {
  const expanded = isMobile()
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

  updateToggleState();
}

function bindToggle(button) {
  if (
    button.dataset.bound === "true"
  ) {
    return;
  }

  button.dataset.bound = "true";
  button.type = "button";

  button.addEventListener(
    "click",
    toggleSidebar
  );

  updateToggleState();
}

function setupExistingSidebar() {
  document
    .querySelectorAll(
      ".sidebar-toggle"
    )
    .forEach(bindToggle);
}

function createLink(item) {
  const link =
    el("a", "sidebar-link");

  link.href = item.href;

  const target =
    item.href
      .split("?")[0]
      .split("#")[0]
      .split("/")
      .pop();

  if (
    target === currentFile()
  ) {
    link.classList.add("active");

    link.setAttribute(
      "aria-current",
      "page"
    );
  }

  const icon =
    el(
      "span",
      "sidebar-icon",
      item.icon
    );

  icon.setAttribute(
    "aria-hidden",
    "true"
  );

  const label =
    el(
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

function formatDate(value) {
  if (!value) return "";

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
      day: "numeric"
    }
  ).format(date);
}

async function renderRecentConversations(
  sidebar,
  user
) {
  const section =
    el(
      "section",
      "sidebar-history"
    );

  const heading =
    el(
      "h2",
      "sidebar-history-heading",
      "最近の会話"
    );

  const list =
    el(
      "div",
      "sidebar-history-list"
    );

  list.textContent =
    "履歴を読み込んでいます...";

  section.append(
    heading,
    list
  );

  sidebar.append(section);

  try {
    const q = query(
      collection(
        db,
        "chatConversations"
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
      await getDocs(q);

    list.replaceChildren();

    if (snapshot.empty) {
      list.textContent =
        "まだ会話履歴はありません。";

      return;
    }

    snapshot.forEach(
      conversation => {
        const data =
          conversation.data();

        const link =
          el(
            "a",
            "sidebar-history-link"
          );

        link.href =
          `question.html?conversationId=${encodeURIComponent(
            conversation.id
          )}`;

        const title =
          el(
            "span",
            "sidebar-history-title",
            data.title ||
              "学習AIとの会話"
          );

        const date =
          el(
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

  const header =
    el(
      "div",
      "sidebar-header"
    );

  const title =
    el(
      "strong",
      "sidebar-brand",
      role === "admin"
        ? "運営管理コンソール"
        : "学習AIチャット"
    );

  header.append(title);

  sidebar.append(header);

  const toggleRow =
    el(
      "div",
      "sidebar-toggle-row"
    );

  const toggle =
    el(
      "button",
      "sidebar-toggle",
      "☰"
    );

  toggle.setAttribute(
    "aria-label",
    "サイドメニューを開閉"
  );

  toggleRow.append(toggle);

  sidebar.append(
    toggleRow
  );

  bindToggle(toggle);

  const userName =
    profile.displayName ||
    user.displayName ||
    user.email ||
    "ユーザー";

  const userBox =
    el(
      "div",
      "sidebar-user",
      userName
    );

  sidebar.append(
    userBox
  );

  const nav =
    el(
      "nav",
      "sidebar-nav"
    );

  nav.setAttribute(
    "aria-label",
    "メインメニュー"
  );

  const links =
    role === "admin"
      ? ADMIN_LINKS
      : STUDENT_LINKS;

  links.forEach(item => {
    nav.append(
      createLink(item)
    );
  });

  sidebar.append(nav);

  if (
    role === "student"
  ) {
    await renderRecentConversations(
      sidebar,
      user
    );
  }

  const logout =
    el(
      "button",
      "sidebar-link logout-button",
      "ログアウト"
    );

  logout.type = "button";

  logout.addEventListener(
    "click",
    async () => {
      logout.disabled = true;

      try {
        await signOut(auth);

        window.location.replace(
          role === "student" ||
          role === "admin"
            ? "../login.html"
            : "./login.html"
        );

      } catch (error) {
        console.error(
          "ログアウトエラー:",
          error
        );

        logout.disabled = false;
      }
    }
  );

  sidebar.append(logout);
}

async function startLayout() {
  if (started) {
    return;
  }

  const role =
    document.body.dataset.role;

  if (
    role !== "student" &&
    role !== "admin"
  ) {
    setupExistingSidebar();
    return;
  }

  started = true;

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

    const name =
      document.getElementById(
        "currentUserName"
      );

    if (name) {
      name.textContent =
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

  } catch (error) {
    console.error(
      "レイアウト初期化エラー:",
      error
    );
  }
}

if (
  typeof document !==
  "undefined"
) {
  if (
    document.body?.dataset?.role
  ) {
    startLayout();
  } else {
    setupExistingSidebar();
  }
}
