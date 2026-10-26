
/*
 * assets/js/question.js
 *
 * 学習AIチャット専用
 *
 * 対応:
 * - student/question.html
 * - assets/js/layout.js
 * - assets/js/firebase-module.js
 * - assets/js/ai.js
 *
 * 仕様:
 * - ユーザーの質問は右側
 * - AIの回答は左側
 * - AI待機中は「・・・」だけ
 * - 「学習AIを準備しています。」は表示しない
 * - 絵文字を使用しない
 * - Enterで送信
 * - Shift + Enterで改行
 * - 新しい質問
 * - 会話履歴の読み込み
 * - Firestore権限エラーがあってもAI通信自体は止めない
 */

import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from "./firebase-module.js";

import { askAI } from "./ai.js";


/* =========================================
   設定
========================================= */

const ALLOWED_SUBJECTS = [
  "国語",
  "数学",
  "英語",
  "理科",
  "社会",
  "音楽",
  "美術",
  "保健体育",
  "技術家庭"
];

const NON_STUDY_RESPONSE =
  "このAIは学習専用です。学習以外の質問には対応していません。";

const MAX_HISTORY_FOR_AI = 12;

const LOCAL_HISTORY_KEY =
  "studyAIChatLocalHistory";


/* =========================================
   DOM
========================================= */

const $ = (id) =>
  document.getElementById(id);


const conversation =
  $("conversation");

const welcomeMessage =
  $("welcomeMessage");

const questionForm =
  $("questionForm");

const questionInput =
  $("questionInput");

const subjectSelect =
  $("subjectSelect");

const sendButton =
  $("sendButton");

const newQuestionButton =
  $("newQuestionButton");

const questionError =
  $("questionError");


/* =========================================
   状態
========================================= */

let currentUser = null;

let currentProfile = null;

let currentConversationId = null;

let turns = [];

let sending = false;

let typingElement = null;

let authResolved = false;


/* =========================================
   初期確認
========================================= */

if (!conversation) {
  console.error(
    "question.js: #conversation がありません。"
  );
}

if (!questionForm) {
  console.error(
    "question.js: #questionForm がありません。"
  );
}

if (!questionInput) {
  console.error(
    "question.js: #questionInput がありません。"
  );


}


/* =========================================
   エラー表示
========================================= */

function showError(
  message
) {

  if (!questionError) {
    console.error(
      message
    );

    return;
  }


  questionError.textContent =
    String(message || "エラーが発生しました。");


  questionError.hidden =
    false;

}


function hideError() {

  if (!questionError) {
    return;
  }


  questionError.textContent =
    "";


  questionError.hidden =
    true;

}


/* =========================================
   エラー文字列
========================================= */

function explainError(
  error
) {

  if (!error) {
    return "不明なエラーが発生しました。";
  }


  const code =
    error.code || "";


  const raw =
    error.message ||
    String(error);


  if (
    code === "permission-denied" ||
    /Missing or insufficient permissions/i.test(
      raw
    )
  ) {

    return (
      "学習AIの利用権限を確認できませんでした。\n" +
      "ただし、質問処理自体はFirestoreの履歴保存とは分離しています。\n\n" +
      raw
    );

  }


  if (
    code === "unauthenticated" ||
    /ログインが必要/i.test(raw) ||
    /not authenticated/i.test(raw)
  ) {

    return (
      "ログイン状態を確認できません。\n" +
      "ログイン後にもう一度質問してください。"
    );

  }


  if (
    code === "network-request-failed" ||
    /network/i.test(raw)
  ) {

    return (
      "ネットワーク接続を確認してください。\n\n" +
      raw
    );

  }


  return raw;

}


/* =========================================
   認証
========================================= */

function waitForCurrentUser() {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      let unsubscribe =
        null;

      let finished =
        false;


      const timer =
        setTimeout(
          () => {

            finish(
              new Error(
                "ログイン状態の確認が完了しませんでした。"
              )
            );

          },
          15000
        );


      function finish(
        error,
        user
      ) {

        if (finished) {
          return;
        }


        finished =
          true;


        clearTimeout(
          timer
        );


        if (unsubscribe) {

          try {

            unsubscribe();

          } catch {}

          unsubscribe =
            null;

        }


        if (error) {

          reject(
            error
          );

        } else {

          resolve(
            user || null
          );

        }

      }


      try {

        unsubscribe =
          onAuthStateChanged(
            auth,
            (
              user
            ) => {

              finish(
                null,
                user
              );

            },
            (
              error
            ) => {

              finish(
                error
              );

            }
          );


      } catch (
        error
      ) {

        finish(
          error
        );

      }

    }
  );

}


