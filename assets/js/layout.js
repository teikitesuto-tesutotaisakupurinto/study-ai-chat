import {
  requireRole,
  auth
} from "./auth.js";

import {
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";


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


function makeElement(
  tag,
  className,
  text
) {

  const element =
    document.createElement(tag);


  if (className) {
    element.className =
      className;
  }


  if (
    text !== undefined
  ) {

    element.textContent =
      text;
  }


  return element;
}


function showLayoutError(
  message,
  error
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
    `${message} ${
      error?.message || ""
    }`;
}


function toggleSidebar() {

  document.body.classList.toggle(
    "sidebar-collapsed"
  );


  const expanded =
    !document.body.classList.contains(
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


export function setupSidebar() {

  document
    .querySelectorAll(
      ".sidebar-toggle"
    )
    .forEach(button => {

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
    });
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


      button.type =
        "button";


      button.addEventListener(
        "click",
        async () => {

          button.disabled =
            true;


          try {

            await signOut(
              auth
            );


            const path =
              location.pathname;


            const nested =
              path.includes(
                "/student/"
              ) ||
              path.includes(
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


function renderSidebar(
  role
) {

  const sidebar =
    document.getElementById(
      "appSidebar"
    );


  if (!sidebar) {
    return;
  }


  const links =
    role === "admin"
      ? ADMIN_LINKS
      : STUDENT_LINKS;


  const currentFile =
    location.pathname
      .split("/")
      .pop();


  sidebar.replaceChildren();


  /*
   * トグル
   */

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


  toggle.type =
    "button";


  toggle.setAttribute(
    "aria-label",
    "サイドメニューを開閉"
  );


  toggle.setAttribute(
    "aria-expanded",
    "true"
  );


  toggle.addEventListener(
    "click",
    toggleSidebar
  );


  toggleRow.append(
    toggle
  );


  sidebar.append(
    toggleRow
  );


  /*
   * ナビゲーション
   */

  const nav =
    makeElement(
      "nav",
      "sidebar-nav"
    );


  nav.setAttribute(
    "aria-label",
    "メインメニュー"
  );


  for (
    const item of links
  ) {

    const link =
      makeElement(
        "a",
        "sidebar-link"
      );


    link.href =
      item.href;


    if (
      currentFile ===
      item.href
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


    nav.append(
      link
    );
  }


  sidebar.append(
    nav
  );


  /*
   * ログアウト
   */

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


  setupLogout();
}


async function startLayout() {

  const role =
    document.body.dataset.role;


  /*
   * data-roleがない旧形式ページは
   * そのページ自身のprotectPage()を使用する。
   */

  if (!role) {
    return;
  }


  /*
   * role確認
   */

  if (
    role !== "student" &&
    role !== "admin"
  ) {

    showLayoutError(
      "ページ設定エラー: data-role に student または admin を指定してください。",
      null
    );

    return;
  }


  /*
   * ここで認証確認は1回だけ。
   */

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


  /*
   * 認証確認後にUIを作る。
   */

  renderSidebar(
    role
  );


  setupSidebar();
  setupLogout();


  /*
   * ユーザー名
   */

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


  /*
   * フッター
   */

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
}


/*
 * data-roleがあるページだけ
 * layout.jsが認証処理を担当する。
 *
 * これが今回の重要ポイント。
 *
 * admin/index.htmlなどでは
 *
 * HTML側 → protectPage()
 * layout.js → requireRole()
 *
 * の二重実行をしない。
 */

if (
  typeof document !== "undefined"
) {

  if (
    document.body?.dataset?.role
  ) {

    startLayout()
      .catch(error => {

        console.error(
          "画面初期化エラー:",
          error
        );


        showLayoutError(
          "画面を初期化できませんでした。",
          error
        );
      });

  } else {

    /*
     * 旧形式ページでは
     * 認証はそのページ側が担当する。
     */

    setupSidebar();
    setupLogout();
  }
}
