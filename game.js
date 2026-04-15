'use strict';
// ── CANVAS SETUP ──────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 420, H = 680;
canvas.width = W; canvas.height = H;

function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
}
window.addEventListener('resize', resize);
resize();

// ── CONSTANTS ─────────────────────────────────────────────
const GOAL = { x: 145, y: 48, w: 130, h: 38 };
const PR = 20, BR = 9, DR = 19, GKR = 22;
const MAX_DRAG = 160;

// ── STAGE DATA ────────────────────────────────────────────
const CHAPTERS = [
  {
    id: 1, name: '챕터 1: 무명 신인의 데뷔',
    stages: [
      {
        id: 0, title: '첫 슛',
        situation: '88분 · 0:0 · 마지막 공격 기회',
        goal: '골을 넣어라!',
        type: 'score',
        players: [{ id: 0, x: 210, y: 480, name: '나' }],
        defenders: [], gk: { x: 210, y: 110 },
        calcStars: (r) => r.scored ? (r.maxPower >= 120 ? 3 : 2) : 0,
      },
      {
        id: 1, title: '첫 어시스트',
        situation: '75분 · 0:0 · 측면 공격',
        goal: '동료에게 패스 후 골!',
        type: 'pass_then_score', minPasses: 1,
        players: [
          { id: 0, x: 120, y: 460, name: '나' },
          { id: 1, x: 300, y: 330, name: '윤성' },
        ],
        defenders: [{ id: 0, x: 210, y: 360, speed: 2.5 }],
        gk: { x: 210, y: 110 },
        calcStars: (r) => r.scored ? (r.passes >= 1 ? 3 : 1) : 0,
      },
      {
        id: 2, title: '세 번의 패스',
        situation: '82분 · 1:2 · 역전의 기회',
        goal: '3번 패스 후 골!',
        type: 'combo', minPasses: 2,
        players: [
          { id: 0, x: 100, y: 500, name: '나' },
          { id: 1, x: 290, y: 390, name: '윤성' },
          { id: 2, x: 210, y: 290, name: '박준' },
        ],
        defenders: [
          { id: 0, x: 180, y: 440, speed: 2.8 },
          { id: 1, x: 320, y: 340, speed: 2.5 },
        ],
        gk: { x: 210, y: 110 },
        calcStars: (r) => r.scored ? (r.passes >= 3 ? 3 : r.passes >= 2 ? 2 : 1) : 0,
      },
      {
        id: 3, title: '감아차기',
        situation: '90분 · 0:1 · 프리킥!',
        goal: '감아차기로 골!',
        type: 'curve', mustCurve: true,
        players: [{ id: 0, x: 155, y: 440, name: '나' }],
        defenders: [
          { id: 0, x: 195, y: 360, speed: 0, isWall: true },
          { id: 1, x: 220, y: 360, speed: 0, isWall: true },
          { id: 2, x: 245, y: 360, speed: 0, isWall: true },
        ],
        gk: { x: 270, y: 110 },
        calcStars: (r) => r.scored ? (r.curved ? 3 : 1) : 0,
      },
      {
        id: 4, title: '시간과의 싸움',
        situation: '94분 · 0:1 · 마지막 공격!',
        goal: '8초 안에 골!',
        type: 'timed', timeLimit: 8,
        players: [
          { id: 0, x: 210, y: 460, name: '나' },
          { id: 1, x: 330, y: 350, name: '윤성' },
        ],
        defenders: [
          { id: 0, x: 250, y: 370, speed: 3 },
          { id: 1, x: 165, y: 300, speed: 2.8 },
        ],
        gk: { x: 210, y: 110 },
        calcStars: (r) => r.scored ? (r.timeLeft >= 4 ? 3 : 2) : 0,
      },
    ],
  },
  {
    id: 2, name: '챕터 2: 주전 경쟁',
    stages: [
      {
        id: 5, title: '경쟁자',
        situation: '70분 · 0:0 · 돌파 찬스',
        goal: '수비수를 피해 골!',
        type: 'score',
        players: [{ id: 0, x: 210, y: 500, name: '나' }],
        defenders: [
          { id: 0, x: 165, y: 380, speed: 3.2 },
          { id: 1, x: 255, y: 380, speed: 3.2 },
        ],
        gk: { x: 210, y: 110 },
        calcStars: (r) => r.scored ? (r.actions <= 1 ? 3 : 2) : 0,
      },
      {
        id: 6, title: '역습',
        situation: '55분 · 0:1 · 카운터 어택!',
        goal: '2패스 이상 연결 후 득점!',
        type: 'combo', minPasses: 1,
        players: [
          { id: 0, x: 80, y: 520, name: '나' },
          { id: 1, x: 340, y: 380, name: '정민' },
          { id: 2, x: 200, y: 290, name: '윤성' },
        ],
        defenders: [
          { id: 0, x: 225, y: 440, speed: 3 },
          { id: 1, x: 285, y: 330, speed: 3 },
        ],
        gk: { x: 210, y: 110 },
        calcStars: (r) => r.scored ? (r.passes >= 3 ? 3 : r.passes >= 2 ? 2 : 1) : 0,
      },
      {
        id: 7, title: '패널티 킥',
        situation: '87분 · 1:1 · 페널티 킥!',
        goal: '골키퍼를 속여라!',
        type: 'penalty',
        players: [{ id: 0, x: 210, y: 360, name: '나' }],
        defenders: [], gk: { x: 210, y: 110, isAlert: true, speed: 5 },
        calcStars: (r) => r.scored ? (r.cornerShot ? 3 : 2) : 0,
      },
      {
        id: 8, title: '세트피스',
        situation: '89분 · 0:1 · 코너킥!',
        goal: '코너킥으로 동점골!',
        type: 'combo', minPasses: 1,
        players: [
          { id: 0, x: 390, y: 560, name: '나' },
          { id: 1, x: 210, y: 280, name: '윤성' },
          { id: 2, x: 285, y: 240, name: '박준' },
        ],
        defenders: [
          { id: 0, x: 180, y: 270, speed: 2.8 },
          { id: 1, x: 250, y: 255, speed: 2.8 },
        ],
        gk: { x: 210, y: 110 },
        calcStars: (r) => r.scored ? (r.passes >= 2 ? 3 : 2) : 0,
      },
      {
        id: 9, title: '클러치 모먼트',
        situation: '90+3분 · 1:2 · 최후의 역전!',
        goal: '3패스 이상 후 역전골!',
        type: 'combo', minPasses: 3, timeLimit: 15,
        players: [
          { id: 0, x: 210, y: 530, name: '나' },
          { id: 1, x: 340, y: 400, name: '윤성' },
          { id: 2, x: 95, y: 380, name: '정민' },
          { id: 3, x: 265, y: 280, name: '박준' },
        ],
        defenders: [
          { id: 0, x: 285, y: 450, speed: 3.2 },
          { id: 1, x: 140, y: 375, speed: 3 },
          { id: 2, x: 225, y: 300, speed: 3.5 },
        ],
        gk: { x: 210, y: 110 },
        calcStars: (r) => r.scored ? (r.passes >= 4 ? 3 : r.passes >= 3 ? 2 : 1) : 0,
      },
    ],
  },
];

