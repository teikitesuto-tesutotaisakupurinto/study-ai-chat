import { requireRole, auth } from "./auth.js";
import { signOut, db, collection, query, where, orderBy, limit, getDocs } from "./firebase-module.js";

const STUDENT_GROUPS = [
  {
    heading: "学習メニュー",
    items: [
      { label: "学習ホーム", icon: "home", href: "index.html" },
      { label: "AIに質問", icon: "message", href: "question.html" },
      { label: "学習履歴", icon: "history", href: "history.html" },
      { label: "お知らせ", icon: "bell", href: "announcements.html" }
    ]
  },
  {
    heading: "アカウント",
    items: [
      { label: "アカウント設定", icon: "settings", href: "settings.html" }
    ]
  }
];

const ADMIN_GROUPS = [
  {
    heading: "運営管理",
    items: [
      { label: "管理者ホーム", icon: "home", href: "index.html" },
      { label: "ユーザー管理", icon: "users", href: "users.html" },
      { label: "お知らせ管理", icon: "bell", href: "announcements.html" },
      { label: "システムメンテナンス", icon: "wrench", href: "maintenance.html" }
    ]
  },
  {
    heading: "システム",
    items: [
      { label: "AI設定", icon: "sliders", href: "ai-settings.html" },
      { label: "操作ログ", icon: "history", href: "logs.html" },
      { label: "システム状態", icon: "monitor", href: "system.html" }
    ]
  },
  {
    heading: "アカウント",
    items: [
      { label: "管理者設定", icon: "settings", href: "settings.html" }
    ]
  }
];

const ICON_PATHS = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.1A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11h8M8 14h5"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1)"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.2a4 4 0 0 1 0 7.6"/>',
  wrench: '<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>'
};

let layoutStarted = false;

function makeElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== "") element.textContent = text;
  return element;
}

function makeIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("sidebar-icon-svg");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = ICON_PATHS[name] || ICON_PATHS.home;
  return svg;
}

function showLayoutError(message, error = null) {
  let box = document.getElementById("layoutError");
  if (!box) {
    box = makeElement("div", "layout-error");
    box.id = "layoutError";
    box.setAttribute("role", "alert");
    const main = document.querySelector("main");
    (main || document.body).prepend(box);
  }
  box.textContent = `${message}${error?.message ? ` ${error.message}` : ""}`;
}

function isMobile() {
  return window.matchMedia("(max-width: 700px)").matches;
}

function toggleSidebar() {
  if (isMobile()) {
    document.body.classList.toggle("sidebar-expanded");
  } else {
    document.body.classList.toggle("sidebar-collapsed");
  }
  updateToggleStates();
}

function updateToggleStates() {
  const expanded = isMobile()
    ? document.body.classList.contains("sidebar-expanded")
    : !document.body.classList.contains("sidebar-collapsed");
  document.querySelectorAll(".sidebar-toggle").forEach((button) => {
    button.setAttribute("aria-expanded", String(expanded));
  });
}

function bindSidebarToggle(button) {
  if (button.dataset.sidebarBound === "true") return;
  button.dataset.sidebarBound = "true";
  button.type = "button";
  button.setAttribute("aria-label", "サイドメニューを開閉");
  button.setAttribute("aria-expanded", "true");
  if (!button.firstElementChild) button.append(makeIcon("menu"));
  button.addEventListener("click", toggleSidebar);
}

function setActiveNavigation() {
  const currentFile = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".sidebar .nav-link, .sidebar .sidebar-link").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const targetFile = href.split("?")[0].split("#")[0].split("/").pop();
    const active = targetFile === currentFile;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

export function setupSidebar() {
  document.querySelectorAll(".sidebar-toggle").forEach(bindSidebarToggle);
  setActiveNavigation();
}

export function setupLogout() {
  document.querySelectorAll("[data-logout], .logout-button").forEach((button) => {
    if (button.dataset.logoutBound === "true") return;
    button.dataset.logoutBound = "true";
    button.type = "button";
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await signOut(auth);
        const nested = location.pathname.includes("/student/") || location.pathname.includes("/admin/");
        location.replace(nested ? "../login.html" : "./login.html");
      } catch (error) {
        console.error("ログアウトエラー:", error);
        button.disabled = false;
        showLayoutError("ログアウトに失敗しました。", error);
      }
    });
  });
}

function createNavigationLink(item, currentFile) {
  const link = makeElement("a", "sidebar-link");
  link.href = item.href;
  const targetFile = item.href.split("/").pop();
  if (targetFile === currentFile) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }
  link.append(makeIcon(item.icon));
  link.append(makeElement("span", "sidebar-label", item.label));
  return link;
}

function formatDate(value) {
  if (!value) return "";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(date);
}

