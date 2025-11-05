const TRACK_LENGTH = 3200; // 가상 거리 단위
const TOTAL_LAPS = 1;
const LANE_COUNT = 4;
const LANE_WIDTH = 90;
const CAR_LENGTH = 90;
const CAR_WIDTH = 60;
const VIEW_DISTANCE = 1200; // 화면 표시 거리
const BASE_FRICTION = 40;

let canvas;
let ctx;
let speedDisplay;
let lapDisplay;
let rankDisplay;
let positionList;
let finishBanner;
let finishSummary;
let restartBtn;
let TRACK_LEFT = 0;

const inputState = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

// --- 차량 팔레트 / 디자인 정보 ---
const aiDrivers = [
  {
    name: '이상훈',
    design: {
      base: '#ef4444',
      accent: '#f97316',
      stripe: '#fee2e2',
      wing: '#111827',
      studs: '#fecaca',
      halo: '#0f172a',
      number: '22',
    },
  },
  {
    name: '김다연',
    design: {
      base: '#2563eb',
      accent: '#38bdf8',
      stripe: '#f8fafc',
      wing: '#0f172a',
      studs: '#dbeafe',
      halo: '#1e293b',
      number: '37',
    },
  },
  {
    name: '박우진',
    design: {
      base: '#facc15',
      accent: '#f97316',
      stripe: '#fef3c7',
      wing: '#0f172a',
      studs: '#fde68a',
      halo: '#1f2937',
      number: '64',
    },
  },
  {
    name: '최미소',
    design: {
      base: '#22c55e',
      accent: '#34d399',
      stripe: '#ecfccb',
      wing: '#0f172a',
      studs: '#bbf7d0',
      halo: '#052e16',
      number: '88',
    },
  },
];

const players = [];
let raceState = { finished: false, finishOrder: [], startTime: null, lastTimestamp: 0 };

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

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