// ── SAVE DATA ─────────────────────────────────────────────
function loadSave() {
  try { return JSON.parse(localStorage.getItem('clutchstar') || 'null'); } catch { return null; }
}
function writeSave() {
  localStorage.setItem('clutchstar', JSON.stringify({ stars: G.stars }));
}

// ── GLOBAL STATE ──────────────────────────────────────────
const saved = loadSave();
const G = {
  screen: 'title',   // title | select | tactic | play | result
  chapter: 0,
  stage: 0,
  tactic: 0,         // 0=침투 1=측면 2=원투
  stars: saved ? saved.stars : Array(10).fill(0),
  titleAnim: 0,
  play: null,
  result: null,
};

// ── INPUT ─────────────────────────────────────────────────
const inp = { x: 0, y: 0, down: false, dx: 0, dy: 0, released: false };

function getPos(e) {
  const r = canvas.getBoundingClientRect();
  const sx = W / r.width, sy = H / r.height;
  const src = e.touches ? e.touches[0] || e.changedTouches[0] : e;
  return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
}

canvas.addEventListener('mousedown', e => { const p = getPos(e); inp.down = true; inp.dx = inp.x = p.x; inp.dy = inp.y = p.y; handleDown(p); });
canvas.addEventListener('mousemove', e => { const p = getPos(e); inp.x = p.x; inp.y = p.y; });
canvas.addEventListener('mouseup',   e => { const p = getPos(e); inp.x = p.x; inp.y = p.y; inp.down = false; inp.released = true; handleUp(p); });
canvas.addEventListener('touchstart', e => { e.preventDefault(); const p = getPos(e); inp.down = true; inp.dx = inp.x = p.x; inp.dy = inp.y = p.y; handleDown(p); }, { passive: false });
canvas.addEventListener('touchmove',  e => { e.preventDefault(); const p = getPos(e); inp.x = p.x; inp.y = p.y; }, { passive: false });
canvas.addEventListener('touchend',   e => { e.preventDefault(); const p = getPos(e); inp.x = p.x; inp.y = p.y; inp.down = false; inp.released = true; handleUp(p); }, { passive: false });

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── TACTIC DEFINITIONS ────────────────────────────────────
const TACTICS = [
  { name: '침투 우선', icon: '▶▶', desc: '수비수 속도 -20%\n패스 범위 +10px' },
  { name: '측면 전개', icon: '↔',  desc: '슈팅 각도 보너스\n짧은 패스 정확도 ↑' },
  { name: '원투 패스', icon: '↩',  desc: '패스 후 빠른 연결\n패스 속도 +20%' },
];

// ── DRAW UTILITIES ────────────────────────────────────────
function circle(x, y, r, fill, stroke, lw) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}

