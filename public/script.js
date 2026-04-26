const socket = io();

// ── State ────────────────────────────────────────────────
let myId       = null;
let myName     = '';
let roomCode   = '';
let gameState  = null;
let players    = [];
let hasRolled  = false;
let isSpectator = false;
let roundHistory = [];
let soundEnabled = localStorage.getItem('sound') !== 'off';
let currentDiceType = 'D6';

// ── Player colors & avatars ──────────────────────────────
const PLAYER_COLORS = ['p0','p1','p2','p3'];
const AVATARS = ['🐉','🦊','🐺','🦁'];

// ── Screen helpers ───────────────────────────────────────
const screens = ['lobby-screen','waiting-screen','game-screen','gameover-screen'];
function showScreen(id) {
  screens.forEach(s => document.getElementById(s).classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Sound (Web Audio API synth) ──────────────────────────
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, gain = 0.3) {
  if (!soundEnabled) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + duration);
    vol.gain.setValueAtTime(gain, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(vol); vol.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + duration);
  } catch(_) {}
}
function soundRoll()  { playTone(220, 'sawtooth', 0.5, 0.18); setTimeout(() => playTone(330,'sawtooth',.3,.12), 120); }
function soundWin()   { [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f,'sine',.4,.25), i*120)); }
function soundTick()  { playTone(660, 'square', 0.08, 0.1); }

document.getElementById('btn-sound').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('sound', soundEnabled ? 'on' : 'off');
  document.getElementById('btn-sound').textContent = soundEnabled ? '🔊' : '🔇';
});
if (!soundEnabled) document.getElementById('btn-sound').textContent = '🔇';

// ── Confetti ─────────────────────────────────────────────
const CONFETTI_COLORS = ['#7c3aed','#06b6d4','#f59e0b','#f43f5e','#22c55e','#ffffff'];
function launchConfetti() {
  const container = document.getElementById('confetti-container');
  for (let i = 0; i < 90; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    el.style.width  = (8 + Math.random() * 8) + 'px';
    el.style.height = (12 + Math.random() * 10) + 'px';
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    const dur = 2.5 + Math.random() * 2;
    el.style.animationDuration = dur + 's';
    el.style.animationDelay = Math.random() * 1.5 + 's';
    container.appendChild(el);
    setTimeout(() => el.remove(), (dur + 1.5) * 1000);
  }
}

// ── Auto-fill room code from URL ?join=XXXXX ─────────────
(function() {
  const params = new URLSearchParams(window.location.search);
  const join = params.get('join');
  if (join) {
    document.getElementById('room-code-input').value = join.toUpperCase();
    document.getElementById('player-name').focus();
  }
})();

// ── Socket ID ────────────────────────────────────────────
socket.on('connect', () => { myId = socket.id; });

// ── Lobby ────────────────────────────────────────────────
document.getElementById('btn-create').addEventListener('click', () => {
  myName = document.getElementById('player-name').value.trim();
  if (!myName) { showError('Enter your name first!'); return; }
  socket.emit('create_room', { name: myName });
});

document.getElementById('btn-join').addEventListener('click', () => {
  myName = document.getElementById('player-name').value.trim();
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!myName) { showError('Enter your name first!'); return; }
  if (!code)   { showError('Enter a room code!'); return; }
  socket.emit('join_room', { name: myName, code });
});

document.getElementById('room-code-input').addEventListener('keyup', e => {
  e.target.value = e.target.value.toUpperCase();
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});
document.getElementById('player-name').addEventListener('keyup', e => {
  if (e.key === 'Enter') document.getElementById('btn-create').click();
});

function showError(msg) {
  const el = document.getElementById('lobby-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── Room events ──────────────────────────────────────────
socket.on('room_created', ({ code }) => {
  roomCode = code;
  isSpectator = false;
  setCodeDisplays(code);
  showScreen('waiting-screen');
});

socket.on('room_joined', ({ code, spectator, reconnected }) => {
  roomCode = code;
  isSpectator = !!spectator;
  setCodeDisplays(code);
  if (!spectator) showScreen('waiting-screen');
  if (reconnected) addChat('🔄', 'You rejoined the room', 'system');
});

function setCodeDisplays(code) {
  document.getElementById('display-code').textContent = code;
  document.getElementById('game-room-code').textContent = code;
}

// ── Copy & Share ─────────────────────────────────────────
document.getElementById('btn-copy').addEventListener('click', () => {
  navigator.clipboard.writeText(roomCode).then(() => {
    const btn = document.getElementById('btn-copy');
    btn.textContent = '✅'; setTimeout(() => btn.textContent = '📋', 1500);
  });
});

document.getElementById('btn-share').addEventListener('click', () => {
  const url = `${location.origin}${location.pathname}?join=${roomCode}`;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('btn-share');
    btn.textContent = '✅'; setTimeout(() => btn.textContent = '🔗', 1500);
  });
});

