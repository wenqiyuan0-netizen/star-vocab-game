// src/logic/persistence.js

// 1. 把数据变成乱码（存档码）
export const generateSaveCode = (data) => {
  try {
    const json = JSON.stringify(data);
    return btoa(encodeURIComponent(json));
  } catch (e) {
    console.error("导出失败:", e);
    return null; // 失败了返回 null
  }
};

// 2. 把乱码变回数据
export const parseSaveCode = (code) => {
  try {
    if (!code) return null;
    const decoded = decodeURIComponent(atob(code));
    const data = JSON.parse(decoded);
    if (Array.isArray(data)) {
      return data;
    }
    return null;
  } catch (e) {
    console.error("导入失败:", e);
    return null;
  }
};

// 3. 复制到剪贴板 (这段有点长，搬走最划算)
export const copyTextToClipboard = (text) => {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    return false;
  }
};