function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

function btn(x, y, w, h, label, fill, textColor) {
  roundRect(x, y, w, h, 10, fill || '#1d4ed8', null);
  ctx.fillStyle = textColor || '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
}

function hitBtn(bx, by, bw, bh, px, py) {
  return px >= bx && px <= bx + bw && py >= by && py <= by + bh;
}

// ── DRAW FIELD ────────────────────────────────────────────
function drawField() {
  // stripes
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1a6b2f' : '#1d7433';
    ctx.fillRect(0, i * 68, W, 68);
  }
  // border
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
  ctx.strokeRect(20, 30, W - 40, H - 60);
  // centre line
  ctx.beginPath(); ctx.moveTo(20, H / 2); ctx.lineTo(W - 20, H / 2); ctx.stroke();
  // centre circle
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 48, 0, Math.PI * 2); ctx.stroke();
  // penalty box top
  ctx.strokeRect(W / 2 - 110, 30, 220, 95);
  ctx.strokeRect(W / 2 - 55, 30, 110, 50);
  // goal net
  ctx.fillStyle = 'rgba(240,220,60,0.15)';
  ctx.fillRect(GOAL.x, GOAL.y, GOAL.w, GOAL.h);
  ctx.strokeStyle = '#f5c518'; ctx.lineWidth = 3;
  ctx.strokeRect(GOAL.x, GOAL.y, GOAL.w, GOAL.h);
  // net grid
  ctx.strokeStyle = 'rgba(245,197,24,0.35)'; ctx.lineWidth = 1;
  for (let nx = GOAL.x; nx <= GOAL.x + GOAL.w; nx += 13) {
    ctx.beginPath(); ctx.moveTo(nx, GOAL.y); ctx.lineTo(nx, GOAL.y + GOAL.h); ctx.stroke();
  }
  for (let ny = GOAL.y; ny <= GOAL.y + GOAL.h; ny += 9) {
    ctx.beginPath(); ctx.moveTo(GOAL.x, ny); ctx.lineTo(GOAL.x + GOAL.w, ny); ctx.stroke();
  }
  // goal posts
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(GOAL.x - 4, GOAL.y - 2, 5, GOAL.h + 4);
  ctx.fillRect(GOAL.x + GOAL.w, GOAL.y - 2, 5, GOAL.h + 4);
}

// ── DRAW PLAYER ───────────────────────────────────────────
function drawPlayer(p, hasBall, isSelected, pulse) {
  // glow when selected
  if (isSelected) {
    const gAlpha = 0.3 + 0.2 * Math.sin(pulse * 0.12);
    circle(p.x, p.y, PR + 8, null, `rgba(255,255,100,${gAlpha})`, 3);
  }
  circle(p.x, p.y, PR, p.isTeam ? '#16a34a' : '#1d4ed8', '#fff', 2);
  if (hasBall) circle(p.x, p.y, PR + 4, null, '#facc15', 2.5);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(p.name.charAt(0), p.x, p.y);
  ctx.font = '10px sans-serif'; ctx.textBaseline = 'top';
  ctx.fillText(p.name, p.x, p.y + PR + 3);
}

function drawDefender(d) {
  const col = d.isWall ? '#991b1b' : '#dc2626';
  circle(d.x, d.y, DR, col, '#fff', 1.5);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(d.isWall ? '■' : '守', d.x, d.y);
}

function drawGK(gk) {
  circle(gk.x, gk.y, GKR, '#d97706', '#fff', 2);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('GK', gk.x, gk.y);
}

function drawBall(bx, by) {
  // shadow
  ctx.beginPath(); ctx.ellipse(bx + 2, by + 3, BR, BR * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  circle(bx, by, BR, '#fff', '#222', 1.5);
  // pentagon marks
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const r2 = BR * 0.55;
    ctx.beginPath();
    ctx.arc(bx + Math.cos(a) * r2, by + Math.sin(a) * r2, 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── DRAW TRAJECTORY PREVIEW ───────────────────────────────
function drawTrajectoryPreview(px, py, tx, ty, curved, power) {
  const steps = 18;
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.3 * (power / MAX_DRAG)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let x, y;
    if (curved) {
      const cx = (px + tx) / 2 + (ty - py) * 0.4;
      const cy = (py + ty) / 2 - (tx - px) * 0.4;
      x = (1 - t) * (1 - t) * px + 2 * (1 - t) * t * cx + t * t * tx;
      y = (1 - t) * (1 - t) * py + 2 * (1 - t) * t * cy + t * t * ty;
    } else {
      x = px + (tx - px) * t;
      y = py + (ty - py) * t;
    }
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  // power bar
  const barW = 80, barH = 8;
  const bx = px - barW / 2, by2 = py + PR + 14;
  roundRect(bx, by2, barW, barH, 4, 'rgba(0,0,0,0.5)', null);
  const pct = clamp(power / MAX_DRAG, 0, 1);
  const barColor = pct > 0.7 ? '#ef4444' : pct > 0.4 ? '#f59e0b' : '#22c55e';
  roundRect(bx, by2, barW * pct, barH, 4, barColor, null);
}

// ── PARTICLES ─────────────────────────────────────────────
const particles = [];
function spawnGoalParticles(x, y) {
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 3 + Math.random() * 5;
    particles.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 1, decay: 0.025 + Math.random() * 0.02,
      color: ['#facc15','#f59e0b','#fff','#22c55e'][Math.floor(Math.random() * 4)],
      r: 3 + Math.random() * 4,
    });
  }
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    circle(p.x, p.y, p.r, p.color, null);
  });
  ctx.globalAlpha = 1;
}

