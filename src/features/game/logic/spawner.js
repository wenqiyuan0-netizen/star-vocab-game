// src/logic/spawner.js

// 简单的重叠检测
const checkOverlap = (x, y, existingFragments) => {
  for (const f of existingFragments) {
    // 180/120 是原本代码里的防重叠阈值
    if (Math.abs(f.x - x) < 180 && Math.abs(f.y - y) < 120) {
      return true; 
    }
  }
  return false;
};

// 计算单个出生点
const getEdgePosition = (edge, width, height, margin, safeMargin) => {
  let x, y;
  switch (edge) {
    case "top":
      x = Math.random() * (width - safeMargin * 2) + safeMargin;
      y = -margin;
      break;
    case "bottom":
      x = Math.random() * (width - safeMargin * 2) + safeMargin;
      y = height + margin;
      break;
    case "left":
      x = -margin;
      y = Math.random() * (height - safeMargin * 2) + safeMargin;
      break;
    case "right":
      x = width + margin;
      y = Math.random() * (height - safeMargin * 2) + safeMargin;
      break;
    default:
      x = 0; y = 0;
  }
  return { x, y };
};

// 计算基础角度
const getBaseAngle = (sx, sy, width, height) => {
  const centerX = width / 2;
  const centerY = height / 2;
  return Math.atan2(centerY - sy, centerX - sx);
};

// ★ 核心导出函数：计算一对单词的出生数据
export const calculateSpawnPair = (width, height, existingFragments) => {
  const margin = 60;
  const safeMargin = 40;
  
  // 1. 选边
  const edges = ["top", "bottom", "left", "right"];
  const edgeDe = edges[Math.floor(Math.random() * edges.length)];
  const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" };
  const edgeCn = opposite[edgeDe];

  // 2. 计算坐标 (尝试 10 次防重叠)
  const findPos = (edge) => {
    for (let i = 0; i < 10; i++) {
      const pos = getEdgePosition(edge, width, height, margin, safeMargin);
      if (!checkOverlap(pos.x, pos.y, existingFragments)) return pos;
    }
    return getEdgePosition(edge, width, height, margin, safeMargin); // 兜底
  };

  const posDe = findPos(edgeDe);
  const posCn = findPos(edgeCn);

  // 3. 计算速度向量
  const jitter = Math.PI / 4;
  const angleDe = getBaseAngle(posDe.x, posDe.y, width, height) + (Math.random() - 0.5) * jitter;
  const angleCn = getBaseAngle(posCn.x, posCn.y, width, height) + (Math.random() - 0.5) * jitter;

  const baseSpeed = 0.35;
  const speedVar = 0.25;
  const speedDe = baseSpeed + Math.random() * speedVar;
  const speedCn = baseSpeed + Math.random() * speedVar;

  return {
    de: { x: posDe.x, y: posDe.y, vx: Math.cos(angleDe) * speedDe, vy: Math.sin(angleDe) * speedDe },
    cn: { x: posCn.x, y: posCn.y, vx: Math.cos(angleCn) * speedCn, vy: Math.sin(angleCn) * speedCn }
  };
};