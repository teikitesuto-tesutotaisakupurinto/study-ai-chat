import {
  auth,
  db,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "./firebase-module.js";

import { protectPage } from "./auth.js";
import { setupSidebar, setupLogout, renderSidebar } from "./layout.js";

const AI_ENDPOINT =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";

const ALLOWED_SUBJECTS = [
  "国語", "数学", "英語", "理科", "社会",
  "音楽", "美術", "保健体育", "技術家庭"
];

const NON_STUDY_RESPONSE =
  "このAIは学習専用です。学習以外の質問はできません。";

const $ = (id) => document.getElementById(id);

function explainError(error) {
  const code = error?.code || "";
  const raw = error?.message || String(error || "不明なエラー");

  if (
    code === "permission-denied" ||
    /Missing or insufficient permissions/i.test(raw)
  ) {
    return "Firestoreのアクセス権限が拒否されました（permission-denied）。Firebase Console の Firestore Database → ルールで、ログイン中のユーザー自身の users/{uid} の読み取り、settings/system の読み取り、本人所有の chatHistories と turns の読み書きが許可されているか確認してください。詳細: " + raw;
  }

  if (
    code === "unauthenticated" ||
    /not authenticated/i.test(raw)
  ) {
    return "ログイン状態を確認できません。いったんログアウトして再ログインしてください。詳細: " + raw;
  }

  return raw;
}

const conversation = $("conversation");
const welcomeMessage = $("welcomeMessage");
const questionForm = $("questionForm");
const questionInput = $("questionInput");
const subjectSelect = $("subjectSelect");
const sendButton = $("sendButton");
const newChatButton = $("newChatButton");
const statusMessage = $("statusMessage");

let currentUser = null;
let currentProfile = null;
let currentConversationId = null;
let turns = [];
let sending = false;
let typingElement = null;
let initializationStarted = false;

function showStatus(message = "", type = "error") {
  if (!statusMessage) return;

  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
  statusMessage.hidden = !message;
}

function setSending(value) {
  sending = value;

  if (sendButton) {
    sendButton.disabled = value;
    sendButton.textContent = value ? "回答を生成中..." : "質問する";
  }

  if (newChatButton) {
    newChatButton.disabled = value;
  }

  if (questionInput) {
    questionInput.disabled = value;
  }

  if (subjectSelect) {
    subjectSelect.disabled = value;
  }
}

function showWelcome() {
  if (!conversation || !welcomeMessage) return;

  conversation.replaceChildren(welcomeMessage);
  welcomeMessage.hidden = false;
}

function createMessageElement(role, text, options = {}) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  if (options.error) {
    article.classList.add("error");
  }

  const label = document.createElement("span");
  label.className = "message-role";
  label.textContent =
    role === "user" ? "あなた" :
    role === "assistant" ? "学習AI" : "システム";

  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = text;

  article.append(label, content);
  return article;
}

function renderMessage(role, text, options = {}) {
  if (!conversation) return;

  if (welcomeMessage && !welcomeMessage.hidden) {
    welcomeMessage.hidden = true;
  }

  const element = createMessageElement(role, text, options);
  conversation.append(element);
  element.scrollIntoView({ block: "nearest", behavior: "auto" });

  return element;
}

function showTyping() {
  hideTyping();

  typingElement = document.createElement("div");
  typingElement.className = "typing";
  typingElement.textContent = "学習AIが回答を作成しています...";

  conversation.append(typingElement);
  typingElement.scrollIntoView({ block: "nearest", behavior: "auto" });
}

function hideTyping() {
  typingElement?.remove();
  typingElement = null;
}