// ── INIT PLAY STATE ───────────────────────────────────────
function initPlay(chIdx, stIdx) {
  const st = CHAPTERS[chIdx].stages[stIdx];
  const tacMod = G.tactic;

  // Deep-copy players & defenders
  const players = st.players.map(p => ({ ...p, isTeam: p.id !== 0 }));
  const defenders = st.defenders.map(d => ({
    ...d,
    speed: d.isWall ? 0 : d.speed * (tacMod === 0 ? 0.8 : 1),
    ox: d.x, oy: d.y, // original position for reset
  }));
  const gk = { ...st.gk, ox: st.gk.x };

  const ballHolderId = 0;

  G.play = {
    st, players, defenders, gk,
    ball: { x: players[0].x, y: players[0].y, anim: null },
    ballHolder: 0,      // index into players
    phase: 'idle',      // idle | aiming | flying | goal | fail | reset
    aiming: { curved: false },
    passes: 0,
    actions: 0,
    maxPower: 0,
    curved: false,
    cornerShot: false,
    timeLeft: st.timeLimit || 0,
    flashTimer: 0,
    flashColor: '',
    goalTimer: 0,
    failCount: 0,
    pulse: 0,
  };
}

// ── BALL ANIMATION (bezier) ────────────────────────────────
function startBallAnim(play, sx, sy, tx, ty, curved, onDone) {
  const cx = curved ? (sx + tx) / 2 + (ty - sy) * 0.4 : (sx + tx) / 2;
  const cy = curved ? (sy + ty) / 2 - (tx - sx) * 0.4 : (sy + ty) / 2;
  play.ball.anim = { sx, sy, cx, cy, tx, ty, t: 0, onDone };
}

function updateBallAnim(play, dt) {
  const a = play.ball.anim;
  if (!a) return;
  a.t += dt * 0.04; // speed of travel
  if (a.t >= 1) { a.t = 1; }
  const t = a.t, u = 1 - t;
  play.ball.x = u * u * a.sx + 2 * u * t * a.cx + t * t * a.tx;
  play.ball.y = u * u * a.sy + 2 * u * t * a.cy + t * t * a.ty;
  if (a.t >= 1) { play.ball.anim = null; a.onDone(); }
}

// ── DEFENDER AI ───────────────────────────────────────────
function updateDefenders(play, dt) {
  play.defenders.forEach(d => {
    if (d.isWall || d.speed === 0) return;
    const tx = play.ball.x, ty = play.ball.y;
    const dx = tx - d.x, dy = ty - d.y;
    const len = Math.hypot(dx, dy) || 1;
    d.x += (dx / len) * d.speed * dt * 0.06;
    d.y += (dy / len) * d.speed * dt * 0.06;
  });
  // GK horizontal tracking
  const gk = play.gk;
  const gkSpeed = (gk.speed || 3.5) * dt * 0.06;
  if (play.phase === 'flying' && play.ball.anim) {
    // track ball x but stay near goal y
    const diff = play.ball.x - gk.x;
    gk.x += Math.sign(diff) * Math.min(Math.abs(diff), gkSpeed);
    gk.x = clamp(gk.x, GOAL.x + GKR, GOAL.x + GOAL.w - GKR);
  }
}

// ── COLLISION CHECKS ──────────────────────────────────────
function checkDefenderIntercept(play) {
  for (const d of play.defenders) {
    if (dist(d.x, d.y, play.ball.x, play.ball.y) < DR + BR + 2) return true;
  }
  return false;
}

function checkGKSave(play) {
  const gk = play.gk;
  return dist(gk.x, gk.y, play.ball.x, play.ball.y) < GKR + BR + 2;
}

function checkGoal(play) {
  const b = play.ball;
  return b.x >= GOAL.x && b.x <= GOAL.x + GOAL.w &&
         b.y >= GOAL.y && b.y <= GOAL.y + GOAL.h;
}

