// assets/js/layout.js

import {
  setupSidebar,
  setupLogout
} from "./page.js";

function initializeLayout() {
  try {
    setupSidebar();
    setupLogout();
  } catch (error) {
    console.error(
      "レイアウト初期化エラー:",
      error
    );
  }
}

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeLayout,
    {
      once: true
    }
  );
} else {
  initializeLayout();
}
