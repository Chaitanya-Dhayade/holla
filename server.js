const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ─── Constants ────────────────────────────────────────────
const DICE_SIDES = { D4: 4, D6: 6, D8: 8, D10: 10, D12: 12, D20: 20 };
const BOT_NAMES  = ['RoboRoll', 'DiceBot', 'CubeAI', 'AutoRoll'];
const ROOM_TTL        = 5 * 60 * 1000; // 5 min empty-room cleanup
const RECONNECT_GRACE = 15 * 1000;     // 15 s reconnect window
const ROLL_RATE_MS    = 500;           // min ms between rolls
const CHAT_RATE_MS    = 300;

// ─── State ────────────────────────────────────────────────
const rooms       = {};  // code → { players, game, opts, _expiryTimer }
const disconnected = {}; // oldSocketId → { roomCode, player, timer }
const lastRoll    = {};  // socketId → timestamp
const lastChat    = {};  // socketId → timestamp

// ─── Utils ────────────────────────────────────────────────
function log(obj) { console.log(JSON.stringify({ ts: new Date().toISOString(), ...obj })); }

function sanitize(str, maxLen = 80) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' })[c])
            .trim().slice(0, maxLen);
}

function rateOk(map, socketId, minMs) {
  const now = Date.now();
  if (map[socketId] && now - map[socketId] < minMs) return false;
  map[socketId] = now;
  return true;
}

function genCode() { return Math.random().toString(36).substring(2, 7).toUpperCase(); }

function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }

function botRoll(sides, difficulty) {
  if (difficulty === 'easy') return rollDie(sides);
  if (difficulty === 'hard') return Math.max(rollDie(sides), rollDie(sides), rollDie(sides));
  const a = rollDie(sides), b = rollDie(sides);
  return Math.random() < 0.6 ? Math.max(a, b) : Math.min(a, b);
}

// ─── Game init ────────────────────────────────────────────
function initGame(players, opts = {}) {
  const { rounds = 5, diceType = 'D6', botDifficulty = 'medium' } = opts;
  return {
    started: true,
    round: 1, totalRounds: rounds,
    diceType, botDifficulty,
    currentTurnIndex: 0,
    scores: Object.fromEntries(players.map(p => [p.id, 0])),
    roundRolls: {},
    roundHistory: [],
    players: [...players],
    phase: 'rolling',
    isTiebreak: false,
    tiebreakPlayers: [],
  };
}

// ─── Helpers ──────────────────────────────────────────────
function getRoomOf(socketId) {
  return Object.keys(rooms).find(code => rooms[code].players.some(p => p.id === socketId));
}

function broadcastRoomState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  io.to(roomCode).emit('room_update', { players: room.players, game: room.game || null, opts: room.opts });
}

function scheduleRoomExpiry(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  clearTimeout(room._expiryTimer);
  room._expiryTimer = setTimeout(() => {
    if (rooms[roomCode] && rooms[roomCode].players.length === 0) {
      delete rooms[roomCode];
      log({ event: 'room_expired', code: roomCode });
    }
  }, ROOM_TTL);
}

// ─── Bot turn ─────────────────────────────────────────────
function scheduleBotTurn(roomCode) {
  const room = rooms[roomCode];
  if (!room || !room.game) return;
  const g = room.game;
  if (!g.started || g.phase !== 'rolling') return;

  const active = g.isTiebreak
    ? g.tiebreakPlayers.map(id => g.players.find(p => p.id === id)).filter(Boolean)
    : g.players;
  const cur = active[g.currentTurnIndex];
  if (!cur || !cur.isBot || g.roundRolls[cur.id] !== undefined) return;

  const botId = cur.id;
  setTimeout(() => {
    const r2 = rooms[roomCode];
    if (!r2 || !r2.game) return;
    const g2 = r2.game;
    if (!g2.started || g2.phase !== 'rolling') return;
    if (g2.roundRolls[botId] !== undefined) return;
    const active2 = g2.isTiebreak
      ? g2.tiebreakPlayers.map(id => g2.players.find(p => p.id === id)).filter(Boolean)
      : g2.players;
    if (active2[g2.currentTurnIndex]?.id !== botId) return;

    const sides = DICE_SIDES[g2.diceType] || 6;
    const roll = botRoll(sides, g2.botDifficulty);
    g2.roundRolls[botId] = roll;
    io.to(roomCode).emit('dice_rolled', { playerId: botId, roll, sides });
    advanceTurn(roomCode);
  }, 700 + Math.random() * 800);
}