// ── Room update ──────────────────────────────────────────
socket.on('room_update', ({ players: pl, game, opts }) => {
  players = pl;
  gameState = game;
  if (opts) applyOpts(opts);
  renderWaitingPlayers();

  const isHost = pl.find(p => p.id === myId)?.isHost;
  const btnStart    = document.getElementById('btn-start');
  const botControls = document.getElementById('bot-controls');
  const settings    = document.getElementById('game-settings');
  const btnAddBot   = document.getElementById('btn-add-bot');

  if (isHost && (!game || !game.started)) {
    botControls.classList.remove('hidden');
    settings.classList.remove('hidden');
    btnAddBot.disabled = pl.length >= 4;
  } else {
    botControls.classList.add('hidden');
    settings.classList.add('hidden');
  }

  if (isHost && pl.length >= 2 && (!game || !game.started)) {
    btnStart.classList.remove('hidden');
  } else {
    btnStart.classList.add('hidden');
  }

  if (game && game.started) {
    showScreen('game-screen');
    renderGame();
  }
});

function applyOpts(opts) {
  currentDiceType = opts.diceType || 'D6';
  document.getElementById('dice-badge').textContent = currentDiceType;
  // Sync selects (non-destructively)
  ['sel-rounds','sel-dice','sel-bot'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
  });
}

// ── Settings changes (host) ──────────────────────────────
function emitOpts() {
  socket.emit('update_opts', {
    rounds:        +document.getElementById('sel-rounds').value,
    diceType:       document.getElementById('sel-dice').value,
    botDifficulty:  document.getElementById('sel-bot').value,
  });
}
['sel-rounds','sel-dice','sel-bot'].forEach(id => {
  document.getElementById(id).addEventListener('change', emitOpts);
});

// ── Waiting room render ──────────────────────────────────
function renderWaitingPlayers() {
  const grid = document.getElementById('waiting-players');
  grid.innerHTML = '';
  const isHost = players.find(p => p.id === myId)?.isHost;
  for (let i = 0; i < 4; i++) {
    const p = players[i];
    const div = document.createElement('div');
    div.className = 'player-slot' + (p ? ` filled ${PLAYER_COLORS[i]}` : '') + (p?.isBot ? ' is-bot' : '');
    if (p) {
      const tag = p.isBot ? '🤖 AI Bot' : (p.isHost ? '👑 Host' : 'Player');
      const removeBtn = (isHost && p.isBot && (!gameState || !gameState.started))
        ? `<button class="btn-remove-bot" data-bot-id="${p.id}" title="Remove bot">✕</button>` : '';
      div.innerHTML = `
        <div class="avatar">${p.isBot ? '🤖' : AVATARS[i]}</div>
        <div class="p-name">${p.name}${p.id === myId ? ' (you)' : ''}</div>
        <div class="p-tag">${tag}${removeBtn}</div>`;
    } else {
      div.innerHTML = `<div class="avatar" style="opacity:.2">❓</div><div class="p-name" style="color:var(--muted)">Waiting…</div>`;
    }
    grid.appendChild(div);
  }
  grid.querySelectorAll('.btn-remove-bot').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); socket.emit('remove_bot', { botId: btn.dataset.botId }); });
  });
}

document.getElementById('btn-add-bot').addEventListener('click', () => socket.emit('add_bot'));
document.getElementById('btn-start').addEventListener('click', () => socket.emit('start_game'));

// ── Game started ─────────────────────────────────────────
socket.on('game_started', ({ opts } = {}) => {
  if (opts) { currentDiceType = opts.diceType || 'D6'; document.getElementById('dice-badge').textContent = currentDiceType; }
  roundHistory = [];
  showScreen('game-screen');
  soundTick();
});

