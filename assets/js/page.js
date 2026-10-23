
/* =========================================================
   学習AIチャット - ページ機能
   File: assets/js/page.js
   ========================================================= */

(() => {
  "use strict";

  const db = window.db;
  const auth = window.auth;
  const paths = window.AppPaths || {};
  const AI_ENDPOINT =
    "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";

  const AI_PUBLIC_KEY =
    "sb_publishable_j6QpWj-1v86qkWHmXM8F3Q_Ieipaa3q";

  const SUBJECTS = [
    "国語", "数学", "英語", "理科", "社会",
    "音楽", "美術", "保健体育", "技術家庭"
  ];

  const NON_STUDY_MESSAGE =
    "このAIは学習専用です。学習以外の質問はできません。";

  let currentUser = null;
  let currentProfile = null;
  let busy = false;
  let currentConversationId = null;

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function formatDate(value) {
    if (!value) return "日時不明";

    const date = value?.toDate
      ? value.toDate()
      : new Date(value);

    if (Number.isNaN(date.getTime())) return "日時不明";

    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function showMessage(message, type = "info") {
    let box = $("#app-message");

    if (!box) {
      box = document.createElement("div");
      box.id = "app-message";
      box.setAttribute("role", "status");
      box.style.cssText =
        "position:sticky;top:0;z-index:1000;padding:12px 16px;" +
        "margin:12px 0;border-radius:8px;white-space:pre-wrap;";
      const main = $("main") || $("#page-content") || document.body;
      main.prepend(box);
    }

    box.textContent = message;
    box.style.background =
      type === "error" ? "#fee2e2" :
      type === "success" ? "#dcfce7" : "#e0f2fe";
    box.style.color =
      type === "error" ? "#991b1b" :
      type === "success" ? "#166534" : "#075985";

    if (type === "success") {
      setTimeout(() => {
        if (box.textContent === message) box.textContent = "";
      }, 3500);
    }
  }

  function setBusy(value) {
    busy = value;
    $$("button, input[type=submit]").forEach(button => {
      if (button.dataset.keepEnabled === "true") return;
      button.disabled = value;
    });
  }

  function getBaseContent() {
    return $("#page-content") || $("main") || $("#app");
  }

  function renderShell(title, subtitle = "") {
    const main = getBaseContent();

    if (!main) {
      throw new Error(
        "HTMLに #page-content、main、または #app がありません。"
      );
    }

    main.innerHTML = `
      <section class="page-heading">
        <h1>${escapeHtml(title)}</h1>
        ${subtitle
          ? `<p>${escapeHtml(subtitle)}</p>`
          : ""}
      </section>
      <div id="page-body"></div>
    `;

    return $("#page-body", main);
  }

  function requireDatabase() {
    if (!db) {
      throw new Error(
        "Firestoreが初期化されていません。firebase.jsを確認してください。"
      );
    }
    return db;
  }

  function userId() {
    return currentUser?.uid || "";
  }

  function isAdmin() {
    return currentProfile?.role === "admin" &&
      currentProfile?.status === "active";
  }

  function requireAdmin() {
    if (!isAdmin()) {
      throw new Error("この操作には有効な管理者権限が必要です。");
    }
  }

  function requireStudent() {
    if (
      !currentUser ||
      currentProfile?.role !== "student" ||
      currentProfile?.status !== "active"
    ) {
      throw new Error("有効な生徒アカウントでログインしてください。");
    }
  }

  async function addAudit(action, details = {}) {
    if (!currentUser || !db) return;

    try {
      await db.collection("auditLogs").add({
        actorUid: currentUser.uid,
        actorEmail: currentUser.email || "",
        actorRole: currentProfile?.role || "unknown",
        action,
        details,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error("監査ログの保存に失敗:", error);
    }
  }

  async function getDocument(collection, id) {
    const snapshot = await requireDatabase()
      .collection(collection).doc(id).get();

    return snapshot.exists
      ? { id: snapshot.id, ...snapshot.data() }
      : null;
  }

  async function getCollection(collection, limit = 100) {
    const snapshot = await requireDatabase()
      .collection(collection)
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  function renderTable(headers, rows) {
    if (!rows.length) {
      return `<p class="empty-state">表示できるデータはありません。</p>`;
    }

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${headers.map(h =>
              `<th>${escapeHtml(h)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>${row.map(cell =>
                `<td>${cell ?? ""}</td>`).join("")}</tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function makeButton(label, action, id, style = "") {
    return `
      <button type="button"
        class="btn ${escapeHtml(style)}"
        data-action="${escapeHtml(action)}"
        data-id="${escapeHtml(id)}">
        ${escapeHtml(label)}
      </button>
    `;
  }

  /* ---------------------------------------------------------
     生徒ホーム
     --------------------------------------------------------- */

  async function renderHome() {
    const body = renderShell(
      "学習AIチャット",
      "学習内容について質問し、理解を深めましょう。"
    );

    body.innerHTML = `
      <section class="panel">
        <h2>学習を始める</h2>
        <p>学習したい教科を選択してください。</p>
        <div class="subject-grid">
          ${SUBJECTS.map(subject => `
            <button class="subject-button"
              type="button"
              data-subject="${escapeHtml(subject)}">
              ${escapeHtml(subject)}
            </button>
          `).join("")}
        </div>
      </section>
      <section class="panel">
        <h2>お知らせ</h2>
        <div id="home-announcements">読み込み中...</div>
      </section>
    `;

    $$("[data-subject]", body).forEach(button => {
      button.addEventListener("click", () => {
        const subject = button.dataset.subject;
        sessionStorage.setItem("studychat-subject", subject);
        location.href = paths.studentQuestion || "question.html";
      });
    });

    await loadPublishedAnnouncements($("#home-announcements", body));
  }

  /* ---------------------------------------------------------
     AI質問画面
     --------------------------------------------------------- */

  async function renderQuestion() {
    requireStudent();

    const body = renderShell(
      "AIに質問",
      "教科を選択し、学校の学習内容について質問してください。"
    );

    const savedSubject =
      sessionStorage.getItem("studychat-subject") || "数学";

    body.innerHTML = `
      <section class="panel chat-panel">
        <label for="chat-subject">教科</label>
        <select id="chat-subject">
          ${SUBJECTS.map(subject => `
            <option value="${escapeHtml(subject)}"
              ${subject === savedSubject ? "selected" : ""}>
              ${escapeHtml(subject)}
            </option>
          `).join("")}
        </select>

        <div id="chat-messages"
          class="chat-messages"
          aria-live="polite">
          <p class="empty-state">
            学習内容について質問してください。
          </p>
        </div>

        <form id="chat-form">
          <label for="chat-input">質問内容</label>
          <textarea id="chat-input"
            maxlength="4000"
            rows="4"
            required
            placeholder="例：一次方程式の解き方を教えてください"></textarea>

          <div class="form-actions">
            <button type="submit" id="chat-send">質問する</button>
            <button type="button" id="chat-new">新しい会話</button>
          </div>
        </form>
      </section>
    `;

    $("#chat-form", body).addEventListener("submit", sendQuestion);
    $("#chat-new", body).addEventListener("click", () => {
      currentConversationId = null;
      $("#chat-messages", body).innerHTML =
        '<p class="empty-state">新しい会話を開始しました。</p>';
    });
  }

  function appendChatMessage(role, text) {
    const list = $("#chat-messages");
    if (!list) return;

    const empty = $(".empty-state", list);
    if (empty) empty.remove();

    const item = document.createElement("article");
    item.className = `chat-message chat-${role}`;

    const title = document.createElement("strong");
    title.textContent = role === "user" ? "あなた" : "AI";

    const content = document.createElement("p");
    content.textContent = text;

    item.append(title, content);
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
  }

  async function sendQuestion(event) {
    event.preventDefault();
    if (busy) return;

    try {
      requireStudent();

      const subject = $("#chat-subject")?.value;
      const input = $("#chat-input");
      const question = input?.value.trim();

      if (!SUBJECTS.includes(subject)) {
        throw new Error("有効な教科を選択してください。");
      }

      if (!question) {
        throw new Error("質問内容を入力してください。");
      }

      if (question.length > 4000) {
        throw new Error("質問は4000文字以内で入力してください。");
      }

      setBusy(true);
      input.value = "";
      appendChatMessage("user", question);

      const sendButton = $("#chat-send");
      if (sendButton) sendButton.textContent = "回答を生成中...";

      let answer = "";

      try {
        const response = await fetch(AI_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": AI_PUBLIC_KEY,
            "Authorization": `Bearer ${AI_PUBLIC_KEY}`
          },
          body: JSON.stringify({
            subject,
            question,
            userId: userId(),
            conversationId: currentConversationId
          })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error || data.message ||
            `AIサーバーエラー (${response.status})`
          );
        }

        answer =
          data.answer ||
          data.reply ||
          data.message ||
          data.output ||
          "";

        currentConversationId =
          data.conversationId || currentConversationId;

        if (typeof answer !== "string" || !answer.trim()) {
          throw new Error(
            "AIサーバーから回答が返されませんでした。"
          );
        }
      } catch (error) {
        console.error("AI request failed:", error);
        answer =
          "回答を取得できませんでした。AI接続設定とサーバーログを確認してください。";
        showMessage(error.message, "error");
      }

      appendChatMessage("assistant", answer);

      await saveChatHistory({
        subject,
        question,
        answer,
        conversationId: currentConversationId
      });

      await addAudit("chat.question", {
        subject,
        questionLength: question.length
      });
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
      const sendButton = $("#chat-send");
      if (sendButton) sendButton.textContent = "質問する";
    }
  }

  async function saveChatHistory(item) {
    requireStudent();

    try {
      await requireDatabase().collection("chatHistories").add({
        uid: userId(),
        subject: item.subject,
        question: item.question,
        answer: item.answer,
        conversationId: item.conversationId || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error("履歴保存エラー:", error);
      showMessage(
        "回答は表示されましたが、履歴を保存できませんでした。",
        "error"
      );
    }
  }

  /* ---------------------------------------------------------
     生徒：履歴
     --------------------------------------------------------- */

  async function renderHistory() {
    requireStudent();

    const body = renderShell(
      "学習履歴",
      "過去に質問した内容を確認できます。"
    );

    body.innerHTML = `<p>履歴を読み込んでいます...</p>`;

    const snapshot = await requireDatabase()
      .collection("chatHistories")
      .where("uid", "==", userId())
      .limit(100)
      .get();

    const records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).sort((a, b) => {
      const at = a.createdAt?.toMillis?.() || 0;
      const bt = b.createdAt?.toMillis?.() || 0;
      return bt - at;
    });

    if (!records.length) {
      body.innerHTML =
        `<p class="empty-state">まだ学習履歴はありません。</p>`;
      return;
    }

    body.innerHTML = `
      <div class="history-list">
        ${records.map(record => `
          <article class="panel history-item">
            <div class="history-meta">
              <strong>${escapeHtml(record.subject || "教科未設定")}</strong>
              <time>${escapeHtml(formatDate(record.createdAt))}</time>
            </div>
            <h3>質問</h3>
            <p>${escapeHtml(record.question)}</p>
            <details>
              <summary>AIの回答を表示</summary>
              <p class="preserve-lines">${escapeHtml(record.answer)}</p>
            </details>
            <div class="form-actions">
              ${makeButton("この履歴を削除", "delete-history", record.id, "danger")}
            </div>
          </article>
        `).join("")}
      </div>
    `;

    body.addEventListener("click", async event => {
      const button = event.target.closest("[data-action='delete-history']");
      if (!button) return;

      if (!confirm("この学習履歴を削除しますか？")) return;

      try {
        const ref = requireDatabase()
          .collection("chatHistories").doc(button.dataset.id);

        const snapshot = await ref.get();

        if (!snapshot.exists || snapshot.data().uid !== userId()) {
          throw new Error("削除対象を確認できません。");
        }

        await ref.delete();
        await addAudit("chatHistory.delete", {
          historyId: button.dataset.id
        });

        showMessage("学習履歴を削除しました。", "success");
        await renderHistory();
      } catch (error) {
        showMessage(error.message, "error");
      }
    });
  }

  /* ---------------------------------------------------------
     お知らせ：生徒側
     --------------------------------------------------------- */

  async function loadPublishedAnnouncements(container) {
    if (!container) return;

    try {
      const items = await getCollection("announcements", 100);

      const published = items
        .filter(item =>
          item.status === "published" ||
          item.published === true
        )
        .sort((a, b) => {
          const at = a.createdAt?.toMillis?.() || 0;
          const bt = b.createdAt?.toMillis?.() || 0;
          return bt - at;
        });

      container.innerHTML = published.length
        ? published.map(item => `
          <article class="announcement-item">
            <h3>${escapeHtml(item.title || "お知らせ")}</h3>
            <p class="preserve-lines">${escapeHtml(item.body || item.content || "")}</p>
            <time>${escapeHtml(formatDate(item.createdAt))}</time>
          </article>
        `).join("")
        : `<p class="empty-state">現在、お知らせはありません。</p>`;
    } catch (error) {
      console.error(error);
      container.textContent = "お知らせを読み込めませんでした。";
    }
  }

  async function renderAnnouncements() {
    const body = renderShell("お知らせ", "運営からのお知らせ");

    body.innerHTML = `<div id="announcement-list">読み込み中...</div>`;
    await loadPublishedAnnouncements($("#announcement-list", body));

    if (isAdmin()) {
      await renderAdminAnnouncementControls(body);
    }
  }

  /* ---------------------------------------------------------
     管理者：お知らせ管理
     --------------------------------------------------------- */

  async function renderAdminAnnouncementControls(body) {
    requireAdmin();

    const form = document.createElement("section");
    form.className = "panel";
    form.innerHTML = `
      <h2>お知らせを作成</h2>
      <form id="announcement-form">
        <label for="announcement-title">タイトル</label>
        <input id="announcement-title" maxlength="120" required>

        <label for="announcement-body">本文</label>
        <textarea id="announcement-body" maxlength="10000"
          rows="5" required></textarea>

        <label for="announcement-status">公開状態</label>
        <select id="announcement-status">
          <option value="draft">下書き</option>
          <option value="published">公開</option>
        </select>

        <button type="submit">お知らせを保存</button>
      </form>
      <h2>登録済みのお知らせ</h2>
      <div id="admin-announcement-list">読み込み中...</div>
    `;

    body.prepend(form);

    $("#announcement-form", form).addEventListener("submit", async event => {
      event.preventDefault();

      try {
        requireAdmin();

        const title = $("#announcement-title").value.trim();
        const content = $("#announcement-body").value.trim();
        const status = $("#announcement-status").value;

        if (!title || !content) {
          throw new Error("タイトルと本文を入力してください。");
        }

        await requireDatabase().collection("announcements").add({
          title,
          body: content,
          status,
          published: status === "published",
          createdBy: userId(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await addAudit("announcement.create", { title, status });

        showMessage("お知らせを保存しました。", "success");
        $("#announcement-form").reset();
        await renderAnnouncements();
      } catch (error) {
        showMessage(error.message, "error");
      }
    });

    await refreshAdminAnnouncementList();
  }

  async function refreshAdminAnnouncementList() {
    const container = $("#admin-announcement-list");
    if (!container) return;

    requireAdmin();

    const items = await getCollection("announcements", 100);

    container.innerHTML = items.length
      ? items.map(item => `
        <article class="announcement-item">
          <h3>${escapeHtml(item.title || "無題")}</h3>
          <p>${escapeHtml(item.status || "状態未設定")}</p>
          ${makeButton("公開状態を切替", "toggle-announcement", item.id)}
          ${makeButton("削除", "delete-announcement", item.id, "danger")}
        </article>
      `).join("")
      : `<p>お知らせはまだありません。</p>`;

    container.onclick = async event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      try {
        requireAdmin();

        const ref = requireDatabase()
          .collection("announcements").doc(button.dataset.id);
        const snapshot = await ref.get();

        if (!snapshot.exists) {
          throw new Error("お知らせが見つかりません。");
        }

        const item = snapshot.data();

        if (button.dataset.action === "delete-announcement") {
          if (!confirm("このお知らせを削除しますか？")) return;
          await ref.delete();
          await addAudit("announcement.delete", {
            announcementId: button.dataset.id
          });
        }

        if (button.dataset.action === "toggle-announcement") {
          const nextStatus =
            item.status === "published" || item.published === true
              ? "draft"
              : "published";

          await ref.update({
            status: nextStatus,
            published: nextStatus === "published",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          await addAudit("announcement.status", {
            announcementId: button.dataset.id,
            status: nextStatus
          });
        }

        await renderAnnouncements();
        showMessage("お知らせを更新しました。", "success");
      } catch (error) {
        showMessage(error.message, "error");
      }
    };
  }

  /* ---------------------------------------------------------
     管理者：ダッシュボード
     --------------------------------------------------------- */

  async function renderAdminDashboard() {
    requireAdmin();

    const body = renderShell(
      "管理者ダッシュボード",
      "学習AIチャットの運営状況"
    );

    body.innerHTML = `<p>システム情報を読み込んでいます...</p>`;

    const [users, announcements, histories] = await Promise.all([
      getCollection("users", 500),
      getCollection("announcements", 500),
      getCollection("chatHistories", 500)
    ]);

    body.innerHTML = `
      <div class="stats-grid">
        <article class="panel stat-card">
          <h2>登録ユーザー</h2>
          <p class="stat-number">${users.length}</p>
        </article>
        <article class="panel stat-card">
          <h2>生徒アカウント</h2>
          <p class="stat-number">${users.filter(x => x.role === "student").length}</p>
        </article>
        <article class="panel stat-card">
          <h2>公開中のお知らせ</h2>
          <p class="stat-number">${announcements.filter(x =>
            x.status === "published" || x.published === true
          ).length}</p>
        </article>
        <article class="panel stat-card">
          <h2>取得できた学習履歴</h2>
          <p class="stat-number">${histories.length}</p>
        </article>
      </div>
      <section class="panel">
        <h2>管理者メニュー</h2>
        <p><a href="${escapeHtml(paths.adminUsers || "users.html")}">ユーザー管理</a></p>
        <p><a href="${escapeHtml(paths.adminAnnouncements || "announcements.html")}">お知らせ管理</a></p>
        <p><a href="${escapeHtml(paths.adminMaintenance || "maintenance.html")}">メンテナンス設定</a></p>
        <p><a href="${escapeHtml(paths.adminAISettings || "ai-settings.html")}">AI設定</a></p>
        <p><a href="${escapeHtml(paths.adminLogs || "logs.html")}">監査ログ</a></p>
      </section>
    `;
  }

  /* ---------------------------------------------------------
     管理者：ユーザー管理
     注意：ここからFirebase Authのアカウント自体を作成・削除はしない。
     --------------------------------------------------------- */

  async function renderUsers() {
    requireAdmin();

    const body = renderShell(
      "ユーザー管理",
      "ユーザープロフィールと利用状態を管理します。"
    );

    body.innerHTML = `
      <section class="panel">
        <p>
          新規アカウントの作成とパスワード管理は、
          Firebase Authenticationまたは安全なサーバー側処理で行います。
        </p>
        <div id="users-table">読み込み中...</div>
      </section>
    `;

    const users = await getCollection("users", 500);
    const table = $("#users-table", body);

    table.innerHTML = renderTable(
      ["UID", "名前", "メール", "権限", "状態", "操作"],
      users.map(user => [
        escapeHtml(user.id),
        escapeHtml(user.displayName || user.name || "未設定"),
        escapeHtml(user.email || ""),
        escapeHtml(user.role || "未設定"),
        escapeHtml(user.status || "未設定"),
        user.id === userId()
          ? "自分自身"
          : `
            <select data-user-role="${escapeHtml(user.id)}">
              <option value="student" ${user.role === "student" ? "selected" : ""}>生徒</option>
              <option value="admin" ${user.role === "admin" ? "selected" : ""}>管理者</option>
            </select>
            <select data-user-status="${escapeHtml(user.id)}">
              <option value="active" ${user.status === "active" ? "selected" : ""}>有効</option>
              <option value="disabled" ${user.status === "disabled" ? "selected" : ""}>停止</option>
            </select>
            ${makeButton("保存", "save-user", user.id)}
          `
      ])
    );

    table.addEventListener("click", async event => {
      const button = event.target.closest("[data-action='save-user']");
      if (!button) return;

      try {
        requireAdmin();

        const id = button.dataset.id;
        if (id === userId()) {
          throw new Error("自分自身の権限・状態はここから変更できません。");
        }

        const roleSelect = $(`[data-user-role="${CSS.escape(id)}"]`, table);
        const statusSelect = $(`[data-user-status="${CSS.escape(id)}"]`, table);

        if (!roleSelect || !statusSelect) {
          throw new Error("変更項目を取得できません。");
        }

        const role = roleSelect.value;
        const status = statusSelect.value;

        if (!["student", "admin"].includes(role)) {
          throw new Error("不正な権限です。");
        }

        if (!["active", "disabled"].includes(status)) {
          throw new Error("不正な状態です。");
        }

        /*
         * Firestore Rules側でも管理者権限を検証すること。
         * 重要な権限変更は、custom claims等を更新する
         * 信頼できるサーバー側処理と併用する。
         */
        await requireDatabase().collection("users").doc(id).update({
          role,
          status,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await addAudit("user.update", { targetUid: id, role, status });

        showMessage("ユーザー情報を保存しました。", "success");
        await renderUsers();
      } catch (error) {
        showMessage(error.message, "error");
      }
    });
  }

  /* ---------------------------------------------------------
     管理者：メンテナンス設定
     --------------------------------------------------------- */

  async function renderMaintenance() {
    requireAdmin();

    const body = renderShell(
      "メンテナンス設定",
      "サービス全体の利用状態を管理します。"
    );

    body.innerHTML = `<p>設定を読み込んでいます...</p>`;

    const ref = requireDatabase().collection("maintenance").doc("global");
    const snapshot = await ref.get();
    const config = snapshot.exists ? snapshot.data() : {};

    body.innerHTML = `
      <section class="panel">
        <form id="maintenance-form">
          <label>
            <input type="checkbox" id="maintenance-enabled"
              ${config.enabled ? "checked" : ""}>
            メンテナンスモードを有効にする
          </label>

          <label for="maintenance-message">表示メッセージ</label>
          <textarea id="maintenance-message" maxlength="1000"
            rows="4">${escapeHtml(config.message || "現在メンテナンス中です。")}</textarea>

          <button type="submit">設定を保存</button>
        </form>
      </section>
    `;

    $("#maintenance-form", body).addEventListener("submit", async event => {
      event.preventDefault();

      try {
        requireAdmin();

        const enabled = $("#maintenance-enabled").checked;
        const message = $("#maintenance-message").value.trim();

        await ref.set({
          enabled,
          message,
          updatedBy: userId(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await addAudit("maintenance.update", { enabled });

        showMessage("メンテナンス設定を保存しました。", "success");
      } catch (error) {
        showMessage(error.message, "error");
      }
    });
  }

  /* ---------------------------------------------------------
     管理者：AI設定
     クライアントから秘密鍵やサーバー用キーを変更させない。
     --------------------------------------------------------- */

  async function renderAISettings() {
    requireAdmin();

    const body = renderShell(
      "AI設定",
      "AIの利用可否と学習用の案内を管理します。"
    );

    const ref = requireDatabase().collection("settings").doc("ai");
    const snapshot = await ref.get();
    const config = snapshot.exists ? snapshot.data() : {};

    body.innerHTML = `
      <section class="panel">
        <form id="ai-settings-form">
          <label>
            <input type="checkbox" id="ai-enabled"
              ${config.enabled !== false ? "checked" : ""}>
            AI質問機能を有効にする
          </label>

          <label for="ai-notice">AI利用時の案内</label>
          <textarea id="ai-notice" maxlength="2000" rows="4">${escapeHtml(
            config.notice || "教科の学習内容について質問してください。"
          )}</textarea>

          <button type="submit">設定を保存</button>
        </form>

        <p>
          AIモデル名、API秘密鍵、利用制限などのサーバー側設定は、
          Supabase Edge Functionの環境変数で管理してください。
        </p>
      </section>
    `;

    $("#ai-settings-form", body).addEventListener("submit", async event => {
      event.preventDefault();

      try {
        requireAdmin();

        const enabled = $("#ai-enabled").checked;
        const notice = $("#ai-notice").value.trim();

        await ref.set({
          enabled,
          notice,
          updatedBy: userId(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await addAudit("aiSettings.update", { enabled });

        showMessage("AI設定を保存しました。", "success");
      } catch (error) {
        showMessage(error.message, "error");
      }
    });
  }

  /* ---------------------------------------------------------
     管理者：監査ログ
     --------------------------------------------------------- */

  async function renderLogs() {
    requireAdmin();

    const body = renderShell(
      "監査ログ",
      "管理操作や重要なイベントの記録"
    );

    body.innerHTML = `<p>ログを読み込んでいます...</p>`;

    const logs = await getCollection("auditLogs", 200);

    logs.sort((a, b) => {
      const at = a.createdAt?.toMillis?.() || 0;
      const bt = b.createdAt?.toMillis?.() || 0;
      return bt - at;
    });

    body.innerHTML = renderTable(
      ["日時", "実行者", "権限", "操作", "詳細"],
      logs.map(log => [
        escapeHtml(formatDate(log.createdAt)),
        escapeHtml(log.actorEmail || log.actorUid || ""),
        escapeHtml(log.actorRole || ""),
        escapeHtml(log.action || ""),
        escapeHtml(JSON.stringify(log.details || {}))
      ])
    );
  }

  /* ---------------------------------------------------------
     管理者：システム状態
     --------------------------------------------------------- */

  async function renderSystem() {
    requireAdmin();

    const body = renderShell(
      "システム状態",
      "接続先の初期化状態とサービス設定"
    );

    let firestoreState = "未確認";
    let maintenanceState = "未確認";
    let aiState = "未確認";

    try {
      await requireDatabase().collection("systemStatus")
        .doc("health").get();
      firestoreState = "接続できました";
    } catch (error) {
      firestoreState = "接続エラー";
    }

    try {
      const snapshot = await requireDatabase()
        .collection("maintenance").doc("global").get();

      maintenanceState = snapshot.exists && snapshot.data().enabled
        ? "メンテナンス中"
        : "通常運用";
    } catch (error) {
      maintenanceState = "取得エラー";
    }

    try {
      const snapshot = await requireDatabase()
        .collection("settings").doc("ai").get();

      aiState = snapshot.exists && snapshot.data().enabled === false
        ? "停止中"
        : "有効設定";
    } catch (error) {
      aiState = "取得エラー";
    }

    body.innerHTML = renderTable(
      ["項目", "状態"],
      [
        ["Firebase Authentication", auth ? "初期化済み" : "未初期化"],
        ["Cloud Firestore", firestoreState],
        ["メンテナンス設定", maintenanceState],
        ["AI設定", aiState],
        ["現在のユーザー", escapeHtml(currentUser?.email || userId())],
        ["現在の権限", escapeHtml(currentProfile?.role || "不明")]
      ]
    );
  }

  /* ---------------------------------------------------------
     設定画面
     --------------------------------------------------------- */

  async function renderSettings() {
    const admin = isAdmin();

    const body = renderShell(
      admin ? "管理者設定" : "アカウント設定",
      "ログイン中のアカウント情報"
    );

    body.innerHTML = `
      <section class="panel">
        <h2>アカウント情報</h2>
        <p>メールアドレス：${escapeHtml(currentUser?.email || "未設定")}</p>
        <p>表示名：${escapeHtml(
          currentProfile?.displayName ||
          currentProfile?.name ||
          currentUser?.displayName ||
          "未設定"
        )}</p>
        <p>権限：${escapeHtml(currentProfile?.role || "未設定")}</p>
        <p>利用状態：${escapeHtml(currentProfile?.status || "未設定")}</p>
        <button type="button" id="reset-password-button">
          パスワード再設定メールを送信
        </button>
      </section>
    `;

    $("#reset-password-button", body).addEventListener("click", async () => {
      try {
        if (!currentUser?.email) {
          throw new Error("ログイン中のメールアドレスを取得できません。");
        }

        await auth.sendPasswordResetEmail(currentUser.email);
        showMessage(
          "パスワード再設定メールを送信しました。",
          "success"
        );
      } catch (error) {
        showMessage(error.message, "error");
      }
    });
  }

  /* ---------------------------------------------------------
     メンテナンス確認
     --------------------------------------------------------- */

  async function checkMaintenance() {
    if (!db || !currentUser) return;

    try {
      const snapshot = await db.collection("maintenance")
        .doc("global").get();

      if (!snapshot.exists) return;

      const config = snapshot.data();
      if (!config.enabled || isAdmin()) return;

      const body = getBaseContent();
      if (!body) return;

      body.innerHTML = `
        <section class="panel maintenance-panel">
          <h1>メンテナンス中</h1>
          <p>${escapeHtml(
            config.message || "現在メンテナンス中です。"
          )}</p>
        </section>
      `;
    } catch (error) {
      console.error("メンテナンス状態の確認に失敗:", error);
    }
  }

  /* ---------------------------------------------------------
     ページ起動
     --------------------------------------------------------- */

  async function initPage() {
    try {
      if (!window.requireAuth) {
        throw new Error(
          "auth.jsのrequireAuthが見つかりません。読み込み順を確認してください。"
        );
      }

      const role = document.body.dataset.role || "student";
      const page = document.body.dataset.page || "home";

      const result = await window.requireAuth(role);

      if (result?.user) currentUser = result.user;
      if (result?.profile) currentProfile = result.profile;

      if (!currentUser) {
        currentUser = auth?.currentUser || null;
      }

      if (!currentProfile && currentUser && db) {
        const snapshot = await db.collection("users")
          .doc(currentUser.uid).get();

        currentProfile = snapshot.exists ? snapshot.data() : null;
      }

      if (!currentUser || !currentProfile) {
        throw new Error(
          "アカウント情報が見つかりません。管理者に登録状態を確認してください。"
        );
      }

      if (currentProfile.status !== "active") {
        throw new Error("このアカウントは現在利用できません。");
      }

      if (role === "admin" && !isAdmin()) {
        location.replace(paths.forbidden || "../403.html");
        return;
      }

      if (role === "student" && currentProfile.role !== "student") {
        location.replace(paths.forbidden || "../403.html");
        return;
      }

      if (!isAdmin()) {
        await checkMaintenance();
      }

      const renderers = {
        home: role === "admin" ? renderAdminDashboard : renderHome,
        dashboard: renderAdminDashboard,
        question: renderQuestion,
        history: renderHistory,
        announcements: renderAnnouncements,
        settings: renderSettings,
        users: renderUsers,
        maintenance: renderMaintenance,
        "ai-settings": renderAISettings,
        logs: renderLogs,
        system: renderSystem
      };

      const render = renderers[page];

      if (!render) {
        renderShell("ページが見つかりません");
        showMessage(`未対応のページです: ${page}`, "error");
        return;
      }

      await render();
    } catch (error) {
      console.error("ページ初期化エラー:", error);
      showMessage(error.message || "ページを読み込めませんでした。", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", initPage);
})();