async function renderRecentConversations(sidebar, user) {
  const section = makeElement("section", "sidebar-history");
  section.append(makeElement("h2", "sidebar-history-heading", "最近の会話"));
  const list = makeElement("div", "sidebar-history-list");
  list.id = "sidebarRecentHistory";
  list.textContent = "会話履歴はありません。";
  section.append(list);
  sidebar.append(section);

  try {
    const historyQuery = query(
      collection(db, "chatHistories"),
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc"),
      limit(3)
    );
    const snapshot = await getDocs(historyQuery);
    list.replaceChildren();
    if (snapshot.empty) {
      list.textContent = "会話履歴はありません。";
      return;
    }
    for (const item of snapshot.docs) {
      const data = item.data();
      const link = makeElement("a", "sidebar-history-link");
      link.href = `question.html?conversationId=${encodeURIComponent(item.id)}`;
      link.append(
        makeElement("span", "sidebar-history-title", data.title || data.lastQuestion || "会話"),
        makeElement("small", "sidebar-history-date", formatDate(data.updatedAt))
      );
      list.append(link);
    }
  } catch (error) {
    console.error("サイドバー履歴の取得エラー:", error);
    list.textContent = "履歴を取得できませんでした。";
  }
}

export async function renderSidebar(role, user, profile) {
  const sidebar = document.getElementById("appSidebar");
  if (!sidebar) return;
  sidebar.replaceChildren();
  sidebar.classList.add("sidebar");

  const brand = makeElement("div", "sidebar-header");
  brand.append(
    makeElement("strong", "sidebar-brand-title", "学習AIチャット"),
    makeElement("small", "sidebar-brand-subtitle", role === "admin" ? "運営管理" : "学習サポート")
  );
  sidebar.append(brand);

  const toggleRow = makeElement("div", "sidebar-toggle-row");
  const toggle = makeElement("button", "sidebar-toggle");
  bindSidebarToggle(toggle);
  toggleRow.append(toggle);
  sidebar.append(toggleRow);

  const name = makeElement(
    "div", "sidebar-user",
    profile.displayName || profile.name || user.displayName || user.email || "利用者"
  );
  sidebar.append(name);

  const groups = role === "admin" ? ADMIN_GROUPS : STUDENT_GROUPS;
  const nav = makeElement("nav", "sidebar-nav");
  nav.setAttribute("aria-label", "メインメニュー");
  const currentFile = location.pathname.split("/").pop() || "index.html";

  for (const group of groups) {
    const section = makeElement("section", "sidebar-nav-group");
    section.append(makeElement("h2", "sidebar-group-heading", group.heading));
    const links = makeElement("div", "sidebar-nav-links");
    for (const item of group.items) links.append(createNavigationLink(item, currentFile));
    section.append(links);
    nav.append(section);
  }
  sidebar.append(nav);

  if (role === "student") await renderRecentConversations(sidebar, user);

  const bottom = makeElement("div", "sidebar-bottom");
  const logout = makeElement("button", "sidebar-link logout-button");
  logout.dataset.logout = "";
  logout.append(makeIcon("logout"), makeElement("span", "sidebar-label", "ログアウト"));
  bottom.append(logout);
  sidebar.append(bottom);

  setupSidebar();
  setupLogout();
}

async function startLayout() {
  if (layoutStarted) return;
  const role = document.body.dataset.role;
  if (!role) {
    setupSidebar();
    setupLogout();
    return;
  }
  // 共通サイドバーがHTMLにあるページだけ、ここで描画する。
  // #app からページ全体を生成する旧ページは page.js がサイドバーを描画する。
  if (!document.getElementById("appSidebar")) {
    setupSidebar();
    setupLogout();
    return;
  }
  if (role !== "student" && role !== "admin") {
    showLayoutError("ページ設定エラー：data-role は student または admin にしてください。");
    document.documentElement.classList.remove("auth-pending");
    return;
  }

  layoutStarted = true;
  try {
    const result = await requireRole(role, { allowMaintenance: role === "admin" });
    if (!result) return;
    await renderSidebar(role, result.user, result.profile);
    const nameElement = document.getElementById("currentUserName");
    if (nameElement) {
      nameElement.textContent = result.profile.displayName || result.user.displayName || result.user.email || "利用者";
    }
    const footer = document.querySelector(".app-footer");
    if (footer) {
      footer.textContent = "© 2026 Regular Test Preparation Worksheet Administration Office. All Rights Reserved.";
    }
  } catch (error) {
    console.error("画面初期化エラー:", error);
    showLayoutError("画面を初期化できませんでした。", error);
  } finally {
    document.documentElement.classList.remove("auth-pending");
  }
}

if (typeof document !== "undefined") {
  if (document.body?.dataset?.role && document.getElementById("appSidebar")) {
    startLayout();
  } else {
    setupSidebar();
    setupLogout();
  }
}
