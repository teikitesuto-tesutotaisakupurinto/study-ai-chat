// assets/js/paths.js
(function () {
  "use strict";

  const pathname = window.location.pathname;
  const knownFolders = ["/student/", "/admin/", "/assets/"];
  let basePath = "";

  for (const folder of knownFolders) {
    const position = pathname.indexOf(folder);
    if (position >= 0) {
      basePath = pathname.slice(0, position);
      break;
    }
  }

  if (!basePath) {
    const fileMatch = pathname.match(/^(.*\/)(?:index|login|reset|maintenance|403|404)\.html$/);
    if (fileMatch) {
      basePath = fileMatch[1].replace(/\/$/, "");
    } else if (pathname.endsWith("/")) {
      basePath = pathname.replace(/\/$/, "");
    } else {
      basePath = pathname.substring(0, pathname.lastIndexOf("/"));
    }
  }

  function appUrl(path) {
    const cleanPath = String(path || "")
      .replace(/^\/+/, "")
      .replace(/\\/g, "/");

    return (basePath || "") + "/" + cleanPath;
  }

  window.AppPaths = {
    base: basePath,
    url: appUrl,
    login: appUrl("login.html"),
    home: appUrl("index.html"),
    student: appUrl("student/index.html"),
    admin: appUrl("admin/index.html"),
    notFound: appUrl("404.html"),
    forbidden: appUrl("403.html")
  };
})();
