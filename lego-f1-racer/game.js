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
const TRACK_WIDTH = LANE_COUNT * LANE_WIDTH;
const CAR_LENGTH = 90;
const CAR_WIDTH = 60;
const VIEW_DISTANCE = 1200; // 화면에서 보여줄 거리

const inputState = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

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

const players = [
  {
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
    lanePosition: 1,
    targetLane: 1,
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
  ...aiDrivers.map((driver, index) => ({
    id: `ai-${index}`,
    name: driver.name,
    design: driver.design,
    lanePosition: Math.min(index, LANE_COUNT - 1),
    targetLane: Math.min(index, LANE_COUNT - 1),
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
  const normalized = ((progress % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
  const ratio = normalized / TRACK_LENGTH;

  for (const segment of trackSegments) {
    if (ratio >= segment.start && ratio < segment.end) {
      const localT = (ratio - segment.start) / (segment.end - segment.start);
      return segment.from + (segment.to - segment.from) * easeInOut(localT);
    }
  }

  return 0;
}

function getTrackCenter(progress) {
  return canvas.width / 2 + getTrackOffset(progress);
}

function getCarX(driver) {
  const laneOffset = (driver.lanePosition - (LANE_COUNT - 1) / 2) * LANE_WIDTH;
  return getTrackCenter(driver.progress) + laneOffset;
}

function resetRace() {
  players.forEach((driver, index) => {
    driver.progress = 0;
    driver.speed = 0;
    driver.lap = 1;
    driver.finished = false;
    driver.finishTime = null;
    const laneIndex = Math.min(index, LANE_COUNT - 1);
    driver.targetLane = laneIndex;
    driver.lanePosition = laneIndex;
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

  const moveStrength = 10 * dt;
  driver.lanePosition += (driver.targetLane - driver.lanePosition) * moveStrength;

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
  if (relativeDistance > -240 && relativeDistance < 160) {
    if (Math.abs(driver.lanePosition - player.lanePosition) <= 1.2) {
      if (Math.random() < 0.02) {
        const direction = driver.lanePosition <= player.lanePosition ? -1 : 1;
        const newLane = Math.round(driver.targetLane + direction);
        if (newLane >= 0 && newLane < LANE_COUNT) {
          driver.targetLane = newLane;
        }
      }
    }
  }

  const moveStrength = 7 * dt;
  driver.lanePosition += (driver.targetLane - driver.lanePosition) * moveStrength;
}

function checkCollision(player, opponent) {
  const laneThreshold = LANE_WIDTH * 0.6;
  const distanceThreshold = CAR_LENGTH * 0.7;
  const laneClose = Math.abs(getCarX(player) - getCarX(opponent)) < laneThreshold;
  const progressDiff = Math.abs(player.progress - opponent.progress);
  return laneClose && progressDiff < distanceThreshold;
}

function render(timestamp) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cameraCenter = getTrackCenter(players[0].progress);
  const cameraOffset = canvas.width / 2 - cameraCenter;
  drawTrack(cameraOffset);
  drawDrivers(timestamp, cameraOffset);
}

function drawTrack(cameraOffset) {
  const player = players[0];
  ctx.save();
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const standHeight = 90;
  const standGradient = ctx.createLinearGradient(0, 0, 0, standHeight);
  standGradient.addColorStop(0, 'rgba(30, 41, 59, 0.9)');
  standGradient.addColorStop(1, 'rgba(15, 23, 42, 0.2)');
  ctx.fillStyle = standGradient;
  ctx.fillRect(0, 0, canvas.width, standHeight);
  ctx.fillRect(0, canvas.height - standHeight, canvas.width, standHeight);

  const bannerColors = ['#f97316', '#38bdf8', '#a855f7', '#facc15'];
  bannerColors.forEach((color, index) => {
    ctx.fillStyle = color;
    const bannerWidth = canvas.width / bannerColors.length;
    const bannerX = index * bannerWidth;
    ctx.fillRect(bannerX, standHeight - 12, bannerWidth - 16, 8);
    ctx.fillRect(bannerX + 8, canvas.height - standHeight + 4, bannerWidth - 16, 8);
  });

  const bandHeight = 8;
  const kerbWidth = 28;
  const grassPadding = kerbWidth * 2 + 48;

  for (let y = 0; y < canvas.height; y += bandHeight) {
    const distanceRatio = 1 - y / canvas.height;
    const distanceAhead = distanceRatio * VIEW_DISTANCE;
    const sampleProgress = player.progress + distanceAhead;
    const trackCenter = getTrackCenter(sampleProgress) + cameraOffset;
    const trackLeft = trackCenter - TRACK_WIDTH / 2;
    const trackRight = trackCenter + TRACK_WIDTH / 2;
    const grassLeft = trackLeft - grassPadding;
    const grassWidth = TRACK_WIDTH + grassPadding * 2;

    const turfGradient = ctx.createLinearGradient(grassLeft, y, grassLeft + grassWidth, y);
    turfGradient.addColorStop(0, '#0b1f2f');
    turfGradient.addColorStop(0.45, '#065f46');
    turfGradient.addColorStop(0.55, '#047857');
    turfGradient.addColorStop(1, '#0b1f2f');
    ctx.fillStyle = turfGradient;
    ctx.fillRect(grassLeft, y, grassWidth, bandHeight);

    if (y % (bandHeight * 4) === 0) {
      for (let stud = 0; stud <= 6; stud++) {
        const studX = grassLeft + (stud / 6) * grassWidth;
        ctx.fillStyle = 'rgba(20, 184, 166, 0.18)';
        ctx.beginPath();
        ctx.arc(studX, y + bandHeight / 2, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const kerbPatternWidth = 12;
    for (let side = 0; side < 2; side++) {
      const startX = side === 0 ? trackLeft - kerbWidth : trackRight;
      for (let i = 0; i < Math.ceil(kerbWidth / kerbPatternWidth); i++) {
        const stripeWidth = Math.min(kerbPatternWidth, kerbWidth - i * kerbPatternWidth);
        const stripeX = startX + i * kerbPatternWidth;
        const offset = Math.floor((sampleProgress / 50 + i + side) % 2);
        ctx.fillStyle = offset === 0 ? '#f8fafc' : '#f87171';
        ctx.fillRect(stripeX, y, stripeWidth, bandHeight);
      }
    }

    const asphalt = ctx.createLinearGradient(trackLeft, y, trackRight, y);
    asphalt.addColorStop(0, '#2f3e54');
    asphalt.addColorStop(0.5, '#1f2737');
    asphalt.addColorStop(1, '#2f3e54');
    ctx.fillStyle = asphalt;
    ctx.fillRect(trackLeft, y, TRACK_WIDTH, bandHeight);

    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const laneLeft = trackLeft + lane * LANE_WIDTH;
      const laneColor = lane % 2 === 0 ? 'rgba(148, 163, 184, 0.12)' : 'rgba(30, 41, 59, 0.3)';
      ctx.fillStyle = laneColor;
      ctx.fillRect(laneLeft, y, LANE_WIDTH, bandHeight);
    }

    const dashPhase = Math.floor((y + sampleProgress * 0.08) / (bandHeight * 2));
    if (dashPhase % 2 === 0) {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
      const lineWidth = 6;
      for (let lane = 1; lane < LANE_COUNT; lane++) {
        const lineX = trackLeft + lane * LANE_WIDTH - lineWidth / 2;
        ctx.fillRect(lineX, y, lineWidth, bandHeight - 1);
      }
    }
  }

  const finishDistance = TRACK_LENGTH * TOTAL_LAPS - player.progress;
  if (finishDistance > 0 && finishDistance < VIEW_DISTANCE) {
    const finishRatio = finishDistance / VIEW_DISTANCE;
    const finishY = canvas.height * (1 - (1 - finishRatio) ** 1.4);
    const finishCenter = getTrackCenter(player.progress + finishDistance) + cameraOffset;
    const finishLeft = finishCenter - TRACK_WIDTH / 2;
    const stripeWidth = 22;
    const finishHeight = 36;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(finishLeft, finishY, TRACK_WIDTH, finishHeight);

    for (let x = 0; x < TRACK_WIDTH; x += stripeWidth) {
      const isEven = Math.floor(x / stripeWidth) % 2 === 0;
      ctx.fillStyle = isEven ? '#f8fafc' : '#111827';
      ctx.fillRect(finishLeft + x, finishY, stripeWidth, finishHeight / 2);
      ctx.fillStyle = isEven ? '#111827' : '#f8fafc';
      ctx.fillRect(finishLeft + x, finishY + finishHeight / 2, stripeWidth, finishHeight / 2);
    }
  }

  const progressRatio = Math.min(player.progress / (TRACK_LENGTH * TOTAL_LAPS), 1);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
  ctx.fillRect(32, 32, 240, 14);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(32, 32, 240 * progressRatio, 14);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px "Pretendard", "Segoe UI", sans-serif';
  ctx.fillText('결승선까지 남은 거리', 32, 24);

  ctx.restore();
}

function drawDrivers(timestamp, cameraOffset) {
  const player = players[0];

  const opponents = players
    .filter((driver) => !driver.isPlayer)
    .map((driver) => ({
      driver,
      relativeDistance: driver.progress - player.progress,
    }))
    .filter(({ relativeDistance }) => relativeDistance >= -200 && relativeDistance <= VIEW_DISTANCE)
    .sort((a, b) => Math.abs(b.relativeDistance) - Math.abs(a.relativeDistance));

  opponents.forEach(({ driver, relativeDistance }) => {
    const viewScale = Math.min(1.05, Math.max(0.3, 1 - relativeDistance / VIEW_DISTANCE));
    const y = canvas.height - relativeDistance * 0.42 - 200;
    drawCar(driver, y, timestamp, false, viewScale, cameraOffset);
  });

  drawCar(player, canvas.height - 140, timestamp, true, 1, cameraOffset);
}

function drawCar(driver, y, timestamp, isPlayer, scale = 1, cameraOffset = 0) {
  const design = driver.design;
  const carWidth = CAR_WIDTH * scale;
  const carLength = CAR_LENGTH * scale;
  const centerX = getCarX(driver) + cameraOffset;
  const bodyX = centerX - carWidth / 2;

  ctx.save();
  ctx.translate(centerX, y + carLength / 2);
  ctx.rotate(((Math.sin(timestamp / 220 + driver.progress / 160) * (isPlayer ? 1 : 0.5)) * Math.PI) / 180);
  ctx.translate(-centerX, -(y + carLength / 2));

  ctx.fillStyle = 'rgba(8, 15, 26, 0.45)';
  ctx.beginPath();
  ctx.ellipse(centerX, y + carLength * 0.94, carWidth * 0.46, carLength * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = design.wing;
  ctx.fillRect(bodyX - carWidth * 0.12, y + carLength * 0.05, carWidth * 1.24, carLength * 0.08);
  ctx.fillRect(bodyX - carWidth * 0.12, y + carLength * 0.86, carWidth * 1.24, carLength * 0.1);

  const tyreWidth = carWidth * 0.22;
  const tyreHeight = carLength * 0.18;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(bodyX - tyreWidth * 0.4, y + carLength * 0.18, tyreWidth, tyreHeight);
  ctx.fillRect(bodyX + carWidth - tyreWidth * 0.6, y + carLength * 0.18, tyreWidth, tyreHeight);
  ctx.fillRect(bodyX - tyreWidth * 0.4, y + carLength * 0.68, tyreWidth, tyreHeight);
  ctx.fillRect(bodyX + carWidth - tyreWidth * 0.6, y + carLength * 0.68, tyreWidth, tyreHeight);

  ctx.fillStyle = design.base;
  ctx.fillRect(bodyX, y, carWidth, carLength);

  ctx.fillStyle = shadeColor(design.base, -18);
  ctx.fillRect(bodyX + carWidth * 0.12, y + carLength * 0.22, carWidth * 0.76, carLength * 0.28);

  ctx.fillStyle = design.accent;
  ctx.fillRect(bodyX + carWidth * 0.14, y + carLength * 0.58, carWidth * 0.72, carLength * 0.22);

  ctx.fillStyle = design.halo;
  ctx.fillRect(bodyX + carWidth * 0.26, y + carLength * 0.18, carWidth * 0.48, carLength * 0.18);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(bodyX + carWidth * 0.3, y + carLength * 0.12, carWidth * 0.4, carLength * 0.06);

  ctx.fillStyle = design.stripe;
  ctx.fillRect(bodyX + carWidth * 0.2, y + carLength * 0.68, carWidth * 0.6, carLength * 0.06);

  const studRadius = carWidth * 0.08;
  for (let i = 0; i < 3; i++) {
    const studX = bodyX + carWidth * (0.25 + i * 0.25);
    ctx.fillStyle = design.studs;
    ctx.beginPath();
    ctx.arc(studX, y + carLength * 0.36, studRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadeColor(design.studs, -25);
    ctx.lineWidth = Math.max(0.6, 1.2 * scale);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.fillRect(bodyX + carWidth * 0.38, y + carLength * 0.72, carWidth * 0.24, carLength * 0.12);
  ctx.fillStyle = '#f8fafc';
  const numberFontSize = Math.max(8, 12 * scale);
  ctx.font = `${numberFontSize}px 'Pretendard', 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(design.number, centerX, y + carLength * 0.78);

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
    const rank = document.createElement('span');
    rank.className = 'pos-rank';
    rank.textContent = index + 1;

    const driverInfo = document.createElement('span');
    driverInfo.className = 'pos-driver';

    const chip = document.createElement('span');
    chip.className = 'pos-chip';
    chip.style.background = driver.design.base;

    const name = document.createElement('span');
    name.className = 'pos-name';
    name.textContent = driver.name;

    driverInfo.appendChild(chip);
    driverInfo.appendChild(name);

    li.appendChild(rank);
    li.appendChild(driverInfo);
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
    .map(
      (driver, index) =>
        `<span class="finish-line"><span class="finish-chip" style="background:${driver.design.base}"></span>${index + 1}위 ${driver.name} (#${driver.design.number})</span>`
    )
    .join('');
  finishSummary.innerHTML = `<strong class="finish-title">완주 순위</strong>${ordered}`;
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
