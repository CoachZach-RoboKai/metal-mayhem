const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
// Socket.IO requires a raw HTTP server instance
const server = http.createServer(app);
const io = new Server(server);
const port = 80;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Local Database
const db = new Database('./leaderboard.db');
console.log("Local better-sqlite3 database active.");

db.exec(`CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    gamemode TEXT,
    matchTime TEXT,
    score INTEGER,
    botsDefeated INTEGER,
    dayOfWeek TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Real-Time Socket.IO Relay
io.on('connection', (socket) => {
    console.log(`New Chromebook connected: ${socket.id}`);

    // The Host sends the master game state, relay it directly to the Joiner
    socket.on('hostStateUpdate', (data) => {
        socket.broadcast.emit('joinerStateSync', data);
    });

    // The Joiner sends their keystrokes, relay them directly to the Host
    socket.on('joinerInput', (data) => {
        socket.broadcast.emit('hostReceiveInput', data);
    });

    socket.on('disconnect', () => {
        console.log(`Chromebook disconnected: ${socket.id}`);
    });
});

// Local Leaderboard APIs
app.get('/api/leaderboard', (req, res) => {
    try {
        const rows = db.prepare(`SELECT * FROM scores ORDER BY score DESC LIMIT 100`).all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/scores', (req, res) => {
    const { name, gamemode, matchTime, score, botsDefeated } = req.body;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[new Date().getDay()]; 
    
    try {
        const stmt = db.prepare(`INSERT INTO scores (name, gamemode, matchTime, score, botsDefeated, dayOfWeek) VALUES (?, ?, ?, ?, ?, ?)`);
        const info = stmt.run(name, gamemode, matchTime, score, botsDefeated, dayOfWeek);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start the combined server
server.listen(port, () => {
    console.log(`RoboKaiVan Server running at http://metalmayhem.local`);
});