# 🎲 Dice Roll Battle

**Battle your friends (and bots) in a high-stakes, real-time dice competition!**

Dice Roll Battle is a premium, web-based multiplayer experience built for competitive fun. Whether you're playing with local friends or challenging our custom-built AI bots, every roll matters. With smooth 3D animations, real-time chat, and customizable game rules, it's the ultimate way to settle scores.

---

## 🌟 Why Dice Roll Battle?

- **Zero Latency:** Built on top of WebSockets for instant synchronization. What you see is exactly what your opponents see.
- **Highly Customizable:** Want a quick 3-round sprint with D20s? Or a marathon 10-round battle with D6s? You decide.
- **Smart AI:** No friends online? No problem. Add up to 3 bots with varying difficulty levels that play just like humans.
- **Premium Design:** A sleek, modern UI featuring the **Outfit** typeface, glassmorphism effects, and vibrant player-specific color schemes.

---

## ✨ Features

- **Real-Time Multiplayer:** Instant synchronization between players using Socket.io.
- **Private Rooms:** Create a unique 5-character room code to invite friends securely.
- **Customizable Rules:** Host can change rounds (3, 5, 7, 10) and dice types (D4, D6, D8, D10, D12, D20).
- **AI Bots:** Add AI-controlled bots with adjustable difficulty (**Easy**, **Medium**, **Hard**) to fill empty slots.
- **Turn-Based Gameplay:** Up to 4 players can join a room and take turns rolling in a synchronized loop.
- **Tiebreaker System:** Dynamic re-roll rounds when players get the same highest score, ensuring a fair winner every time.
- **Live Score Tracking:** Real-time leaderboard updates and round-by-round history.
- **In-Game Chat:** Communicate with opponents via a sleek, rate-limited chat system.
- **Smart Reconnection:** A 15-second grace period allows players to rejoin their active room without losing progress.
- **3D Dice Animation:** High-performance CSS 3D dice that roll realistically based on server results.
- **Responsive & Premium UI:** Optimized for everything from mobile phones to ultra-wide monitors.

---

## 🛠️ Tech Stack

- **Backend:** Node.js & Express.js for a robust, scalable server.
- **Real-time:** Socket.io for low-latency, bidirectional communication.
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, and CSS3 (Modern Flexbox/Grid).
- **Typography:** [Outfit](https://fonts.google.com/specimen/Outfit) via Google Fonts.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v14+)
- npm

### Installation & Running
1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd "Die Roll"
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Launch the battle**:
   ```bash
   npm start
   ```
   *For development with auto-reload:* `npm run dev`

4. **Join the Fray**:
   Navigate to `http://localhost:3000`. Open it in multiple tabs to test the multiplayer magic!

---

## 🤝 Invite a Friend

Playing with friends is easy! Follow these steps to get everyone into the same battle:

1.  **The Host:** Click **"Create Room"**. Once you're in the lobby, look at the top of your screen to find your unique **5-character Room Code** (e.g., `A1B2C`).
2.  **The Guest:** Open the game URL in your browser.
3.  **Joining:** Enter your name, then type the **Room Code** into the "Enter Code" box and click **"Join Room"**.
4.  **Battle:** Once your friend appears in the lobby list, the host can click "Start Battle" to begin!

---

## 🎮 How to Play

1. **Identity:** Enter your name to enter the lobby.
2. **Lobby:** **Create** a new room as a host or **Join** using a code.
3. **Settings (Host):** Adjust rounds, dice types, and bot difficulty in the settings panel.
4. **Prepare:** Add AI bots if needed. You need 2-4 players/bots to start.
5. **Battle:** When the host starts, follow the turn indicator. Click **Roll Dice!** on your turn.
6. **Victory:** Highest roll wins the round. Most round wins at the end wins the game!

---

## 📄 Deep Dive
For technical architecture, ER diagrams, and system flow, see [PROJECT_DETAILS.md](file:///g:/Die%20Roll/PROJECT_DETAILS.md).