// ── Game render ──────────────────────────────────────────
function renderGame() {
  if (!gameState) return;
  const g = gameState;
  document.getElementById('round-num').textContent   = g.round;
  document.getElementById('total-rounds').textContent = g.totalRounds;
  document.getElementById('dice-badge').textContent   = g.diceType || 'D6';

  const list = document.getElementById('score-list');
  list.innerHTML = '';
  g.players.forEach((p, i) => {
    const div = document.createElement('div');
    const isActive = i === g.currentTurnIndex;
    const rolled   = g.roundRolls && g.roundRolls[p.id] !== undefined;
    div.className  = `score-item ${PLAYER_COLORS[i]}` + (isActive ? ' active-turn' : '') + (rolled ? ' rolled' : '');
    div.innerHTML  = `
      <span class="score-avatar">${AVATARS[i]}</span>
      <span class="score-name">${p.name}${p.id === myId ? ' (you)' : ''}</span>
      <span class="score-pts">${g.scores[p.id] || 0}</span>`;
    list.appendChild(div);
  });

  const cur = g.players[g.currentTurnIndex];
  const banner = document.getElementById('turn-banner');
  if (cur) {
    banner.textContent = cur.id === myId ? '🎲 Your turn — Roll!' : `⏳ ${cur.name}'s turn…`;
    banner.style.borderColor = cur.id === myId ? 'var(--accent)' : 'var(--border)';
  }

  const rollBtn = document.getElementById('btn-roll');
  const isMyTurn = cur && cur.id === myId && !hasRolled && !isSpectator;
  rollBtn.classList.toggle('hidden', !isMyTurn);

  // Show history btn if rounds played
  if (roundHistory.length > 0) document.getElementById('btn-history').classList.remove('hidden');
}

// ── Roll ─────────────────────────────────────────────────
document.getElementById('btn-roll').addEventListener('click', () => {
  if (hasRolled) return;
  hasRolled = true;
  document.getElementById('btn-roll').classList.add('hidden');
  socket.emit('roll_dice');
});

const FACE_TRANSFORMS = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(-90deg) rotateY(0deg)',
  4: 'rotateX(90deg) rotateY(0deg)',
  5: 'rotateX(0deg) rotateY(90deg)',
  6: 'rotateX(180deg) rotateY(0deg)',
};

socket.on('dice_rolled', ({ playerId, roll, sides }) => {
  soundRoll();
  const isD6 = (sides || 6) === 6;
  const bigResult = document.getElementById('big-result');
  const diceEl    = document.getElementById('dice');

  if (isD6) {
    bigResult.classList.add('hidden');
    diceEl.parentElement.style.display = '';
    animateDice(roll);
  } else {
    diceEl.parentElement.style.display = 'none';
    bigResult.textContent = roll;
    bigResult.classList.remove('hidden');
  }

  const p = players.find(p => p.id === playerId);
  const name = p ? p.name : 'Someone';
  addChat('🎲', `${name} rolled a ${roll}!`, 'system');
  if (gameState && gameState.roundRolls) gameState.roundRolls[playerId] = roll;

  const resultEl = document.getElementById('roll-result');
  resultEl.classList.remove('hidden');
  resultEl.textContent = playerId === myId ? `You rolled: ${roll} 🎲` : `${name}: ${roll}`;
});

function animateDice(value) {
  const dice = document.getElementById('dice');
  dice.classList.remove('rolling');
  void dice.offsetWidth;
  dice.classList.add('rolling');
  setTimeout(() => {
    dice.classList.remove('rolling');
    dice.style.transform = FACE_TRANSFORMS[value] || '';
  }, 850);
}

// ── Tiebreak ─────────────────────────────────────────────
socket.on('tiebreak', ({ tiedPlayers }) => {
  const banner = document.getElementById('tiebreak-banner');
  banner.classList.remove('hidden');
  hasRolled = false;
  soundTick();
  setTimeout(() => banner.classList.add('hidden'), 3000);
});

// ── Round result ─────────────────────────────────────────
socket.on('round_result', ({ rolls, roundWinner, scores, round, isTiebreak }) => {
  hasRolled = false;
  document.getElementById('roll-result').classList.add('hidden');
  document.getElementById('big-result').classList.add('hidden');

  // Save to local history
  roundHistory.push({ round, rolls, winner: roundWinner });
  document.getElementById('btn-history').classList.remove('hidden');

  const overlay = document.getElementById('round-overlay');
  overlay.classList.remove('hidden');
  document.getElementById('round-title').textContent = isTiebreak ? `Tiebreak Result` : `Round ${round} Result`;

  const rollsDiv = document.getElementById('round-rolls');
  rollsDiv.innerHTML = '';
  players.forEach((p, i) => {
    if (rolls[p.id] === undefined) return;
    const row = document.createElement('div');
    row.className = 'round-roll-row';
    row.innerHTML = `<span>${AVATARS[i]} ${p.name}</span><span class="rr-roll">${rolls[p.id]}</span>`;
    rollsDiv.appendChild(row);
  });

  const winnerEl = document.getElementById('round-winner-msg');
  if (roundWinner) {
    const wp = players.find(p => p.id === roundWinner);
    winnerEl.textContent = wp ? `🏆 ${wp.name} wins this round!` : '';
  } else {
    winnerEl.textContent = '🤝 Tie — no point awarded!';
  }

  if (gameState) gameState.scores = scores;
  setTimeout(() => { overlay.classList.add('hidden'); document.getElementById('roll-result').classList.add('hidden'); }, 2500);
});

