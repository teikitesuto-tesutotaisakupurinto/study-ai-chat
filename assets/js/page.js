import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "./firebase.js";


function getHistoryCollection() {
  return collection(db, "chatHistories");
}


function getMessageCollection(conversationId) {
  return collection(
    db,
    "chatHistories",
    conversationId,
    "messages"
  );
}


function createConversationId() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  return (
    "conversation_" +
    Date.now().toString(36) +
    "_" +
    Math.random()
      .toString(36)
      .slice(2)
  );
}


function createAnswerId() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  return (
    "answer_" +
    Date.now().toString(36) +
    "_" +
    Math.random()
      .toString(36)
      .slice(2)
  );
}


export async function initPage(options = {}) {

  const role =
    options.role ||
    document.body.dataset.role ||
    "";

  if (
    role !== "student" &&
    role !== "admin"
  ) {
    throw new Error(
      "ページのrole設定が正しくありません。"
    );
  }

  document.body.dataset.initialized = "true";

  return {
    role,
    user: options.user || null,
    profile: options.profile || null
  };
}


export async function createConversation(
  userId,
  title = "新しい会話"
) {

  if (!userId) {
    throw new Error(
      "ユーザーIDがありません。"
    );
  }

  const conversationId =
    createConversationId();

  await setDoc(
    doc(
      db,
      "chatHistories",
      conversationId
    ),
    {
      conversationId,
      userId,
      title,
      lastQuestion: "",
      lastAnswer: "",
      messageCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );

  return conversationId;
}


export async function saveConversationMessage(
  userId,
  conversationId,
  message
) {

  if (!userId) {
    throw new Error(
      "ユーザーIDがありません。"
    );
  }

  if (!conversationId) {
    throw new Error(
      "会話IDがありません。"
    );
  }

  if (!message || !message.content) {
    throw new Error(
      "保存するメッセージがありません。"
    );
  }

  const conversationRef =
    doc(
      db,
      "chatHistories",
      conversationId
    );

  const conversationSnap =
    await getDoc(
      conversationRef
    );

  if (!conversationSnap.exists()) {

    await setDoc(
      conversationRef,
      {
        conversationId,
        userId,
        title:
          message.role === "user"
            ? message.content.slice(0, 40)
            : "新しい会話",
        lastQuestion:
          message.role === "user"
            ? message.content
            : "",
        lastAnswer:
          message.role === "assistant"
            ? message.content
            : "",
        messageCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

  } else {

    const existing =
      conversationSnap.data();

    if (
      existing.userId &&
      existing.userId !== userId
    ) {
      throw new Error(
        "この会話を保存する権限がありません。"
      );
    }
  }

  const answerId =
    message.answerId ||
    createAnswerId();

  const messageRef =
    doc(
      getMessageCollection(conversationId),
      answerId
    );

  await setDoc(
    messageRef,
    {
      answerId,
      conversationId,
      userId,
      role:
        message.role === "assistant"
          ? "assistant"
          : "user",
      content:
        String(message.content),
      createdAt:
        serverTimestamp()
    }
  );

  const conversationData = {
    updatedAt:
      serverTimestamp()
  };

  if (message.role === "user") {
    conversationData.lastQuestion =
      message.content;
  }

  if (message.role === "assistant") {
    conversationData.lastAnswer =
      message.content;
  }

  const currentCount =
    conversationSnap.exists()
      ? Number(
          conversationSnap.data().messageCount || 0
        )
      : 0;

  conversationData.messageCount =
    currentCount + 1;

  await setDoc(
    conversationRef,
    conversationData,
    {
      merge: true
    }
  );

  return {
    answerId
  };
}


export async function loadConversationHistory(
  userId,
  conversationId
) {

  if (!userId) {
    throw new Error(
      "ユーザーIDがありません。"
    );
  }

  if (!conversationId) {
    return {
      conversationId: null,
      messages: []
    };
  }

  const conversationSnap =
    await getDoc(
      doc(
        db,
        "chatHistories",
        conversationId
      )
    );

  if (!conversationSnap.exists()) {
    return {
      conversationId,
      messages: []
    };
  }

  const conversation =
    conversationSnap.data();

  if (conversation.userId !== userId) {
    throw new Error(
      "この会話を閲覧する権限がありません。"
    );
  }

  const messagesQuery =
    query(
      getMessageCollection(conversationId),
      orderBy("createdAt", "asc")
    );

  const messagesSnap =
    await getDocs(
      messagesQuery
    );

  const messages =
    messagesSnap.docs.map(
      item => {

        const data =
          item.data();

        return {
          answerId:
            data.answerId ||
            item.id,

          conversationId:
            data.conversationId ||
            conversationId,

          role:
            data.role || "assistant",

          content:
            data.content || "",

          createdAt:
            data.createdAt || null
        };
      }
    );

  return {
    conversationId,
    title:
      conversation.title ||
      "会話",
    messages
  };
}


export async function getRecentConversations(
  userId
) {

  if (!userId) {
    return [];
  }

  const q =
    query(
      getHistoryCollection(),
      where(
        "userId",
        "==",
        userId
      ),
      orderBy(
        "updatedAt",
        "desc"
      ),
      limit(20)
    );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...item.data()
    })
  );
}


export async function getConversation(
  userId,
  conversationId
) {

  const snapshot =
    await getDoc(
      doc(
        db,
        "chatHistories",
        conversationId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  const data =
    snapshot.data();

  if (data.userId !== userId) {
    throw new Error(
      "この会話を閲覧する権限がありません。"
    );
  }

  return {
    id: snapshot.id,
    ...data
  };
}


/*
 * AI呼び出し
 *
 * GitHub Pagesから直接秘密鍵を置かない。
 * 実際のAI処理はCloud Functions等の
 * サーバー側エンドポイントへ送る。
 */
export async function askStudyAI(payload) {

  if (!payload) {
    throw new Error(
      "AIへの送信データがありません。"
    );
  }

  const {
    userId,
    conversationId,
    answerId,
    question,
    messages
  } = payload;

  if (!userId) {
    throw new Error(
      "ユーザーIDがありません。"
    );
  }

  if (!conversationId) {
    throw new Error(
      "会話IDがありません。"
    );
  }

  if (!answerId) {
    throw new Error(
      "回答IDがありません。"
    );
  }

  if (!question) {
    throw new Error(
      "質問内容がありません。"
    );
  }


  /*
   * Cloud Functions等の実際のAPI URLに置き換える。
   *
   * ここにOpenAI等の秘密APIキーを書かない。
   */

  const endpoint =
    window.STUDY_AI_ENDPOINT ||
    "";

  if (!endpoint) {

    throw new Error(
      "AIサーバーの接続先が設定されていません。"
    );
  }


  const response =
    await fetch(
      endpoint,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            userId,
            conversationId,
            answerId,
            question,

            messages:
              Array.isArray(messages)
                ? messages.map(
                    message => ({
                      answerId:
                        message.answerId || null,

                      role:
                        message.role,

                      content:
                        message.content
                    })
                  )
                : []
          })
      }
    );


  if (!response.ok) {

    const text =
      await response.text();

    throw new Error(
      `AIサーバーエラー (${response.status})\n${text}`
    );
  }


  const data =
    await response.json();


  if (
    !data ||
    typeof data.answer !== "string"
  ) {
    throw new Error(
      "AIサーバーから正しい回答形式が返されませんでした。"
    );
  }


  return {
    answer:
      data.answer,

    answerId:
      data.answerId ||
      answerId,

    conversationId:
      data.conversationId ||
      conversationId
  };
}
