export function getLocalDateString(date) {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateStreakFromDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return 0;
  const dateSet = new Set(dates);
  const today = getLocalDateString(new Date());
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  let current = new Date();
  let streak = 0;

  // Determine start point
  if (dateSet.has(today)) {
     // Start from today
  } else if (dateSet.has(yesterdayStr)) {
     // Start from yesterday
     current.setDate(current.getDate() - 1);
  } else {
     return 0;
  }

  // Count backwards
  while (dateSet.has(getLocalDateString(current))) {
    streak++;
    current.setDate(current.getDate() - 1);
  }
  return streak;
}
