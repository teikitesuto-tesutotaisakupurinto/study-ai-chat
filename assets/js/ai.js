import { auth } from "./firebase-module.js";

const SUPABASE_URL =
  "https://fjqobjcvejhkevyfsoxt.supabase.co";

const FUNCTION_URL =
  `${SUPABASE_URL}/functions/v1/study-chat`;

export async function askAI({
  message,
  grade = "中学生",
  subject = "学習全般",
  history = []
}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const idToken =
    await user.getIdToken(true);

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({
      message,
      grade,
      subject,
      history
    })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error ||
      "AIへの接続に失敗しました。"
    );
  }

  return result.reply;
}
