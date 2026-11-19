// Transient sights: sparks, smoke, muzzle flashes, skid marks, boat wakes and bow
// spray, floating cash text, brief pools of light, expanding shockwave rings, and
// the camera shake that sells an impact. Nothing here touches the rules; the
// renderer only reads what this module keeps.

export function createFx() {
  return {
    particles: [],
    skids: [],
    texts: [],
    lights: [],
    rings: [],
    shake: 0,

    /** One particle. kind: 'spark' | 'smoke' | 'puff' | 'flash' | 'foam' | 'spray'. */
    spawn(x, y, vx, vy, life, size, color, kind) {
      if (this.particles.length > 460) this.particles.shift();
      this.particles.push({ x, y, vx, vy, life, maxLife: life, size, color, kind });
    },

    /** A fan of hot sparks, for metal on metal and bullet strikes. */
    sparks(x, y, count = 8, baseAngle = null) {
      for (let i = 0; i < count; i += 1) {
        const a = baseAngle === null ? Math.random() * Math.PI * 2 : baseAngle + (Math.random() - 0.5) * 1.6;
        const s = 60 + Math.random() * 240;
        this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.25 + Math.random() * 0.3, 2.2, Math.random() < 0.5 ? '#ffd76a' : '#ff9a3d', 'spark');
      }
    },

    /** A soft grey cloud, for damaged engines and burnouts. */
    smoke(x, y, count = 3, dark = false) {
      for (let i = 0; i < count; i += 1) {
        this.spawn(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 22, -18 - Math.random() * 26, 0.7 + Math.random() * 0.7, 7 + Math.random() * 8, dark ? 'rgba(40,40,44,0.5)' : 'rgba(210,210,205,0.45)', 'smoke');
      }
    },

    /** A single small exhaust puff, for idling engines and hard pulls away. */
    exhaust(x, y) {
      this.spawn(x, y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 0.5 + Math.random() * 0.3, 4 + Math.random() * 3, 'rgba(190,190,185,0.4)', 'smoke');
    },

    /** A dull red puff where a bullet finds a person. */
    hitPuff(x, y) {
      for (let i = 0; i < 5; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 24 + Math.random() * 60;
        this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + Math.random() * 0.2, 3.4, 'rgba(178,44,38,0.75)', 'puff');
      }
    },

    /** The brief star at a gun's muzzle. */
    muzzle(x, y, angle) {
      this.spawn(x, y, Math.cos(angle) * 30, Math.sin(angle) * 30, 0.05, 9, 'rgba(255,214,106,0.95)', 'flash');
    },

    /** Foam churned up at a boat's stern: born small, spreads and fades. */
    wake(x, y, big = false) {
      this.spawn(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, 0.9 + Math.random() * 0.8, (big ? 7 : 4) + Math.random() * 5, 'rgba(234,252,255,0.55)', 'foam');
    },

    /** Bow spray: bright droplets thrown up either side of a fast hull. */
    spray(x, y, angle) {
      for (const side of [-1, 1]) {
        const a = angle + side * (1.15 + Math.random() * 0.3);
        const s = 90 + Math.random() * 90;
        this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.32 + Math.random() * 0.2, 2.2, '#eafcff', 'spray');
      }
    },

    /** A brief pool of light — a muzzle flash or an explosion lighting the street. */
    flash(x, y, r, color, life = 0.09) {
      this.lights.push({ x, y, r, color, life, maxLife: life });
      if (this.lights.length > 24) this.lights.shift();
    },

    /** An expanding ring: the visible edge of a big impact or a checkpoint taken. */
    ring(x, y, color, maxR = 90) {
      this.rings.push({ x, y, r: 6, maxR, color, life: 0.55, maxLife: 0.55 });
      if (this.rings.length > 12) this.rings.shift();
    },

    /** A tyre mark segment; they fade over half a minute and the oldest go first. */
    skid(x1, y1, x2, y2) {
      if (this.skids.length > 520) this.skids.shift();
      this.skids.push({ x1, y1, x2, y2, life: 30 });
    },

    /** Floating words: "+$250", a fare paid, a race won. */
    text(x, y, words, color = '#ffe9a8') {
      this.texts.push({ x, y, words, color, life: 1.6 });
    },

    /** Kick the camera; bigger kicks win. */
    addShake(amount) {
      this.shake = Math.min(16, Math.max(this.shake, amount));
    },

    /** Age everything by dt and drop what has faded. */
    update(dt) {
      this.shake = Math.max(0, this.shake - dt * 26);
      for (const p of this.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'spark' || p.kind === 'spray') {
          p.vx *= 1 - 3.4 * dt;
          p.vy *= 1 - 3.4 * dt;
        }
        if (p.kind === 'smoke') p.size += dt * 7;
        if (p.kind === 'foam') p.size += dt * 16;
      }
      this.particles = this.particles.filter((p) => p.life > 0);
      for (const s of this.skids) s.life -= dt;
      this.skids = this.skids.filter((s) => s.life > 0);
      for (const t of this.texts) {
        t.life -= dt;
        t.y -= 34 * dt;
      }
      this.texts = this.texts.filter((t) => t.life > 0);
      for (const l of this.lights) l.life -= dt;
      this.lights = this.lights.filter((l) => l.life > 0);
      for (const r of this.rings) {
        r.life -= dt;
        r.r += (r.maxR - r.r) * Math.min(1, dt * 7);
      }
      this.rings = this.rings.filter((r) => r.life > 0);
    },
  };
}
