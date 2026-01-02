import { normalizeGender } from './genderUtils';
import { isStableId } from './idUtils';

// Helper to convert between App word format and Supabase DB format

// Polyfill for UUID generation in non-secure contexts
const generateUuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const appWordToDbWord = (appWord, userId) => {
  const dbWord = {
    user_id: userId,
    de: appWord.de,
    cn: appWord.cn,
    gender: normalizeGender(appWord.gender) || null,
    pos: appWord.pos || 'unknown', // 新增：词性字段
    state: appWord.state,
    step: appWord.step,
    interval: appWord.interval,
    ease_factor: appWord.easeFactor,
    due_date: appWord.dueDate ? new Date(appWord.dueDate).toISOString() : null,
    proficiency: appWord.proficiency || 0,
    graduated: appWord.graduated || false,
    last_review: appWord.lastReview ? new Date(appWord.lastReview).toISOString() : null,
    fsrs: appWord.fsrs || null,
    is_deleted: appWord.isDeleted || false,
    local_updated_at: appWord.localUpdatedAt ? new Date(appWord.localUpdatedAt).toISOString() : new Date().toISOString()
  };

  // 只接受 UUID（数据库使用 UUID 作为主键）
  // 稳定 ID 只在本地使用，同步时通过 de_norm 匹配
  if (isValidUuid(appWord.id)) {
    dbWord.id = appWord.id;
  } else {
    // 如果没有有效的 UUID（例如新词或只有稳定 ID），生成一个新的 UUID
    // 这避免了依赖数据库的默认值，解决了 "null value in column id" 错误
    dbWord.id = generateUuid();
  }

  return dbWord;
};

export const dbWordToAppWord = (dbWord) => {
  return {
    id: dbWord.id,
    de: dbWord.de,
    cn: dbWord.cn,
    gender: dbWord.gender,
    pos: dbWord.pos || 'unknown', // 新增：词性字段
    state: dbWord.state,
    step: dbWord.step,
    interval: dbWord.interval,
    easeFactor: dbWord.ease_factor,
    dueDate: dbWord.due_date ? new Date(dbWord.due_date).getTime() : 0,
    proficiency: dbWord.proficiency,
    graduated: dbWord.graduated,
    lastReview: dbWord.last_review ? new Date(dbWord.last_review).getTime() : null,
    fsrs: dbWord.fsrs || null,
    isDeleted: dbWord.is_deleted || false,
    localUpdatedAt: dbWord.local_updated_at ? new Date(dbWord.local_updated_at).getTime() : 0
  };
};

const isValidUuid = (id) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(id);
};