// ── SHOOT / PASS ──────────────────────────────────────────
function executeShot(play, fromX, fromY, toDirX, toDirY, power, curved) {
  const len = Math.hypot(toDirX, toDirY) || 1;
  const ndx = toDirX / len, ndy = toDirY / len;
  const PASS_THRESHOLD = 80;
  const snapR = G.tactic === 0 ? 50 : 40;

  // Check if any teammate is close to the path (for pass)
  let snapTarget = null;
  if (power < MAX_DRAG * 0.9) {
    for (const pl of play.players) {
      if (pl === play.players[play.ballHolder]) continue;
      // project teammate onto ray
      const pdx = pl.x - fromX, pdy = pl.y - fromY;
      const proj = pdx * ndx + pdy * ndy;
      if (proj < 0) continue;
      const perpDist = Math.abs(pdx * ndy - pdy * ndx);
      if (perpDist < snapR && proj < power * 2.5) {
        if (!snapTarget || proj < (snapTarget._proj || Infinity)) {
          snapTarget = pl; snapTarget._proj = proj;
        }
      }
    }
  }

  play.actions++;
  play.aiming.curved = curved;
  if (curved) play.curved = true;

  if (snapTarget) {
    // Pass
    play.phase = 'flying';
    const passSpeedMul = G.tactic === 2 ? 1.2 : 1;
    startBallAnim(play, fromX, fromY, snapTarget.x, snapTarget.y, curved, () => {
      play.ballHolder = play.players.indexOf(snapTarget);
      play.passes++;
      play.ball.x = snapTarget.x; play.ball.y = snapTarget.y;
      play.phase = 'idle';
    });
  } else {
    // Shot toward goal
    const shotDist = 300 + power;
    const tx = fromX + ndx * shotDist;
    const ty = fromY + ndy * shotDist;
    play.phase = 'flying';
    play.maxPower = Math.max(play.maxPower, power);
    // Corner shot check (for penalty star)
    if (tx < GOAL.x + 30 || tx > GOAL.x + GOAL.w - 30) play.cornerShot = true;

    startBallAnim(play, fromX, fromY, tx, ty, curved, () => {
      if (checkGoal(play)) {
        spawnGoalParticles(play.ball.x, play.ball.y);
        play.phase = 'goal';
        play.goalTimer = 0;
      } else {
        triggerFail(play);
      }
    });
  }
}

function triggerFail(play) {
  play.failCount++;
  play.phase = 'fail';
  play.flashTimer = 0;
  play.flashColor = '#ef4444';
}

function resetPlayState(play) {
  const st = play.st;
  play.players = st.players.map(p => ({ ...p, isTeam: p.id !== 0 }));
  play.defenders = st.defenders.map(d => ({
    ...d,
    speed: d.isWall ? 0 : d.speed * (G.tactic === 0 ? 0.8 : 1),
    ox: d.x, oy: d.y,
  }));
  play.gk = { ...st.gk, ox: st.gk.x };
  play.ball = { x: play.players[0].x, y: play.players[0].y, anim: null };
  play.ballHolder = 0;
  play.phase = 'idle';
  play.passes = 0; play.actions = 0; play.maxPower = 0;
  play.curved = false; play.cornerShot = false;
  play.timeLeft = st.timeLimit || 0;
  play.flashTimer = 0;
}

// ── HANDLE INPUT ──────────────────────────────────────────
function handleDown(p) {
  if (G.screen === 'title') { G.screen = 'select'; return; }
  if (G.screen === 'select') { handleSelectDown(p); return; }
  if (G.screen === 'tactic') { handleTacticDown(p); return; }
  if (G.screen === 'result') { handleResultDown(p); return; }
  if (G.screen === 'play')   { handlePlayDown(p); return; }
}

function handleUp(p) {
  if (G.screen === 'play' && G.play && G.play.phase === 'aiming') {
    handlePlayUp(p);
  }
}

// ── PLAY INPUT ────────────────────────────────────────────
function handlePlayDown(p) {
  const play = G.play;
  if (play.phase !== 'idle') return;
  const holder = play.players[play.ballHolder];
  if (dist(p.x, p.y, holder.x, holder.y) < PR + 14) {
    play.phase = 'aiming';
    play.aiming = { sx: holder.x, sy: holder.y, curved: false };
    inp.dx = p.x; inp.dy = p.y;
  }
  // Curve toggle button (bottom-right corner)
  if (hitBtn(W - 80, H - 55, 70, 38, p.x, p.y)) {
    // toggled on mousedown separately
  }
}

function handlePlayUp(p) {
  const play = G.play;
  const holder = play.players[play.ballHolder];
  const dx = p.x - holder.x, dy = p.y - holder.y;
  const power = clamp(Math.hypot(dx, dy), 0, MAX_DRAG);
  if (power < 12) { play.phase = 'idle'; return; }
  const curved = play.aiming.curved;
  executeShot(play, holder.x, holder.y, dx, dy, power, curved);
}

