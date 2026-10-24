// assets/js/question.js

import {
  auth,
  db,
  persistenceReady,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp
} from "./firebase.js";

const loading =
  document.getElementById(
    "questionLoading"
  );

const chatSection =
  document.getElementById(
    "chatSection"
  );

const messageList =
  document.getElementById(
    "messageList"
  );

const form =
  document.getElementById(
    "questionForm"
  );

const input =
  document.getElementById(
    "questionInput"
  );

const sendButton =
  document.getElementById(
    "sendButton"
  );

const status =
  document.getElementById(
    "questionStatus"
  );

const titleElement =
  document.getElementById(
    "conversationTitle"
  );

let currentUser = null;
let currentProfile = null;
let conversationId = null;

const params =
  new URLSearchParams(
    window.location.search
  );

const requestedConversationId =
  params.get(
    "conversationId"
  );

const requestedAnswerId =
  params.get(
    "answerId"
  );

function setStatus(text) {
  status.textContent =
    text || "";
}

function showChat() {
  loading.hidden = true;
  chatSection.hidden = false;
}

function showLoading(text) {
  loading.hidden = false;
  loading.textContent = text;
  chatSection.hidden = true;
}

function showError(message) {
  showLoading(
    message
  );
}

function createMessageElement(
  message
) {
  const wrapper =
    document.createElement(
      "article"
    );

  wrapper.className =
    `chat-message ${
      message.role === "user"
        ? "message-user"
        : "message-ai"
    }`;

  if (
    message.answerId
  ) {
    wrapper.dataset.answerId =
      message.answerId;
  }

  const role =
    document.createElement(
      "div"
    );

  role.className =
    "message-role";

  role.textContent =
    message.role === "user"
      ? "あなた"
      : "学習AI";

  const content =
    document.createElement(
      "div"
    );

  content.className =
    "message-content";

  content.textContent =
    message.content || "";

  wrapper.append(
    role,
    content
  );

  return wrapper;
}

function renderMessage(
  message
) {
  messageList.append(
    createMessageElement(
      message
    )
  );

  messageList.scrollTop =
    messageList.scrollHeight;
}

async function createConversation(
  user
) {
  const conversationRef =
    await addDoc(
      collection(
        db,
        "chatConversations"
      ),
      {
        userId: user.uid,
        title: "新しい学習",
        createdAt:
          serverTimestamp(),
        updatedAt:
          serverTimestamp()
      }
    );

  conversationId =
    conversationRef.id;

  titleElement.textContent =
    "新しい学習";

  return conversationId;
}

async function loadConversation(
  user,
  id
) {
  const conversationSnap =
    await getDoc(
      doc(
        db,
        "chatConversations",
        id
      )
    );

  if (
    !conversationSnap.exists()
  ) {
    throw new Error(
      "指定された会話が見つかりません。"
    );
  }

  const conversation =
    conversationSnap.data();

  if (
    conversation.userId !==
    user.uid
  ) {
    throw new Error(
      "この会話を開く権限がありません。"
    );
  }

  conversationId = id;

  titleElement.textContent =
    conversation.title ||
    "学習AIとの会話";

  const messagesQuery =
    query(
      collection(
        db,
        "chatMessages"
      ),
      where(
        "conversationId",
        "==",
        id
      ),
      orderBy(
        "createdAt",
        "asc"
      )
    );

  const snapshot =
    await getDocs(
      messagesQuery
    );

  messageList.replaceChildren();

  snapshot.forEach(
    item => {
      const data =
        item.data();

      renderMessage({
        id: item.id,
        ...data
      });
    }
  );
}

async function initializeConversation(
  user
) {
  if (
    requestedConversationId
  ) {
    await loadConversation(
      user,
      requestedConversationId
    );

    return;
  }

  await createConversation(
    user
  );
}

