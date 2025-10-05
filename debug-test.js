// デバッグ用テストスクリプト
// ブラウザーのコンソールで実行してください

console.log("=== デバッグテスト開始 ===");

// 1. 現在の作品データを確認
const currentWorkId = window.location.pathname.split('/').pop();
console.log("Current work ID:", currentWorkId);

// 2. Pinia storeにアクセス
const app = document.querySelector('#app').__vue_app__;
const stores = app.config.globalProperties.$pinia._s;
const worksStore = stores.get('works');
const settingsStore = stores.get('settings');

if (worksStore && currentWorkId) {
  const work = worksStore.works.find(w => w.id === currentWorkId);
  if (work) {
    console.log("=== 作品情報 ===");
    console.log("タイトル:", work.title);
    console.log("defaultCounts:", work.defaultCounts);
    console.log("units数:", work.units.length);
    console.log("最初のunit:", work.units[0]);

    console.log("=== 粒度設定 ===");
    console.log("全体設定:", settingsStore.granularities);
    console.log("作品固有設定:", work.workGranularities);
  } else {
    console.log("作品が見つかりません");
  }
} else {
  console.log("Store または workId が見つかりません");
}

console.log("=== デバッグテスト完了 ===");