// ── SELECT SCREEN ─────────────────────────────────────────
function handleSelectDown(p) {
  // Back button
  if (hitBtn(10, 10, 70, 34, p.x, p.y)) { G.screen = 'title'; return; }
  // Stage circles
  CHAPTERS.forEach((ch, ci) => {
    const chY = 100 + ci * 240;
    ch.stages.forEach((st, si) => {
      const globalIdx = ci * 5 + si;
      const sx = 50 + si * 72, sy = chY + 60;
      if (dist(p.x, p.y, sx, sy) < 30) {
        const unlocked = globalIdx === 0 || G.stars[globalIdx - 1] > 0 || G.stars[globalIdx] > 0;
        if (unlocked) {
          G.chapter = ci; G.stage = si; G.tactic = 0;
          G.screen = 'tactic';
        }
      }
    });
  });
}

// ── TACTIC SCREEN ─────────────────────────────────────────
function handleTacticDown(p) {
  // Back
  if (hitBtn(10, 10, 70, 34, p.x, p.y)) { G.screen = 'select'; return; }
  // Tactic cards
  TACTICS.forEach((t, i) => {
    const tx = 20 + i * 128, ty = 300;
    if (hitBtn(tx, ty, 115, 160, p.x, p.y)) G.tactic = i;
  });
  // Play button
  if (hitBtn(W / 2 - 80, 490, 160, 46, p.x, p.y)) {
    initPlay(G.chapter, G.stage);
    G.screen = 'play';
  }
}

// ── RESULT SCREEN ─────────────────────────────────────────
function handleResultDown(p) {
  // Retry
  if (hitBtn(W / 2 - 165, H - 90, 150, 46, p.x, p.y)) {
    initPlay(G.chapter, G.stage);
    G.screen = 'play';
  }
  // Next
  if (hitBtn(W / 2 + 15, H - 90, 150, 46, p.x, p.y)) {
    const nextSi = G.stage + 1;
    if (nextSi < CHAPTERS[G.chapter].stages.length) {
      G.stage = nextSi; G.tactic = 0; G.screen = 'tactic';
    } else if (G.chapter + 1 < CHAPTERS.length) {
      G.chapter++; G.stage = 0; G.tactic = 0; G.screen = 'tactic';
    } else {
      G.screen = 'select';
    }
  }
  // Stage select
  if (hitBtn(W / 2 - 55, H - 145, 110, 38, p.x, p.y)) {
    G.screen = 'select';
  }
}

// ── CURVE BUTTON ──────────────────────────────────────────
function handleCurveToggle() {
  if (G.screen === 'play' && G.play) {
    if (G.play.phase === 'idle' || G.play.phase === 'aiming') {
      G.play.aiming.curved = !G.play.aiming.curved;
    }
  }
}
canvas.addEventListener('mousedown', e => {
  const p = getPos(e);
  if (G.screen === 'play' && G.play && hitBtn(W - 80, H - 55, 70, 38, p.x, p.y)) {
    handleCurveToggle();
  }
}, true);

// ── SCREEN RENDERERS ──────────────────────────────────────
function drawTitle(t) {
  // Background
  ctx.fillStyle = '#0a0f1e';
  ctx.fillRect(0, 0, W, H);
  // Stars bg
  for (let i = 0; i < 60; i++) {
    const sx = (Math.sin(i * 137.5) * 0.5 + 0.5) * W;
    const sy = (Math.cos(i * 97.3) * 0.5 + 0.5) * H;
    const ss = 1 + Math.sin(t * 0.05 + i) * 0.5;
    circle(sx, sy, ss, 'rgba(255,255,255,0.5)', null);
  }
  // Logo
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚽ CLUTCH STAR', W / 2, 200);
  ctx.font = 'bold 38px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('클러치 스타', W / 2, 245);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#f5c518';
  ctx.fillText('풋볼 스토리', W / 2, 278);
  // Bouncing ball
  const ballY = 340 + Math.sin(t * 0.08) * 18;
  drawBall(W / 2, ballY);
  // Start button
  const pulse = 0.8 + 0.2 * Math.sin(t * 0.07);
  ctx.globalAlpha = pulse;
  btn(W / 2 - 90, 420, 180, 50, '탭하여 시작 ▶', '#1d4ed8');
  ctx.globalAlpha = 1;
  ctx.font = '12px sans-serif'; ctx.fillStyle = '#64748b';
  ctx.fillText('드래그로 패스/슛 · 결정적 순간을 플레이하라', W / 2, 498);
}

