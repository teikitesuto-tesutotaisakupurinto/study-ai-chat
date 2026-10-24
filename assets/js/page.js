// assets/js/page.js

import {
  auth,
  db,
  requireRole
} from "./auth.js";

export {
  auth,
  db
};

export async function initPage(
  requiredRole,
  options = {}
) {
  const result = await requireRole(
    requiredRole,
    options
  );

  if (!result) {
    return null;
  }

  document.documentElement.classList.remove(
    "auth-pending"
  );

  return result;
}

export async function getPageUser(
  requiredRole,
  options = {}
) {
  const result = await initPage(
    requiredRole,
    options
  );

  return result?.user || null;
}

export async function getPageProfile(
  requiredRole,
  options = {}
) {
  const result = await initPage(
    requiredRole,
    options
  );

  return result?.profile || null;
}

export function showPageError(
  message,
  detail = ""
) {
  let box = document.getElementById(
    "pageError"
  );

  if (!box) {
    box = document.createElement("div");

    box.id = "pageError";
    box.className = "page-error";

    const main =
      document.querySelector("main") ||
      document.body;

    main.prepend(box);
  }

  box.replaceChildren();

  const messageElement =
    document.createElement("p");

  messageElement.textContent = message;

  box.append(messageElement);

  if (detail) {
    const detailElement =
      document.createElement("pre");

    detailElement.textContent = detail;

    box.append(detailElement);
  }
}

export function clearPageError() {
  const box =
    document.getElementById("pageError");

  if (box) {
    box.remove();
  }
}

export function formatFirestoreDate(
  value
) {
  if (!value) return "";

  let date;

  if (
    typeof value.toDate === "function"
  ) {
    date = value.toDate();
  } else {
    date = new Date(value);
  }

  if (
    Number.isNaN(date.getTime())
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}