/* =========================================
   プロフィール
========================================= */

async function loadProfile(
  user
) {

  if (
    !user ||
    !user.uid
  ) {

    return null;

  }


  try {

    const reference =
      doc(
        db,
        "users",
        user.uid
      );


    const snapshot =
      await getDoc(
        reference
      );


    if (
      !snapshot ||
      !snapshot.exists()
    ) {

      return null;

    }


    return snapshot.data();

  } catch (
    error
  ) {

    /*
     * プロフィール取得失敗で
     * AI質問まで止めない。
     */

    console.warn(
      "プロフィール取得をスキップしました:",
      error
    );


    return null;

  }

}


/* =========================================
   送信状態
========================================= */

function setSending(
  value
) {

  sending =
    Boolean(value);


  if (sendButton) {

    sendButton.disabled =
      sending;


    sendButton.textContent =
      sending
        ? "回答を待っています"
        : "質問する";

  }


  if (questionInput) {

    questionInput.disabled =
      sending;

  }


  if (subjectSelect) {

    subjectSelect.disabled =
      sending;

  }


  if (newQuestionButton) {

    newQuestionButton.disabled =
      sending;

  }

}


/* =========================================
   Welcome
========================================= */

function showWelcome() {

  if (!conversation) {
    return;
  }


  if (!welcomeMessage) {
    return;
  }


  conversation.replaceChildren(
    welcomeMessage
  );


  welcomeMessage.hidden =
    false;

}


/* =========================================
   メッセージ生成
========================================= */

function createMessageElement(
  role,
  text,
  options = {}
) {

  const article =
    document.createElement(
      "article"
    );


  article.className =
    `message ${role}`;


  if (
    options.error
  ) {

    article.classList.add(
      "error"
    );

  }


  const label =
    document.createElement(
      "span"
    );


  label.className =
    "message-role";


  if (
    role === "user"
  ) {

    label.textContent =
      "あなた";

  } else if (
    role === "assistant"
  ) {

    label.textContent =
      "学習AI";

  } else {

    label.textContent =
      "システム";

  }


  const content =
    document.createElement(
      "div"
    );


  content.className =
    "message-content";


  content.textContent =
    String(
      text ?? ""
    );


  article.append(
    label,
    content
  );


  return article;

}


/* =========================================
   メッセージ表示
========================================= */

function renderMessage(
  role,
  text,
  options = {}
) {

  if (!conversation) {
    return null;
  }


  if (
    welcomeMessage &&
    !welcomeMessage.hidden
  ) {

    welcomeMessage.hidden =
      true;

  }


  const element =
    createMessageElement(
      role,
      text,
      options
    );


  conversation.append(
    element
  );


  requestAnimationFrame(
    () => {

      conversation.scrollTop =
        conversation.scrollHeight;

    }
  );


  return element;

}


/* =========================================
   AI待機
========================================= */

function showTyping() {

  hideTyping();


  if (!conversation) {
    return;
  }


  typingElement =
    document.createElement(
      "div"
    );


  typingElement.className =
    "typing";


  /*
   * question.html のCSS側で
   * 「・・・」をアニメーションさせる。
   *
   * ここでは文字を入れない。
   * これにより
   * 「学習AIが回答を作成しています...」
   * は絶対に表示されない。
   */

  typingElement.setAttribute(
    "aria-label",
    "回答を待っています"
  );


  conversation.append(
    typingElement
  );


  requestAnimationFrame(
    () => {

      conversation.scrollTop =
        conversation.scrollHeight;

    }
  );

}


function hideTyping() {

  if (
    typingElement
  ) {

    typingElement.remove();

    typingElement =
      null;

  }

}


/* =========================================
   教科
========================================= */

function getSubject() {

  const value =
    subjectSelect?.value ||
    "数学";


  if (
    ALLOWED_SUBJECTS.includes(
      value
    )
  ) {

    return value;

  }


  return "数学";

}


/* =========================================
   質問の正規化
========================================= */

function normalizeQuestion(
  value
) {

  return String(
    value || ""
  )
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

}


/* =========================================
   学習質問かどうか
========================================= */

