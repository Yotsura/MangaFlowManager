import { collection, doc, getDoc, getDocs, query, type Firestore } from "firebase/firestore";

import { projectFirestore } from "./firebaseApp";

// TODO: Firestore の読み書き処理をここに実装します。
// 今後、作品・カレンダー・設定などのコレクションを定義して CRUD をまとめる予定です。

const getCollection = (path: string) => collection(projectFirestore, path);

const getDocument = async <T>(path: string) => {
  const snapshot = await getDoc(doc(projectFirestore, path));
  return snapshot.exists() ? (snapshot.data() as T) : null;
};

const getCollectionDocs = async <T>(path: string) => {
  const snapshot = await getDocs(query(getCollection(path)));
  return snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...(docSnapshot.data() as T) }));
};

export type { Firestore };
export { getCollection, getCollectionDocs, getDocument };
