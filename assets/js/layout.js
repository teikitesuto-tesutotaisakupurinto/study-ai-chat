export function setupSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.querySelector(".sidebar-toggle");
  const overlay = document.querySelector(".sidebar-overlay");

  if (!sidebar || !toggle) return;

  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");

    const collapsed =
      sidebar.classList.contains("collapsed");

    localStorage.setItem(
      "study_sidebar_collapsed",
      collapsed ? "1" : "0"
    );
  });

  const saved =
    localStorage.getItem("study_sidebar_collapsed");

  if (saved === "1") {
    sidebar.classList.add("collapsed");
  }

  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("mobile-open");
    });
  }

  document.querySelectorAll(".nav-link").forEach((link) => {
    const current =
      location.pathname.replace(/\/+$/, "");

    const target =
      new URL(link.href).pathname.replace(/\/+$/, "");

    if (current === target) {
      link.classList.add("active");
    }
  });
}

export function setupLogout(auth, signOut) {
  const buttons =
    document.querySelectorAll("[data-logout]");

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      await signOut(auth);
      location.replace("/study-ai-chat/login.html");
    });
  });
}
