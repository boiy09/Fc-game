const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const hpEl = document.getElementById('hp');

const state = {
  running: true,
  score: 0,
  hp: 3,
  timeLeft: 90,
  keys: new Set(),
};

const field = {
  width: canvas.width,
  height: canvas.height,
  margin: 28,
};

const player = {
  x: 120,
  y: field.height / 2,
  r: 16,
  speed: 4,
};

const ball = {
  x: player.x + 28,
  y: player.y,
  r: 9,
  vx: 0,
  vy: 0,
  friction: 0.99,
};

const defender = {
  x: 520,
  y: field.height / 2,
  r: 17,
  speed: 2.2,
  hitCooldownMs: 0,
};

const goalZone = {
  x: field.width - 90,
  y: field.height / 2 - 75,
  width: 42,
  height: 150,
};

function resetPositions() {
  player.x = 120;
  player.y = field.height / 2;

  ball.x = player.x + 28;
  ball.y = player.y;
  ball.vx = 0;
  ball.vy = 0;

  defender.x = 520;
  defender.y = field.height / 2;
  defender.hitCooldownMs = 800;
}

function restartGame() {
  state.running = true;
  state.score = 0;
  state.hp = 3;
  state.timeLeft = 90;
  resetPositions();
  syncHud();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

function syncHud() {
  scoreEl.textContent = String(state.score);
  hpEl.textContent = String(state.hp);
  timeEl.textContent = String(Math.ceil(state.timeLeft));
}

function updatePlayer() {
  let dx = 0;
  let dy = 0;

  if (state.keys.has('ArrowLeft') || state.keys.has('a')) dx -= 1;
  if (state.keys.has('ArrowRight') || state.keys.has('d')) dx += 1;
  if (state.keys.has('ArrowUp') || state.keys.has('w')) dy -= 1;
  if (state.keys.has('ArrowDown') || state.keys.has('s')) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    player.x += (dx / len) * player.speed;
    player.y += (dy / len) * player.speed;
  }

  player.x = clamp(player.x, field.margin, field.width - field.margin);
  player.y = clamp(player.y, field.margin, field.height - field.margin);
}

function kickBall() {
  if (!state.running) return;
  const gap = dist(player.x, player.y, ball.x, ball.y);
  if (gap > player.r + ball.r + 8) return;

  const dirX = ball.x - player.x;
  const dirY = ball.y - player.y;
  const len = Math.max(0.001, Math.hypot(dirX, dirY));
  ball.vx = (dirX / len) * 8;
  ball.vy = (dirY / len) * 8;
}

function updateBall() {
  const nearPlayer = dist(player.x, player.y, ball.x, ball.y) < player.r + ball.r + 5;

  if (nearPlayer && Math.abs(ball.vx) + Math.abs(ball.vy) < 0.3) {
    ball.x += (player.x + 25 - ball.x) * 0.25;
    ball.y += (player.y - ball.y) * 0.25;
  }

  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vx *= ball.friction;
  ball.vy *= ball.friction;

  if (ball.x - ball.r < field.margin) {
    ball.x = field.margin + ball.r;
    ball.vx *= -0.85;
  }
  if (ball.x + ball.r > field.width - field.margin) {
    ball.x = field.width - field.margin - ball.r;
    ball.vx *= -0.85;
  }
  if (ball.y - ball.r < field.margin) {
    ball.y = field.margin + ball.r;
    ball.vy *= -0.85;
  }
  if (ball.y + ball.r > field.height - field.margin) {
    ball.y = field.height - field.margin - ball.r;
    ball.vy *= -0.85;
  }

  const inGoal =
    ball.x + ball.r > goalZone.x &&
    ball.x - ball.r < goalZone.x + goalZone.width &&
    ball.y + ball.r > goalZone.y &&
    ball.y - ball.r < goalZone.y + goalZone.height;

  if (inGoal) {
    state.score += 10;
    ball.x = player.x + 28;
    ball.y = player.y;
    ball.vx = 0;
    ball.vy = 0;
  }
}

function updateDefender(deltaMs) {
  const targetX = ball.x;
  const targetY = ball.y;

  const dx = targetX - defender.x;
  const dy = targetY - defender.y;
  const len = Math.max(0.001, Math.hypot(dx, dy));
  defender.x += (dx / len) * defender.speed;
  defender.y += (dy / len) * defender.speed;

  defender.x = clamp(defender.x, field.margin, field.width - field.margin);
  defender.y = clamp(defender.y, field.margin, field.height - field.margin);

  defender.hitCooldownMs -= deltaMs;
  if (defender.hitCooldownMs <= 0) {
    const touchedPlayer = dist(defender.x, defender.y, player.x, player.y) < defender.r + player.r;
    const touchedBall = dist(defender.x, defender.y, ball.x, ball.y) < defender.r + ball.r;

    if (touchedPlayer || touchedBall) {
      state.hp -= 1;
      defender.hitCooldownMs = 1200;
      resetPositions();
    }
  }
}

function drawField() {
  ctx.clearRect(0, 0, field.width, field.height);

  ctx.fillStyle = '#2f8f3f';
  ctx.fillRect(0, 0, field.width, field.height);

  ctx.strokeStyle = '#e6f4ea';
  ctx.lineWidth = 3;
  ctx.strokeRect(field.margin, field.margin, field.width - field.margin * 2, field.height - field.margin * 2);

  ctx.beginPath();
  ctx.arc(field.width / 2, field.height / 2, 58, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#f8de5f';
  ctx.fillRect(goalZone.x, goalZone.y, goalZone.width, goalZone.height);

  ctx.fillStyle = '#163b1d';
  ctx.font = '14px sans-serif';
  ctx.fillText('GOAL +10', goalZone.x - 8, goalZone.y - 8);
}

function drawActors() {
  ctx.beginPath();
  ctx.fillStyle = '#1d4ed8';
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = '#dc2626';
  ctx.arc(defender.x, defender.y, defender.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = '#ffffff';
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawEndText() {
  if (state.running) return;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, field.width, field.height);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('GAME OVER', field.width / 2, field.height / 2 - 12);
  ctx.font = '24px sans-serif';
  ctx.fillText(`최종 점수: ${state.score}`, field.width / 2, field.height / 2 + 30);
  ctx.font = '18px sans-serif';
  ctx.fillText('R 키로 재시작', field.width / 2, field.height / 2 + 64);
  ctx.textAlign = 'start';
}

let lastTs = performance.now();

function gameLoop(ts) {
  const deltaMs = ts - lastTs;
  lastTs = ts;

  if (state.running) {
    state.timeLeft -= deltaMs / 1000;
    updatePlayer();
    updateBall();
    updateDefender(deltaMs);

    if (state.hp <= 0 || state.timeLeft <= 0) {
      state.running = false;
      state.timeLeft = Math.max(0, state.timeLeft);
    }
  }

  syncHud();
  drawField();
  drawActors();
  drawEndText();

  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  state.keys.add(key);

  if (key === ' ' || key === 'Spacebar') {
    event.preventDefault();
    kickBall();
  }

  if (key === 'r') {
    restartGame();
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  state.keys.delete(key);
});

syncHud();
requestAnimationFrame(gameLoop);
