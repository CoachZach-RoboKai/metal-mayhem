const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const port = 80;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Private-Network", "true");
    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

io.on('connection', (socket) => {
    console.log(`Chromebook connected: ${socket.id}`);

    socket.on('createRoom', (roomCode) => {
        socket.join(roomCode);
        console.log(`Host created room: ${roomCode}`);
    });

    socket.on('joinRoom', (roomCode) => {
        socket.join(roomCode);
        socket.to(roomCode).emit('playerJoined');
        console.log(`Joiner entered room: ${roomCode}`);
    });

    socket.on('hostStateUpdate', (data) => {
        socket.to(data.roomCode).emit('joinerStateSync', data.state);
    });

    socket.on('joinerInput', (data) => {
        socket.to(data.roomCode).emit('hostReceiveInput', data.inputs);
    });

    socket.on('disconnect', () => {
        console.log(`Chromebook disconnected: ${socket.id}`);
    });
});

app.get('/api/leaderboard', (req, res) => {
    try { res.json(db.prepare(`SELECT * FROM scores ORDER BY score DESC LIMIT 100`).all()); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/scores', (req, res) => {
    const { name, gamemode, matchTime, score, botsDefeated } = req.body;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[new Date().getDay()]; 
    try {
        const stmt = db.prepare(`INSERT INTO scores (name, gamemode, matchTime, score, botsDefeated, dayOfWeek) VALUES (?, ?, ?, ?, ?, ?)`);
        const info = stmt.run(name, gamemode, matchTime, score, botsDefeated, dayOfWeek);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

server.listen(port, () => {
    console.log(`RoboKaiVan Server running at http://metalmayhem.local`);
});