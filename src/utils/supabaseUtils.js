// Helper to convert between App word format and Supabase DB format

export const appWordToDbWord = (appWord, userId) => {
  return {
    // If ID is a simple string like 'w1' (default words) or local random string,
    // we might want to let Supabase generate a UUID if it's a new insert.
    // However, for updates, we need the ID.
    // Strategy: If ID is a valid UUID, keep it. If not, and we are upserting, 
    // we might need to handle it carefully. For now, we pass ID if it exists.
    id: isValidUuid(appWord.id) ? appWord.id : undefined, 
    user_id: userId,
    de: appWord.de,
    cn: appWord.cn,
    gender: appWord.gender,
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
};

export const dbWordToAppWord = (dbWord) => {
  return {
    id: dbWord.id,
    de: dbWord.de,
    cn: dbWord.cn,
    gender: dbWord.gender,
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
