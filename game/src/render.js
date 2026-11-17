// Everything the eye sees of Port Azura: water and sand at the rim, avenues with
// their markings, pastel blocks and rooftops, palms and lamps, cars, people, bullets
// and the light of the hour. The camera follows G.camera; the HUD is hud.js's job.

import { PALETTE, ROADS, ROAD_HALF, WORLD } from './config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  /** Begin a rounded rectangle path (the caller fills or strokes it). */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  let view = { x: 0, y: 0, w: 0, h: 0 };
  function inView(x, y, w, h) {
    return x + w > view.x - 60 && y + h > view.y - 60 && x < view.x + view.w + 60 && y < view.y + view.h + 60;
  }

  function drawGround() {
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    // Lazy wave ticks on the open water outside the island.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    const gx = Math.floor(view.x / 90) * 90;
    const gy = Math.floor(view.y / 90) * 90;
    for (let x = gx; x < view.x + view.w + 90; x += 90) {
      for (let y = gy; y < view.y + view.h + 90; y += 90) {
        if (x > -60 && x < WORLD.w + 30 && y > -60 && y < WORLD.h + 30) continue;
        ctx.fillRect(x + 22, y + 34, 36, 3);
      }
    }
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(-46, -46, WORLD.w + 92, WORLD.h + 92);
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  }

  function drawRoads() {
    ctx.fillStyle = PALETTE.asphalt;
    for (const c of ROADS) {
      ctx.fillRect(c - ROAD_HALF, 0, ROAD_HALF * 2, WORLD.h);
      ctx.fillRect(0, c - ROAD_HALF, WORLD.w, ROAD_HALF * 2);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    for (const c of ROADS) {
      for (const off of [-ROAD_HALF + 3, ROAD_HALF - 3]) {
        ctx.beginPath();
        ctx.moveTo(c + off, 0);
        ctx.lineTo(c + off, WORLD.h);
        ctx.moveTo(0, c + off);
        ctx.lineTo(WORLD.w, c + off);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = PALETTE.centreLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (const c of ROADS) {
      ctx.beginPath();
      ctx.moveTo(c, 0);
      ctx.lineTo(c, WORLD.h);
      ctx.moveTo(0, c);
      ctx.lineTo(WORLD.w, c);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Crosswalks at every intersection.
    ctx.fillStyle = PALETTE.crosswalk;
    for (const cx of ROADS) {
      for (const cy of ROADS) {
        for (let s = -2; s <= 2; s += 1) {
          if (s === 0) continue;
          ctx.fillRect(cx + s * 24 - 8, cy - ROAD_HALF - 14, 16, 10);
          ctx.fillRect(cx + s * 24 - 8, cy + ROAD_HALF + 4, 16, 10);
          ctx.fillRect(cx - ROAD_HALF - 14, cy + s * 24 - 8, 10, 16);
          ctx.fillRect(cx + ROAD_HALF + 4, cy + s * 24 - 8, 10, 16);
        }
      }
    }
  }

  function drawBlocks(G) {
    for (const block of G.city.blocks) {
      if (!inView(block.x, block.y, block.w, block.h)) continue;
      if (block.use === 'park') {
        ctx.fillStyle = PALETTE.park;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.fillStyle = PALETTE.parkDark;
        ctx.fillRect(block.x + block.w / 2 - 7, block.y, 14, block.h);
        ctx.fillRect(block.x, block.y + block.h / 2 - 7, block.w, 14);
      } else if (block.use === 'lot') {
        ctx.fillStyle = PALETTE.asphaltDark;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        for (let s = 0; s < 6; s += 1) {
          ctx.strokeRect(block.x + 26 + s * 44, block.y + 44, 34, 62);
          ctx.strokeRect(block.x + 26 + s * 44, block.y + block.h - 106, 34, 62);
        }
      } else if (block.use === 'airfield') {
        ctx.fillStyle = '#9aa0a4';
        ctx.fillRect(block.x, block.y, block.w, block.h);
        // The runway runs the length of the northern strip.
        ctx.fillStyle = '#4a4f55';
        ctx.fillRect(block.x, block.y + block.h / 2 - 26, block.w, 52);
        ctx.strokeStyle = '#f5f2e4';
        ctx.lineWidth = 3;
        ctx.setLineDash([30, 24]);
        ctx.beginPath();
        ctx.moveTo(block.x, block.y + block.h / 2);
        ctx.lineTo(block.x + block.w, block.y + block.h / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (block.use === 'docks' || block.use === 'marina') {
        ctx.fillStyle = '#c9bfa5';
        ctx.fillRect(block.x, block.y, block.w, block.h);
      } else {
        ctx.fillStyle = PALETTE.sidewalk;
        ctx.fillRect(block.x, block.y, block.w, block.h);
      }
    }
  }

  function drawBuildings(G) {
    for (const b of G.city.buildings) {
      if (!inView(b.x, b.y, b.w, b.h)) continue;
      const lift = 5 + b.floors * 1.1;
      ctx.fillStyle = 'rgba(30,25,18,0.25)';
      ctx.fillRect(b.x + lift, b.y + lift + 3, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.strokeStyle = PALETTE.roofEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      for (const prop of b.roofProps) ctx.fillRect(b.x + prop.dx, b.y + prop.dy, prop.s, prop.s * 0.7);
      if (b.sign === 'hospital') {
        ctx.fillStyle = '#e8e4da';
        ctx.fillRect(b.x + b.w / 2 - 16, b.y + 12, 32, 32);
        ctx.fillStyle = '#d23b2e';
        ctx.fillRect(b.x + b.w / 2 - 4, b.y + 17, 8, 22);
        ctx.fillRect(b.x + b.w / 2 - 11, b.y + 24, 22, 8);
      }
      if (b.name !== null && b.w > 120) {
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h - 12);
      }
    }
  }

  function drawProps(G) {
    for (const prop of G.city.props) {
      if (!inView(prop.x - 20, prop.y - 20, 40, 40)) continue;
      if (prop.kind === 'palm') {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(prop.x + 4, prop.y + 5, 11, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5da244';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#79b657';
        ctx.beginPath();
        ctx.arc(prop.x - 2, prop.y - 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8a6b42';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (prop.kind === 'lamp') {
        ctx.fillStyle = '#6d7278';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        if (G.nightAmount > 0.25) {
          ctx.fillStyle = `rgba(255,196,92,${0.20 * G.nightAmount})`;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, 17, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (prop.kind === 'crate') {
        ctx.fillStyle = '#a67c4e';
        ctx.fillRect(prop.x - 8, prop.y - 8, 16, 16);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.strokeRect(prop.x - 8, prop.y - 8, 16, 16);
      } else if (prop.kind === 'bench') {
        ctx.fillStyle = '#8a5a3b';
        ctx.fillRect(prop.x - 10, prop.y - 3, 20, 6);
      }
    }
  }

  function drawMarker(G) {
    const marker = G.director.marker();
    if (marker === null) return;
    const pulse = 1 + Math.sin(G.time * 5) * 0.16;
    ctx.strokeStyle = 'rgba(242,193,78,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(242,193,78,0.16)';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 30 * pulse, 0, Math.PI * 2);
    ctx.fill();
    const bob = Math.sin(G.time * 4) * 5;
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.moveTo(marker.x, marker.y - 44 + bob);
    ctx.lineTo(marker.x - 10, marker.y - 62 + bob);
    ctx.lineTo(marker.x + 10, marker.y - 62 + bob);
    ctx.closePath();
    ctx.fill();
  }

  function shade(hex, amount) {
    const n = Number.parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
    return `rgb(${r},${g},${b})`;
  }

  function drawCar(car, G) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = car.len;
    const W = car.wid;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(-L / 2 + 3, -W / 2 + 4, L, W, 7);
    ctx.fill();
    ctx.fillStyle = '#191c20';
    for (const [wx, wy] of [[-L * 0.32, -W / 2 - 1], [L * 0.32, -W / 2 - 1], [-L * 0.32, W / 2 - 3], [L * 0.32, W / 2 - 3]]) {
      ctx.fillRect(wx - 5, wy, 10, 4);
    }
    ctx.fillStyle = car.wrecked ? '#3a3d40' : car.color;
    roundRect(-L / 2, -W / 2, L, W, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (car.type === 'police' && !car.wrecked) {
      ctx.fillStyle = '#eef1f5';
      ctx.fillRect(-L * 0.16, -W / 2 + 1, L * 0.3, W - 2);
      // The light bar: red and blue halves trade flashes.
      const phase = Math.floor(G.time * 5 + car.sirenPhase) % 2;
      ctx.fillStyle = phase === 0 ? '#ff4747' : '#7a1d1d';
      ctx.fillRect(-6, -W / 2 + 3, 6, W / 2 - 3);
      ctx.fillStyle = phase === 0 ? '#2b3a67' : '#4f7dff';
      ctx.fillRect(0, 0, 6, W / 2 - 3);
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#20242c';
      ctx.fillRect(-4, -W / 2 + 2, 8, 5);
      ctx.fillRect(-4, W / 2 - 7, 8, 5);
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(-5, -4, 10, 8);
    }
    // Cabin: windscreens and roof.
    ctx.fillStyle = 'rgba(190,230,242,0.85)';
    ctx.fillRect(L * 0.08, -W / 2 + 3, 6, W - 6);
    ctx.fillRect(-L * 0.30, -W / 2 + 3, 5, W - 6);
    ctx.fillStyle = car.wrecked ? '#2c2e30' : shade(car.color, -28);
    roundRect(-L * 0.24, -W / 2 + 3.5, L * 0.3, W - 7, 4);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(L / 2 - 2, -W / 2 + 2, 2.5, 4);
    ctx.fillRect(L / 2 - 2, W / 2 - 6, 2.5, 4);
    ctx.fillStyle = '#e0483e';
    ctx.fillRect(-L / 2, -W / 2 + 2, 2.5, 4);
    ctx.fillRect(-L / 2, W / 2 - 6, 2.5, 4);
    ctx.restore();
    // A mission car wears a gold ring so the eye finds it.
    if (car.missionCar && !car.wrecked) {
      ctx.strokeStyle = 'rgba(242,193,78,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(car.x, car.y, car.len * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPerson(x, y, shirt, skin, angle, walkCycle, isPlayer) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 4, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    const stride = Math.sin(walkCycle) * 4;
    ctx.strokeStyle = '#31435c';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle + 0.5) * (5 + stride * 0.4), y + Math.sin(angle + 0.5) * (5 + stride * 0.4));
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle - 0.5) * (5 - stride * 0.4), y + Math.sin(angle - 0.5) * (5 - stride * 0.4));
    ctx.stroke();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(x, y, isPlayer ? 8.6 : 7.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 2.5, y + Math.sin(angle) * 2.5, 4.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPeds(G) {
    for (const ped of G.peds) {
      if (!inView(ped.x - 24, ped.y - 24, 48, 48)) continue;
      if (ped.dead) {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(ped.angle + Math.PI / 2);
        ctx.globalAlpha = Math.min(1, ped.downT / 1.5);
        ctx.fillStyle = ped.shirt;
        roundRect(-5, -11, 10, 22, 5);
        ctx.fill();
        ctx.fillStyle = ped.skin;
        ctx.beginPath();
        ctx.arc(0, -14, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
        continue;
      }
      drawPerson(ped.x, ped.y, ped.shirt, ped.skin, ped.angle, ped.walkCycle ?? 0, false);
      if (ped.role === 'cop') {
        ctx.fillStyle = '#1d3355';
        ctx.beginPath();
        ctx.arc(ped.x, ped.y, 4.6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (ped.role === 'client') {
        const bob = Math.sin(G.time * 4 + ped.x) * 3;
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath();
        ctx.arc(ped.x, ped.y - 26 + bob, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#20242c';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', ped.x, ped.y - 22 + bob);
      }
    }
  }

  function drawPlayer(G) {
    const p = G.player;
    if (p.car !== null) return;
    drawPerson(p.x, p.y, '#e4572e', '#c68863', p.angle, p.walkCycle, true);
    if (p.fireCd > -0.6) {
      ctx.strokeStyle = '#20242c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.angle) * 7, p.y + Math.sin(p.angle) * 7);
      ctx.lineTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
      ctx.stroke();
    }
    if (p.hurtT > 0) {
      ctx.strokeStyle = `rgba(224,60,40,${Math.min(1, p.hurtT * 2.4)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawFx(G) {
    ctx.strokeStyle = 'rgba(20,20,22,0.4)';
    ctx.lineWidth = 3.4;
    for (const s of G.fx.skids) {
      ctx.globalAlpha = Math.min(0.4, s.life / 30);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    for (const b of G.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const particle of G.fx.particles) {
      const lifeT = particle.life / particle.maxLife;
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = particle.kind === 'smoke' ? lifeT * 0.8 : lifeT;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.kind === 'smoke' ? particle.size * (1.6 - lifeT * 0.6) : particle.size * lifeT + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** The light of the hour: warm at the day's edges, blue after dark. */
  function drawTint(G, w, h) {
    const hour = G.dayHour;
    let fill = null;
    if (hour >= 19.5 || hour < 5.5) fill = 'rgba(16,24,58,0.34)';
    else if (hour >= 17.5) fill = 'rgba(255,128,44,0.15)';
    else if (hour < 7.5) fill = 'rgba(255,166,66,0.10)';
    if (fill !== null) {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, w, h);
    }
  }

  return {
    ctx,
    roundRect,
    /** Paint the world (not the HUD) for this frame. */
    draw(G) {
      const w = canvas.width;
      const h = canvas.height;
      const shakeX = (Math.random() - 0.5) * G.fx.shake;
      const shakeY = (Math.random() - 0.5) * G.fx.shake;
      const camX = G.camera.x + shakeX;
      const camY = G.camera.y + shakeY;
      view = { x: camX - w / 2, y: camY - h / 2, w, h };
      ctx.save();
      ctx.translate(-view.x, -view.y);
      drawGround();
      drawRoads();
      drawBlocks(G);
      drawBuildings(G);
      drawProps(G);
      drawMarker(G);
      for (const car of G.cars) if (inView(car.x - 50, car.y - 50, 100, 100)) drawCar(car, G);
      drawPeds(G);
      drawPlayer(G);
      drawFx(G);
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const t of G.fx.texts) {
        ctx.globalAlpha = Math.min(1, t.life);
        ctx.fillStyle = t.color;
        ctx.fillText(t.words, t.x, t.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      drawTint(G, w, h);
    },
  };
}
