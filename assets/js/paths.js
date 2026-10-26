// assets/js/paths.js
// ページの配置に応じてリンク先を統一する。

const ROOT_FILES = new Set([
  "index.html",
  "login.html",
  "reset.html",
  "403.html",
  "404.html",
  "maintenance.html"
]);

export function getRootPath() {
  const path = window.location.pathname;

  if (
    path.includes("/student/") ||
    path.includes("/admin/")
  ) {
    return "../";
  }

  return "./";
}

export function getRootUrl(fileName) {
  const root = getRootPath();
  return `${root}${String(fileName).replace(/^\/+/, "")}`;
}

export function getCurrentPage() {
  return (
    window.location.pathname.split("/").pop() ||
    "index.html"
  );
}

export function isRootFile(fileName) {
  return ROOT_FILES.has(fileName);
}

export function navigateTo(fileName) {
  window.location.assign(getRootUrl(fileName));
}

export function replaceTo(fileName) {
  window.location.replace(getRootUrl(fileName));
}
