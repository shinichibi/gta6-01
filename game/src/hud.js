// Everything drawn over the world: the HUD (cash, health, the clock, wanted stars,
// weapon, speed), the minimap (now with its shoreline and the harbour's boats), the
// objective banner, Vera's phone, and the screens — title, pause, and the hospital
// wake-up. Plain canvas, no DOM.

import { ROADS, SHORE, WEAPONS, WORLD } from './config.js';
import { clamp } from './util.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Wrap a line of text to a pixel width, returning the lines. */
export function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(trial).width > maxWidth && line !== '') {
      lines.push(line);
      line = word;
    } else line = trial;
  }
  if (line !== '') lines.push(line);
  return lines;
}

function panel(ctx, x, y, w, h, alpha = 0.72) {
  ctx.fillStyle = `rgba(14,20,28,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** One wanted star, filled gold or dim. */
function star(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? size : size * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#f2c14e' : 'rgba(255,255,255,0.22)';
  ctx.fill();
  ctx.restore();
}

/** The minimap: the island in its sea — shoreline, roads, blips, boats, the player. */
export function drawMinimap(ctx, G, x, y, size) {
  const scale = size / WORLD.w;
  // World points can sit off the island (boats, the anchored yacht): clamp blips
  // to the map's edge rather than letting them swim off the glass.
  const mx = (wx) => x + clamp(wx, -SHORE, WORLD.w + SHORE) * scale;
  const my = (wy) => y + clamp(wy, -SHORE, WORLD.h + SHORE) * scale;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 10);
  ctx.clip();
  ctx.fillStyle = '#227186';
  ctx.fillRect(x, y, size, size);
  // The sand rim, then the land inside it.
  ctx.fillStyle = '#e6d29b';
  ctx.fillRect(x - SHORE * scale, y - SHORE * scale, (WORLD.w + SHORE * 2) * scale, (WORLD.h + SHORE * 2) * scale);
  ctx.fillStyle = '#b5ab90';
  ctx.fillRect(x, y, size, size);
  for (const block of G.city.blocks) {
    ctx.fillStyle = block.use === 'park' ? '#79b657' : block.use === 'lot' || block.use === 'airfield' ? '#9aa0a4' : '#8f8672';
    ctx.fillRect(x + block.x * scale, y + block.y * scale, block.w * scale, block.h * scale);
  }
  ctx.strokeStyle = '#e8e4d2';
  ctx.lineWidth = 1.4;
  for (const c of ROADS) {
    ctx.beginPath();
    ctx.moveTo(x + c * scale, y);
    ctx.lineTo(x + c * scale, y + size);
    ctx.moveTo(x, y + c * scale);
    ctx.lineTo(x + size, y + c * scale);
    ctx.stroke();
  }
  // Boats ride as pale dots on the blue.
  for (const boat of G.boats) {
    if (boat.wrecked) continue;
    ctx.fillStyle = boat.missionBoat ? '#f2c14e' : '#eafcff';
    ctx.beginPath();
    ctx.arc(mx(boat.x), my(boat.y), boat.type === 'yacht' ? 3 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips flash blue and red, the way their light bars do.
  const phase = Math.floor(G.time * 4) % 2;
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.wrecked) continue;
    ctx.fillStyle = phase === 0 ? '#4f7dff' : '#ff4747';
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const ped of G.peds) {
    if (ped.role !== 'cop' || ped.dead) continue;
    ctx.fillStyle = '#4f7dff';
    ctx.beginPath();
    ctx.arc(x + ped.x * scale, y + ped.y * scale, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  const marker = G.director.marker();
  if (marker !== null) {
    const pulse = 3.6 + Math.sin(G.time * 5) * 1.1;
    ctx.fillStyle = marker.color ?? '#f2c14e';
    ctx.beginPath();
    ctx.arc(mx(marker.x), my(marker.y), pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,193,78,0.6)';
    ctx.stroke();
  }
  // The player: a white wedge pointing the way he faces, drives or sails.
  const p = G.player;
  const angle = p.car !== null ? p.car.angle : p.boat !== null ? p.boat.angle : p.angle;
  ctx.save();
  ctx.translate(mx(p.x), my(p.y));
  ctx.rotate(angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6.5, 0);
  ctx.lineTo(-4.5, -4);
  ctx.lineTo(-4.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 10);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('N', x + size / 2, y + 13);
}

/** The in-play HUD. `prompt` is the context hint ("E — Enter car") or null. */
export function drawHud(ctx, G, w, h, prompt) {
  const p = G.player;
  // Cash and health, top left.
  panel(ctx, 16, 16, 218, 64);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8be89a';
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText(`$${Math.floor(G.cash).toLocaleString('en-US')}`, 30, 46);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `11px ${FONT}`;
  ctx.fillText(G.director.missionTitle().toUpperCase(), 30, 66);
  // The clock, top right of the cash panel: Port Azura runs on a fast sun.
  const hh = Math.floor(G.dayHour);
  const mm = Math.floor((G.dayHour - hh) * 60);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${G.nightAmount > 0.5 ? '☾' : '☀'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 220, 46);
  ctx.textAlign = 'left';
  // Health bar under the cash panel.
  ctx.fillStyle = 'rgba(14,20,28,0.72)';
  ctx.beginPath();
  ctx.roundRect(16, 88, 218, 14, 7);
  ctx.fill();
  ctx.fillStyle = p.hp > 30 ? '#63c74d' : '#e0483e';
  ctx.beginPath();
  ctx.roundRect(18, 90, 214 * clamp(p.hp / p.maxHp, 0, 1), 10, 5);
  ctx.fill();

  // Wanted stars and weapon, top right.
  const stars = G.wanted.stars;
  panel(ctx, w - 216, 16, 200, 64);
  for (let i = 0; i < 5; i += 1) star(ctx, w - 192 + i * 38, 40, 13, i < stars);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'right';
  const vehicle = p.car !== null ? p.car : p.boat;
  if (vehicle !== null) {
    const speed = Math.round(Math.abs(vehicle.vx * Math.cos(vehicle.angle) + vehicle.vy * Math.sin(vehicle.angle)) * 0.36);
    ctx.fillText(`${vehicle.name} — ${speed} km/h`, w - 30, 68);
  } else if (p.reloadT > 0) {
    ctx.fillText(`${WEAPONS[p.weapon].name.toUpperCase()} — RELOADING…`, w - 30, 68);
  } else {
    ctx.fillText(`${WEAPONS[p.weapon].name.toUpperCase()} — ${p.mag} / ${p.reserve}${p.hasSmg ? ' · Q ⇄' : ''}`, w - 30, 68);
  }
  if (vehicle !== null) {
    ctx.fillStyle = 'rgba(14,20,28,0.72)';
    ctx.beginPath();
    ctx.roundRect(w - 216, 88, 200, 10, 5);
    ctx.fill();
    ctx.fillStyle = vehicle.hp > vehicle.maxHp * 0.35 ? '#7fb2e5' : '#e0483e';
    ctx.beginPath();
    ctx.roundRect(w - 214, 90, 196 * clamp(vehicle.hp / vehicle.maxHp, 0, 1), 6, 3);
    ctx.fill();
  }

  // Objective, top centre.
  const objective = G.director.objectiveText();
  ctx.font = `bold 15px ${FONT}`;
  const lines = wrapText(ctx, objective, Math.min(560, w - 520));
  const boxW = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 36;
  panel(ctx, (w - boxW) / 2, 16, boxW, 30 + lines.length * 19, 0.6);
  ctx.fillStyle = '#ffe9a8';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => ctx.fillText(line, w / 2, 40 + i * 19));
  if (G.director.timerLeft !== null && G.director.timerLeft !== undefined) {
    const t = Math.max(0, Math.ceil(G.director.timerLeft));
    ctx.fillStyle = t < 20 ? '#ff6b5e' : '#ffffff';
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, w / 2, 40 + lines.length * 19 + 8);
  } else if (G.director.raceClock() !== null) {
    ctx.fillStyle = '#5dff8a';
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(G.director.raceClock(), w / 2, 40 + lines.length * 19 + 8);
  }

  // Vera's phone, bottom left: the current call line, if any.
  const call = G.director.dialogue[0];
  if (call !== undefined) {
    const boxW = Math.min(430, w - 32);
    ctx.font = `15px ${FONT}`;
    const textLines = wrapText(ctx, call.text, boxW - 28);
    const boxH = 52 + textLines.length * 20;
    panel(ctx, 16, h - boxH - 16, boxW, boxH, 0.85);
    ctx.textAlign = 'left';
    ctx.fillStyle = call.who === 'VERA' ? '#f2b63d' : '#7fd4c1';
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText(call.who === 'VERA' ? '📱 VERA — FIXER' : '📱 JAX', 30, h - boxH + 12);
    ctx.fillStyle = '#f2f4f6';
    ctx.font = `15px ${FONT}`;
    textLines.forEach((line, i) => ctx.fillText(line, 30, h - boxH + 36 + i * 20));
    if (Math.floor(G.time * 2) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText('ENTER ▸', 16 + boxW - 14, h - 24);
    }
  }

  // Context prompt, bottom centre.
  if (prompt !== null) {
    ctx.font = `bold 15px ${FONT}`;
    const pw = ctx.measureText(prompt).width + 30;
    panel(ctx, (w - pw) / 2, h - 52, pw, 34, 0.8);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(prompt, w / 2, h - 30);
  }

  drawMinimap(ctx, G, w - 206, h - 206, 190);

  // Hurt vignette.
  if (p.hurtT > 0 || p.hp < 28) {
    const alpha = p.hurtT > 0 ? p.hurtT * 0.9 : 0.16 + Math.sin(G.time * 5) * 0.05;
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.36, w / 2, h / 2, Math.max(w, h) * 0.72);
    grad.addColorStop(0, 'rgba(190,20,10,0)');
    grad.addColorStop(1, `rgba(190,20,10,${clamp(alpha, 0, 0.5)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  if (G.audio.isMuted()) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('SOUND OFF (M)', w - 18, h - 216);
  }
}

/** The title screen over the living city. */
export function drawTitle(ctx, G, w, h, hasSave, notice) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(10,16,30,0.30)');
  grad.addColorStop(0.55, 'rgba(10,16,30,0.08)');
  grad.addColorStop(1, 'rgba(10,16,30,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = `italic bold ${Math.min(96, w / 11)}px ${FONT}`;
  ctx.fillText('NEON TIDE', w / 2, h * 0.30);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.min(26, w / 40)}px ${FONT}`;
  ctx.fillText('P O R T   A Z U R A', w / 2, h * 0.30 + 44);
  ctx.font = `16px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('An open-world crime story: steal cars, take boats, run jobs for Vera, outrun the Azura PD.', w / 2, h * 0.30 + 76);
  ctx.fillText('New: harbour runs, street races, the Kite SMG — and a city that lights up at night.', w / 2, h * 0.30 + 100);
  ctx.font = `bold 21px ${FONT}`;
  ctx.fillStyle = '#8be89a';
  ctx.fillText(hasSave ? 'ENTER — Continue      N — New Game' : 'ENTER — New Game', w / 2, h * 0.62);
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const controls = [
    'WASD / Arrows — move & drive      Mouse — aim, hold to shoot      E — enter / exit car or boat',
    'Shift — sprint      Space — handbrake      R — reload      Q — swap gun      P / Esc — pause      M — mute',
  ];
  controls.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.62 + 44 + i * 22));
  if (notice !== null) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(notice, w / 2, h * 0.62 + 96);
  }
}

