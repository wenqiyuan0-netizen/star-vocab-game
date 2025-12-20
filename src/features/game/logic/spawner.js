// src/logic/spawner.js

import Matter from 'matter-js';

// 简单的重叠检测
const checkOverlap = (x, y, existingFragments, thresholdX = 220, thresholdY = 150) => {
  // 获取所有有效的物理体
  const bodies = existingFragments.map(f => f.body).filter(b => b);
  
  if (bodies.length === 0) return false;

  // 使用 Matter.js 查询区域碰撞
  // 创建一个探测区域 (以 x,y 为中心)
  const bounds = {
    min: { x: x - thresholdX / 2, y: y - thresholdY / 2 },
    max: { x: x + thresholdX / 2, y: y + thresholdY / 2 }
  };

  const collisions = Matter.Query.region(bodies, bounds);
  return collisions.length > 0;
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
export const calculateSpawnPair = (width, height, existingFragments, baseSpeed = 0.35) => {
  const margin = 60;
  const safeMargin = 40;

  // 动态调整防重叠阈值
  // 横屏时高度受限，需要减小Y轴阈值以避免堆叠
  const isLandscape = width > height;
  // 增加基础 X 阈值，因为德语单词可能很长
  let thresholdX = 260; 
  let thresholdY = 150;

  if (isLandscape) {
    // 横屏：Y轴更紧密，但不能太小否则垂直方向会重叠
    // 50px是基础高度，至少要留出空间。建议不小于 80
    thresholdY = Math.max(80, Math.min(150, height * 0.3));
  } else {
    // 竖屏：X轴更紧密，最小 140px
    thresholdX = Math.max(160, Math.min(260, width * 0.6));
  }
  
  // 1. 选边
  const edges = ["top", "bottom", "left", "right"];
  const edgeDe = edges[Math.floor(Math.random() * edges.length)];
  const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" };
  const edgeCn = opposite[edgeDe];

  // 2. 计算坐标 (尝试 10 次防重叠)
  const findPos = (edge) => {
    // 尝试10次正常检测
    for (let i = 0; i < 10; i++) {
      const pos = getEdgePosition(edge, width, height, margin, safeMargin);
      if (!checkOverlap(pos.x, pos.y, existingFragments, thresholdX, thresholdY)) return pos;
    }
    
    // 如果失败，尝试降低要求（允许更近的距离）再试5次
    for (let i = 0; i < 5; i++) {
      const pos = getEdgePosition(edge, width, height, margin, safeMargin);
      if (!checkOverlap(pos.x, pos.y, existingFragments, thresholdX * 0.5, thresholdY * 0.5)) return pos;
    }

    // 依然失败，随机返回一个位置，但稍微偏移一点，依赖物理引擎推开
    // 相比直接调用 getEdgePosition，这里可以加一点随机偏移
    const fallback = getEdgePosition(edge, width, height, margin, safeMargin);
    fallback.x += (Math.random() - 0.5) * 50;
    fallback.y += (Math.random() - 0.5) * 50;
    return fallback;
  };

  const posDe = findPos(edgeDe);
  const posCn = findPos(edgeCn);

  // 3. 计算速度向量
  const jitter = Math.PI / 4;
  const angleDe = getBaseAngle(posDe.x, posDe.y, width, height) + (Math.random() - 0.5) * jitter;
  const angleCn = getBaseAngle(posCn.x, posCn.y, width, height) + (Math.random() - 0.5) * jitter;

  // const baseSpeed = 0.35; // Removed: passed as argument
  const speedVar = 0.25;
  const speedDe = baseSpeed + Math.random() * speedVar;
  const speedCn = baseSpeed + Math.random() * speedVar;

  return {
    de: { x: posDe.x, y: posDe.y, vx: Math.cos(angleDe) * speedDe, vy: Math.sin(angleDe) * speedDe },
    cn: { x: posCn.x, y: posCn.y, vx: Math.cos(angleCn) * speedCn, vy: Math.sin(angleCn) * speedCn }
  };
};