function createAnswerId() {
  return (
    "ans_" +
    Date.now().toString(36) +
    "_" +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}

async function saveUserMessage(
  content
) {
  const answerId =
    createAnswerId();

  await addDoc(
    collection(
      db,
      "chatMessages"
    ),
    {
      conversationId,
      userId:
        currentUser.uid,
      role: "user",
      content,
      answerId,
      createdAt:
        serverTimestamp()
    }
  );

  return answerId;
}

async function saveAIMessage(
  content,
  answerId
) {
  await addDoc(
    collection(
      db,
      "chatMessages"
    ),
    {
      conversationId,
      userId:
        currentUser.uid,
      role: "assistant",
      content,
      answerId,
      createdAt:
        serverTimestamp()
    }
  );
}

async function updateConversationTitle(
  question
) {
  if (!conversationId) {
    return;
  }

  const title =
    question
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);

  if (!title) {
    return;
  }

  await setDoc(
    doc(
      db,
      "chatConversations",
      conversationId
    ),
    {
      title,
      updatedAt:
        serverTimestamp()
    },
    {
      merge: true
    }
  );

  titleElement.textContent =
    title;
}

async function generateAIAnswer(
  question,
  previousAnswerId = null
) {
  /*
   * ここはAI API接続部分。
   *
   * FirebaseだけではAI回答そのものは生成できません。
   * Cloud Functions等のバックエンドを接続する場合は、
   * この関数から安全なAPIへリクエストします。
   *
   * 現在は動作確認用のフォールバック回答です。
   */

  if (
    previousAnswerId
  ) {
    return (
      "前の回答をもとに、続きの質問として受け取りました。\n\n" +
      "AI回答APIが接続されると、この場所に実際の学習AIの回答が表示されます。"
    );
  }

  return (
    "質問を受け取りました。\n\n" +
    "AI回答APIを接続すると、ここに学習内容に合わせた回答が表示されます。"
  );
}

async function sendQuestion() {
  const question =
    input.value.trim();

  if (
    !question ||
    !conversationId ||
    !currentUser
  ) {
    return;
  }

  sendButton.disabled =
    true;

  input.disabled =
    true;

  setStatus(
    "回答を生成しています..."
  );

  try {
    const answerId =
      await saveUserMessage(
        question
      );

    renderMessage({
      role: "user",
      content: question,
      answerId
    });

    await updateConversationTitle(
      question
    );

    input.value = "";

    const aiAnswer =
      await generateAIAnswer(
        question,
        requestedAnswerId
      );

    await saveAIMessage(
      aiAnswer,
      answerId
    );

    renderMessage({
      role: "assistant",
      content: aiAnswer,
      answerId
    });

    setStatus(
      "回答を保存しました。"
    );

  } catch (error) {
    console.error(
      "質問処理エラー:",
      error
    );

    setStatus(
      "回答の保存に失敗しました。"
    );

    const errorMessage =
      document.createElement(
        "div"
      );

    errorMessage.className =
      "question-error";

    errorMessage.textContent =
      `処理に失敗しました。\n${
        error.message ||
        String(error)
      }`;

    messageList.append(
      errorMessage
    );

  } finally {
    sendButton.disabled =
      false;

    input.disabled =
      false;

    input.focus();
  }
}

async function initialize() {
  showLoading(
    "学習AIチャットを準備しています。"
  );

  try {
    await persistenceReady;

    const user =
      await new Promise(
        (resolve, reject) => {
          let unsubscribe;

          unsubscribe =
            onAuthStateChanged(
              auth,
              current => {
                if (unsubscribe) {
                  unsubscribe();
                }

                resolve(
                  current
                );
              },
              error => {
                if (unsubscribe) {
                  unsubscribe();
                }

                reject(
                  error
                );
              }
            );
        }
      );

    if (!user) {
      window.location.replace(
        "../login.html"
      );

      return;
    }

    currentUser =
      user;

    const profileSnap =
      await getDoc(
        doc(
          db,
          "users",
          user.uid
        )
      );

    if (
      !profileSnap.exists()
    ) {
      throw new Error(
        "ユーザープロフィールがありません。"
      );
    }

    currentProfile =
      profileSnap.data();

    if (
      currentProfile.role !==
      "student"
    ) {
      throw new Error(
        "この画面は生徒アカウント専用です。"
      );
    }

    if (
      currentProfile.status !==
      "active"
    ) {
      throw new Error(
        "このアカウントは現在利用できません。"
      );
    }

    await initializeConversation(
      user
    );

    showChat();

    input.focus();

  } catch (error) {
    console.error(
      "質問画面初期化エラー:",
      error
    );

    showError(
      "質問画面を初期化できませんでした。\n" +
      (error.message ||
        String(error))
    );
  }
}

form.addEventListener(
  "submit",
  event => {
    event.preventDefault();

    sendQuestion();
  }
);

initialize();
