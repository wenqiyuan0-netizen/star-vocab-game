// src/logic/visualEntities.js

import Matter from 'matter-js';

// 预创建测量用的 Canvas
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');
measureCtx.font = "bold 22px -apple-system"; 

export const getThemeColor = () => {
  try {
    const saved = localStorage.getItem('star-vocab-theme-palette');
    if (saved) {
      const palette = JSON.parse(saved);
      return {
        main: palette.primary,
        dark: (Array.isArray(palette.mid) && palette.mid.length > 0 ? palette.mid[0] : palette.secondary),
        light: (Array.isArray(palette.analogous) && palette.analogous.length > 0 ? palette.analogous[0] : (palette.accent || '#e2e8f0')),
      };
    }
  } catch (e) {
    console.warn("Failed to load theme for entity", e);
  }

  const hues = [200, 250, 300, 340, 25, 45];
  const hue = hues[Math.floor(Math.random() * hues.length)];
  return {
    main: `hsl(${hue}, 80%, 75%)`,
    dark: `hsl(${hue}, 80%, 60%)`,
    light: `hsl(${hue}, 90%, 90%)`,
  };
};

export class StarFragment {
  constructor(x, y, text, type, wordId, pairId, getScale, world) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.type = type;
    this.wordId = wordId;
    this.pairId = pairId;
    this.theme = getThemeColor();
    this.vx = 0;
    this.vy = 0;
    this.isSelected = false;
    this.isMatched = false;
    this.targetX = null;
    this.targetY = null;
    this.markedForDeletion = false;

    this.getScale = getScale || (() => 1);

    // 逻辑层的基础尺寸（不缩放）
    this.baseFontSize = 22;
    this.baseHeight = 50;
    this.basePadding = 20;

    // 计算逻辑宽度
    // 注意：这里使用 measureCtx 是为了性能，避免每帧 measure
    // 确保 measureCtx 的字体设置和你 draw 里的一致
    measureCtx.font = `bold ${this.baseFontSize}px -apple-system`;
    this.width = measureCtx.measureText(text).width + this.basePadding * 2;
    this.height = this.baseHeight;
    this.padding = this.basePadding;

    this.widthCache = this.width;
    this._lastText = text;

    // Matter.js 物理体
    this.world = world;
    this.body = null;
    
    // [关键修改 1] 获取当前的缩放比例
    const currentScale = this.getScale();
    // 记录下来，用于后续检测变化
    this._lastSyncScale = currentScale; 

