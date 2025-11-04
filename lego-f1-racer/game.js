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
const CAR_LENGTH = 90;
const CAR_WIDTH = 60;
const VIEW_DISTANCE = 1200; // 화면에서 보여줄 거리

const inputState = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

const driverPalette = [
  { name: '이상훈', color: '#ef4444' },
  { name: '김다연', color: '#3b82f6' },
  { name: '박우진', color: '#facc15' },
  { name: '최미소', color: '#22c55e' },
];

const players = [
  {
    id: 'player',
    name: '나의 브릭카',
    color: '#f97316',
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
  ...driverPalette.map((driver, index) => ({
    id: `ai-${index}`,
    name: `${driver.name}`,
    color: driver.color,
    lane: index,
    targetLane: index,
    x: laneToX(index),
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

let raceState = {
  finished: false,
  finishOrder: [],
  startTime: null,
  lastTimestamp: 0,
};

function laneToX(lane) {
  return TRACK_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
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

  raceState = {
    finished: false,
    finishOrder: [],
    startTime: performance.now(),
    lastTimestamp: 0,
  };

  finishBanner.classList.add('hidden');
  finishSummary.textContent = '';
}

function handleInput(event, isKeyDown) {
  if (event.key in inputState) {
    inputState[event.key] = isKeyDown;
  }

  if (event.type === 'keydown') {
    if (event.key === 'r' || event.key === 'R') {
      resetRace();
    }
    if (event.key === 'ArrowLeft') {
      const player = players[0];
      player.targetLane = Math.max(0, player.targetLane - 1);
    }
    if (event.key === 'ArrowRight') {
      const player = players[0];
      player.targetLane = Math.min(LANE_COUNT - 1, player.targetLane + 1);
    }
  }
}

document.addEventListener('keydown', (event) => handleInput(event, true));
document.addEventListener('keyup', (event) => handleInput(event, false));
restartBtn.addEventListener('click', resetRace);

function update(dt) {
  const player = players[0];

  if (!raceState.startTime) {
    raceState.startTime = performance.now();
  }

  if (raceState.finished) {
    return;
  }

  updatePlayer(player, dt);
  players.slice(1).forEach((driver) => updateAI(driver, dt, player));

  players.forEach((driver) => {
    if (!driver.finished && driver.progress >= TRACK_LENGTH * TOTAL_LAPS) {
      driver.finished = true;
      driver.finishTime = performance.now() - raceState.startTime;
      raceState.finishOrder.push(driver);

      if (driver.isPlayer) {
        raceState.finished = true;
        showFinishBanner();
      }
    }
  });

  updateUI();
}

function updatePlayer(driver, dt) {
  const accelFactor = inputState.ArrowUp ? driver.accel : 0;
  const brakeFactor = inputState.ArrowDown ? driver.grip : 0;
  const friction = 40;

  driver.speed += (accelFactor - brakeFactor - friction) * dt;
  driver.speed = Math.max(0, Math.min(driver.speed, driver.topSpeed));

  driver.progress += driver.speed * dt;

  if (driver.progress < TRACK_LENGTH) {
    driver.lap = 1;
  } else {
    driver.lap = TOTAL_LAPS;
  }

  const targetX = laneToX(driver.targetLane);
  const moveStrength = 12 * dt;
  driver.x += (targetX - driver.x) * moveStrength;

  // 간단한 충돌 처리
  players.slice(1).forEach((ai) => {
    if (checkCollision(driver, ai)) {
      driver.speed *= 0.5;
      driver.progress -= 40 * dt;
      ai.speed *= 0.7;
    }
  });
}

function updateAI(driver, dt, player) {
  if (driver.finished) {
    return;
  }

  const targetSpeed = driver.baseSpeed + Math.sin(performance.now() / 600 + driver.progress) * 10;
  const speedDifference = targetSpeed - driver.speed;
  const maxAcceleration = driver.accel * dt;

  driver.speed += Math.max(-maxAcceleration, Math.min(maxAcceleration, speedDifference));
  driver.speed = Math.max(150, Math.min(driver.speed, driver.baseSpeed + 25));
  driver.progress += driver.speed * dt;

  if (driver.progress < TRACK_LENGTH) {
    driver.lap = 1;
  } else {
    driver.lap = TOTAL_LAPS;
  }

  const relativeDistance = driver.progress - player.progress;
  if (relativeDistance > -200 && relativeDistance < 120) {
    if (Math.abs(driver.lane - player.targetLane) <= 1) {
      if (Math.random() < 0.02) {
        const direction = driver.lane <= player.targetLane ? -1 : 1;
        const newLane = driver.lane + direction;
        if (newLane >= 0 && newLane < LANE_COUNT) {
          driver.lane = newLane;
          driver.targetLane = newLane;
        }
      }
    }
  }

  const targetX = laneToX(driver.targetLane);
  const moveStrength = 8 * dt;
  driver.x += (targetX - driver.x) * moveStrength;
}

function checkCollision(player, opponent) {
  const laneThreshold = LANE_WIDTH * 0.45;
  const distanceThreshold = CAR_LENGTH * 0.7;
  const laneClose = Math.abs(player.x - opponent.x) < laneThreshold;
  const progressDiff = Math.abs(player.progress - opponent.progress);
  return laneClose && progressDiff < distanceThreshold;
}

function render(timestamp) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTrack();
  drawDrivers(timestamp);
}

function drawTrack() {
  const laneMarkWidth = 12;
  ctx.save();
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#364152';
  ctx.fillRect(TRACK_LEFT, 0, LANE_COUNT * LANE_WIDTH, canvas.height);

  const playerProgress = players[0].progress;
  const patternHeight = 40;
  const offset = (playerProgress % patternHeight) * 0.5;

  for (let y = -patternHeight; y < canvas.height + patternHeight; y += patternHeight) {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const brickX = TRACK_LEFT + lane * LANE_WIDTH + 18;
      const brickY = y + offset;
      const isEven = (lane + Math.floor((y + playerProgress / 5) / patternHeight)) % 2 === 0;
      ctx.fillStyle = isEven ? 'rgba(30, 41, 59, 0.35)' : 'rgba(51, 65, 85, 0.35)';
      ctx.fillRect(brickX, brickY, LANE_WIDTH - 36, patternHeight - 10);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.fillRect(brickX + 6, brickY + 6, LANE_WIDTH - 48, patternHeight - 22);
    }
  }

  ctx.setLineDash([20, 20]);
  ctx.lineWidth = laneMarkWidth;
  ctx.strokeStyle = '#e2e8f0';
  for (let lane = 1; lane < LANE_COUNT; lane++) {
    const x = TRACK_LEFT + lane * LANE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x, -20);
    ctx.lineTo(x, canvas.height + 20);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const playerProgressRatio = players[0].progress / (TRACK_LENGTH * TOTAL_LAPS);
  ctx.fillStyle = '#111827';
  ctx.fillRect(32, 32, 220, 10);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(32, 32, 220 * Math.min(playerProgressRatio, 1), 10);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.fillText('결승선까지', 32, 24);

  const player = players[0];
  const finishDistance = TRACK_LENGTH * TOTAL_LAPS - player.progress;
  if (finishDistance < 200) {
    const finishY = (finishDistance / VIEW_DISTANCE) * canvas.height;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(TRACK_LEFT, finishY, LANE_COUNT * LANE_WIDTH, 30);
    ctx.fillStyle = '#e11d48';
    const stripeWidth = 20;
    for (let x = TRACK_LEFT; x < TRACK_LEFT + LANE_COUNT * LANE_WIDTH; x += stripeWidth) {
      ctx.fillStyle = (Math.floor(x / stripeWidth) % 2 === 0) ? '#e11d48' : '#f8fafc';
      ctx.fillRect(x, finishY, stripeWidth, 30);
    }
  }

  ctx.restore();
}

function drawDrivers(timestamp) {
  const player = players[0];

  players.forEach((driver) => {
    const relativeDistance = driver.progress - player.progress;

    if (driver.isPlayer) {
      drawCar(driver, canvas.height - 120, timestamp, true);
      return;
    }

    if (relativeDistance < -160 || relativeDistance > VIEW_DISTANCE) {
      return;
    }

    const viewScale = 1 - relativeDistance / VIEW_DISTANCE;
    const y = canvas.height - relativeDistance * 0.4 - 160;
    drawCar(driver, y, timestamp, false, viewScale);
  });
}

function drawCar(driver, y, timestamp, isPlayer, scale = 1) {
  const carWidth = CAR_WIDTH * scale;
  const carLength = CAR_LENGTH * scale;
  const x = driver.x - carWidth / 2;

  ctx.save();
  ctx.translate(x + carWidth / 2, y + carLength / 2);
  ctx.rotate((Math.sin(timestamp / 200 + driver.progress / 100) * 2 * Math.PI) / 180 * (isPlayer ? 1 : 0.4));
  ctx.translate(-(x + carWidth / 2), -(y + carLength / 2));

  ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
  ctx.fillRect(x + 8 * scale, y + carLength - 6 * scale, carWidth - 16 * scale, 12 * scale);

  ctx.fillStyle = driver.color;
  ctx.fillRect(x, y, carWidth, carLength);

  ctx.fillStyle = shadeColor(driver.color, -20);
  ctx.fillRect(x + carWidth * 0.15, y + carLength * 0.1, carWidth * 0.7, carLength * 0.4);

  ctx.fillStyle = shadeColor(driver.color, 20);
  ctx.fillRect(x + carWidth * 0.2, y + carLength * 0.55, carWidth * 0.6, carLength * 0.3);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + carWidth * 0.3, y + carLength * 0.15, carWidth * 0.4, carLength * 0.25);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x + carWidth * 0.3, y + carLength * 0.05, carWidth * 0.4, carLength * 0.07);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x + carWidth * 0.1, y + carLength * 0.82, carWidth * 0.2, carLength * 0.15);
  ctx.fillRect(x + carWidth * 0.7, y + carLength * 0.82, carWidth * 0.2, carLength * 0.15);

  ctx.restore();
}

function shadeColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const r = (num >> 16) + amt;
  const g = ((num >> 8) & 0x00ff) + amt;
  const b = (num & 0x0000ff) + amt;
  return (
    '#' +
    (0x1000000 +
      (r < 255 ? (r < 1 ? 0 : r) : 255) * 0x10000 +
      (g < 255 ? (g < 1 ? 0 : g) : 255) * 0x100 +
      (b < 255 ? (b < 1 ? 0 : b) : 255))
      .toString(16)
      .slice(1)
  );
}

function updateUI() {
  const player = players[0];
  const speedKm = Math.round(player.speed);
  speedDisplay.textContent = speedKm;
  rankDisplay.textContent = getPlayerRank();
  lapDisplay.textContent = `${player.lap} / ${TOTAL_LAPS}`;

  const sorted = [...players].sort((a, b) => b.progress - a.progress);
  positionList.innerHTML = '';
  sorted.forEach((driver, index) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${index + 1}.</span> ${driver.name}`;
    if (driver.isPlayer) {
      li.classList.add('player-entry');
    }
    positionList.appendChild(li);
  });
}

function getPlayerRank() {
  const player = players[0];
  const sorted = [...players].sort((a, b) => b.progress - a.progress);
  return sorted.findIndex((driver) => driver.id === player.id) + 1;
}

function showFinishBanner() {
  finishBanner.classList.remove('hidden');
  const ordered = raceState.finishOrder
    .map((driver, index) => `${index + 1}위 ${driver.name}`)
    .join('<br />');
  finishSummary.innerHTML = `완주 순위<br />${ordered}`;
}

function gameLoop(timestamp) {
  if (!raceState.lastTimestamp) {
    raceState.lastTimestamp = timestamp;
  }
  const dt = (timestamp - raceState.lastTimestamp) / 1000;
  raceState.lastTimestamp = timestamp;

  update(dt);
  render(timestamp);

  requestAnimationFrame(gameLoop);
}

resetRace();
requestAnimationFrame(gameLoop);
