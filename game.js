/* ============================================================
   DOOMVIVOR — 둠 × 뱀서 (raycaster + survivor roguelite)
   Single-file skeleton. Tweak CFG / UPGRADES / TYPES / MAP freely.
   ============================================================ */
'use strict';
(() => {

// ------------------------------------------------------------------
// CONFIG — 대부분의 밸런스는 여기서 조절
// ------------------------------------------------------------------
const CFG = {
  fov: 0.66,            // camera plane length (~66° 시야)
  renderScale: 0.5,     // 내부 렌더 해상도 배율 (낮을수록 레트로+빠름)
  colStep: 1,           // 벽 레이 컬럼 폭(px)
  moveSpeed: 3.1,       // tiles/sec
  sprintMul: 1.55,
  turnSpeed: 0.0023,    // 마우스 감도 (rad/px)
  playerRadius: 0.22,
  maxHp: 100,
  fireCooldown: 0.26,   // sec
  bulletDamage: 26,
  comboWindow: 3.2,     // 콤보 유지 시간(sec)
  comboDmgPer: 0.02,    // 콤보 1당 데미지 +2% (최대 20콤보 반영)
  xpBase: 6,
  xpGrowth: 1.30,
  maxViewDist: 18,      // 안개 거리
};

// ------------------------------------------------------------------
// MAP — '#' 다크 벽(1), '2' 레드 지옥벽(2), '.' 바닥, 'P' 플레이어 시작
// ------------------------------------------------------------------
const MAP_STR = [
  "########################",
  "#......................#",
  "#..####..........####..#",
  "#..#................#..#",
  "#..#..##......##....#..#",
  "#.....##......##.......#",
  "#......................#",
  "#..........P...........#",
  "#......................#",
  "#..##..............##..#",
  "#..##......22......##..#",
  "#..........22..........#",
  "#......................#",
  "#..##......22......##..#",
  "#..##..............##..#",
  "#......................#",
  "#.....##......##.......#",
  "#..#..##......##....#..#",
  "#..#................#..#",
  "#..####..........####..#",
  "#......................#",
  "########################",
];
let MAP_W = 0, MAP_H = 0, grid = [];
const spawn = { x: 11.5, y: 7.5 };
function parseMap(rows){
  MAP_H = rows.length; MAP_W = rows[0].length; grid = [];
  for (let y = 0; y < MAP_H; y++){
    const r = [];
    for (let x = 0; x < MAP_W; x++){
      const c = rows[y][x];
      if (c === '#') r.push(1);
      else if (c === '2') r.push(2);
      else { r.push(0); if (c === 'P'){ spawn.x = x + 0.5; spawn.y = y + 0.5; } }
    }
    grid.push(r);
  }
}
function isWall(x, y){
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
  return grid[y | 0][x | 0] > 0;
}
function collides(px, py, r){
  return isWall(px - r, py - r) || isWall(px + r, py - r) ||
         isWall(px - r, py + r) || isWall(px + r, py + r);
}
function lineOfSight(ax, ay, bx, by){
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  const steps = Math.ceil(d / 0.2);
  for (let i = 1; i < steps; i++){
    const t = i / steps;
    if (isWall(ax + dx * t, ay + dy * t)) return false;
  }
  return true;
}

// ------------------------------------------------------------------
// ENEMY TYPES
// ------------------------------------------------------------------
const TYPES = {
  imp:    { hp: 42,  speed: 1.75, dmg: 8,  range: 0.75, atkCd: 0.9, xp: 3, size: 0.95, vOff: 0.10, score: 10, ranged: false },
  hound:  { hp: 22,  speed: 2.95, dmg: 6,  range: 0.65, atkCd: 0.7, xp: 2, size: 0.72, vOff: 0.26, score: 8,  ranged: false },
  brute:  { hp: 140, speed: 1.15, dmg: 22, range: 0.95, atkCd: 1.3, xp: 9, size: 1.45, vOff: 0.00, score: 30, ranged: false },
  caster: { hp: 55,  speed: 1.25, dmg: 15, range: 7.0,  atkCd: 2.1, xp: 6, size: 1.00, vOff: 0.05, score: 25, ranged: true, projSpeed: 3.4 },
};

// ------------------------------------------------------------------
// SPRITES — 프리렌더 (외부 이미지 없음, 캔버스 도형으로 그림)
// ------------------------------------------------------------------
function makeSprite(w, h, draw){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  return c;
}
function eyes(g, x1, x2, y, r, color){
  g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 8;
  g.beginPath(); g.arc(x1, y, r, 0, 7); g.arc(x2, y, r, 0, 7); g.fill();
  g.shadowBlur = 0;
}
const SPR = {};
function buildSprites(){
  // IMP — 붉은 소악마
  SPR.imp = makeSprite(48, 64, (g, w, h) => {
    g.fillStyle = '#3a0d0d';
    g.beginPath(); g.moveTo(14,64); g.lineTo(20,40); g.lineTo(28,40); g.lineTo(34,64); g.fill(); // legs
    const bg = g.createLinearGradient(0,20,0,52);
    bg.addColorStop(0,'#c1291f'); bg.addColorStop(1,'#6e130f');
    g.fillStyle = bg;
    g.beginPath(); g.ellipse(24,36,15,18,0,0,7); g.fill();           // body
    g.fillStyle = '#8a1a13';
    g.beginPath(); g.ellipse(8,34,5,11,-.4,0,7); g.ellipse(40,34,5,11,.4,0,7); g.fill(); // arms
    g.fillStyle = '#a8221a';
    g.beginPath(); g.arc(24,18,11,0,7); g.fill();                    // head
    g.fillStyle = '#5e100c';
    g.beginPath(); g.moveTo(15,10); g.lineTo(11,0); g.lineTo(19,8); g.closePath();
    g.moveTo(33,10); g.lineTo(37,0); g.lineTo(29,8); g.closePath(); g.fill(); // horns
    eyes(g, 20, 28, 18, 2.4, '#ffe24a');
  });
  // HOUND — 빠른 네발 짐승
  SPR.hound = makeSprite(56, 40, (g, w, h) => {
    g.fillStyle = '#241016';
    for (const lx of [12,22,34,44]){ g.fillRect(lx,26,4,14); }        // legs
    const bg = g.createLinearGradient(0,6,0,30);
    bg.addColorStop(0,'#3b1a24'); bg.addColorStop(1,'#160a0e');
    g.fillStyle = bg;
    g.beginPath(); g.ellipse(28,20,22,12,0,0,7); g.fill();           // body
    g.beginPath(); g.ellipse(48,16,9,8,0,0,7); g.fill();             // head
    g.fillStyle = '#0d0508';
    g.beginPath(); g.moveTo(54,14); g.lineTo(58,17); g.lineTo(52,20); g.fill(); // snout
    eyes(g, 46, 51, 14, 2, '#ff2e2e');
  });
  // BRUTE — 거대 마수
  SPR.brute = makeSprite(64, 76, (g, w, h) => {
    g.fillStyle = '#2a0808';
    g.fillRect(18,58,10,18); g.fillRect(38,58,10,18);               // legs
    const bg = g.createLinearGradient(0,14,0,60);
    bg.addColorStop(0,'#7a1410'); bg.addColorStop(1,'#3a0806');
    g.fillStyle = bg;
    g.beginPath(); g.moveTo(10,60); g.lineTo(16,24); g.lineTo(48,24); g.lineTo(54,60); g.closePath(); g.fill(); // torso
    g.fillStyle = '#611210';
    g.beginPath(); g.ellipse(9,30,7,15,-.3,0,7); g.ellipse(55,30,7,15,.3,0,7); g.fill();  // arms
    g.fillStyle = '#8a1712';
    g.beginPath(); g.arc(32,18,14,0,7); g.fill();                   // head
    g.fillStyle = '#3a0806';
    g.beginPath(); g.moveTo(20,10); g.lineTo(10,-2); g.lineTo(26,6); g.closePath();
    g.moveTo(44,10); g.lineTo(54,-2); g.lineTo(38,6); g.closePath(); g.fill();  // horns
    eyes(g, 27, 37, 18, 3, '#ff8a1a');
  });
  // CASTER — 떠다니는 마법사
  SPR.caster = makeSprite(48, 66, (g, w, h) => {
    const bg = g.createLinearGradient(0,10,0,60);
    bg.addColorStop(0,'#3a1c56'); bg.addColorStop(1,'#160a24');
    g.fillStyle = bg;
    g.beginPath(); g.moveTo(24,6); g.lineTo(42,60); g.lineTo(6,60); g.closePath(); g.fill(); // robe
    g.fillStyle = '#241038';
    g.beginPath(); g.arc(24,16,11,0,7); g.fill();                   // hood
    g.fillStyle = '#7cf'; g.shadowColor = '#7cf'; g.shadowBlur = 14;
    g.beginPath(); g.arc(24,44,6,0,7); g.fill();                    // core
    g.shadowBlur = 0;
    eyes(g, 20, 28, 16, 2.2, '#63f0ff');
  });
  // FIREBALL
  SPR.fireball = makeSprite(32, 32, (g, w, h) => {
    const rg = g.createRadialGradient(16,16,1, 16,16,15);
    rg.addColorStop(0,'#fff6c0'); rg.addColorStop(.4,'#ffae2e');
    rg.addColorStop(.8,'#e23c14'); rg.addColorStop(1,'rgba(180,20,10,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(16,16,15,0,7); g.fill();
  });
}

// ------------------------------------------------------------------
// IMAGE ASSETS (외부 CC0 텍스처) — 로드 실패 시 solid-color로 자동 폴백
//   assets/textures/*  ·  Kenney Prototype Textures (CC0 1.0)
// ------------------------------------------------------------------
const ASSETS = {};
function loadImage(name, src){
  const img = new Image();
  img.onload = () => { ASSETS[name] = img; };
  img.onerror = () => { /* 폴백: 텍스처 없이 solid-color 벽 사용 */ };
  img.src = src;
}
function loadAssets(){
  loadImage('wallDark', 'assets/textures/wall_dark.png');   // grid==1
  loadImage('wallRed',  'assets/textures/wall_red.png');    // grid==2
}
const WALL_TEX = { 1: 'wallDark', 2: 'wallRed' };
// 폴백용 벽 기본색
const WALL_RGB = { 1: [150, 92, 78], 2: [176, 40, 40] };

// ------------------------------------------------------------------
// STATE
// ------------------------------------------------------------------
const player = { x:0, y:0, a:0, dirX:1, dirY:0, planeX:0, planeY:CFG.fov };
const game = {
  mode: 'menu',      // menu | play | levelup | pause | dead
  time: 0, score: 0, kills: 0,
  level: 1, xp: 0, xpNext: CFG.xpBase,
  combo: 0, comboTimer: 0,
  fireTimer: 0, spawnTimer: 1.5, pending: 0,
  muzzle: 0, recoil: 0, hurt: 0, shake: 0, bob: 0, moving: false,
};
let enemies = [], projectiles = [], particles = [];
let mouseDown = false;
const keys = { f:false, b:false, l:false, r:false, sprint:false };

// ------------------------------------------------------------------
// DOM
// ------------------------------------------------------------------
const $ = id => document.getElementById(id);
const canvas = $('view'), ctx = canvas.getContext('2d');
let zBuffer = new Float32Array(1);
const el = {
  hud:$('hud'), wave:$('wave'), time:$('time'), kills:$('kills'), score:$('score'),
  combo:$('combo'), comboRank:$('comboRank'), comboMul:$('comboMul'), comboBar:$('comboBar'),
  hpBar:$('hpBar'), hpText:$('hpText'), level:$('level'), xpBar:$('xpBar'),
  start:$('startScreen'), levelS:$('levelScreen'), cards:$('cards'),
  pause:$('pauseScreen'), over:$('overScreen'), overStats:$('overStats'),
};

function resize(){
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  canvas.width  = Math.max(160, Math.floor(w * CFG.renderScale));
  canvas.height = Math.max(120, Math.floor(h * CFG.renderScale));
  zBuffer = new Float32Array(canvas.width);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------
// UPGRADES (레벨업 3택1) — 여기 배열에 추가만 하면 카드가 늘어남
// ------------------------------------------------------------------
const P = { dmgMul:1, fireRateMul:1, speedMul:1, pierce:0, lifesteal:0, comboBonus:0, maxHp:0, hp:0 };
const UPGRADES = [
  { ico:'🔥', name:'화력 강화', desc:'데미지 +25%', tier:'COMMON', apply:()=>P.dmgMul*=1.25 },
  { ico:'⚡', name:'속사',      desc:'발사 속도 +22%', tier:'COMMON', apply:()=>P.fireRateMul*=1.22 },
  { ico:'🏃', name:'질주',      desc:'이동 속도 +15%', tier:'COMMON', apply:()=>P.speedMul*=1.15 },
  { ico:'❤️', name:'강인함',    desc:'최대 HP +30 · 즉시 회복', tier:'COMMON', apply:()=>{P.maxHp+=30; P.hp=Math.min(P.hp+30,P.maxHp);} },
  { ico:'🎯', name:'관통탄',    desc:'탄환이 적 +1 추가 관통', tier:'RARE',   apply:()=>P.pierce+=1 },
  { ico:'🩸', name:'흡혈',      desc:'처치 시 HP +4', tier:'RARE',   apply:()=>P.lifesteal+=4 },
  { ico:'💀', name:'광폭화',    desc:'콤보 데미지 배율 +50%', tier:'RARE', apply:()=>P.comboBonus+=0.5 },
  { ico:'💥', name:'대구경',    desc:'데미지 +45% · 발사속도 -10%', tier:'EPIC', apply:()=>{P.dmgMul*=1.45; P.fireRateMul*=0.9;} },
];
function playerSpeed(){ return CFG.moveSpeed * P.speedMul * (keys.sprint ? CFG.sprintMul : 1); }
function currentDamage(){
  const comboMul = 1 + Math.min(game.combo, 20) * CFG.comboDmgPer * (1 + P.comboBonus);
  return CFG.bulletDamage * P.dmgMul * comboMul;
}

// ------------------------------------------------------------------
// LIFECYCLE
// ------------------------------------------------------------------
function resetState(){
  P.dmgMul = 1; P.fireRateMul = 1; P.speedMul = 1; P.pierce = 0;
  P.lifesteal = 0; P.comboBonus = 0; P.maxHp = CFG.maxHp; P.hp = CFG.maxHp;
  player.x = spawn.x; player.y = spawn.y; player.a = Math.PI / 2;
  enemies = []; projectiles = []; particles = [];
  game.time = 0; game.score = 0; game.kills = 0;
  game.level = 1; game.xp = 0; game.xpNext = CFG.xpBase;
  game.combo = 0; game.comboTimer = 0;
  game.fireTimer = 0; game.spawnTimer = 1.5; game.pending = 0;
  game.muzzle = game.recoil = game.hurt = game.shake = game.bob = 0;
}
function startGame(){
  resetState();
  game.mode = 'play';
  el.start.classList.add('hidden');
  el.over.classList.add('hidden');
  el.hud.classList.remove('hidden');
  requestLock();
}
function gameOver(){
  game.mode = 'dead';
  document.exitPointerLock?.();
  el.overStats.innerHTML =
    `생존 <b>${fmtTime(game.time)}</b> &nbsp;·&nbsp; WAVE <b>${waveNum()}</b><br>` +
    `처치 <b>${game.kills}</b> &nbsp;·&nbsp; LV <b>${game.level}</b><br>` +
    `SCORE <b>${game.score.toLocaleString()}</b>`;
  el.over.classList.remove('hidden');
}

// ------------------------------------------------------------------
// SURVIVOR: spawns / xp / combo
// ------------------------------------------------------------------
function waveNum(){ return 1 + Math.floor(game.time / 30); }
function pickType(){
  const t = game.time;
  const table = [
    ['imp',   5],
    ['hound', t > 12 ? 4 : 2],
    ['brute', t > 40 ? 2.4 : (t > 24 ? 1 : 0)],
    ['caster',t > 60 ? 1.8 : (t > 34 ? 0.9 : 0)],
  ];
  let sum = 0; for (const [,w] of table) sum += w;
  let r = Math.random() * sum;
  for (const [k, w] of table){ if ((r -= w) <= 0) return k; }
  return 'imp';
}
function spawnEnemy(){
  for (let tries = 0; tries < 30; tries++){
    const x = 1 + Math.random() * (MAP_W - 2);
    const y = 1 + Math.random() * (MAP_H - 2);
    if (isWall(x, y)) continue;
    if (Math.hypot(x - player.x, y - player.y) < 5.5) continue;
    const key = pickType(), t = TYPES[key];
    enemies.push({
      kind:key, x, y, hp:t.hp, maxHp:t.hp, atk:0, hitFlash:0,
      sprite:SPR[key], size:t.size, vOffset:t.vOff, t,
    });
    return;
  }
}
function updateSpawns(dt){
  game.spawnTimer -= dt;
  if (game.spawnTimer > 0) return;
  const t = game.time;
  const maxAlive = Math.min(70, 10 + Math.floor(t / 6));
  const interval = Math.max(0.34, 1.6 - t * 0.012);
  game.spawnTimer = interval;
  if (enemies.length >= maxAlive) return;
  const burst = Math.min(4, 1 + Math.floor(t / 45));
  for (let i = 0; i < burst && enemies.length < maxAlive; i++) spawnEnemy();
}
function comboMul(){
  return 1 + Math.floor(game.combo / 4) * 0.5;   // 4콤보마다 +0.5x
}
function comboRankName(m){
  if (m >= 5) return 'SSS'; if (m >= 4) return 'SS'; if (m >= 3) return 'S';
  if (m >= 2.5) return 'A'; if (m >= 2) return 'B'; if (m >= 1.5) return 'C';
  return 'D';
}
function gainXp(n){
  game.xp += n;
  while (game.xp >= game.xpNext){
    game.xp -= game.xpNext;
    game.level++;
    game.xpNext = Math.floor(game.xpNext * CFG.xpGrowth);
    game.pending++;
  }
  if (game.pending > 0 && game.mode === 'play') openLevelUp();
}

// ------------------------------------------------------------------
// COMBAT
// ------------------------------------------------------------------
function tryShoot(){
  if (game.fireTimer > 0) return;
  game.fireTimer = CFG.fireCooldown * P.fireRateMul;
  game.muzzle = 1; game.recoil = 1; game.shake = Math.max(game.shake, 0.25);

  const W = canvas.width;
  const invDet = 1 / (player.planeX * player.dirY - player.dirX * player.planeY);
  const cands = [];
  for (const e of enemies){
    const sx = e.x - player.x, sy = e.y - player.y;
    const tX = invDet * (player.dirY * sx - player.dirX * sy);
    const tY = invDet * (-player.planeY * sx + player.planeX * sy);
    if (tY <= 0.1) continue;                        // behind camera
    const screenX = (W / 2) * (1 + tX / tY);
    const halfW = Math.abs(canvas.height / tY) * e.size * 0.42;
    if (Math.abs(screenX - W / 2) > Math.max(halfW, 5)) continue; // not under crosshair
    const col = W >> 1;
    if (tY > zBuffer[col] + 0.05) continue;         // blocked by wall
    cands.push({ e, d: tY });
  }
  cands.sort((a, b) => a.d - b.d);
  const dmg = currentDamage();
  const hits = 1 + P.pierce;
  for (let i = 0; i < cands.length && i < hits; i++) damageEnemy(cands[i].e, dmg);
}
function damageEnemy(e, dmg){
  e.hp -= dmg; e.hitFlash = 0.08;
  burst(e, 5, '#ff5a2a');
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e){
  const idx = enemies.indexOf(e); if (idx < 0) return;
  enemies.splice(idx, 1);
  game.combo++; game.comboTimer = CFG.comboWindow + P.comboBonus * 1.0;
  const m = comboMul();
  gainXp(Math.round(e.t.xp * m));
  game.score += Math.round(e.t.score * m);
  game.kills++;
  if (P.lifesteal) P.hp = Math.min(P.maxHp, P.hp + P.lifesteal);
  burst(e, 14, '#b81616');
}
function hurtPlayer(dmg){
  if (game.mode !== 'play') return;
  P.hp -= dmg;
  game.hurt = 1; game.shake = Math.max(game.shake, 0.6);
  game.combo = 0; game.comboTimer = 0;    // 맞으면 콤보 리셋 (공격적 플레이 유도)
  if (P.hp <= 0){ P.hp = 0; gameOver(); }
}

// ------------------------------------------------------------------
// ENEMIES / PROJECTILES UPDATE
// ------------------------------------------------------------------
function updateEnemies(dt){
  const R = 0.28;
  for (const e of enemies){
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.atk > 0) e.atk -= dt;
    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1e-4;
    const t = e.t;

    if (dist > t.range){                         // approach
      const ux = dx / dist, uy = dy / dist;
      const sp = t.speed * dt;
      const nx = e.x + ux * sp, ny = e.y + uy * sp;
      if (!collides(nx, e.y, R)) e.x = nx;
      if (!collides(e.x, ny, R)) e.y = ny;
    }
    if (e.atk <= 0){                              // attack
      if (!t.ranged && dist <= t.range){
        hurtPlayer(t.dmg); e.atk = t.atkCd;
      } else if (t.ranged && dist <= t.range && lineOfSight(e.x, e.y, player.x, player.y)){
        const ux = dx / dist, uy = dy / dist;
        projectiles.push({ x:e.x, y:e.y, vx:ux*t.projSpeed, vy:uy*t.projSpeed,
                           dmg:t.dmg, sprite:SPR.fireball, size:0.5, vOffset:-0.05 });
        e.atk = t.atkCd;
      }
    }
  }
}
function updateProjectiles(dt){
  for (let i = projectiles.length - 1; i >= 0; i--){
    const p = projectiles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (isWall(p.x, p.y)){ projectiles.splice(i, 1); continue; }
    if (Math.hypot(p.x - player.x, p.y - player.y) < 0.42){
      hurtPlayer(p.dmg); projectiles.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------------
// PARTICLES (screen-space bursts at enemy projected position)
// ------------------------------------------------------------------
function burst(e, n, color){
  const W = canvas.width, H = canvas.height;
  const invDet = 1 / (player.planeX * player.dirY - player.dirX * player.planeY);
  const sx = e.x - player.x, sy = e.y - player.y;
  const tX = invDet * (player.dirY * sx - player.dirX * sy);
  const tY = invDet * (-player.planeY * sx + player.planeX * sy);
  if (tY <= 0.1) return;
  const px = (W / 2) * (1 + tX / tY);
  const py = H / 2;
  for (let i = 0; i < n; i++){
    const a = Math.random() * 7, s = 40 + Math.random() * 140;
    particles.push({ x:px, y:py, vx:Math.cos(a)*s, vy:Math.sin(a)*s - 40,
      life:0.5 + Math.random()*0.4, color, r:1 + Math.random()*2.5 });
  }
}
function updateParticles(dt){
  for (let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    p.life -= dt; if (p.life <= 0){ particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt;
  }
}

// ------------------------------------------------------------------
// UPDATE
// ------------------------------------------------------------------
function update(dt){
  // 방향 벡터 갱신
  player.dirX = Math.cos(player.a); player.dirY = Math.sin(player.a);
  player.planeX = -Math.sin(player.a) * CFG.fov; player.planeY = Math.cos(player.a) * CFG.fov;

  // 이펙트 감쇠
  game.muzzle = Math.max(0, game.muzzle - dt * 7);
  game.recoil = Math.max(0, game.recoil - dt * 6);
  game.hurt   = Math.max(0, game.hurt - dt * 2);
  game.shake  = Math.max(0, game.shake - dt * 2.5);

  if (game.mode !== 'play') return;

  game.time += dt;
  if (game.fireTimer > 0) game.fireTimer -= dt;

  // 이동
  let mx = 0, my = 0;
  const px2 = -player.dirY, py2 = player.dirX;       // 오른쪽(스트레이프) 벡터
  if (keys.f){ mx += player.dirX; my += player.dirY; }
  if (keys.b){ mx -= player.dirX; my -= player.dirY; }
  if (keys.r){ mx += px2; my += py2; }
  if (keys.l){ mx -= px2; my -= py2; }
  const ml = Math.hypot(mx, my);
  game.moving = ml > 0;
  if (ml > 0){
    mx /= ml; my /= ml;
    const sp = playerSpeed() * dt;
    const nx = player.x + mx * sp, ny = player.y + my * sp;
    if (!collides(nx, player.y, CFG.playerRadius)) player.x = nx;
    if (!collides(player.x, ny, CFG.playerRadius)) player.y = ny;
    game.bob += dt * 9 * (keys.sprint ? 1.35 : 1);
  }

  if (mouseDown) tryShoot();

  updateEnemies(dt);
  updateProjectiles(dt);
  updateSpawns(dt);
  updateParticles(dt);

  // 콤보 감쇠
  if (game.combo > 0){
    game.comboTimer -= dt;
    if (game.comboTimer <= 0){ game.combo = 0; game.comboTimer = 0; }
  }
}

// ------------------------------------------------------------------
// RENDER
// ------------------------------------------------------------------
function render(){
  const W = canvas.width, H = canvas.height;

  // 화면 흔들림
  let ox = 0, oy = 0;
  if (game.shake > 0){ ox = (Math.random()*2-1)*game.shake*6; oy = (Math.random()*2-1)*game.shake*6; }
  ctx.setTransform(1,0,0,1,ox,oy);

  // 천장 / 바닥
  const horizon = H / 2;
  let gsky = ctx.createLinearGradient(0,0,0,horizon);
  gsky.addColorStop(0,'#07070c'); gsky.addColorStop(1,'#1a1220');
  ctx.fillStyle = gsky; ctx.fillRect(-8, -8, W+16, horizon+8);
  let gfl = ctx.createLinearGradient(0,horizon,0,H);
  gfl.addColorStop(0,'#241a18'); gfl.addColorStop(1,'#0c0808');
  ctx.fillStyle = gfl; ctx.fillRect(-8, horizon, W+16, H-horizon+16);

  // 벽 (DDA raycasting)
  for (let x = 0; x < W; x += CFG.colStep){
    const cameraX = 2 * x / W - 1;
    const rayX = player.dirX + player.planeX * cameraX;
    const rayY = player.dirY + player.planeY * cameraX;
    let mapX = player.x | 0, mapY = player.y | 0;
    const dDX = Math.abs(1 / rayX), dDY = Math.abs(1 / rayY);
    let stepX, stepY, sDX, sDY, side = 0;
    if (rayX < 0){ stepX = -1; sDX = (player.x - mapX) * dDX; } else { stepX = 1; sDX = (mapX + 1 - player.x) * dDX; }
    if (rayY < 0){ stepY = -1; sDY = (player.y - mapY) * dDY; } else { stepY = 1; sDY = (mapY + 1 - player.y) * dDY; }
    let hit = 0, guard = 0;
    while (!hit && guard++ < 64){
      if (sDX < sDY){ sDX += dDX; mapX += stepX; side = 0; }
      else { sDY += dDY; mapY += stepY; side = 1; }
      if (mapX < 0 || mapY < 0 || mapX >= MAP_W || mapY >= MAP_H){ hit = 1; break; }
      if (grid[mapY][mapX] > 0) hit = 1;
    }
    let perp = side === 0 ? (sDX - dDX) : (sDY - dDY);
    if (perp < 0.02) perp = 0.02;
    const lineH = H / perp;
    const y0 = horizon - lineH / 2;

    // 벽 종류 + 거리 안개 + 면 방향 음영
    const wallVal = (mapY >= 0 && mapY < MAP_H && mapX >= 0 && mapX < MAP_W) ? grid[mapY][mapX] : 1;
    let bright = Math.max(0.12, 1 - perp / CFG.maxViewDist);
    if (side === 1) bright *= 0.72;

    const tex = ASSETS[WALL_TEX[wallVal]];
    if (tex){
      // 텍스처 매핑: 광선이 벽에 맞은 정확한 위치 → 텍스처 컬럼
      let wallX = side === 0 ? (player.y + perp * rayY) : (player.x + perp * rayX);
      wallX -= Math.floor(wallX);
      let texX = (wallX * tex.width) | 0;
      if (texX >= tex.width) texX = tex.width - 1;
      ctx.drawImage(tex, texX, 0, 1, tex.height, x, y0, CFG.colStep, lineH);
      const dark = Math.min(0.85, 1 - bright);            // 안개(검정 오버레이)
      if (dark > 0.01){ ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(x, y0, CFG.colStep, lineH); }
    } else {
      // 폴백: 텍스처 미로드 시 solid-color 벽
      if (((mapX + mapY) & 1) === 0) bright *= 0.9;
      const c = WALL_RGB[wallVal] || WALL_RGB[1];
      ctx.fillStyle = `rgb(${(c[0]*bright)|0},${(c[1]*bright)|0},${(c[2]*bright)|0})`;
      ctx.fillRect(x, y0, CFG.colStep, lineH);
    }

    for (let c = 0; c < CFG.colStep && x + c < W; c++) zBuffer[x + c] = perp;
  }

  // 스프라이트 (적 + 투사체) — 원거리→근거리, 벽 z-test
  const rends = enemies.concat(projectiles);
  for (const s of rends){ const dx=s.x-player.x, dy=s.y-player.y; s._d = dx*dx+dy*dy; }
  rends.sort((a, b) => b._d - a._d);
  const invDet = 1 / (player.planeX * player.dirY - player.dirX * player.planeY);
  for (const s of rends){
    const sx = s.x - player.x, sy = s.y - player.y;
    const tX = invDet * (player.dirY * sx - player.dirX * sy);
    const tY = invDet * (-player.planeY * sx + player.planeX * sy);
    if (tY <= 0.1) continue;
    const screenX = (W / 2) * (1 + tX / tY);
    const sizeUnit = Math.abs(H / tY);
    const spriteH = sizeUnit * (s.size || 1);
    const spriteW = spriteH * ((s.sprite.width) / (s.sprite.height));
    const vMove = spriteH * (s.vOffset || 0);
    const y0 = horizon - spriteH / 2 + vMove;
    const startX = Math.floor(screenX - spriteW / 2);
    const endX = Math.ceil(screenX + spriteW / 2);
    const img = s.sprite, iw = img.width, ih = img.height;
    for (let x = startX; x < endX; x++){
      if (x < 0 || x >= W) continue;
      if (tY >= zBuffer[x]) continue;                     // 벽 뒤 가림
      const texX = ((x - (screenX - spriteW / 2)) / spriteW * iw) | 0;
      if (texX < 0 || texX >= iw) continue;
      ctx.drawImage(img, texX, 0, 1, ih, x, y0, 1, spriteH);
    }
    // 피격 플래시
    if (s.hitFlash > 0){
      ctx.globalAlpha = 0.6; ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#fff';
      ctx.fillRect(startX, y0, spriteW, spriteH);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  }

  // 파티클
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles){
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  drawWeapon(W, H);
  drawCrosshair(W, H);
  drawMinimap(W, H);

  // 피격 붉은 플래시 + 비네트
  ctx.setTransform(1,0,0,1,0,0);
  if (game.hurt > 0){
    ctx.fillStyle = `rgba(180,10,10,${game.hurt * 0.45})`;
    ctx.fillRect(0, 0, W, H);
  }
  const vg = ctx.createRadialGradient(W/2,H/2, H*0.3, W/2,H/2, H*0.75);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

function drawWeapon(W, H){
  const bob = game.moving ? Math.sin(game.bob) * H * 0.012 : 0;
  const bobx = game.moving ? Math.cos(game.bob * 0.5) * W * 0.01 : 0;
  const kick = game.recoil * H * 0.05;
  const cx = W / 2 + bobx, by = H + bob + kick;
  const s = H * 0.13;                       // gun scale
  // 총열
  ctx.fillStyle = '#15181c';
  ctx.fillRect(cx - s*0.16, by - s*2.0, s*0.32, s*1.7);
  ctx.fillStyle = '#0a0c0e';
  ctx.fillRect(cx - s*0.10, by - s*2.0, s*0.20, s*1.7);
  // 몸통
  ctx.fillStyle = '#20242a';
  ctx.beginPath();
  ctx.moveTo(cx - s*0.9, by); ctx.lineTo(cx - s*0.5, by - s*0.9);
  ctx.lineTo(cx + s*0.5, by - s*0.9); ctx.lineTo(cx + s*0.9, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#33393f';
  ctx.fillRect(cx - s*0.6, by - s*0.85, s*1.2, s*0.16);   // 하이라이트
  // 머즐 플래시
  if (game.muzzle > 0){
    const mf = s * (0.5 + game.muzzle * 1.4);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, by - s*2.0, 1, cx, by - s*2.0, mf);
    g.addColorStop(0,'rgba(255,250,200,'+game.muzzle+')');
    g.addColorStop(.5,'rgba(255,150,40,'+game.muzzle*0.8+')');
    g.addColorStop(1,'rgba(255,80,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, by - s*2.0, mf, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}
function drawCrosshair(W, H){
  const cx = W/2, cy = H/2, g = 3, l = 7;
  ctx.strokeStyle = 'rgba(255,120,60,0.9)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx-g-l, cy); ctx.lineTo(cx-g, cy);
  ctx.moveTo(cx+g, cy); ctx.lineTo(cx+g+l, cy);
  ctx.moveTo(cx, cy-g-l); ctx.lineTo(cx, cy-g);
  ctx.moveTo(cx, cy+g); ctx.lineTo(cx, cy+g+l);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,60,0.9)'; ctx.fillRect(cx-0.5, cy-0.5, 1.5, 1.5);
}
function drawMinimap(W, H){
  const scale = Math.max(3, (H * 0.006) | 0);
  const mw = MAP_W * scale, mh = MAP_H * scale;
  const ox = W - mw - 8, oy = 8;
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = '#000'; ctx.fillRect(ox-2, oy-2, mw+4, mh+4);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++){
    if (grid[y][x] === 1){ ctx.fillStyle = '#4a3330'; ctx.fillRect(ox+x*scale, oy+y*scale, scale, scale); }
  }
  ctx.fillStyle = '#ff3b30';
  for (const e of enemies) ctx.fillRect(ox+e.x*scale-1, oy+e.y*scale-1, 2, 2);
  ctx.fillStyle = '#5cf0ff';
  ctx.fillRect(ox+player.x*scale-1.5, oy+player.y*scale-1.5, 3, 3);
  ctx.strokeStyle = '#5cf0ff'; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(ox+player.x*scale, oy+player.y*scale);
  ctx.lineTo(ox+(player.x+player.dirX)*scale, oy+(player.y+player.dirY)*scale); ctx.stroke();
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------
// HUD SYNC
// ------------------------------------------------------------------
function fmtTime(t){ const m = (t/60)|0, s = (t%60)|0; return m + ':' + (s<10?'0'+s:s); }
function syncHud(){
  el.wave.textContent = waveNum();
  el.time.textContent = fmtTime(game.time);
  el.kills.textContent = game.kills;
  el.score.textContent = game.score.toLocaleString();
  el.hpBar.style.width = Math.max(0, P.hp / P.maxHp * 100) + '%';
  el.hpText.textContent = Math.ceil(P.hp);
  el.level.textContent = game.level;
  el.xpBar.style.width = (game.xp / game.xpNext * 100) + '%';
  if (game.combo > 1){
    el.combo.classList.remove('hidden');
    const m = comboMul();
    el.comboRank.textContent = comboRankName(m);
    el.comboMul.textContent = 'x' + m.toFixed(1) + '  (' + game.combo + ')';
    el.comboBar.style.width = Math.max(0, game.comboTimer / CFG.comboWindow * 100) + '%';
  } else el.combo.classList.add('hidden');
}

// ------------------------------------------------------------------
// LEVEL UP UI
// ------------------------------------------------------------------
function openLevelUp(){
  game.mode = 'levelup';
  document.exitPointerLock?.();
  const pool = UPGRADES.slice();
  const pick = [];
  for (let i = 0; i < 3 && pool.length; i++){
    pick.push(pool.splice((Math.random()*pool.length)|0, 1)[0]);
  }
  el.cards.innerHTML = '';
  for (const u of pick){
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `<div class="ico">${u.ico}</div><div class="name">${u.name}</div>` +
                  `<div class="desc">${u.desc}</div><div class="tier">${u.tier}</div>`;
    c.onclick = () => chooseUpgrade(u);
    el.cards.appendChild(c);
  }
  el.levelS.classList.remove('hidden');
}
function chooseUpgrade(u){
  u.apply();
  game.pending--;
  el.levelS.classList.add('hidden');
  if (game.pending > 0){ openLevelUp(); return; }
  game.mode = 'play';
  requestLock();
}

// ------------------------------------------------------------------
// INPUT
// ------------------------------------------------------------------
function requestLock(){ canvas.requestPointerLock?.(); }
function keyCode(e, down){
  switch (e.code){
    case 'KeyW': case 'ArrowUp': keys.f = down; break;
    case 'KeyS': case 'ArrowDown': keys.b = down; break;
    case 'KeyA': keys.l = down; break;
    case 'KeyD': keys.r = down; break;
    case 'ArrowLeft': if (down) player.a -= 0.16; break;
    case 'ArrowRight': if (down) player.a += 0.16; break;
    case 'ShiftLeft': case 'ShiftRight': keys.sprint = down; break;
    case 'KeyR': if (down && game.mode === 'dead') startGame(); break;
    default: return;
  }
  e.preventDefault();
}
window.addEventListener('keydown', e => keyCode(e, true));
window.addEventListener('keyup', e => keyCode(e, false));

document.addEventListener('mousemove', e => {
  if (game.mode === 'play' && document.pointerLockElement === canvas){
    player.a += e.movementX * CFG.turnSpeed;
  }
});
canvas.addEventListener('mousedown', e => {
  if (game.mode === 'play'){ mouseDown = true; tryShoot(); }
  e.preventDefault();
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('contextmenu', e => { if (game.mode === 'play') e.preventDefault(); });

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && game.mode === 'play'){
    game.mode = 'pause'; mouseDown = false;
    el.pause.classList.remove('hidden');
  }
});

$('startBtn').onclick = startGame;
$('restartBtn').onclick = startGame;
$('resumeBtn').onclick = () => {
  el.pause.classList.add('hidden');
  game.mode = 'play';
  requestLock();
};

// ------------------------------------------------------------------
// MAIN LOOP
// ------------------------------------------------------------------
let last = performance.now();
function frame(now){
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;
  update(dt);
  render();
  syncHud();
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------
// BOOT
// ------------------------------------------------------------------
parseMap(MAP_STR);
buildSprites();
loadAssets();          // 외부 CC0 텍스처 비동기 로드 (실패해도 폴백으로 동작)
resize();
resetState();
game.mode = 'menu';
requestAnimationFrame(frame);

// 콘솔 확인용 (개발 편의) — 배열은 resetState에서 재할당되므로 getter로 live 참조
window.DOOMVIVOR = {
  CFG, game, P, player, TYPES, UPGRADES,
  get enemies(){ return enemies; },
  get projectiles(){ return projectiles; },
  get particles(){ return particles; },
  get ASSETS(){ return ASSETS; },
};

})();
