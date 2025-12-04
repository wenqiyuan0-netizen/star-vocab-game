// src/logic/visualEntities.js

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
  constructor(x, y, text, type, wordId, pairId, getScale) {
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

    this.width = 0;     // 逻辑 width（不缩放）
    this.height = this.baseHeight; // 不缩放
    this.padding = this.basePadding;

    this.widthCache = 0;
    this._lastText = "";
  }

  update(dt, width, height, speedMultiplier) {
    const timeScale = dt / 16.6;

    if (this.isMatched && this.targetX !== null) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      this.x += dx * 0.15 * timeScale;
      this.y += dy * 0.15 * timeScale;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        this.markedForDeletion = true;
      }
    } else {
      this.x += this.vx * speedMultiplier * timeScale;
      this.y += this.vy * speedMultiplier * timeScale;

      // 删除逻辑保持不变，无缩放影响
      const margin = 150;
      if (
        this.x < -margin ||
        this.x > width + margin ||
        this.y < -margin ||
        this.y > height + margin
      ) {
        this.markedForDeletion = true;
      }
    }
  }

  draw(ctx) {
    ctx.save();

    const s = this.getScale(); // 仅用于视觉

    const fontSize = this.baseFontSize * s;

    // 仅绘图缩放，这里测量逻辑宽度（不缩放）
    if (this.widthCache === 0 || this._lastText !== this.text) {
      ctx.font = `bold ${this.baseFontSize}px -apple-system`;
      this.widthCache = ctx.measureText(this.text).width + this.basePadding * 2;
      this._lastText = this.text;
    }

    // 逻辑层宽度不变
    this.width = this.widthCache;
    this.height = this.baseHeight;

    // 绘图层根据 s 缩放
    const drawW = this.width * s;
    const drawH = this.height * s;

    ctx.translate(this.x, this.y);

    const halfW = drawW / 2;
    const halfH = drawH / 2;
    const r = 12 * s;

    const gradient = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
    gradient.addColorStop(0, this.isSelected ? '#fff' : this.theme.light);
    gradient.addColorStop(1, this.isSelected ? '#e0e7ff' : this.theme.main);

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

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px -apple-system`;
    ctx.fillText(this.text, 0, 2 * s);

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
