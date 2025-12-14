// src/logic/utils.js
import he from 'he';

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const decodeEntities = (s) => {
  if (!s) return '';
  return he.decode(String(s));
};
export function sanitizeCn(raw) {
  let s = decodeEntities(raw || '');
  s = s.replace(/\[[0-9]{1,3}\]/g, '')      // 去掉 [数字]
       .replace(/["""'„]+/g, '')            // 去掉引号
       .trim();
  return s;
}
export function cleanGermanExample(text) {
  if (!text) return "";

  let t = text;

  // 去掉 Tatoeba 常见开头破折号 — / – / -
  t = t.replace(/^[\s—–-]+/, "");

  // 去掉奇怪语言的引号（法语风格）
  t = t.replace(/[«»‹›]/g, "");

  // 去掉方括号脚注
  t = t.replace(/\[[0-9]+\]/g, "");

  // 去掉括号说明
  t = t.replace(/\(.*?\)/g, "");

  // 多余空格
  t = t.replace(/\s+/g, " ").trim();

  return t;
}
export function sanitizeGermanSentence(raw, targetDe) {
  let s = decodeEntities(raw || '');

  // 去 HTML 标签、脚注、上标数字
  s = s.replace(/<[^>]*>/g, '')
       .replace(/\[[0-9]{1,3}\]/g, '')
       .replace(/\([0-9]{1,3}\)/g, '')
       .replace(/[\u00B9\u00B2\u00B3\u2070-\u2079]+/g, '');

  // 拒绝 'wa.wa...' 这种
  if (/(\b[\p{L}]{1,3}\.){2,}/u.test(s)) return null;

  // 去掉头尾乱七八糟的符号
  s = s.replace(/^[\s"""„''—\-…·]+/, '')
       .replace(/[\s"""„''—\-…·]+$/, '');

  // 替换大段省略号、多重句点
  s = s.replace(/…/g, '.').replace(/\.{2,}/g, '.');

  // 长度检查
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 18) return null;

  // 必须包含目标词（简单允许词尾变化）
  const base = String(targetDe).split(/\s+/).pop();
  const re = new RegExp(`\\b${escapeRegex(base)}\\w*\\b`, 'i');
  if (!re.test(s)) return null;

  // 句首大写、末尾补句号
  if (s[0]) s = s[0].toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s += '.';

  return s;
}
export const sortWords = (words) => {
  return [...words].sort((a, b) => a.de.localeCompare(b.de, 'de', { sensitivity: 'base' }));
};

export const getLines = (ctx, text, maxWidth) => {
  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
};
