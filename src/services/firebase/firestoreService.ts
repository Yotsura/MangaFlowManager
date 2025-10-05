import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, type Firestore, type SetOptions } from "firebase/firestore";

import { projectFirestore } from "./firebaseApp";

// TODO: Firestore の読み書き処理をここに実装します。
// 今後、作品・カレンダー・設定などのコレクションを定義して CRUD をまとめる予定です。

const getCollection = (path: string) => collection(projectFirestore, path);

const getDocument = async <T>(path: string) => {
  console.log('Firestore読み込み開始:', path);
  try {
    const snapshot = await getDoc(doc(projectFirestore, path));
    const exists = snapshot.exists();
    const data = exists ? (snapshot.data() as T) : null;
    console.log('Firestore読み込み完了:', { path, exists, hasData: !!data });
    return data;
  } catch (error) {
    console.error('Firestore読み込み失敗:', { path, error });
    throw error;
  }
};

const getCollectionDocs = async <T>(path: string) => {
  const snapshot = await getDocs(query(getCollection(path)));
  return snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...(docSnapshot.data() as T) }));
};

const setDocument = async (path: string, data: Record<string, unknown>, options?: SetOptions) => {
  console.log('Firestore書き込み開始:', { path, data, options });
  try {
    const result = options ?
      await setDoc(doc(projectFirestore, path), data, options) :
      await setDoc(doc(projectFirestore, path), data);
    console.log('Firestore書き込み成功:', path);
    return result;
  } catch (error) {
    console.error('Firestore書き込み失敗:', { path, error });
    throw error;
  }
};

const deleteDocument = async (path: string) => deleteDoc(doc(projectFirestore, path));

export type { Firestore };
export { deleteDocument, getCollection, getCollectionDocs, getDocument, setDocument };
