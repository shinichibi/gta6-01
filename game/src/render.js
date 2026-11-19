// Everything the eye sees of Port Azura: animated water and a foaming shoreline,
// avenues with their markings, pastel blocks whose south faces light up window by
// window after dark, neon signs, palms and lamps, cars, boats, people, bullets —
// and, over all of it, the light of the hour: a dusk-to-night sky tint with a real
// lighting pass (lamp pools, headlight beams, police strobes, muzzle light) laid
// over the dark. The camera follows G.camera; the HUD is hud.js's job.

import { PALETTE, ROADS, ROAD_HALF, WORLD } from './config.js';
import { TAU, hash3 } from './util.js';

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

  function shade(hex, amount) {
    const n = Number.parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
    return `rgb(${r},${g},${b})`;
  }

  /** An rgba() string from a '#rrggbb' colour and an alpha. */
  function rgba(hex, alpha) {
    const n = Number.parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 0xff},${n & 0xff},${alpha})`;
  }

  // ---------------------------------------------------------------- the ground

  function drawGround(G) {
    // Open water, deep at the edges of the view.
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    // Two layers of drifting wave ticks on the water outside the island.
    const layers = [
      { cell: 90, off: (G.time * 12) % 90, len: 36, alpha: 0.06 },
      { cell: 150, off: (-G.time * 7) % 150, len: 54, alpha: 0.05 },
    ];
    for (const layer of layers) {
      ctx.fillStyle = `rgba(255,255,255,${layer.alpha})`;
      const gx = Math.floor(view.x / layer.cell) * layer.cell;
      const gy = Math.floor(view.y / layer.cell) * layer.cell;
      for (let x = gx; x < view.x + view.w + layer.cell; x += layer.cell) {
        for (let y = gy; y < view.y + view.h + layer.cell; y += layer.cell) {
          if (x > -70 && x < WORLD.w + 40 && y > -70 && y < WORLD.h + 40) continue;
          ctx.fillRect(x + 22 + layer.off, y + 34, layer.len, 3);
        }
      }
    }
    // Moonlight on the water: sparse twinkles, steady per spot, after dark.
    if (G.nightAmount > 0.3) {
      ctx.fillStyle = `rgba(220,238,255,${0.35 * G.nightAmount})`;
      const cell = 130;
      const gx = Math.floor(view.x / cell) * cell;
      const gy = Math.floor(view.y / cell) * cell;
      for (let x = gx; x < view.x + view.w + cell; x += cell) {
        for (let y = gy; y < view.y + view.h + cell; y += cell) {
          if (x > -60 && x < WORLD.w + 30 && y > -60 && y < WORLD.h + 30) continue;
          if (hash3(x, y, Math.floor(G.time * 1.5)) < 0.72) continue;
          ctx.fillRect(x + 40, y + 52, 7, 2);
        }
      }
    }
    // The shallows, the wet sand line, the beach, and the city ground.
    ctx.fillStyle = PALETTE.waterShallow;
    ctx.fillRect(-74, -74, WORLD.w + 148, WORLD.h + 148);
    ctx.fillStyle = PALETTE.sandWet;
    ctx.fillRect(-46, -46, WORLD.w + 92, WORLD.h + 92);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(-38, -38, WORLD.w + 76, WORLD.h + 76);
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    // Foam worrying at the shoreline, crawling along the waterline.
    ctx.strokeStyle = `rgba(234,252,255,${0.34 + 0.14 * Math.sin(G.time * 1.7)})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 20]);
    ctx.lineDashOffset = -G.time * 26;
    ctx.strokeRect(-44, -44, WORLD.w + 88, WORLD.h + 88);
    ctx.strokeStyle = 'rgba(234,252,255,0.22)';
    ctx.lineDashOffset = G.time * 17;
    ctx.strokeRect(-34, -34, WORLD.w + 68, WORLD.h + 68);
    ctx.setLineDash([]);
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
        // The park pond, catching the sky.
        ctx.fillStyle = PALETTE.waterShallow;
        ctx.beginPath();
        ctx.ellipse(block.x + block.w * 0.28, block.y + block.h * 0.3, 34, 22, 0.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.ellipse(block.x + block.w * 0.28 - 8, block.y + block.h * 0.3 - 5, 14, 7, 0.4, 0, TAU);
        ctx.fill();
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

  /** The harbour piers: wooden decks reaching off the south shore into the water. */
  function drawPiers(G) {
    for (const pier of G.city.piers) {
      if (!inView(pier.x - 30, pier.y0 - 10, 60, pier.y1 - pier.y0 + 20)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(pier.x - 14, pier.y0 + 2, 36, pier.y1 - pier.y0);
      ctx.fillStyle = PALETTE.pierWood;
      ctx.fillRect(pier.x - 17, pier.y0 - 6, 34, pier.y1 - pier.y0 + 6);
      ctx.strokeStyle = PALETTE.pierDark;
      ctx.lineWidth = 2;
      for (let y = pier.y0 + 6; y < pier.y1; y += 13) {
        ctx.beginPath();
        ctx.moveTo(pier.x - 17, y);
        ctx.lineTo(pier.x + 17, y);
        ctx.stroke();
      }
      ctx.fillStyle = PALETTE.pierDark;
      for (const [px, py] of [[pier.x - 17, pier.y1 - 4], [pier.x + 17, pier.y1 - 4], [pier.x - 17, pier.y0 + 30], [pier.x + 17, pier.y0 + 30]]) {
        ctx.beginPath();
        ctx.arc(px, py, 3.4, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ---------------------------------------------------------------- buildings

  function drawBuildings(G) {
    const night = G.nightAmount;
    for (const b of G.city.buildings) {
      if (!inView(b.x, b.y, b.w, b.h + 30)) continue;
      const lift = Math.min(26, 5 + b.floors * 2.1);
      // Ground shadow, thrown south-east by the height of the place.
      ctx.fillStyle = 'rgba(30,25,18,0.25)';
      ctx.fillRect(b.x + lift, b.y + lift + 3, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      // The south face: a strip of wall below the roofline, with its windows.
      ctx.fillStyle = shade(b.wall, -38);
      ctx.fillRect(b.x - 2, b.y + b.h + 2, b.w + 4, lift);
      const cols = Math.max(2, Math.floor(b.w / 24));
      const rows = Math.max(1, Math.floor(lift / 9));
      const cellW = b.w / cols;
      const cellH = lift / (rows + 0.6);
      for (let cx = 0; cx < cols; cx += 1) {
        for (let ry = 0; ry < rows; ry += 1) {
          const wx = b.x + 3 + cx * cellW;
          const wy = b.y + b.h + 4 + ry * cellH;
          ctx.fillStyle = 'rgba(38,48,64,0.5)';
          ctx.fillRect(wx, wy, Math.min(11, cellW - 5), 5);
          if (night > 0.05 && hash3(b.winSeed, cx, ry) < 0.48) {
            ctx.fillStyle = `rgba(255,205,110,${0.92 * night})`;
            ctx.fillRect(wx, wy, Math.min(11, cellW - 5), 5);
          }
        }
      }
      // The roof itself.
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
      if (b.neon !== null) {
        // A neon sign along the roof's south edge: paint by day, a blaze by night.
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        if (night > 0.05) {
          ctx.save();
          ctx.shadowColor = b.neon.color;
          ctx.shadowBlur = 17 * night;
          ctx.fillStyle = b.neon.color;
          ctx.globalAlpha = 0.35 + 0.65 * night;
          ctx.fillText(b.neon.text, b.x + b.w / 2, b.y + b.h - 12);
          ctx.fillText(b.neon.text, b.x + b.w / 2, b.y + b.h - 12);
          ctx.restore();
        }
        ctx.fillStyle = rgba(b.neon.color, 0.85);
        ctx.fillText(b.neon.text, b.x + b.w / 2, b.y + b.h - 12);
      } else if (b.name !== null && b.w > 120) {
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
        const s = 0.8 + hash3(Math.round(prop.x), Math.round(prop.y), 7) * 0.45;
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(prop.x + 4, prop.y + 5, 11 * s, 7 * s, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#5da244';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 11 * s, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#79b657';
        ctx.beginPath();
        ctx.arc(prop.x - 2, prop.y - 2, 7 * s, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#8a6b42';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 2.6, 0, TAU);
        ctx.fill();
      } else if (prop.kind === 'lamp') {
        ctx.fillStyle = '#6d7278';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 2.4, 0, TAU);
        ctx.fill();
        if (G.nightAmount > 0.25) {
          ctx.fillStyle = `rgba(255,196,92,${0.20 * G.nightAmount})`;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, 17, 0, TAU);
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

  /** Gulls riding the sea breeze over the harbour and the east water. */
  function drawGulls(G) {
    const centres = [
      { x: 440, y: WORLD.h + 280, r: 120 },
      { x: WORLD.w + 300, y: 900, r: 150 },
      { x: -260, y: 1500, r: 110 },
    ];
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const c = centres[i % centres.length];
      const a = G.time * (0.14 + i * 0.017) + i * 2.1;
      const x = c.x + Math.cos(a) * c.r;
      const y = c.y + Math.sin(a) * c.r * 0.55;
      if (!inView(x - 14, y - 10, 28, 20)) continue;
      const flap = Math.sin(G.time * 6 + i * 1.7) * 4.5;
      ctx.beginPath();
      ctx.moveTo(x - 9, y - flap);
      ctx.quadraticCurveTo(x - 3, y + 2, x, y);
      ctx.quadraticCurveTo(x + 3, y + 2, x + 9, y - flap);
      ctx.stroke();
    }
  }

  /** The shadow of the airfield's plane, crossing the city far below it. */
  function drawPlaneShadow(G) {
    if (G.plane === null || !G.plane.active) return;
    const pl = G.plane;
    if (!inView(pl.x - 40, pl.y - 40, 200, 200)) return;
    ctx.save();
    ctx.translate(pl.x + 90, pl.y + 120);
    ctx.rotate(pl.angle);
    ctx.fillStyle = 'rgba(20,26,30,0.13)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(-8, -26, 15, 52);
    ctx.restore();
  }

  // ---------------------------------------------------------------- markers

  function drawMarker(G) {
    const marker = G.director.marker();
    if (marker === null) return;
    const color = marker.color ?? '#f2c14e';
    const pulse = 1 + Math.sin(G.time * 5) * 0.16;
    // A race checkpoint stands as a pillar of light you can see down the street.
    if (marker.color !== undefined && G.director.race.phase !== 'idle') {
      const grad = ctx.createLinearGradient(0, marker.y - 74, 0, marker.y);
      grad.addColorStop(0, rgba('#5dff8a', 0));
      grad.addColorStop(1, rgba('#5dff8a', 0.30));
      ctx.fillStyle = grad;
      ctx.fillRect(marker.x - 24, marker.y - 74, 48, 74);
    }
    ctx.strokeStyle = rgba(color === '#f2c14e' ? '#f2c14e' : color, 0.9);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 30 * pulse, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = rgba(color === '#f2c14e' ? '#f2c14e' : color, 0.16);
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 30 * pulse, 0, TAU);
    ctx.fill();
    const bob = Math.sin(G.time * 4) * 5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(marker.x, marker.y - 44 + bob);
    ctx.lineTo(marker.x - 10, marker.y - 62 + bob);
    ctx.lineTo(marker.x + 10, marker.y - 62 + bob);
    ctx.closePath();
    ctx.fill();
  }

  /** Vera's Kite SMG, waiting on the garage forecourt in a ring of gold. */
  function drawSmgPickup(G) {
    const D = G.director;
    if (!D.smgDropped || G.player.hasSmg) return;
    const at = G.city.places.garage;
    if (!inView(at.x - 40, at.y - 40, 80, 80)) return;
    const bob = Math.sin(G.time * 3.2) * 3;
    ctx.strokeStyle = 'rgba(242,193,78,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(at.x, at.y, 17 + Math.sin(G.time * 5) * 2.5, 0, TAU);
    ctx.stroke();
    ctx.save();
    ctx.translate(at.x, at.y - 4 + bob);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#20242c';
    roundRect(-13, -3.4, 26, 6.8, 3);
    ctx.fill();
    ctx.fillRect(11, -1.6, 8, 3.2);
    ctx.fillRect(-2, 3, 4.4, 8);
    ctx.fillRect(-11, 2.4, 6, 4);
    ctx.restore();
    ctx.fillStyle = '#f2c14e';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KITE SMG', at.x, at.y + 26 + bob);
  }

  // ---------------------------------------------------------------- vehicles

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
    if (car.type === 'pickup' && !car.wrecked) {
      // The Dune Pickup's open bed, with its spare wheel.
      ctx.fillStyle = shade(car.color, -46);
      ctx.fillRect(-L * 0.46, -W / 2 + 3, L * 0.3, W - 6);
      ctx.fillStyle = '#26292e';
      ctx.beginPath();
      ctx.arc(-L * 0.31, 0, 5.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#7a8894';
      ctx.beginPath();
      ctx.arc(-L * 0.31, 0, 2.2, 0, TAU);
      ctx.fill();
    }
    // Cabin: windscreens and roof.
    ctx.fillStyle = 'rgba(190,230,242,0.85)';
    ctx.fillRect(L * 0.08, -W / 2 + 3, 6, W - 6);
    ctx.fillRect(-L * 0.30, -W / 2 + 3, 5, W - 6);
    ctx.fillStyle = car.wrecked ? '#2c2e30' : shade(car.color, -28);
    roundRect(car.type === 'pickup' ? -L * 0.10 : -L * 0.24, -W / 2 + 3.5, L * 0.3, W - 7, 4);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(L / 2 - 2, -W / 2 + 2, 2.5, 4);
    ctx.fillRect(L / 2 - 2, W / 2 - 6, 2.5, 4);
    ctx.fillStyle = '#e0483e';
    ctx.fillRect(-L / 2, -W / 2 + 2, 2.5, 4);
    ctx.fillRect(-L / 2, W / 2 - 6, 2.5, 4);
    // The white blink of a bullet strike or a hard shunt.
    if (car.flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(car.flashT / 0.09) * 0.55})`;
      roundRect(-L / 2, -W / 2, L, W, 7);
      ctx.fill();
    }
    ctx.restore();
    // A mission car wears a gold ring so the eye finds it.
    if (car.missionCar && !car.wrecked) {
      ctx.strokeStyle = 'rgba(242,193,78,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(car.x, car.y, car.len * 0.62, 0, TAU);
      ctx.stroke();
    }
  }

  function drawBoat(boat, G) {
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    const L = boat.len;
    const W = boat.wid;
    ctx.fillStyle = 'rgba(10,40,50,0.28)';
    ctx.beginPath();
    ctx.ellipse(3, 5, L * 0.54, W * 0.72, 0, 0, TAU);
    ctx.fill();
    // The hull: a pointed bow fairing back to a square stern.
    const hull = () => {
      ctx.beginPath();
      ctx.moveTo(L / 2, 0);
      ctx.quadraticCurveTo(L * 0.26, -W / 2, -L / 2, -W / 2 + 2);
      ctx.lineTo(-L / 2, W / 2 - 2);
      ctx.quadraticCurveTo(L * 0.26, W / 2, L / 2, 0);
      ctx.closePath();
    };
    ctx.fillStyle = boat.wrecked ? '#4a4d4a' : boat.color;
    hull();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (boat.type === 'skiff') {
      ctx.fillStyle = shade(boat.wrecked ? '#4a4d4a' : boat.color, 26);
      ctx.beginPath();
      ctx.moveTo(L * 0.34, 0);
      ctx.quadraticCurveTo(L * 0.18, -W * 0.32, -L * 0.34, -W * 0.32);
      ctx.lineTo(-L * 0.34, W * 0.32);
      ctx.quadraticCurveTo(L * 0.18, W * 0.32, L * 0.34, 0);
      ctx.closePath();
      ctx.fill();
      // Bench seats and the outboard motor.
      ctx.fillStyle = '#8a6b42';
      ctx.fillRect(-L * 0.05, -W * 0.34, 4, W * 0.68);
      ctx.fillRect(-L * 0.3, -W * 0.34, 4, W * 0.68);
      ctx.fillStyle = '#26292e';
      ctx.fillRect(-L / 2 - 4, -4.4, 6, 8.8);
    } else {
      // The Sirena: a white superstructure with a dark window band and a flybridge.
      ctx.fillStyle = '#f7f3ea';
      roundRect(-L * 0.16, -W * 0.34, L * 0.42, W * 0.68, 5);
      ctx.fill();
      ctx.fillStyle = '#22303c';
      ctx.fillRect(-L * 0.08, -W * 0.34 + 2.4, L * 0.3, W * 0.68 - 4.8);
      ctx.fillStyle = '#efe9db';
      roundRect(L * 0.28, -W * 0.22, L * 0.14, W * 0.44, 4);
      ctx.fill();
      ctx.fillStyle = shade(boat.color, -20);
      ctx.fillRect(-L * 0.44, -W * 0.3, L * 0.2, W * 0.6);
    }
    if (boat.flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(boat.flashT / 0.09) * 0.5})`;
      hull();
      ctx.fill();
    }
    // Running lights after dark: red to port, green to starboard.
    if (G.nightAmount > 0.25 && !boat.wrecked) {
      ctx.fillStyle = '#ff5d5d';
      ctx.beginPath();
      ctx.arc(L * 0.3, -W / 2, 2.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5dff8a';
      ctx.beginPath();
      ctx.arc(L * 0.3, W / 2, 2.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (boat.missionBoat && !boat.wrecked) {
      ctx.strokeStyle = 'rgba(242,193,78,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(boat.x, boat.y, boat.len * 0.66, 0, TAU);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- people

  function drawPerson(x, y, shirt, skin, angle, walkCycle, isPlayer) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 4, 9, 6, 0, 0, TAU);
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
    ctx.arc(x, y, isPlayer ? 8.6 : 7.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 2.5, y + Math.sin(angle) * 2.5, 4.4, 0, TAU);
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
        ctx.arc(0, -14, 4.4, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
        continue;
      }
      drawPerson(ped.x, ped.y, ped.shirt, ped.skin, ped.angle, ped.walkCycle ?? 0, false);
      if (ped.flashT > 0) {
        ctx.fillStyle = `rgba(255,255,255,${(ped.flashT / 0.09) * 0.5})`;
        ctx.beginPath();
        ctx.arc(ped.x, ped.y, 8.4, 0, TAU);
        ctx.fill();
      }
      if (ped.role === 'cop') {
        ctx.fillStyle = '#1d3355';
        ctx.beginPath();
        ctx.arc(ped.x, ped.y, 4.6, 0, TAU);
        ctx.fill();
      }
      if (ped.role === 'client') {
        const bob = Math.sin(G.time * 4 + ped.x) * 3;
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath();
        ctx.arc(ped.x, ped.y - 26 + bob, 9, 0, TAU);
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
    // Aboard a boat Jax stands at the stern, gun free; ashore he is just himself.
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
      ctx.arc(p.x, p.y, 15, 0, TAU);
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
      ctx.globalAlpha = particle.kind === 'smoke' || particle.kind === 'foam' ? lifeT * 0.8 : lifeT;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.kind === 'smoke' || particle.kind === 'foam' ? particle.size * (1.6 - lifeT * 0.6) : particle.size * lifeT + 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Shockwave rings, still expanding as they fade.
    for (const r of G.fx.rings) {
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = (r.life / r.maxLife) * 0.8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- the light

  /** The sky's colour for the hour, as a top-to-bottom gradient pair (or null at noon). */
  function skyTint(hour) {
    if (hour >= 19.5 || hour < 5.5) return ['rgba(10,14,44,0.42)', 'rgba(18,26,60,0.30)'];
    if (hour >= 17.5) return ['rgba(64,36,96,0.15)', 'rgba(255,120,44,0.17)'];
    if (hour < 7.5) return ['rgba(36,36,78,0.14)', 'rgba(255,166,66,0.11)'];
    return null;
  }

  function drawTint(G, w, h) {
    const tint = skyTint(G.dayHour);
    if (tint === null) return;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, tint[0]);
    grad.addColorStop(1, tint[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  /** One pool of light, drawn additively in screen space. */
  function glow(sx, sy, r, hex, alpha) {
    if (alpha <= 0.01 || r <= 2) return;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, rgba(hex, alpha));
    grad.addColorStop(1, rgba(hex, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  }

  /**
   * The lighting pass: after the sky tint, the city's own lights go back on —
   * lamp pools, neon bloom, headlight beams, police strobes, muzzle light — and
   * the corners of the screen fall away into the night.
   */
  function drawLights(G, w, h) {
    const night = G.nightAmount;
    if (night <= 0.04) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const toScreenX = (x) => x - view.x;
    const toScreenY = (y) => y - view.y;
    for (const prop of G.city.props) {
      if (prop.kind !== 'lamp' || !inView(prop.x - 50, prop.y - 50, 100, 100)) continue;
      glow(toScreenX(prop.x), toScreenY(prop.y), 42, '#ffc45c', 0.12 * night);
    }
    for (const b of G.city.buildings) {
      if (b.neon === null || !inView(b.x, b.y, b.w, b.h)) continue;
      glow(toScreenX(b.x + b.w / 2), toScreenY(b.y + b.h), Math.max(60, b.w * 0.62), b.neon.color, 0.16 * night);
    }
    for (const car of G.cars) {
      if (car.wrecked || !inView(car.x - 60, car.y - 60, 120, 120)) continue;
      if (car.type === 'police') {
        const phase = Math.floor(G.time * 5 + car.sirenPhase) % 2;
        glow(toScreenX(car.x), toScreenY(car.y), 64, phase === 0 ? '#ff3c3c' : '#4f7dff', 0.20 * night);
      }
      if (car.driver !== 'parked') {
        const fx = car.x + Math.cos(car.angle) * (car.len * 0.5 + 26);
        const fy = car.y + Math.sin(car.angle) * (car.len * 0.5 + 26);
        glow(toScreenX(fx), toScreenY(fy), 96, '#fff0be', 0.16 * night);
      }
    }
    for (const boat of G.boats) {
      if (boat.wrecked || !inView(boat.x - 60, boat.y - 60, 120, 120)) continue;
      glow(toScreenX(boat.x), toScreenY(boat.y), 44, '#ffe9b0', 0.10 * night);
    }
    for (const l of G.fx.lights) {
      glow(toScreenX(l.x), toScreenY(l.y), l.r * (0.5 + 0.5 * (l.life / l.maxLife)) + 12, l.color, 0.5 * (l.life / l.maxLife));
    }
    const marker = G.director.marker();
    if (marker !== null && inView(marker.x - 80, marker.y - 80, 160, 160)) {
      glow(toScreenX(marker.x), toScreenY(marker.y), 76, marker.color ?? '#f2c14e', 0.15 * night);
    }
    ctx.restore();
    // A soft vignette pulls the corners down after dark.
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
    vg.addColorStop(0, 'rgba(4,6,18,0)');
    vg.addColorStop(1, `rgba(4,6,18,${0.26 * night})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  /** The airfield's plane itself, high and quiet, drawn over the dark. */
  function drawPlane(G) {
    if (G.plane === null || !G.plane.active) return;
    const pl = G.plane;
    const sx = pl.x - view.x;
    const sy = pl.y - view.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(pl.angle);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#8d979e';
    ctx.fillRect(-7, -30, 15, 60);
    ctx.fillRect(30, -14, 10, 28);
    ctx.fillStyle = '#f4f6f8';
    roundRect(-54, -7.5, 108, 15, 7.5);
    ctx.fill();
    ctx.fillStyle = '#22303c';
    for (let i = 0; i < 5; i += 1) ctx.fillRect(6 + i * 9, -2.4, 4.6, 4.8);
    // Its beacon blinks, as beacons do.
    if (Math.floor(G.time * 1.6) % 2 === 0) {
      ctx.fillStyle = '#ff4747';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
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
      drawGround(G);
      drawPlaneShadow(G);
      drawRoads();
      drawBlocks(G);
      drawPiers(G);
      drawBuildings(G);
      drawProps(G);
      drawGulls(G);
      drawMarker(G);
      drawSmgPickup(G);
      for (const boat of G.boats) if (inView(boat.x - 70, boat.y - 70, 140, 140)) drawBoat(boat, G);
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
      drawLights(G, w, h);
      drawPlane(G);
    },
  };
}