function looksLikeStudyQuestion(
  question
) {

  const text =
    question.toLowerCase();


  const studyWords = [

    "問題",
    "数学",
    "国語",
    "英語",
    "理科",
    "社会",
    "歴史",
    "地理",
    "文法",
    "単語",
    "計算",
    "方程式",
    "関数",
    "図形",
    "比例",
    "反比例",
    "証明",
    "化学",
    "物理",
    "生物",
    "地学",
    "漢字",
    "作文",
    "読解",
    "テスト",
    "宿題",
    "勉強",
    "授業",
    "教科書",
    "覚え方",
    "解き方",
    "意味",
    "なぜ",
    "どうして",
    "分からない",
    "わからない",
    "教えて",
    "解説",
    "答え",
    "求める",
    "求め方"

  ];


  /*
   * 短い質問はAI側に判定させる。
   */

  if (
    text.length <= 8
  ) {

    return true;

  }


  return studyWords.some(
    word =>
      text.includes(
        word
      )
  );

}


/* =========================================
   会話ID
========================================= */

function generateConversationId() {

  const timestamp =
    Date.now()
      .toString(36);


  const random =
    Math.random()
      .toString(36)
      .slice(2, 10);


  return (
    `${timestamp}-${random}`
  );

}


/* =========================================
   URL
========================================= */

function getConversationIdFromUrl() {

  try {

    const params =
      new URLSearchParams(
        location.search
      );


    return (
      params.get(
        "conversationId"
      ) || ""
    );

  } catch {

    return "";

  }

}


function updateConversationUrl(
  id
) {

  try {

    const url =
      new URL(
        location.href
      );


    if (id) {

      url.searchParams.set(
        "conversationId",
        id
      );

    } else {

      url.searchParams.delete(
        "conversationId"
      );

    }


    history.replaceState(
      null,
      "",
      url.pathname +
      url.search +
      url.hash
    );

  } catch {}

}


/* =========================================
   会話タイトル
========================================= */

function makeConversationTitle(
  question
) {

  const compact =
    question
      .replace(/\s+/g, " ")
      .trim();


  if (
    compact.length <= 30
  ) {

    return compact;

  }


  return (
    compact.slice(0, 30) +
    "…"
  );

}


/* =========================================
   ローカル履歴
========================================= */

function getLocalHistory() {

  try {

    const raw =
      localStorage.getItem(
        LOCAL_HISTORY_KEY
      );


    if (!raw) {
      return {};
    }


    const parsed =
      JSON.parse(
        raw
      );


    if (
      !parsed ||
      typeof parsed !== "object"
    ) {

      return {};

    }


    return parsed;

  } catch {

    return {};

  }

}


function saveLocalHistory() {

  try {

    const all =
      getLocalHistory();


    if (
      !currentConversationId
    ) {

      return;

    }


    all[
      currentConversationId
    ] = {

      userId:
        currentUser?.uid || "",

      title:
        makeConversationTitle(
          turns[0]?.question ||
          "学習AIとの会話"
        ),

      subject:
        turns[0]?.subject ||
        getSubject(),

      turns:
        turns.map(
          turn => ({

            question:
              turn.question,

            answer:
              turn.answer,

            subject:
              turn.subject,

            status:
              turn.status

          })
        ),

      updatedAt:
        Date.now()

    };


    localStorage.setItem(
      LOCAL_HISTORY_KEY,
      JSON.stringify(all)
    );


  } catch (
    error
  ) {

    console.warn(
      "ローカル履歴保存をスキップしました:",
      error
    );

  }

}


/* =========================================
   Firestore会話参照
========================================= */

function conversationRef(
  id
) {

  return doc(
    db,
    "chatHistories",
    id
  );

}


function turnsCollectionRef(
  id
) {

  return collection(
    db,
    "chatHistories",
    id,
    "turns"
  );

}


/* =========================================
   Firestore保存
   失敗してもAI回答は止めない
========================================= */

async function ensureConversation(
  question,
  subject
) {

  if (
    !currentUser
  ) {

    return null;

  }


  if (
    currentConversationId
  ) {

    return currentConversationId;

  }


  const id =
    generateConversationId();


  const data = {

    userId:
      currentUser.uid,

    title:
      makeConversationTitle(
        question
      ),

    subject,

    lastQuestion:
      question,

    lastAnswer:
      "",

    turnCount:
      0,

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp()

  };


  try {

    await setDoc(
      conversationRef(id),
      data
    );


    currentConversationId =
      id;


    updateConversationUrl(
      id
    );


    return id;

  } catch (
    error
  ) {

    /*
     * permission-deniedでも
     * AIを止めない。
     */

    console.warn(
      "Firestore会話作成をスキップしました:",
      error
    );


    /*
     * 履歴保存なしでも
     * 画面上の会話は継続できるように
     * ローカルIDを使用する。
     */

    currentConversationId =
      id;


    updateConversationUrl(
      id
    );


    return id;

  }

}


