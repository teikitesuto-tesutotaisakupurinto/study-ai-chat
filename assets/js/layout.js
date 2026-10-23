import { requireRole, auth } from "./auth.js";

import {
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

const STUDENT_LINKS = [
  { label: "ホーム", icon: "⌂", href: "index.html" },
  { label: "AIに質問", icon: "?", href: "question.html" },
  { label: "学習履歴", icon: "≡", href: "history.html" },
  { label: "お知らせ", icon: "▤", href: "announcements.html" },
  { label: "設定", icon: "⚙", href: "settings.html" }
];

const ADMIN_LINKS = [
  { label: "管理者ホーム", icon: "⌂", href: "index.html" },
  { label: "ユーザー管理", icon: "♙", href: "users.html" },
  { label: "お知らせ管理", icon: "▤", href: "announcements.html" },
  { label: "メンテナンス", icon: "⚙", href: "maintenance.html" },
  { label: "AI設定", icon: "◇", href: "ai-settings.html" },
  { label: "操作ログ", icon: "≡", href: "logs.html" },
  { label: "システム状態", icon: "▦", href: "system.html" },
  { label: "管理者設定", icon: "⚙", href: "settings.html" }
];

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderSidebar(role) {
  const sidebar = document.querySelector("#appSidebar");
  const main = document.querySelector("#appMain");

  if (!sidebar || !main) {
    throw new Error("ページに #appSidebar と #appMain が必要です。");
  }

  const links = role === "admin" ? ADMIN_LINKS : STUDENT_LINKS;
  const currentFile = location.pathname.split("/").pop();

  sidebar.replaceChildren();

  const toggleRow = createElement("div", "sidebar-toggle-row");
  const toggle = createElement("button", "sidebar-toggle", "☰");

  toggle.type = "button";
  toggle.setAttribute("aria-label", "サイドメニューを開閉");
  toggle.setAttribute("aria-expanded", "true");

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-collapsed");

    const expanded =
      !document.body.classList.contains("sidebar-collapsed");

    toggle.setAttribute("aria-expanded", String(expanded));
  });

  toggleRow.append(toggle);
  sidebar.append(toggleRow);

  const nav = createElement("nav", "sidebar-nav");
  nav.setAttribute("aria-label", "メインメニュー");

  for (const item of links) {
    const link = createElement("a", "sidebar-link");
    link.href = item.href;

    if (currentFile === item.href) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }

    const icon = createElement("span", "sidebar-icon", item.icon);
    icon.setAttribute("aria-hidden", "true");

    const label = createElement("span", "sidebar-label", item.label);

    link.append(icon, label);
    nav.append(link);
  }

  sidebar.append(nav);

  const logout = createElement("button", "sidebar-link", "ログアウト");
  logout.type = "button";
  logout.style.margin = "auto 8px 12px";
  logout.style.width = "calc(100% - 16px)";
  logout.style.border = "0";
  logout.style.background = "transparent";

  logout.addEventListener("click", async () => {
    logout.disabled = true;

    try {
      await signOut(auth);
      location.replace("../login.html");
    } catch (error) {
      console.error("ログアウトエラー:", error);
      logout.disabled = false;
      alert("ログアウトに失敗しました。再度お試しください。");
    }
  });

  sidebar.append(logout);
}

async function startLayout() {
  const role = document.body.dataset.role;

  if (role !== "student" && role !== "admin") {
    document.body.innerHTML =
      "<main class='auth-error'><h1>ページ設定エラー</h1><p>data-role に student または admin を指定してください。</p></main>";
    return;
  }

  const result = await requireRole(role, {
    allowMaintenance: role === "admin"
  });

  if (!result) return;

  renderSidebar(role);

  const nameElement = document.querySelector("#currentUserName");

  if (nameElement) {
    nameElement.textContent =
      result.profile.displayName ||
      result.user.displayName ||
      result.user.email ||
      "ユーザー";
  }

  const footer = document.querySelector(".app-footer");

  if (footer) {
    footer.textContent =
      "© 2026 Regular Test Preparation Worksheet Administration Office. All Rights Reserved.";
  }
}

startLayout().catch(error => {
  console.error("画面初期化エラー:", error);
});
