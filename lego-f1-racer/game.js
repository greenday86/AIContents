const canvas = document.getElementById('raceCanvas');
const ctx = canvas.getContext('2d');

const speedDisplay = document.getElementById('speedDisplay');
const lapDisplay = document.getElementById('lapDisplay');
const rankDisplay = document.getElementById('rankDisplay');
const positionList = document.getElementById('positionList');
const finishBanner = document.getElementById('finishBanner');
const finishSummary = document.getElementById('finishSummary');
const restartBtn = document.getElementById('restartBtn');

const TRACK_LENGTH = 3200; // 가상 거리 단위
const TOTAL_LAPS = 1;
const LANE_COUNT = 4;
const LANE_WIDTH = 90;
const TRACK_LEFT = (canvas.width - LANE_COUNT * LANE_WIDTH) / 2;
const TRACK_WIDTH = LANE_COUNT * LANE_WIDTH;
const CAR_LENGTH = 90;
const CAR_WIDTH = 60;
const VIEW_DISTANCE = 1200; // 화면 표시 거리

const inputState = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

// --- 차량 팔레트 / 디자인 정보 ---
const aiDrivers = [
  {
    name: '이상훈',
    design: { base: '#ef4444', accent: '#f97316', stripe: '#fee2e2', wing: '#111827', studs: '#fecaca', halo: '#0f172a', number: '22' },
  },
  {
    name: '김다연',
    design: { base: '#2563eb', accent: '#38bdf8', stripe: '#f8fafc', wing: '#0f172a', studs: '#dbeafe', halo: '#1e293b', number: '37' },
  },
  {
    name: '박우진',
    design: { base: '#facc15', accent: '#f97316', stripe: '#fef3c7', wing: '#0f172a', studs: '#fde68a', halo: '#1f2937', number: '64' },
  },
  {
    name: '최미소',
    design: { base: '#22c55e', accent: '#34d399', stripe: '#ecfccb', wing: '#0f172a', studs: '#bbf7d0', halo: '#052e16', number: '88' },
  },
];

function laneToX(lane) {
  return TRACK_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
}

const players = [
  {
    id: 'player',
    name: '나의 브릭카',
    design: { base: '#f97316', accent: '#facc15', stripe: '#fef3c7', wing: '#111827', studs: '#fde68a', halo: '#0f172a', number: '01' },
    lane: 1,
    targetLane: 1,
    x: laneToX(1),
    speed: 0,
    topSpeed: 235,
    accel: 160,
    grip: 130,
    progress: 0,
    lap: 1,
    finished: false,
    finishTime: null,
    isPlayer: true,
  },
  ...aiDrivers.map((driver, i) => ({
    id: `ai-${i}`,
    name: driver.name,
    design: driver.design,
    lane: i,
    targetLane: i,
    x: laneToX(i),
    speed: 0,
    baseSpeed: 180 + Math.random() * 20,
    accel: 110,
    grip: 120,
    progress: 0,
    lap: 1,
    finished: false,
    finishTime: null,
    isPlayer: false,
  })),
];

let raceState = { finished: false, finishOrder: [], startTime: null, lastTimestamp: 0 };