/* =========================================
   質問保存
========================================= */

async function saveTurn(
  question,
  subject,
  answer,
  status = "completed"
) {

  const localTurn = {

    questionId:
      generateConversationId(),

    answerId:
      generateConversationId(),

    subject,

    question,

    answer,

    status,

    createdAt:
      Date.now()

  };


  turns.push(
    localTurn
  );


  /*
   * まずローカルに保存。
   */

  saveLocalHistory();


  /*
   * Firestoreはベストエフォート。
   */

  if (
    !currentUser
  ) {

    return localTurn;

  }


  try {

    const conversationId =
      await ensureConversation(
        question,
        subject
      );


    if (!conversationId) {
      return localTurn;
    }


    const turnReference =
      doc(
        turnsCollectionRef(
          conversationId
        )
      );


    await setDoc(
      turnReference,
      {

        questionId:
          turnReference.id,

        answerId:
          localTurn.answerId,

        conversationId,

        userId:
          currentUser.uid,

        subject,

        question,

        answer,

        status,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()

      }
    );


    try {

      await updateDoc(
        conversationRef(
          conversationId
        ),
        {

          title:
            makeConversationTitle(
              question
            ),

          subject,

          lastQuestion:
            question,

          lastAnswer:
            answer,

          turnCount:
            turns.length,

          updatedAt:
            serverTimestamp()

        }
      );

    } catch (
      updateError
    ) {

      console.warn(
        "会話親データ更新をスキップしました:",
        updateError
      );

    }


  } catch (
    error
  ) {

    console.warn(
      "Firestore履歴保存をスキップしました:",
      error
    );

  }


  return localTurn;

}


/* =========================================
   Firestore会話読み込み
========================================= */

async function loadFirestoreConversation(
  id
) {

  if (
    !currentUser ||
    !id
  ) {

    return false;

  }


  try {

    const parentReference =
      conversationRef(
        id
      );


    const parentSnapshot =
      await getDoc(
        parentReference
      );


    if (
      !parentSnapshot ||
      !parentSnapshot.exists()
    ) {

      return false;

    }


    const parent =
      parentSnapshot.data();


    if (
      parent.userId !==
      currentUser.uid
    ) {

      throw new Error(
        "この会話履歴を開く権限がありません。"
      );

    }


    const turnsQuery =
      query(
        turnsCollectionRef(id),
        orderBy(
          "createdAt",
          "asc"
        )
      );


    const snapshot =
      await getDocs(
        turnsQuery
      );


    const loaded =
      snapshot.docs
        .map(
          item => {

            const data =
              item.data();


            return {

              questionId:
                data.questionId ||
                item.id,

              answerId:
                data.answerId ||
                "",

              subject:
                data.subject ||
                "数学",

              question:
                typeof data.question ===
                "string"
                  ? data.question
                  : "",

              answer:
                typeof data.answer ===
                "string"
                  ? data.answer
                  : "",

              status:
                data.status ||
                "completed",

              createdAt:
                data.createdAt ||
                null

            };

          }
        )
        .filter(
          item =>
            item.status ===
              "completed" ||
            item.status ===
              "error"
        );


    if (
      !loaded.length
    ) {

      return false;

    }


    currentConversationId =
      id;


    updateConversationUrl(
      id
    );


    turns =
      loaded;


    showWelcome();


    for (
      const turn of turns
    ) {

      if (
        ALLOWED_SUBJECTS.includes(
          turn.subject
        )
      ) {

        if (
          subjectSelect
        ) {

          subjectSelect.value =
            turn.subject;

        }

      }


      renderMessage(
        "user",
        turn.question
      );


      if (
        turn.answer
      ) {

        renderMessage(
          "assistant",
          turn.answer,
          {
            error:
              turn.status ===
              "error"
          }
        );

      }

    }


    return true;

  } catch (
    error
  ) {

    /*
     * permission-denied等で
     * ページそのものを壊さない。
     */

    console.warn(
      "Firestore会話読み込みをスキップしました:",
      error
    );


    return false;

  }

}


/* =========================================
   ローカル会話読み込み
========================================= */