function getTrackOffset(progress) {
  const ratio = ((progress % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH / TRACK_LENGTH;
  for (const seg of trackSegments) {
    if (ratio >= seg.start && ratio < seg.end) {
      const segmentT = (ratio - seg.start) / (seg.end - seg.start);
      return seg.from + (seg.to - seg.from) * easeInOut(segmentT);
    }
  }
  return 0;
}

function laneToX(lane) {
  return TRACK_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
}

function initializePlayers() {
  TRACK_LEFT = (canvas.width - LANE_COUNT * LANE_WIDTH) / 2;
  players.length = 0;

  players.push({
    id: 'player',
    name: '나의 브릭카',
    design: {
      base: '#f97316',
      accent: '#facc15',
      stripe: '#fef3c7',
      wing: '#111827',
      studs: '#fde68a',
      halo: '#0f172a',
      number: '01',
    },
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
  });

  aiDrivers.forEach((driver, i) => {
    const lane = Math.min(i, LANE_COUNT - 1);
    players.push({
      id: `ai-${i}`,
      name: driver.name,
      design: driver.design,
      lane,
      targetLane: lane,
      x: laneToX(lane),
      speed: 0,
      baseSpeed: 180 + Math.random() * 20,
      accel: 110,
      grip: 120,
      progress: 0,
      lap: 1,
      finished: false,
      finishTime: null,
      isPlayer: false,
    });
  });
}

function ensureElements() {
  canvas = document.getElementById('raceCanvas');
  speedDisplay = document.getElementById('speedDisplay');
  lapDisplay = document.getElementById('lapDisplay');
  rankDisplay = document.getElementById('rankDisplay');
  positionList = document.getElementById('positionList');
  finishBanner = document.getElementById('finishBanner');
  finishSummary = document.getElementById('finishSummary');
  restartBtn = document.getElementById('restartBtn');

  if (!canvas) {
    console.error('raceCanvas 요소를 찾을 수 없습니다. HTML 구조를 확인하세요.');
    return false;
  }

  ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('캔버스 컨텍스트를 초기화할 수 없습니다. 브라우저가 Canvas를 지원하는지 확인하세요.');
    return false;
  }

  const requiredElements = [speedDisplay, lapDisplay, rankDisplay, positionList, finishBanner, finishSummary];
  if (requiredElements.some((el) => !el)) {
    console.error('UI 요소를 찾을 수 없습니다. HTML id를 확인하세요.');
    return false;
  }

  if (!restartBtn) {
    console.warn('restartBtn 요소를 찾을 수 없습니다. 다시 달리기 버튼이 비활성화됩니다.');
  }

  return true;
}

let eventsBound = false;

function bindEvents() {
  if (eventsBound) return;
  document.addEventListener('keydown', (e) => handleInput(e, true));
  document.addEventListener('keyup', (e) => handleInput(e, false));
  if (restartBtn) {
    restartBtn.addEventListener('click', resetRace);
  }
  eventsBound = true;
}

function handleInput(e, isDown) {
  if (e.key in inputState) inputState[e.key] = isDown;
  if (e.type === 'keydown') {
    if (e.key === 'r' || e.key === 'R') resetRace();
    if (e.key === 'ArrowLeft') players[0].targetLane = Math.max(0, players[0].targetLane - 1);
    if (e.key === 'ArrowRight') players[0].targetLane = Math.min(LANE_COUNT - 1, players[0].targetLane + 1);
  }
}

function resetRace() {
  players.forEach((driver, index) => {
    driver.progress = 0;
    driver.speed = 0;
    driver.lap = 1;
    driver.finished = false;
    driver.finishTime = null;
    driver.lane = Math.min(index, LANE_COUNT - 1);
    driver.targetLane = driver.lane;
    driver.x = laneToX(driver.lane);
  });
  raceState = { finished: false, finishOrder: [], startTime: performance.now(), lastTimestamp: 0 };
  finishBanner.classList.add('hidden');
  finishSummary.textContent = '';
}

function handleInputFrame(player, dt) {
  const accel = inputState.ArrowUp ? player.accel : 0;
  const brake = inputState.ArrowDown ? player.grip : 0;
  player.speed += (accel - brake - BASE_FRICTION) * dt;
  player.speed = Math.max(0, Math.min(player.speed, player.topSpeed));
  player.progress += player.speed * dt;
  player.lap = player.progress < TRACK_LENGTH ? 1 : TOTAL_LAPS;
  const targetX = laneToX(player.targetLane);
  player.x += (targetX - player.x) * (12 * dt);

  players.slice(1).forEach((ai) => {
    if (checkCollision(player, ai)) {
      player.speed *= 0.5;
      ai.speed *= 0.7;
    }
  });
}

function updateAI(driver, dt, player) {
  if (driver.finished) return;
  const targetSpeed = driver.baseSpeed + Math.sin(performance.now() / 600 + driver.progress) * 10;
  const diff = targetSpeed - driver.speed;
  driver.speed += Math.max(-driver.accel * dt, Math.min(driver.accel * dt, diff));
  driver.speed = Math.max(150, Math.min(driver.speed, driver.baseSpeed + 25));
  driver.progress += driver.speed * dt;
  driver.lap = driver.progress < TRACK_LENGTH ? 1 : TOTAL_LAPS;

  const relativeDistance = driver.progress - player.progress;
  if (
    relativeDistance > -200 &&
    relativeDistance < 120 &&
    Math.abs(driver.lane - player.targetLane) <= 1 &&
    Math.random() < 0.02
  ) {
    const direction = driver.lane <= player.targetLane ? -1 : 1;
    const newLane = driver.lane + direction;
    if (newLane >= 0 && newLane < LANE_COUNT) driver.lane = driver.targetLane = newLane;
  }

  const targetX = laneToX(driver.targetLane);
  driver.x += (targetX - driver.x) * (8 * dt);
}

function checkCollision(player, opponent) {
  const laneClose = Math.abs(player.x - opponent.x) < LANE_WIDTH * 0.45;
  const progressDiff = Math.abs(player.progress - opponent.progress);
  return laneClose && progressDiff < CAR_LENGTH * 0.7;
}

function update(dt) {
  if (!raceState.startTime) raceState.startTime = performance.now();
  if (raceState.finished) return;

  const player = players[0];
  handleInputFrame(player, dt);
  players.slice(1).forEach((driver) => updateAI(driver, dt, player));

  players.forEach((driver) => {
    if (!driver.finished && driver.progress >= TRACK_LENGTH * TOTAL_LAPS) {
      driver.finished = true;
      driver.finishTime = performance.now() - raceState.startTime;
      raceState.finishOrder.push(driver);
      if (driver.isPlayer) {
        raceState.finished = true;
        finalizeFinishOrder();
        showFinishBanner();
      }
    }
  });

  updateUI();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTrack();
  drawCars();
}

function drawTrack() {
  ctx.save();
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const standHeight = 80;
  const standGrad = ctx.createLinearGradient(0, 0, 0, standHeight);
  standGrad.addColorStop(0, 'rgba(30,41,59,0.9)');
  standGrad.addColorStop(1, 'rgba(15,23,42,0.3)');
  ctx.fillStyle = standGrad;
  ctx.fillRect(0, 0, canvas.width, standHeight);
  ctx.fillRect(0, canvas.height - standHeight, canvas.width, standHeight);

  const bannerColors = ['#f97316', '#38bdf8', '#a855f7', '#facc15'];
  bannerColors.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(index * (canvas.width / bannerColors.length), standHeight - 10, canvas.width / bannerColors.length - 8, 6);
  });

  ctx.restore();
}