// --- 곡선형 트랙 (codex 기반) ---
const trackSegments = [
  { start: 0, end: 0.12, from: 0, to: -140 },
  { start: 0.12, end: 0.26, from: -140, to: -180 },
  { start: 0.26, end: 0.42, from: -180, to: 150 },
  { start: 0.42, end: 0.58, from: 150, to: 60 },
  { start: 0.58, end: 0.72, from: 60, to: -160 },
  { start: 0.72, end: 0.86, from: -160, to: 210 },
  { start: 0.86, end: 0.96, from: 210, to: -60 },
  { start: 0.96, end: 1, from: -60, to: 0 },
];
function easeInOut(t) { return t * t * (3 - 2 * t); }
function getTrackOffset(progress) {
  const ratio = ((progress % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH / TRACK_LENGTH;
  for (const seg of trackSegments) {
    if (ratio >= seg.start && ratio < seg.end) {
      const t = (ratio - seg.start) / (seg.end - seg.start);
      return seg.from + (seg.to - seg.from) * easeInOut(t);
    }
  }
  return 0;
}
function getTrackCenter(progress) { return canvas.width / 2 + getTrackOffset(progress); }

// --- 기본 로직 ---
function resetRace() {
  players.forEach((d, i) => {
    d.progress = 0; d.speed = 0; d.lap = 1; d.finished = false; d.finishTime = null;
    d.lane = Math.min(i, LANE_COUNT - 1); d.targetLane = d.lane; d.x = laneToX(d.lane);
  });
  raceState = { finished: false, finishOrder: [], startTime: performance.now(), lastTimestamp: 0 };
  finishBanner.classList.add('hidden');
  finishSummary.textContent = '';
}

function handleInput(e, isDown) {
  if (e.key in inputState) inputState[e.key] = isDown;
  if (e.type === 'keydown') {
    if (e.key === 'r' || e.key === 'R') resetRace();
    if (e.key === 'ArrowLeft') players[0].targetLane = Math.max(0, players[0].targetLane - 1);
    if (e.key === 'ArrowRight') players[0].targetLane = Math.min(LANE_COUNT - 1, players[0].targetLane + 1);
  }
}

document.addEventListener('keydown', (e) => handleInput(e, true));
document.addEventListener('keyup', (e) => handleInput(e, false));
restartBtn.addEventListener('click', resetRace);

// --- 업데이트 루프 ---
function update(dt) {
  const player = players[0];
  if (!raceState.startTime) raceState.startTime = performance.now();
  if (raceState.finished) return;

  updatePlayer(player, dt);
  players.slice(1).forEach((d) => updateAI(d, dt, player));

  players.forEach((d) => {
    if (!d.finished && d.progress >= TRACK_LENGTH * TOTAL_LAPS) {
      d.finished = true;
      d.finishTime = performance.now() - raceState.startTime;
      raceState.finishOrder.push(d);
      if (d.isPlayer) { raceState.finished = true; showFinishBanner(); }
    }
  });

  updateUI();
}

function updatePlayer(d, dt) {
  const accel = inputState.ArrowUp ? d.accel : 0;
  const brake = inputState.ArrowDown ? d.grip : 0;
  d.speed += (accel - brake - 40) * dt;
  d.speed = Math.max(0, Math.min(d.speed, d.topSpeed));
  d.progress += d.speed * dt;
  d.lap = d.progress < TRACK_LENGTH ? 1 : TOTAL_LAPS;
  const targetX = laneToX(d.targetLane);
  d.x += (targetX - d.x) * (12 * dt);

  // 간단한 충돌 처리
  players.slice(1).forEach((ai) => {
    if (checkCollision(d, ai)) {
      d.speed *= 0.5;
      ai.speed *= 0.7;
    }
  });
}

function updateAI(d, dt, player) {
  if (d.finished) return;
  const targetSpeed = d.baseSpeed + Math.sin(performance.now() / 600 + d.progress) * 10;
  const diff = targetSpeed - d.speed;
  d.speed += Math.max(-d.accel * dt, Math.min(d.accel * dt, diff));
  d.speed = Math.max(150, Math.min(d.speed, d.baseSpeed + 25));
  d.progress += d.speed * dt;
  d.lap = d.progress < TRACK_LENGTH ? 1 : TOTAL_LAPS;

  const rel = d.progress - player.progress;
  if (rel > -200 && rel < 120 && Math.abs(d.lane - player.targetLane) <= 1 && Math.random() < 0.02) {
    const dir = d.lane <= player.targetLane ? -1 : 1;
    const newLane = d.lane + dir;
    if (newLane >= 0 && newLane < LANE_COUNT) d.lane = d.targetLane = newLane;
  }

  const targetX = laneToX(d.targetLane);
  d.x += (targetX - d.x) * (8 * dt);
}

function checkCollision(p, o) {
  const laneClose = Math.abs(p.x - o.x) < LANE_WIDTH * 0.45;
  const progressDiff = Math.abs(p.progress - o.progress);
  return laneClose && progressDiff < CAR_LENGTH * 0.7;
}

// --- 렌더링 ---
function render(ts) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTrack(ts);
  drawCars(ts);
}

function drawTrack(ts) {
  ctx.save();
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const player = players[0];

  const standHeight = 80;
  const standGrad = ctx.createLinearGradient(0, 0, 0, standHeight);
  standGrad.addColorStop(0, 'rgba(30,41,59,0.9)');
  standGrad.addColorStop(1, 'rgba(15,23,42,0.3)');
  ctx.fillStyle = standGrad;
  ctx.fillRect(0, 0, canvas.width, standHeight);
  ctx.fillRect(0, canvas.height - standHeight, canvas.width, standHeight);

  const bannerColors = ['#f97316', '#38bdf8', '#a855f7', '#facc15'];
  bannerColors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * (canvas.width / bannerColors.length), standHeight - 10, canvas.width / bannerColors.length - 8, 6);
  });

  ctx.restore();
}

