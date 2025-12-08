// src/features/vocabulary/services/WordProcessor.js
import { sortWords } from '../../../logic/utils';
import { extractArticleFromWord } from '../../../utils/genderUtils';

export const processImportInput = (inputText, currentDb) => {
  if (!inputText || !inputText.trim()) {
    return { success: false, message: null }; // 空输入不做处理
  }

  const lines = inputText.split('\n');
  const newWords = [];
  let duplicateCount = 0;

  // 建立指纹库
  const existingFingerprints = new Set(
    currentDb.map(w => w.de.trim().toLowerCase())
  );

  lines.forEach(line => {
    const raw = line.trim();
    if (!raw) return;

    const parts = raw.split(/;|；/);
    if (parts.length < 2) return;

    let deRaw = parts[0].trim();
    let cn = parts[1].trim();
    let gender = null;
    let pos = null;
    let deClean = deRaw;

    // 使用统一的提取函数，支持所有格式：der/die/das/m/f/n
    const extracted = extractArticleFromWord(deRaw);

    if (extracted.gender) {
      // 提取到了性别信息
      gender = extracted.gender; // 已经是标准化的 m/f/n
      deClean = extracted.base;
      pos = 'noun';
    } else {
      // 未提取到性别，根据首字母大写判断
      if (deClean[0] === deClean[0].toUpperCase()) {
        pos = 'nounPossible';
        gender = null;
      } else {
        pos = 'unknown';
        gender = null;
      }
    }

    // 核心降重逻辑
    if (existingFingerprints.has(deClean.toLowerCase())) {
      duplicateCount++;
      return;
    }

    if (deClean && cn) {
      existingFingerprints.add(deClean.toLowerCase());
      newWords.push({
        id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        de: deClean,
        cn,
        gender,
        pos,
        state: 'new',
        step: 0,
        interval: 0,
        easeFactor: 2.5,
        dueDate: 0,
        example: null,
      });
    }
  });

  // 返回处理结果，不直接操作 State
  if (newWords.length > 0) {
    const updatedDb = sortWords([...currentDb, ...newWords]);
    let msg = `成功导入 ${newWords.length} 个新词`;
    if (duplicateCount > 0) {
      msg += ` (自动过滤了 ${duplicateCount} 个重复词)`;
    }
    return {
      success: true,
      updatedDb: updatedDb,
      newWords: newWords,
      message: msg
    };
  } else if (duplicateCount > 0) {
    return {
      success: false,
      message: `未导入，所有 ${duplicateCount} 个词均已存在`
    };
  }

  return { success: false, message: null };
};
