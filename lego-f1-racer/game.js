const TRACK_LENGTH = 5200; // 가상 거리 단위 - 더욱 긴 트랙
const TOTAL_LAPS = 1;
const LANE_COUNT = 4;
const LANE_WIDTH = 90;
const CAR_LENGTH = 90;
const CAR_WIDTH = 60;
const VIEW_DISTANCE = 1400; // 화면 표시 거리
const BASE_FRICTION = 40;
const COUNTDOWN_DURATION = 3;
const ROAD_SHOULDER = 110;
const TRACK_SLICE_STEP = 45;
const BOOST_MAX = 100;
const BOOST_CHARGE_PER_STUD = 25;
const BOOST_DURATION = 2.5;
const BOOST_SPEED_MULTIPLIER = 1.35;
const HAZARD_SLOW_FACTOR = 0.55;
const HAZARD_PENALTY_DURATION = 1.8;

let canvas;
let ctx;
let speedDisplay;
let lapDisplay;
let rankDisplay;
let positionList;
let finishBanner;
let finishSummary;
let restartBtn;
let countdownDisplay;
let studCountDisplay;
let boostMeter;
let boostFill;
let boostPercent;
let momentAnnouncer;
let TRACK_LEFT = 0;

const inputState = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

const collectibles = [];
const hazards = [];

function setupTrackEvents() {
  collectibles.length = 0;
  hazards.length = 0;

  const studCount = 18;
  for (let i = 0; i < studCount; i += 1) {
    const progress = 260 + i * 260;
    const lane = (i * 2 + (i % 3)) % LANE_COUNT;
    collectibles.push({
      id: `stud-${i}`,
      progress,
      lane,
      collected: false,
    });
  }

  hazards.push(
    {
      id: 'hazard-1',
      progress: 1020,
      lane: 2,
      active: true,
      slowFactor: 0.5,
      penalty: HAZARD_PENALTY_DURATION,
      message: '피트월 오일! 차가 미끄러집니다!',
    },
    {
      id: 'hazard-2',
      progress: 1840,
      lane: 0,
      active: true,
      slowFactor: 0.58,
      penalty: HAZARD_PENALTY_DURATION + 0.4,
      message: '커브 바깥 모래를 밟았어요!',
    },
    {
      id: 'hazard-3',
      progress: 2740,
      lane: 3,
      active: true,
      slowFactor: 0.6,
      penalty: HAZARD_PENALTY_DURATION + 0.2,
      message: '레고 브릭 파편이 튀었습니다! 속도가 떨어집니다.',
    },
    {
      id: 'hazard-4',
      progress: 3560,
      lane: 1,
      active: true,
      slowFactor: 0.62,
      penalty: HAZARD_PENALTY_DURATION + 0.6,
      message: '루이스 헤어핀! 급격한 감속 구간입니다.',
    },
    {
      id: 'hazard-5',
      progress: 4380,
      lane: 2,
      active: true,
      slowFactor: 0.57,
      penalty: HAZARD_PENALTY_DURATION + 0.5,
      message: '터널 출구 방호벽! 조심히 빠져나가세요!',
    }
  );
}

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

function createInitialRaceState() {
  return {
    finished: false,
    finishOrder: [],
    startTime: null,
    lastTimestamp: 0,
    countdownActive: true,
    countdown: COUNTDOWN_DURATION,
    goSignalTime: 0,
    boostMeter: 0,
    currentRivalId: null,
    rivalDelta: null,
    rivalAnnounceCooldown: 0,
    momentTimer: 0,
    momentMessage: '',
    momentTone: 'info',
  };
}

let raceState = createInitialRaceState();
setupTrackEvents();

