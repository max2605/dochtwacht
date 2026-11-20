(() => {
  "use strict";

  const MAP_ASPECT = 1.95;
  const TOWERS = {
    flame: { cost: 60, range: 0.162, damage: 7, rate: 1.25, shotSpeed: 0.52 },
    splash: { cost: 90, range: 0.157, damage: 8, rate: 0.70, shotSpeed: 0.42, radius: 0.075 },
    frost: { cost: 75, range: 0.185, damage: 4, rate: 1.0, shotSpeed: 0.54, slow: 0.52, slowDuration: 1.9 },
    aura: { cost: 100, range: 0.205, damage: 0, rate: 0, buff: 0.25 }
  };
  const ENEMIES = {
    imp: { hp: 10, speed: 0.048, leakDamage: 4, firstWave: 1 },
    wraith: { hp: 23, speed: 0.062, leakDamage: 8, firstWave: 3 },
    brute: { hp: 62, speed: 0.035, leakDamage: 16, firstWave: 6 }
  };
  const RATE_BY_LEVEL = [1, 1.35, 1.8, 2.45];
  const BUFF_BY_LEVEL = [0.25, 0.39, 0.56, 0.76];
  const UPGRADE_PRICES = [0.85, 1.35, 2.1];

  function distance(a, b) {
    return Math.hypot(a.x - b.x, (a.y - b.y) / MAP_ASPECT);
  }

  function wavePlan(wave) {
    const count = 6 + (wave - 1) * 2;
    const plan = [];
    for (let index = 0; index < count; index++) {
      if (wave >= ENEMIES.brute.firstWave && (index === count - 1 || (index + 1) % 7 === 0)) {
        plan.push("brute");
      } else if (wave >= ENEMIES.wraith.firstWave && (index + 1) % 3 === 0) {
        plan.push("wraith");
      } else {
        plan.push("imp");
      }
    }
    return plan;
  }

  function enemyStats(type, wave) {
    const base = ENEMIES[type];
    const hp = Math.round(base.hp * Math.pow(1.12, wave - 1));
    return { hp, speed: base.speed * (1 + Math.min(wave - 1, 20) * 0.011), leakDamage: base.leakDamage };
  }

  class Game {
    constructor(path, pads) {
      this.path = path.map(([x, y]) => ({ x, y }));
      this.segments = [];
      this.pathLength = 0;
      for (let index = 1; index < this.path.length; index++) {
        const a = this.path[index - 1];
        const b = this.path[index];
        const length = distance(a, b);
        if (length > 0) {
          this.segments.push({ a, b, start: this.pathLength, length });
          this.pathLength += length;
        }
      }
      if (!this.segments.length) throw new Error("Der Pfad braucht zwei unterschiedliche Punkte.");
      this.pads = pads.map(([x, y]) => ({ x, y, tower: null }));
      this.reset();
    }

    reset() {
      this.state = "ready";
      this.wave = 0;
      this.hp = this.maxHp = 100;
      this.shrineLevel = 1;
      this.essence = 180;
      this.kills = this.waveTotal = this.spawned = this.waveDefeated = this.waveEscaped = 0;
      this.enemies = [];
      this.projectiles = [];
      this.effects = [];
      this.towers = [];
      this.plan = [];
      this.nextId = 1;
      for (const pad of this.pads) pad.tower = null;
      if (this.pads.length) this.placeTower("flame", 0);
    }

    placeTower(type, padIndex) {
      const pad = this.pads[padIndex];
      const tower = { type, level: 1, padIndex, x: pad.x, y: pad.y, cooldown: 0 };
      pad.tower = tower;
      this.towers.push(tower);
    }

    build(type, padIndex) {
      const pad = this.pads[padIndex];
      const definition = Object.hasOwn(TOWERS, type) && TOWERS[type];
      if (!pad || pad.tower || !definition || this.state === "lost" || this.essence < definition.cost) return false;
      this.essence -= definition.cost;
      this.placeTower(type, padIndex);
      return true;
    }

    towerUpgradeCost(padIndex) {
      const tower = this.pads[padIndex]?.tower;
      if (!tower || tower.level >= RATE_BY_LEVEL.length) return Infinity;
      return Math.round(TOWERS[tower.type].cost * UPGRADE_PRICES[tower.level - 1] / 5) * 5;
    }

    upgradeTower(padIndex) {
      const cost = this.towerUpgradeCost(padIndex);
      if (!Number.isFinite(cost) || this.state === "lost" || cost > this.essence) return false;
      const tower = this.pads[padIndex].tower;
      this.essence -= cost;
      tower.level++;
      tower.cooldown *= RATE_BY_LEVEL[tower.level - 2] / RATE_BY_LEVEL[tower.level - 1];
      return true;
    }

    shrineUpgradeCost() {
      return 100 + (this.shrineLevel - 1) * 90;
    }

    upgradeShrine() {
      const cost = this.shrineUpgradeCost();
      if (this.state === "lost" || this.essence < cost) return false;
      this.essence -= cost;
      this.shrineLevel++;
      this.maxHp += 25;
      this.hp = Math.min(this.maxHp, this.hp + 50);
      return true;
    }

    towerStats(padIndex, level) {
      const tower = this.pads[padIndex]?.tower;
      if (!tower) return null;
      const base = TOWERS[tower.type];
      const statLevel = level ?? tower.level;
      if (tower.type === "aura") return { damage: 0, rate: 0, range: base.range, buff: BUFF_BY_LEVEL[statLevel - 1] };
      let buff = 0;
      for (const other of this.towers) {
        if (other.type === "aura" && distance(tower, other) <= TOWERS.aura.range) {
          buff = Math.max(buff, BUFF_BY_LEVEL[other.level - 1]);
        }
      }
      return { damage: base.damage, range: base.range, rate: base.rate * RATE_BY_LEVEL[statLevel - 1] * (1 + buff), buff };
    }

    startWave() {
      if (this.state !== "ready") return false;
      this.wave++;
      this.state = "running";
      this.plan = wavePlan(this.wave);
      this.waveTotal = this.plan.length;
      this.spawned = this.waveDefeated = this.waveEscaped = 0;
      this.spawnInterval = Math.max(0.47, 1.15 - (this.wave - 1) * 0.035);
      this.spawnTimer = this.spawnInterval;
      this.spawnEnemy();
      return true;
    }

    spawnEnemy() {
      const type = this.plan[this.spawned++];
      const stats = enemyStats(type, this.wave);
      const start = this.segments[0].a;
      this.enemies.push({
        id: this.nextId++, type, x: start.x, y: start.y, hp: stats.hp, maxHp: stats.hp,
        speed: stats.speed, leakDamage: stats.leakDamage, slow: 1, slowTime: 0,
        traveled: 0, progress: 0, segmentIndex: 0, dx: 0, dy: 0
      });
    }

    addEffect(x, y, type, duration) {
      this.effects.push({ x, y, type, age: 0, duration });
    }

    advanceEnemy(enemy, dt) {
      enemy.traveled += enemy.speed * (Math.min(dt, enemy.slowTime) * enemy.slow + Math.max(0, dt - enemy.slowTime));
      enemy.slowTime = Math.max(0, enemy.slowTime - dt);
      if (!enemy.slowTime) enemy.slow = 1;
      enemy.progress = Math.min(1, enemy.traveled / this.pathLength);
      let segment = this.segments[enemy.segmentIndex];
      while (enemy.segmentIndex < this.segments.length - 1 && enemy.traveled >= segment.start + segment.length) {
        segment = this.segments[++enemy.segmentIndex];
      }
      const fraction = Math.min(1, (enemy.traveled - segment.start) / segment.length);
      enemy.dx = segment.b.x - segment.a.x;
      enemy.dy = segment.b.y - segment.a.y;
      enemy.x = segment.a.x + enemy.dx * fraction;
      enemy.y = segment.a.y + enemy.dy * fraction;
      if (enemy.progress >= 1) {
        enemy.hp = 0;
        this.hp = Math.max(0, this.hp - enemy.leakDamage);
        this.waveEscaped++;
        this.addEffect(enemy.x, enemy.y, "leak", 0.5);
        if (!this.hp) this.state = "lost";
      }
    }

    fire(tower, dt) {
      if (tower.type === "aura") return;
      tower.cooldown = Math.max(0, tower.cooldown - dt);
      if (tower.cooldown > 0) return;
      const stats = this.towerStats(tower.padIndex);
      let target = null;
      for (const enemy of this.enemies) {
        if (enemy.hp > 0 && (!target || enemy.progress > target.progress) && distance(tower, enemy) <= stats.range) target = enemy;
      }
      if (!target) return;
      tower.cooldown = 1 / stats.rate;
      this.projectiles.push({
        type: tower.type, x: tower.x, y: tower.y, fromX: tower.x, fromY: tower.y,
        targetId: target.id, target, damage: stats.damage
      });
    }

    hit(enemy, shot) {
      if (enemy.hp <= 0) return;
      enemy.hp = Math.max(0, enemy.hp - shot.damage);
      if (!enemy.hp) {
        this.essence += enemy.maxHp;
        this.kills++;
        this.waveDefeated++;
        this.addEffect(enemy.x, enemy.y, "kill", 0.45);
      } else if (shot.type === "frost") {
        enemy.slow = TOWERS.frost.slow;
        enemy.slowTime = TOWERS.frost.slowDuration;
      }
    }

    advanceShot(shot, dt) {
      const target = shot.target;
      const gap = distance(shot, target);
      const step = TOWERS[shot.type].shotSpeed * dt;
      if (gap > step) {
        shot.x += (target.x - shot.x) * step / gap;
        shot.y += (target.y - shot.y) * step / gap;
        return true;
      }
      if (shot.type === "splash") {
        for (const enemy of this.enemies) {
          if (distance(target, enemy) <= TOWERS.splash.radius) this.hit(enemy, shot);
        }
        this.addEffect(target.x, target.y, "splash", 0.35);
      } else if (target.hp > 0) {
        this.hit(target, shot);
        this.addEffect(target.x, target.y, shot.type === "frost" ? "frost" : "hit", 0.25);
      }
      return false;
    }

    advanceEffects(dt) {
      for (const effect of this.effects) effect.age += dt;
      this.effects = this.effects.filter(effect => effect.age < effect.duration);
    }

    step(dt) {
      this.advanceEffects(dt);
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.spawned < this.waveTotal) {
        this.spawnEnemy();
        this.spawnTimer += this.spawnInterval;
      }
      for (const enemy of this.enemies) {
        this.advanceEnemy(enemy, dt);
        if (this.state === "lost") return;
      }
      for (const tower of this.towers) this.fire(tower, dt);
      this.projectiles = this.projectiles.filter(shot => this.advanceShot(shot, dt));
      this.enemies = this.enemies.filter(enemy => enemy.hp > 0);
      if (this.spawned === this.waveTotal && this.enemies.length === 0) {
        this.state = "ready";
        this.projectiles.length = 0;
        for (const tower of this.towers) tower.cooldown = 0;
      }
    }

    tick(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      let remaining = seconds;
      while (remaining > 0 && this.state === "running") {
        const dt = Math.min(remaining, 1 / 60);
        this.step(dt);
        remaining -= dt;
      }
      if (remaining > 0) this.advanceEffects(remaining);
    }
  }

  globalThis.TD = { Game, TOWERS, ENEMIES, wavePlan, enemyStats };
})();
