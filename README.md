# 🎲 Dice Roll Battle

Dice Roll Battle is a real-time, web-based multiplayer game built with Node.js and Socket.io. Gather your friends, create a room, and battle it out in a synchronized dice-rolling competition! 

## ✨ Features

- **Real-Time Multiplayer:** Instant synchronization between players using WebSockets.
- **Private Rooms:** Create a unique 5-character room code to invite friends.
- **Turn-Based Gameplay:** Up to 4 players can join a room and take turns rolling.
- **Live Score Tracking:** Automatic calculation of round winners and overall points.
- **In-Game Chat:** Chat with other players in your room in real-time.
- **3D Dice Animation:** Smooth CSS-based 3D dice rolling animations.
- **Responsive UI:** Works seamlessly on both desktop and mobile devices.

## 🛠️ Technologies Used

- **Backend:** Node.js, Express.js
- **Networking:** Socket.io (WebSockets)
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Font:** [Outfit](https://fonts.google.com/specimen/Outfit) (Google Fonts)

## 📋 Prerequisites

Before running the project locally, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v14.0.0 or higher recommended)
- npm (comes bundled with Node.js)

## 🚀 Installation & Running

1. **Clone the repository** (or download the source code):
   ```bash
   git clone <repository-url>
   cd "Die Roll"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```
   *(For development with auto-restart, you can run `npm run dev`)*

4. **Play the game**:
   Open your browser and navigate to `http://localhost:3000`. Open the link in multiple tabs or devices on the same network to simulate multiple players!

## 🎮 How to Play

1. **Enter the Lobby:** Type your name to get started.
2. **Create or Join:** 
   - Click **Create Room** to generate a new lobby and become the host.
   - Enter a 5-letter code and click **Join** to enter an existing room.
3. **Wait for Players:** You need at least 2 players (and up to 4) to start.
4. **Start Battle:** The host clicks "Start Battle" when everyone is ready.
5. **Roll the Dice:** Wait for your turn, then click "Roll Dice!". The player with the highest roll wins the round and earns 1 point (ties result in no points).
6. **Win the Game:** The player with the most points after 5 rounds is declared the ultimate winner!

## 📄 Documentation
For an in-depth look at the architecture, data modeling, and system flow, please refer to the `PROJECT_DETAILS.md` file included in this repository.