const trackSegments = [
  { start: 0, end: 0.08, from: 0, to: -160 },
  { start: 0.08, end: 0.18, from: -160, to: -220 },
  { start: 0.18, end: 0.28, from: -220, to: 140 },
  { start: 0.28, end: 0.36, from: 140, to: 220 },
  { start: 0.36, end: 0.44, from: 220, to: -120 },
  { start: 0.44, end: 0.52, from: -120, to: -260 },
  { start: 0.52, end: 0.6, from: -260, to: -40 },
  { start: 0.6, end: 0.7, from: -40, to: 210 },
  { start: 0.7, end: 0.8, from: 210, to: 60 },
  { start: 0.8, end: 0.88, from: 60, to: -200 },
  { start: 0.88, end: 0.96, from: -200, to: 180 },
  { start: 0.96, end: 1, from: 180, to: 0 },
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
    studs: 0,
    boostActive: false,
    boostTimer: 0,
    hazardSlowTimer: 0,
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
  countdownDisplay = document.getElementById('countdownDisplay');
  studCountDisplay = document.getElementById('studCount');
  boostMeter = document.getElementById('boostMeter');
  boostFill = document.getElementById('boostFill');
  boostPercent = document.getElementById('boostPercent');
  momentAnnouncer = document.getElementById('momentAnnouncer');

  if (!canvas) {
    console.error('raceCanvas 요소를 찾을 수 없습니다. HTML 구조를 확인하세요.');
    return false;
  }

  ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('캔버스 컨텍스트를 초기화할 수 없습니다. 브라우저가 Canvas를 지원하는지 확인하세요.');
    return false;
  }

  const requiredElements = [
    speedDisplay,
    lapDisplay,
    rankDisplay,
    positionList,
    finishBanner,
    finishSummary,
    studCountDisplay,
    boostMeter,
    boostFill,
    boostPercent,
  ];
  if (requiredElements.some((el) => !el)) {
    console.error('UI 요소를 찾을 수 없습니다. HTML id를 확인하세요.');
    return false;
  }

  if (!restartBtn) {
    console.warn('restartBtn 요소를 찾을 수 없습니다. 다시 달리기 버튼이 비활성화됩니다.');
  }

  if (!countdownDisplay) {
    console.warn('countdownDisplay 요소를 찾을 수 없습니다. 카운트다운 연출이 비활성화됩니다.');
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
  if (e.key in inputState) {
    inputState[e.key] = isDown;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  }
  if (e.type === 'keydown') {
    if (e.key === 'r' || e.key === 'R') resetRace();
    if (e.key === 'ArrowLeft') players[0].targetLane = Math.max(0, players[0].targetLane - 1);
    if (e.key === 'ArrowRight') players[0].targetLane = Math.min(LANE_COUNT - 1, players[0].targetLane + 1);
    if (e.code === 'Space') {
      e.preventDefault();
      tryActivateBoost();
    }
  }
}

function tryActivateBoost() {
  const player = players[0];
  if (!player || raceState.countdownActive || raceState.finished) return;
  if (player.boostActive || raceState.boostMeter < BOOST_MAX) return;
  raceState.boostMeter = 0;
  player.boostActive = true;
  player.boostTimer = BOOST_DURATION;
  player.hazardSlowTimer = 0;
  player.speed = Math.max(player.speed, player.topSpeed * 0.78);
  triggerMoment('터보 발동! 스피드 온!', 'boost');
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
    if (driver.isPlayer) {
      driver.studs = 0;
      driver.boostActive = false;
      driver.boostTimer = 0;
      driver.hazardSlowTimer = 0;
    }
  });
  raceState = createInitialRaceState();
  collectibles.forEach((item) => {
    item.collected = false;
  });
  hazards.forEach((hazard) => {
    hazard.active = true;
  });
  finishBanner.classList.add('hidden');
  finishSummary.textContent = '';
  if (momentAnnouncer) {
    momentAnnouncer.textContent = '';
    momentAnnouncer.className = 'moment-announcer hidden';
  }
  if (countdownDisplay) {
    countdownDisplay.textContent = COUNTDOWN_DURATION.toString();
    countdownDisplay.classList.remove('hidden', 'go');
  }
  updateUI();
}

function handleCountdown(dt) {
  if (raceState.countdownActive) {
    raceState.countdown = Math.max(0, raceState.countdown - dt);
    if (countdownDisplay) {
      countdownDisplay.textContent = Math.max(1, Math.ceil(raceState.countdown)).toString();
      countdownDisplay.classList.remove('hidden', 'go');
    }

    if (raceState.countdown <= 0) {
      raceState.countdownActive = false;
      raceState.goSignalTime = 0.8;
      raceState.countdown = 0;
      raceState.startTime = performance.now();
      if (countdownDisplay) {
        countdownDisplay.textContent = 'GO!';
        countdownDisplay.classList.add('go');
      }
    }
  } else if (raceState.goSignalTime > 0) {
    raceState.goSignalTime = Math.max(0, raceState.goSignalTime - dt);
    if (raceState.goSignalTime <= 0 && countdownDisplay) {
      countdownDisplay.classList.add('hidden');
    }
  }

  return raceState.countdownActive;
}