function drawCars() {
  const player = players[0];
  players.forEach((driver) => {
    const relativeProgress = driver.progress - player.progress;
    if (relativeProgress < -200 || relativeProgress > VIEW_DISTANCE) return;
    const y = canvas.height - relativeProgress * 0.4 - 160;
    const scale = Math.max(0.3, 1 - relativeProgress / VIEW_DISTANCE);
    drawCar(driver, y, scale);
  });
}

function drawCar(driver, y, scale = 1) {
  const { base, accent, stripe, wing, studs, halo, number } = driver.design;
  const carW = CAR_WIDTH * scale;
  const carL = CAR_LENGTH * scale;
  const x = driver.x - carW / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(8,15,26,0.45)';
  ctx.beginPath();
  ctx.ellipse(driver.x, y + carL * 0.94, carW * 0.46, carL * 0.18, 0, 0, Math.PI * 2);
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
  for (let i = 0; i < 3; i += 1) {
    const studX = x + carW * (0.25 + i * 0.25);
    ctx.fillStyle = studs;
    ctx.beginPath();
    ctx.arc(studX, y + carL * 0.36, studR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = `${Math.max(8, 12 * scale)}px 'Pretendard', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(number, driver.x, y + carL * 0.78);
  ctx.restore();
}

function updateUI() {
  const player = players[0];
  speedDisplay.textContent = Math.round(player.speed);
  rankDisplay.textContent = getPlayerRank();
  lapDisplay.textContent = `${player.lap} / ${TOTAL_LAPS}`;

  const sorted = [...players].sort((a, b) => b.progress - a.progress);
  positionList.innerHTML = '';
  sorted.forEach((driver, index) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="pos-rank">${index + 1}</span>
      <span class="pos-driver"><span class="pos-chip" style="background:${driver.design.base}"></span>${driver.name}</span>`;
    if (driver.isPlayer) li.classList.add('player-entry');
    positionList.appendChild(li);
  });
}

function getPlayerRank() {
  const player = players[0];
  return (
    [...players]
      .sort((a, b) => b.progress - a.progress)
      .findIndex((driver) => driver.id === player.id) + 1
  );
}

function showFinishBanner() {
  finishBanner.classList.remove('hidden');
  const ordered = raceState.finishOrder
    .map(
      (driver, index) =>
        `<span class="finish-line"><span class="finish-chip" style="background:${driver.design.base}"></span>${index + 1}위 ${driver.name} (#${driver.design.number})</span>`
    )
    .join('');
  finishSummary.innerHTML = `<strong class="finish-title">완주 순위</strong>${ordered}`;
}

function finalizeFinishOrder() {
  const finishedSet = new Set(raceState.finishOrder.map((driver) => driver.id));
  const remaining = players.filter((driver) => !finishedSet.has(driver.id));

  remaining.sort((a, b) => {
    const aFinished = a.finished ? a.finishTime ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
    const bFinished = b.finished ? b.finishTime ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
    if (aFinished !== bFinished) return aFinished - bFinished;
    return b.progress - a.progress;
  });

  raceState.finishOrder = [...raceState.finishOrder, ...remaining];
}

function gameLoop(timestamp) {
  if (!raceState.lastTimestamp) raceState.lastTimestamp = timestamp;
  const dt = (timestamp - raceState.lastTimestamp) / 1000;
  raceState.lastTimestamp = timestamp;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function initGame() {
  if (!ensureElements()) return;
  initializePlayers();
  raceState = { finished: false, finishOrder: [], startTime: null, lastTimestamp: 0 };
  bindEvents();
  resetRace();
  requestAnimationFrame(gameLoop);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
