// assets/js/page.js
(function () {
  "use strict";

  const $ = function (selector) {
    return document.querySelector(selector);
  };

  function showMessage(message, type) {
    const target = $("#pageMessage");
    if (!target) return;

    target.className = "notice " + (type || "info");
    target.textContent = message;
    target.hidden = false;
  }

  function escape(value) {
    return window.escapeHtml(value);
  }

  async function getCollection(collectionName) {
    const result = await window.db
      .collection(collectionName)
      .limit(100)
      .get();

    return result.docs.map(function (doc) {
      return { id: doc.id, ...doc.data() };
    });
  }

  function renderRows(items, fields) {
    if (!items.length) {
      return `<p class="empty-state">表示できるデータはありません。</p>`;
    }

    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            ${fields.map(function (field) {
              return `<th>${escape(field.label)}</th>`;
            }).join("")}
          </tr></thead>
          <tbody>
            ${items.map(function (item) {
              return `<tr>${fields.map(function (field) {
                return `<td>${escape(item[field.key] ?? "—")}</td>`;
              }).join("")}</tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function loadAnnouncements() {
    const target = $("#announcementList");
    if (!target) return;

    try {
      const items = await getCollection("announcements");
      items.sort(function (a, b) {
        const dateA = a.createdAt && a.createdAt.toMillis
          ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt && b.createdAt.toMillis
          ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });

      target.innerHTML = items.map(function (item) {
        return `
          <article class="content-card">
            <h3>${escape(item.title || "お知らせ")}</h3>
            <p class="muted">${escape(item.createdAt?.toDate
              ? item.createdAt.toDate().toLocaleString("ja-JP")
              : "")}</p>
            <p class="preserve-lines">${escape(item.body || item.content || "")}</p>
          </article>
        `;
      }).join("") || '<p class="empty-state">お知らせはありません。</p>';
    } catch (error) {
      console.error(error);
      target.textContent = "お知らせを取得できませんでした。";
    }
  }

  async function loadHistory() {
    const target = $("#historyList");
    if (!target) return;

    try {
      const user = window.authState.user;
      const result = await window.db.collection("chatHistories")
        .where("userId", "==", user.uid)
        .limit(100)
        .get();

      const items = result.docs.map(function (doc) {
        return { id: doc.id, ...doc.data() };
      });

      target.innerHTML = renderRows(items, [
        { key: "subject", label: "教科" },
        { key: "question", label: "質問" },
        { key: "createdAt", label: "日時" }
      ]);
    } catch (error) {
      console.error(error);
      target.textContent =
        "履歴を取得できませんでした。Firestoreのルールを確認してください。";
    }
  }

  async function loadUsers() {
    const target = $("#usersList");
    if (!target) return;

    try {
      const profile = await window.getCurrentProfile();
      if (!profile || profile.role !== "admin") {
        target.textContent = "この機能を利用する権限がありません。";
        return;
      }

      const users = await getCollection("users");
      target.innerHTML = renderRows(users, [
        { key: "displayName", label: "表示名" },
        { key: "email", label: "メールアドレス" },
        { key: "role", label: "権限" },
        { key: "status", label: "状態" }
      ]);
    } catch (error) {
      console.error(error);
      target.textContent = "ユーザー一覧を取得できませんでした。";
    }
  }

  async function loadLogs() {
    const target = $("#logsList");
    if (!target) return;

    try {
      const logs = await getCollection("auditLogs");
      target.innerHTML = renderRows(logs, [
        { key: "action", label: "操作" },
        { key: "userId", label: "ユーザーID" },
        { key: "createdAt", label: "日時" }
      ]);
    } catch (error) {
      console.error(error);
      target.textContent = "操作ログを取得できませんでした。";
    }
  }

  function renderChat() {
    const form = $("#chatForm");
    const input = $("#chatInput");
    const output = $("#chatOutput");
    const subject = $("#subjectSelect");

    if (!form || !input || !output || !subject) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const question = input.value.trim();
      if (!question) {
        showMessage("質問を入力してください。", "warning");
        return;
      }

      const allowedSubjects = [
        "国語", "数学", "英語", "理科", "社会",
        "音楽", "美術", "保健体育", "技術家庭"
      ];

      if (!allowedSubjects.includes(subject.value)) {
        showMessage("教科を選択してください。", "warning");
        return;
      }

      const button = $("#sendButton");
      button.disabled = true;
      output.textContent = "回答を生成しています…";

      try {
        const response = await fetch(
          "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer sb_publishable_j6QpWj-1v86qkWHmXM8F3Q_Ieipaa3q",
              "apikey": "sb_publishable_j6QpWj-1v86qkWHmXM8F3Q_Ieipaa3q"
            },
            body: JSON.stringify({
              subject: subject.value,
              question: question
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "回答の取得に失敗しました。");
        }

        const answer =
          data.answer || data.response || data.message ||
          "回答を取得できませんでした。";

        output.textContent = answer;

        await window.db.collection("chatHistories").add({
          userId: window.authState.user.uid,
          subject: subject.value,
          question: question,
          answer: answer,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error(error);
        output.textContent =
          "回答を取得できませんでした。接続設定とSupabase関数のレスポンス形式を確認してください。";
      } finally {
        button.disabled = false;
      }
    });
  }

  function bindResetForm() {
    const form = $("#resetForm");
    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const email = $("#resetEmail").value.trim();
      const button = $("#resetButton");
      button.disabled = true;

      try {
        await window.auth.sendPasswordResetEmail(email);
        showMessage(
          "パスワード再設定メールを送信しました。メールを確認してください。",
          "success"
        );
      } catch (error) {
        console.error(error);
        showMessage(
          "メールを送信できませんでした。アドレスを確認してください。",
          "error"
        );
      } finally {
        button.disabled = false;
      }
    });
  }

  async function startPage() {
    const page = document.body.dataset.page || "home";
    const role = document.body.dataset.role || "student";

    if (page === "reset") {
      bindResetForm();
      return;
    }

    if (page === "forbidden" || page === "not-found" ||
        page === "maintenance-public") {
      return;
    }

    const authorized = await window.requireAuth(role);
    if (!authorized) return;

    const profile = await window.getCurrentProfile();

    const pageTitles = {
      home: "ホーム",
      dashboard: "ダッシュボード",
      question: "AI学習チャット",
      history: "学習履歴",
      announcements: "お知らせ",
      settings: "設定",
      users: "ユーザー管理",
      maintenance: "メンテナンス管理",
      "ai-settings": "AI設定",
      logs: "操作ログ",
      system: "システム状態"
    };

    const title = pageTitles[page] || "学習AIチャット";

    const content = {
      home: `
        <section class="welcome-panel">
          <p class="eyebrow">LEARNING PORTAL</p>
          <h1>学習AIチャット</h1>
          <p>学習したい教科を選択して、質問を始めましょう。</p>
          <a class="primary-button" href="${window.AppPaths.url("student/question.html")}">
            学習を始める
          </a>
        </section>
        <section class="content-card">
          <h2>お知らせ</h2>
          <div id="announcementList"></div>
        </section>
      `,
      dashboard: `
        <section class="welcome-panel">
          <h1>ダッシュボード</h1>
          <p>メニューから管理機能を選択してください。</p>
        </section>
      `,
      question: `
        <section class="content-card">
          <h1>AI学習チャット</h1>
          <p class="muted">学習に関する質問を入力してください。</p>
          <form id="chatForm" class="chat-form">
            <label for="subjectSelect">教科</label>
            <select id="subjectSelect" required>
              <option value="">教科を選択</option>
              <option>国語</option><option>数学</option><option>英語</option>
              <option>理科</option><option>社会</option><option>音楽</option>
              <option>美術</option><option>保健体育</option><option>技術家庭</option>
            </select>
            <label for="chatInput">質問</label>
            <textarea id="chatInput" rows="5" maxlength="4000"
              placeholder="質問を入力してください…" required></textarea>
            <button id="sendButton" class="primary-button" type="submit">質問する</button>
          </form>
        </section>
        <section class="content-card">
          <h2>回答</h2>
          <div id="chatOutput" class="answer-output" aria-live="polite">
            ここに回答が表示されます。
          </div>
        </section>
      `,
      history: `
        <section class="content-card">
          <h1>学習履歴</h1>
          <div id="historyList">履歴を読み込んでいます…</div>
        </section>
      `,
      announcements: `
        <section class="content-card">
          <h1>お知らせ</h1>
          <div id="announcementList">読み込んでいます…</div>
        </section>
      `,
      settings: `
        <section class="content-card">
          <h1>アカウント設定</h1>
          <p>ログイン中のアカウント情報</p>
          <dl class="details-list">
            <dt>表示名</dt><dd>${escape(profile.displayName || "未設定")}</dd>
            <dt>メールアドレス</dt><dd>${escape(window.authState.user.email || "—")}</dd>
            <dt>権限</dt><dd>${escape(profile.role || "—")}</dd>
          </dl>
          <a class="secondary-button" href="${window.AppPaths.url("reset.html")}">
            パスワード再設定
          </a>
        </section>
      `,
      users: `
        <section class="content-card">
          <h1>ユーザー管理</h1>
          <p class="muted">ユーザー情報を確認します。権限変更はこの一覧からは行いません。</p>
          <div id="usersList">読み込んでいます…</div>
        </section>
      `,
      maintenance: `
        <section class="content-card">
          <h1>メンテナンス管理</h1>
          <p>メンテナンス状態の設定は、管理者専用の安全なサーバー処理とルールを用意してから有効化してください。</p>
          <p class="notice warning">現在、この画面は案内のみです。設定変更はまだ実装されていません。</p>
        </section>
      `,
      "ai-settings": `
        <section class="content-card">
          <h1>AI設定</h1>
          <p>AIモデル・利用制限などの設定は、サーバー側で検証する仕組みが必要です。</p>
          <p class="notice warning">現在、この画面は案内のみです。設定変更はまだ実装されていません。</p>
        </section>
      `,
      logs: `
        <section class="content-card">
          <h1>操作ログ</h1>
          <div id="logsList">読み込んでいます…</div>
        </section>
      `,
      system: `
        <section class="content-card">
          <h1>システム状態</h1>
          <p>Firebase Authentication・Firestore・Supabase関数の状態を確認できます。</p>
          <p class="notice warning">接続状況の自動監視は別途実装が必要です。</p>
        </section>
      `
    };

    window.renderLayout({
      role: role,
      title: title,
      content: (content[page] || content.home) +
        '<div id="pageMessage" class="notice" hidden></div>'
    });

    if (page === "home" || page === "announcements") {
      loadAnnouncements();
    }
    if (page === "history") loadHistory();
    if (page === "users") loadUsers();
    if (page === "logs") loadLogs();
    if (page === "question") renderChat();
  }

  document.addEventListener("DOMContentLoaded", startPage);
})();