function loadLocalConversation(
  id
) {

  if (!id) {
    return false;
  }


  const all =
    getLocalHistory();


  const data =
    all[id];


  if (
    !data ||
    !Array.isArray(
      data.turns
    )
  ) {

    return false;

  }


  if (
    data.userId &&
    currentUser &&
    data.userId !==
      currentUser.uid
  ) {

    return false;

  }


  currentConversationId =
    id;


  turns =
    data.turns.map(
      item => ({

        questionId:
          generateConversationId(),

        answerId:
          generateConversationId(),

        subject:
          item.subject ||
          data.subject ||
          "数学",

        question:
          item.question ||
          "",

        answer:
          item.answer ||
          "",

        status:
          item.status ||
          "completed",

        createdAt:
          null

      })
    );


  updateConversationUrl(
    id
  );


  showWelcome();


  for (
    const turn of turns
  ) {

    if (
      ALLOWED_SUBJECTS.includes(
        turn.subject
      )
    ) {

      if (
        subjectSelect
      ) {

        subjectSelect.value =
          turn.subject;

      }

    }


    renderMessage(
      "user",
      turn.question
    );


    if (
      turn.answer
    ) {

      renderMessage(
        "assistant",
        turn.answer,
        {
          error:
            turn.status ===
            "error"
        }
      );

    }

  }


  return turns.length > 0;

}


/* =========================================
   会話読み込み
========================================= */

async function loadConversation(
  id
) {

  if (!id) {
    return;
  }


  /*
   * Firestoreを先に試す。
   */

  const loadedFromFirestore =
    await loadFirestoreConversation(
      id
    );


  if (
    loadedFromFirestore
  ) {

    return;

  }


  /*
   * Firestore権限などで失敗した場合は
   * ローカル履歴を試す。
   */

  const loadedLocally =
    loadLocalConversation(
      id
    );


  if (
    !loadedLocally
  ) {

    updateConversationUrl(
      ""
    );

  }

}


/* =========================================
   AIへ質問
========================================= */

async function callAI(
  question,
  subject
) {

  if (
    !currentUser
  ) {

    throw new Error(
      "ログイン状態を確認できません。"
    );

  }


  /*
   * 直近の回答済み会話だけ送る。
   */

  const history =
    turns
      .filter(
        turn =>
          turn.status ===
            "completed" &&
          turn.question &&
          turn.answer
      )
      .slice(
        -MAX_HISTORY_FOR_AI
      )
      .map(
        turn => ({

          question:
            turn.question,

          answer:
            turn.answer

        })
      );


  /*
   * assets/js/ai.js の
   * 実際のAI通信処理を使用。
   *
   * ここでAPIキーを直接扱わない。
   */

  const answer =
    await askAI({

      message:
        question,

      grade:
        currentProfile?.grade ||
        currentProfile?.学年 ||
        "中学生",

      subject,

      history

    });


  if (
    typeof answer !==
    "string"
  ) {

    throw new Error(
      "AIから正しい回答形式が返されませんでした。"
    );

  }


  const trimmed =
    answer.trim();


  if (!trimmed) {

    throw new Error(
      "AIから回答が返されませんでした。"
    );

  }


  return trimmed;

}


/* =========================================
   質問送信
========================================= */

async function submitQuestion() {

  if (
    sending
  ) {

    return;

  }


  hideError();


  const question =
    normalizeQuestion(
      questionInput?.value
    );


  if (!question) {

    questionInput?.focus();

    return;

  }


  if (
    question.length >
    5000
  ) {

    showError(
      "質問は5000文字以内で入力してください。"
    );

    return;

  }


  if (
    !currentUser
  ) {

    showError(
      "ログイン状態を確認できません。ログイン後にもう一度お試しください。"
    );

    return;

  }


  const subject =
    getSubject();


  /*
   * 学習以外の質問は
   * AI通信を行わず固定回答。
   */

  if (
    !looksLikeStudyQuestion(
      question
    )
  ) {

    renderMessage(
      "user",
      question
    );


    renderMessage(
      "assistant",
      NON_STUDY_RESPONSE
    );


    if (
      questionInput
    ) {

      questionInput.value =
        "";

      autoResizeTextarea();

    }


    await saveTurn(
      question,
      subject,
      NON_STUDY_RESPONSE,
      "completed"
    );


    return;

  }


  /*
   * 先にユーザー質問を画面へ表示。
   */

  renderMessage(
    "user",
    question
  );


  if (
    questionInput
  ) {

    questionInput.value =
      "";

    autoResizeTextarea();

  }


  /*
   * AI待機中。
   * 「・・・」だけ。
   */

  showTyping();


  setSending(
    true
  );


  try {

    const answer =
      await callAI(
        question,
        subject
      );


    hideTyping();


    renderMessage(
      "assistant",
      answer
    );


    await saveTurn(
      question,
      subject,
      answer,
      "completed"
    );


  } catch (
    error
  ) {

    hideTyping();


    const message =
      explainError(
        error
      );


    /*
     * エラーもAI欄に表示。
     */

    renderMessage(
      "assistant",
      message,
      {
        error: true
      }
    );


    showError(
      message
    );


    await saveTurn(
      question,
      subject,
      message,
      "error"
    );


    console.error(
      "AI質問エラー:",
      error
    );

  } finally {

    setSending(
      false
    );


    if (
      questionInput
    ) {

      questionInput.focus();

    }

  }

}


