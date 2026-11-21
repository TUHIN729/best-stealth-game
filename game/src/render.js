// The Velvet Hour — render: everything the player sees, drawn on one
// canvas. A moonlit museum floor, warm lamp pools against cold shadow,
// raycast vision cones that walls cut off, readable cover, and a HUD that
// always shows the suspicion meter, the loot and the goal. No images are
// loaded: every shape is drawn, so the game has nothing to fetch.
import { COLORS, TILE, VIEW_H, VIEW_W } from './config.js';
import { conePolygon, GUARD_RADIUS } from './guard.js';
import { SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_PAUSED, SCREEN_TITLE, SCREEN_WIN } from './game.js';

function fmtTime(seconds) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function drawFloor(ctx, state) {
  const { grid, lamps } = state.level;
  for (let ty = 0; ty < grid.length; ty += 1) {
    for (let tx = 0; tx < grid[ty].length; tx += 1) {
      const ch = grid[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (ch === '#') continue;
      ctx.fillStyle = ch === ',' ? COLORS.floorShadow : (tx + ty) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(x, y, TILE, TILE);
      // A faint marble vein on lit tiles, so the floor reads as stone.
      if (ch === '.') {
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.beginPath();
        ctx.moveTo(x + 6, y + TILE - 8);
        ctx.lineTo(x + TILE - 10, y + 8);
        ctx.stroke();
      }
    }
  }
  // Warm lamp pools: light the floor where it is safe to be seen standing
  // still, and leave the shadow bands cold and dark.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const lamp of lamps) {
    const g = ctx.createRadialGradient(lamp.x, lamp.y, 10, lamp.x, lamp.y, lamp.radius);
    g.addColorStop(0, 'rgba(255, 202, 106, 0.20)');
    g.addColorStop(1, 'rgba(255, 202, 106, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWallsAndCover(ctx, state) {
  const { grid } = state.level;
  for (let ty = 0; ty < grid.length; ty += 1) {
    for (let tx = 0; tx < grid[ty].length; tx += 1) {
      const ch = grid[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (ch === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = COLORS.wallTrim;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = 'rgba(138, 109, 47, 0.25)';
        ctx.fillRect(x, y + TILE - 4, TILE, 4);
      } else if (ch === 'C') {
        ctx.fillStyle = COLORS.crate;
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = COLORS.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3);
        ctx.lineTo(x + TILE - 3, y + TILE - 3);
        ctx.moveTo(x + TILE - 3, y + 3);
        ctx.lineTo(x + 3, y + TILE - 3);
        ctx.stroke();
      } else if (ch === 'D') {
        ctx.fillStyle = 'rgba(127, 179, 217, 0.28)';
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = COLORS.caseFrame;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + TILE - 10);
        ctx.lineTo(x + TILE - 14, y + 12);
        ctx.stroke();
      }
    }
  }
}

function drawLamps(ctx, state) {
  for (const lamp of state.level.lamps) {
    ctx.fillStyle = COLORS.lampGlow;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 202, 106, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawGoal(ctx, state, t) {
  const { relic, exit, loot } = state.level;
  // Loot gems.
  for (const gem of loot) {
    if (gem.taken) continue;
    const bob = Math.sin(t * 3 + gem.x) * 2;
    ctx.fillStyle = '#6fe3c1';
    ctx.beginPath();
    ctx.moveTo(gem.x, gem.y - 9 + bob);
    ctx.lineTo(gem.x + 7, gem.y + bob);
    ctx.lineTo(gem.x, gem.y + 9 + bob);
    ctx.lineTo(gem.x - 7, gem.y + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(gem.x - 2, gem.y - 3 + bob, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // The relic: a glowing idol on its pedestal.
  if (!relic.taken) {
    const pulse = 0.55 + Math.sin(t * 2.4) * 0.25;
    const glow = ctx.createRadialGradient(relic.x, relic.y, 4, relic.x, relic.y, 46);
    glow.addColorStop(0, `rgba(255, 217, 74, ${pulse})`);
    glow.addColorStop(1, 'rgba(255, 217, 74, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(relic.x, relic.y, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2c12';
    ctx.beginPath();
    ctx.arc(relic.x, relic.y + 8, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.relic;
    ctx.beginPath();
    ctx.moveTo(relic.x, relic.y - 14);
    ctx.lineTo(relic.x + 7, relic.y - 2);
    ctx.lineTo(relic.x, relic.y + 6);
    ctx.lineTo(relic.x - 7, relic.y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('RELIC', relic.x, relic.y - 22);
  }
  // The exit: a green doorway, locked grey until the relic is taken.
  const open = state.relicGot;
  ctx.fillStyle = open ? COLORS.exit : '#3d5a48';
  ctx.fillRect(exit.x - 16, exit.y - 18, 32, 36);
  ctx.strokeStyle = open ? '#a9f5c6' : '#7a8a80';
  ctx.lineWidth = 3;
  ctx.strokeRect(exit.x - 16, exit.y - 18, 32, 36);
  if (open) {
    const glow = ctx.createRadialGradient(exit.x, exit.y, 4, exit.x, exit.y, 44);
    glow.addColorStop(0, 'rgba(55, 214, 122, 0.5)');
    glow.addColorStop(1, 'rgba(55, 214, 122, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(exit.x, exit.y, 44, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = open ? '#062b16' : '#dfe8e0';
  ctx.font = 'bold 10px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT' : 'LOCKED', exit.x, exit.y - 24);
}

function coneColor(guard) {
  if (guard.state === 'alert' || guard.state === 'search') return COLORS.coneAlert;
  if (guard.state === 'suspicious') return COLORS.coneSuspicious;
  return COLORS.coneCalm;
}

function drawGuards(ctx, state) {
  for (const guard of state.guards) {
    const poly = conePolygon(guard, state.level);
    ctx.fillStyle = coneColor(guard);
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 220, 120, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (const guard of state.guards) {
    // Body: a night-watchman in dark red, clearly visible on the floor.
    ctx.fillStyle = COLORS.guardDark;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD_RADIUS + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick and a white helmet dot.
    ctx.strokeStyle = '#f5d7d0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * (GUARD_RADIUS + 7), guard.y + Math.sin(guard.angle) * (GUARD_RADIUS + 7));
    ctx.stroke();
    ctx.fillStyle = '#f2ead8';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // "?" while suspicious, "!" while alerted or searching.
    if (guard.state === 'suspicious') {
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold 22px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x, guard.y - 22);
    } else if (guard.state === 'alert' || guard.state === 'search') {
      ctx.fillStyle = '#ff5340';
      ctx.font = 'bold 24px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, guard.y - 22);
    }
  }
}

function drawPlayer(ctx, state, t) {
  const p = state.player;
  // Running is loud: show the noise ring so the cost is visible.
  if (p.moving && p.stance === 'run') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.noiseRadius * (0.85 + Math.sin(t * 6) * 0.08), 0, Math.PI * 2);
    ctx.stroke();
  }
  const bob = p.moving ? Math.sin(t * (p.stance === 'run' ? 14 : 9)) * 1.5 : 0;
  ctx.fillStyle = COLORS.playerDark;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, 13, 0, Math.PI * 2);
  ctx.fill();
  // Hood point in the direction of travel, and a pale mask.
  ctx.fillStyle = '#2a1a5e';
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18 + bob);
  ctx.lineTo(p.x + Math.cos(p.angle + 2.5) * 9, p.y + Math.sin(p.angle + 2.5) * 9 + bob);
  ctx.lineTo(p.x + Math.cos(p.angle - 2.5) * 9, p.y + Math.sin(p.angle - 2.5) * 9 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2ead8';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5 + bob, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawHud(ctx, state) {
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, 0, VIEW_W, 46);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 15px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(state.level.name.toUpperCase(), 14, 29);
  ctx.font = '13px Georgia, serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`LOOT ${state.lootGot}/${state.lootTotal}`, 330, 29);
  ctx.fillStyle = state.relicGot ? COLORS.relic : COLORS.textDim;
  ctx.fillText(state.relicGot ? 'RELIC ✓' : 'RELIC —', 430, 29);
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`SCORE ${state.score}`, 540, 29);
  ctx.fillText(`TIME ${fmtTime(state.time)}`, 660, 29);
  // Suspicion meter: the game's heartbeat, always on screen.
  const mx = 790;
  const mw = 210;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = 'bold 12px Georgia, serif';
  ctx.fillText('SUSPICION', mx, 18);
  ctx.fillStyle = '#10131f';
  ctx.fillRect(mx, 24, mw, 12);
  const ratio = Math.max(0, Math.min(1, state.suspicion / 100));
  ctx.fillStyle = ratio < 0.35 ? '#37d67a' : ratio < 0.75 ? '#ffb347' : '#ff5340';
  ctx.fillRect(mx, 24, mw * ratio, 12);
  ctx.strokeStyle = '#f2ead8';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, 24, mw, 12);
  // Suspicion threshold tick at 35 (a guard turns suspicious here).
  ctx.strokeStyle = '#f2ead8';
  ctx.beginPath();
  ctx.moveTo(mx + mw * 0.35, 24);
  ctx.lineTo(mx + mw * 0.35, 36);
  ctx.stroke();
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '13px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText(state.player.stance.toUpperCase(), VIEW_W - 14, 29);
  ctx.textAlign = 'left';
  // Transient message line under the bar.
  if (state.messageTimer > 0) {
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 15px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, VIEW_W / 2, 74);
    ctx.textAlign = 'left';
  }
  // Bottom control strip, so the game teaches itself.
  ctx.fillStyle = 'rgba(10, 12, 20, 0.7)';
  ctx.fillRect(0, VIEW_H - 30, VIEW_W, 30);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD / arrows move · Shift sneak · Ctrl run (loud!) · Click to move · P pause · R retry · M mute', VIEW_W / 2, VIEW_H - 11);
  ctx.textAlign = 'left';
}

function overlay(ctx, rgba) {
  ctx.fillStyle = rgba;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function panel(ctx, lines) {
  const w = 640;
  const h = 120 + lines.length * 30;
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  ctx.fillStyle = 'rgba(8, 10, 18, 0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.wallTrim;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  return { x, y, w, h };
}

function drawTitle(ctx, state) {
  overlay(ctx, 'rgba(6, 8, 16, 0.72)');
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.relic;
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('THE VELVET HOUR', VIEW_W / 2, 150);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('A cat burglar. A moonlit museum. One relic, three galleries,', VIEW_W / 2, 190);
  ctx.fillText('and guards who never stop watching.', VIEW_W / 2, 218);
  const box = panel(ctx, [
    'Steal the Moonstone Idol, then slip out through the green exit — unseen.',
    'Hide in the cold blue shadow. Lamp light is bright, and bright is seen.',
    'Sneak (Shift) to stay quiet. Run (Ctrl) to be fast — and heard.',
    'When a guard grows suspicious, break line of sight and let it calm down.',
  ]);
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px Georgia, serif';
  const lines = [
    'Steal the Moonstone Idol, then slip out through the green exit — unseen.',
    'Hide in the cold blue shadow. Lamp light is bright, and bright is seen.',
    'Sneak (Shift) to stay quiet. Run (Ctrl) to be fast — and heard.',
    'When a guard grows suspicious, break line of sight and let it calm down.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, box.y + 44 + i * 30));
  ctx.fillStyle = COLORS.relic;
  ctx.font = 'bold 24px Georgia, serif';
  ctx.fillText('Press ENTER to begin the heist', VIEW_W / 2, box.y + box.h + 44);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '14px Georgia, serif';
  ctx.fillText('3 galleries · click to move · M mute', VIEW_W / 2, box.y + box.h + 72);
  ctx.textAlign = 'left';
}

function drawPaused(ctx) {
  overlay(ctx, 'rgba(6, 8, 16, 0.7)');
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2 - 10);
  ctx.font = '18px Georgia, serif';
  ctx.fillText('Press P or Escape to keep sneaking', VIEW_W / 2, VIEW_H / 2 + 30);
  ctx.textAlign = 'left';
}

function drawClear(ctx, state) {
  overlay(ctx, 'rgba(6, 8, 16, 0.68)');
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.exit;
  ctx.font = 'bold 52px Georgia, serif';
  ctx.fillText('GALLERY CLEARED', VIEW_W / 2, 250);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px Georgia, serif';
  ctx.fillText(`${state.level.name} — out unseen, idol in hand.`, VIEW_W / 2, 300);
  ctx.fillText(`Time ${fmtTime(state.clearTime)} · Loot ${state.lootGot}/${state.lootTotal} · Score ${state.score}`, VIEW_W / 2, 340);
  ctx.fillStyle = COLORS.relic;
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText(state.levelIndex + 1 >= 3 ? 'Press ENTER for the final reckoning' : 'Press ENTER for the next gallery', VIEW_W / 2, 400);
  ctx.textAlign = 'left';
}

function drawCaught(ctx, state) {
  overlay(ctx, 'rgba(40, 6, 8, 0.72)');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5340';
  ctx.font = 'bold 60px Georgia, serif';
  ctx.fillText('CAUGHT!', VIEW_W / 2, 250);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px Georgia, serif';
  ctx.fillText(`Guard ${state.caughtBy + 1} caught you in ${state.level.name}.`, VIEW_W / 2, 300);
  ctx.fillText('The museum keeps its idol — this time.', VIEW_W / 2, 334);
  ctx.fillStyle = COLORS.relic;
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText('Press R to try this gallery again', VIEW_W / 2, 400);
  ctx.textAlign = 'left';
}

function drawWin(ctx, state) {
  overlay(ctx, 'rgba(6, 8, 16, 0.7)');
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.relic;
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText('THE RELIC IS YOURS', VIEW_W / 2, 240);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('Three galleries, one idol, and not a single guard the wiser.', VIEW_W / 2, 286);
  ctx.font = '20px Georgia, serif';
  ctx.fillText(`Final score ${state.score} · Loot ${state.lootGot} · Time ${fmtTime(state.time)}`, VIEW_W / 2, 340);
  ctx.fillText(`Peak suspicion ${Math.round(state.maxSuspicion)}% — ${state.maxSuspicion < 35 ? 'a ghost, never even suspected' : state.maxSuspicion < 100 ? 'suspected, but never caught' : 'spotted — and still slipped away'}`, VIEW_W / 2, 374);
  ctx.fillStyle = COLORS.relic;
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText('Press R to steal it all over again', VIEW_W / 2, 430);
  ctx.textAlign = 'left';
}

/** Draw the whole frame for the current screen. `t` is seconds of wall time. */
export function drawGame(ctx, state, t) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#0b0e18';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawFloor(ctx, state);
  drawLamps(ctx, state);
  drawWallsAndCover(ctx, state);
  drawGoal(ctx, state, t);
  drawGuards(ctx, state);
  drawPlayer(ctx, state, t);
  drawHud(ctx, state);
  // Red edge flash the moment you are spotted.
  if (state.flash > 0) {
    ctx.strokeStyle = `rgba(255, 60, 40, ${0.55 * state.flash})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, VIEW_W - 10, VIEW_H - 10);
  }
  if (state.screen === SCREEN_TITLE) drawTitle(ctx, state);
  else if (state.screen === SCREEN_PAUSED) drawPaused(ctx);
  else if (state.screen === SCREEN_CLEAR) drawClear(ctx, state);
  else if (state.screen === SCREEN_CAUGHT) drawCaught(ctx, state);
  else if (state.screen === SCREEN_WIN) drawWin(ctx, state);
}