    if (this.world) {

      const physWidth = this.width * currentScale * 0.95;
      const physHeight = this.height * currentScale * 0.95;

      this.body = Matter.Bodies.rectangle(x, y, physWidth, physHeight, {
        chamfer: { radius: 10 * currentScale }, // 圆角也随缩放调整
        friction: 0,
        frictionAir: 0, // 稍微加一点点阻力防止无限飘移，如果你喜欢太空感可设为0
        frictionStatic: 0,
        restitution: 1,   // 弹性 0.8，避免无限弹跳
        label: type,
        angle: 0,
        plugin: { fragmentRef: this } // 方便反向查找
      });

      // 锁定旋转惯性，防止方块像风车一样疯转
      Matter.Body.setInertia(this.body, Infinity);
      Matter.World.add(this.world, this.body);
    }
  }
  
  // 代理 setter，方便外部修改速度
  set vx(val) { if(this.body) Matter.Body.setVelocity(this.body, { x: val, y: this.body.velocity.y }); }
  set vy(val) { if(this.body) Matter.Body.setVelocity(this.body, { x: this.body.velocity.x, y: val }); }

  update(dt, width, height, speedMultiplier) {
    const timeScale = dt / 16.6;

    // [关键修改 3] 动态缩放同步
    // 如果窗口大小改变 (uiScale 改变)，我们需要缩放物理刚体
    const newScale = this.getScale();
    // 只有当缩放变化超过 1% 时才执行，节省性能
    if (this.body && Math.abs(newScale - this._lastSyncScale) > 0.01) {
        // Matter.Body.scale 是累乘的，所以要计算相对比例
        const scaleFactor = newScale / this._lastSyncScale;
        Matter.Body.scale(this.body, scaleFactor, scaleFactor);
        this._lastSyncScale = newScale;
    }

    if (this.isMatched && this.targetX !== null) {
      // 匹配状态：移除物理体
      if (this.body) {
        Matter.World.remove(this.world, this.body);
        this.body = null;
      }
      // 插值动画
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      this.x += dx * 0.15 * timeScale;
      this.y += dy * 0.15 * timeScale;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        this.markedForDeletion = true;
      }
    } else {
      // 物理状态
      if (this.body) {
        // 同步位置 (物理 -> 逻辑)
        this.x = this.body.position.x;
        this.y = this.body.position.y;
        
        // 速度限制逻辑 (防止穿模)
        const velocity = this.body.velocity;
        const speed = Math.hypot(velocity.x, velocity.y);
        const maxSpeed = 15 * this.getScale(); // 最大速度也随屏幕缩放

        if (speed > maxSpeed) {
            const ratio = maxSpeed / speed;
            Matter.Body.setVelocity(this.body, { x: velocity.x * ratio, y: velocity.y * ratio });
        }
        // 最小速度维持 (防止彻底停住)
        else if (speed < 0.2) {
             const angle = Math.random() * Math.PI * 2;
             const kick = 0.5 * speedMultiplier;
             Matter.Body.setVelocity(this.body, { 
                 x: Math.cos(angle) * kick, 
                 y: Math.sin(angle) * kick 
             });
        }

      } else {
         // Fallback (无物理体时的简单移动)
         this.x += this.vx * speedMultiplier * timeScale;
         this.y += this.vy * speedMultiplier * timeScale;
      }

      // 销毁逻辑：飞出屏幕
      const margin = 200 * this.getScale(); // margin 也随屏幕缩放
      if (
        this.x < -margin ||
        this.x > width + margin ||
        this.y < -margin ||
        this.y > height + margin
      ) {
        this.markedForDeletion = true;
        if (this.body) {
           Matter.World.remove(this.world, this.body);
           this.body = null;
        }
      }
    }
  }

  draw(ctx) {
    ctx.save();
    
    // 获取当前缩放
    const s = this.getScale();
    
    // 动态计算宽度（如果文字变了）
    if (this.widthCache === 0 || this._lastText !== this.text) {
      ctx.font = `bold ${this.baseFontSize}px -apple-system`;
      this.widthCache = ctx.measureText(this.text).width + this.basePadding * 2;
      this._lastText = this.text;
      // 更新逻辑宽度
      this.width = this.widthCache;
    }

    // 这里的 s 和 物理体中的 s 是一致的
    const drawW = this.width * s;
    const drawH = this.height * s;
    const halfW = drawW / 2;
    const halfH = drawH / 2;
    const r = 12 * s;

    // 移动到中心 (Matter.js 也是以中心为锚点，现在完美对齐了)
    ctx.translate(this.x, this.y);

    // 绘制圆角矩形
    ctx.beginPath();
    ctx.moveTo(-halfW + r, -halfH);
    ctx.lineTo(halfW - r, -halfH);
    ctx.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
    ctx.lineTo(halfW, halfH - r);
    ctx.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
    ctx.lineTo(-halfW + r, halfH);
    ctx.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
    ctx.lineTo(-halfW, -halfH + r);
    ctx.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);
    ctx.closePath();

    // 填充颜色
    const gradient = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
    gradient.addColorStop(0, this.isSelected ? '#fff' : this.theme.light);
    gradient.addColorStop(1, this.isSelected ? '#e0e7ff' : this.theme.main);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 绘制文字
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${this.baseFontSize * s}px -apple-system`; // 文字大小也乘 s
    ctx.fillText(this.text, 0, 2 * s); // 稍微向下偏移一点点视觉居中

    // --- DEBUG: Uncomment to see physics boundary ---
    // ctx.strokeStyle = 'red';
    // ctx.lineWidth = 2;
    // const physW = this.width * s * 0.9; // 记得上面乘了 0.9
    // const physH = this.height * s * 0.9;
    // ctx.strokeRect(-physW/2, -physH/2, physW, physH);
    
    ctx.restore();
  }
}

export class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;

    const speed = Math.random() * 18 + 2;
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.life = 1.0;
    this.decay = Math.random() * 0.03 + 0.015;
    this.color = color;
    this.size = Math.random() * 5 + 2;
    this.markedForDeletion = false;
  }

  update(dt) {
    const timeScale = dt / 16.6;
    this.x += this.vx * timeScale;
    this.y += this.vy * timeScale;
    this.life -= this.decay * timeScale;
    if (this.life <= 0) this.markedForDeletion = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }
}
