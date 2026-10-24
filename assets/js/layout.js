import {
  auth,
  db
} from "./firebase.js";

import {
  requireRole
} from "./auth.js";

import {
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  getRecentConversations
} from "./page.js";


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


function element(
  tag,
  className = "",
  text = ""
) {

  const node =
    document.createElement(tag);

  if (className) {
    node.className =
      className;
  }

  if (text !== "") {
    node.textContent =
      text;
  }

  return node;
}


function currentFile() {

  return (
    location.pathname
      .split("/")
      .pop() ||
    "index.html"
  );
}


function toggleSidebar() {

  document.body.classList.toggle(
    "sidebar-collapsed"
  );

  document.body.classList.toggle(
    "sidebar-expanded"
  );
}


function setupToggle(button) {

  if (
    button.dataset.bound === "true"
  ) {
    return;
  }

  button.dataset.bound = "true";

  button.type =
    "button";

  button.setAttribute(
    "aria-label",
    "サイドメニューを開閉"
  );

  button.addEventListener(
    "click",
    toggleSidebar
  );
}


function createLink(
  item
) {

  const link =
    element(
      "a",
      "sidebar-link"
    );

  link.href =
    item.href;

  const file =
    item.href
      .split("/")
      .pop();

  if (
    file === currentFile()
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
    element(
      "span",
      "sidebar-icon",
      item.icon
    );

  icon.setAttribute(
    "aria-hidden",
    "true"
  );

  const label =
    element(
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


function createSidebar(
  role,
  user,
  profile
) {

  let sidebar =
    document.getElementById(
      "appSidebar"
    );

  if (!sidebar) {

    sidebar =
      element(
        "aside",
        "sidebar"
      );

    sidebar.id =
      "appSidebar";

    document.body.prepend(
      sidebar
    );
  }

  sidebar.replaceChildren();


  const header =
    element(
      "div",
      "sidebar-header"
    );

  header.append(
    element(
      "strong",
      "",
      role === "admin"
        ? "運営管理コンソール"
        : "学習AIチャット"
    )
  );

  sidebar.append(
    header
  );


  const toggle =
    element(
      "button",
      "sidebar-toggle",
      "☰"
    );

  setupToggle(toggle);

  sidebar.append(
    toggle
  );


  const displayName =
    profile?.displayName ||
    user?.displayName ||
    user?.email ||
    "ユーザー";


  sidebar.append(
    element(
      "div",
      "sidebar-user",
      displayName
    )
  );


  const nav =
    element(
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


  for (
    const item of links
  ) {

    nav.append(
      createLink(item)
    );
  }


  sidebar.append(
    nav
  );


  if (
    role === "student"
  ) {

    renderRecentHistory(
      sidebar,
      user.uid
    );
  }


  const logout =
    element(
      "button",
      "sidebar-link logout-button",
      "ログアウト"
    );

  logout.type =
    "button";

  logout.dataset.logout =
    "true";


  logout.addEventListener(
    "click",
    async () => {

      logout.disabled =
        true;

      try {

        await signOut(
          auth
        );

        location.replace(
          getRootFile(
            "login.html"
          )
        );

      } catch (error) {

        console.error(
          "ログアウトエラー:",
          error
        );

        logout.disabled =
          false;
      }
    }
  );


  sidebar.append(
    logout
  );
}


async function renderRecentHistory(
  sidebar,
  userId
) {

  const section =
    element(
      "section",
      "sidebar-history"
    );

  const heading =
    element(
      "h2",
      "sidebar-history-heading",
      "最近の会話"
    );

  const list =
    element(
      "div",
      "sidebar-history-list"
    );

  list.textContent =
    "履歴を読み込んでいます...";


  section.append(
    heading,
    list
  );

  sidebar.append(
    section
  );


  try {

    const conversations =
      await getRecentConversations(
        userId
      );

    list.replaceChildren();


    if (
      conversations.length === 0
    ) {

      list.textContent =
        "まだ会話履歴はありません。";

      return;
    }


    for (
      const conversation
      of conversations
    ) {

      const link =
        element(
          "a",
          "sidebar-history-link"
        );

      link.href =
        `question.html?conversationId=${encodeURIComponent(
          conversation.id
        )}`;


      const title =
        conversation.title ||
        conversation.lastQuestion ||
        "会話";


      link.append(
        element(
          "span",
          "sidebar-history-title",
          title
        )
      );


      list.append(
        link
      );
    }

  } catch (error) {

    console.error(
      "履歴取得エラー:",
      error
    );

    list.textContent =
      "履歴を読み込めませんでした。";
  }
}


function getRootFile(
  file
) {

  const path =
    location.pathname;

  if (
    path.includes("/student/") ||
    path.includes("/admin/")
  ) {

    return `../${file}`;
  }

  return `./${file}`;
}


export async function startLayout() {

  const role =
    document.body.dataset.role;

  if (
    role !== "student" &&
    role !== "admin"
  ) {
    return null;
  }


  const result =
    await requireRole(
      role,
      {
        allowMaintenance:
          role === "admin"
      }
    );


  if (!result) {
    return null;
  }


  createSidebar(
    role,
    result.user,
    result.profile
  );


  document.documentElement
    .classList
    .remove(
      "auth-pending"
    );


  return result;
}


if (
  typeof document !== "undefined"
) {

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      () => {
        startLayout()
          .catch(error => {
            console.error(
              "layout初期化エラー:",
              error
            );
          });
      }
    );

  } else {

    startLayout()
      .catch(error => {
        console.error(
          "layout初期化エラー:",
          error
        );
      });
  }
}