function updateAddressForConversation(conversationId) {
  const url = new URL(location.href);

  if (conversationId) {
    url.searchParams.set("conversationId", conversationId);
  } else {
    url.searchParams.delete("conversationId");
  }

  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

function normalizeTurn(data) {
  return {
    questionId: data.questionId || "",
    answerId: data.answerId || "",
    subject: data.subject || "数学",
    question: typeof data.question === "string" ? data.question : "",
    answer: typeof data.answer === "string" ? data.answer : "",
    status: data.status || "completed",
    createdAt: data.createdAt || null
  };
}

function makeConversationTitle(question) {
  const compact = question.replace(/\s+/g, " ").trim();

  return compact.length > 40
    ? `${compact.slice(0, 40)}…`
    : compact || "新しい会話";
}

function conversationRef(id) {
  return doc(db, "chatHistories", id);
}

function turnsCollectionRef(id) {
  return collection(db, "chatHistories", id, "turns");
}

async function createConversation(question, subject) {
  const ref = doc(collection(db, "chatHistories"));

  await setDoc(ref, {
    userId: currentUser.uid,
    conversationId: ref.id,
    title: makeConversationTitle(question),
    subject,
    lastQuestion: question,
    lastAnswer: "",
    turnCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  currentConversationId = ref.id;
  updateAddressForConversation(ref.id);

  return ref.id;
}

async function ensureConversation(question, subject) {
  if (!currentConversationId) {
    return createConversation(question, subject);
  }

  const ref = conversationRef(currentConversationId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error(
      "この会話履歴は見つかりません。新しい質問を開始してください。"
    );
  }

  if (snapshot.data().userId !== currentUser.uid) {
    throw new Error("この会話履歴を開く権限がありません。");
  }

  return currentConversationId;
}

async function savePendingTurn(question, subject) {
  const id = await ensureConversation(question, subject);
  const turnRef = doc(turnsCollectionRef(id));
  const answerId = doc(collection(db, "_generatedIds")).id;

  const turn = {
    questionId: turnRef.id,
    answerId,
    conversationId: id,
    userId: currentUser.uid,
    subject,
    question,
    answer: "",
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(turnRef, turn);

  return {
    conversationId: id,
    questionId: turnRef.id,
    answerId
  };
}

async function saveCompletedTurn(saved, question, subject, answer) {
  const ref = doc(
    db,
    "chatHistories",
    saved.conversationId,
    "turns",
    saved.questionId
  );

  await updateDoc(ref, {
    answer,
    status: "completed",
    updatedAt: serverTimestamp()
  });

  const parentRef = conversationRef(saved.conversationId);
  const parentSnapshot = await getDoc(parentRef);

  if (!parentSnapshot.exists()) {
    throw new Error("会話履歴の親データが見つかりません。");
  }

  if (parentSnapshot.data().userId !== currentUser.uid) {
    throw new Error("この会話履歴を更新する権限がありません。");
  }

  await updateDoc(parentRef, {
    title: parentSnapshot.data().title || makeConversationTitle(question),
    subject,
    lastQuestion: question,
    lastAnswer: answer,
    turnCount: turns.length + 1,
    updatedAt: serverTimestamp()
  });
}

async function markTurnFailed(saved, errorMessage) {
  if (!saved) return;

  try {
    const ref = doc(
      db,
      "chatHistories",
      saved.conversationId,
      "turns",
      saved.questionId
    );

    await updateDoc(ref, {
      answer: errorMessage,
      status: "error",
      updatedAt: serverTimestamp()
    });

    await updateDoc(conversationRef(saved.conversationId), {
      lastQuestion: errorMessage,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("失敗した質問の履歴更新エラー:", error);
  }
}

async function loadConversation(id) {
  showStatus("会話履歴を読み込んでいます...", "info");

  const ref = conversationRef(id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("指定された会話履歴が見つかりません。");
  }

  const parent = snapshot.data();

  if (parent.userId !== currentUser.uid) {
    throw new Error("この会話履歴を開く権限がありません。");
  }

  const turnsQuery = query(
    turnsCollectionRef(id),
    orderBy("createdAt", "asc")
  );

  const turnsSnapshot = await getDocs(turnsQuery);

  turns = turnsSnapshot.docs
    .map((item) => normalizeTurn(item.data()))
    .filter(
      (turn) => turn.status === "completed" || turn.status === "error"
    );

  currentConversationId = id;
  updateAddressForConversation(id);
  showWelcome();

  for (const turn of turns) {
    if (ALLOWED_SUBJECTS.includes(turn.subject)) {
      subjectSelect.value = turn.subject;
    }

    renderMessage("user", turn.question);

    if (turn.answer) {
      renderMessage(
        "assistant",
        turn.answer,
        { error: turn.status === "error" }
      );
    }
  }

  if (turns.length === 0) {
    showStatus("この会話には、まだ回答済みの質問がありません。", "info");
  } else {
    showStatus("");
  }
}

async function callAI(question, subject) {
  if (!currentUser) {
    throw new Error("ログイン状態を確認できません。再読み込みしてください。");
  }

  const idToken = await currentUser.getIdToken();

  const history = turns
    .filter((turn) => turn.status === "completed")
    .slice(-12)
    .map((turn) => ({
      question: turn.question,
      answer: turn.answer
    }));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({
        question,
        message: question,
        grade: currentProfile?.grade || "中学生",
        subject,
        userId: currentUser.uid,
        conversationId: currentConversationId,
        history
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `AIサーバーがエラーを返しました（HTTP ${response.status}）。`
      );
    }

    const answer =
      data.answer ||
      data.reply ||
      data.message ||
      data.output;

    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error("AIサーバーから回答が返されませんでした。");
    }

    return answer.trim();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "AIの回答が60秒以内に返りませんでした。もう一度お試しください。"
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function looksLikeNonStudyRequest(question) {
  const patterns = [
    /^今日の天気/,
    /^明日の天気/,
    /^ニュースを教えて/,
    /^おすすめの(映画|ドラマ|ゲーム|レストラン)/,
    /^暇つぶし/
  ];

  return patterns.some((pattern) => pattern.test(question.trim()));
}

async function submitQuestion(event) {
  event.preventDefault();

  if (sending) return;

  showStatus("");

  const question = questionInput.value.trim();
  const subject = subjectSelect.value;

  if (!question) {
    showStatus("質問内容を入力してください。");
    questionInput.focus();
    return;
  }

  if (question.length > 5000) {
    showStatus("質問は5000文字以内で入力してください。");
    return;
  }

  if (!ALLOWED_SUBJECTS.includes(subject)) {
    showStatus("正しい教科を選択してください。");
    return;
  }

  setSending(true);

  let saved = null;
  let questionWasRendered = false;

  try {
    if (looksLikeNonStudyRequest(question)) {
      const answer = NON_STUDY_RESPONSE;

      renderMessage("user", question);
      renderMessage("assistant", answer);

      turns.push({
        questionId: "",
        answerId: "",
        subject,
        question,
        answer,
        status: "completed",
        createdAt: null
      });

      questionInput.value = "";
      showStatus("学習内容に関する質問を入力してください。", "info");
      return;
    }

    // 質問を先に履歴に保存し、AI側でエラーが起きても質問を失わない。
    saved = await savePendingTurn(question, subject);

    renderMessage("user", question);
    questionWasRendered = true;
    questionInput.value = "";

    showTyping();

    const answer = await callAI(question, subject);

    hideTyping();

    await saveCompletedTurn(saved, question, subject, answer);

    turns.push({
      questionId: saved.questionId,
      answerId: saved.answerId,
      subject,
      question,
      answer,
      status: "completed",
      createdAt: null
    });

    renderMessage("assistant", answer);
    showStatus("");
  } catch (error) {
    hideTyping();
    console.error("質問処理エラー:", error);

    const message = explainError(error) ||
      "質問の処理中に予期しないエラーが発生しました。";

    if (saved) {
      await markTurnFailed(saved, message);

      turns.push({
        questionId: saved.questionId,
        answerId: saved.answerId,
        subject,
        question,
        answer: message,
        status: "error",
        createdAt: null
      });
    }

    if (!questionWasRendered) {
      renderMessage("user", question);
      questionInput.value = "";
    }

    renderMessage("assistant", message, { error: true });

    showStatus(
      "回答の取得または履歴の保存に失敗しました。エラー内容を確認してください。",
      "error"
    );
  } finally {
    hideTyping();
    setSending(false);
  }
}

async function startNewConversation() {
  if (sending) return;

  currentConversationId = null;
  turns = [];

  updateAddressForConversation(null);
  showWelcome();
  showStatus("新しい会話を開始しました。", "success");

  questionInput.value = "";
  questionInput.focus();
}

function legacyElement(tag, text = "", className = "") {
  const node = document.createElement(tag);
  if (text !== "") node.textContent = text;
  if (className) node.className = className;
  return node;
}

function legacyWrenchIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z");
  svg.append(path);
  svg.classList.add("maintenance-wrench-icon");
  return svg;
}

function legacyButton(text, onClick, className = "primary-button") {
  const button = legacyElement("button", text, className);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function legacyLink(text, href, className = "secondary-button") {
  const link = legacyElement("a", text, className);
  link.href = href;
  link.className = className;
  return link;
}

function legacyMessage(container, text, isError = false) {
  const message = legacyElement(
    "p",
    text,
    isError ? "layout-error" : "status-message"
  );

  message.setAttribute("role", isError ? "alert" : "status");
  container.append(message);
  return message;
}

function formatLegacyDate(value) {
  if (!value) return "日時未設定";

  const date = typeof value.toDate === "function"
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "日時未設定";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderLegacyShell(appRoot, role, profile, user, pageName) {
  appRoot.replaceChildren();

  const shell = legacyElement("div", "", "legacy-layout");
  const sidebar = legacyElement("aside", "", "sidebar");
  sidebar.id = "appSidebar";
  sidebar.setAttribute("aria-label", "メインメニュー");

  const column = legacyElement("div", "", "legacy-main-column");
  const header = legacyElement("header", "", "page-header");
  header.append(
    legacyElement(
      "h1",
      role === "admin" ? "運営管理コンソール" : "学習AIチャット",
      "page-title"
    ),
    legacyElement(
      "p",
      `${profile.displayName || profile.name || user.displayName || user.email || "利用者"} さん`
    )
  );

  const main = legacyElement("main", "", "page-content legacy-page-content");
  const footer = legacyElement(
    "footer",
    "© 2026 Regular Test Preparation Worksheet Administration Office. All Rights Reserved.",
    "page-footer"
  );

  column.append(header, main, footer);
  shell.append(sidebar, column);
  appRoot.append(shell);

  return main;
}

async function legacyQueryCollection(collectionName, constraints = []) {
  return getDocs(
    query(collection(db, collectionName), ...constraints)
  );
}

async function initializeLegacyPage() {
  const appRoot = document.getElementById("app");
  const role = document.body.dataset.role || "student";
  const pageName = document.body.dataset.page || "home";

  try {
    const result = await protectPage(
      role,
      { allowMaintenance: role === "admin" }
    );

    const user = result.user;
    const profile = result.profile;
    const main = renderLegacyShell(
      appRoot,
      role,
      profile,
      user,
      pageName
    );

    // 旧ページでもAI質問画面と同じ共通サイドバーを使う。
    await renderSidebar(role, user, profile);

    if (role === "student") {
      await renderStudentLegacyPage(main, pageName, user, profile);
    } else {
      await renderAdminLegacyPage(main, pageName, user, profile);
    }

    document.documentElement.classList.remove("auth-pending");
  } catch (error) {
    console.error("ページ初期化エラー:", error);
    document.documentElement.classList.remove("auth-pending");

    if (!document.querySelector(".auth-error")) {
      const existingColumn = appRoot.querySelector(".legacy-main-column");
      const panel = legacyElement("main", "", "auth-error");

      panel.append(
        legacyElement("h1", "ページを開けませんでした"),
        legacyElement("p", explainError(error))
      );

      panel.append(
        legacyButton(
          "再読み込み",
          () => location.reload(),
          "secondary-button"
        )
      );

      if (existingColumn) {
        existingColumn.replaceChildren(panel);
      } else {
        appRoot.replaceChildren(panel);
      }
    }
  }
}

async function renderStudentLegacyPage(main, pageName, user, profile) {
  if (pageName === "home" || pageName === "dashboard") {
    main.append(
      legacyElement("h2", "学習ホーム"),
      legacyElement(
        "p",
        "学習内容について、AIに質問したり、過去の会話を続けたりできます。"
      ),
      legacyLink("AIに質問する", "question.html", "primary-button")
    );

    const section = legacyElement("section", "", "page-card");
    section.append(legacyElement("h2", "最近の学習履歴"));
    main.append(section);

    try {
      const snapshot = await legacyQueryCollection("chatHistories", [
        where("userId", "==", user.uid),
        limit(50)
      ]);

      const recentDocs = snapshot.docs
        .sort((a, b) =>
          (b.data().updatedAt?.toMillis?.() || 0) -
          (a.data().updatedAt?.toMillis?.() || 0)
        )
        .slice(0, 10);

      if (!recentDocs.length) {
        section.append(
          legacyElement("p", "まだ会話履歴はありません。")
        );
      }

      for (const item of recentDocs) {
        section.append(
          legacyLink(
            `${item.data().title || item.data().lastQuestion || "会話"} — ${formatLegacyDate(item.data().updatedAt)}`,
            `question.html?conversationId=${encodeURIComponent(item.id)}`
          )
        );
      }
    } catch (error) {
      legacyMessage(
        section,
        `履歴を読み込めませんでした。\n${explainError(error)}`,
        true
      );
    }

    return;
  }

  if (pageName === "history") {
    main.append(legacyElement("h2", "学習履歴"));

    try {
      const snapshot = await legacyQueryCollection("chatHistories", [
        where("userId", "==", user.uid),
        limit(100)
      ]);

      const historyDocs = snapshot.docs
        .sort((a, b) =>
          (b.data().updatedAt?.toMillis?.() || 0) -
          (a.data().updatedAt?.toMillis?.() || 0)
        )
        .slice(0, 50);

      if (!historyDocs.length) {
        main.append(
          legacyElement("p", "まだ学習履歴はありません。")
        );
      }

      for (const item of historyDocs) {
        const data = item.data();

        main.append(
          legacyLink(
            `${data.title || data.lastQuestion || "会話"} — ${formatLegacyDate(data.updatedAt)}`,
            `question.html?conversationId=${encodeURIComponent(item.id)}`
          )
        );
      }
    } catch (error) {
      legacyMessage(
        main,
        `履歴を読み込めませんでした。\n${explainError(error)}`,
        true
      );
    }

    return;
  }

  if (pageName === "announcements") {
    main.append(legacyElement("h2", "お知らせ"));

    try {
      const snapshot = await legacyQueryCollection(
        "announcements",
        [limit(50)]
      );

      const docs = snapshot.docs
        .filter(item => item.data().visible === true)
        .sort((a, b) => {
          const av = a.data().publishedAt?.toMillis?.() || 0;
          const bv = b.data().publishedAt?.toMillis?.() || 0;
          return bv - av;
        });

      if (!docs.length) {
        main.append(
          legacyElement("p", "現在、お知らせはありません。")
        );
      }

      for (const item of docs) {
        const data = item.data();
        const card = legacyElement("article", "", "page-card");

        card.append(
          legacyElement("h3", data.title || "お知らせ"),
          legacyElement("p", data.body || ""),
          legacyElement("small", formatLegacyDate(data.publishedAt))
        );

        main.append(card);
      }
    } catch (error) {
      legacyMessage(
        main,
        `お知らせを読み込めませんでした。\n${explainError(error)}`,
        true
      );
    }

    return;
  }

  if (pageName === "settings") {
    main.append(
      legacyElement("h2", "アカウント設定"),
      legacyElement(
        "p",
        `表示名：${profile.displayName || profile.name || user.displayName || "未設定"}`
      ),
      legacyElement(
        "p",
        `メールアドレス：${user.email || "未登録"}`
      ),
      legacyElement("p", `学年：${profile.grade || "未設定"}`),
      legacyElement(
        "p",
        "アカウント情報の変更が必要な場合は、運営管理者にお問い合わせください。"
      )
    );

    return;
  }

  main.append(
    legacyElement("h2", "ページが見つかりません"),
    legacyLink("学習ホームへ", "index.html")
  );
}

async function renderAdminLegacyPage(main, pageName, user, profile) {
  if (pageName === "dashboard" || pageName === "home") {
    main.append(
      legacyElement("h2", "運営管理コンソール"),
      legacyElement(
        "p",
        "学習AIチャットの運用状況を確認できます。"
      )
    );

    const links = [
      ["ユーザー管理", "users.html"],
      ["お知らせ管理", "announcements.html"],
      ["メンテナンス", "maintenance.html"],
      ["AI設定", "ai-settings.html"],
      ["操作ログ", "logs.html"],
      ["システム状態", "system.html"]
    ];

    for (const [label, href] of links) {
      main.append(legacyLink(label, href));
    }

    return;
  }

  if (pageName === "users") {
    main.append(legacyElement("h2", "ユーザー管理"));

    try {
      const snapshot = await legacyQueryCollection(
        "users",
        [limit(200)]
      );

      if (snapshot.empty) {
        main.append(
          legacyElement("p", "ユーザーが登録されていません。")
        );
      }

      const table = legacyElement("table");
      const head = legacyElement("tr");

      for (const label of [
        "メールアドレス", "表示名", "権限", "状態"
      ]) {
        head.append(legacyElement("th", label));
      }

      table.append(head);

      for (const item of snapshot.docs) {
        const data = item.data();
        const row = legacyElement("tr");

        for (const value of [
          data.email || "—",
          data.displayName || data.name || "—",
          data.role || "未設定",
          data.status || "未設定"
        ]) {
          row.append(legacyElement("td", value));
        }

        table.append(row);
      }

      const wrapper = legacyElement("div", "", "table-wrapper");
      wrapper.append(table);
      main.append(wrapper);
    } catch (error) {
      legacyMessage(
        main,
        `ユーザー一覧を取得できませんでした。\n${explainError(error)}`,
        true
      );
    }

    return;
  }

  if (pageName === "announcements") {
    main.append(legacyElement("h2", "お知らせ管理"));

    const form = legacyElement("form", "", "page-card");

    const titleLabel = legacyElement("label", "タイトル");
    const titleInput = legacyElement("input");
    titleInput.required = true;
    titleInput.maxLength = 150;
    titleLabel.append(titleInput);

    const bodyLabel = legacyElement("label", "本文");
    const bodyInput = legacyElement("textarea");
    bodyInput.required = true;
    bodyInput.maxLength = 10000;
    bodyLabel.append(bodyInput);

    const visibleLabel = legacyElement("label", "公開する");
    const visibleInput = legacyElement("input");
    visibleInput.type = "checkbox";
    visibleInput.checked = true;
    visibleLabel.append(visibleInput);

    const submit = legacyElement(
      "button",
      "お知らせを保存",
      "primary-button"
    );
    submit.type = "submit";

    const status = legacyElement("p");

    form.append(
      titleLabel,
      bodyLabel,
      visibleLabel,
      submit,
      status
    );

    form.addEventListener("submit", async event => {
      event.preventDefault();
      submit.disabled = true;
      status.textContent = "保存しています。";

      try {
        await addDoc(collection(db, "announcements"), {
          title: titleInput.value.trim(),
          body: bodyInput.value.trim(),
          visible: visibleInput.checked,
          createdBy: user.uid,
          publishedAt: serverTimestamp()
        });

        status.textContent = "お知らせを保存しました。";
        form.reset();
        visibleInput.checked = true;
      } catch (error) {
        status.textContent =
          `保存に失敗しました: ${explainError(error)}`;
      } finally {
        submit.disabled = false;
      }
    });

    main.append(form);
    return;
  }

  if (pageName === "maintenance") {
    const heading = legacyElement("h2", "", "maintenance-heading");
    heading.append(legacyWrenchIcon(), document.createTextNode(" システムメンテナンス設定"));
    main.append(heading);

    const form = legacyElement("form", "", "page-card");

    const enabledLabel = legacyElement(
      "label",
      "メンテナンスを有効にする"
    );
    const enabled = legacyElement("input");
    enabled.type = "checkbox";
    enabledLabel.append(enabled);

    const titleLabel = legacyElement("label", "表示タイトル");
    const titleInput = legacyElement("input");
    titleInput.required = true;
    titleLabel.append(titleInput);

    const messageLabel = legacyElement("label", "表示メッセージ");
    const messageInput = legacyElement("textarea");
    messageInput.required = true;
    messageLabel.append(messageInput);

    const save = legacyElement(
      "button",
      "設定を保存",
      "primary-button"
    );
    save.type = "submit";

    const status = legacyElement("p", "");

    form.append(
      enabledLabel,
      titleLabel,
      messageLabel,
      save,
      status
    );

    main.append(form);

    const ref = doc(db, "settings", "system");

    try {
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        throw new Error("settings/system がありません。");
      }

      const data = snap.data();

      enabled.checked = data.maintenance === true;
      titleInput.value =
        data.maintenanceTitle || "システムメンテナンス中";
      messageInput.value =
        data.maintenanceMessage || "現在、メンテナンスを実施しています。";

      status.textContent = "設定を読み込みました。";
    } catch (error) {
      status.textContent =
        `設定を読み込めませんでした: ${explainError(error)}`;
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      save.disabled = true;

      try {
        await setDoc(ref, {
          maintenance: enabled.checked,
          maintenanceTitle: titleInput.value.trim(),
          maintenanceMessage: messageInput.value.trim(),
          updatedAt: serverTimestamp()
        }, { merge: true });

        status.textContent = "設定を保存しました。";
      } catch (error) {
        status.textContent =
          `保存に失敗しました: ${explainError(error)}`;
      } finally {
        save.disabled = false;
      }
    });

    return;
  }

  if (pageName === "logs") {
    main.append(legacyElement("h2", "操作ログ"));

    try {
      const snapshot = await legacyQueryCollection(
        "auditLogs",
        [limit(100)]
      );

      if (snapshot.empty) {
        main.append(
          legacyElement("p", "操作ログはありません。")
        );
      }

      for (const item of snapshot.docs) {
        const data = item.data();
        const card = legacyElement("article", "", "page-card");

        card.append(
          legacyElement("strong", data.action || data.type || "操作"),
          legacyElement(
            "p",
            data.message || data.description || JSON.stringify(data)
          ),
          legacyElement(
            "small",
            formatLegacyDate(data.createdAt || data.timestamp)
          )
        );

        main.append(card);
      }
    } catch (error) {
      legacyMessage(
        main,
        `操作ログを取得できませんでした。\n${explainError(error)}`,
        true
      );
    }

    return;
  }

  if (pageName === "system") {
    main.append(legacyElement("h2", "システム状態"));

    try {
      const snapshot = await getDoc(doc(db, "settings", "system"));

      if (!snapshot.exists()) {
        throw new Error("settings/system がありません。");
      }

      const data = snapshot.data();

      main.append(
        legacyElement(
          "p",
          `メンテナンス：${data.maintenance === true ? "有効" : "無効"}`
        )
      );

      const pre = legacyElement("pre", JSON.stringify(data, null, 2));
      main.append(pre);
    } catch (error) {
      legacyMessage(
        main,
        `システム設定を取得できませんでした。\n${explainError(error)}`,
        true
      );
    }

    return;
  }

  if (pageName === "ai-settings") {
    main.append(
      legacyElement("h2", "AI設定"),
      legacyElement(
        "p",
        "AIの接続先はSupabase Edge Functionです。APIキーはブラウザー側に保存しないでください。"
      ),
      legacyElement(
        "p",
        "Edge FunctionのURL：https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat"
      )
    );

    return;
  }

  if (pageName === "settings") {
    main.append(
      legacyElement("h2", "管理者設定"),
      legacyElement(
        "p",
        `ログイン中：${user.email || profile.displayName || user.uid}`
      ),
      legacyElement(
        "p",
        "権限やアカウントの変更は、Firebase AuthenticationとFirestoreの管理設定で行います。"
      )
    );

    return;
  }

  main.append(
    legacyElement("h2", "ページが見つかりません"),
    legacyLink("管理者ホームへ", "index.html")
  );
}

async function initializeQuestionPage() {
  if (initializationStarted) return;
  initializationStarted = true;

  try {
    const result = await protectPage("student");

    currentUser = result.user;
    currentProfile = result.profile;

    // 既存のサイドバーとログアウト処理を利用する。
    setupSidebar();
    setupLogout();

    if (questionForm) {
      questionForm.addEventListener("submit", submitQuestion);
    }

    if (newChatButton) {
      newChatButton.addEventListener("click", startNewConversation);
    }

    if (questionInput) {
      questionInput.addEventListener("keydown", (event) => {
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.isComposing
        ) {
          event.preventDefault();
          questionForm.requestSubmit();
        }
      });
    }

    const params = new URLSearchParams(location.search);
    const requestedConversationId = params.get("conversationId");

    if (requestedConversationId) {
      await loadConversation(requestedConversationId);
    } else {
      showWelcome();
      showStatus("");
    }

    document.documentElement.classList.remove("auth-pending");
  } catch (error) {
    console.error("質問画面の初期化エラー:", error);

    document.documentElement.classList.remove("auth-pending");

    if (!document.querySelector(".auth-error")) {
      showStatus(
        `質問画面を初期化できませんでした。\n${explainError(error)}`,
        "error"
      );
    }
  }
}

if (document.getElementById("questionForm")) {
  void initializeQuestionPage();
} else if (document.getElementById("app")) {
  void initializeLegacyPage();
}