function drawCars(ts) {
  const player = players[0];
  players.forEach((d) => {
    const rel = d.progress - player.progress;
    if (rel < -200 || rel > VIEW_DISTANCE) return;
    const y = canvas.height - rel * 0.4 - 160;
    const scale = Math.max(0.3, 1 - rel / VIEW_DISTANCE);
    drawCar(d, y, ts, d.isPlayer, scale);
  });
}

function drawCar(d, y, ts, isPlayer, scale = 1) {
  const { base, accent, stripe, wing, studs, halo, number } = d.design;
  const carW = CAR_WIDTH * scale;
  const carL = CAR_LENGTH * scale;
  const x = d.x - carW / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(8,15,26,0.45)';
  ctx.beginPath();
  ctx.ellipse(d.x, y + carL * 0.94, carW * 0.46, carL * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = wing;
  ctx.fillRect(x - carW * 0.1, y + carL * 0.05, carW * 1.2, carL * 0.08);
  ctx.fillRect(x - carW * 0.1, y + carL * 0.86, carW * 1.2, carL * 0.1);

  ctx.fillStyle = base;
  ctx.fillRect(x, y, carW, carL);
  ctx.fillStyle = accent;
  ctx.fillRect(x + carW * 0.14, y + carL * 0.58, carW * 0.72, carL * 0.22);
  ctx.fillStyle = stripe;
  ctx.fillRect(x + carW * 0.2, y + carL * 0.68, carW * 0.6, carL * 0.06);

  ctx.fillStyle = halo;
  ctx.fillRect(x + carW * 0.26, y + carL * 0.18, carW * 0.48, carL * 0.18);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x + carW * 0.3, y + carL * 0.12, carW * 0.4, carL * 0.06);

  const studR = carW * 0.08;
  for (let i = 0; i < 3; i++) {
    const sx = x + carW * (0.25 + i * 0.25);
    ctx.fillStyle = studs;
    ctx.beginPath();
    ctx.arc(sx, y + carL * 0.36, studR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = `${Math.max(8, 12 * scale)}px 'Pretendard', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(number, d.x, y + carL * 0.78);
  ctx.restore();
}

// --- UI 업데이트 ---
function updateUI() {
  const p = players[0];
  speedDisplay.textContent = Math.round(p.speed);
  rankDisplay.textContent = getPlayerRank();
  lapDisplay.textContent = `${p.lap} / ${TOTAL_LAPS}`;

  const sorted = [...players].sort((a, b) => b.progress - a.progress);
  positionList.innerHTML = '';
  sorted.forEach((d, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="pos-rank">${i + 1}</span> 
      <span class="pos-driver"><span class="pos-chip" style="background:${d.design.base}"></span>${d.name}</span>`;
    if (d.isPlayer) li.classList.add('player-entry');
    positionList.appendChild(li);
  });
}

function getPlayerRank() {
  const player = players[0];
  return [...players].sort((a, b) => b.progress - a.progress)
    .findIndex((d) => d.id === player.id) + 1;
}

function showFinishBanner() {
  finishBanner.classList.remove('hidden');
  const ordered = raceState.finishOrder
    .map((d, i) => `<span class="finish-line"><span class="finish-chip" style="background:${d.design.base}"></span>${i + 1}위 ${d.name} (#${d.design.number})</span>`)
    .join('');
  finishSummary.innerHTML = `<strong class="finish-title">완주 순위</strong>${ordered}`;
}

// --- 루프 ---
function gameLoop(ts) {
  if (!raceState.lastTimestamp) raceState.lastTimestamp = ts;
  const dt = (ts - raceState.lastTimestamp) / 1000;
  raceState.lastTimestamp = ts;
  update(dt);
  render(ts);
  requestAnimationFrame(gameLoop);
}

resetRace();
requestAnimationFrame(gameLoop);