/* =========================================
   新しい質問
========================================= */

function startNewQuestion() {

  if (
    sending
  ) {

    return;

  }


  hideError();


  currentConversationId =
    null;


  turns =
    [];


  updateConversationUrl(
    ""
  );


  showWelcome();


  if (
    questionInput
  ) {

    questionInput.value =
      "";


    autoResizeTextarea();


    questionInput.focus();

  }


  if (
    subjectSelect
  ) {

    subjectSelect.value =
      "数学";

  }

}


/* =========================================
   textarea自動伸縮
========================================= */

function autoResizeTextarea() {

  if (!questionInput) {
    return;
  }


  questionInput.style.height =
    "auto";


  const height =
    Math.min(
      questionInput.scrollHeight,
      180
    );


  questionInput.style.height =
    `${Math.max(
      60,
      height
    )}px`;

}


/* =========================================
   キーボード
========================================= */

function handleInputKeydown(
  event
) {

  /*
   * Enterだけで送信。
   * Shift + Enterは改行。
   */

  if (
    event.key !==
    "Enter"
  ) {

    return;

  }


  if (
    event.shiftKey
  ) {

    return;

  }


  event.preventDefault();


  if (
    !sending
  ) {

    submitQuestion();

  }

}


/* =========================================
   イベント
========================================= */

function bindEvents() {

  if (
    questionForm
  ) {

    questionForm.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        submitQuestion();

      }
    );

  }


  if (
    questionInput
  ) {

    questionInput.addEventListener(
      "keydown",
      handleInputKeydown
    );


    questionInput.addEventListener(
      "input",
      autoResizeTextarea
    );

  }


  if (
    newQuestionButton
  ) {

    newQuestionButton.addEventListener(
      "click",
      startNewQuestion
    );

  }

}


/* =========================================
   初期化
========================================= */

async function initialize() {

  /*
   * DOMはすでに question.html に存在する。
   * 「準備しています」等は表示しない。
   */

  hideError();


  if (
    subjectSelect &&
    !ALLOWED_SUBJECTS.includes(
      subjectSelect.value
    )
  ) {

    subjectSelect.value =
      "数学";

  }


  autoResizeTextarea();


  bindEvents();


  /*
   * 認証状態を確認。
   */

  try {

    currentUser =
      await waitForCurrentUser();


    authResolved =
      true;


    if (
      !currentUser
    ) {

      showError(
        "ログインが必要です。"
      );


      setSending(
        true
      );


      return;

    }


    /*
     * プロフィールは取得できれば使う。
     * 取得失敗しても質問画面を止めない。
     */

    currentProfile =
      await loadProfile(
        currentUser
      );


    /*
     * URLに会話IDがあれば復元。
     */

    const conversationId =
      getConversationIdFromUrl();


    if (
      conversationId
    ) {

      await loadConversation(
        conversationId
      );

    }


    /*
     * 最後に入力欄へフォーカス。
     */

    if (
      questionInput
    ) {

      questionInput.focus();

    }


  } catch (
    error
  ) {

    console.error(
      "question.js 初期化エラー:",
      error
    );


    showError(
      explainError(
        error
      )
    );

  }

}


/* =========================================
   起動
========================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initialize,
    {
      once: true
    }
  );

} else {

  initialize();

}


/* =========================================
   デバッグ用公開API
========================================= */

window.StudyAIQuestion = {

  submit() {

    return submitQuestion();

  },

  newQuestion() {

    startNewQuestion();

  },

  getTurns() {

    return [
      ...turns
    ];

  },

  getCurrentUser() {

    return currentUser;

  },

  isReady() {

    return authResolved &&
      Boolean(currentUser);

  }

};
