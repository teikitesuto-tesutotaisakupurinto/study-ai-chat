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
  limit,
  serverTimestamp,
  onAuthStateChanged,
  signOut
} from "./firebase.js";

import {
  setupSidebar,
  setupLogout
} from "./layout.js";

const AI_ENDPOINT =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";

const SUBJECTS = [
  "国語", "数学", "英語", "理科", "社会",
  "音楽", "美術", "保健体育", "技術家庭"
];

const $ = (selector) => document.querySelector(selector);

let currentUser = null;
let currentProfile = null;
let conversationId = null;
let isSending = false;
let turns = [];

const params = new URLSearchParams(location.search);
const requestedConversationId = params.get("conversationId");

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function showStatus(message, type = "info") {
  const status = $("#statusMessage");
  if (!status) return;

  status.textContent = message;
  status.dataset.type = type;
}

function setSending(sending) {
  isSending = sending;

  const button = $("#sendButton");
  const input = $("#questionInput");

  if (button) {
    button.disabled = sending;
    button.textContent = sending ? "回答を作成中..." : "質問する";
  }

  if (input) input.disabled = sending;
}

function showWelcome(show) {
  const welcome = $("#welcomeMessage");
  if (welcome) welcome.hidden = !show;
}

function renderTurn(turn) {
  const container = $("#conversation");
  if (!container) return;

  const article = document.createElement("article");
  article.className = "conversation-turn";
  article.dataset.questionId = turn.questionId;

  const questionHeading = document.createElement("h3");
  questionHeading.textContent = "質問";

  const questionText = document.createElement("p");
  questionText.className = "question-text";
  questionText.textContent = turn.question || "";

  const answerHeading = document.createElement("h3");
  answerHeading.textContent = "AIの回答";

  const answerText = document.createElement("div");
  answerText.className = "answer-text";
  answerText.textContent =
    turn.answer || (turn.status === "error"
      ? "この質問への回答は取得できませんでした。質問をもう一度送信してください。"
      : "回答を読み込んでいます...");

  const idText = document.createElement("small");
  idText.className = "answer-id";
  idText.textContent = `質問ID：${turn.questionId}`;

  if (turn.answerId) {
    idText.textContent += ` ／ 回答ID：${turn.answerId}`;
  }

  article.append(
    questionHeading,
    questionText,
    answerHeading,
    answerText,
    idText
  );

  container.append(article);
}

function replaceRenderedTurn(turn) {
  const container = $("#conversation");
  if (!container) return;

  const old = container.querySelector(
    `[data-question-id="${CSS.escape(turn.questionId)}"]`
  );

  if (old) old.remove();
  renderTurn(turn);
}

function renderAllTurns() {
  const container = $("#conversation");
  if (!container) return;

  container.replaceChildren();

  for (const turn of turns) {
    renderTurn(turn);
  }

  showWelcome(turns.length === 0);
}

function turnsCollectionRef(id = conversationId) {
  return collection(db, "chatHistories", id, "turns");
}

