import {
  auth,
  db,
  persistenceReady,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc
} from "./firebase.js";


function rootPath(
  file
) {

  const path =
    location.pathname;

  const nested =
    path.includes("/student/") ||
    path.includes("/admin/");

  return nested
    ? `../${file}`
    : `./${file}`;
}


export async function getSystemSettings() {

  const snapshot =
    await getDoc(
      doc(
        db,
        "settings",
        "system"
      )
    );


  if (
    !snapshot.exists()
  ) {

    return {
      maintenance: false
    };
  }


  return snapshot.data();
}


export async function getCurrentProfile(
  user
) {

  if (!user?.uid) {

    throw new Error(
      "ログイン中の利用者を確認できません。"
    );
  }


  const snapshot =
    await getDoc(
      doc(
        db,
        "users",
        user.uid
      )
    );


  if (
    !snapshot.exists()
  ) {

    throw new Error(
      "ユーザープロフィールがありません。"
    );
  }


  return snapshot.data();
}


export function waitForAuth() {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      let unsubscribe =
        null;

      let finished =
        false;


      function finish(
        callback
      ) {

        if (
          finished
        ) {
          return;
        }

        finished =
          true;


        if (
          unsubscribe
        ) {

          unsubscribe();

          unsubscribe =
            null;
        }


        callback();
      }


      unsubscribe =
        onAuthStateChanged(
          auth,

          user => {

            finish(
              () => resolve(user)
            );
          },

          error => {

            finish(
              () => reject(error)
            );
          }
        );
    }
  );
}


function redirectLogin() {

  location.replace(
    rootPath(
      "login.html"
    )
  );
}


export async function requireRole(
  requiredRole,
  options = {}
) {

  if (
    ![
      "student",
      "admin"
    ].includes(
      requiredRole
    )
  ) {

    throw new Error(
      "requiredRole が不正です。"
    );
  }


  try {

    await persistenceReady;

    const user =
      await waitForAuth();


    if (!user) {

      redirectLogin();

      return null;
    }


    let profile;

    try {

      profile =
        await getCurrentProfile(
          user
        );

    } catch (error) {

      console.error(
        "プロフィール取得エラー:",
        error
      );

      throw new Error(
        "ユーザー情報を確認できませんでした。"
      );
    }


    if (
      profile.status !==
      "active"
    ) {

      await signOut(
        auth
      );

      throw new Error(
        "このアカウントは現在利用できません。"
      );
    }


    if (
      profile.role !==
      requiredRole
    ) {

      throw new Error(
        "このページを開く権限がありません。"
      );
    }


    let settings;

    try {

      settings =
        await getSystemSettings();

    } catch (error) {

      console.error(
        "システム設定取得エラー:",
        error
      );

      settings = {
        maintenance: false
      };
    }


    if (
      settings.maintenance === true &&
      requiredRole === "student" &&
      options.allowMaintenance !== true
    ) {

      location.replace(
        rootPath(
          "maintenance.html"
        )
      );

      return null;
    }


    document.documentElement
      .classList
      .remove(
        "auth-pending"
      );


    return {
      user,
      profile,
      settings
    };

  } catch (error) {

    document.documentElement
      .classList
      .remove(
        "auth-pending"
      );

    console.error(
      "認証確認エラー:",
      error
    );

    throw error;
  }
}


export async function protectPage(
  requiredRole,
  options = {}
) {

  const result =
    await requireRole(
      requiredRole,
      options
    );


  if (!result) {

    throw new Error(
      "ページの認証確認が完了していません。"
    );
  }


  return result;
}


export {
  auth,
  db
};