function drawSelect() {
  ctx.fillStyle = '#0a0f1e'; ctx.fillRect(0, 0, W, H);
  btn(10, 10, 70, 34, '← 뒤로', '#334155');
  ctx.fillStyle = '#f5c518'; ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('스테이지 선택', W / 2, 62);

  CHAPTERS.forEach((ch, ci) => {
    const chY = 90 + ci * 255;
    ctx.fillStyle = '#1e293b';
    roundRect(10, chY, W - 20, 230, 12, '#1e293b', '#334155');
    ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ch.name, 22, chY + 22);

    ch.stages.forEach((st, si) => {
      const globalIdx = ci * 5 + si;
      const unlocked = globalIdx === 0 || G.stars[globalIdx - 1] > 0 || G.stars[globalIdx] > 0;
      const sx = 50 + si * 72, sy = chY + 80;
      const starsEarned = G.stars[globalIdx];
      // Circle
      const fill = !unlocked ? '#334155' : starsEarned === 3 ? '#f5c518' : '#1d4ed8';
      circle(sx, sy, 28, fill, unlocked ? '#fff' : '#475569', 2);
      ctx.fillStyle = unlocked ? '#fff' : '#64748b';
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(unlocked ? (globalIdx + 1) : '🔒', sx, sy);
      ctx.textBaseline = 'top';
      // Stars
      ctx.font = '10px sans-serif';
      const starStr = '★'.repeat(starsEarned) + '☆'.repeat(3 - starsEarned);
      ctx.fillStyle = '#f5c518';
      ctx.fillText(starStr, sx, sy + 32);
      // Title
      ctx.fillStyle = unlocked ? '#cbd5e1' : '#475569';
      ctx.font = '9px sans-serif';
      const words = st.title.split(' ');
      words.forEach((w, wi) => ctx.fillText(w, sx, sy + 46 + wi * 12));
    });
  });
  ctx.textBaseline = 'alphabetic';
}

function drawTactic() {
  ctx.fillStyle = '#0a0f1e'; ctx.fillRect(0, 0, W, H);
  btn(10, 10, 70, 34, '← 뒤로', '#334155');

  const st = CHAPTERS[G.chapter].stages[G.stage];
  ctx.fillStyle = '#f5c518'; ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(st.title, W / 2, 70);
  ctx.fillStyle = '#94a3b8'; ctx.font = '13px sans-serif';
  ctx.fillText(st.situation, W / 2, 95);

  // Goal card
  roundRect(20, 110, W - 40, 48, 10, '#1e3a5f', '#3b82f6');
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif';
  ctx.fillText('목표: ' + st.goal, W / 2, 134);
  // Star hint
  const globalIdx = G.chapter * 5 + G.stage;
  ctx.fillStyle = '#64748b'; ctx.font = '11px sans-serif';
  ctx.fillText('현재 기록: ' + '★'.repeat(G.stars[globalIdx]) + '☆'.repeat(3 - G.stars[globalIdx]), W / 2, 150);

  ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 13px sans-serif';
  ctx.fillText('전술 선택', W / 2, 192);

  TACTICS.forEach((tac, i) => {
    const tx = 20 + i * 130, ty = 205;
    const selected = G.tactic === i;
    roundRect(tx, ty, 118, 160, 12, selected ? '#1d4ed8' : '#1e293b', selected ? '#60a5fa' : '#334155');
    ctx.fillStyle = selected ? '#fff' : '#94a3b8';
    ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(tac.icon, tx + 59, ty + 38);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(tac.name, tx + 59, ty + 62);
    ctx.font = '10px sans-serif'; ctx.fillStyle = selected ? '#bfdbfe' : '#64748b';
    const lines = tac.desc.split('\n');
    lines.forEach((l, li) => ctx.fillText(l, tx + 59, ty + 82 + li * 16));
    if (selected) {
      ctx.fillStyle = '#22c55e'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText('✓ 선택됨', tx + 59, ty + 140);
    }
  });

  btn(W / 2 - 80, 490, 160, 46, '플레이 ▶', '#16a34a');
}

