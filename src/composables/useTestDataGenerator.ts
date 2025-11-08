import { storeToRefs } from 'pinia';
import { useWorksStore } from '@/store/worksStore';
import { useAuthStore } from '@/store/authStore';

/**
 * テストデータ生成を管理するcomposable
 */
export function useTestDataGenerator() {
  const worksStore = useWorksStore();
  const authStore = useAuthStore();
  const { works } = storeToRefs(worksStore);
  const { user } = storeToRefs(authStore);

  // テスト用: 全作品にサンプルデータを生成
  const generateTestData = async () => {
    if (!confirm(`全${works.value.length}件の作品にサンプル進捗データを生成します。よろしいですか？`)) {
      return;
    }

    // 全作品に対してテストデータを生成
    worksStore.generateTestProgressHistory();

    // 生成されたデータを保存
    let generatedCount = 0;
    if (user.value?.uid) {
      for (const work of works.value) {
        await worksStore.saveWork({ userId: user.value.uid, workId: work.id });
        generatedCount++;
      }
    }

    alert(`${generatedCount}件の作品にサンプル進捗データを生成しました`);
  };

  return {
    generateTestData
  };
}
