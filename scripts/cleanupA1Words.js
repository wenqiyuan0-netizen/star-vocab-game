/**
 * 临时脚本：删除A1测试单词
 * 用法：在浏览器控制台中运行
 */

(function() {
  console.log('=== 开始清理 A1 测试单词 ===\n');

  // 1. 读取当前词库
  const dbKey = 'space_vocab_db';
  const importedKey = 'imported_preset_libraries';

  let db = [];
  try {
    const saved = localStorage.getItem(dbKey);
    if (saved) {
      db = JSON.parse(saved);
      console.log(`📊 当前词库：${db.length} 个单词`);
    } else {
      console.log('❌ 未找到词库数据');
      return;
    }
  } catch (error) {
    console.error('❌ 读取词库失败:', error);
    return;
  }

  // 2. 筛选出未学习的单词
  const unlearnedWords = db.filter(w =>
    w.state === 'new' && (!w.lastReview || w.lastReview === 0 || w.lastReview === null)
  );

  const learnedWords = db.filter(w =>
    w.state !== 'new' || (w.lastReview && w.lastReview > 0)
  );

  console.log(`\n📋 统计:`);
  console.log(`  - 未学习的单词: ${unlearnedWords.length} 个`);
  console.log(`  - 已学习的单词: ${learnedWords.length} 个`);

  // 3. 确认删除
  if (unlearnedWords.length === 0) {
    console.log('\n✅ 没有未学习的单词需要删除');
    return;
  }

  const confirmed = confirm(
    `确定要删除 ${unlearnedWords.length} 个未学习的单词吗？\n` +
    `（保留 ${learnedWords.length} 个已学习的单词）`
  );

  if (!confirmed) {
    console.log('\n❌ 取消删除');
    return;
  }

  // 4. 更新词库
  try {
    localStorage.setItem(dbKey, JSON.stringify(learnedWords));
    console.log(`\n✅ 删除成功！`);
    console.log(`  - 已删除: ${unlearnedWords.length} 个`);
    console.log(`  - 已保留: ${learnedWords.length} 个`);

    // 5. 清除导入记录（A1）
    try {
      const imported = localStorage.getItem(importedKey);
      if (imported) {
        let importedList = JSON.parse(imported);
        const beforeCount = importedList.length;
        importedList = importedList.filter(id => id !== 'goethe-a1');
        if (importedList.length < beforeCount) {
          localStorage.setItem(importedKey, JSON.stringify(importedList));
          console.log(`  - 已移除 A1 导入记录`);
        }
      }
    } catch (e) {
      console.warn('  - 清除导入记录失败（可忽略）');
    }

    console.log('\n🔄 请刷新页面以查看更新后的词库');
  } catch (error) {
    console.error('❌ 更新词库失败:', error);
  }
})();