/** The pause panel. */
export function drawPause(ctx, G, w, h, notice) {
  ctx.fillStyle = 'rgba(8,12,20,0.62)';
  ctx.fillRect(0, 0, w, h);
  panel(ctx, w / 2 - 210, h / 2 - 130, 420, 260, 0.92);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText('PAUSED', w / 2, h / 2 - 78);
  ctx.fillStyle = '#f2f4f6';
  ctx.font = `17px ${FONT}`;
  const lines = [
    `Cash $${Math.floor(G.cash).toLocaleString('en-US')} — ${G.director.missionTitle()}`,
    G.director.race.best !== null ? `Best race: ${G.director.race.best.toFixed(1)}s` : '',
    'P / Esc — Resume',
    'S — Save game',
    'Backspace — Restart the story',
    'M — Toggle sound',
  ];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 - 34 + i * 26));
  if (notice !== null) {
    ctx.fillStyle = '#8be89a';
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(notice, w / 2, h / 2 + 104);
  }
}

/** The hospital wake-up after a knock-out. */
export function drawDown(ctx, G, w, h, fee) {
  ctx.fillStyle = 'rgba(30,6,6,0.66)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6b5e';
  ctx.font = `bold ${Math.min(72, w / 13)}px ${FONT}`;
  ctx.fillText('KNOCKED OUT', w / 2, h * 0.42);
  ctx.fillStyle = '#f2f4f6';
  ctx.font = `18px ${FONT}`;
  ctx.fillText(`You wake up outside St. Coral Hospital. The bill: $${fee}.`, w / 2, h * 0.42 + 46);
  ctx.fillText('The police have lost interest. For now.', w / 2, h * 0.42 + 74);
}