async function createConversation(firstQuestion = "") {
  const ref = doc(collection(db, "chatHistories"));
  conversationId = ref.id;

  await setDoc(ref, {
    conversationId,
    userId: currentUser.uid,
    title: firstQuestion.slice(0, 80) || "新しい会話",
    lastQuestion: firstQuestion,
    turnCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  updateConversationUrl();
  return conversationId;
}

function updateConversationUrl() {
  if (!conversationId) return;

  const url = new URL(location.href);
  url.searchParams.set("conversationId", conversationId);
  history.replaceState({}, "", url);
}

async function loadConversation(id) {
  const conversationRef = doc(db, "chatHistories", id);
  const conversationSnapshot = await getDoc(conversationRef);

  if (!conversationSnapshot.exists()) {
    throw new Error("指定された会話が見つかりません。");
  }

  const data = conversationSnapshot.data();

  if (data.userId !== currentUser.uid) {
    throw new Error("この会話を開く権限がありません。");
  }

  conversationId = id;

  const turnsQuery = query(
    turnsCollectionRef(id),
    orderBy("createdAt", "asc"),
    limit(200)
  );

  const turnSnapshot = await getDocs(turnsQuery);

  turns = turnSnapshot.docs.map((item) => ({
    ...item.data(),
    questionId: item.data().questionId || item.id
  }));

  updateConversationUrl();
  renderAllTurns();
}

async function saveQuestionTurn(turn) {
  const ref = doc(
    db,
    "chatHistories",
    conversationId,
    "turns",
    turn.questionId
  );

  await setDoc(ref, {
    conversationId,
    userId: currentUser.uid,
    questionId: turn.questionId,
    answerId: turn.answerId,
    subject: turn.subject,
    question: turn.question,
    answer: "",
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await updateDoc(doc(db, "chatHistories", conversationId), {
    lastQuestion: turn.question,
    updatedAt: serverTimestamp()
  });
}

async function saveAnswerTurn(turn, answer) {
  const ref = doc(
    db,
    "chatHistories",
    conversationId,
    "turns",
    turn.questionId
  );

  await updateDoc(ref, {
    answer,
    status: "completed",
    updatedAt: serverTimestamp()
  });

  const parentRef = doc(db, "chatHistories", conversationId);
  const parentSnapshot = await getDoc(parentRef);

  if (!parentSnapshot.exists()) {
    throw new Error("会話データが見つかりません。");
  }

  await updateDoc(parentRef, {
    lastQuestion: turn.question,
    lastAnswer: answer.slice(0, 500),
    turnCount: turns.length,
    updatedAt: serverTimestamp()
  });
}

async function markTurnFailed(turn, message) {
  const ref = doc(
    db,
    "chatHistories",
    conversationId,
    "turns",
    turn.questionId
  );

  try {
    await updateDoc(ref, {
      status: "error",
      errorMessage: message.slice(0, 500),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("質問の失敗状態を保存できませんでした:", error);
  }
}

function makeChatContext() {
  return turns
    .filter((turn) => turn.status === "completed" && turn.answer)
    .slice(-12)
    .map((turn) => ({
      question: turn.question,
      answer: turn.answer
    }));
}

async function requestAI(subject, question) {
  const token = await currentUser.getIdToken();

  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      subject,
      question,
      history: makeChatContext(),
      conversationId
    })
  });

  const responseText = await response.text();

  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error(
      `AIサーバーから正しい応答が返りませんでした（HTTP ${response.status}）。`
    );
  }

  if (!response.ok) {
    throw new Error(
      payload.error || `AI通信エラー（HTTP ${response.status}）`
    );
  }

  if (typeof payload.answer !== "string" || !payload.answer.trim()) {
    throw new Error("AIの回答が空でした。もう一度お試しください。");
  }

  return payload.answer.trim();
}

async function sendQuestion(event) {
  event.preventDefault();

  if (isSending || !currentUser) return;

  const input = $("#questionInput");
  const subjectSelect = $("#subjectSelect");

  const question = input?.value.trim() || "";
  const subject = subjectSelect?.value || "指定なし";

  if (!question) {
    showStatus("質問を入力してください。", "error");
    input?.focus();
    return;
  }

  if (question.length > 4000) {
    showStatus("質問は4000文字以内で入力してください。", "error");
    return;
  }

  setSending(true);
  showStatus("質問を保存しています...");

  const turn = {
    questionId: makeId(),
    answerId: makeId(),
    subject,
    question,
    answer: "",
    status: "pending"
  };

  try {
    if (!conversationId) {
      await createConversation(question);
    }

    // 質問を先に保存し、AI通信が失敗しても質問を失わない。
    await saveQuestionTurn(turn);

    turns.push(turn);
    renderTurn(turn);
    showWelcome(false);

    input.value = "";
    showStatus("AIが回答を作成しています...");

    const answer = await requestAI(subject, question);

    turn.answer = answer;
    turn.status = "completed";

    // 回答本文をFirestoreへ保存してから画面を更新する。
    await saveAnswerTurn(turn, answer);

    replaceRenderedTurn(turn);
    showStatus("回答を保存しました。", "success");
  } catch (error) {
    console.error("質問処理エラー:", error);

    const message = error?.message || "不明なエラーが発生しました。";

    if (turns.some((item) => item.questionId === turn.questionId)) {
      turn.status = "error";
      turn.answer = "";
      replaceRenderedTurn(turn);
      await markTurnFailed(turn, message);
    }

    showStatus(
      `処理に失敗しました：${message}`,
      "error"
    );
  } finally {
    setSending(false);
    input?.focus();
  }
}

async function startNewConversation() {
  if (isSending) return;

  conversationId = null;
  turns = [];

  const url = new URL(location.href);
  url.searchParams.delete("conversationId");
  history.replaceState({}, "", url);

  const container = $("#conversation");
  if (container) container.replaceChildren();

  if ($("#questionInput")) $("#questionInput").value = "";

  showWelcome(true);
  showStatus("新しい会話を開始できます。", "success");
}

async function loadRecentSidebarHistory() {
  const container = $("#recent-history");
  if (!container || !currentUser) return;

  container.replaceChildren();

  try {
    const historyQuery = query(
      collection(db, "chatHistories"),
      orderBy("updatedAt", "desc"),
      limit(30)
    );

    const snapshot = await getDocs(historyQuery);

    const owned = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.userId === currentUser.uid);

    if (owned.length === 0) {
      container.textContent = "まだ会話履歴はありません。";
      return;
    }

    for (const item of owned) {
      const link = document.createElement("a");
      link.className = "history-link";
      link.href = `question.html?conversationId=${encodeURIComponent(item.id)}`;
      link.textContent = item.title || item.lastQuestion || "会話";
      container.append(link);
    }
  } catch (error) {
    console.error("最近の履歴を読み込めませんでした:", error);
    container.textContent = "履歴を読み込めませんでした。";
  }
}

async function initializePage() {
  setupSidebar();
  setupLogout(auth, signOut);

  $("#questionForm")?.addEventListener("submit", sendQuestion);
  $("#newChatButton")?.addEventListener("click", startNewConversation);

  if ($("#subjectSelect")) {
    $("#subjectSelect").replaceChildren();

    for (const subject of SUBJECTS) {
      const option = document.createElement("option");
      option.value = subject;
      option.textContent = subject;
      $("#subjectSelect").append(option);
    }
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.replace("../login.html");
      return;
    }

    currentUser = user;

    try {
      const profileSnapshot = await getDoc(doc(db, "users", user.uid));

      if (!profileSnapshot.exists()) {
        throw new Error("ユーザー情報が登録されていません。");
      }

      currentProfile = profileSnapshot.data();

      if (currentProfile.status !== "active") {
        await signOut(auth);
        location.replace("../login.html");
        return;
      }

      await loadRecentSidebarHistory();

      if (requestedConversationId) {
        await loadConversation(requestedConversationId);
      } else {
        conversationId = null;
        turns = [];
        renderAllTurns();
      }
    } catch (error) {
      console.error("初期化エラー:", error);
      showStatus(error.message || "ページを初期化できませんでした。", "error");
    }
  });
}

initializePage();
