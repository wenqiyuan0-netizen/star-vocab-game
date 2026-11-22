// src/features/vocabulary/services/WordProcessor.js
import { sortWords } from '../../../logic/utils';
import { extractArticleFromWord } from '../../../utils/genderUtils';
import { generateStableId } from '../../../utils/idUtils';
import { translate } from '../../../shared/i18n';

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

    // 清理行首的编号、符号等 (如 "1. ", "• ", "- ")
    const cleanLine = raw.replace(/^[\s\d\.\)\]\-\*•]+/, '');

    const parts = cleanLine.split(/;|；/);
    if (parts.length < 2) return;

    let deRaw = parts[0].trim();
    // 支持多个中文释义（如果有多个分号，将后面的所有部分合并）
    let cn = parts.slice(1).map(p => p.trim()).filter(Boolean).join('；');
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

      // 确保 pos 有默认值
      const finalPos = pos || 'unknown';

      newWords.push({
        id: generateStableId(deClean, finalPos), // 使用新的稳定 ID 生成函数
        de: deClean,
        cn,
        gender,
        pos: finalPos, // 确保 pos 字段存在
        state: 'new',
        step: 0,
        interval: 0,
        easeFactor: 2.5,
        dueDate: 0,
        proficiency: 0,        // 新增：初始熟练度
        graduated: false,      // 新增：是否毕业
        lastReview: null,      // 新增：最后复习时间
        example: null,
      });
    }
  });

  // 返回处理结果，不直接操作 State
  if (newWords.length > 0) {
    const updatedDb = sortWords([...currentDb, ...newWords]);
    let msg = translate('import.ok', { n: newWords.length });
    if (duplicateCount > 0) {
      msg += translate('import.dupes', { n: duplicateCount });
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
      message: translate('import.allDupes', { n: duplicateCount })
    };
  }

  return { success: false, message: null };
};