function drawPlay(dt) {
  const play = G.play;
  if (!play) return;
  play.pulse++;

  drawField();

  // Timed: update time
  if (play.st.timeLimit && play.phase === 'idle') {
    play.timeLeft -= dt / 1000;
    if (play.timeLeft <= 0) { play.timeLeft = 0; triggerFail(play); }
  }

  // Update ball animation & physics
  if (play.phase === 'flying') {
    updateBallAnim(play, dt);
    updateDefenders(play, dt);
    // Mid-flight interception checks
    if (checkDefenderIntercept(play)) {
      play.ball.anim = null; triggerFail(play);
    } else if (checkGKSave(play) && play.phase === 'flying') {
      play.ball.anim = null; triggerFail(play);
    }
  } else {
    updateDefenders(play, dt);
  }

  // Goal phase: wait then show result
  if (play.phase === 'goal') {
    play.goalTimer += dt;
    updateParticles();
    drawParticles();
    if (play.goalTimer > 1600) {
      const r = {
        scored: true, passes: play.passes, actions: play.actions,
        maxPower: play.maxPower, curved: play.curved,
        cornerShot: play.cornerShot, timeLeft: play.timeLeft,
      };
      const stars = play.st.calcStars(r);
      const globalIdx = G.chapter * 5 + G.stage;
      if (stars > G.stars[globalIdx]) { G.stars[globalIdx] = stars; writeSave(); }
      G.result = { stars, scored: true, passes: play.passes, timeLeft: play.timeLeft };
      G.screen = 'result'; return;
    }
  }

  // Fail phase: flash then retry or show result
  if (play.phase === 'fail') {
    play.flashTimer += dt;
    ctx.fillStyle = `rgba(239,68,68,${0.35 * Math.max(0, 1 - play.flashTimer / 800)})`;
    ctx.fillRect(0, 0, W, H);
    if (play.flashTimer > 900) {
      if (play.failCount >= 3) {
        const globalIdx = G.chapter * 5 + G.stage;
        G.result = { stars: 0, scored: false, passes: play.passes, timeLeft: play.timeLeft };
        G.screen = 'result'; return;
      }
      resetPlayState(play);
    }
  }

  // Draw actors
  play.defenders.forEach(d => drawDefender(d));
  drawGK(play.gk);
  play.players.forEach((p, i) => drawPlayer(p, i === play.ballHolder, i === play.ballHolder, play.pulse));
  drawBall(play.ball.x, play.ball.y);
  drawParticles();

  // Aim preview
  if (play.phase === 'aiming') {
    const holder = play.players[play.ballHolder];
    const dx = inp.x - holder.x, dy = inp.y - holder.y;
    const power = clamp(Math.hypot(dx, dy), 0, MAX_DRAG);
    if (power > 8) drawTrajectoryPreview(holder.x, holder.y, inp.x, inp.y, play.aiming.curved, power);
  }

  // HUD
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(10, 8, W - 20, 36, 8, 'rgba(0,0,0,0.55)', null);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`${play.st.title}  패스: ${play.passes}`, 20, 30);
  if (play.st.timeLimit) {
    const tc = Math.ceil(Math.max(0, play.timeLeft));
    ctx.fillStyle = tc <= 3 ? '#ef4444' : '#f5c518';
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`⏱ ${tc}s`, W - 20, 30);
  }
  ctx.textAlign = 'right'; ctx.font = '11px sans-serif'; ctx.fillStyle = '#94a3b8';
  ctx.fillText(`실패: ${play.failCount}/3`, W - 20, play.st.timeLimit ? 46 : 30);

  // Goal text
  if (play.phase !== 'goal' && play.phase !== 'fail') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(10, H - 70, W - 20, 28, 6, 'rgba(0,0,0,0.5)', null);
    ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(play.st.goal, W / 2, H - 52);
  }

  // Curve toggle button
  const curveActive = play.aiming.curved;
  roundRect(W - 82, H - 57, 72, 38, 8,
    curveActive ? '#7c3aed' : '#334155',
    curveActive ? '#a78bfa' : '#475569');
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(curveActive ? '↩ ON' : '↩ 감아차기', W - 46, H - 38);
  ctx.textBaseline = 'alphabetic';

  // GOAL! overlay
  if (play.phase === 'goal') {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.5, play.goalTimer / 1000)})`;
    ctx.fillRect(0, 0, W, H);
    const scale = Math.min(1.2, 0.5 + play.goalTimer / 800);
    ctx.save(); ctx.translate(W / 2, H / 2 - 40); ctx.scale(scale, scale);
    ctx.fillStyle = '#facc15'; ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GOAL!', 0, 0);
    ctx.restore();
  }
}

function drawResult() {
  ctx.fillStyle = '#0a0f1e'; ctx.fillRect(0, 0, W, H);
  const r = G.result;
  // Header
  ctx.fillStyle = r.scored ? '#facc15' : '#ef4444';
  ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(r.scored ? '⚽ GOAL!' : '실패...', W / 2, 140);
  // Stars
  const starSize = 52;
  for (let i = 0; i < 3; i++) {
    const sx = W / 2 + (i - 1) * (starSize + 10);
    ctx.fillStyle = i < r.stars ? '#f5c518' : '#334155';
    ctx.font = `${starSize}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', sx, 230);
  }
  ctx.textBaseline = 'alphabetic';
  // Stats
  ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif';
  ctx.fillText(`패스 ${r.passes}회`, W / 2, 300);
  if (G.play && G.play.st.timeLimit) {
    ctx.fillText(`남은 시간 ${Math.ceil(Math.max(0, r.timeLeft))}초`, W / 2, 322);
  }
  // Stage select
  btn(W / 2 - 55, H - 148, 110, 38, '스테이지 선택', '#334155');
  // Retry / Next
  btn(W / 2 - 165, H - 92, 150, 46, '↺ 다시 도전', '#1d4ed8');
  const globalIdx = G.chapter * 5 + G.stage;
  const hasNext = globalIdx < 9;
  btn(W / 2 + 15, H - 92, 150, 46, hasNext ? '다음 ▶' : '완료!', r.scored ? '#16a34a' : '#475569');
}

// ── MAIN LOOP ─────────────────────────────────────────────
let lastT = 0;

function loop(ts) {
  const dt = Math.min(ts - lastT, 50);
  lastT = ts;
  G.titleAnim++;

  ctx.clearRect(0, 0, W, H);

  if (G.screen === 'title')  { drawTitle(G.titleAnim); }
  else if (G.screen === 'select') { drawSelect(); }
  else if (G.screen === 'tactic') { drawTactic(); }
  else if (G.screen === 'play')   { drawPlay(dt); }
  else if (G.screen === 'result') { drawResult(); }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
