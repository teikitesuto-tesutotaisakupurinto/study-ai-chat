import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";

import {
  getFirestore,
  FieldValue
} from "firebase-admin/firestore";

import {
  initializeApp
} from "firebase-admin/app";

import OpenAI from "openai";

initializeApp();

const db = getFirestore();

const OPENAI_API_KEY =
  defineSecret("OPENAI_API_KEY");

type ChatRequest = {
  conversationId?: string;
  question?: string;
  userId?: string;
};

type ChatResponse = {
  answer: string;
  responseId: string;
  conversationId: string;
};

function createResponseId(): string {
  return (
    "response_" +
    crypto.randomUUID()
  );
}

function createConversationId(): string {
  return (
    "conversation_" +
    crypto.randomUUID()
  );
}

function cleanQuestion(
  value: unknown
): string {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value.trim();
}

async function verifyUser(
  userId: string
) {
  if (!userId) {
    throw new Error(
      "ユーザーIDがありません。"
    );
  }

  const userSnapshot =
    await db
      .collection("users")
      .doc(userId)
      .get();

  if (
    !userSnapshot.exists
  ) {
    throw new Error(
      "ユーザー情報が存在しません。"
    );
  }

  const user =
    userSnapshot.data();

  if (
    user?.status !== "active"
  ) {
    throw new Error(
      "このアカウントは利用できません。"
    );
  }

  return user;
}

async function getConversation(
  conversationId: string,
  userId: string
) {
  const ref =
    db
      .collection("chatHistories")
      .doc(conversationId);

  const snapshot =
    await ref.get();

  if (
    !snapshot.exists
  ) {
    throw new Error(
      "会話が存在しません。"
    );
  }

  const data =
    snapshot.data();

  if (
    data?.userId !== userId
  ) {
    throw new Error(
      "この会話を利用する権限がありません。"
    );
  }

  return {
    ref,
    data
  };
}

async function getMessages(
  conversationId: string
) {
  const snapshot =
    await db
      .collection(
        "chatHistories"
      )
      .doc(
        conversationId
      )
      .collection(
        "messages"
      )
      .orderBy(
        "createdAt",
        "asc"
      )
      .limit(40)
      .get();

  return snapshot.docs
    .map(doc => {
      const data =
        doc.data();

      return {
        role:
          data.role ===
          "assistant"
            ? "assistant"
            : "user",
        content:
          String(
            data.content ||
            ""
          )
      };
    })
    .filter(
      item =>
        item.content.trim()
          .length > 0
    );
}

function systemPrompt(): string {
  return `
あなたは「学習AIチャット」です。

目的：
中学生の学習を支援すること。

ルール：
- 学習内容を分かりやすく説明する。
- 必要に応じて途中式や考え方を示す。
- 答えだけでなく、なぜそうなるかを説明する。
- 中学生が理解できる表現を優先する。
- 質問が曖昧な場合は必要な確認をする。
- 学習と関係のない内容には、学習専用であることを簡潔に伝える。
- 不明なことを事実として作らない。
`;
}

export const chat = onRequest(
  {
    region: "asia-northeast1",
    cors: true,
    secrets: [
      OPENAI_API_KEY
    ],
    timeoutSeconds: 120,
    memory: "512MiB"
  },
  async (
    request,
    response
  ) => {

    response.setHeader(
      "Content-Type",
      "application/json; charset=utf-8"
    );

    try {

      if (
        request.method !==
        "POST"
      ) {
        response.status(405).json({
          message:
            "POSTメソッドのみ利用できます。"
        });

        return;
      }

      const body =
        request.body as ChatRequest;

      const question =
        cleanQuestion(
          body?.question
        );

      const userId =
        cleanQuestion(
          body?.userId
        );

      if (!question) {
        response.status(400).json({
          message:
            "質問内容を入力してください。"
        });

        return;
      }

      if (!userId) {
        response.status(401).json({
          message:
            "ユーザーIDがありません。"
        });

        return;
      }

      if (
        question.length > 4000
      ) {
        response.status(400).json({
          message:
            "質問が長すぎます。4000文字以内で入力してください。"
        });

        return;
      }

      await verifyUser(
        userId
      );

      let conversationId =
        cleanQuestion(
          body?.conversationId
        );

      if (!conversationId) {
        conversationId =
          createConversationId();

        await db
          .collection(
            "chatHistories"
          )
          .doc(
            conversationId
          )
          .set({
            conversationId,
            userId,
            title:
              question.length <= 30
                ? question
                : question.slice(
                    0,
                    30
                  ) + "…",
            lastQuestion:
              question,
            messageCount: 0,
            createdAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp()
          });
      } else {
        await getConversation(
          conversationId,
          userId
        );
      }

      const previousMessages =
        await getMessages(
          conversationId
        );

      const openai =
        new OpenAI({
          apiKey:
            OPENAI_API_KEY.value()
        });

      const completion =
        await openai.chat.completions.create({
          model:
            "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                systemPrompt()
            },
            ...previousMessages.map(
              message => ({
                role:
                  message.role as
                    | "user"
                    | "assistant",
                content:
                  message.content
              })
            ),
            {
              role: "user",
              content: question
            }
          ],
          temperature: 0.4
        });

      const answer =
        completion
          .choices?.[0]
          ?.message
          ?.content
          ?.trim();

      if (!answer) {
        throw new Error(
          "AIから有効な回答を取得できませんでした。"
        );
      }

      const responseId =
        createResponseId();

      const conversationRef =
        db
          .collection(
            "chatHistories"
          )
          .doc(
            conversationId
          );

      const messageCollection =
        conversationRef.collection(
          "messages"
        );

      await messageCollection.add({
        role: "user",
        content: question,
        responseId: null,
        userId,
        createdAt:
          FieldValue.serverTimestamp()
      });

      await messageCollection.add({
        role: "assistant",
        content: answer,
        responseId,
        userId,
        createdAt:
          FieldValue.serverTimestamp()
      });

      await conversationRef.update({
        lastQuestion:
          question,
        lastResponseId:
          responseId,
        messageCount:
          FieldValue.increment(2),
        updatedAt:
          FieldValue.serverTimestamp()
      });

      const result: ChatResponse = {
        answer,
        responseId,
        conversationId
      };

      response.status(200).json(
        result
      );

    } catch (error) {

      logger.error(
        "AIチャットエラー",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      response.status(500).json({
        message:
          "AI回答の取得中にエラーが発生しました。",
        detail:
          message
      });
    }
  }
);