// ── History panel ─────────────────────────────────────────
document.getElementById('btn-history').addEventListener('click', () => {
  const panel = document.getElementById('history-panel');
  const isOpen = !panel.classList.contains('hidden');
  if (isOpen) { panel.classList.add('hidden'); return; }
  panel.innerHTML = '';
  roundHistory.forEach(({ round, rolls, winner }) => {
    const row = document.createElement('div');
    row.className = 'history-row';
    const wp = players.find(p => p.id === winner);
    const rollStr = players.map((p,i) => `${AVATARS[i]}${rolls[p.id]??'—'}`).join(' ');
    row.innerHTML = `<span>R${round}: ${rollStr}</span><span class="h-winner">${wp ? wp.name : 'Tie'}</span>`;
    panel.appendChild(row);
  });
  panel.classList.remove('hidden');
});

// ── Room state refresh (in-game) ─────────────────────────
socket.on('room_update', ({ players: pl, game }) => {
  players = pl;
  gameState = game;
  if (game && game.started) renderGame();
});

// ── Game over ─────────────────────────────────────────────
socket.on('game_over', ({ scores, winner, players: pl, history }) => {
  players = pl;
  if (history) roundHistory = history;
  setTimeout(() => {
    showScreen('gameover-screen');
    if (winner) { launchConfetti(); soundWin(); }
    const wp = pl.find(p => p.id === winner);
    document.getElementById('winner-name').textContent =
      winner ? (wp ? `🏆 ${wp.name} Wins!` : 'Winner!') : '🤝 It\'s a Tie!';

    const finalScores = document.getElementById('final-scores');
    finalScores.innerHTML = '';
    const sorted = [...pl].sort((a, b) => (scores[b.id]||0) - (scores[a.id]||0));
    sorted.forEach(p => {
      const row = document.createElement('div');
      row.className = 'final-row' + (p.id === winner ? ' winner' : '');
      const i = pl.indexOf(p);
      row.innerHTML = `<span>${AVATARS[i]||'❓'} ${p.name}${p.id===myId?' (you)':''}</span><span class="final-pts">${scores[p.id]||0}</span>`;
      finalScores.appendChild(row);
    });

    const isHost = pl.find(p => p.id === myId)?.isHost;
    document.getElementById('btn-play-again').classList.toggle('hidden', !isHost);
  }, 2800);
});

document.getElementById('btn-play-again').addEventListener('click', () => socket.emit('play_again'));

socket.on('reset_lobby', () => {
  hasRolled = false;
  gameState = null;
  roundHistory = [];
  document.getElementById('roll-result').classList.add('hidden');
  document.getElementById('big-result').classList.add('hidden');
  document.getElementById('round-overlay').classList.add('hidden');
  document.getElementById('tiebreak-banner').classList.add('hidden');
  document.getElementById('history-panel').classList.add('hidden');
  document.getElementById('btn-history').classList.add('hidden');
  document.getElementById('dice').parentElement.style.display = '';
  showScreen('waiting-screen');
  renderWaitingPlayers();
});

// ── Player events ─────────────────────────────────────────
socket.on('player_left', ({ id }) => {
  const p = players.find(p => p.id === id);
  if (p) addChat('👋', `${p.name} left the game`, 'system');
});

socket.on('player_disconnected', ({ name }) => {
  addChat('⚡', `${name} disconnected (15s to rejoin)`, 'system');
});

socket.on('server_shutdown', ({ message }) => {
  addChat('⚠️', message, 'system');
});

// ── Chat ──────────────────────────────────────────────────
document.getElementById('btn-send').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keyup', e => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('chat_message', { message: msg });
  input.value = '';
}

socket.on('chat_message', ({ name, message }) => addChat(name, message, ''));

function addChat(name, message, type) {
  const box = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg' + (type === 'system' ? ' system' : '') + ' fade-in';
  div.innerHTML = `<span class="chat-name">${name}:</span> ${message}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// ── Errors ────────────────────────────────────────────────
socket.on('error', (msg) => showError(msg));
