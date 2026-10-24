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

/* =========================================================
   ナビゲーション設定
   ※ 絵文字・記号アイコンは使用しない
   ========================================================= */

const STUDENT_LINKS = [
  {
    label: "ホーム",
    href: "index.html"
  },
  {
    label: "AIに質問",
    href: "question.html"
  },
  {
    label: "学習履歴",
    href: "history.html"
  },
  {
    label: "お知らせ",
    href: "announcements.html"
  },
  {
    label: "設定",
    href: "settings.html"
  }
];

const ADMIN_LINKS = [
  {
    label: "管理者ホーム",
    href: "index.html"
  },
  {
    label: "ユーザー管理",
    href: "users.html"
  },
  {
    label: "お知らせ管理",
    href: "announcements.html"
  },
  {
    label: "メンテナンス",
    href: "maintenance.html"
  },
  {
    label: "AI設定",
    href: "ai-settings.html"
  },
  {
    label: "操作ログ",
    href: "logs.html"
  },
  {
    label: "システム状態",
    href: "system.html"
  },
  {
    label: "管理者設定",
    href: "settings.html"
  }
];

let layoutStarted = false;

/* =========================================================
   共通DOM生成
   ========================================================= */

function makeElement(
  tag,
  className = "",
  text = ""
) {
  const element =
    document.createElement(tag);

  if (className) {
    element.className =
      className;
  }

  if (text !== "") {
    element.textContent =
      text;
  }

  return element;
}

/* =========================================================
   エラー表示
   ========================================================= */

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
      document.querySelector(
        "main"
      );

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

/* =========================================================
   レスポンシブ判定
   ========================================================= */

function isMobile() {
  return window.matchMedia(
    "(max-width: 700px)"
  ).matches;
}

/* =========================================================
   サイドバー開閉
   ========================================================= */

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

/* =========================================================
   現在ページのナビゲーション
   ========================================================= */

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

/* =========================================================
   サイドバーセットアップ
   ========================================================= */

export function setupSidebar() {
  document
    .querySelectorAll(
      ".sidebar-toggle"
    )
    .forEach(
      bindSidebarToggle
    );

  setActiveNavigation();

  updateToggleStates();
}

/* =========================================================
   ログアウト
   ========================================================= */

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

      button.type =
        "button";

      button.addEventListener(
        "click",
        async () => {
          if (
            button.disabled
          ) {
            return;
          }

          button.disabled =
            true;

          try {
            await signOut(
              auth
            );

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

            button.disabled =
              false;

            showLayoutError(
              "ログアウトに失敗しました。",
              error
            );
          }
        }
      );
    });
}

/* =========================================================
   ナビゲーションリンク生成
   ※ アイコン・絵文字は使用しない
   ========================================================= */

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
      .split("?")[0]
      .split("#")[0]
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

  const label =
    makeElement(
      "span",
      "sidebar-label",
      item.label
    );

  link.append(
    label
  );

  return link;
}

/* =========================================================
   日付フォーマット
   ========================================================= */

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

/* =========================================================
   最近の会話
   ========================================================= */

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

  sidebar.append(
    section
  );

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

    if (
      snapshot.empty
    ) {
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

        list.append(
          link
        );
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

/* =========================================================
   サイドバー本体
   ========================================================= */

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

  /* -------------------------------------------------------
     ブランド
     ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     メニュー開閉ボタン
     ※ 絵文字・記号ではなく文字表示
     ------------------------------------------------------- */

  const toggleRow =
    makeElement(
      "div",
      "sidebar-toggle-row"
    );

  const toggle =
    makeElement(
      "button",
      "sidebar-toggle",
      "メニュー"
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

  /* -------------------------------------------------------
     ユーザー名
     ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     メインナビゲーション
     ------------------------------------------------------- */

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

  links.forEach(
    item => {
      nav.append(
        createNavigationLink(
          item,
          currentFile
        )
      );
    }
  );

  sidebar.append(
    nav
  );

  /* -------------------------------------------------------
     学生用：最近の会話
     ------------------------------------------------------- */

  if (
    role === "student"
  ) {
    await renderRecentConversations(
      sidebar,
      user
    );
  }

  /* -------------------------------------------------------
     ログアウト
     ------------------------------------------------------- */

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

/* =========================================================
   レイアウト開始
   ========================================================= */

async function startLayout() {
  if (
    layoutStarted
  ) {
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

  layoutStarted =
    true;

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

    /* -------------------------------------------------------
       現在のユーザー名
       ------------------------------------------------------- */

    const nameElement =
      document.getElementById(
        "currentUserName"
      );

    if (
      nameElement
    ) {
      nameElement.textContent =
        result.profile.displayName ||
        result.user.displayName ||
        result.user.email ||
        "ユーザー";
    }

    /* -------------------------------------------------------
       フッター
       ------------------------------------------------------- */

    const footer =
      document.querySelector(
        ".app-footer"
      );

    if (
      footer
    ) {
      footer.textContent =
        "© 2026 Regular Test Preparation Worksheet Administration Office. All Rights Reserved.";
    }

    /* -------------------------------------------------------
       初期化完了
       ------------------------------------------------------- */

    document.documentElement.classList.remove(
      "auth-pending"
    );

    document.body.classList.remove(
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

    document.body.classList.remove(
      "auth-pending"
    );
  }
}

/* =========================================================
   初期実行
   ========================================================= */

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

/* =========================================================
   画面サイズ変更時
   ========================================================= */

window.addEventListener(
  "resize",
  () => {
    updateToggleStates();
  }
);