// ─── Turn logic ───────────────────────────────────────────
function advanceTurn(roomCode) {
  const room = rooms[roomCode];
  const g = room.game;

  const active = g.isTiebreak
    ? g.tiebreakPlayers.map(id => g.players.find(p => p.id === id)).filter(Boolean)
    : g.players;

  if (!active.every(p => g.roundRolls[p.id] !== undefined)) {
    g.currentTurnIndex = active.findIndex(p => g.roundRolls[p.id] === undefined);
    broadcastRoomState(roomCode);
    scheduleBotTurn(roomCode);
    return;
  }

  let maxRoll = -1;
  for (const p of active) if (g.roundRolls[p.id] > maxRoll) maxRoll = g.roundRolls[p.id];
  const winners = active.filter(p => g.roundRolls[p.id] === maxRoll);

  // Tiebreak re-roll
  if (winners.length > 1 && !g.isTiebreak) {
    const snap = { ...g.roundRolls };
    g.isTiebreak = true;
    g.tiebreakPlayers = winners.map(p => p.id);
    g.roundRolls = {};
    g.currentTurnIndex = 0;
    io.to(roomCode).emit('tiebreak', { tiedPlayers: g.tiebreakPlayers, rolls: snap });
    broadcastRoomState(roomCode);
    scheduleBotTurn(roomCode);
    return;
  }

  const winnerId = winners.length === 1 ? winners[0].id : null;
  if (winnerId) g.scores[winnerId]++;

  g.roundHistory.push({ round: g.round, rolls: { ...g.roundRolls }, winner: winnerId });

  const summary = { rolls: { ...g.roundRolls }, roundWinner: winnerId, scores: { ...g.scores }, round: g.round, isTiebreak: g.isTiebreak };
  io.to(roomCode).emit('round_result', summary);

  g.isTiebreak = false;
  g.tiebreakPlayers = [];

  if (g.round >= g.totalRounds) {
    let top = -1, gw = null;
    for (const [pid, sc] of Object.entries(g.scores)) if (sc > top) { top = sc; gw = pid; }
    const ties = Object.entries(g.scores).filter(([, s]) => s === top);
    io.to(roomCode).emit('game_over', {
      scores: g.scores,
      winner: ties.length === 1 ? gw : null,
      players: g.players,
      history: g.roundHistory,
    });
    g.phase = 'game_end';
    g.started = false;
  } else {
    g.round++;
    g.roundRolls = {};
    g.currentTurnIndex = 0;
    g.phase = 'rolling';
    setTimeout(() => { broadcastRoomState(roomCode); scheduleBotTurn(roomCode); }, 1500);
  }
}

