// src/logic/wordProcessor.js
import { sortWords } from '../../../logic/utils'; // 记得确保 utils 里有 sortWords

export const processImportInput = (inputText, currentDb) => {
  if (!inputText || !inputText.trim()) {
    return { success: false, message: null }; // 空输入不做处理
  }

  const lines = inputText.split('\n');
  const newWords = [];
  let duplicateCount = 0;

  const GENDERS = ['der', 'die', 'das'];
  const ARTICLE_TO_GENDER = { der: 'm', die: 'f', das: 'n' };

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

    const tokens = deRaw.split(/\s+/);
    
    // 词性/性别判断逻辑
    if (tokens.length >= 2 && GENDERS.includes(tokens[0].toLowerCase())) {
      gender = ARTICLE_TO_GENDER[tokens[0].toLowerCase()];
      deClean = tokens.slice(1).join(' ');
      pos = 'noun';
    } else {
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
