
import {
  auth,
  db,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from "./firebase.js";

import { protectPage } from "./auth.js";
import { setupSidebar, setupLogout } from "./layout.js";

const AI_ENDPOINT =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_j6QpWj-1v86qkWHmXM8F3Q_Ieipaa3q";

const ALLOWED_SUBJECTS = [
  "国語", "数学", "英語", "理科", "社会",
  "音楽", "美術", "保健体育", "技術家庭"
];

const NON_STUDY_RESPONSE =
  "このAIは学習専用です。学習以外の質問はできません。";

const $ = (id) => document.getElementById(id);

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
    throw new Error("この会話履歴は見つかりません。新しい質問を開始してください。");
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
    turnCount: turns.length,
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
    .filter((turn) => turn.status === "completed" || turn.status === "error");

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
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({
        subject,
        question,
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
      throw new Error("AIの回答が60秒以内に返りませんでした。もう一度お試しください。");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function looksLikeNonStudyRequest(question) {
  // 学習専用という注意書きは表示するが、
  // 単語検索だけで学習質問を誤判定しない。
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

    const message =
      error?.message || "質問の処理中に予期しないエラーが発生しました。";

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

async function initializePage() {
  if (initializationStarted) return;
  initializationStarted = true;

  try {
    // layout.js 側も requireRole() を呼び出すが、
    // auth.js が同じ権限確認の Promise を共有する。
    const result = await protectPage("student");

    currentUser = result.user;
    currentProfile = result.profile;

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

    // auth.js が権限エラー画面を表示している場合は、
    // 元の画面を上書きしない。
    if (!document.querySelector(".auth-error")) {
      showStatus(
        `質問画面を初期化できませんでした。\n${error?.message || String(error)}`,
        "error"
      );
    }
  }
}

initializePage();