// ─── Socket events ────────────────────────────────────────
io.on('connection', (socket) => {
  log({ event: 'connect', id: socket.id });

  socket.on('create_room', ({ name }) => {
    const safeName = sanitize(name, 16);
    if (!safeName) { socket.emit('error', 'Invalid name'); return; }
    const code = genCode();
    rooms[code] = {
      players: [{ id: socket.id, name: safeName, isHost: true, isBot: false }],
      game: null,
      opts: { rounds: 5, diceType: 'D6', botDifficulty: 'medium' },
    };
    socket.join(code);
    socket.emit('room_created', { code });
    broadcastRoomState(code);
  });

  socket.on('join_room', ({ name, code }) => {
    const safeName = sanitize(name, 16);
    const safeCode = sanitize(code, 5).toUpperCase();
    if (!safeName) { socket.emit('error', 'Invalid name'); return; }
    const room = rooms[safeCode];
    if (!room) { socket.emit('error', 'Room not found'); return; }

    if (room.game && room.game.started) {
      socket.join(safeCode);
      socket.emit('room_joined', { code: safeCode, spectator: true });
      socket.emit('room_update', { players: room.players, game: room.game, opts: room.opts });
      return;
    }
    if (room.players.length >= 4) { socket.emit('error', 'Room full (max 4)'); return; }
    if (room.players.some(p => p.id === socket.id)) return;

    // Reconnect by name match
    const reconKey = Object.keys(disconnected).find(k =>
      disconnected[k].roomCode === safeCode && disconnected[k].player.name === safeName
    );
    if (reconKey) {
      clearTimeout(disconnected[reconKey].timer);
      delete disconnected[reconKey];
      const idx = room.players.findIndex(p => p.id === reconKey);
      if (idx !== -1) {
        room.players[idx].id = socket.id;
        if (room.game) {
          room.game.scores[socket.id] = room.game.scores[reconKey] || 0;
          delete room.game.scores[reconKey];
          if (room.game.roundRolls[reconKey] !== undefined) {
            room.game.roundRolls[socket.id] = room.game.roundRolls[reconKey];
            delete room.game.roundRolls[reconKey];
          }
          room.game.players = room.game.players.map(p => p.id === reconKey ? { ...p, id: socket.id } : p);
        }
      }
      socket.join(safeCode);
      socket.emit('room_joined', { code: safeCode, reconnected: true });
      broadcastRoomState(safeCode);
      return;
    }

    room.players.push({ id: socket.id, name: safeName, isHost: false, isBot: false });
    socket.join(safeCode);
    socket.emit('room_joined', { code: safeCode });
    broadcastRoomState(safeCode);
  });

  socket.on('update_opts', (opts) => {
    const code = getRoomOf(socket.id);
    if (!code) return;
    const room = rooms[code];
    if (!room.players.find(p => p.id === socket.id)?.isHost) return;
    if (room.game && room.game.started) return;
    const { rounds, diceType, botDifficulty } = opts;
    if ([3,5,7,10].includes(+rounds)) room.opts.rounds = +rounds;
    if (DICE_SIDES[diceType]) room.opts.diceType = diceType;
    if (['easy','medium','hard'].includes(botDifficulty)) room.opts.botDifficulty = botDifficulty;
    broadcastRoomState(code);
  });

  socket.on('add_bot', () => {
    const code = getRoomOf(socket.id);
    if (!code) return;
    const room = rooms[code];
    if (!room.players.find(p => p.id === socket.id)?.isHost) return;
    if (room.game && room.game.started) return;
    if (room.players.length >= 4) { socket.emit('error', 'Room full (max 4)'); return; }
    const n = room.players.filter(p => p.isBot).length;
    room.players.push({ id: `bot_${Date.now()}_${n+1}`, name: BOT_NAMES[n] || `Bot ${n+1}`, isHost: false, isBot: true });
    broadcastRoomState(code);
  });

  socket.on('remove_bot', ({ botId }) => {
    const code = getRoomOf(socket.id);
    if (!code) return;
    const room = rooms[code];
    if (!room.players.find(p => p.id === socket.id)?.isHost) return;
    if (room.game && room.game.started) return;
    room.players = room.players.filter(p => p.id !== botId);
    broadcastRoomState(code);
  });

  socket.on('start_game', () => {
    const code = getRoomOf(socket.id);
    if (!code) return;
    const room = rooms[code];
    if (!room.players.find(p => p.id === socket.id)?.isHost) { socket.emit('error', 'Only host can start'); return; }
    if (room.players.length < 2) { socket.emit('error', 'Need at least 2 players'); return; }
    room.game = initGame(room.players, room.opts);
    broadcastRoomState(code);
    io.to(code).emit('game_started', { opts: room.opts });
    scheduleBotTurn(code);
  });

  socket.on('roll_dice', () => {
    if (!rateOk(lastRoll, socket.id, ROLL_RATE_MS)) return;
    const code = getRoomOf(socket.id);
    if (!code) return;
    const room = rooms[code];
    const g = room.game;
    if (!g || !g.started || g.phase !== 'rolling') return;

    const active = g.isTiebreak
      ? g.tiebreakPlayers.map(id => g.players.find(p => p.id === id)).filter(Boolean)
      : g.players;
    const cur = active[g.currentTurnIndex];
    if (!cur || cur.id !== socket.id) { socket.emit('error', 'Not your turn'); return; }
    if (g.roundRolls[socket.id] !== undefined) return;

    const sides = DICE_SIDES[g.diceType] || 6;
    const roll = rollDie(sides);
    g.roundRolls[socket.id] = roll;
    io.to(code).emit('dice_rolled', { playerId: socket.id, roll, sides });
    advanceTurn(code);
  });

  socket.on('chat_message', ({ message }) => {
    if (!rateOk(lastChat, socket.id, CHAT_RATE_MS)) return;
    const code = getRoomOf(socket.id);
    if (!code) return;
    const room = rooms[code];
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const safeMsg = sanitize(message, 80);
    if (!safeMsg) return;
    io.to(code).emit('chat_message', { name: player.name, message: safeMsg, id: socket.id });
  });

  socket.on('play_again', () => {
    const code = getRoomOf(socket.id);
    if (!code) return;
    const room = rooms[code];
    if (!room.players.find(p => p.id === socket.id)?.isHost) return;
    room.game = null;
    broadcastRoomState(code);
    io.to(code).emit('reset_lobby');
  });

  socket.on('disconnect', () => {
    log({ event: 'disconnect', id: socket.id });
    delete lastRoll[socket.id];
    delete lastChat[socket.id];
    const code = getRoomOf(socket.id);
    if (!code) return;
    const room = rooms[code];
    const player = room.players.find(p => p.id === socket.id);

    if (player && !player.isBot) {
      disconnected[socket.id] = {
        roomCode: code,
        player: { ...player },
        timer: setTimeout(() => {
          delete disconnected[socket.id];
          const r = rooms[code];
          if (!r) return;
          r.players = r.players.filter(p => p.id !== socket.id);
          if (r.players.length === 0) { scheduleRoomExpiry(code); return; }
          if (!r.players.some(p => p.isHost)) r.players[0].isHost = true;
          io.to(code).emit('player_left', { id: socket.id });
          broadcastRoomState(code);
        }, RECONNECT_GRACE),
      };
      io.to(code).emit('player_disconnected', { id: socket.id, name: player.name });
    } else {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) { scheduleRoomExpiry(code); return; }
      if (!room.players.some(p => p.isHost)) room.players[0].isHost = true;
      io.to(code).emit('player_left', { id: socket.id });
      broadcastRoomState(code);
    }
  });
});

process.on('SIGTERM', () => {
  io.emit('server_shutdown', { message: 'Server restarting…' });
  server.close(() => process.exit(0));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => log({ event: 'listen', port: PORT }));