function handleInputFrame(player, dt) {
  const accel = inputState.ArrowUp ? player.accel : 0;
  const brake = inputState.ArrowDown ? player.grip : 0;
  let friction = BASE_FRICTION;
  if (player.boostActive) friction *= 0.55;
  if (player.hazardSlowTimer > 0) friction *= 1.35;

  let maxSpeedMultiplier = 1;
  if (player.boostActive) {
    maxSpeedMultiplier = BOOST_SPEED_MULTIPLIER;
  } else if (player.hazardSlowTimer > 0) {
    maxSpeedMultiplier = 0.82;
  }

  player.speed += (accel - brake - friction) * dt;
  if (player.boostActive) {
    player.speed += player.accel * 0.4 * dt;
  }
  const maxSpeed = player.topSpeed * maxSpeedMultiplier;
  player.speed = Math.max(0, Math.min(player.speed, maxSpeed));
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

function processTrackEvents(player) {
  checkCollectibles(player);
  checkHazards(player);
}

function checkCollectibles(player) {
  collectibles.forEach((item) => {
    if (item.collected) return;
    const distance = item.progress - player.progress;
    if (distance < -100 || distance > 120) return;
    const laneCenter = laneToX(item.lane);
    if (Math.abs(player.x - laneCenter) < LANE_WIDTH * 0.45) {
      item.collected = true;
      player.studs += 1;
      const before = raceState.boostMeter;
      raceState.boostMeter = Math.min(BOOST_MAX, raceState.boostMeter + BOOST_CHARGE_PER_STUD);
      triggerMoment(`브릭 수집! x${player.studs}`, 'collect');
      if (before < BOOST_MAX && raceState.boostMeter >= BOOST_MAX) {
        triggerMoment('터보 준비 완료! Space 키!', 'boost');
      }
    }
  });
}

function checkHazards(player) {
  hazards.forEach((hazard) => {
    if (!hazard.active) return;
    const distance = hazard.progress - player.progress;
    if (distance < -140 || distance > 110) return;
    const laneCenter = laneToX(hazard.lane);
    if (Math.abs(player.x - laneCenter) < LANE_WIDTH * 0.45) {
      hazard.active = false;
      const slowFactor = hazard.slowFactor !== undefined ? hazard.slowFactor : HAZARD_SLOW_FACTOR;
      player.speed *= slowFactor;
      const penalty = hazard.penalty !== undefined ? hazard.penalty : HAZARD_PENALTY_DURATION;
      player.hazardSlowTimer = Math.max(player.hazardSlowTimer, penalty);
      triggerMoment(hazard.message, 'hazard');
    }
  });
}

function updateBoostState(player, dt) {
  if (player.boostActive) {
    player.boostTimer = Math.max(0, player.boostTimer - dt);
    if (player.boostTimer <= 0) {
      player.boostActive = false;
      player.boostTimer = 0;
    }
  }

  if (player.hazardSlowTimer > 0) {
    player.hazardSlowTimer = Math.max(0, player.hazardSlowTimer - dt);
  }
}

function updateRivalHighlight(player, dt) {
  raceState.rivalAnnounceCooldown = Math.max(0, raceState.rivalAnnounceCooldown - dt);
  let closestDriver = null;
  let closestDelta = Number.POSITIVE_INFINITY;

  players.forEach((driver) => {
    if (driver.id === player.id) return;
    if (driver.finished && player.finished) return;
    const delta = driver.progress - player.progress;
    const absDelta = Math.abs(delta);
    if (absDelta < closestDelta && absDelta < 220) {
      closestDriver = driver;
      closestDelta = absDelta;
    }
  });

  if (closestDriver) {
    raceState.currentRivalId = closestDriver.id;
    raceState.rivalDelta = closestDriver.progress - player.progress;
    if (Math.abs(raceState.rivalDelta) < 90 && raceState.rivalAnnounceCooldown === 0) {
      const message =
        raceState.rivalDelta >= 0
          ? `${closestDriver.name} 추격 중!`
          : `${closestDriver.name}이(가) 뒤에서 압박 중!`;
      triggerMoment(message, 'rival');
      raceState.rivalAnnounceCooldown = 3.2;
    }
  } else {
    raceState.currentRivalId = null;
    raceState.rivalDelta = null;
  }
}

function triggerMoment(message, tone = 'collect') {
  raceState.momentMessage = message;
  raceState.momentTone = tone;
  raceState.momentTimer = 2.6;
  if (!momentAnnouncer) return;
  momentAnnouncer.textContent = message;
  momentAnnouncer.className = `moment-announcer ${tone}`;
  momentAnnouncer.classList.remove('hidden');
}

function updateMomentDisplay(dt) {
  if (raceState.momentTimer > 0) {
    raceState.momentTimer = Math.max(0, raceState.momentTimer - dt);
    if (raceState.momentTimer <= 0 && momentAnnouncer) {
      momentAnnouncer.classList.add('hidden');
    }
  }
}

function update(dt) {
  if (handleCountdown(dt)) {
    updateMomentDisplay(dt);
    return;
  }

  if (!raceState.startTime) raceState.startTime = performance.now();

  const player = players[0];
  if (!player) return;

  if (!raceState.finished) {
    handleInputFrame(player, dt);
    players.slice(1).forEach((driver) => updateAI(driver, dt, player));
    processTrackEvents(player);

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
  }

  updateBoostState(player, dt);
  updateRivalHighlight(player, dt);
  updateMomentDisplay(dt);
  updateUI();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTrack();
  drawHazards();
  drawCollectibles();
  drawCars();
  drawBoostEffects();
}

function drawSkyBackdrop() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#1f3b6d');
  sky.addColorStop(0.35, '#1e2a44');
  sky.addColorStop(0.6, '#111827');
  sky.addColorStop(1, '#020617');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawCityBackdrop(standHeight) {
  ctx.save();
  const baseY = standHeight * 0.65;
  const buildingColors = ['#1e293b', '#243b53', '#334155', '#475569'];
  let cursor = -30;
  for (let i = 0; i < 14; i += 1) {
    const width = 40 + (i % 5) * 18;
    const height = standHeight + 40 + ((i * 17) % 60);
    ctx.fillStyle = buildingColors[i % buildingColors.length];
    ctx.fillRect(cursor, baseY - height, width, height);

    const windowColor = 'rgba(226,232,240,0.18)';
    ctx.fillStyle = windowColor;
    const windowCount = Math.max(2, Math.floor(width / 12));
    for (let w = 0; w < windowCount; w += 1) {
      const winX = cursor + 6 + w * 12;
      for (let h = 0; h < Math.floor(height / 22); h += 1) {
        const winY = baseY - height + 8 + h * 18;
        ctx.fillRect(winX, winY, 6, 8);
      }
    }
    cursor += width + 10;
  }
  ctx.restore();
}

function drawCrowdRow(rowY, rowHeight, rowIndex, flip) {
  const palette = ['#ef4444', '#f97316', '#38bdf8', '#facc15', '#22c55e', '#a855f7'];
  const headY = flip ? rowY + rowHeight * 0.35 : rowY + rowHeight * 0.65;
  const bodyHeight = rowHeight * 0.32;
  for (let x = -16; x < canvas.width + 32; x += 12) {
    const colorIndex = (rowIndex + Math.floor((x + 16) / 12)) % palette.length;
    ctx.fillStyle = palette[colorIndex];
    ctx.fillRect(x, headY - bodyHeight * 0.5, 10, bodyHeight);
    ctx.fillStyle = 'rgba(15,23,42,0.7)';
    ctx.beginPath();
    ctx.arc(x + 5, headY - bodyHeight * 0.7, rowHeight * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGrandstandCrowd(startY, standHeight, flip = false) {
  ctx.save();
  const standGradient = ctx.createLinearGradient(0, startY, 0, startY + standHeight);
  standGradient.addColorStop(0, flip ? 'rgba(8,13,23,0.85)' : 'rgba(30,41,59,0.92)');
  standGradient.addColorStop(1, 'rgba(15,23,42,0.6)');
  ctx.fillStyle = standGradient;
  ctx.fillRect(0, startY, canvas.width, standHeight);

  const rowCount = 6;
  const rowHeight = standHeight / (rowCount + 1);
  for (let row = 0; row < rowCount; row += 1) {
    const offset = flip ? startY + (row + 1) * rowHeight : startY + row * rowHeight;
    drawCrowdRow(offset, rowHeight, row, flip);
  }

  const bannerHeight = Math.min(26, standHeight * 0.28);
  const bannerY = flip ? startY + standHeight - bannerHeight - 6 : startY + bannerHeight;
  const banners = [
    { label: 'F1', color: '#ef4444' },
    { label: 'JOHNNIE WALKER', color: '#111827' },
    { label: 'BWT', color: '#38bdf8' },
    { label: 'PIRELLI', color: '#facc15' },
  ];
  const bannerWidth = canvas.width / banners.length;
  banners.forEach((banner, index) => {
    const x = index * bannerWidth + 6;
    ctx.fillStyle = banner.color;
    ctx.fillRect(x, bannerY, bannerWidth - 12, bannerHeight);
    ctx.fillStyle = banner.color === '#111827' ? '#facc15' : '#0f172a';
    ctx.font = `${Math.max(10, bannerHeight * 0.45)}px 'Pretendard', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(banner.label, x + (bannerWidth - 12) / 2, bannerY + bannerHeight / 2 + (flip ? 2 : 0));
  });

  ctx.fillStyle = 'rgba(148,163,184,0.25)';
  const railY = flip ? startY + 6 : startY + standHeight - 6;
  ctx.fillRect(0, railY, canvas.width, 4);
  ctx.restore();
}

function drawBackdropLayers(standHeight) {
  drawSkyBackdrop();
  drawCityBackdrop(standHeight);
  drawGrandstandCrowd(0, standHeight, false);
  drawGrandstandCrowd(canvas.height - standHeight, standHeight, true);
}

function drawTrack() {
  const standHeight = 120;
  drawBackdropLayers(standHeight);

  const player = players[0];
  if (!player) return;

  const baseOffset = getTrackOffset(player.progress);
  const roadWidth = LANE_COUNT * LANE_WIDTH;
  const horizon = standHeight + 50;
  let prevSlice = null;

  for (let distance = VIEW_DISTANCE; distance >= 0; distance -= TRACK_SLICE_STEP) {
    const progress = player.progress + distance;
    const offsetDiff = getTrackOffset(progress) - baseOffset;
    const perspective = 1 / (1 + distance * 0.0026);
    const centerX = TRACK_LEFT + roadWidth / 2 + offsetDiff * perspective;
    const y = canvas.height - distance * 0.42 - 140;

    if (y < horizon) continue;

    const asphaltHalf = (roadWidth / 2) * perspective;
    const shoulderHalf = asphaltHalf + ROAD_SHOULDER * perspective;

    const slice = {
      centerX,
      y,
      perspective,
      asphaltHalf,
      shoulderHalf,
    };

    if (prevSlice) {
      drawTrackSection(prevSlice, slice);
      drawLaneMarkers(prevSlice, slice, roadWidth);
    }

    prevSlice = slice;
  }
}

function drawTrackSection(prevSlice, slice) {
  const asphaltColor = '#1f2937';
  const shoulderColor = '#334155';

  ctx.beginPath();
  ctx.moveTo(prevSlice.centerX - prevSlice.shoulderHalf, prevSlice.y);
  ctx.lineTo(prevSlice.centerX + prevSlice.shoulderHalf, prevSlice.y);
  ctx.lineTo(slice.centerX + slice.shoulderHalf, slice.y);
  ctx.lineTo(slice.centerX - slice.shoulderHalf, slice.y);
  ctx.closePath();
  ctx.fillStyle = shoulderColor;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(prevSlice.centerX - prevSlice.asphaltHalf, prevSlice.y);
  ctx.lineTo(prevSlice.centerX + prevSlice.asphaltHalf, prevSlice.y);
  ctx.lineTo(slice.centerX + slice.asphaltHalf, slice.y);
  ctx.lineTo(slice.centerX - slice.asphaltHalf, slice.y);
  ctx.closePath();
  ctx.fillStyle = asphaltColor;
  ctx.fill();
}

function drawLaneMarkers(prevSlice, slice, roadWidth) {
  ctx.strokeStyle = 'rgba(248,250,252,0.5)';
  for (let lane = 1; lane < LANE_COUNT; lane += 1) {
    const laneOffset = lane * (roadWidth / LANE_COUNT) - roadWidth / 2;
    const prevX = prevSlice.centerX + laneOffset * prevSlice.perspective;
    const currX = slice.centerX + laneOffset * slice.perspective;
    ctx.lineWidth = Math.max(1, 3 * slice.perspective);
    ctx.beginPath();
    ctx.moveTo(prevX, prevSlice.y);
    ctx.lineTo(currX, slice.y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(248,113,113,0.7)';
  ctx.lineWidth = Math.max(2, 4 * slice.perspective);
  ctx.beginPath();
  ctx.moveTo(prevSlice.centerX - prevSlice.asphaltHalf, prevSlice.y);
  ctx.lineTo(slice.centerX - slice.asphaltHalf, slice.y);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(74,222,128,0.7)';
  ctx.beginPath();
  ctx.moveTo(prevSlice.centerX + prevSlice.asphaltHalf, prevSlice.y);
  ctx.lineTo(slice.centerX + slice.asphaltHalf, slice.y);
  ctx.stroke();
}

function drawHazards() {
  const player = players[0];
  if (!player) return;
  const baseOffset = getTrackOffset(player.progress);
  hazards.forEach((hazard) => {
    if (!hazard.active) return;
    const relativeProgress = hazard.progress - player.progress;
    if (relativeProgress < -200 || relativeProgress > VIEW_DISTANCE) return;
    const y = canvas.height - relativeProgress * 0.4 - 160;
    if (y < 0) return;
    const scale = Math.max(0.3, 1 - relativeProgress / VIEW_DISTANCE);
    const curveShift = (getTrackOffset(hazard.progress) - baseOffset) * scale * 0.9;
    const laneX = laneToX(hazard.lane) + curveShift;
    drawHazardPatch(laneX, y, scale);
  });
}

function drawHazardPatch(x, y, scale) {
  const patchW = LANE_WIDTH * 0.6 * scale;
  const patchH = CAR_LENGTH * 0.45 * scale;
  ctx.save();
  ctx.translate(x, y);
  const wobble = Math.sin(performance.now() / 320 + x * 0.02) * 0.3;
  ctx.rotate(wobble);
  const gradient = ctx.createRadialGradient(0, 0, patchW * 0.2, 0, 0, Math.max(patchW, patchH));
  gradient.addColorStop(0, 'rgba(15, 23, 42, 0.35)');
  gradient.addColorStop(1, 'rgba(248, 113, 113, 0.18)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, patchW, patchH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1, 3 * scale);
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.35)';
  ctx.stroke();
  ctx.restore();
}

function drawCollectibles() {
  const player = players[0];
  if (!player) return;
  const baseOffset = getTrackOffset(player.progress);
  collectibles.forEach((item) => {
    if (item.collected) return;
    const relativeProgress = item.progress - player.progress;
    if (relativeProgress < -200 || relativeProgress > VIEW_DISTANCE) return;
    const y = canvas.height - relativeProgress * 0.4 - 160;
    if (y < 0) return;
    const scale = Math.max(0.35, 1 - relativeProgress / VIEW_DISTANCE);
    const curveShift = (getTrackOffset(item.progress) - baseOffset) * scale * 0.9;
    const laneX = laneToX(item.lane) + curveShift;
    drawStudCollectible(laneX, y, scale);
  });
}

function drawStudCollectible(x, y, scale) {
  const studRadius = 12 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
  ctx.beginPath();
  ctx.arc(0, 0, studRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(253, 230, 138, 0.95)';
  ctx.beginPath();
  ctx.arc(0, -studRadius * 0.35, studRadius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(161, 98, 7, 0.6)';
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.beginPath();
  ctx.arc(0, 0, studRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCars() {
  const player = players[0];
  const baseOffset = getTrackOffset(player.progress);
  players.forEach((driver) => {
    const relativeProgress = driver.progress - player.progress;
    if (relativeProgress < -200 || relativeProgress > VIEW_DISTANCE) return;
    const y = canvas.height - relativeProgress * 0.4 - 160;
    const scale = Math.max(0.3, 1 - relativeProgress / VIEW_DISTANCE);
    const curveShift = (getTrackOffset(driver.progress) - baseOffset) * scale * 0.9;
    drawCar(driver, y, scale, curveShift);
  });
}

function drawCar(driver, y, scale = 1, curveShift = 0) {
  const { base, accent, stripe, wing, studs, halo, number } = driver.design;
  const carW = CAR_WIDTH * scale;
  const carL = CAR_LENGTH * scale;
  const centerX = driver.x + curveShift;
  const centerY = y + carL * 0.5;
  const noseY = y;
  const tailY = y + carL;
  const bodyWidth = carW * 0.82;

  if (driver.boostActive && driver.isPlayer) {
    ctx.save();
    const glowRadiusX = carW * 1.1;
    const glowRadiusY = carL * 1.2;
    const glow = ctx.createRadialGradient(centerX, centerY, carW * 0.1, centerX, centerY, glowRadiusX);
    glow.addColorStop(0, 'rgba(34, 211, 238, 0.8)');
    glow.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, glowRadiusX, glowRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = 'rgba(8,15,26,0.45)';
  ctx.beginPath();
  ctx.ellipse(centerX, y + carL * 0.96, carW * 0.52, carL * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(centerX - carW * 0.85, noseY + carL * 0.1);
  ctx.lineTo(centerX + carW * 0.85, noseY + carL * 0.1);
  ctx.lineTo(centerX + carW * 0.72, noseY + carL * 0.18);
  ctx.lineTo(centerX - carW * 0.72, noseY + carL * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(centerX - carW * 0.7, tailY - carL * 0.16);
  ctx.lineTo(centerX + carW * 0.7, tailY - carL * 0.16);
  ctx.lineTo(centerX + carW * 0.55, tailY - carL * 0.06);
  ctx.lineTo(centerX - carW * 0.55, tailY - carL * 0.06);
  ctx.closePath();
  ctx.fill();

  const drawWheel = (wx, wy, radius) => {
    ctx.save();
    ctx.fillStyle = 'rgba(8,15,26,0.95)';
    ctx.beginPath();
    ctx.ellipse(wx, wy, radius, radius * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.45)';
    ctx.lineWidth = Math.max(1, 2.2 * scale);
    ctx.stroke();
    ctx.fillStyle = 'rgba(226,232,240,0.55)';
    ctx.beginPath();
    ctx.ellipse(wx, wy, radius * 0.42, radius * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const wheelOffsetX = carW * 0.62;
  const frontWheelY = noseY + carL * 0.25;
  const rearWheelY = tailY - carL * 0.24;
  drawWheel(centerX - wheelOffsetX, frontWheelY, carW * 0.24);
  drawWheel(centerX + wheelOffsetX, frontWheelY, carW * 0.24);
  drawWheel(centerX - wheelOffsetX * 0.92, rearWheelY, carW * 0.26);
  drawWheel(centerX + wheelOffsetX * 0.92, rearWheelY, carW * 0.26);

  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(centerX, noseY);
  ctx.lineTo(centerX - bodyWidth * 0.58, noseY + carL * 0.18);
  ctx.lineTo(centerX - bodyWidth * 0.76, noseY + carL * 0.48);
  ctx.lineTo(centerX - bodyWidth * 0.52, tailY - carL * 0.22);
  ctx.lineTo(centerX, tailY);
  ctx.lineTo(centerX + bodyWidth * 0.52, tailY - carL * 0.22);
  ctx.lineTo(centerX + bodyWidth * 0.76, noseY + carL * 0.48);
  ctx.lineTo(centerX + bodyWidth * 0.58, noseY + carL * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(centerX, noseY + carL * 0.04);
  ctx.lineTo(centerX - bodyWidth * 0.18, noseY + carL * 0.34);
  ctx.lineTo(centerX - bodyWidth * 0.16, noseY + carL * 0.62);
  ctx.lineTo(centerX, noseY + carL * 0.84);
  ctx.lineTo(centerX + bodyWidth * 0.16, noseY + carL * 0.62);
  ctx.lineTo(centerX + bodyWidth * 0.18, noseY + carL * 0.34);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = stripe;
  ctx.fillRect(centerX - bodyWidth * 0.08, noseY + carL * 0.44, bodyWidth * 0.16, carL * 0.24);

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(centerX - bodyWidth * 0.64, noseY + carL * 0.32);
  ctx.lineTo(centerX - bodyWidth * 0.68, noseY + carL * 0.52);
  ctx.lineTo(centerX - bodyWidth * 0.4, noseY + carL * 0.72);
  ctx.lineTo(centerX - bodyWidth * 0.36, noseY + carL * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(centerX + bodyWidth * 0.64, noseY + carL * 0.32);
  ctx.lineTo(centerX + bodyWidth * 0.68, noseY + carL * 0.52);
  ctx.lineTo(centerX + bodyWidth * 0.4, noseY + carL * 0.72);
  ctx.lineTo(centerX + bodyWidth * 0.36, noseY + carL * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(centerX, noseY + carL * 0.4, bodyWidth * 0.22, carL * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(centerX, noseY + carL * 0.38, bodyWidth * 0.18, carL * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = halo;
  ctx.fillRect(centerX - bodyWidth * 0.08, noseY + carL * 0.16, bodyWidth * 0.16, carL * 0.12);

  const studR = carW * 0.12;
  for (let i = -1; i <= 1; i += 1) {
    const studX = centerX + i * carW * 0.22;
    const studY = noseY + carL * 0.26;
    ctx.fillStyle = studs;
    ctx.beginPath();
    ctx.ellipse(studX, studY, studR * 0.55, studR * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,23,42,0.35)';
    ctx.lineWidth = Math.max(1, 1.6 * scale);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(studX, studY - studR * 0.12, studR * 0.25, studR * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = `${Math.max(8, 12 * scale)}px 'Pretendard', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(number, centerX, noseY + carL * 0.72);
  ctx.restore();
}

function drawBoostEffects() {
  const player = players[0];
  if (!player || !player.boostActive) return;
  ctx.save();
  const pulse = (Math.sin(performance.now() / 90) + 1) * 0.12 + 0.1;
  ctx.globalAlpha = 0.15 + pulse * 0.25;
  const overlay = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  overlay.addColorStop(0, 'rgba(56, 189, 248, 0.65)');
  overlay.addColorStop(1, 'rgba(14, 165, 233, 0.35)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function updateUI() {
  const player = players[0];
  speedDisplay.textContent = Math.round(player.speed);
  rankDisplay.textContent = getPlayerRank();
  lapDisplay.textContent = `${player.lap} / ${TOTAL_LAPS}`;
  if (studCountDisplay) studCountDisplay.textContent = player.studs;
  if (boostFill && boostPercent) {
    const percent = Math.round((raceState.boostMeter / BOOST_MAX) * 100);
    boostFill.style.width = `${percent}%`;
    boostFill.dataset.ready = percent >= 100 ? 'true' : 'false';
    boostPercent.textContent = `${percent}%`;
    if (boostMeter) boostMeter.classList.toggle('ready', percent >= 100);
    boostPercent.classList.toggle('ready', percent >= 100);
  }

  const sorted = [...players].sort((a, b) => b.progress - a.progress);
  positionList.innerHTML = '';
  const rivalId = raceState.currentRivalId;
  sorted.forEach((driver, index) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="pos-rank">${index + 1}</span>
      <span class="pos-driver"><span class="pos-chip" style="background:${driver.design.base}"></span>${driver.name}</span>`;
    if (driver.isPlayer) li.classList.add('player-entry');
    if (driver.id === rivalId) {
      li.classList.add('rival-entry');
      if (raceState.rivalDelta !== null) {
        const gap = Math.max(1, Math.round(Math.abs(raceState.rivalDelta)));
        const gapSpan = document.createElement('span');
        gapSpan.className = 'pos-gap';
        const prefix = raceState.rivalDelta >= 0 ? '+' : '-';
        gapSpan.textContent = `${prefix}${gap}m`;
        li.appendChild(gapSpan);
      }
    }
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
  if (countdownDisplay) countdownDisplay.classList.add('hidden');
  raceState.momentTimer = 0;
  if (momentAnnouncer) momentAnnouncer.classList.add('hidden');
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
  raceState = createInitialRaceState();
  bindEvents();
  resetRace();
  requestAnimationFrame(gameLoop);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
