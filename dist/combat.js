(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const SPRITES = { imp: 0.030, wraith: 0.0365, brute: 0.046 };
  const SHOTS = {
    flame: { glow: "255,133,36", rim: "#ff9f32", core: "#fff6bb", size: 0.0023 },
    splash: { glow: "255,67,23", rim: "#ff622e", core: "#ffefae", size: 0.0031 },
    frost: { glow: "94,213,255", rim: "#a2eaff", core: "#efffff", size: 0.0023 }
  };
  const scriptBase = document.currentScript?.src || document.baseURI;

  function bloom(ctx, x, y, radius, color, strength) {
    const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, 'rgba(' + color + ',' + strength + ')');
    light.addColorStop(0.35, 'rgba(' + color + ',' + strength * 0.48 + ')');
    light.addColorStop(1, 'rgba(' + color + ',0)');
    ctx.fillStyle = light;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  }

  function ambient(ctx, width, height, time) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 13; i++) {
      const seed = i * 137.508;
      const x = ((seed + 8) % 96 * 0.01 + 0.004 * Math.sin(time * 0.32 + seed)) * width;
      const y = ((seed * 1.77 + 18) % 91 * 0.01 + 0.012 * Math.sin(time * 0.21 + i)) * height;
      const pulse = Math.max(0, Math.sin(seed + time * 0.54));
      if (pulse < 0.05) continue;
      const color = i % 3 === 0 ? "180,195,240" : "245,190,102";
      bloom(ctx, x, y, width * 0.0023, color, pulse * 0.28);
      ctx.fillStyle = 'rgba(' + color + ',' + pulse * 0.72 + ')';
      ellipse(ctx, x, y, width * 0.00065, width * 0.00077);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy(ctx, enemy, sprite, width, height, time) {
    if (!sprite.complete || !sprite.naturalWidth || enemy.hp <= 0) return;
    const h = width * SPRITES[enemy.type];
    const w = h * sprite.naturalWidth / sprite.naturalHeight;
    const x = enemy.x * width;
    const y = enemy.y * height;
    const ghost = enemy.type === "wraith";
    const stride = Math.sin(enemy.traveled * (enemy.type === "brute" ? 450 : 640) + enemy.id);
    const bob = ghost ? (0.052 + 0.035 * Math.sin(time * 3.8 + enemy.id)) * h : (0.012 + 0.028 * Math.abs(stride)) * h;
    ctx.save();
    ctx.fillStyle = ghost ? "rgba(7,7,21,0.24)" : "rgba(7,5,14,0.39)";
    ellipse(ctx, x, y - h * 0.013, w * 0.36, h * 0.077);
    ctx.fill();
    if (enemy.slow < 1) {
      ctx.strokeStyle = "rgba(141,226,255,0.78)";
      ctx.lineWidth = Math.max(0.75, h * 0.022);
      ellipse(ctx, x, y - h * 0.016, w * 0.43, h * 0.12);
      ctx.stroke();
      bloom(ctx, x, y - h * 0.045, h * 0.39, "118,210,255", 0.24);
    }
    ctx.save();
    ctx.translate(x, y - bob);
    const facing = enemy.dx < -0.00001 ? -1 : 1;
    ctx.scale(facing, 1);
    ctx.rotate(ghost ? 0.021 * Math.sin(time * 2.25 + enemy.id) : stride * 0.020);
    ctx.drawImage(sprite, -w / 2, -h, w, h);
    ctx.restore();
    if (enemy.hp < enemy.maxHp) {
      const barWidth = Math.max(h * 0.50, width * 0.014);
      const barHeight = Math.max(2, width * 0.0021);
      const barX = x - barWidth / 2;
      const barY = y - h * 1.16;
      ctx.fillStyle = "rgba(7,6,13,0.92)";
      ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
      ctx.fillStyle = "#523039";
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = "#e78b74";
      ctx.fillRect(barX, barY, barWidth * enemy.hp / enemy.maxHp, barHeight);
    }
    ctx.restore();
  }

  function drawShot(ctx, shot, width, height, time) {
    const style = SHOTS[shot.type];
    const target = shot.target;
    const flight = Math.hypot((shot.x - shot.fromX) * width, (shot.y - shot.fromY) * height);
    const left = Math.hypot((target.x - shot.x) * width, (target.y - shot.y) * height);
    const progress = flight / Math.max(1, flight + left);
    const launchHeight = 0.060 * width;
    const impactHeight = SPRITES[target.type] * 0.47 * width;
    const x = shot.x * width;
    const y = shot.y * height - launchHeight * (1 - progress) - impactHeight * progress;
    const sourceX = shot.fromX * width;
    const sourceY = shot.fromY * height - launchHeight;
    const angle = Math.atan2(target.y * height - impactHeight - sourceY, target.x * width - sourceX);
    const radius = style.size * width;
    const trail = Math.min(Math.hypot(x - sourceX, y - sourceY), radius * 6.6);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "lighter";
    bloom(ctx, 0, 0, radius * 4.5, style.glow, 0.54);
    if (trail > 0.25) {
      const streak = ctx.createLinearGradient(-trail, 0, 0, 0);
      streak.addColorStop(0, 'rgba(' + style.glow + ',0)');
      streak.addColorStop(0.55, 'rgba(' + style.glow + ',0.58)');
      streak.addColorStop(1, style.rim);
      ctx.fillStyle = streak;
      ctx.beginPath();
      ctx.moveTo(-trail, Math.sin(time * 28 + target.id) * radius * 0.4);
      ctx.quadraticCurveTo(-trail * 0.32, -radius * 0.55, 0, -radius);
      ctx.lineTo(0, radius);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = style.rim;
    ellipse(ctx, 0, 0, radius * 1.2, radius);
    ctx.fill();
    ctx.fillStyle = style.core;
    ellipse(ctx, radius * 0.16, -radius * 0.12, radius * 0.76, radius * 0.59);
    ctx.fill();
    ctx.restore();
  }

  function drawEffect(ctx, effect, width, height) {
    const p = Math.min(1, effect.age / effect.duration);
    if (p >= 1) return;
    const x = effect.x * width;
    const y = effect.y * height;
    const splash = effect.type === "splash";
    const frost = effect.type === "frost";
    const leak = effect.type === "leak";
    const kill = effect.type === "kill";
    const color = frost ? "117,218,255" : leak ? "255,83,61" : kill ? "227,183,105" : "255,137,46";
    const radius = width * (splash ? 0.062 : leak ? 0.030 : kill ? 0.019 : 0.012);
    const originY = splash || leak ? y - width * 0.005 : y - width * 0.014;
    const fade = 1 - p;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    bloom(ctx, x, originY, Math.max(1, radius * (0.18 + p * 0.76)), color, fade * (splash ? 0.66 : 0.52));
    if (splash || leak || frost) {
      ctx.strokeStyle = 'rgba(' + color + ',' + fade * (splash ? 0.78 : 0.65) + ')';
      ctx.lineWidth = Math.max(0.6, width * (splash ? 0.002 : 0.0014) * fade);
      const wave = radius * (0.14 + Math.sin(p * Math.PI / 2) * 0.86);
      ellipse(ctx, x, originY, wave, wave * (frost ? 0.68 : 0.54));
      ctx.stroke();
    }
    const count = splash ? 11 : (kill ? 8 : 5);
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU + effect.x * 34;
      const length = radius * (0.13 + p * (0.50 + (i % 3) * 0.10));
      const px = x + Math.cos(a) * length;
      const py = originY + Math.sin(a) * length * 0.58 - p * width * (kill ? 0.013 : 0.004);
      const size = width * (splash ? 0.0018 : 0.0012) * (0.28 + fade * 0.72);
      ctx.fillStyle = 'rgba(' + color + ',' + fade + ')';
      ellipse(ctx, px, py, size, size * (frost ? 1.72 : 1.15));
      ctx.fill();
    }
    ctx.restore();
  }

  class BattlePainter {
    constructor(canvas, game) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.game = game;
      this.sprites = {};
      for (const type of Object.keys(SPRITES)) {
        const sprite = new Image();
        sprite.src = new URL("./assets/enemy-" + type + ".png", scriptBase).href;
        this.sprites[type] = sprite;
      }
    }

    draw(time = performance.now() / 1000) {
      const { canvas, ctx, game } = this;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ambient(ctx, width, height, time);
      const enemies = [...game.enemies].sort((a, b) => a.y - b.y);
      for (const enemy of enemies) drawEnemy(ctx, enemy, this.sprites[enemy.type], width, height, time);
      for (const shot of game.projectiles) drawShot(ctx, shot, width, height, time);
      for (const effect of game.effects) drawEffect(ctx, effect, width, height);
    }
  }

  window.BattlePainter = BattlePainter;
})();
